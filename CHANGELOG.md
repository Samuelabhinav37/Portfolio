# Changelog

Notable changes to the portfolio and blog will be recorded here.

## Unreleased

### Added

- Expanded project setup, verification, deployment, security, and limitation documentation.
- Contact form: a Reason dropdown (tagged into the email subject) and a direct `mailto:` line.

### Changed

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
- The glitch-mark layer on the contact page.

### Fixed

- The about-page arcade game never ran in production: its sandboxed iframe had an opaque origin, so the site-wide `Cross-Origin-Resource-Policy: same-origin` blocked its script and fonts. The iframe now also allows same-origin (it only ever holds the page's own srcdoc).
- The site header no longer turns into a near-black bar on scroll; it becomes a frosted bar with a faint tint, so the sky stays visible.
- A dark 1px line under the site header: its fade gradient repeated under its transparent bottom border.

Release history before this changelog is available through the Git history and merged pull requests.
