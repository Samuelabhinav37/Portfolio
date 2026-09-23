/* Signal loaders — news + CTFs are aggregated server-side via the site's own
   Cloudflare Pages Function (functions/api/signal-feed.js) instead of a public
   CORS proxy (allorigins.win, corsproxy.io have no uptime SLA and go down
   independently of each other — same reasoning as functions/api/threat-feed.js
   for the bento panel). Podcast cover art is static, self-hosted in
   /images/podcasts/. Everything here is
   deferred until #signal is actually about to be seen. Extracted from an
   inline <script> block, unmodified. */
(function(){
  var newsHost=document.getElementById('news-list');
  var ctfHost=document.getElementById('ctf-items');

  /* These URLs come from a feed (news thumbnails) and CTFtime
     (event logos). Both get spliced into a CSS url("...") string, where an
     unescaped " or ) would let feed data inject arbitrary CSS. Only accept a
     plain http(s) URL, and additionally reject the breakout characters. */
  function safeImgUrl(u){
    u=String(u||'');
    if(!/^https?:\/\//i.test(u)) return '';
    if(/["\\\s]|[\x00-\x1f]/.test(u)) return '';   // " closes the url("...") string; the rest can't appear in a real URL
    return u;
  }
  function setBgImage(el,u){
    var s=safeImgUrl(u);
    if(s) el.style.backgroundImage='url("'+s+'")';
    return !!s;
  }

  function row(title,meta,link,img){
    var a=document.createElement('a'); a.className='news-row'; a.href=link||'#'; a.target='_blank'; a.rel='noopener';
    var b=document.createElement('span'); b.className='news-badge'; if(img&&setBgImage(b,img)){ b.classList.add('has-img'); }
    var body=document.createElement('span'); body.className='news-body';
    var t=document.createElement('span'); t.className='news-title'; t.textContent=title;
    var m=document.createElement('span'); m.className='news-meta'; m.textContent=meta;
    body.appendChild(t); body.appendChild(m); a.appendChild(b); a.appendChild(body); return a;
  }
  function newsFallback(){
    if(!newsHost) return;
    var FEEDS=[{n:'The Hacker News',site:'https://thehackernews.com'},
               {n:'BleepingComputer',site:'https://www.bleepingcomputer.com'},
               {n:'Krebs on Security',site:'https://krebsonsecurity.com'}];
    newsHost.innerHTML=''; FEEDS.forEach(function(f){ newsHost.appendChild(row(f.n, f.site.replace(/^https?:\/\//,''), f.site, '')); });
  }
  function ctfFallback(){
    if(!ctfHost) return;
    ctfHost.innerHTML='';
    var it=document.createElement('div'); it.className='ctf-item';
    var a=document.createElement('a'); a.href='https://ctftime.org/event/list/upcoming'; a.target='_blank'; a.rel='noopener'; a.style.textDecoration='none';
    var nm=document.createElement('span'); nm.className='ctf-name'; nm.textContent='CTFtime';
    var mt=document.createElement('span'); mt.className='ctf-meta'; mt.textContent='live schedule →';
    /* .ctf-name and .ctf-meta must be direct children of .ctf-item (its flex-column+gap
       CSS targets direct children only) — matching renderCtfs() below, which links just
       the name and keeps meta as a sibling, not nested inside the <a>. */
    a.appendChild(nm); it.appendChild(a); it.appendChild(mt); ctfHost.appendChild(it);
  }

  function renderNews(items){
    if(!newsHost || !items || !items.length) return newsFallback();
    newsHost.innerHTML='';
    items.forEach(function(it){ var d=it.date, ds=(d&&d>0)?' · '+new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
      newsHost.appendChild(row(it.title, it.source+ds, it.link, it.img)); });
  }
  /* Event logo, or a monogram tile when there isn't one (or /api/ctf-logo
     refuses it as oversized). The error listener is attached in JS, not as an
     onerror="" attribute, which the site's hash-based CSP would block. */
  function ctfMonogram(title){
    return String(title||'').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(function(w){ return w[0]; }).join('').toUpperCase() || 'CTF';
  }
  function ctfLogo(e){
    var box=document.createElement('span'); box.className='ctf-logo'; box.setAttribute('aria-hidden','true');
    var mono=function(){ box.textContent=ctfMonogram(e.title); };
    if(e.logo && /^[\w][\w.\-]*$/.test(e.logo)){
      var img=document.createElement('img'); img.alt=''; img.loading='lazy'; img.decoding='async'; img.width=30; img.height=30;
      img.addEventListener('error', function(){ box.innerHTML=''; mono(); });
      img.src='/api/ctf-logo?p='+encodeURIComponent(e.logo);
      box.appendChild(img);
    } else mono();
    return box;
  }
  function renderCtfs(items){
    if(!ctfHost || !items || !items.length) return ctfFallback();
    ctfHost.innerHTML='';
    items.forEach(function(e){ var d=new Date(e.start);
      var it=document.createElement('div'); it.className='ctf-item';
      var a=document.createElement('a'); a.href=e.href||'#'; a.target='_blank'; a.rel='noopener'; a.style.textDecoration='none';
      var nm=document.createElement('span'); nm.className='ctf-name'; nm.textContent=e.title;
      var mt=document.createElement('span'); mt.className='ctf-meta'; mt.textContent=e.format+' · '+d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
      a.appendChild(nm); it.appendChild(ctfLogo(e)); it.appendChild(a); it.appendChild(mt); ctfHost.appendChild(it);
    });
  }

  function loadNewsAndCtfs(){
    if(!newsHost && !ctfHost) return;
    fetch('/api/signal-feed').then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
      renderNews(d.news); renderCtfs(d.ctfs);
    }).catch(function(){ newsFallback(); ctfFallback(); });
  }

  function loadAll(){ loadNewsAndCtfs(); }
  var signalSection=document.getElementById('signal');
  if('IntersectionObserver' in window && signalSection){
    var sigIo=new IntersectionObserver(function(es){
      if(es.some(function(e){ return e.isIntersecting; })){ sigIo.disconnect(); loadAll(); }
    }, {rootMargin:'200px'});
    sigIo.observe(signalSection);
  } else {
    loadAll();
  }
})();
