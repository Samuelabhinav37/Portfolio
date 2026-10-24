/* What lives in the blog's sky (SkyLife.astro with `cast`): jellyfish, a
   humpback whale, three manta rays, a sea turtle, a small school of fish and
   three sea stars, all drawn in serif digits, with soft stars and the odd
   rising bubble.

   Each creature is drawn once, at rest, in a worker
   (/scripts/sky-cast-worker.js). Every frame the rest pose is bent or turned
   into motion: the whale's body, the mantas' wings and the fishes' tails are
   drawn in thin strips, each nudged by a swimming wave, so they bend
   smoothly; the whale's flipper and the turtle's front flippers are separate
   pictures turned at the shoulder. A few versions that differ only in their
   digits are cross-faded so the digits shimmer. Each creature is its own
   small canvas moved by a CSS transform, so the graphics card does the
   moving. The jellyfish are the same looping clip as before. Stars and
   bubbles are CSS animations.

   Each kind keeps to its own band of sky, so they never cross. Jellyfish
   drift up through every band: a few times a second each one looks ahead
   and eases onto a heading that meets nobody (or fades into the haze and
   comes back in from below if none is clear), and each swimmer picks the
   pace nearest its own that lets the jellyfish pass.

   Nothing starts until the page has loaded, nothing runs while the tab is
   hidden, and with reduced motion everything holds still. Browsers without
   OffscreenCanvas get the jellyfish, stars and bubbles only. */
(function () {
  'use strict';
  const sky = document.querySelector('.sky-life');
  if (!sky) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const DPR = Math.min(2, devicePixelRatio || 1);
  const ALPHA = 0.5; // every digit creature is as faint as the whale
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

  /* digits shimmer: hold one version for a while, then cross-fade to the next */
  function shimmer(t, k) {
    const T = 5, p = t / T + k * 0.37, i = Math.floor(p), f = clamp((p - i - 0.76) / 0.24, 0, 1);
    return [i % 3, (i + 1) % 3, f * f * (3 - 2 * f)];
  }

  /* ── sprites: one small canvas per creature, moved by the compositor ── */
  function sprite(w, h, ox = w / 2, oy = h / 2) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    c.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;opacity:0;transform-origin:${ox}px ${oy}px;will-change:transform,opacity`;
    layer.appendChild(c);
    const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { c, g, w, h, ox, oy, born: null };
  }
  function place(sp, x, y, rot, sx, sy, t) {
    if (sp.born === null) sp.born = t;
    sp.c.style.opacity = (ALPHA * (still ? 1 : Math.min(1, (t - sp.born) / 1.5))).toFixed(3); // fades in once its pictures are ready
    sp.c.style.transform = `translate(${(x - sp.ox).toFixed(1)}px,${(y - sp.oy).toFixed(1)}px) rotate(${rot.toFixed(4)}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
  }
  // draw a picture in vertical strips, each moved down by dy(x)
  function strips(g, b, img, x0, y0, sw, dy, alpha, op) {
    g.globalAlpha = alpha; g.globalCompositeOperation = op;
    for (let x = 0; x < b.w; x += sw) {
      const ww = Math.min(sw, b.w - x);
      g.drawImage(img, x * b.dpr, 0, ww * b.dpr, b.h * b.dpr, x0 + x, y0 + dy(x + ww / 2), ww + 0.4, b.h);
    }
  }
  // draw a picture (two shimmer versions) turned by `ang` about a pivot given in its own pixels
  function turned(g, b, sh, px, py, atx, aty, ang, mirror) {
    [[sh[0], 1 - sh[2]], [sh[1], sh[2]]].forEach(([i, a]) => {
      if (a <= 0) return;
      g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'source-over';
      g.translate(atx, aty); if (mirror) g.scale(-1, 1); g.rotate(ang);
      g.drawImage(b.frames[i], -px, -py, b.w, b.h);
      g.restore();
    });
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
      if (!still) v.play().catch(() => {});
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

  /* A swimmer in a band [y0, y1], half-width hw, moving dir * speed px/s.
     A few times a second it tries a range of paces over the next few
     seconds against where each jellyfish is drifting, and eases toward the
     pace nearest its own that never meets one (or, if every pace does, the
     one that meets them least). It never leaves its band. */
  const PACES = [1, 0.7, 1.4, 0.4, 1.9, 0.15, 2.6];
  function yieldTo(sw, x, dir, speed, y0, y1, hw, dt) {
    if (jellyFresh || sw.target === undefined) {
      let best = 1, bestHits = Infinity;
      for (const pace of PACES) {
        let hits = 0;
        for (let k = 0; k <= 32; k++) {
          const tt = k * 0.25, sx = x + dir * speed * pace * tt;
          for (const j of jellies) {
            const jt = j.top + j.vy * tt, jl = j.left + j.vx * tt;
            if (jt + j.height < y0 - 8 || jt > y1 + 8) continue;
            if (Math.abs(sx - (jl + j.width / 2)) < hw + j.width / 2 + 10) hits += k < 12 ? 3 : 1; // sooner counts more
          }
        }
        if (hits < bestHits) { best = pace; bestHits = hits; } // PACES runs nearest-first, so ties keep the gentler pace
        if (hits === 0) break;
      }
      sw.target = best;
    }
    sw.factor += (sw.target - sw.factor) * Math.min(1, dt * 1.5);
  }

  /* ── the cast ── */
  let P = null, S = null;
  // one band each; the fish keep low, well away from the mantas and the turtle
  const lanes = { whale: 0.15, manta: 0.41, turtle: 0.62, fish: 0.8, stars: 0.92 };
  function bakeAll() {
    for (const id in pics) { pics[id].frames.forEach((f) => f && f.close()); delete pics[id]; } // free old pictures
    layer.querySelectorAll('canvas').forEach((c) => c.remove());
    const ws = Math.min(320, W * 0.26) / 2; // the whale's half-length
    P = {
      ws,
      whaleBody: bake({ kind: 'whaleBody', S: ws, cell: 3, w: Math.ceil(2.5 * ws), h: Math.ceil(1.0 * ws), oy: -0.02, seed: 7 }),
      whaleFlip: bake({ kind: 'whaleFlipper', S: ws, cell: 3, w: Math.ceil(0.95 * ws), h: Math.ceil(0.85 * ws), ox: -0.2, oy: 0.42, mask: true, seed: 8 }),
      manta: bake({ kind: 'manta', S: 29, cell: 2.4, w: 70, h: 72, oy: 0.25, seed: 30 }),
      turtleBody: bake({ kind: 'turtleBody', S: 43, cell: 2.5, w: 104, h: 104, mask: true, seed: 9 }),
      turtleFlip: bake({ kind: 'turtleFlipper', S: 43, cell: 2.5, w: 104, h: 104, seed: 10 }),
      star: bake({ kind: 'star', S: 19, cell: 2.3, w: 46, h: 46, frames: 16, still: false, seed: 40 }),
      fish: bake({ kind: 'fish', S: 13, cell: 1.7, w: 30, h: 22, seed: 50 }),
    };
    const wb = P.whaleBody, mb = P.manta, fb = P.fish;
    S = {
      whale: sprite(wb.w, wb.h + 0.6 * ws, wb.cx, 0.2 * ws + wb.cy),
      mantas: [0, 1, 2].map(() => sprite(mb.w, mb.h + 22, mb.cx, 11 + mb.cy)),
      turtle: sprite(104, 104),
      stars: [0, 1, 2].map(() => sprite(46, 46)),
      fish: [0, 1, 2, 3, 4].map(() => sprite(fb.w, fb.h + 8, fb.cx, 4 + fb.cy)),
    };
  }
  const ready = (...bs) => bs.every((b) => b.ready);
  const wrap = (x, m) => (x < -m ? W + m : x > W + m ? -m : x);
  const swim = { whale: { x: null, factor: 1 }, trio: { x: null, factor: 1, seed: rnd(0, 10) }, turtle: { x: null, factor: 1, seed: rnd(0, 10) }, fish: { x: null, factor: 1 } };
  const FISH = [[0, 0], [-32, 13], [-36, -15], [-68, 4], [-90, -10]].map(([x, y], i) => [x, y, rnd(0, TAU), 0.85 + 0.1 * (i % 3)]);
  let seastars = [], nextTrioBubble = 12, nextWhaleBreath = 16, nextTurtleBubble = 9, nextFishBubble = 7;

  function step(t, dt) {
    stepJellies(t, dt);
    cast = []; // where each swimmer is this frame, for the jellyfish to plan around

    /* whale: the body bends in strips with the swimming wave; each beat of
       the flukes pushes it along, then it glides */
    if (ready(P.whaleBody, P.whaleFlip)) {
      const sw = swim.whale, ws = P.ws, b = P.whaleBody, fb = P.whaleFlip, sp = S.whale, w = t * 1.3;
      if (sw.x === null) sw.x = W * 0.75;
      const y = H * lanes.whale + 3 * Math.sin(w - 1);
      yieldTo(sw, sw.x, -1, 7, y - 0.35 * ws, y + 0.75 * ws, 1.05 * ws, dt);
      sw.x = wrap(sw.x - (4.5 + 5 * Math.max(0, Math.sin(w - 1.2)) ** 2) * sw.factor * dt, ws * 1.3);
      const A = (u) => 0.006 + 0.075 * Math.max(0, (u + 0.3) / 1.1) ** 2, wave = (u) => A(u) * Math.sin(w - 2.2 * (u + 1));
      const slope = (wave(0.81) - wave(0.79)) / 0.02;
      const disp = (u) => (u <= 0.8 ? wave(u) : wave(0.8) + (u - 0.8) * slope * 1.6) * ws; // the flukes pitch with the tail
      const my = 0.2 * ws, g = sp.g, sh = shimmer(t, 0);
      g.clearRect(0, 0, sp.w, sp.h);
      const dy = (x) => disp((x - b.cx) / ws);
      strips(g, b, b.frames[sh[0]], 0, my, 2, dy, 1 - sh[2], 'source-over');
      if (sh[2] > 0) strips(g, b, b.frames[sh[1]], 0, my, 2, dy, sh[2], 'lighter');
      // the flipper turns at the shoulder, sculling in time with the beat
      const fx = -0.45, fy = 0.03 * -0.45 + 0.2, px = fb.cx + fx * ws, py = fb.cy + fy * ws;
      turned(g, fb, sh, px, py, b.cx + fx * ws, my + b.cy + fy * ws + disp(fx), 0.16 * Math.sin(w + 1), false);
      place(sp, sw.x, y, 0.02 * Math.sin(w - 1.6), 1, 1, t);
      cast.push({ x: sw.x, y: y + 0.2 * ws, hw: 1.05 * ws, hh: 0.55 * ws, vx: -7 * sw.factor });
      if ((nextWhaleBreath -= dt) <= 0) { bubble(sw.x - ws * 0.65, y - ws * 0.1); bubble(sw.x - ws * 0.6, y - ws * 0.1 - 7); nextWhaleBreath = rnd(16, 24); }
    }

    /* three mantas, one group gliding left to right; each wing bends in
       strips with a wave that runs out to the tip */
    if (ready(P.manta)) {
      const sw = swim.trio, b = P.manta;
      if (sw.x === null) sw.x = W * 0.3;
      const lane = (x) => H * (lanes.manta + 0.022 * Math.sin(x / W * TAU * 0.55 + sw.seed));
      yieldTo(sw, sw.x - 40, 1, 9, H * lanes.manta - 70, H * lanes.manta + 70, 72, dt); // the group's middle and full length
      sw.x = wrap(sw.x + 9 * sw.factor * dt, 220);
      [[0, 0, 58, 0], [-52, -30, 50, 1.6], [-80, 30, 44, 3.1]].forEach(([back, side, size, lag], i) => {
        const sp = S.mantas[i], g = sp.g, ph = t * 1.25 - lag, sh = shimmer(t, i + 1);
        const x0 = sw.x + back, yb = lane(x0), h = Math.atan2(lane(x0 + 1) - yb, 1);
        const surge = 4 * Math.sin(ph - 1.2); // each downstroke carries it a little further
        g.clearRect(0, 0, sp.w, sp.h);
        const dy = (x) => { const u = Math.abs(x - b.cx) / 29; return 0.14 * u ** 1.5 * Math.sin(ph - 1.8 * u) * 29; };
        strips(g, b, b.frames[sh[0]], 0, 11, 1, dy, 1 - sh[2], 'source-over');
        if (sh[2] > 0) strips(g, b, b.frames[sh[1]], 0, 11, 1, dy, sh[2], 'lighter');
        const s = size / 58;
        place(sp, x0 + Math.cos(h) * surge, yb + side + 3 * Math.sin(t * 0.25 + lag) + Math.sin(h) * surge, h + Math.PI / 2, s, s, t);
      });
      cast.push({ x: sw.x - 40, y: H * lanes.manta, hw: 72, hh: 70, vx: 9 * sw.factor });
      if ((nextTrioBubble -= dt) <= 0) { bubble(sw.x, lane(sw.x) - 14); nextTrioBubble = rnd(14, 22); }
    }

    /* little fish: one small school, tails flicking, swimming right */
    if (ready(P.fish)) {
      const sw = swim.fish, b = P.fish, y = H * lanes.fish, dir = 1, speed = 12;
      if (sw.x === null) sw.x = W * 0.15;
      yieldTo(sw, sw.x - dir * 48, dir, speed, y - 34, y + 34, 66, dt); // the school's middle and full length
      sw.x = wrap(sw.x + dir * speed * sw.factor * dt, 140);
      FISH.forEach(([ox, oy, ph0, sc], i) => {
        const sp = S.fish[i], g = sp.g, sh = shimmer(t, i * 0.5 + 3), ph = t * 7 * sc + ph0;
        g.clearRect(0, 0, sp.w, sp.h);
        const dy = (x) => { const u = (x - b.cx) / 13; return u > -0.1 ? 0.16 * ((u + 0.1) / 1.1) ** 2 * Math.sin(ph - 1.5 * u) * 13 : 0; };
        strips(g, b, b.frames[sh[0]], 0, 4, 1, dy, 1 - sh[2], 'source-over');
        if (sh[2] > 0) strips(g, b, b.frames[sh[1]], 0, 4, 1, dy, sh[2], 'lighter');
        const fx = sw.x + dir * ox + 3 * Math.sin(t * 0.6 * sc + ph0), fy = y + oy + 2.5 * Math.sin(t * 0.8 * sc + ph0 * 2);
        place(sp, fx, fy, 0.05 * Math.sin(t * 0.8 * sc + ph0 * 2 + 1), -dir * sc, sc, t); // the picture faces left, so mirror it to swim right
      });
      cast.push({ x: sw.x - dir * 48, y, hw: 66, hh: 34, vx: dir * speed * sw.factor });
      if ((nextFishBubble -= dt) <= 0) { bubble(sw.x + dir * 12, y - 6); nextFishBubble = rnd(9, 16); }
    }

    /* turtle: front flippers turn at the shoulder, a quick power stroke and
       a slow recovery, a small surge after each stroke */
    if (ready(P.turtleBody, P.turtleFlip)) {
      const sw = swim.turtle, sp = S.turtle, g = sp.g, b = P.turtleBody, fb = P.turtleFlip;
      if (sw.x === null) sw.x = W * 0.6;
      const lane = (x) => H * (lanes.turtle + 0.015 * Math.sin(x / W * TAU * 0.5 + sw.seed));
      yieldTo(sw, sw.x, -1, 7, H * lanes.turtle - 55, H * lanes.turtle + 55, 50, dt);
      sw.x = wrap(sw.x - 7 * sw.factor * dt, 120);
      const ph0 = t * 1.1, ph = ph0 + 0.4 * Math.sin(ph0), ang = 0.75 * Math.sin(ph), sh = shimmer(t, 6);
      g.clearRect(0, 0, sp.w, sp.h);
      const rx = b.cx + 0.26 * 43, ry = b.cy - 0.22 * 43, lx = b.cx - 0.26 * 43;
      turned(g, fb, sh, rx, ry, rx, ry, ang, false);
      turned(g, fb, sh, rx, ry, lx, ry, ang, true);
      // shell, head and back flippers on top
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1 - sh[2]; g.drawImage(b.frames[sh[0]], 0, 0, b.w, b.h);
      if (sh[2] > 0) { g.globalAlpha = sh[2]; g.drawImage(b.frames[sh[1]], 0, 0, b.w, b.h); }
      g.globalAlpha = 1;
      const y = lane(sw.x), h = Math.atan2(lane(sw.x - 1) - y, -1), tl = 4 * Math.sin(ph - 1.2);
      place(sp, sw.x + Math.cos(h) * tl, y + Math.sin(h) * tl, h + Math.PI / 2, 1, 1, t);
      cast.push({ x: sw.x, y, hw: 50, hh: 55, vx: -7 * sw.factor });
      if ((nextTurtleBubble -= dt) <= 0) { bubble(sw.x - 30, y - 6); nextTurtleBubble = rnd(14, 22); }
    }

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
      jel.forEach((j) => { if (document.hidden) j.v.pause(); else if (!still) j.v.play().catch(() => {}); });
    });
    let last = 0, clock = 0, drawn = false;
    const frame = (ms) => {
      const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0;
      last = ms; clock += dt;
      if (still) { // hold still: draw everyone once, as soon as their pictures are ready
        step(0, 0);
        if (!drawn && P && ready(P.whaleBody, P.whaleFlip, P.manta, P.turtleBody, P.turtleFlip, P.star, P.fish)) { drawn = true; return; }
        if (!worker && !drawn) { drawn = true; return; }
      } else step(clock, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
})();
