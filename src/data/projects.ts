/* The six projects, in the order the homepage shows them. Each one gets an
   overview page at /work/<slug>/ (src/pages/work/[slug].astro). */

export interface ProjectImage {
  src: string;
  /** 800px-wide copy for phones, when there is one */
  w800?: string;
  w: number;
  h: number;
  alt: string;
}

export interface Project {
  slug: string;
  name: string;
  year: number;
  tags: string[];
  /** the one-line pitch the homepage tile shows */
  line: string;
  about: string[];
  links: { label: string; href: string }[];
  /** empty means "Image coming soon" */
  images: ProjectImage[];
}

const GH = 'https://github.com/Samuelabhinav37/';
const tile = (slug: string, name: string): ProjectImage => ({
  src: `/images/projects/${slug}-tile.webp`, w800: `/images/projects/${slug}-tile.w800.webp`,
  w: 1500, h: 1000, alt: `${name} logo`,
});
const shot = (name: string, w: number, h: number, alt: string): ProjectImage => ({
  src: `/images/work/${name}.webp`, w800: `/images/work/${name}.w800.webp`, w, h, alt,
});

export const PROJECTS: Project[] = [
  {
    slug: 'moat', name: 'Moat', year: 2026,
    tags: ['Browser extension', 'Ad & tracker blocking', 'Privacy'],
    line: 'A free ad blocker that runs entirely in the browser. No server, no account.',
    about: [
      'A free ad blocker for Chrome and Firefox. It stops ads, trackers and hijacked pop-ups before they load.',
      'Everything runs in the browser. There is no server and no account, and nothing about your browsing leaves your machine.',
    ],
    links: [{ label: 'Visit website', href: '/moat/' }, { label: 'Source code', href: GH + 'moat' }],
    images: [
      tile('moat', 'Moat'),
      shot('moat-wipe', 1040, 724, 'A news page with and without Moat: ads and pop-ups on one side, a clean article on the other'),
      shot('moat-trackers', 1600, 900, "Moat's tracker report: which companies followed you across the sites you visited"),
      shot('moat-blocked', 1600, 900, 'Moat stopping a fake PayPal sign-in page before it loads'),
      shot('moat-safety', 1600, 900, "Moat's safety check listing the protections that are on"),
    ],
  },
  {
    slug: 'sentinel', name: 'Sentinel', year: 2026,
    tags: ['Detection engineering', 'SOC automation', 'Terraform'],
    line: 'A SOC lab where every detection is tested against a real attack.',
    about: [
      'A SOC lab where every detection is tested against a real attack. Rules are written once in Sigma, mapped to MITRE ATT&CK and checked in CI before they go live in Elastic.',
      'When a rule fires, a local model triages the alert and Shuffle SOAR can stop the process. The whole lab runs on three cloud VMs built with Terraform and reachable only over Tailscale.',
    ],
    links: [{ label: 'Source code', href: GH + 'Sentinel' }],
    images: [],
  },
  {
    slug: 'cluster', name: 'Cluster', year: 2026,
    tags: ['Browser extension', 'Phishing detection', 'Gmail & Outlook'],
    line: 'Catches phishing in Gmail and Outlook from the headers alone, without reading a single email.',
    about: [
      'A Chrome extension for Gmail and Outlook. It catches phishing from the sender, subject and headers alone, and never reads the body of an email.',
      'It also sorts promotions into labels and clears out old mail. Everything runs in your browser under your own sign-in.',
    ],
    links: [{ label: 'Source code', href: GH + 'cluster' }],
    images: [
      tile('cluster', 'Cluster'),
      { src: '/images/projects/cluster-hero.webp', w800: '/images/projects/cluster-hero.w800.webp', w: 1440, h: 960,
        alt: "Cluster's phishing view: a fake Netflix email flagged because the sender doesn't match the name it shows" },
    ],
  },
  {
    slug: 'athena', name: 'Athena', year: 2026,
    tags: ['Identity governance', 'Policy as code', 'Python & OPA'],
    line: 'Shows who has access, why they have it, and when it stops making sense.',
    about: [
      'An open-source identity governance platform. It gathers access from Keycloak, GitHub and AWS IAM and traces why each person has it.',
      'Access that no longer fits someone’s role gets flagged and checked against policy written in OPA. A person approves every removal, and each decision is kept as evidence for an audit.',
    ],
    links: [{ label: 'Source code', href: GH + 'Athena' }],
    images: [],
  },
  {
    slug: 'blue-streak', name: 'Blue Streak', year: 2026,
    tags: ['Desktop app', 'Rust & Tauri', 'Windows'],
    line: 'A Windows disk analyzer that reads the drive once, then finds duplicates, junk and lost space.',
    about: [
      'A Windows disk analyzer built with Rust and Tauri. It reads the drive’s file table in one pass, in a few seconds, then answers everything from memory.',
      'It finds duplicate files, photos and songs, maps where the space went and clears out junk.',
    ],
    links: [{ label: 'Source code', href: GH + 'blue-streak' }],
    images: [tile('blue-streak', 'Blue Streak')],
  },
  {
    slug: 'knot', name: 'Knot', year: 2026,
    tags: ['Android app', 'Kotlin & Compose', 'In development'],
    line: 'An Android app for building habits, with AI help and on-device storage.',
    about: [
      'An Android app for building habits, with AI help. It is built in Kotlin and Jetpack Compose and keeps your data on the device.',
      'Still in development.',
    ],
    links: [{ label: 'Source code', href: GH + 'Knot' }],
    images: [],
  },
];
