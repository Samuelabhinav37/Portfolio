# Redesign research — minimalist / text-forward direction

Date: 2026-09-04
Status: research only, no code decision made yet

## Why this exists

The current site is top-decile as a *creative-developer* showpiece but underperforms
as a *cybersecurity-hire* portfolio. The two recurring problems:

1. **Perceived performance.** Homepage mobile Lighthouse 50–74. Several always-on
   `requestAnimationFrame` / WebGL loops (nebula on every page, three.js globe,
   GSAP intro, 5 live tickers, Kai canvas, subliminal-glitch layer) keep the main
   thread busy. A friend reported "crashing / infinite scroll / UI fighting /
   slow & clunky" on Luna + blogs. Nebula alone is ~3s scripting on load; TBT
   690–1700ms.
2. **Signal.** 2026 security-portfolio hiring guides explicitly call
   animation-overload a credibility *mistake* for a security hire. The heavy motion
   profile reads as "web dev who likes security."

## DigitalOcean as a reference (user asked)

DO's marketing site feels smooth because of restraint, not polish:

| Axis | DigitalOcean | This site today |
| --- | --- | --- |
| Scroll | Native browser scroll, no smooth-scroll lib, no scroll-jacking | Lenis (partly removed) + scroll-driven canvas loops |
| Motion | One primitive: fade/slide-up on scroll-in, fires once, then static | Multiple continuous rAF / WebGL loops |
| Main thread | Near-idle after load; animation on the compositor thread | Busy during scroll → the "UI fighting" |
| Copy density | 2–4 sentences + one image per section | Dense, many interactive widgets per viewport |
| Type | Plus Jakarta Sans (display) + Inter (body), 8px spacing grid | Multiple display treatments; EB Garamond serif in blog |
| Result | Fast static pages, high Lighthouse | Mobile 50–74, unreproduced phone crashes |

Biggest single lever: **jank comes from the main thread being busy during scroll.**
DO keeps it empty. Native CSS scroll-driven animations (`animation-timeline: view()`,
Chrome 115+) run on the compositor thread and are unaffected by heavy JS — that's the
modern replacement for an IntersectionObserver + JS approach.

### Worth borrowing

- Kill continuous loops. Allow **one** motion primitive: a single `view()` timeline
  fade-up, or one `IntersectionObserver` that fires once per element.
- **8px spacing scale** — every margin/padding a multiple of 8 (4 for fine work).
- Centered column, `max-width` ~1200px (prose ~68ch), single-column stack on mobile
  with the same vertical rhythm.
- One idea per section, concise copy.

## Minimalist text-forward layout — grounded specifics

- **Fluid type, no breakpoint jumps.** `clamp()` for body and headings so text
  scales proportionally to viewport instead of snapping at 768px.
  e.g. body `clamp(1rem, 0.9rem + 0.5vw, 1.125rem)`.
- **Line-height** 1.5–1.7 body, ~1.15–1.25 for large headings.
- **Measure** capped at ~68ch so lines stay readable on wide screens.
- **One column, always.** Mobile and desktop are the same layout; desktop just has
  more side margin. Nothing reflows or rearranges — removes the entire
  "breaks on mobile/tablet" class of bug.
- **Hierarchy by weight + spacing**, not rules / boxes / colour. Two weights
  (400 / 600), one accent colour used sparingly.
- **Vertical rhythm** from one spacing scale (8 / 16 / 24 / 40 / 64 / 96). Section
  gaps 64–96px desktop, 40–56px mobile.
- 40–60% of portfolio traffic is mobile (hiring managers on phones) — mobile is the
  primary design target, not an afterthought.

## Open decisions (not made here)

- Own the "creative technologist" framing, or dial it back hard for a straight
  security read. Can't fully have both.
- Title vs H1 mismatch: `<title>` = "Cybersecurity Engineer" but homepage
  `<h1 class="sr-only">` = "Cybersecurity & Creative Developer". Pick one lane.
- No résumé/CV link anywhere on the site.
- `FAKE_PROJECTS = []` — the three real projects (SENTINEL / PRISM / AXON) exist as
  homepage accordion copy but there are no case-study pages.
- three.js 0.160.0 (~116KB, ~67% unused) — lazy-load or slim build if the globe stays.
- Microsoft Clarity's third-party cookies hold best-practices at ~73.

## Sources

- DigitalOcean design system tokens — https://www.designmd.co/d/digitalocean
- Chrome — scroll-driven animation performance case study —
  https://developer.chrome.com/blog/scroll-animation-performance-case-study
- Chrome for Developers — scroll-driven animations —
  https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Scrolljacking & B2B UX — https://www.get-started-int.com/en/post/scrolljacking-is-evil-ux-guide
- Typography for portfolios — https://thecrit.co/resources/typography-for-portfolios
- Minimalist portfolio examples — https://reallygooddesigns.com/minimalist-portfolio-website/
