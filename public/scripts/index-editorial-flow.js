/* Homepage editorial-flow widget: the CISA KEV live ticker under the hero.
   Extracted from an inline <script> block. */
(function(){
  var KEV='/api/kev';
  var track=document.getElementById('ed-track');
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
    }).catch(function(){});
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

