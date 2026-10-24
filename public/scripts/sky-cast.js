/* The sky cast (whale, mantas, turtle, sea stars, fish), each a brightness
   field drawn in serif digits like the jellyfish. Coordinates are normalized
   (about -1..1), y down. Used by /scripts/sky-cast-worker.js. */
(function () {
'use strict';
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const stroke = (d, w) => Math.exp(-(d * d) / (w * w));
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
function segDist(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, wx = px - ax, wy = py - ay;
  const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
  return [Math.hypot(wx - ex * h, wy - ey * h), h];
}
/* distance to a polyline, and how far along it (0..1) the nearest point is */
function curveDist(px, py, pts) {
  let best = 1e9, at = 0, run = 0, total = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); total += l; }
  for (let i = 0; i < pts.length - 1; i++) {
    const [d, h] = segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) { best = d; at = run + h * lens[i]; }
    run += lens[i];
  }
  return [best, at / total];
}
function polyDist(px, py, v) {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2, s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0], ey = v[j][1] - v[i][1], wx = px - v[i][0], wy = py - v[i][1];
    const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
    d = Math.min(d, (wx - ex * h) ** 2 + (wy - ey * h) ** 2);
    const c1 = py >= v[i][1], c2 = py < v[j][1], c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
const ellDist = (x, y, rx, ry) => (Math.hypot(x / rx, y / ry) - 1) * Math.min(rx, ry);
const body = (sd, lw, fill) => stroke(sd, lw * 1.1) + (sd < 0 ? fill : 0);
const dot = (u, v, x, y, r, lw) => stroke(Math.max(0, Math.hypot(u - x, v - y) - r), lw);
function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* Each creature is drawn on its own grid of digits that travels and turns
   with it, like the jellyfish video moving as one piece: the digits glide
   instead of hopping between fixed screen cells. A digit is bigger and
   brighter where the shape is, and each one changes on its own few-second
   clock, so the creature shimmers instead of flickering. */
function digits(ctx, o) {
  const { cell, f, cx, cy, S, rot = 0, reach = 1.2, reachY = reach, seed = 0, alpha = 1, now = 0, W = 1e9, H = 1e9, mask = false } = o;
  const R = reach * S;
  if (cx + R < 0 || cx - R > W || cy + R < 0 || cy - R > H) return; // off screen
  const px = 1 / S, lw = cell * px * 0.9, n = Math.ceil(R / cell), ny = Math.ceil(reachY * S / cell);
  const buckets = [[], [], []], solid = [];
  for (let gy = -ny; gy <= ny; gy++) {
    for (let gx = -n; gx <= n; gx++) {
      const x = gx * cell, y = gy * cell, I = f(x * px, y * px, lw);
      if (!(I >= 0.08)) continue; // also skips NaN at the edges of a shape
      if (mask) solid.push(x, y);
      const a = Math.min(1, I), r = hash(gx + 500, gy + 500, seed);
      buckets[a > 0.75 ? 2 : a > 0.35 ? 1 : 0].push(x, y, a, Math.floor(hash(gx + 500, gy + 500, Math.floor(now * (0.15 + r * 0.25) + r * 9)) * 10));
    }
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  // black drops out of the screen-blended sky, but hides a part drawn underneath
  if (mask) { ctx.fillStyle = '#000'; for (let k = 0; k < solid.length; k += 2) ctx.fillRect(solid[k] - cell / 2, solid[k + 1] - cell / 2, cell, cell); }
  ctx.fillStyle = '#ecdfc8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  buckets.forEach((b, i) => {
    ctx.font = `${(cell * [0.95, 1.15, 1.45][i]).toFixed(1)}px Georgia,'Times New Roman',serif`;
    for (let k = 0; k < b.length; k += 4) { ctx.globalAlpha = b[k + 2] * 0.95 * alpha; ctx.fillText(b[k + 3], b[k], b[k + 1]); }
  });
  ctx.restore();
}

/* ── manta ray, seen from below, nose up ──
   Swept-back wings whose beat runs out from the shoulders as a wave, curled
   cephalic fins either side of a wide mouth, five pairs of gill slits,
   belly spots, small pelvic fins and a whip tail. */
const SPOTS = [[0.05, 0.1], [-0.06, 0.15], [0.1, 0.2], [-0.02, 0.03], [0.13, 0.06], [-0.11, 0.08]];
function manta({ ph, bank = 0, flat = false }) {
  const amp = flat ? 0 : 0.14; // flat: drawn level, the wing wave is added when it is shown
  const flex = (x, y, s) => {
    const ax = Math.abs(x), lift = Math.sin(ph - 1.8 * ax);
    const k = (1 - 0.25 * Math.max(0, s * bank)) * (1 - 0.06 * Math.max(0, lift) * ax ** 3); // tips tuck in at the top of the beat
    return [x * k * s, y + amp * ax ** 1.5 * lift];
  };
  const half = [[0.16, -0.4], [0.42, -0.31], [0.68, -0.19], [0.88, -0.07], [1.0, 0.04], [0.9, 0.065], [0.72, 0.085], [0.5, 0.14], [0.32, 0.22], [0.16, 0.3], [0.07, 0.36]];
  const P = [...half.map(([x, y]) => flex(x, y, 1)), ...half.slice().reverse().map(([x, y]) => flex(x, y, -1))];
  const sway = 0.012 * Math.sin(ph * 0.5);
  const ceph = (s) => [[0.14 * s, -0.4], [(0.175 + sway) * s, -0.47], [(0.17 + sway) * s, -0.54], [0.13 * s, -0.585], [0.095 * s, -0.57], [0.1 * s, -0.53]];
  const tail = []; for (let q = 0; q <= 1.001; q += 0.1) tail.push([(flat ? 0 : 0.035) * Math.sin(q * 4 - ph * 0.5) * q, 0.36 + q * 0.78]);
  return (u, v, lw) => {
    const sd = polyDist(u, v, P);
    let I = stroke(sd, lw * 1.1);
    if (sd < 0) {
      I += 0.1 + 0.1 * (1 - Math.min(1, Math.abs(u))) + 0.06 * Math.max(0, Math.sin(Math.abs(u) * 8 - ph));
      for (const [sx, sy] of SPOTS) I += 0.45 * stroke(Math.hypot(u - sx, v - sy) - 0.022, lw * 0.7);
      if (v > -0.33 && v < 0.33) I += 0.2 * stroke(u, lw * 0.6);
    }
    for (const s of [-1, 1]) {
      I += stroke(curveDist(u, v, ceph(s))[0], lw * 0.95);
      for (let k = 0; k < 5; k++) { const y = -0.24 + k * 0.045, x0 = 0.07 + k * 0.006; I += 0.38 * stroke(segDist(u, v, x0 * s, y, (x0 + 0.06) * s, y + 0.022)[0], lw * 0.6); }
      I += 0.8 * body(ellDist(u - 0.075 * s, v - 0.37, 0.035, 0.05), lw, 0.15);
    }
    I += 0.7 * stroke(segDist(u, v, -0.12, -0.37, 0.12, -0.37)[0], lw * 0.7);
    const [td, th] = curveDist(u, v, tail);
    return I + 0.85 * (1 - 0.6 * th) * stroke(td, lw * 0.8);
  };
}

/* ── humpback whale, side on, facing left ──
   The original shape, with detail added after the reference: a gentle wave
   runs down the body and grows toward the tail, so the flukes sweep up and
   down (one beat about every five seconds). A bright edge along the belly
   and a dimmer one along the back, a pale belly, fine throat pleats, a
   mouth line under the eye, bumps on the snout, a small fin on its
   hump, a long flipper with a scalloped leading edge, serrated flukes. */
function whale({ t = 0, wave = true, part = 'all' }) {
  const w = t * 1.3;
  const yc = (u) => 0.03 * u + (wave ? 1 : 0) * (0.006 + 0.075 * Math.max(0, (u + 0.3) / 1.1) ** 2) * Math.sin(w - 2.2 * (u + 1));
  const rad = (u) => { const s = clamp((u + 1) / 1.8, 0, 1); return 0.3 * Math.sqrt(Math.sin(Math.PI * s)) * (1 - 0.62 * s) + 0.012; };
  const hump = (u) => 0.02 * Math.exp(-(((u - 0.28) / 0.1) ** 2));
  const top = (u) => yc(u) - rad(u) - hump(u), bot = (u) => yc(u) + rad(u);
  const mouthY = (u) => { const q = clamp((u + 1) / 0.36, 0, 1); return yc(u) + 0.004 + 0.065 * q ** 1.4; };
  const mouth = []; for (let u = -0.99; u <= -0.639; u += 0.03) mouth.push([u, mouthY(u)]);
  const fin = [[0.22, top(0.22) + 0.012], [0.35, top(0.33) - 0.06], [0.41, top(0.41) + 0.012]];
  // the flipper sculls in time with the beat, bending back toward its tip
  const a = 0.95 + (wave ? 0.18 * Math.sin(w + 1) : 0), fx = -0.45, fy = yc(-0.45) + 0.2, flip = [[fx, fy]];
  for (let k = 1; k <= 6; k++) { const al = a - 0.25 * (k / 6), [px, py] = flip[k - 1]; flip.push([px + Math.cos(al) * 0.13, py + Math.sin(al) * 0.7 * 0.13]); }
  // the flukes pitch with the end of the tail
  const tx = 0.8, ty = yc(0.8), ang = 1.6 * Math.atan((yc(0.81) - yc(0.79)) / 0.02), ca = Math.cos(ang), sa = Math.sin(ang);
  const eyeX = -0.66, eyeY = yc(-0.66) + 0.015;
  return (u, v, lw) => {
    // flipper first: it is in front of the body
    const [fd, fh] = curveDist(u, v, flip);
    const lead = (u - fx) * (flip[6][1] - fy) - (v - fy) * (flip[6][0] - fx) > 0;
    const fsd = fd - (0.06 * (1 - fh) + 0.01 + (lead ? 0.011 * Math.abs(Math.sin(fh * Math.PI * 8)) * (1 - fh) : 0));
    if (part === 'flipper') return body(fsd, lw, 0.2);
    if (fsd < lw && part === 'all') return body(fsd, lw, 0.2);
    let I = 0;
    // flukes, the trailing edge serrated
    const lx = (u - tx) * ca + (v - ty) * sa, ly = -(u - tx) * sa + (v - ty) * ca;
    for (const sg of [-1, 1]) {
      const [d, h] = segDist(lx, ly, -0.04, 0, 0.26, sg * 0.24);
      const trailing = lx > 0.26 * (ly * sg / 0.24);
      I += body(d - (0.05 * (1 - 0.7 * h) + (trailing ? 0.007 * Math.sin(h * 38) * (h > 0.12) : 0)), lw, 0.12);
    }
    let sd = u >= -1 && u <= 0.8 ? Math.max(top(u) - v, v - bot(u)) : Math.min(Math.hypot(u + 1, v - yc(-1)), Math.hypot(u - 0.8, v - ty));
    sd = Math.min(sd, polyDist(u, v, fin));
    const belly = v > yc(u);
    I += stroke(sd, lw * 1.1) * (belly ? 1.2 : 0.85);
    if (sd < 0) {
      I += belly ? 0.15 : 0.09;
      if (u < 0.05) { // throat pleats from the chin, fading out at the navel
        const up = u < -0.64 ? mouthY(u) + 0.012 : yc(u) + 0.075, b = bot(u);
        if (v > up && b - up > 0.06) { const f = ((v - up) / (b - up)) * 9; I += 0.42 * clamp((0.05 - u) / 0.3, 0, 1) * stroke(Math.abs(f - Math.round(f)) * (b - up) / 9, lw * 0.55); }
      }
    }
    I += 0.9 * stroke(curveDist(u, v, mouth)[0], lw * 0.8);
    I += 1.3 * dot(u, v, eyeX, eyeY, 0.009, lw * 1.2) + 0.35 * stroke(Math.hypot(u - eyeX, v - eyeY) - 0.03, lw * 0.6);
    for (let k = 0; k < 6; k++) { const x = -0.96 + k * 0.045; I += 1.0 * dot(u, v, x, top(x) + 0.02, 0.005, lw); } // snout bumps
    return I;
  };
}

/* ── green sea turtle, seen from above, nose up ──
   A teardrop shell with 5 vertebral plates, 4 pairs of costals and a ring of
   marginals; long front flippers beating together, small rear flippers
   steering; a scaled head with eyes. */
function turtle({ ph: ph0 = 0, part = 'all' }) {
  const ph = ph0 + 0.4 * Math.sin(ph0); // a quicker power stroke, a slower recovery
  const roll = part === 'all' ? 1 - 0.035 * Math.sin(ph) : 1;
  const shellSd = (u, v) => { const y = v - 0.02, ry = y > 0 ? 0.48 : 0.4, rx = roll * 0.34 * (1 - 0.3 * Math.min(1, Math.max(0, y / ry)) ** 2); return ellDist(u, y, rx, ry); };
  const front = (s) => {
    const pts = [[0.26 * s, -0.22]]; let x = 0.26, y = -0.22;
    for (let k = 1; k <= 6; k++) {
      const al = part === 'all' ? -0.55 + 0.75 * Math.sin(ph) + 0.55 * (k / 6) + 0.25 * Math.sin(ph - 0.8) * (k / 6) // the tip trails the stroke
        : -0.55 + 0.5 * (k / 6); // resting pose, turned at the shoulder when shown
      x += Math.cos(al) * 0.11; y += Math.sin(al) * 0.11; pts.push([x * s * roll, y]);
    }
    return pts;
  };
  const F = part === 'flipper' ? [front(1)] : part === 'body' ? [] : [front(1), front(-1)];
  const ra = 0.95 + 0.18 * Math.sin(ph + 1.2);
  const rear = [1, -1].map((s) => [0.17 * s, 0.38, (0.17 + Math.cos(ra) * 0.2) * s, 0.38 + Math.sin(ra) * 0.2]);
  return (u, v, lw) => {
    if (part === 'flipper') { const [d, h] = curveDist(u, v, F[0]); const w = 0.075 * (1 - h) ** 0.6 + 0.012; return body(d - w, lw, 0.1) + 0.25 * stroke(d, lw * 0.5) * (d < w); }
    const sd = shellSd(u, v);
    let I = stroke(sd, lw * 1.1);
    if (sd < 0) {
      I += 0.12;
      const inner = sd + 0.055;
      I += 0.6 * stroke(inner, lw * 0.7);
      if (inner > 0) { const g = (Math.atan2(v, u) / TAU) * 24; I += 0.5 * stroke(Math.abs(g - Math.round(g)) * 0.38 * TAU / 24 * 1.6, lw * 0.7); }
      else {
        const au = Math.abs(u), fr = (((v + 0.36) / 0.148) % 1 + 1) % 1, xb = 0.085 + 0.05 * (0.5 - Math.abs(fr - 0.5));
        if (v > -0.36 && v < 0.4) {
          I += 0.65 * stroke(au - xb, lw * 0.7);
          if (au < xb) for (let i = 1; i <= 4; i++) I += 0.65 * stroke(v - (-0.36 + i * 0.148), lw * 0.7);
        }
        if (au > xb) for (const y0 of [-0.14, 0.01, 0.16]) I += 0.65 * stroke(v - (y0 + 0.12 * (au - 0.1)), lw * 0.7);
      }
      return I;
    }
    // flippers and head, under the shell
    for (const pts of F) {
      const [d, h] = curveDist(u, v, pts);
      const w = 0.075 * (1 - h) ** 0.6 + 0.012;
      I += body(d - w, lw, 0.1) + 0.25 * stroke(d, lw * 0.5) * (d < w);
    }
    for (const [ax, ay, bx, by] of rear) { const [d, h] = segDist(u, v, ax, ay, bx, by); I += body(d - (0.05 * (1 - h) + 0.012), lw, 0.1); }
    const head = smin(ellDist(u, v + 0.54, 0.1, 0.12), segDist(u, v, 0, -0.4, 0, -0.47)[0] - 0.07, 0.03);
    I += body(head, lw, 0.12);
    if (head < 0) {
      for (const s of [-1, 1]) I += 1.2 * dot(u, v, 0.062 * s, -0.56, 0.008, lw);
      I += 0.5 * stroke(segDist(u, v, 0, -0.65, 0, -0.58)[0], lw * 0.6) + 0.5 * stroke(segDist(u, v, -0.05, -0.58, 0.05, -0.58)[0], lw * 0.6);
    }
    I += 0.8 * stroke(segDist(u, v, 0, 0.5, 0, 0.57)[0], lw * 0.9);
    return I;
  };
}

/* ── sea star, seen from above ──
   Five tapering arms on a central disc, curling slowly; a row of bumps down
   each arm with smaller rows either side, an eyespot at each tip and the
   sieve plate just off centre. */
function seastar({ t, seed = 0 }) {
  const bend = 0.25 * Math.sin(t * 0.18 + seed);
  return (u, v, lw) => {
    const r = Math.hypot(u, v), ph = Math.atan2(v, u) - bend * r * r, k0 = Math.round(ph / (TAU / 5));
    let sd = Math.hypot(u, v) - 0.21, near = null;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const d = ph - k * TAU / 5, al = r * Math.cos(d), ac = r * Math.sin(d);
      const [sg, h] = segDist(al, ac, 0, 0, 0.88, 0);
      const a = sg - (0.19 * (1 - h) + 0.045);
      if (!near || a < near.a) near = { a, al, ac };
      sd = smin(sd, a, 0.06);
    }
    let I = stroke(sd, lw * 1.1);
    if (sd < 0) {
      I += 0.12 + 0.35 * stroke(r - 0.15, lw * 0.6);
      const { al, ac } = near;
      if (al > 0.2) {
        const q = (al - 0.2) / 0.085; I += 0.9 * dot(al, ac, 0.2 + Math.round(q) * 0.085, 0, 0.012, lw * 0.8);
        const side = 0.075 * (1 - al / 0.95); const q2 = (al - 0.24) / 0.085;
        for (const s of [-1, 1]) I += 0.55 * dot(al, ac, 0.24 + Math.round(q2) * 0.085, s * side, 0.006, lw * 0.7);
      }
      I += 1.2 * dot(al, ac, 0.86, 0, 0.012, lw);
      I += 0.9 * stroke(Math.hypot(u - 0.09, v - 0.06) - 0.024, lw * 0.7);
    }
    return I;
  };
}

/* ── a little fish, side on, facing left ──
   Chubby and round, with a big bright eye, a forked tail, a small fin on
   top, a gill line and a stripe. Drawn still; its tail flicks when shown. */
function fish() {
  const tail = [[0.42, 0], [0.98, -0.42], [0.84, 0], [0.98, 0.42]];
  const fin = [[-0.22, -0.33], [0.02, -0.55], [0.24, -0.3]];
  return (u, v, lw) => {
    const sd = Math.min(ellDist(u + 0.06, v, 0.56, 0.4), polyDist(u, v, tail), polyDist(u, v, fin));
    let I = stroke(sd, lw * 1.1);
    if (sd < 0) {
      I += 0.12;
      if (ellDist(u + 0.06, v, 0.56, 0.4) < 0) {
        I += 0.55 * stroke(Math.hypot(u + 0.05, v) - 0.33, lw * 0.7) * (u < -0.12); // gill line
        I += 0.4 * stroke(u - 0.12, lw * 0.9); // stripe
      }
    }
    I += 1.4 * dot(u, v, -0.33, -0.08, 0.07, lw) + 0.5 * stroke(Math.hypot(u + 0.33, v + 0.08) - 0.12, lw * 0.6); // eye
    return I;
  };
}

self.SkyCast = { digits, manta, whale, turtle, seastar, fish, TAU };
})();
