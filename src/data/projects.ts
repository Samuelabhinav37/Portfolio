/**
 * Placeholder/illustrative case-study projects shown on the blog index
 * grid alongside the real MDX writeups. Previously lived inline inside
 * blog-index-client.js and hotlinked images from picsum.photos on every
 * page load; images are now self-hosted copies of the exact same photos
 * under public/images/projects/, so this is build-time data with zero
 * runtime third-party network dependency.
 */
export interface FakeProject {
  name: string;
  cats: string[];
  kick: string;
  year: number;
  seed: string;
  img: string;
  lead: string;
  metrics: [string, string][];
  overview: string[];
  stack: string[];
  attack: string[];
  links: [string, string][];
}

/**
 * Empty for now — the blog index shows only real posts until there's more
 * than one of them. The illustrative set below (Sentinel, PRISM, Axon, and
 * three bug-bounty write-ups) is kept as ARCHIVED_FAKE_PROJECTS so it's a
 * one-line swap to bring back: `export const FAKE_PROJECTS = ARCHIVED_FAKE_PROJECTS;`
 */
export const FAKE_PROJECTS: FakeProject[] = [];

export const ARCHIVED_FAKE_PROJECTS: FakeProject[] = [
  {
    name: 'Sentinel', cats: ['detect'], kick: 'Security Operations · 2025', year: 2025, seed: 'sentinelnode',
    img: '/images/projects/sentinelcore.jpg',
    lead: 'A multi-SIEM SOC lab that turns raw telemetry into triaged, attributed alerts.',
    metrics: [['1,300+', 'Alerts processed'], ['16', 'ATT&CK techniques'], ['3', 'SIEMs unified']],
    overview: [
      'Sentinel is a home-built security operations lab that runs Wazuh, Splunk, and Security Onion side by side, then funnels their detections into a single triage pipeline orchestrated through Shuffle SOAR.',
      'An n8n and Ollama enrichment step adds context to each alert before it reaches an analyst, so the queue arrives pre-sorted rather than raw. The goal was to feel what running three detection stacks at once actually costs, and to automate the parts that do not need a human.',
      'Across the build it processed over thirteen hundred alerts and exercised sixteen distinct ATT&CK techniques spanning initial access, execution, command and control, and exfiltration.',
    ],
    stack: ['Wazuh', 'Splunk', 'Security Onion', 'Shuffle SOAR', 'n8n', 'Ollama'],
    attack: ['T1566', 'T1059', 'T1071', 'T1041', 'T1078'],
    links: [['GitHub repository', '#'], ['Build write-up', '#']],
  },
  {
    name: 'PRISM', cats: ['otics'], kick: 'OT/ICS Machine Learning · 2025', year: 2025, seed: 'prismgrid',
    img: '/images/projects/prismgrid.jpg',
    lead: 'Federated anomaly detection on industrial control traffic, trained without pooling plant data.',
    metrics: [['94%', 'Detection rate'], ['<8%', 'False positive rate'], ['7', 'OT nodes']],
    overview: [
      'PRISM detects anomalies in Modbus and DNP3 traffic across seven simulated OT nodes using federated learning, so no single operator has to surrender its raw process data to a central model.',
      'Each node trains a variational autoencoder locally and shares only model updates, aggregated with Flower and FedProx. It was trained and validated on the SWaT dataset.',
      'The result held a 94 percent detection rate with a false positive rate under 8 percent, which matters in OT where a noisy alarm gets the whole system ignored.',
    ],
    stack: ['Flower', 'FedProx', 'VAE', 'PyTorch', 'Modbus / DNP3', 'SWaT'],
    attack: ['T0836', 'T0856', 'T0814'],
    links: [['GitHub repository', '#'], ['Method notes', '#']],
  },
  {
    name: 'Axon', cats: ['auth'], kick: 'Adaptive Authentication · 2025', year: 2025, seed: 'axonauth',
    img: '/images/projects/axonauth.jpg',
    lead: 'Risk-adaptive behavioral authentication that steps up only when the signal says so.',
    metrics: [['800-63B', 'NIST aligned'], ['Continuous', 'Session scoring']],
    overview: [
      'Axon scores each session continuously on behavioral signals and only forces a step-up challenge when the risk score crosses a threshold, rather than interrupting every login.',
      'The design is aligned to the NIST 800-63B authenticator assurance levels, mapping risk bands to AAL step-up requirements.',
      'It is an argument that good authentication should be quiet most of the time and loud exactly when it needs to be.',
    ],
    stack: ['Behavioral signals', 'Risk engine', 'NIST 800-63B'],
    attack: [],
    links: [['GitHub repository', '#']],
  },
  {
    name: 'S3 Bucket PII Exposure', cats: ['bb', 'cloud'], kick: 'Bug Bounty · HackerOne', year: 2024, seed: 's3leak',
    img: '/images/projects/s3leak.jpg',
    lead: 'A misconfigured storage bucket left customer PII publicly readable.',
    metrics: [['Accepted', 'HackerOne'], ['PII', 'Impact']],
    overview: [
      'A public-readable storage bucket was quietly exposing personally identifiable information — no auth, no signed URLs, just an open door. I reported it through HackerOne with a clear reproduction path, and it was accepted.',
      "It's not a clever finding. It's just someone checking the obvious thing nobody else checked that week — which is most of what bug hunting actually is.",
    ],
    stack: ['Cloud storage', 'Recon', 'Responsible disclosure'],
    attack: [],
    links: [['Disclosure summary', '#']],
  },
  {
    name: 'Dangling CNAME Takeover', cats: ['bb', 'network'], kick: 'Bug Bounty · HackerOne', year: 2024, seed: 'cnamedns',
    img: '/images/projects/cnamedns.jpg',
    lead: 'A stale DNS record pointed at a deprovisioned host, allowing subdomain takeover.',
    metrics: [['Accepted', 'HackerOne'], ['Takeover', 'Impact']],
    overview: [
      "A DNS record kept pointing at a host the org had long since deprovisioned, which meant anyone could claim that subdomain and serve whatever they wanted from it. I found it during routine recon, reported it, and it was accepted.",
      "Dangling DNS is boring to go looking for and easy to miss in a review — which is exactly why I keep looking for it.",
    ],
    stack: ['DNS', 'Subdomain takeover', 'Responsible disclosure'],
    attack: [],
    links: [['Disclosure summary', '#']],
  },
  {
    name: 'IDOR Access Control Flaw', cats: ['bb', 'web'], kick: 'Bug Bounty · HackerOne', year: 2024, seed: 'idorbug',
    img: '/images/projects/idorbug.jpg',
    lead: 'An insecure direct object reference exposed records belonging to other users.',
    metrics: [['Accepted', 'HackerOne'], ['IDOR', 'Class']],
    overview: [
      "Swapping an ID in a request let one account read another account's records — no authorization check in sight. I put together a proof of concept, reported it, and it was accepted.",
      "IDORs are one of the easiest bug classes to explain and one of the easiest to miss in review, which is exactly why they're still worth looking for.",
    ],
    stack: ['Access control', 'IDOR', 'Responsible disclosure'],
    attack: [],
    links: [['Disclosure summary', '#']],
  },
];
