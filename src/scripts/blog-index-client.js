/* Blog index client logic — grid render/filter/sort, "See more" category
   dialog, Threat Wire ticker, hero parallax + Lenis, and the case-study
   slide-over. Extracted from an inline <script define:vars> block so it's
   bundled/minified/cached as its own file instead of shipping unbundled
   inside every page load.
   postCards (the real MDX post cards, computed server-side in
   blog/index.astro's frontmatter) arrives via window.__POST_CARDS__, set by
   a small residual inline script right before this one loads — define:vars
   only works for is:inline scripts, not external src files. */
import { FAKE_PROJECTS } from '../data/projects.ts';
import { PRIMARY_CATS, SECONDARY_CATS, PRIMARY_CAT_LABELS } from '../data/blog-categories.ts';
import Lenis from '@studio-freight/lenis';

/* Below 760px the four primary-category tabs are display:none (see
   blog/index.astro) to keep the tab row from wrapping — they're folded
   into the "See more" dialog instead, so nothing is actually unreachable,
   just relocated. */
const compactTabs=()=>matchMedia('(max-width:760px)').matches;

const postCards = window.__POST_CARDS__ || [];
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

// Real MDX writeups merged into the same feed as the illustrative projects.
const projects = [...FAKE_PROJECTS, ...postCards];

// This blog's own subject matter is injection/XSS writeups, so a post title
// or kicker containing '<', '"', or '&' is a real (if self-inflicted) risk
// here, not just a hypothetical one — escape before splicing into innerHTML,
// same as the Threat Wire ticker's esc() further down this file.
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Posts without a cardImage/heroImage get the site's static gradient
// placeholder (same treatment as BlogPost.astro's .hero-art--placeholder)
// instead of a random unrelated photo pulled from a third-party service.
const card=(p,n,d)=>`<a href="${esc(p.href||'#')}" class="card" data-key="${esc(p.seed)}" style="transition-delay:${d}s">
  <div class="ph${p.img?'':' noimg loaded'}"><span class="num">${String(n).padStart(2,'0')}</span>${p.img?`<img loading="lazy" src="${esc(p.img)}" alt="${esc(p.name)}" onload="this.closest('.ph').classList.add('loaded')">`:''}</div>
  <div class="cmeta meta"><span>${esc(p.kick.split('·')[0].trim())}</span><span>${esc(p.year)}</span></div>
  <h3>${esc(p.name)}</h3></a>`;

const grid=document.getElementById('grid'),countEl=document.getElementById('count');
/* Filtering is multi-select across two tiers:
     - primary: the always-visible tab row (detect/otics/auth/bb)
     - secondary: the fuller domain taxonomy, tucked behind "See more" so the
       page doesn't open with 14 buttons — most would show 0 results today.
   `selected` holds category keys from either tier; empty set = All. */
let selected=new Set(),sort='latest';
function matches(p){return selected.size===0||(p.cats||[]).some(c=>selected.has(c));}
function render(){
  const firsts={};
  grid.querySelectorAll('.card').forEach(c=>firsts[c.dataset.key]=c.getBoundingClientRect());
  let list=projects.filter(matches);
  if(sort==='latest')list.sort((a,b)=>b.year-a.year);
  if(sort==='oldest')list.sort((a,b)=>a.year-b.year);
  if(sort==='az')list.sort((a,b)=>a.name.localeCompare(b.name));
  grid.innerHTML=list.length?list.map((p,i)=>card(p,i+1,0)).join(''):
    `<div class="no-results">Nothing filed under this category yet.<br><button type="button" data-clear-filters>Clear filters →</button></div>`;
  const n=String(list.length).padStart(2,'0');
  countEl.innerHTML=`Showing <b>${n}</b> of <b>${n}</b> results`;
  [...grid.querySelectorAll('.card')].forEach((c,i)=>{
    c.classList.add('in');
    const f=firsts[c.dataset.key];
    if(f&&!reduce){
      const l=c.getBoundingClientRect();
      const dx=f.left-l.left,dy=f.top-l.top;
      if(dx||dy){c.style.transition='none';c.style.transform=`translate(${dx}px,${dy}px)`;
        requestAnimationFrame(()=>{c.style.transition='transform .6s var(--e)';c.style.transform='';});}
    }else if(!f){
      c.style.opacity='0';c.style.transform='translateY(20px)';
      requestAnimationFrame(()=>{c.style.transition=`opacity .55s var(--e) ${i*0.04}s,transform .55s var(--e) ${i*0.04}s`;c.style.opacity='';c.style.transform='';});
    }
  });
  grid.querySelectorAll('.ph img').forEach(im=>{if(im.complete)im.closest('.ph').classList.add('loaded');});
}
const moreTab=document.getElementById('moreTab');
function syncTabUI(){
  document.querySelector('.tab[data-cat="all"]').classList.toggle('on',selected.size===0);
  PRIMARY_CATS.forEach(c=>{
    const b=document.querySelector(`.tab[data-cat="${c}"]`);
    if(b)b.classList.toggle('on',selected.has(c));
  });
  // On the compact (<=760px) tab row the primary buttons are hidden, so a
  // primary-category selection is otherwise invisible — count it too.
  const extra=compactTabs()?selected.size:[...selected].filter(c=>!PRIMARY_CATS.includes(c)).length;
  moreTab.textContent=extra?`See more (${extra}) →`:'See more →';
  moreTab.classList.toggle('on',extra>0);
}
addEventListener('resize',syncTabUI,{passive:true});
document.getElementById('tabs').addEventListener('click',e=>{
  const b=e.target.closest('.tab[data-cat]');if(!b)return;
  const c=b.dataset.cat;
  if(c==='all')selected.clear();
  else selected.has(c)?selected.delete(c):selected.add(c);
  syncTabUI();render();
});
document.getElementById('sort').addEventListener('change',e=>{sort=e.target.value;render();});
grid.addEventListener('click',e=>{
  if(!e.target.closest('[data-clear-filters]'))return;
  selected.clear();syncTabUI();render();
});

/* ── "See more" dialog: the secondary category grid ── */
(()=>{
  const dlg=document.getElementById('filterDialog');
  const panel=dlg.querySelector('.flt-dialog__panel');
  const pillGrid=document.getElementById('fltPills');
  let lastFocused=null;
  function buildPills(){
    // Compact tab row hides the primary buttons — fold them in here first
    // so they stay reachable instead of just disappearing on mobile.
    const cats=compactTabs()
      ?[...PRIMARY_CATS.map(k=>[k,PRIMARY_CAT_LABELS[k]]),...SECONDARY_CATS]
      :SECONDARY_CATS;
    pillGrid.innerHTML=cats.map(([key,label])=>
      `<button type="button" class="flt-pill" data-cat="${key}">${label}</button>`).join('');
  }
  buildPills();
  function syncPills(){
    pillGrid.querySelectorAll('.flt-pill').forEach(p=>p.classList.toggle('on',selected.has(p.dataset.cat)));
  }
  function focusables(){return [...panel.querySelectorAll('a[href],button')];}
  function open(){
    buildPills();
    syncPills();
    lastFocused=document.activeElement;
    dlg.setAttribute('aria-hidden','false');
    document.getElementById('fltApply').focus();
    document.addEventListener('keydown',onKeydown);
  }
  function close(){
    dlg.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown',onKeydown);
    if(lastFocused&&lastFocused.focus)lastFocused.focus();
  }
  function onKeydown(e){
    if(e.key==='Escape'){close();return;}
    if(e.key==='Tab'){
      const f=focusables();if(!f.length)return;
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  }
  moreTab.addEventListener('click',open);
  pillGrid.addEventListener('click',e=>{
    const b=e.target.closest('.flt-pill');if(!b)return;
    const c=b.dataset.cat;
    selected.has(c)?selected.delete(c):selected.add(c);
    b.classList.toggle('on');
    syncTabUI();render();
  });
  document.getElementById('fltApply').addEventListener('click',close);
  dlg.addEventListener('click',e=>{if(e.target.closest('[data-flt-close]'))close();});
})();

/* ── THREAT WIRE ──────────────────────────────────────────────────────
   Live recent-critical-CVE ticker. Source chain, first success wins:
     1. NVD API 2.0 (keyless, last 7 days, CRITICAL) — one request,
        cached in sessionStorage for an hour to respect keyless limits
     2. CIRCL cve.circl.lu (keyless, most recent CVEs)
     3. Static status pills — the wire can never render broken.
   Mechanics: items are appended, the row is measured, then cloned until
   the track spans ≥2× the view so translateX(-50%) loops seamlessly;
   duration is computed from real width for constant 55 px/s velocity. */
(()=>{
const track=document.getElementById('wireTrack');if(!track)return;
const VEL=55; // px per second — one knob for speed
const STATIC=[
  {sev:'',id:'● Open to work',tx:''},
  {sev:'',id:'OPT through 2027',tx:''},
  {sev:'',id:'Multi-SIEM · OT/ICS ML · Adaptive auth',tx:''},
  {sev:'',id:'HackerOne · 3 accepted findings',tx:''}
];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const trunc=(s,n)=>{s=String(s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trimEnd()+'…':s;};
function itemHTML(it){
  const inner=(it.sev?`<span class="sev">${esc(it.sev)}</span>`:'')+
    `<span class="wid">${esc(it.id)}</span>`+
    (it.tx?`<span class="wtx">${esc(trunc(it.tx,88))}</span>`:'');
  return it.href
    ? `<a class="wire-item" href="${esc(it.href)}" target="_blank" rel="noopener">${inner}</a>`
    : `<span class="wire-item">${inner}</span>`;
}
let LAST=null;
function mount(items){
  LAST=items;
  track.innerHTML=items.map(itemHTML).join('');
  requestAnimationFrame(()=>{
    const view=track.parentElement,vw=view.clientWidth,base=track.scrollWidth;
    if(!base)return;
    let copies=Math.max(2,Math.ceil((vw*2)/base)); // track must cover ≥2× view
    const one=track.innerHTML;
    track.innerHTML=one.repeat(copies);
    // loop travels half the track; duration = distance / velocity
    track.style.setProperty('--wire-dur',((track.scrollWidth/2)/VEL).toFixed(1)+'s');
  });
}
function fromNVD(){
  const CK='wire-nvd-v1',cached=(()=>{try{return JSON.parse(sessionStorage.getItem(CK))}catch(e){return null}})();
  if(cached&&Date.now()-cached.t<36e5)return Promise.resolve(cached.items);
  const iso=d=>d.toISOString().slice(0,-1); // NVD wants no trailing Z
  const end=new Date(),start=new Date(end-7*864e5);
  const url='https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL'+
    '&pubStartDate='+encodeURIComponent(iso(start))+'&pubEndDate='+encodeURIComponent(iso(end))+'&resultsPerPage=12';
  return fetch(url).then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{
    const items=(j.vulnerabilities||[]).map(v=>{
      const c=v.cve,m=((c.metrics||{}).cvssMetricV31||[])[0];
      const score=m&&m.cvssData?m.cvssData.baseScore.toFixed(1):'';
      const desc=((c.descriptions||[]).find(d=>d.lang==='en')||{}).value||'';
      return {sev:score?score+' CRIT':'CRIT',id:c.id,tx:desc,href:'https://nvd.nist.gov/vuln/detail/'+c.id};
    }).filter(it=>it.id);
    if(!items.length)throw 0;
    try{sessionStorage.setItem(CK,JSON.stringify({t:Date.now(),items}))}catch(e){}
    return items;
  });
}
function fromCIRCL(){
  return fetch('https://cve.circl.lu/api/last/12').then(r=>{if(!r.ok)throw 0;return r.json()}).then(list=>{
    const items=(Array.isArray(list)?list:[]).map(c=>{
      const id=c.id||c.cve_id||(c.aliases&&c.aliases[0])||'';
      const tx=c.summary||(c.containers&&c.containers.cna&&c.containers.cna.descriptions&&c.containers.cna.descriptions[0]&&c.containers.cna.descriptions[0].value)||'';
      const sc=c.cvss?Number(c.cvss).toFixed(1):'';
      return id?{sev:sc?sc+' CVSS':'NEW',id:id,tx:tx,href:'https://nvd.nist.gov/vuln/detail/'+id}:null;
    }).filter(Boolean);
    if(!items.length)throw 0;
    return items;
  });
}
track.innerHTML='<span class="wire-item skel"></span>'.repeat(6); // shimmer while the feed loads
function load(){ fromNVD().catch(fromCIRCL).catch(()=>STATIC).then(mount).catch(()=>mount(STATIC)); }
// Defer the NVD/CIRCL fetch until the wire is actually about to be seen,
// instead of firing it on every page load regardless of whether the visitor
// scrolls past the hero. Skeleton shimmer above still shows immediately.
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)){ io.disconnect(); load(); }
  },{rootMargin:'200px'});
  io.observe(track.closest('.wire')||track);
}else{
  load();
}
addEventListener('resize',(()=>{let t;return()=>{clearTimeout(t);
  t=setTimeout(()=>{if(LAST)mount(LAST);},200);};})());
})();

window.addEventListener('load',()=>{document.body.classList.add('is-loaded');render();});

const bg=document.getElementById('herobg');let sy=0,lastY=0,lenis;
const parallax=()=>{if(!reduce)bg.style.transform=`translateY(${sy*0.28}px)`;};
const onScroll=y=>{sy=y;parallax();lastY=y;};
/* header hide-on-scroll removed with the header — the ported identity +
   menu trigger stay fixed, matching the homepage.
   Lenis is now a bundled import (self-hosted) instead of a CDN <script>
   global, so no window.Lenis existence check is needed anymore. */
if(!reduce){lenis=new Lenis({lerp:.085});lenis.on('scroll',e=>onScroll(e.scroll));
  (function raf(t){lenis.raf(t);requestAnimationFrame(raf);})();}
else{addEventListener('scroll',()=>onScroll(scrollY));}

/* case study */
const cs=document.getElementById('cs');let opener=null;
function buildCase(p){
  const wrap=document.querySelector('.cs-herowrap');wrap.classList.remove('loaded');
  const hero=document.getElementById('csHero');hero.onload=()=>wrap.classList.add('loaded');
  hero.src=p.img;if(hero.complete)wrap.classList.add('loaded');
  document.getElementById('csKick').textContent=p.kick;
  document.getElementById('csName').textContent=p.name;
  document.getElementById('csLead').textContent=p.lead;
  document.getElementById('csMetrics').innerHTML=p.metrics.map(m=>`<div class="m"><div class="v" data-val="${m[0]}">${m[0]}</div><div class="k meta">${m[1]}</div></div>`).join('');
  document.getElementById('csOverview').innerHTML=p.overview.map(t=>`<p>${t}</p>`).join('');
  let side='';
  side+=`<div class="blk"><h4>Stack</h4><div class="cs-chips">${p.stack.map(s=>`<span>${s}</span>`).join('')}</div></div>`;
  if(p.attack.length)side+=`<div class="blk"><h4>ATT&CK</h4><div class="cs-chips">${p.attack.map(s=>`<span>${s}</span>`).join('')}</div></div>`;
  side+=`<div class="blk"><h4>Links</h4>${p.links.map(l=>`<a class="lk" href="${l[1]}" data-cursor="link">${l[0]}<span class="ar">↗</span></a>`).join('')}</div>`;
  document.getElementById('csSide').innerHTML=side;
}
function countUp(){
  document.querySelectorAll('#csMetrics .v').forEach(el=>{
    const raw=el.dataset.val||el.textContent;
    const m=raw.match(/^([<>~]?)([\d,]+)([%+]?)$/);
    if(!m||reduce){el.textContent=raw;return;}
    const pre=m[1],suf=m[3],target=parseInt(m[2].replace(/,/g,''),10),hasComma=m[2].includes(',');
    const t0=performance.now(),dur=850;
    (function step(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);
      const val=Math.round(target*e),s=hasComma?val.toLocaleString('en-US'):String(val);
      el.textContent=pre+s+suf;if(k<1)requestAnimationFrame(step);})(t0);
  });
}
function openCase(p,imgEl){
  buildCase(p);
  const hero=document.getElementById('csHero');hero.style.opacity=0;
  cs.style.visibility='visible';
  const last=document.querySelector('.cs-herowrap').getBoundingClientRect();
  if(reduce||!imgEl){cs.classList.add('open');requestAnimationFrame(()=>{cs.classList.add('shown');countUp();});hero.style.opacity=1;}
  else{
    const first=imgEl.getBoundingClientRect();
    const fly=document.createElement('img');fly.src=imgEl.src;fly.className='flyer';
    Object.assign(fly.style,{top:last.top+'px',left:last.left+'px',width:last.width+'px',height:last.height+'px',transformOrigin:'top left'});
    document.body.appendChild(fly);
    const sx=first.width/last.width,syc=first.height/last.height;
    fly.style.transform=`translate(${first.left-last.left}px,${first.top-last.top}px) scale(${sx},${syc})`;
    fly.getBoundingClientRect();
    cs.classList.add('open');
    requestAnimationFrame(()=>{fly.style.transition='transform .7s var(--e)';fly.style.transform='none';});
    fly.addEventListener('transitionend',()=>{hero.style.opacity=1;fly.remove();cs.classList.add('shown');countUp();},{once:true});
  }
  cs.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';if(lenis)lenis.stop();
  cs.scrollTop=0;document.getElementById('csBack').focus();
}
function closeCase(){
  cs.classList.remove('open','shown');cs.setAttribute('aria-hidden','true');
  document.body.style.overflow='';if(lenis)lenis.start();
  setTimeout(()=>{cs.style.visibility='hidden';},360);
  if(opener)opener.focus();
}
document.addEventListener('click',e=>{
  const a=e.target.closest('.card, #heroFrame');if(!a)return;
  const href=a.getAttribute('href');
  if(href && href!=='#') return; // real writeup link (post card) — let it navigate normally
  e.preventDefault();
  const key=a.dataset.key;const p=key?projects.find(x=>x.seed===key):projects[0];
  // p can be a real post (has .href) resolved as the hero's fallback item —
  // those don't have the metrics/overview/stack/links shape openCase()
  // expects, so navigate normally instead of trying to render a case study.
  if(p && p.href){ location.href=p.href; return; }
  if(!p) return;
  opener=a;openCase(p,a.querySelector('img'));
});
document.getElementById('heroFrame').addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  e.preventDefault();
  const key=e.currentTarget.dataset.key;const p=key?projects.find(x=>x.seed===key):projects[0];
  if(p && p.href){ location.href=p.href; return; }
  if(!p) return;
  opener=e.currentTarget;openCase(p,null);
});
document.getElementById('csBack').addEventListener('click',closeCase);
addEventListener('keydown',e=>{if(e.key==='Escape'&&cs.classList.contains('open'))closeCase();});

/* The Luna chat drawer's knowledge-base script (blog-luna-kb.js) jumps
   straight to a case study by seed — it needs projects/openCase, but as a
   separate module it can't see this file's top-level consts, so they're
   handed off explicitly instead of relying on the implicit-global leakage
   classic <script> tags used to get away with. */
window.projects = projects;
window.openCase = openCase;
