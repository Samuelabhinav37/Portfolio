/**
 * Single source of truth for the blog's filter category keys — the values
 * a post's frontmatter `cats: [...]` array is expected to draw from.
 * Consumed by:
 *   - blog-index-client.js (PRIMARY_CATS drives the always-visible tab row,
 *     SECONDARY_CATS the fuller taxonomy behind "See more")
 *   - NewPostTool.astro (the /tools/new-post category picker)
 * Add a key here once and both the filter UI and the authoring tool pick
 * it up — no need to touch either consumer by hand.
 */
export const PRIMARY_CATS: string[] = ['detect', 'otics', 'auth', 'bb'];

export const SECONDARY_CATS: [string, string][] = [
  ['web', 'Web / App Security'],
  ['mobile', 'Mobile Security'],
  ['network', 'Network Security'],
  ['cloud', 'Cloud Security'],
  ['iot', 'IoT Security'],
  ['malware', 'Malware Analysis'],
  ['threatintel', 'Threat Intelligence'],
  ['dfir', 'Digital Forensics & IR'],
  ['crypto', 'Cryptography'],
  ['grc', 'GRC / Risk'],
];

/** Primary tab labels, for consumers (like the tool UI) that need them. */
export const PRIMARY_CAT_LABELS: Record<string, string> = {
  detect: 'Detection',
  otics: 'OT/ICS',
  auth: 'Auth',
  bb: 'Bug Bounty',
};
