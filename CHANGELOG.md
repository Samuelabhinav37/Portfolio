# Changelog

Notable changes to the portfolio and blog will be recorded here.

## Unreleased

### Added

- Expanded project setup, verification, deployment, security, and limitation documentation.
- Contact form: a Reason dropdown (tagged into the email subject) and a direct `mailto:` line.

### Changed

- **Motion, site-wide** (`Motion.astro` + `src/scripts/motion.js`): Lenis smooth scrolling is back on trial, tuned much snappier (a wheel notch settles in about 0.4s, mouse and trackpad only, off on touch and reduced motion, `?lenis=0` turns it off per browser). One set of motion tokens drives everything: headings rise line by line out of a mask, cards and blocks fade up in a short stagger as they come into view (once), images ease in from a slight zoom, and pages cross-fade into each other with view transitions. GSAP is bundled from npm (ScrollTrigger, SplitText), replacing the homepage's separate copy.
- Homepage **beliefs** are now one statement in Inter Tight (self-hosted) whose words light up as you scroll past, with a row of proof numbers under it.
- Homepage **projects** are big-name rows on hairlines: hovering (or tapping) a row opens it with Role / Timeline / Focus / Status, the details and its screenshot, while the other rows dim. "Jump to project" opens the GitHub repo.
- Cards are solid and float: the blog's cards and search fields, and the homepage's research-log, Signal and CTF cards, have an opaque fill and a soft shadow instead of see-through glass.
- The sky is calmer: no ambient aircraft, freighter or satellite packets; two research satellites, and the police/robber chase over two vaults (one a honeypot). The blog gets a calm sky (one slow satellite and the odd shooting star). The cast now steers around every card and heading on the page, not just one block.
- Glitches now run on every main page, contact included, but rarer and fainter (one every 6-12s). They live in one shared `Glitches.astro`.
- Tab titles read About, Blog and Contact (typed out with the cursor, like the homepage) instead of `~/about` etc.
- The blog index is now **Field Notes**: a floating Cormorant Garamond title with search and a topic filter, a featured post, a two-column editorial list where every card carries its post art (wide cards show the whole picture over a blurred fill), real read times, and numbered pages. Search, topic and paging run client-side over the fully server-rendered list.
- Contact page redesigned as a single centered form card; the case-file card stack and its scripts/images are removed.
- The sky's cast reworked: three research satellites that fly to new spots, scan, find bugs and patch them; a police-and-robber patrol that stays on screen, with the robber breaching data vaults behind a firewall and getting tagged by a honeypot; and padlocked packets passed between satellites.
- One background for the whole site: the night-cloud sky (`SkyBackground.astro` + `sky-engine.js`), rendered off the main thread where supported, replaces the old nebula on the homepage, about, blog and contact pages. GPU-drawn star depths, aircraft, a freighter and satellites that fade in and out of the clouds, an occasional chase scene, and on contact a courier that launches when the form sends. Phones get a lighter version; reduced motion gets a still frame.

### Removed

- From the blog index: the hero rotator, the threat-wire ticker and its `/api/cve-wire` function, the category tabs and filter dialog, the grid/table views, and the case-study slide-over with its placeholder project data and images.
- The divider lines between homepage sections, and the explainer line under the blog's threat ticker.
- The project pages: `/projects/` and the Sentinel, Moat and Cluster case studies (layout, content collection, styles and case-study images). Old URLs, and `/work`, redirect to the homepage, whose projects accordion stays; the menus and Kai's chat point there now.
- The two near-duplicate nebula engines (`nebula-engine.js`, `nebula-engine-home.js`) and `NebulaBackground.astro`.
- The homepage hero video (and its poster and 4.9 MB file) and the dark panels behind the homepage sections, so the sky shows through; the blog keeps its blur over the sky but no longer darkens it.
- The homepage globe (`index-globe-engine.js`, Three.js) with its project-tour preview panel and case rail, ahead of a homepage redesign. The projects accordion stays.

### Fixed

- The about-page arcade game never ran in production: its sandboxed iframe had an opaque origin, so the site-wide `Cross-Origin-Resource-Policy: same-origin` blocked its script and fonts. The iframe now also allows same-origin (it only ever holds the page's own srcdoc).
- The site header no longer turns into a near-black bar on scroll; it becomes a frosted bar with a faint tint, so the sky stays visible.
- A dark 1px line under the site header: its fade gradient repeated under its transparent bottom border.

Release history before this changelog is available through the Git history and merged pull requests.
