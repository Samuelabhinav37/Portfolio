# Changelog

Notable changes to the portfolio and blog will be recorded here.

## Unreleased

### Added

- Expanded project setup, verification, deployment, security, and limitation documentation.
- Contact form: a Reason dropdown (tagged into the email subject) and a direct `mailto:` line.

### Changed

- Contact page redesigned as a single centered form card; the case-file card stack and its scripts/images are removed.
- The sky's cast reworked: three research satellites that fly to new spots, scan, find bugs and patch them; a police-and-robber patrol that stays on screen, with the robber breaching data vaults behind a firewall and getting tagged by a honeypot; and padlocked packets passed between satellites.
- One background for the whole site: the night-cloud sky (`SkyBackground.astro` + `sky-engine.js`), rendered off the main thread where supported, replaces the old nebula on the homepage, about, blog and contact pages. GPU-drawn star depths, aircraft, a freighter and satellites that fade in and out of the clouds, an occasional chase scene, and on contact a courier that launches when the form sends. Phones get a lighter version; reduced motion gets a still frame.

### Removed

- The project pages: `/projects/` and the Sentinel, Moat and Cluster case studies (layout, content collection, styles and case-study images). Old URLs, and `/work`, redirect to the homepage, whose projects accordion stays; the menus and Kai's chat point there now.
- The two near-duplicate nebula engines (`nebula-engine.js`, `nebula-engine-home.js`) and `NebulaBackground.astro`.
- The homepage globe (`index-globe-engine.js`, Three.js) with its project-tour preview panel and case rail, ahead of a homepage redesign. The projects accordion stays.
- The glitch-mark layer on the contact page.

### Fixed

- A dark 1px line under the site header: its fade gradient repeated under its transparent bottom border.

Release history before this changelog is available through the Git history and merged pull requests.
