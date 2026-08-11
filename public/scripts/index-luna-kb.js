/* Luna chat drawer knowledge base for the homepage. Extracted from an inline
   <script id="ldw-engine"> block. Content and case-jump targets are specific
   to this page (references the homepage's own case-study seeds), not shared
   with the other pages' knowledge bases. */
/* ───────── shared archive (single source of truth for both engines) ───────── */
  const KB = [
    { id:'sentinel', title:'Sentinel',
      keywords:['sentinel','soc','siem','splunk','spl','wazuh','security onion','soar','shuffle','detection','detections','blue team','log analysis'],
      reply:"Sentinel's the multi-SIEM SOC lab. Wazuh, Splunk and Security Onion all feed the detections, and Shuffle wires up the SOAR playbooks. It's where the detections actually happen.",
      detail:"Under the hood: log sources stream into all three SIEMs in parallel, detections are authored per platform, and Shuffle playbooks handle triage and enrichment automatically. Ask about splunk, wazuh, or soar for a closer look.",
      target:{type:'project', value:'sentinel'} },

    { id:'prism', title:'PRISM',
      keywords:['prism','federated','federated learning','machine learning','ml','anomaly','anomaly detection','ot','ics','industrial','flower','fedprox','temporal vae','vae','nodes'],
      reply:"PRISM does federated anomaly detection for OT and ICS: Flower with FedProx and a Temporal VAE, trained across seven simulated industrial nodes so raw telemetry never leaves a site.",
      detail:"The clue is in the split: each node trains locally on its own telemetry, FedProx keeps drifting nodes honest, and only model weights travel. The Temporal VAE learns normal rhythm, so anomalies surface as reconstruction error.",
      target:{type:'project', value:'prism'} },

    { id:'axon', title:'Axon',
      keywords:['axon','auth','authentication','nist','800-63b','risk adaptive','risk-adaptive','mfa','step up','identity','login'],
      reply:"Axon is risk-adaptive authentication aligned to NIST 800-63B. It scores each attempt and steps up assurance only when the risk earns it.",
      detail:"Each login gets a live risk score from device, location and behavior signals. Low risk sails through; high risk triggers step-up to a stronger authenticator, per the 800-63B assurance levels.",
      target:{type:'project', value:'axon'} },

    { id:'bounty', title:'Bug bounty',
      keywords:['bug bounty','bounty','hackerone','vulnerability','vuln','idor','s3','bucket','subdomain','takeover','subdomain takeover','cname','dangling','pii','disclosure','findings','hacking','recon'],
      reply:"The bug bounty work: accepted findings on HackerOne, including an S3 bucket leaking PII, an IDOR, and a dangling-CNAME subdomain takeover. Real disclosures, not lab targets.",
      detail:"Each finding came from methodical recon: bucket enumeration for the S3 exposure, request tampering for the IDOR, and DNS record auditing for the dangling CNAME. Writeups live on the blog.",
      target:{type:'scroll', value:'#sec-bounty'} },

    { id:'labs', title:'Labs',
      keywords:['labs','lab','ctf','overthewire','bandit','offsec','oscp','incident response','forensics','ghidra','reverse engineering','malware','pcap','evtx','arctic howl','gauntlet','grimoire'],
      reply:"The labs: OverTheWire and OffSec ranges, plus incident-response reconstructions with attack chains rebuilt from EVTX, PCAP and portal logs. Ghidra when the binaries get stubborn.",
      detail:"Recent chains include a Tomcat partial-PUT RCE traced to first compromise, a cloud pivot from a leaked .git to an assumed IAM role, and a Go phishing framework pulled apart in Ghidra.",
      target:{type:'scroll', value:'#sec-labs'} },

    { id:'blog', title:'Writing',
      keywords:['blog','writing','write ups','writeups','articles','posts','threat intel','threat intelligence','intelligence','ioc','mitre','att&ck','case file','astro'],
      reply:"The writing lives on the threat-intel blog: IOC breakdowns, MITRE ATT&CK mappings, case files. Built in Astro, deployed on Cloudflare.",
      detail:"Posts follow a case-file format: the chain, the IOCs, the ATT&CK mapping, then detection ideas you could actually deploy. Start with the supply-chain anatomy post.",
      target:{type:'url', value:'https://samuelabhinav.com'} },

    { id:'skills', title:'Stack',
      keywords:['skills','stack','tools','tooling','technologies','kql','sentinel kql','python','powershell','languages','experience with'],
      reply:"The stack: Splunk SPL, Microsoft Sentinel KQL, Wazuh, Security Onion, MITRE ATT&CK for detection, plus Python and PowerShell for the glue.",
      detail:"Certifications behind it: Security+, Network+, ISC2 CC, AWS CCP, AZ-900 and HTB CJCA. The projects are where the stack gets exercised for real.",
      target:{type:'scroll', value:'#sec-about'} },

    { id:'about', title:'About Samuel',
      keywords:['about','who','samuel','background','resume','cv','education','degree','masters','opt','hire','hiring','job','jobs','open to work','soc analyst','detection engineer','security engineer'],
      reply:"Samuel's got his MS in cybersecurity, he's on OPT, and he's after SOC analyst and security engineering roles. He's open to work. I'm the companion he built to keep an eye on the archive.",
      detail:"The short pitch: three shipped security projects, accepted bounty findings, a threat-intel blog, and hands-on IR labs. If you are hiring for blue-team work, the contact page has the direct line.",
      target:{type:'scroll', value:'#sec-about'} },

    { id:'contact', title:'Contact',
      keywords:['contact','email','reach','reach out','connect','linkedin','github','message','talk','get in touch','dm'],
      reply:"Want to reach him? The contact page has the direct line: email, GitHub, and the usual channels.",
      detail:"Fastest route is email from the contact page. GitHub shows the code side; the blog shows the thinking.",
      target:{type:'scroll', value:'#sec-contact'} },

    { id:'greeting', title:'Say hi',
      keywords:['hi','hey','hello','yo','luna','who are you','what are you','greetings'],
      reply:"I'm Luna. I keep an eye on this archive. Ask me about the work, the labs, or the writing, whatever you're curious about.",
      detail:"I match what you ask against Samuel's real work and take you straight to the right section. He's training a small model of me to answer in fuller sentences soon.",
      target:null },
  ];

  function extraTargetHandler(target, ctx){
    if(target.type==='project'){
      return {label:'Show me on the globe', run:()=>{ ctx.close(); window.SITE.jumpToProject(target.value); }}; }
    return null;
  }

  /* globe-tour jump: scroll #beat-tour to a project's focus band —
     order matches the PROJECTS array: sentinel=0, prism=1, axon=2. */
  window.SITE.jumpToProject = function(id){
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const idx={sentinel:0,prism:1,axon:2}[id];
    const bt=document.getElementById('beat-tour');
    if(idx==null || !bt){ const a=document.getElementById('sec-'+id); a&&a.scrollIntoView({behavior:'smooth'}); return; }
    const rect=bt.getBoundingClientRect();
    const top=rect.top+scrollY, band=bt.offsetHeight, NP=3;
    const frac=(idx+0.5)/NP;
    const targetY=top + frac*(band - innerHeight);
    scrollTo({top:Math.max(0,targetY), behavior:reduce?'auto':'smooth'});
  };

  window.SITE.initLunaDrawer(KB, extraTargetHandler);

