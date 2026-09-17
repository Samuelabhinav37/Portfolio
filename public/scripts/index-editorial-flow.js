/* Homepage editorial-flow widgets: CISA KEV live ticker, Beliefs scroll-reveal,
   cert badges marquee, threat-intel feed, decorative auto-defense arcade runner,
   and the MITRE ATT&CK technique spotlight. Extracted from an inline <script>
   block, unmodified, matching every other homepage widget already split out
   (index-signal-eagle.js, index-logo-glitch.js, etc.) — this was the one
   remaining large (~500 line) un-extracted block. */
(function(){
  var KEV='/api/kev';
  var track=document.getElementById('ed-track');
  var status=document.getElementById('ed-status');
  var statusText=document.getElementById('ed-status-text');
  var foot=document.getElementById('ed-foot');
  if(!track) return;
  var FALLBACK=[
    {cveID:'CVE-2026-2041',vendorProject:'Cisco',product:'IOS XE',dateAdded:'2026-07-21',ransom:false},
    {cveID:'CVE-2026-1180',vendorProject:'Microsoft',product:'SharePoint',dateAdded:'2026-07-18',ransom:true},
    {cveID:'CVE-2026-0995',vendorProject:'Fortinet',product:'FortiOS',dateAdded:'2026-07-15',ransom:false},
    {cveID:'CVE-2026-0774',vendorProject:'Ivanti',product:'Connect Secure',dateAdded:'2026-07-12',ransom:true},
    {cveID:'CVE-2025-9932',vendorProject:'Apache',product:'Tomcat',dateAdded:'2026-07-09',ransom:false},
    {cveID:'CVE-2026-0421',vendorProject:'Zyxel',product:'Firewalls',dateAdded:'2026-07-05',ransom:false}
  ];
  /* Attribute-safe: also escapes quotes — this builds an aria-label="..." and
     href="..." attribute below from KEV feed data, where a bare '<>&' escape
     would still let a stray " break out of the attribute (see the same fix
     on the threat-intel esc() further down this file). */
  function esc(s){ return String(s||'').replace(/[<>&"]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}); }
  function tok(v, hidden){
    var vp=esc(v.vendorProject)+(v.product?' '+esc(v.product):'');
    var r=v.ransom?'<span class="ed-ransom">RANSOMWARE</span>':'';
    var attrs=hidden?' aria-hidden="true" tabindex="-1"':'';
    var href='https://nvd.nist.gov/vuln/detail/'+esc(v.cveID);
    /* No aria-label: an earlier one hand-rebuilt the visible text with
       different separator spacing ("A · B" vs the "A·B" the spans render),
       which tripped WCAG 2.5.3 Label in Name. The concatenated span text
       already carries CVE / vendor / product / date / ransomware, so the
       visible content is the accessible name. */
    return '<a class="ed-kv" href="'+href+'" target="_blank" rel="noopener"'+attrs+
           '><span class="ed-cve">'+esc(v.cveID)+'</span><span class="ed-sep">·</span>'+
           '<span class="ed-vp">'+vp+'</span><span class="ed-sep">·</span>'+
           '<span class="ed-date">'+esc(v.dateAdded)+'</span>'+r+'</a>';
  }
  /* The CSS's own `animation:edscroll 80s linear infinite` (translateX to
     -50%) assumes a fixed content width. It isn't fixed: paint() runs once
     with the 6-item FALLBACK list, then again with up to 16 live items —
     roughly tripling the track's width. A fixed-duration animation covering
     "50% of however wide the track currently is" suddenly has ~3x the
     distance to cover in the same 80s the moment live data lands, which
     read as the ticker abruptly speeding up (and jumping, since the
     transform's % basis changes out from under an already-running
     animation). Recomputing the duration from the track's actual width
     after every paint keeps the visual speed constant regardless of how
     many items are currently in it. */
  var ED_PX_PER_SEC = 20; // matches the original 80s pace at the fallback list's width
  var ED_REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function retune(){
    /* Reduced-motion turns the ticker off entirely via a CSS
       `animation:none` rule — leave animation-name alone here so that rule
       stays in control instead of an inline style silently beating it. */
    if(ED_REDUCE) return;
    /* Only animation-name/-duration are set inline — never the `animation`
       shorthand, which would silently reset animation-play-state to
       'running' and break the :hover{animation-play-state:paused} rule
       below (an inline style always beats a class selector). */
    track.style.animationName = 'none';
    track.style.transform = 'translateX(0)';
    void track.offsetWidth; // force the reset to commit before restarting
    var dur = Math.max(20, (track.scrollWidth * 0.5) / ED_PX_PER_SEC);
    track.style.animationDuration = dur.toFixed(1) + 's';
    track.style.animationName = 'edscroll';
  }
  function paint(list){
    var h1=list.map(function(v){ return tok(v,false); }).join('');
    var h2=list.map(function(v){ return tok(v,true); }).join('');
    track.innerHTML=h1+h2;
    retune();
  }
  paint(FALLBACK);
  function load(){
    fetch(KEV).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
      var recent=d.items||[];
      if(recent.length){ paint(recent); }
      if(status) status.classList.add('ed-live');
      if(statusText) statusText.textContent='live · '+(d.count||recent.length)+' tracked';
      if(foot && d.dateReleased){ foot.textContent='Source: CISA KEV'; }
    }).catch(function(){ if(statusText) statusText.textContent='cached'; });
  }
  /* Defer the KEV fetch until the section is actually about to be seen,
     instead of firing it on every page load regardless of whether the
     visitor scrolls past the hero. The whole-catalog JSON (~1.7MB) is fetched
     and trimmed server-side by functions/api/kev.js, edge-cached 6h — this
     request only ever gets back the ~16 most recent entries. */
  if('IntersectionObserver' in window){
    var kevIo=new IntersectionObserver(function(es){
      if(es.some(function(e){ return e.isIntersecting; })){ kevIo.disconnect(); load(); }
    }, {rootMargin:'200px'});
    kevIo.observe(track.closest('.ed-kev')||track);
  } else {
    load();
  }
})();

/* Bento: signal canvas (decorative, top-left quadrant) — moved to
   /scripts/index-signal-eagle.js (own file, not inlined here) since it
   carries ~34KB of packed animation data extracted from a reference clip;
   keeping that out of this shared inline block avoids bloating every
   homepage load's HTML payload. See the script tag near the other
   decorative widgets below. */

/* ── Bento: cert badges marquee (bottom-left quadrant) — real vendor-issued badge
   artwork, self-hosted (originally hotlinked from Credly's CDN on every page
   load, which leaked visitor IPs to a third party for no runtime benefit —
   same self-hosting treatment already given to project images). ── */
(function(){
  var track=document.getElementById('ed-badges-track');
  if(!track) return;
  var BADGES=[
    {name:'Security+', img:'/images/certs/security-plus.png', framed:true},
    {name:'Network+', img:'/images/certs/network-plus.png', framed:true},
    {name:'ISC2 CC', img:'/images/certs/isc2-cc.png'},
    {name:'AWS CCP', img:'/images/certs/aws-ccp.png'},
    {name:'AZ-900', img:'/images/certs/az-900.png'},
    {name:'HTB CJCA', img:'/images/certs/htb-cjca.png'}
  ];
  function tok(b, hidden){
    return '<span class="ed-badge'+(b.framed?' ed-badge--framed':'')+'"'+(hidden?' aria-hidden="true"':'')+
           '><img loading="lazy" src="'+b.img+'" alt="'+b.name+' certification badge" onerror="this.style.visibility=\'hidden\'"><span>'+b.name+'</span></span>';
  }
  track.innerHTML=BADGES.map(function(b){ return tok(b,false); }).join('')+BADGES.map(function(b){ return tok(b,true); }).join('');
})();

/* ── Bento: threat intel (top-right quadrant) — OTX + CIRCL MISP via a same-origin
   proxy function (functions/api/threat-feed.js). Never ships a key to the browser;
   falls back to static sample rows if the endpoint 404s (e.g. local `astro dev`,
   where Cloudflare Pages Functions don't run) or the fetch fails. Each row links to
   the specific OTX pulse or MISP/CIRCL event, not just the feed in general. ── */
(function(){
  var list=document.getElementById('ed-intel-list');
  if(!list) return;
  var FALLBACK=[
    {source:'OTX',title:'Tracking a new loader chain abusing signed drivers',org:'AlienVault community',href:'https://otx.alienvault.com/'},
    {source:'MISP',title:'OSINT — infrastructure reuse across recent ransomware intrusions',org:'CIRCL',href:'https://www.circl.lu/doc/misp/feed-osint/'},
    {source:'OTX',title:'Phishing kit targeting SSO login pages spotted in the wild',org:'AlienVault community',href:'https://otx.alienvault.com/'},
    {source:'MISP',title:'OSINT — C2 framework fingerprinting update',org:'CIRCL',href:'https://www.circl.lu/doc/misp/feed-osint/'},
    {source:'OTX',title:'Cred-stuffing botnet rotating through residential proxies',org:'AlienVault community',href:'https://otx.alienvault.com/'}
  ];
  /* Attribute-safe: also escapes quotes, unlike a text-node-only escaper —
     used below to build an href="..." attribute from feed data, where a bare
     '<>&' escape would still let a stray " break out of the attribute. */
  function esc(s){ return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  /* Feed hrefs are always server-built with a fixed https:// prefix (see
     functions/api/threat-feed.js), but don't trust that blindly from the
     browser side too — reject anything that isn't actually http(s). */
  function safeHref(h){ return /^https?:\/\//i.test(h||'') ? h : '#'; }
  function paint(items){
    list.innerHTML=items.slice(0,3).map(function(it){
      var cls=(it.source||'').toLowerCase()==='otx'?'otx':'misp';
      return '<a class="ed-intel__row '+cls+'" href="'+esc(safeHref(it.href))+'" target="_blank" rel="noopener">'+
             '<span class="ed-intel__meta"><span class="src '+cls+'">'+esc(it.source)+'</span><span class="org">'+esc(it.org||'')+'</span></span>'+
             '<span class="ed-intel__title">'+esc(it.title)+'</span></a>';
    }).join('');
  }
  paint(FALLBACK);
  fetch('/api/threat-feed').then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
    if(d && Array.isArray(d.items) && d.items.length) paint(d.items);
  }).catch(function(){ /* keep fallback rows */ });
})();

/* ── Auto-defense -> Radar industries (live DDoS-share-by-industry chart) —
   this bento slot used to hold a purely decorative, non-interactive autoplay
   arcade runner (attract-mode only, never read input). Replaced with a real
   live widget: Layer 3 DDoS attack share by targeted industry over the last
   24h, from Cloudflare's own public Radar API, proxied through
   /api/radar-industries the same way every other live feed on this site is
   proxied (never fetched directly from the browser). Multiple thin lines,
   one per industry, normalized 0-100% and drawn against a light vertical
   grid — the "stock chart" shape the data actually has, not a decorative
   loop pretending to be data.
   NOTE: /api/radar-industries needs a Cloudflare API token
   (CLOUDFLARE_RADAR_API_TOKEN) that isn't provisioned yet — until it is,
   the endpoint returns an empty series list and FALLBACK below renders
   instead, same convention as every other feed on this page. ── */
(function(){
  var canvas=document.getElementById('ed-arcade-canvas');
  if(!canvas || !canvas.getContext) return;
  // .ed-arcade (this canvas's whole figure) is display:none on phones
  // (<=600px, see index.astro) — don't fetch or draw behind a hidden canvas.
  if(window.matchMedia('(max-width:600px)').matches) return;
  var lbl=document.querySelector('.ed-arcade__lbl');
  if(lbl){ lbl.textContent='Live · DDoS by industry'; lbl.title='Layer 3 DDoS attack share by targeted industry, last 24h — Cloudflare Radar'; }
  var ctx=canvas.getContext('2d');
  var W=0,H=0,DPR=Math.min(window.devicePixelRatio||1,2);
  function sizeCanvas(){
    var r=canvas.getBoundingClientRect();
    W=r.width; H=r.height;
    canvas.width=Math.max(1,Math.round(W*DPR));
    canvas.height=Math.max(1,Math.round(H*DPR));
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas, {passive:true});

  // Muted, mono-hued palette so the lines read as one coherent dataset
  // rather than a rainbow — same restrained approach as the rest of this
  // page's canvas widgets (index-signal-eagle.js, the KEV ticker dots).
  var COLORS=['rgba(226,232,244,.85)','rgba(148,178,225,.70)','rgba(120,225,170,.62)','rgba(226,180,120,.60)','rgba(200,150,220,.55)'];

  // Static, clearly-labeled placeholder shape used until the real feed
  // resolves (or if it never does — no token provisioned yet, or the
  // request fails). Same fallback-then-upgrade pattern as the KEV ticker
  // and threat-intel widgets above: paint something immediately, replace
  // it in place if /api/radar-industries returns real series.
  var FALLBACK=(function(){
    var pts=12,industries=['Gaming','Telecom','Financial Services','Gov/Public Sector'];
    return {
      timestamps:Array.from({length:pts},function(_,i){return i;}),
      series:industries.map(function(name,i){
        return {industry:name, values:Array.from({length:pts},function(_,j){
          var base=[34,26,22,18][i]||15;
          return Math.max(2, base + Math.sin(j*0.7+i)*6 + (Math.random()*4-2));
        })};
      }),
      isFallback:true,
    };
  })();

  function draw(data){
    ctx.clearRect(0,0,W,H);
    var series=(data.series||[]).slice(0,5);
    if(!series.length){
      ctx.fillStyle='rgba(226,232,244,.32)';
      ctx.font="10px 'JetBrains Mono',monospace";
      ctx.fillText('No attack data available right now', 4, H/2);
      return;
    }
    var padL=4,padR=4,padT=6,padB=16;
    var plotW=W-padL-padR, plotH=H-padT-padB;
    var maxV=0;
    series.forEach(function(s){ s.values.forEach(function(v){ if(v>maxV) maxV=v; }); });
    maxV=Math.max(maxV,1);
    var n=(series[0]&&series[0].values.length)||1;
    // Light horizontal grid — same restrained-gridline language as other
    // bento widgets on this page, not a full chart-library axis treatment.
    ctx.strokeStyle='rgba(226,232,244,.08)'; ctx.lineWidth=1;
    for(var g=0;g<=2;g++){
      var gy=padT+plotH*(g/2);
      ctx.beginPath(); ctx.moveTo(padL,gy); ctx.lineTo(padL+plotW,gy); ctx.stroke();
    }
    series.forEach(function(s,si){
      ctx.strokeStyle=COLORS[si%COLORS.length]; ctx.lineWidth=1.4;
      ctx.beginPath();
      s.values.forEach(function(v,i){
        var x=padL+(n>1? (i/(n-1))*plotW : 0);
        var y=padT+plotH-(v/maxV)*plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    });
    // Legend: top industries by their final (most recent) share.
    var legend=series.map(function(s,si){ return {name:s.industry, si:si, last:s.values[s.values.length-1]||0}; })
      .sort(function(a,b){ return b.last-a.last; });
    ctx.font="9px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    ctx.textBaseline='alphabetic';
    var lx=padL;
    legend.forEach(function(l){
      var text=l.name+' '+l.last.toFixed(0)+'%';
      ctx.fillStyle=COLORS[l.si%COLORS.length];
      ctx.fillText(text, lx, H-4);
      lx+=ctx.measureText(text).width+14;
    });
  }

  draw(FALLBACK);

  // Defer the real fetch until the widget is actually about to be seen —
  // same IntersectionObserver-gated pattern already used for the below-fold
  // canvas widgets on this page.
  function load(){
    fetch('/api/radar-industries').then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      if(Array.isArray(j.series) && j.series.length) draw(j);
    }).catch(function(){ /* keep the fallback drawn above */ });
  }
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      if(es.some(function(e){ return e.isIntersecting; })){ io.disconnect(); load(); }
    }, {rootMargin:'200px'});
    io.observe(canvas);
  } else {
    load();
  }
})();

/* ── Bento: MITRE ATT&CK technique spotlight (bottom-right quadrant) — a rotating
   card through a curated set of real, well-known Enterprise ATT&CK techniques, each
   linking to its real attack.mitre.org page. Static rather than fetched: the full
   STIX dataset is tens of MB, far too large to pull client-side for this. Pauses on
   hover/focus and respects prefers-reduced-motion (shows the first technique only). ── */
(function(){
  var mount=document.getElementById('ed-attck-mount');
  if(!mount) return;
  var ICONS={
    envelope:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    terminal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
    mask:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M3 3l18 18"/></svg>',
    key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-5-5"/></svg>',
    broadcast:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13"/></svg>',
    burst:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2l2 6 6-2-4 5 4 5-6-2-2 6-2-6-6 2 4-5-4-5 6 2z"/></svg>'
  };
  var TECHNIQUES=[
    {id:'T1566',name:'Phishing',tactic:'Initial Access',icon:'envelope',
      desc:'Malicious messages used to gain initial access or deliver payloads. Often disguised as a trusted sender to prompt a click, a login, or a risky download.'},
    {id:'T1059',name:'Command and Scripting Interpreter',tactic:'Execution',icon:'terminal',
      desc:'Executing commands through a CLI, PowerShell, or another scripting engine. A common way to run code after compromise, since interpreters are trusted and everywhere.'},
    {id:'T1547',name:'Boot or Logon Autostart Execution',tactic:'Persistence',icon:'clock',
      desc:'Configuring software to run automatically to survive reboots. Registry run keys, startup folders, and services are common places this gets abused.'},
    {id:'T1055',name:'Process Injection',tactic:'Defense Evasion',icon:'mask',
      desc:'Injecting code into another process’s memory to evade detection. Lets malicious code run under the identity of an already-trusted process.'},
    {id:'T1003',name:'OS Credential Dumping',tactic:'Credential Access',icon:'key',
      desc:'Extracting account credentials from operating system memory or storage. Often an early step toward lateral movement once a host is compromised.'},
    {id:'T1046',name:'Network Service Discovery',tactic:'Discovery',icon:'search',
      desc:'Enumerating network services to plan lateral movement. Adversaries scan for open ports and running services to map out what’s reachable next.'},
    {id:'T1071',name:'Application Layer Protocol',tactic:'Command and Control',icon:'broadcast',
      desc:'Blending command-and-control traffic into normal protocols like HTTP or DNS. This makes malicious traffic harder to spot among everyday activity.'},
    {id:'T1486',name:'Data Encrypted for Impact',tactic:'Impact',icon:'burst',
      desc:'Encrypting data to disrupt availability, as seen in ransomware. Usually the final stage of an intrusion, aimed at extortion or operational damage.'}
  ];
  mount.innerHTML='<a class="ed-attck" id="ed-attck-card" target="_blank" rel="noopener">'+
    '<span class="ed-attck__top"><span class="ed-attck__icon" id="ed-attck-icon"></span>'+
    '<span class="ed-attck__text"><span class="ed-attck__name" id="ed-attck-name"></span>'+
    '<span class="ed-attck__desc" id="ed-attck-desc"></span>'+
    '<span class="ed-attck__meta"><span class="ed-attck__tactic" id="ed-attck-tactic"></span>'+
    '<span class="ed-attck__id" id="ed-attck-id"></span></span>'+
    '</span></span></a>'+
    '<div class="ed-attck__dots" id="ed-attck-dots"></div>';
  var card=document.getElementById('ed-attck-card');
  var iconEl=document.getElementById('ed-attck-icon');
  var tacticEl=document.getElementById('ed-attck-tactic');
  var idEl=document.getElementById('ed-attck-id');
  var nameEl=document.getElementById('ed-attck-name');
  var descEl=document.getElementById('ed-attck-desc');
  var dotsWrap=document.getElementById('ed-attck-dots');
  dotsWrap.innerHTML=TECHNIQUES.map(function(t,i){ return '<button type="button" data-i="'+i+'" aria-label="'+t.name+'"></button>'; }).join('');
  var dots=dotsWrap.children;
  var idx=0;
  function show(i){
    var t=TECHNIQUES[i];
    card.href='https://attack.mitre.org/techniques/'+t.id+'/';
    iconEl.innerHTML=ICONS[t.icon]||'';
    tacticEl.textContent=t.tactic;
    idEl.textContent=t.id;
    nameEl.textContent=t.name;
    descEl.textContent=t.desc;
    for(var j=0;j<dots.length;j++){ dots[j].classList.toggle('active', j===i); }
  }
  show(0);
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timer=null;
  function start(){ if(reduced || timer) return; timer=setInterval(function(){ idx=(idx+1)%TECHNIQUES.length; show(idx); }, 4500); }
  function stop(){ if(timer){ clearInterval(timer); timer=null; } }
  start();
  var cell=mount.closest('.ed-bento__cell');
  if(cell){
    cell.addEventListener('mouseenter', stop); cell.addEventListener('mouseleave', start);
    // mouseenter/mouseleave never fire on touch, so a mobile reader would
    // otherwise have the card rotate out from under them mid-read with no
    // way to pause it — a tap on the card pauses; picking a dot below
    // already resumes rotation via the click handler further down.
    cell.addEventListener('touchstart', stop, {passive:true});
  }
  dotsWrap.addEventListener('click', function(e){
    var t=e.target.closest('[data-i]'); if(!t) return;
    idx=Number(t.getAttribute('data-i')); show(idx); stop(); start();
  });
})();
