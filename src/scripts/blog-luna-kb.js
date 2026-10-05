/* Luna chat drawer's knowledge base for the blog index page — extracted
   from an inline <script id="ldw-engine"> block. As a separate module this
   no longer shares an implicit global scope with blog-index-client.js the
   way two classic <script> tags used to, so it reads window.projects /
   window.openCase (explicitly exported there) instead of the bare
   identifiers the inline version relied on. */
const KB = [
  { id:'sentinel', title:'Sentinel',
    keywords:['sentinel','soc','siem','elastic','kibana','sigma','wazuh','suricata','zeek','soar','shuffle','n8n','ollama','detection','detections','blue team','mttd','triage','log analysis'],
    reply:"Sentinel is the detection-engineering SOC lab. Every rule is Sigma in Git, fired live against Elastic, then triaged by two AI models that have to agree before Shuffle acts.",
    detail:"18 rules, each caught firing on a real command, with measured attack-to-alert times of 45 to 151 seconds. Ollama and Claude triage every alert in parallel, and the cases where they disagree go to a human queue. The full case study is at /projects/sentinel/.",
    target:{type:'page', value:'/projects/sentinel/'} },

  { id:'moat', title:'Moat',
    keywords:['moat','ad blocker','adblock','ad block','ads','tracker','trackers','popup','pop-up','pop-ups','cookie banner','browser extension','chrome extension','firefox','manifest v3','mv3','declarativenetrequest'],
    reply:"Moat is Samuel's open-source ad blocker for Chrome and Firefox. It blocks ads, trackers, cookie banners and scam pop-ups entirely inside the browser. No server, no account, no telemetry.",
    detail:"About 314,000 filter entries compile into roughly 72,000 declarativeNetRequest rules, so the browser's own engine does the blocking. A small content script hides leftover boxes and closes hijacked pop-ups. The full case study is at /projects/moat/.",
    target:{type:'page', value:'/projects/moat/'} },

  { id:'cluster', title:'Cluster',
    keywords:['cluster','gmail','outlook','inbox','phishing','impersonation','dmarc','spf','dkim','unsubscribe','lookalike','punycode','bec','newsletter','newsletters'],
    reply:"Cluster is a Chrome extension that cleans up Gmail and Outlook and flags impersonation, using only message metadata. It never reads a message body by default, and there's no server.",
    detail:"It checks headers for brand impersonation, lookalike and punycode domains, failed DMARC, Reply-To mismatches and known-bad domains, then scores each sender. The full case study is at /projects/cluster/.",
    target:{type:'page', value:'/projects/cluster/'} },

  { id:'bounty', title:'Bug bounty',
    keywords:['bug bounty','bounty','hackerone','vulnerability','vuln','idor','s3','bucket','subdomain','takeover','subdomain takeover','cname','dangling','pii','disclosure','findings','hacking','recon'],
    reply:"The bug bounty work: accepted findings on HackerOne, including an S3 bucket leaking PII, an IDOR, and a dangling-CNAME subdomain takeover. Real disclosures, not lab targets.",
    detail:"Each finding came from methodical recon: bucket enumeration for the S3 exposure, request tampering for the IDOR, and DNS record auditing for the dangling CNAME. Writeups live on the blog.",
    target:{type:'case', value:'cnamedns'} },

  { id:'labs', title:'Labs',
    keywords:['labs','lab','ctf','overthewire','bandit','offsec','oscp','incident response','forensics','ghidra','reverse engineering','malware','pcap','evtx','arctic howl','gauntlet','grimoire'],
    reply:"The labs: OverTheWire and OffSec ranges, plus incident-response reconstructions with attack chains rebuilt from EVTX, PCAP and portal logs. Ghidra when the binaries get stubborn.",
    detail:"Recent chains include a Tomcat partial-PUT RCE traced to first compromise, a cloud pivot from a leaked .git to an assumed IAM role, and a Go phishing framework pulled apart in Ghidra.",
    target:null },

  { id:'blog', title:'Writing',
    keywords:['blog','writing','write ups','writeups','articles','posts','threat intel','threat intelligence','intelligence','ioc','mitre','att&ck','case file','astro'],
    reply:"The writing lives right here — filter to 'Writing' below for the threat-intel posts: IOC breakdowns, MITRE ATT&CK mappings, case files.",
    detail:"Posts follow a case-file format: the chain, the IOCs, the ATT&CK mapping, then detection ideas you could actually deploy. Start with the supply-chain anatomy post.",
    target:{type:'scroll', value:'#grid'} },

  { id:'skills', title:'Stack',
    keywords:['skills','stack','tools','tooling','technologies','kql','sentinel kql','python','powershell','languages','experience with'],
    reply:"The stack: Splunk SPL, Microsoft Sentinel KQL, Wazuh, Security Onion, MITRE ATT&CK for detection, plus Python and PowerShell for the glue.",
    detail:"Certifications behind it: Security+, Network+, ISC2 CC, AWS CCP, AZ-900 and HTB CJCA. The projects are where the stack gets exercised for real.",
    target:{type:'scroll', value:'#grid'} },

  { id:'about', title:'About Samuel',
    keywords:['about','who','samuel','background','resume','cv','education','degree','masters','opt','hire','hiring','job','jobs','open to work','soc analyst','detection engineer','security engineer'],
    reply:"Samuel: MS in cybersecurity, on OPT, aiming at SOC analyst and security engineering roles. He is open to work. I am the companion he built to keep watch over the archive.",
    detail:"The short pitch: three shipped security projects, accepted bounty findings, a threat-intel blog, and hands-on IR labs. If you are hiring for blue-team work, the contact page has the direct line.",
    target:null },

  { id:'contact', title:'Contact',
    keywords:['contact','email','reach','reach out','connect','linkedin','github','message','talk','get in touch','dm'],
    reply:"Want to reach him? The contact page has the direct line: email, GitHub, and the usual channels.",
    detail:"Fastest route is email from the contact page. GitHub shows the code side; the blog shows the thinking.",
    target:null },

  { id:'greeting', title:'Say hi',
    keywords:['hi','hey','hello','yo','luna','kai','who are you','what are you','greetings'],
    reply:"I am Kai. I keep watch over this archive. Ask about the work, the labs, or the writing.",
    detail:"I match what you ask against Samuel's real work and take you to the right section. Soon he is training a small model of me to answer in fuller sentences.",
    target:null },
];

/* case-study jump: hand the seed to the page's own openCase() —
   seeds come straight from the projects[] array this page already
   builds its grid from, so the drawer and the grid can never drift. */
function openCaseBySeed(seed, reduce){
  try{
    const p = window.projects && window.projects.find(x => x.seed === seed);
    if(p && typeof window.openCase === 'function'){ window.openCase(p, null); return; }
  }catch(e){ console.warn('case jump failed', e); }
  const g = document.getElementById('grid');
  g && g.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
}
function extraTargetHandler(target, ctx){
  if(target.type==='case'){
    return {label:'Open the case study', run:()=>{ ctx.close(); openCaseBySeed(target.value, ctx.reduce); }}; }
  return null;
}

window.SITE.initLunaDrawer(KB, extraTargetHandler);
