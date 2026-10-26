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
 *   data-reveal="assemble" letters start scattered and fly into place as
 *                          the block scrolls up the screen (scrubbed)
 *   data-reveal="rise"     letters rise out of a mask, from the middle of
 *                          the line outwards, as soon as it is on screen
 *   data-skew              leans a little with scroll speed, then settles
 *   data-scroll-speed      a CSS animation (a marquee) that runs faster
 *                          while the page scrolls fast
 *   data-reveal-group      each child fades up in turn
 *   data-scroll-lit        words brighten one by one as you scroll past
 *   data-roll              on hover the letters roll up one after another
 *   data-magnet            leans a few px toward a nearby mouse pointer
 *                          (moves the `translate` property; give it a
 *                          translate transition in CSS)
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
}

/* ── reveals ──────────────────────────────────────────────────────── */
function fadeUp(targets, trigger, extra = {}) {
  return gsap.fromTo(targets,
    { autoAlpha: 0, y: MOTION.rise },
    { autoAlpha: 1, y: 0, duration: MOTION.dur, ease: MOTION.ease, clearProps: 'transform',
      scrollTrigger: { trigger, start: MOTION.start, once: true }, ...extra });
}

function lines(el) {
  // autoSplit re-splits when the web font swaps in or the width changes, so
  // lines never break in the wrong place; the tween is rebuilt each time.
  SplitText.create(el, {
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
  });
}

function media(el) {
  const img = el.querySelector('img, svg, video') || el;
  gsap.set(el, { autoAlpha: 1 });
  gsap.fromTo(img, { scale: 1.08, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration: 1.2, ease: MOTION.ease, clearProps: 'transform',
    scrollTrigger: { trigger: el, start: MOTION.start, once: true },
  });
}

// After Max Milkin's "assembling paragraph" (Codrops, Dec 2025): every
// letter starts somewhere off to the side, tilted and faint, and travels home
// as you scroll, the ones near the start of the line arriving first. Split
// into words too, so a line never breaks inside a word.
// A block that is already on screen when the page opens has no scroll left
// to drive it, so it plays through once instead.
function assemble(el) {
  const split = SplitText.create(el, { type: 'words,chars' });
  gsap.set(el, { autoAlpha: 1 });
  const r = gsap.utils.random;
  const from = { x: () => r(-160, 160), y: () => r(-90, 90), rotation: () => r(-50, 50), autoAlpha: 0, ease: 'power3.out' };
  if (el.getBoundingClientRect().top < innerHeight * 0.9) {
    gsap.from(split.chars, { ...from, duration: 1.4, delay: 0.3, stagger: { each: 0.008, from: 'start' } });
  } else {
    gsap.from(split.chars, { ...from, stagger: { each: 0.004, from: 'start' },
      scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 58%', scrub: 1 } });
  }
}

// Letters rise from the centre of the line outwards (Milkin's hero).
function rise(el) {
  SplitText.create(el, {
    type: 'lines,chars', mask: 'lines', autoSplit: true,
    onSplit(self) {
      gsap.set(el, { autoAlpha: 1 });
      return gsap.from(self.chars, { yPercent: 110, duration: 1.3, ease: 'power4.inOut', stagger: { each: 0.025, from: 'center' } });
    },
  });
}

/* ── scroll speed ─────────────────────────────────────────────────── */
// One input, the scroll velocity, read on scroll and eased back to rest
// (after Vladyslav Penev: speed is what gives a page weight, position alone
// looks decorative). [data-skew] blocks lean by up to 3deg; [data-scroll-speed]
// marquees play up to 3x faster. Nothing runs while the page is still.
function scrollSpeed() {
  const skews = document.querySelectorAll('[data-skew]');
  const runs = [...document.querySelectorAll('[data-scroll-speed]')];
  if (!skews.length && !runs.length) return;
  const clamp = gsap.utils.clamp(-3, 3);
  const setSkew = skews.length ? gsap.quickSetter(skews, 'skewY', 'deg') : () => {};
  const proxy = { v: 0 };
  const apply = () => {
    setSkew(proxy.v);
    const rate = 1 + Math.abs(proxy.v) * 0.7;
    runs.forEach((el) => el.getAnimations().forEach((a) => { a.playbackRate = rate; }));
  };
  ScrollTrigger.create({
    onUpdate(self) {
      const v = clamp(self.getVelocity() / -500);
      if (Math.abs(v) <= Math.abs(proxy.v)) return;
      proxy.v = v;
      gsap.to(proxy, { v: 0, duration: 0.8, ease: 'power3', overwrite: true, onUpdate: apply });
    },
  });
}

/* ── scroll-lit statement ─────────────────────────────────────────── */
// Words start dim and light up in reading order as the block scrolls
// through the middle of the screen, then stay lit.
function scrollLit(el) {
  const split = SplitText.create(el, { type: 'words', wordsClass: 'lit-w' });
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
function magnet(el) {
  let on = false, raf = 0, px = 0, py = 0;
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (!on) el.style.translate = ''; }).observe(el);
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
  }, { passive: true });
}

function init() {
  if (finePointer && !reduce) {
    document.querySelectorAll('[data-roll]').forEach(roll);
    document.querySelectorAll('[data-magnet]').forEach(magnet);
  }
  const lit = document.querySelectorAll('[data-scroll-lit]');
  if (reduce) {
    lit.forEach((el) => el.classList.add('is-static'));
    return;
  }
  lit.forEach(scrollLit);

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const kind = el.getAttribute('data-reveal');
    if (kind === 'lines') lines(el);
    else if (kind === 'media') media(el);
    else if (kind === 'assemble') assemble(el);
    else if (kind === 'rise') rise(el);
    else fadeUp(el, el);
  });
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    gsap.set(group, { autoAlpha: 1 });
    fadeUp(group.children, group, { stagger: MOTION.stagger });
  });
  scrollSpeed();

  // Late layout shifts (fonts, lazy images, live feeds filling in) move
  // trigger positions; re-measure once everything has loaded.
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

// Run after every other page script has had its first go at the DOM (the
// blog index, for one, swaps in its first page of cards), so reveals bind
// to the elements that are actually on screen. Module scripts always run
// before DOMContentLoaded; the timer is only a backstop.
let started = false;
function start() {
  if (started) return;
  started = true;
  root.classList.add('motion-on');
  init();
}
addEventListener('DOMContentLoaded', start, { once: true });
setTimeout(start, 1500);
