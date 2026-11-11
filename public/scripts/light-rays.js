/* Light rays over the sky (SiteSky.astro): sunbeams by day, fainter cool
   moonbeams by night. Crepuscular rays fan out from a light just off the top right of the screen
   (where the nav's sun/moon switch sits), slowly drifting and breathing.

   Drawn the pixel-art way, to sit with the pixel clouds: the screen is split
   into 3px cells and each cell is lit or not by a 4x4 Bayer matrix against the
   rays' strength there (ordered dithering), in two tones, so beams have hard
   pixel edges that fade out through the dither pattern instead of a smooth
   blur. GPU god-ray shaders blur an occlusion mask along lines from the
   light; with nothing to occlude here, each beam is a soft wedge of angle
   from the light, fading with distance.

   Cost: each cell's angle and distance from the light are worked out once per
   resize; a frame sums the beams (6) into a table by angle, then looks each
   cell up into an ImageData, at about 12fps while the tab is visible. Reduced motion: one still frame.
   window.lightRays.set({ on: false }) turns it off (the ?seasons preview switch).

   Style trial (2026-11-11): ?rays shows a switch to try other looks on the real
   site. 'pixel' is the above; 'smooth' is the same beams without the dither;
   soft/shafts/haze/grain/painted are CSS layers (styles in SiteSky.astro), plus
   CSS animations sway/breathe/shimmer/both/scroll/point. The pick is kept for the
   tab (sessionStorage). shortcut: trial code, drop the losers once one is chosen. */
(function(){
  if (document.getElementById('light-rays')) return;   // kept across ClientRouter page changes
  var root = document.documentElement;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // phones have 2-3x screens, so 2px cells there already look as fine as 3px on a desktop
  var STYLES = ['pixel', 'smooth', 'soft', 'shafts', 'haze', 'grain', 'painted'];
  var ANIMS = ['none', 'sway', 'breathe', 'shimmer', 'both', 'scroll', 'point'];
  var qs = new URLSearchParams(location.search), mem = {};
  try { mem = JSON.parse(sessionStorage.getItem('rays-trial') || '{}'); } catch (e) {}
  var STYLE = STYLES.indexOf(qs.get('rays')) >= 0 ? qs.get('rays') : mem.style || 'pixel';
  var ANIM = ANIMS.indexOf(qs.get('raysanim')) >= 0 ? qs.get('raysanim') : mem.anim || 'none';
  var trial = qs.has('rays') || !!mem.style;
  var CELL;
  function cellSize(){ CELL = STYLE === 'smooth' ? 10 : matchMedia('(max-width:900px)').matches ? 2 : 3; }
  cellSize();
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // [r, g, b, alpha of the faint tone, alpha of the bright core]: warm sunlight, cool moonlight
  var TONE = { day: [255, 246, 222, 0.16, 0.28], night: [196, 212, 255, 0.06, 0.11] };
  var on = true;

  // #light-rays holds the canvas (pixel, smooth) and three CSS layers (the other styles)
  var wrap = document.createElement('div'); wrap.id = 'light-rays'; wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<i class="r-l"></i><i class="r-l"></i><i class="r-l"></i>';
  var cv = document.createElement('canvas'); wrap.appendChild(cv);
  var s = cv.style; s.position = 'absolute'; s.inset = '0'; s.width = '100%'; s.height = '100%';
  function apply(){
    wrap.className = 'rs-' + STYLE + ' ra-' + ANIM;
    var canvas = STYLE === 'pixel' || STYLE === 'smooth';
    s.display = canvas ? '' : 'none'; s.imageRendering = STYLE === 'pixel' ? 'pixelated' : 'auto';
  }
  apply();
  var ctx = cv.getContext('2d'), img, gw = 0, gh = 0, BIN, FADE, beams = [], amin = 0, amax = 1, NB = 2048, LUT = new Float32Array(NB);

  function rnd(a, b){ return a + Math.random() * (b - a); }
  function measure(){
    var W = innerWidth, H = innerHeight;
    gw = Math.ceil(W / CELL); gh = Math.ceil(H / CELL);
    cv.width = gw; cv.height = gh; img = ctx.createImageData(gw, gh);
    // the light: off screen, top right
    var sx = W * 0.9, sy = -H * 0.3, near = Math.hypot(W, H);
    // a ray's strength depends only on the angle from the light, so each cell keeps its angle as
    // a bin into a table the frame fills once (NB entries), instead of summing beams per cell
    var ANG = new Float32Array(gw * gh); BIN = new Uint16Array(gw * gh); FADE = new Float32Array(gw * gh);
    amin = Infinity; amax = -Infinity;
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++){
      var px = x * CELL, py = y * CELL, i = y * gw + x, d = Math.hypot(px - sx, py - sy);
      var a = ANG[i] = Math.atan2(py - sy, px - sx);
      if (a < amin) amin = a; if (a > amax) amax = a;
      // strongest near the light, gone by the far side of the screen
      FADE[i] = Math.max(0, 1 - d / (near * 0.95));
    }
    for (i = 0; i < ANG.length; i++) BIN[i] = Math.round((ANG[i] - amin) / (amax - amin) * (NB - 1));
    // beams spread over the angles that cross the screen, from straight down to the bottom left corner
    var a0 = Math.atan2(H - sy, W - sx), a1 = Math.atan2(H - sy, -sx);
    beams = [];
    for (var b = 0; b < 6; b++) beams.push({
      a: a0 + (a1 - a0) * (b + rnd(0.15, 0.85)) / 6, w: rnd(0.025, 0.06), k: rnd(0.6, 1),
      ph: rnd(0, 6.28), rate: rnd(0.35, 0.7), drift: rnd(0, 6.28)
    });
  }
  function draw(t){
    var night = root.getAttribute('data-theme') !== 'light', c = TONE[night ? 'night' : 'day'], d = img.data;
    var lo = Math.round(c[3] * 255), hi = Math.round(c[4] * 255), n = gw * gh;
    // each beam breathes (strength) and sways (angle) on its own slow clock
    var A = [], Wd = [], K = [];
    for (var b = 0; b < beams.length; b++){
      var q = beams[b];
      A.push(q.a + 0.008 * Math.sin(t * 0.07 + q.drift)); Wd.push(1 / (q.w * q.w));
      K.push(q.k * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.1 * q.rate + q.ph))));
    }
    for (var k = 0; k < NB; k++){
      var a = amin + (amax - amin) * k / (NB - 1), v = 0;
      for (b = 0; b < A.length; b++){ var e = a - A[b]; v += K[b] * Math.exp(-e * e * Wd[b]); }
      LUT[k] = Math.min(1, v);
    }
    for (var i = 0; i < n; i++){
      var f = FADE[i], o = i * 4;
      if (f <= 0){ d[o + 3] = 0; continue; }
      v = LUT[BIN[i]] * f;
      var x = i % gw, y = (i / gw) | 0, th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      // ordered dither: the faint tone where the beam beats the matrix, the bright tone where it beats it twice over
      var al = STYLE === 'smooth' ? Math.min(255, v * hi * 1.4) : v > th ? (v * 0.55 > th ? hi : lo) : 0;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = al;
    }
    ctx.putImageData(img, 0, 0);
  }

  var raf = 0, last = 0, t0 = performance.now();
  function frame(now){
    raf = 0;
    if (document.hidden || !on) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 12) return;   // slow light needs few frames
    last = now; draw((now - t0) / 1000);
  }
  function run(){
    wrap.style.display = on ? '' : 'none';
    if (!on || (STYLE !== 'pixel' && STYLE !== 'smooth')){ ctx.clearRect(0, 0, gw, gh); return; } draw((performance.now() - t0) / 1000); if (!raf && !still) raf = requestAnimationFrame(frame); }

  function start(){
    var anchor = document.getElementById('px-clouds') || document.getElementById('sky');
    (anchor && anchor.parentNode ? anchor.parentNode : document.body).insertBefore(wrap, anchor ? anchor.nextSibling : null);
    measure(); run();
    var rt = 0;
    addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ measure(); run(); }, 150); });
    document.addEventListener('visibilitychange', run);
    document.addEventListener('theme:change', run);
    if (trial){ switcher(); document.addEventListener('astro:after-swap', switcher); }
    addEventListener('scroll', function(){ if (ANIM === 'scroll') wrap.style.setProperty('--s', Math.min(1, scrollY / 1200).toFixed(3)); }, { passive: true });
    addEventListener('pointermove', function(e){ if (ANIM === 'point') wrap.style.setProperty('--p', (e.clientX / innerWidth - 0.5).toFixed(3)); }, { passive: true });
  }

  // the ?rays trial switch: two rows of buttons, under the nav; re-added after each page change
  function switcher(){
    var old = document.getElementById('rays-switch'); if (old) old.remove();
    var bar = document.createElement('div'); bar.id = 'rays-switch';
    var b = bar.style; b.position = 'fixed'; b.left = '50%'; b.top = '72px'; b.translate = '-50% 0'; b.zIndex = '9999';
    b.display = 'flex'; b.flexDirection = 'column'; b.gap = '4px'; b.padding = '6px'; b.borderRadius = '10px';
    b.background = 'rgba(15,17,24,.86)'; b.font = '500 12px Inter Tight, system-ui, sans-serif'; b.maxWidth = 'calc(100vw - 24px)';
    [[STYLES, 'style'], [ANIMS, 'anim']].forEach(function(row){
      var r = document.createElement('div'); r.style.display = 'flex'; r.style.flexWrap = 'wrap'; r.style.gap = '2px';
      row[0].forEach(function(name){
        var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = name;
        var cur = row[1] === 'style' ? STYLE : ANIM, t = btn.style;
        t.border = '0'; t.borderRadius = '6px'; t.padding = '5px 8px'; t.cursor = 'pointer'; t.font = 'inherit';
        t.background = name === cur ? '#e9ecf7' : 'transparent'; t.color = name === cur ? '#141722' : '#e9ecf7';
        btn.addEventListener('click', function(){
          if (row[1] === 'style') STYLE = name; else ANIM = name;
          try { sessionStorage.setItem('rays-trial', JSON.stringify({ style: STYLE, anim: ANIM })); } catch (e) {}
          wrap.style.removeProperty('--s'); wrap.style.removeProperty('--p');
          apply(); cellSize(); measure(); run(); switcher();
        });
        r.appendChild(btn);
      });
      bar.appendChild(r);
    });
    document.body.appendChild(bar);
  }
  window.lightRays = { set: function(o){ if ('on' in o) on = !!o.on; run(); }, get on(){ return on; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
