/* What lives in the homepage sky (SkyLife.astro with `cast`): jellyfish and
   three sea stars drawn in serif digits, with soft stars and the odd rising
   bubble. (The whale, mantas, turtle and fish were removed in Nov 2026.)

   Each sea star is drawn once, at rest, in a worker
   (/scripts/sky-cast-worker.js). A few versions that differ only in their
   digits are cross-faded so the digits shimmer, on a small canvas moved by a
   CSS transform. The jellyfish are a looping clip. Stars and bubbles are CSS
   animations. Jellyfish drift up and steer around the sea stars.

   Nothing starts until the page has loaded, nothing runs while the tab is
   hidden, and with reduced motion everything holds still. Browsers without
   OffscreenCanvas get the jellyfish, stars and bubbles only. */
(function () {
  'use strict';
  const sky = document.querySelector('.sky-life');
  if (!sky) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const play = (v) => (window.playClip ? playClip(v) : v.play()).catch(() => {}); // one download for all the jellyfish (shared-clip.js)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DPR = Math.min(2, devicePixelRatio || 1);
  const ALPHA = 0.5; // every digit creature is this faint
  let W = 0, H = 0;
  const layer = document.createElement('div');
  layer.className = 'sc-layer';
  sky.appendChild(layer);

  /* ── pictures, drawn in a worker ── */
  const worker = 'OffscreenCanvas' in window ? new Worker('/scripts/sky-cast-worker.js') : null;
  const pics = {};
  let picId = 0;
  if (worker) worker.onmessage = (e) => {
    const b = pics[e.data.id];
    if (!b) { e.data.bmp.close(); return; } // from a bake that a resize replaced
    b.frames[e.data.i] = e.data.bmp;
    if (++b.count === b.n) b.ready = true;
  };
  // a picture of `kind`; ox, oy (in units of S) move its box off the creature's centre
  function bake({ kind, S, cell, w, h, ox = 0, oy = 0, frames = 3, still: rest = true, mask = false, seed = 1 }) {
    const reach = (w / 2 + Math.abs(ox) * S) / S + 0.05, reachY = (h / 2 + Math.abs(oy) * S) / S + 0.05;
    const b = { w, h, dpr: DPR, n: frames, frames: [], count: 0, ready: false, id: ++picId, cx: w / 2 - ox * S, cy: h / 2 - oy * S };
    pics[b.id] = b;
    if (worker) worker.postMessage({ id: b.id, kind, S, cell, reach, reachY, frames, dpr: DPR, seed, w, h, mask, still: rest, ox, oy });
    return b;
  }

  /* ── sprites: one small canvas per creature, moved by the compositor ── */
  // While the page scrolls the creatures keep gliding (a transform the GPU
  // does for free) but hold their last bend: redrawing hundreds of strips
  // stalls on a GPU that is busy scrolling the page. sprite.g draws nothing then.
  let frozen = false;
  const NOOP = { clearRect() {}, drawImage() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {} };
  function sprite(w, h, ox = w / 2, oy = h / 2) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    c.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;opacity:0;transform-origin:${ox}px ${oy}px;will-change:transform,opacity`;
    layer.appendChild(c);
    const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { c, ctx: g, get g() { return frozen ? NOOP : this.ctx; }, w, h, ox, oy, born: null };
  }
  function place(sp, x, y, rot, sx, sy, t) {
    if (sp.born === null) sp.born = t;
    sp.c.style.opacity = (ALPHA * (still ? 1 : Math.min(1, (t - sp.born) / 1.5))).toFixed(3); // fades in once its pictures are ready
    sp.c.style.transform = `translate(${(x - sp.ox).toFixed(1)}px,${(y - sp.oy).toFixed(1)}px) rotate(${rot.toFixed(4)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
  }
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
  let jel = [], cast = [], jellies = [], jellyClock = 0, jellyFresh = false;
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
      const dir = (Math.random() < 0.5 ? -1 : 1) * rnd(0.45, 0.95);
      return { v, w, x: jellyX(), y: rnd(0.3, 1) * H, ph: rnd(0, 1), seed: rnd(0, 100), dir, aim: dir, lean: dir, fade: still ? 1 : 0, leaving: false, nextBubble: rnd(2, 6), planIn: 0 };
    });
  }
  // the first time (s) within the next 10s that a jellyfish on heading h would meet another creature
  function firstMeet(j, h, speed) {
    for (let k = 0; k <= 20; k++) {
      const tt = k * 0.5, a = jellyBox(j.x + Math.sin(h) * speed * tt, j.y - Math.cos(h) * speed * tt, j.w);
      for (const c of cast) {
        const cx = c.x + c.vx * tt;
        if (a.l < cx + c.hw + 12 && a.r > cx - c.hw - 12 && a.t < c.y + c.hh + 12 && a.b > c.y - c.hh - 12) return tt;
      }
    }
    return Infinity;
  }
  function respawn(j) {
    // come back in from below at a spot whose way up is clear (best of a few tries)
    let best = null, bestWhen = -1;
    for (let k = 0; k < 8; k++) {
      j.y = H + j.w * rnd(0.3, 1); j.x = jellyX();
      j.dir = (j.x < W / 2 ? 1 : -1) * rnd(0.45, 0.95);
      const when = firstMeet(j, j.dir, 3.2 * j.w / 70);
      if (when > bestWhen) { best = [j.x, j.y, j.dir]; bestWhen = when; }
      if (when === Infinity) break;
    }
    [j.x, j.y, j.dir] = best;
    j.aim = j.lean = j.dir; j.leaving = false; j.fade = 0; j.planIn = 0;
  }
  function stepJellies(t, dt) {
    for (const j of jel) {
      const playing = j.v.readyState >= 2 && !j.v.paused;
      j.ph = playing ? (j.v.currentTime % PULSE) / PULSE : (j.ph + dt / PULSE) % 1;
      const speed = (1.4 + 6 * squeeze(j.ph)) * j.w / 70, mean = 3.2 * j.w / 70;
      if ((j.planIn -= dt) <= 0 && !j.leaving) {
        j.planIn = 0.4;
        const base = j.aim, options = [base * 0.4, -base * 0.4, -base, base * 1.3];
        let best = base, when = firstMeet(j, base, mean);
        if (when !== Infinity) for (const h of options) { const w2 = firstMeet(j, h, mean); if (w2 > when) { best = h; when = w2; } if (w2 === Infinity) break; }
        j.aim = best;
        if (when < 3.5 && !still) j.leaving = true; // no clear way: fade into the haze
      }
      j.dir += (j.aim - j.dir) * Math.min(1, dt * 0.35); // turns are gentle
      const heading = j.dir + 0.18 * Math.sin(t * 0.07 + j.seed);
      j.x += Math.sin(heading) * speed * dt; j.y -= Math.cos(heading) * speed * dt;
      j.lean += (heading - j.lean) * Math.min(1, dt * 0.4);
      if (!still) j.fade = j.leaving ? j.fade - dt / 2.2 : Math.min(1, j.fade + dt / 2.2);
      const m = j.w * 1.2;
      if ((j.leaving && j.fade <= 0) || j.y < -m * ASPECT || j.x < -m || j.x > W + m) respawn(j);
      const ox = j.w / 2, oy = j.w * BELL_Y;
      j.v.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
      j.v.style.transform = `translate(${(j.x - ox).toFixed(1)}px,${(j.y - oy).toFixed(1)}px) rotate(${(j.lean * 34.4).toFixed(2)}deg)`;
      j.v.style.opacity = (0.85 * Math.max(0, j.fade)).toFixed(3);
      if ((j.nextBubble -= dt) <= 0) { if (j.fade > 0.5) bubble(j.x + (Math.random() < 0.5 ? -1 : 1) * j.w * rnd(0.35, 0.5), j.y - j.w * rnd(0.1, 0.3)); j.nextBubble = rnd(4, 9); }
    }
    // what the swimmers plan around, refreshed a few times a second
    jellyFresh = (jellyClock -= dt) <= 0;
    if (jellyFresh) {
      jellyClock = 0.2;
      jellies = jel.filter((j) => !j.leaving && j.fade > 0.05).map((j) => {
        const b = jellyBox(j.x, j.y, j.w), mean = 3.2 * j.w / 70;
        const vx = Math.sin(j.dir) * mean, vy = -Math.cos(j.dir) * mean, fx = vx * 5, fy = vy * 5;
        // l, r, t, b: the stretch of sky it covers over the next 5s
        return { left: b.l, top: b.t, width: b.r - b.l, height: b.b - b.t, vx, vy,
          l: Math.min(b.l, b.l + fx), r: Math.max(b.r, b.r + fx), t: Math.min(b.t, b.t + fy), b: Math.max(b.b, b.b + fy) };
      });
    }
  }

  /* ── the cast ── */
  let P = null, S = null;
  const lanes = { stars: 0.92 };
  function bakeAll() {
    for (const id in pics) { pics[id].frames.forEach((f) => f && f.close()); delete pics[id]; } // free old pictures
    layer.querySelectorAll('canvas').forEach((c) => c.remove());
    P = {
      star: bake({ kind: 'star', S: 19, cell: 2.3, w: 46, h: 46, frames: 16, still: false, seed: 40 }),
    };
    S = {
      stars: [0, 1, 2].map(() => sprite(46, 46)),
    };
  }
  const ready = (...bs) => bs.every((b) => b.ready);
  const wrap = (x, m) => (x < -m ? W + m : x > W + m ? -m : x);
  let seastars = [];

  function step(t, dt) {
    stepJellies(t, dt);
    cast = []; // where each swimmer is this frame, for the jellyfish to plan around

    /* sea stars: low in the sky, drifting slowly sideways and turning; they
       ease aside when a jellyfish rises past */
    if (ready(P.star)) seastars.forEach((s, i) => {
      let push = 0;
      for (const j of jellies) {
        if (j.b < s.y - 30 || j.t > s.y + 30) continue;
        const jc = (j.l + j.r) / 2, d = s.x + s.off - jc, need = (j.r - j.l) / 2 + 30;
        if (Math.abs(d) < need) push += (d >= 0 ? 1 : -1) * (need - Math.abs(d));
      }
      s.off += (clamp(push, -90, 90) - s.off * 0.02) * Math.min(1, dt * 0.6);
      s.x = wrap(s.x + 3 * s.dir * dt, 30); s.spin += 0.04 * s.dir * dt;
      const sp = S.stars[i], g = sp.g, b = P.star, p = ((t / (TAU / 0.18) + i * 0.31) % 1) * b.n, k = Math.floor(p), f = p - k;
      g.clearRect(0, 0, sp.w, sp.h);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1 - f; g.drawImage(b.frames[k], 0, 0, b.w, b.h);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = f; g.drawImage(b.frames[(k + 1) % b.n], 0, 0, b.w, b.h);
      place(sp, s.x + s.off, s.y + 3 * Math.sin(t * 0.3 + i), s.spin, s.size / 38, s.size / 38, t);
      cast.push({ x: s.x + s.off, y: s.y, hw: s.size * 0.6, hh: s.size * 0.6, vx: 3 * s.dir });
    });
  }

  function setup() {
    const wasNarrow = jel.length ? narrowSky() : null;
    W = sky.clientWidth; H = sky.clientHeight;
    placeStars(); bakeAll();
    if (wasNarrow !== narrowSky()) makeJellies(); // keep the jellyfish where they are unless the layout changes
    seastars = [[0.12, 38], [0.42, 30], [0.78, 34]].map(([x, size], i) => ({ x: x * W, y: H * lanes.stars + (i % 2 ? 8 : -6), size, dir: 1, spin: rnd(0, TAU), off: 0 }));
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
    // The cast drifts a few pixels a second, so 30 frames a second looks the
    // same as the screen's full rate; on a 120-240Hz screen that is 4-8x less
    // redrawing (each frame draws hundreds of strips).
    const FRAME_MS = 1000 / 30;
    let scrolledAt = -1e9;
    addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
    // while the page covers the whole sky (sky.js sends 'sky:covered') nobody
    // can see the cast: it holds where it is and the jellyfish clips pause
    let covered = false;
    document.addEventListener('sky:covered', (e) => {
      covered = e.detail;
      jel.forEach((j) => { if (covered) j.v.pause(); else if (!still && !document.hidden) play(j.v); });
    });
    let last = 0, clock = 0, drawn = false;
    const frame = (ms) => {
      if (covered && !still) { last = ms; requestAnimationFrame(frame); return; }
      if (!still && last && ms - last < FRAME_MS - 2) { requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
      last = ms; clock += dt;
      frozen = !still && ms - scrolledAt < 250;
      if (still) { // hold still: draw everyone once, as soon as their pictures are ready
        step(0, 0);
        if (!drawn && P && ready(P.star)) { drawn = true; return; }
        if (!worker && !drawn) { drawn = true; return; }
      } else step(clock, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
