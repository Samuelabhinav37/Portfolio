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

function init() {
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
    else fadeUp(el, el);
  });
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    gsap.set(group, { autoAlpha: 1 });
    fadeUp(group.children, group, { stagger: MOTION.stagger });
  });

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
