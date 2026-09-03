/* Homepage editorial-flow widgets: CISA KEV live ticker, Beliefs scroll-reveal,
   cert badges marquee, threat-intel feed, decorative auto-defense arcade runner,
   and the MITRE ATT&CK technique spotlight. Extracted from an inline <script>
   block, unmodified, matching every other homepage widget already split out
   (index-signal-eagle.js, index-logo-glitch.js, etc.) — this was the one
   remaining large (~500 line) un-extracted block. */
(function(){
  var KEV='https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json';
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
      var v=(d.vulnerabilities||[]).slice();
      v.sort(function(a,b){ return (b.dateAdded||'').localeCompare(a.dateAdded||''); });
      var recent=v.slice(0,16).map(function(x){ return { cveID:x.cveID, vendorProject:x.vendorProject,
        product:x.product, dateAdded:x.dateAdded, ransom:(x.knownRansomwareCampaignUse||'').toLowerCase()==='known' }; });
      if(recent.length){ paint(recent); }
      if(status) status.classList.add('ed-live');
      if(statusText) statusText.textContent='live · '+(d.count||v.length)+' tracked';
      if(foot && d.dateReleased){ foot.textContent='Source: CISA KEV'; }
    }).catch(function(){ if(statusText) statusText.textContent='cached'; });
  }
  /* Defer the KEV fetch (whole-catalog JSON, several hundred KB) until the
     section is actually about to be seen, instead of firing it on every page
     load regardless of whether the visitor scrolls past the hero. */
  if('IntersectionObserver' in window){
    var kevIo=new IntersectionObserver(function(es){
      if(es.some(function(e){ return e.isIntersecting; })){ kevIo.disconnect(); load(); }
    }, {rootMargin:'200px'});
    kevIo.observe(track.closest('.ed-kev')||track);
  } else {
    load();
  }
})();

/* ── Beliefs copy — scroll-linked light reveal: a soft mask sweeps down the
   paragraph block as it passes through the viewport, so the text visibly
   lights up while you scroll instead of just sitting there fully visible.
   Bidirectional (dims again scrolling back up) and gated by an
   IntersectionObserver so the scroll listener only runs while the block is
   actually near the viewport. Position is derived from a cached document
   offset + scrollY rather than a fresh getBoundingClientRect() every scroll
   frame — the latter forces a synchronous layout on a page this animation-
   heavy, which is where scroll-linked effects usually go janky. ── */
(function(){
  var copy=document.querySelector('#editorial .ed-beliefs__copy');
  if(!copy) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    copy.style.setProperty('--reveal','200%');
    return;
  }
  function clamp01(n){ return Math.max(0, Math.min(1, n)); }
  var docTop=0, elHeight=0;
  function measure(){
    var r=copy.getBoundingClientRect();
    docTop=r.top + window.scrollY;
    elHeight=r.height;
  }
  measure();
  if('ResizeObserver' in window){ new ResizeObserver(measure).observe(copy); }
  else { window.addEventListener('resize', measure); }
  var ticking=false;
  function update(){
    ticking=false;
    var vh=window.innerHeight||800;
    var top=docTop - window.scrollY;
    var start=vh*0.88, end=vh*0.22;
    var span=(elHeight + (start-end)) || 1;
    var progress=clamp01((start - top) / span);
    copy.style.setProperty('--reveal', (progress*124).toFixed(2)+'%');
  }
  function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(update); } }
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){
      if(es[0].isIntersecting){
        window.addEventListener('scroll', onScroll, {passive:true});
        update();
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    }, {rootMargin:'25% 0px'});
    io.observe(copy);
  } else {
    window.addEventListener('scroll', onScroll, {passive:true});
  }
  update();
})();

/* Bento: signal canvas (decorative, top-left quadrant) — moved to
   /scripts/index-signal-eagle.js (own file, not inlined here) since it
   carries ~34KB of packed animation data extracted from a reference clip;
   keeping that out of this shared inline block avoids bloating every
   homepage load's HTML payload. See the script tag near the other
   decorative widgets below. */

/* ── Bento: cert badges marquee (bottom-left quadrant) — real vendor-issued badge
   artwork from Credly's CDN, not generic brand icons. ── */
(function(){
  var track=document.getElementById('ed-badges-track');
  if(!track) return;
  var BADGES=[
    {name:'Security+', img:'https://images.credly.com/images/d3cb5ac3-8bd2-471a-a27c-f447bf16da47/blob', framed:true},
    {name:'Network+', img:'https://images.credly.com/images/3746480e-1d97-41f8-b27a-0b798d235306/CompTIA_Network_2B.png', framed:true},
    {name:'ISC2 CC', img:'https://images.credly.com/images/2030e43f-8003-4d4b-9630-847add403c87/image.png'},
    {name:'AWS CCP', img:'https://images.credly.com/images/00634f82-b07f-4bbd-a6bb-53de397fc3a6/image.png'},
    {name:'AZ-900', img:'https://images.credly.com/images/be8fcaeb-c769-4858-b567-ffaaa73ce8cf/image.png'},
    {name:'HTB CJCA', img:'https://images.credly.com/images/95043c37-e916-4e4e-96ab-06fb66056648/blob'}
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

/* ── Auto-defense (decorative arcade runner) — a security-reskinned endless
   runner, pure attract mode: never reads input, ever. A terminal-cursor
   "agent" auto-jumps threat icons (spikes = exploits, bugs = malware).
   The AI's jump-trigger distance is a FIXED value that doesn't scale with
   the game's own speed ramp (speed increases steadily over each run) — so
   early on it dodges cleanly, and as speed climbs past what that fixed
   reaction distance can safely clear, it eventually mistimes a jump and
   "dies". That's deliberate: gives each run a natural, non-identical
   ~15-25s length before a brief "BREACH DETECTED" beat and a full reset,
   rather than running forever (boring) or looking like a hand-scripted
   loop (uncanny). Canvas-drawn (no image assets), same reasoning as the
   artifact-design guidance against hand-authored SVG path data — simple
   procedural shapes instead. ── */
(function(){
  var canvas=document.getElementById('ed-arcade-canvas');
  if(!canvas || !canvas.getContext) return;
  // .ed-arcade (this canvas's whole figure) is display:none on phones
  // (<=600px, see index.astro) — never boot the physics/game loop behind a
  // hidden canvas at all, same treatment as prefers-reduced-motion below.
  if(window.matchMedia('(max-width:600px)').matches) return;
  var ctx=canvas.getContext('2d');
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W=0,H=0,PLAY_TOP=6,PLAY_BOTTOM=0;
  /* On-screen gate: this decorative auto-play game lives near the bottom of
     the editorial bento, so its physics + canvas draw were burning frames
     the entire time a visitor was anywhere above it. Only run the loop while
     the canvas is near the viewport. */
  var _onScreen=true;
  if(!reduced && 'IntersectionObserver' in window){
    _onScreen=false;
    new IntersectionObserver(function(es){ _onScreen=es[0].isIntersecting; }, {rootMargin:'200px'}).observe(canvas);
  }

  function fit(){
    var rect=canvas.getBoundingClientRect();
    var dpr=Math.min(window.devicePixelRatio||1,2);
    W=rect.width; H=rect.height; PLAY_BOTTOM=H-6;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  var stars=[];
  function makeStars(){
    stars=[];
    for(var i=0;i<20;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1+0.4,tw:Math.random()*Math.PI*2,par:0.1+Math.random()*0.12});
  }
  fit();
  makeStars();
  var fitT=null;
  addEventListener('resize',function(){ clearTimeout(fitT); fitT=setTimeout(function(){ fit(); makeStars(); },150); },{passive:true});

  // ── physics/state ── free flight, not a ground-runner: gravity pulls the
  // probe down continuously, small rate-limited "boosts" (flappy-bird taps)
  // eases smoothly toward wherever it needs to be next — maneuvering
  // thrusters, not a bird's wingbeat, so no gravity/discrete impulses.
  // When nothing's ahead it glides on a slow idle sine drift instead of
  // sitting dead still. The AI's reaction distance + ease rate are FIXED
  // and don't scale with the speed ramp below — same difficulty philosophy
  // as before: early on there's plenty of time to smoothly reach the next
  // gap/gate, and as speed climbs the correction window shrinks below what
  // the fixed ease rate can cover in time, producing a natural ~15-25s run
  // before a miss, not a hard cutoff.
  var EASE_RATE=0.075, IDLE_AMP=16, IDLE_FREQ=0.0011, BASE_SPEED=1.1, SPEED_RAMP=0.00009;
  var SHIP_X=24, SHIP_W=16, SHIP_H=11;
  var TRIGGER_DIST=130; // fixed on purpose
  var shipY, vy, speed, obstacles, phase, phaseT, particles, tAccum;

  function reset(){
    shipY=H/2; vy=0; speed=BASE_SPEED;
    obstacles=[]; particles=[]; phase='run'; phaseT=0; tAccum=0;
    scheduleNext(true);
  }
  var nextSpawnAt=0, distSince=0;
  function scheduleNext(first){ nextSpawnAt=distSince+230+Math.random()*190+(first?70:0); }
  function spawn(){
    // 'gate' — a checkpoint frame the probe threads through; its opening
    // starts wide (GATE_OPEN) and narrows toward GATE_CLOSE as it crosses
    // the tile, the "slowly closing" effect — computed from spawnX/x each
    // frame, not animated on its own timer, so it stays in sync if the tab
    // was backgrounded and time jumped.
    // 'asteroid' — jagged debris (points fixed once at spawn so its
    // silhouette doesn't jitter) that slowly bobs up/down as it drifts by.
    var kind=Math.random()<0.42?'gate':'asteroid';
    if(kind==='gate'){
      var gapY=PLAY_TOP+30+Math.random()*Math.max(10,(PLAY_BOTTOM-PLAY_TOP-60));
      obstacles.push({x:W+10,spawnX:W+10,kind:kind,w:7,gapY:gapY,openH:46,closeH:24});
    } else {
      var w=13+Math.random()*5,h=11+Math.random()*5,n=6,pts=[];
      for(var k=0;k<n;k++) pts.push({a:(k/n)*Math.PI*2,r:0.68+Math.random()*0.32});
      var baseY=PLAY_TOP+16+Math.random()*Math.max(10,(PLAY_BOTTOM-PLAY_TOP-32));
      obstacles.push({x:W+10,kind:kind,w:w,h:h,pts:pts,baseY:baseY,amp:7+Math.random()*7,freq:0.0009+Math.random()*0.0007,ph0:Math.random()*Math.PI*2,curY:baseY});
    }
  }
  function explode(x,y){
    particles=[];
    for(var i=0;i<9;i++){
      var ang=Math.random()*Math.PI*2, spd=1+Math.random()*2.4;
      particles.push({x:x,y:y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:1});
    }
  }

  function nearestAhead(){
    var best=null;
    for(var i=0;i<obstacles.length;i++){
      var o=obstacles[i];
      if(o.x+o.w>=SHIP_X && (!best || o.x<best.x)) best=o;
    }
    return best;
  }
  function gateGapH(o){
    var prog=1-((o.x-SHIP_X)/Math.max(1,(o.spawnX-SHIP_X)));
    prog=Math.max(0,Math.min(1,prog));
    return o.openH+(o.closeH-o.openH)*prog;
  }
  function pickTarget(o){
    if(o.kind==='gate') return o.gapY;
    var above=Math.max(PLAY_TOP+6,o.curY-o.h/2-13), below=Math.min(PLAY_BOTTOM-6,o.curY+o.h/2+13);
    return Math.abs(shipY-above)<=Math.abs(shipY-below)?above:below;
  }

  function update(dt){
    var k=dt/16.67;
    if(phase==='over'){
      phaseT+=dt;
      for(var p=0;p<particles.length;p++){ particles[p].x+=particles[p].vx*k; particles[p].y+=particles[p].vy*k; particles[p].life-=dt/450; }
      if(phaseT>1300) reset();
      return;
    }
    tAccum+=dt;
    speed+=SPEED_RAMP*dt;
    distSince+=speed*k;

    // spawn
    if(distSince>=nextSpawnAt){ spawn(); scheduleNext(false); }

    // move + cull obstacles, update asteroid bob, drift starfield (parallax)
    for(var i=obstacles.length-1;i>=0;i--){
      var o=obstacles[i]; o.x-=speed*k;
      if(o.kind==='asteroid') o.curY=o.baseY+Math.sin(tAccum*o.freq+o.ph0)*o.amp;
      if(o.x+o.w<0) obstacles.splice(i,1);
    }
    for(var s=0;s<stars.length;s++){
      stars[s].x-=speed*stars[s].par*k;
      if(stars[s].x<-2){ stars[s].x=W+2; stars[s].y=Math.random()*H; }
    }

    // AI: fixed reaction distance, smooth ease toward the target — see file
    // comment. No obstacle ahead → drift on a slow idle sine instead of
    // holding still, so it still reads as "flying" between hazards.
    var n=nearestAhead(), desiredY;
    if(n && (n.x-SHIP_X)<=TRIGGER_DIST){
      desiredY=pickTarget(n);
    } else {
      desiredY=H/2+Math.sin(tAccum*IDLE_FREQ)*IDLE_AMP;
    }
    var prevY=shipY;
    shipY+=(desiredY-shipY)*Math.min(1,EASE_RATE*k);
    if(shipY<PLAY_TOP) shipY=PLAY_TOP;
    if(shipY>PLAY_BOTTOM-SHIP_H) shipY=PLAY_BOTTOM-SHIP_H;
    vy=(shipY-prevY)/k; // derived from actual motion, purely for the hull-tilt/thruster visual below

    // collision
    for(var j=0;j<obstacles.length;j++){
      var ob=obstacles[j];
      if(ob.kind==='gate'){
        if(ob.x<SHIP_X+SHIP_W-3 && ob.x+ob.w>SHIP_X+3){
          var gh=gateGapH(ob), top=ob.gapY-gh/2, bot=ob.gapY+gh/2;
          var shipCenter=shipY+SHIP_H/2;
          if(shipCenter-4<top || shipCenter+4>bot){ explode(SHIP_X+SHIP_W/2,shipY+SHIP_H/2); phase='over'; phaseT=0; break; }
        }
      } else {
        var rx=SHIP_X+3,rw=SHIP_W-6,ry=shipY+2,rh=SHIP_H-2;
        var ox=ob.x+2,ow=ob.w-4,oy=ob.curY-ob.h/2+1,oh=ob.h-2;
        if(rx<ox+ow && rx+rw>ox && ry<oy+oh && ry+rh>oy){ explode(SHIP_X+SHIP_W/2,shipY+SHIP_H/2); phase='over'; phaseT=0; break; }
      }
    }

  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // faint scattered starfield — open space, no ground/horizon
    for(var s=0;s<stars.length;s++){
      var st=stars[s], tw=0.5+0.5*Math.sin(tAccum*0.0016+st.tw);
      ctx.fillStyle='rgba(237,237,238,'+(0.12+0.22*tw).toFixed(2)+')';
      ctx.fillRect(st.x,st.y,st.r,st.r);
    }

    // obstacles
    for(var i=0;i<obstacles.length;i++){
      var o=obstacles[i];
      if(o.kind==='gate'){
        var gh=gateGapH(o), top=o.gapY-gh/2, bot=o.gapY+gh/2;
        ctx.strokeStyle='rgba(237,237,238,.8)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(o.x,PLAY_TOP-4); ctx.lineTo(o.x,top); ctx.moveTo(o.x+o.w,PLAY_TOP-4); ctx.lineTo(o.x+o.w,top); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x,bot); ctx.lineTo(o.x,PLAY_BOTTOM+4); ctx.moveTo(o.x+o.w,bot); ctx.lineTo(o.x+o.w,PLAY_BOTTOM+4); ctx.stroke();
        ctx.strokeStyle='rgba(237,237,238,.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(o.x,top); ctx.lineTo(o.x+o.w,top); ctx.moveTo(o.x,bot); ctx.lineTo(o.x+o.w,bot); ctx.stroke();
      } else {
        var cx=o.x+o.w/2, cy=o.curY;
        ctx.fillStyle='rgba(156,156,162,.82)';
        ctx.beginPath();
        for(var pi=0;pi<o.pts.length;pi++){
          var pt=o.pts[pi], px=cx+Math.cos(pt.a)*pt.r*o.w/2, py=cy+Math.sin(pt.a)*pt.r*o.h/2;
          if(pi===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
      }
    }

    // probe: a small triangular hull that pitches with vertical velocity,
    // a fading thruster flame behind it (flicker via a light random jitter),
    // and a "cockpit" dot — black and white throughout, no accent color,
    // same restrained mono palette as everywhere else on the page.
    if(phase!=='over'){
      var cx=SHIP_X+SHIP_W/2, cy=shipY+SHIP_H/2;
      var tilt=Math.max(-0.5,Math.min(0.5,-vy*0.09));
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(tilt);
      var flick=0.65+Math.random()*0.35, flameLen=9*flick;
      var grd=ctx.createLinearGradient(-SHIP_W/2-flameLen,0,-SHIP_W/2,0);
      grd.addColorStop(0,'rgba(237,237,238,0)'); grd.addColorStop(1,'rgba(237,237,238,.8)');
      ctx.fillStyle=grd;
      ctx.beginPath(); ctx.moveTo(-SHIP_W/2,-2.5); ctx.lineTo(-SHIP_W/2-flameLen,0); ctx.lineTo(-SHIP_W/2,2.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ededee';
      ctx.beginPath(); ctx.moveTo(SHIP_W/2,0); ctx.lineTo(-SHIP_W/2,-SHIP_H/2); ctx.lineTo(-SHIP_W/2,SHIP_H/2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(237,237,238,.9)';
      ctx.beginPath(); ctx.arc(SHIP_W/6,0,1.6,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }

    if(phase==='over'){
      ctx.fillStyle='rgba(4,4,10,.6)'; ctx.fillRect(0,0,W,H);
      for(var p=0;p<particles.length;p++){
        var pt=particles[p]; if(pt.life<=0) continue;
        ctx.fillStyle='rgba(237,237,238,'+Math.max(0,pt.life*0.85).toFixed(2)+')';
        ctx.beginPath(); ctx.arc(pt.x,pt.y,1.6,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#ededee'; ctx.font="11px 'JetBrains Mono',monospace"; ctx.textAlign='center';
      ctx.fillText('BREACH DETECTED — RESETTING…', W/2, H/2+4);
      ctx.textAlign='left';
    }
  }

  if(reduced){
    reset(); draw(); // one static frame, no loop — respects prefers-reduced-motion
    return;
  }

  reset();
  var last=0;
  function loop(t){
    requestAnimationFrame(loop);
    if(document.hidden || !_onScreen){ last=0; return; }
    if(!last) last=t;
    var dt=Math.min(t-last,50); last=t;
    update(dt); draw();
  }
  requestAnimationFrame(loop);
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
