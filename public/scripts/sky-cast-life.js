/* What lives in the homepage sky (SkyLife.astro with `cast`): jellyfish
   (a looping clip) drifting up, with soft stars and the odd rising bubble
   as CSS animations. Nothing starts until the page has loaded, nothing runs
   while the tab is hidden, and reduced motion holds everything still. */
(function () {
  'use strict';
  const sky = document.querySelector('.sky-life');
  if (!sky) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const play = (v) => (window.playClip ? playClip(v) : v.play()).catch(() => {}); // one download for all the jellyfish (shared-clip.js)
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0;
  const layer = document.createElement('div');
  layer.className = 'sc-layer';
  sky.appendChild(layer);

  /* ── soft stars and bubbles ── */
  function placeStars() {
    layer.querySelectorAll('.sc-star').forEach((s) => s.remove());
    for (let i = 0; i < (W < 700 ? 7 : 14); i++) {
      const s = document.createElement('i'), r = rnd(0.6, 1.25) * 5, base = rnd(0.35, 0.75);
      s.className = 'sc-star';
      s.style.cssText = `left:${rnd(3, 97).toFixed(1)}%;top:${rnd(4, 96).toFixed(1)}%;width:${(r * 2).toFixed(1)}px;height:${(r * 2).toFixed(1)}px;margin:${(-r).toFixed(1)}px 0 0 ${(-r).toFixed(1)}px;--d:${rnd(2.5, 5).toFixed(2)}s;--o:${(-rnd(0, 5)).toFixed(2)}s;--lo:${(base * 0.2).toFixed(2)};--hi:${base.toFixed(2)}`;
      layer.appendChild(s);
    }
  }
  function bubble(x, y) {
    if (still) return;
    const b = document.createElement('i'), r = rnd(1.4, 2.4);
    b.className = 'sc-bubble';
    b.style.cssText = `left:${(x - r).toFixed(1)}px;top:${(y - r).toFixed(1)}px;width:${(r * 2).toFixed(1)}px;height:${(r * 2).toFixed(1)}px;--d:${rnd(5, 7).toFixed(1)}s;--dx:${rnd(-4, 4).toFixed(1)}px`;
    b.addEventListener('animationend', () => b.remove(), { once: true });
    layer.appendChild(b);
  }

  /* ── jellyfish ──
     The looping clip of a jellyfish in serif digits, pulsing once every
     PULSE seconds. Its squeeze is read from the video's clock, so the
     squeeze you see is what pushes it along a slow diagonal; between
     pulses it drifts, leaning the way it travels. */
  const PULSE = 5, BELL_Y = 110 / 240, ASPECT = 420 / 240;
  function squeeze(p) { // the squeeze the clip was drawn with: quick in, slow out, a rest
    if (p < 0.2) return Math.sin(Math.PI / 2 * p / 0.2) ** 2;
    if (p < 0.75) return 0.5 + 0.5 * Math.cos(Math.PI * (p - 0.2) / 0.55);
    return 0;
  }
  let jel = [];
  const narrowSky = () => W <= 900;
  const jellyX = () => narrowSky() ? rnd(0.06, 0.94) * W : Math.random() < 0.5 ? rnd(0.04, 0.22) * W : rnd(0.78, 0.96) * W;
  const jellyBox = (x, y, w) => ({ l: x - w * 0.45, r: x + w * 0.45, t: y - w * BELL_Y, b: y - w * BELL_Y + w * ASPECT * 0.85 });
  function makeJellies() {
    layer.querySelectorAll('.sc-jelly').forEach((v) => v.remove());
    jel = (narrowSky() ? [0] : [0, 1, 2]).map((i) => {
      const w = narrowSky() ? rnd(34, 40) : [rnd(70, 84), rnd(56, 66), rnd(44, 52)][i];
      const v = document.createElement('video');
      v.className = 'sc-jelly'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.poster = '/images/contact-jelly-poster.webp'; v.style.width = w.toFixed(0) + 'px';
      for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) {
        const src = document.createElement('source'); src.src = '/videos/contact-jelly.' + ext; src.type = type; v.appendChild(src);
      }
      const start = rnd(0, PULSE);
      v.addEventListener('loadedmetadata', () => { v.currentTime = start; }, { once: true });
      layer.appendChild(v);
      if (!still) play(v);
      // desktop: the two bigger ones always open as a pair in the top right, one above the other, leaning right
      const START = [[0.875, 0.13], [0.855, 0.32]];
      const pair = !narrowSky() && START[i];
      const dir = pair ? rnd(0.45, 0.6) : (Math.random() < 0.5 ? -1 : 1) * rnd(0.45, 0.95);
      const x = pair ? pair[0] * W : jellyX(), y = pair ? pair[1] * H : rnd(0.3, 1) * H;
      return { v, w, x, y, ph: rnd(0, 1), seed: rnd(0, 100), dir, aim: dir, lean: dir, fade: still ? 1 : 0, nextBubble: rnd(2, 6) };
    });
  }
  function respawn(j) { // come back in from below
    j.y = H + j.w * rnd(0.3, 1); j.x = jellyX();
    j.dir = (j.x < W / 2 ? 1 : -1) * rnd(0.45, 0.95);
    j.lean = j.dir; j.fade = 0;
  }
  function stepJellies(t, dt) {
    for (const j of jel) {
      const playing = j.v.readyState >= 2 && !j.v.paused;
      j.ph = playing ? (j.v.currentTime % PULSE) / PULSE : (j.ph + dt / PULSE) % 1;
      const speed = (1.4 + 6 * squeeze(j.ph)) * j.w / 70;
      const heading = j.dir + 0.18 * Math.sin(t * 0.07 + j.seed);
      j.x += Math.sin(heading) * speed * dt; j.y -= Math.cos(heading) * speed * dt;
      j.lean += (heading - j.lean) * Math.min(1, dt * 0.4);
      if (!still) j.fade = Math.min(1, j.fade + dt / 2.2);
      const m = j.w * 1.2;
      if (j.y < -m * ASPECT || j.x < -m || j.x > W + m) respawn(j);
      const ox = j.w / 2, oy = j.w * BELL_Y;
      j.v.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
      j.v.style.transform = `translate(${(j.x - ox).toFixed(1)}px,${(j.y - oy).toFixed(1)}px) rotate(${(j.lean * 34.4).toFixed(2)}deg)`;
      j.v.style.opacity = (0.85 * Math.max(0, j.fade)).toFixed(3);
      if ((j.nextBubble -= dt) <= 0) { if (j.fade > 0.5) bubble(j.x + (Math.random() < 0.5 ? -1 : 1) * j.w * rnd(0.35, 0.5), j.y - j.w * rnd(0.1, 0.3)); j.nextBubble = rnd(4, 9); }
    }
  }

  function step(t, dt) { stepJellies(t, dt); }

  function setup() {
    const wasNarrow = jel.length ? narrowSky() : null;
    W = sky.clientWidth; H = sky.clientHeight;
    placeStars();
    if (wasNarrow !== narrowSky()) makeJellies(); // keep the jellyfish where they are unless the layout changes
  }

  function start() {
    setup();
    // a phone's address bar changes the height while scrolling: only a new width redraws the cast
    let resizeTimer = 0;
    addEventListener('resize', () => {
      H = sky.clientHeight;
      if (sky.clientWidth === W) return;
      clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 300);
    });
    document.addEventListener('visibilitychange', () => {
      jel.forEach((j) => { if (document.hidden) j.v.pause(); else if (!still && !covered) play(j.v); });
    });
    // The jellyfish drift a few pixels a second, so 30 frames a second looks the
    // same as the screen's full rate; on a 120-240Hz screen that is 4-8x less
    // redrawing.
    const FRAME_MS = 1000 / 30;

    // while the page covers the whole sky (sky.js sends 'sky:covered') nobody
    // can see the cast: it holds where it is and the jellyfish clips pause
    let covered = false;
    document.addEventListener('sky:covered', (e) => {
      covered = e.detail;
      jel.forEach((j) => { if (covered) j.v.pause(); else if (!still && !document.hidden) play(j.v); });
    });
    let last = 0, clock = 0;
    const frame = (ms) => {
      if (covered && !still) { last = ms; requestAnimationFrame(frame); return; }
      if (!still && last && ms - last < FRAME_MS - 2) { requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
      last = ms; clock += dt;
      if (still) { step(0, 0); return; } // hold still: place everyone once
      step(clock, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
