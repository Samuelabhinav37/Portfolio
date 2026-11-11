/* Site motion: smooth scroll, scroll reveals and the scroll-lit statement.
 *
 * One timing system for the whole site, so every page moves the same way.
 * The numbers follow common motion-design guidance: entrances take
 * 0.6-0.9s and ease out (fast start, long soft landing), staggers sit
 * around 70ms, reveals fire once when an element is ~12% into the viewport,
 * and only transform and opacity animate. Everything is skipped under
 * prefers-reduced-motion, and the content is fully visible without
 * JavaScript (the hidden start state only exists while html.motion is set,
 * see src/components/Motion.astro).
 *
 * Markup hooks:
 *   data-reveal            fade up
 *   data-reveal="lines"    heading lines rise out of a mask (SplitText)
 *   data-reveal="media"    image eases in from a slight zoom
 *   data-reveal-group      each child fades up in turn
 *   data-scroll-lit        words brighten one by one as you scroll past
 *   data-roll              on hover the letters roll up one after another
 *   data-magnet            leans a few px toward a nearby mouse pointer
 *                          (moves the `translate` property; give it a
 *                          translate transition in CSS)
 *
 * After lamalama.com (docs/2026-11-11-lamalama-alitwotimes-motion.md):
 *   page cover             big pixel blocks fill the screen by ordered dither
 *                          between pages, then dissolve onto the new one
 *   DITHER frames          pictures arrive coarse and dithered, then sharpen
 *   SCRAMBLE labels        small labels decode from symbols, left to right
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
// The homepage intro timeline reads the global (it used to load its own copy).
window.gsap = window.gsap || gsap;

/* ── tunables ─────────────────────────────────────────────────────── */
// Smooth scroll is on trial. To switch it off site-wide, set this to false;
// to try the site without it in one browser, open any page with ?lenis=0.
const SMOOTH_SCROLL = true;
const SCROLL = {
  lerp: 0.14,          // share of the remaining distance covered per frame; higher = snappier
  wheelMultiplier: 1,  // one notch moves the page as far as it does natively
};
export const MOTION = {
  ease: 'expo.out',    // entrances: quick start, long settle
  dur: 0.9,
  durShort: 0.6,
  stagger: 0.07,
  rise: 28,            // px a block travels while fading up
  start: 'top 88%',    // reveal once the element is ~12% into the viewport
};

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

function wantsSmooth() {
  if (!SMOOTH_SCROLL || reduce || !finePointer) return false;
  try {
    const flag = new URLSearchParams(location.search).get('lenis');
    if (flag === '0') localStorage.setItem('lenis', 'off');
    if (flag === '1') localStorage.removeItem('lenis');
    return localStorage.getItem('lenis') !== 'off';
  } catch (_) {
    return true;
  }
}

/* ── smooth scroll ────────────────────────────────────────────────── */
// Driven from GSAP's ticker, not a second requestAnimationFrame loop, so
// ScrollTrigger and Lenis read the same frame. Touch keeps native scrolling.
let lenis = null;
if (wantsSmooth()) {
  lenis = new Lenis({
    ...SCROLL,
    smoothWheel: true,
    anchors: true,
    allowNestedScroll: true, // Kai's chat log and other scroll boxes scroll themselves
    // ...and Lenis leaves these alone entirely: Kai's open chat (scrolling it
    // must never move the page, even when its log is too short to scroll) and
    // the More stories row (its own script turns the wheel sideways)
    prevent: (node) => !!(node.closest && node.closest('.kc-panel, .pm-view')),
    autoRaf: false,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.SITE = window.SITE || {};
  window.SITE.lenis = lenis;
  // ClientRouter page change: end any smooth scroll in flight at the swap, then
  // take up the scroll position the router set (top, or where you were on Back).
  // Not lenis.stop(): its lenis-stopped class clips the root's overflow, which
  // crashed WebKit mid view transition (and hides the scrollbar, a 15px jump).
  document.addEventListener('astro:before-swap', () => lenis.reset());
  document.addEventListener('astro:page-load', () => {
    lenis.resize();
    lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  });
}

/* ── reveals ──────────────────────────────────────────────────────── */
function fadeUp(targets, trigger, extra = {}) {
  return gsap.fromTo(targets,
    { autoAlpha: 0, y: MOTION.rise },
    { autoAlpha: 1, y: 0, duration: MOTION.dur, ease: MOTION.ease, clearProps: 'transform',
      scrollTrigger: { trigger, start: MOTION.start, once: true }, ...extra });
}

const splits = []; // this page's SplitText instances, reverted when it is swapped out
function lines(el) {
  // autoSplit re-splits when the web font swaps in or the width changes, so
  // lines never break in the wrong place; the tween is rebuilt each time.
  splits.push(SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      gsap.set(el, { autoAlpha: 1 });
      return gsap.from(self.lines, {
        yPercent: 110, duration: 1.05, ease: MOTION.ease, stagger: 0.08,
        scrollTrigger: { trigger: el, start: MOTION.start, once: true },
      });
    },
  }));
}

function media(el) {
  const img = el.querySelector('img, svg, video') || el;
  gsap.set(el, { autoAlpha: 1 });
  gsap.fromTo(img, { scale: 1.08, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration: 1.2, ease: MOTION.ease, clearProps: 'transform',
    scrollTrigger: { trigger: el, start: MOTION.start, once: true },
  });
}

/* ── dithered picture reveal (lamalama) ───────────────────────────── */
// The picture is drawn into a canvas over it at a few coarse resolutions,
// each quantised through a 4x4 Bayer matrix (the sky's rays and clouds use
// the same one): one-bit light and dark first, then a few colours, sharper
// every step, then the canvas fades off the real image.
// Frames without a picture dissolve from blocks of a lighter tone instead.
const DITHER = '.pw-img, .wk-img, .fn-pic';
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dither(frame) {
  const img = frame.querySelector('img');
  const cv = document.createElement('canvas');
  cv.className = 'dz';
  cv.setAttribute('aria-hidden', 'true');
  frame.appendChild(cv);
  const go = () => {
    const w = frame.clientWidth, h = frame.clientHeight;
    if (!w || !h || (img && !img.naturalWidth)) return cv.remove();
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const steps = img ? [24, 12, 8, 4] : [24, 12];
    const light = root.dataset.theme === 'light';
    const tone = light ? [55, 53, 47, 30] : [200, 215, 245, 34];
    const ink = light ? [[241, 241, 239], [55, 53, 47]] : [[10, 12, 20], [222, 230, 246]]; // frame ground, lit pixel
    let k = 0;
    const tick = () => {
      if (!cv.isConnected) return;
      if (k === steps.length) return gsap.to(cv, { autoAlpha: 0, duration: 0.3, ease: 'power1.out', onComplete: () => cv.remove() });
      const b = steps[k++], gw = Math.ceil(w / b), gh = Math.ceil(h / b);
      cv.width = gw; cv.height = gh;
      if (img) {
        // object-fit: cover crop
        const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / sc, sh = h / sc;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, gw, gh);
      }
      const im = img ? ctx.getImageData(0, 0, gw, gh) : ctx.createImageData(gw, gh), d = im.data;
      const mono = k <= 2, lv = k === 3 ? 6 : 12; // then 6, 12 levels a channel
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const o = (y * gw + x) * 4, th = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        if (img && mono) {
          const l = (0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]) / 255, c = ink[(light ? 1 - l : l) > th ? 1 : 0];
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        } else if (img) for (let c = 0; c < 3; c++) d[o + c] = Math.min(255, Math.floor((d[o + c] / 255) * (lv - 1) + th) * 255 / (lv - 1));
        else if (th > k / (steps.length + 1)) { d[o] = tone[0]; d[o + 1] = tone[1]; d[o + 2] = tone[2]; d[o + 3] = tone[3]; }
      }
      ctx.putImageData(im, 0, 0);
      gsap.delayedCall(0.12, tick);
    };
    tick();
  };
  ScrollTrigger.create({
    trigger: frame, start: MOTION.start, once: true,
    onEnter: () => {
      if (!img) return go();
      (img.complete ? Promise.resolve() : img.decode()).then(go, () => cv.remove());
    },
  });
}

/* ── scramble labels (lamalama) ───────────────────────────────────── */
// Each letter shows random symbols, then locks in, left to right. Screen
// readers get the real text throughout (a hidden copy), not the symbols.
const SCRAMBLE = '.pw-tags, .fn-cap > span, .wk-no, .wk-year';
const GLYPHS = '#@$%&*+=<>/?!';
function scramble(el) {
  const text = el.textContent;
  if (!text.trim() || el.children.length > 1) return;
  ScrollTrigger.create({
    trigger: el, start: MOTION.start, once: true,
    onEnter: () => {
      const real = document.createElement('span'), shown = document.createElement('span');
      real.className = 'sr-only'; real.textContent = text;
      shown.setAttribute('aria-hidden', 'true');
      const html = el.innerHTML;
      el.replaceChildren(real, shown);
      const t0 = performance.now(), per = 32, lead = 160;
      const step = () => {
        const n = Math.floor((performance.now() - t0 - lead) / per);
        if (n >= text.length || !el.isConnected) { gsap.ticker.remove(step); el.innerHTML = html; return; }
        let out = '';
        for (let i = 0; i < text.length; i++) out += i < n || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        shown.textContent = out;
      };
      gsap.ticker.add(step);
    },
  });
}

/* ── page cover (lamalama) ────────────────────────────────────────── */
// On a ClientRouter page change, a canvas of big blocks (one canvas pixel a
// block, scaled up unsmoothed) fills the screen in ordered-dither order while
// the next page loads: a sparse lattice, a checker, then solid. The swap
// happens under it with the view transition made instant (html.covering,
// Motion.astro), and the blocks dissolve the
// same way onto the new page, whose reveals then play as on a first load.
// It lives on <html>, outside the <body> the router swaps.
function pageCover() {
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  const cv = document.createElement('canvas');
  cv.id = 'page-cover';
  cv.setAttribute('aria-hidden', 'true');
  const s = cv.style;
  s.position = 'fixed'; s.inset = '0'; s.width = '100%'; s.height = '100%'; s.zIndex = '2147483001';
  s.pointerEvents = 'none'; s.imageRendering = 'pixelated'; s.display = 'none';
  root.appendChild(cv);
  const ctx = cv.getContext('2d');
  let gw = 0, gh = 0, order = null, run = 0;
  function size() {
    const b = innerWidth <= 760 ? 24 : 36;
    gw = Math.ceil(innerWidth / b); gh = Math.ceil(innerHeight / b);
    cv.width = gw; cv.height = gh;
    order = new Float32Array(gw * gh);
    // mostly the dither order, leaning a little from the top right (where the light is)
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++)
      order[y * gw + x] = 0.8 * (B8[(y & 7) * 8 + (x & 7)] + 0.5) / 64 + 0.2 * ((gw - 1 - x) / gw + y / gh) / 2;
  }
  function paint(p) {
    ctx.clearRect(0, 0, gw, gh);
    ctx.fillStyle = root.dataset.theme === 'light' ? '#fbfbfa' : '#05060c';
    for (let i = 0; i < order.length; i++) if (order[i] < p) ctx.fillRect(i % gw, (i / gw) | 0, 1, 1);
  }
  // in 8 visible steps, like the original, rather than a smooth sweep; resolves true unless cut off by a newer one
  function tween(from, to, ms) {
    const id = ++run;
    return new Promise((done) => {
      const t0 = performance.now();
      const f = (now) => {
        if (id !== run) return done(false);
        const k = Math.min(1, Math.max(0, now - t0) / ms);
        paint(from + (to - from) * Math.ceil(k * 8) / 8);
        if (k < 1) requestAnimationFrame(f); else done(true);
      };
      requestAnimationFrame(f);
    });
  }
  document.addEventListener('astro:before-preparation', (e) => {
    if (e.to.pathname === e.from.pathname) return;
    size(); s.display = 'block'; root.classList.add('covering');
    const filled = tween(0, 1.01, 360), load = e.loader;
    e.loader = async () => { await Promise.all([load(), filled]); };
  });
  // runs after Motion.astro's handler (registered first, in <head>)
  document.addEventListener('astro:before-swap', (e) => {
    if (s.display === 'none') return;
    e.newDocument.documentElement.classList.remove('vt-in', 'vt-bg', 'vt-early');
  });
  document.addEventListener('astro:page-load', () => {
    if (s.display === 'none') return;
    tween(1.01, 0, 480).then((done) => { if (done) off(); });
  });
  function off() { s.display = 'none'; root.classList.remove('covering'); }
  // a navigation that never happened (cancelled, or handed to a full load) leaves no cover behind
  addEventListener('pageshow', () => { run++; off(); });
}
if (!reduce) pageCover();

/* ── scroll-lit statement ─────────────────────────────────────────── */
// Words start dim and light up in reading order as the block scrolls
// through the middle of the screen, then stay lit.
function scrollLit(el) {
  const split = SplitText.create(el, { type: 'words', wordsClass: 'lit-w' });
  splits.push(split);
  const words = split.words;
  let shown = -1;
  ScrollTrigger.create({
    trigger: el,
    start: 'top 78%',
    end: 'bottom 52%',
    scrub: true,
    onUpdate(self) {
      const n = Math.round(self.progress * words.length);
      if (n === shown) return;
      shown = n;
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    },
  });
}

/* ── hover roll ───────────────────────────────────────────────────── */
// After carterogunsola.com's links and Vantra's buttons: each letter slides
// up out of a one-line window while its copy (a text-shadow one line
// below, so nothing is duplicated in the page) rises into place, letters
// a few ms apart. Only the element's own text rolls; child elements such
// as an arrow keep their own hover. The link keeps its name as one word
// for screen readers via aria-label, since the letters become spans.
function roll(el) {
  if (el.dataset.rolled) return;
  el.dataset.rolled = '1';
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  let i = 0;
  [...el.childNodes].forEach((n) => {
    if (n.nodeType !== 3 || !n.textContent.trim()) return;
    const box = document.createElement('span');
    box.className = 'roll';
    box.setAttribute('aria-hidden', 'true');
    for (const ch of n.textContent) {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', i++);
      box.appendChild(s);
    }
    n.replaceWith(box);
  });
}

/* ── magnet ───────────────────────────────────────────────────────── */
// A button leans toward the pointer once it comes within ~60px, by a
// fraction of the distance and never more than 10px, and springs back when it leaves (the CSS transition on
// `translate` does the easing). Only measured while on screen and moving.
function magnet(el, signal) {
  let on = false, raf = 0, px = 0, py = 0;
  const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (!on) el.style.translate = ''; });
  io.observe(el);
  signal.addEventListener('abort', () => io.disconnect());
  addEventListener('pointermove', (e) => {
    if (!on || e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      const near = Math.abs(dx) < r.width / 2 + 60 && Math.abs(dy) < r.height / 2 + 60;
      const lean = (d, k) => Math.max(-10, Math.min(10, d * k)).toFixed(1) + 'px';
      el.style.translate = near ? `${lean(dx, 0.15)} ${lean(dy, 0.2)}` : '';
    });
  }, { passive: true, signal });
}

function init(signal) {
  if (finePointer && !reduce) {
    document.querySelectorAll('[data-roll]').forEach(roll);
    document.querySelectorAll('[data-magnet]').forEach((el) => magnet(el, signal));
  }
  const lit = document.querySelectorAll('[data-scroll-lit]');
  if (reduce) {
    lit.forEach((el) => el.classList.add('is-static'));
    return;
  }
  lit.forEach(scrollLit);

  // After a page transition, things already on screen arrived with it
  // (Motion.astro sets html.vt-in); only what's below the fold reveals.
  const arrived = root.classList.contains('vt-in');
  const onScreen = (el) => arrived && el.getBoundingClientRect().top < innerHeight;
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (onScreen(el)) { gsap.set(el, { autoAlpha: 1 }); return; }
    const kind = el.getAttribute('data-reveal');
    if (kind === 'lines') lines(el);
    else if (kind === 'media') media(el);
    else fadeUp(el, el);
  });
  document.querySelectorAll(DITHER).forEach((el) => { if (!onScreen(el)) dither(el); });
  if (finePointer) document.querySelectorAll(SCRAMBLE).forEach((el) => { if (!onScreen(el)) scramble(el); });
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    gsap.set(group, { autoAlpha: 1 });
    const later = [...group.children].filter((c) => !onScreen(c));
    if (later.length) fadeUp(later, later[0], { stagger: MOTION.stagger });
  });

  // Late layout shifts (fonts, lazy images, live feeds filling in) move
  // trigger positions; re-measure once everything has loaded (after a
  // ClientRouter swap: once the page change has settled).
  if (document.readyState === 'complete') (window.afterPageChange || Promise.resolve()).then(() => signal.aborted || ScrollTrigger.refresh());
  else addEventListener('load', () => ScrollTrigger.refresh(), { once: true, signal });
}

// Every page, including each one the ClientRouter swaps in (Motion.astro's
// onPage). Runs after the other page scripts have had their first go at the
// DOM (the blog index, for one, swaps in its first page of cards), so
// reveals bind to the elements that are actually on screen. Leaving the
// page drops its scroll triggers, split text and tweens.
window.onPage((signal) => {
  setTimeout(() => {
    if (signal.aborted) return;
    root.classList.add('motion-on');
    init(signal);
  });
  signal.addEventListener('abort', () => {
    ScrollTrigger.getAll().forEach((t) => t.kill());
    splits.splice(0).forEach((s) => s.revert()); // autoSplit keeps watching the old elements otherwise
  });
});
