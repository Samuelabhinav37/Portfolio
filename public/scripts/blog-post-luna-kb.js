/* Luna chat KB + drawer engine for individual blog post pages. Extracted from
   Luna.astro's inline <script id="ldw-engine"> block — mirrors the extraction
   already done for about/contact/index (about-luna-kb.js, contact-luna-kb.js,
   index-luna-kb.js) and blog/index (src/scripts/blog-luna-kb.js). This is the
   one remaining un-extracted copy of this pattern. Reads
   window.SITE.__LUNA_POST, set by a tiny define:vars script Luna.astro still
   keeps inline (it needs the per-post Astro prop value, same technique the
   other 4 pages already use for their own page-specific data).

   One behavior change made during this extraction: the drawer's status-poll
   setInterval(refreshStatus,400) used to run for the entire page lifetime
   from first load. It now only runs while the drawer is actually open
   (started in openD(), cleared in closeD()) — same fix already applied to
   the shared luna-drawer-core.js engine used by the other 4 pages. */
const LP = window.SITE.__LUNA_POST || {};
const LP_faqs = LP.faqs || [];
const LP_headings = LP.headings || [];
const LP_category = LP.category || 'this topic';
const LP_categoryLower = LP_category.toLowerCase();
const LP_tagWords = (LP.tags || []).concat(LP.mitre || []);

function lunaSlugKeywords(text){
  return String(text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>3);
}
/* FAQ answers may contain inline HTML (code/link chips) meant for the
   visible on-page FAQ accordion, which renders it as markup. The chat
   bubble here deliberately renders replies via textContent (safe-by-
   default), so strip tags down to plain text first. */
function lunaStripHtml(html){
  return String(html||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
}

const KB = [];

KB.push({ id:'overview', title:'What happened',
  keywords:['what happened','summary','tldr','tl;dr','overview','what is this post about','what is this about']
    .concat(lunaSlugKeywords(LP.title)).concat(LP_tagWords.map(t=>String(t).toLowerCase())),
  reply: LP.description || ('This post is about ' + LP_categoryLower + '.'),
  detail: null,
  target:{type:'scroll', value:'#main-content'} });

LP_faqs.forEach(function(f, i){
  KB.push({ id:'faq-'+i, title:f.q,
    keywords: lunaSlugKeywords(f.q).concat([String(f.q).toLowerCase()]),
    reply: lunaStripHtml(f.a),
    detail: null,
    target: null });
});

LP_headings.forEach(function(h){
  KB.push({ id:'h-'+h.slug, title:h.text,
    keywords: lunaSlugKeywords(h.text).concat([String(h.text).toLowerCase()]),
    reply: "Let me take you to the '" + h.text + "' section.",
    detail: null,
    target:{type:'scroll', value:'#'+h.slug} });
});

KB.push({ id:'more', title:'More stories',
  keywords:['other posts','more stories','related','read next','other articles','more writing','what else'],
  reply:"There's more further down this page under 'more stories' — worth a look if this one was useful.",
  detail:null,
  target:{type:'scroll', value:'#more-stories'} });

KB.push({ id:'author', title:'The author',
  keywords:['who wrote','author','samuel','who are you','byline'],
  reply:"This one's by Samuel Abhinav.",
  detail:null,
  target:null });

KB.push({ id:'greeting', title:'Say hi',
  keywords:['hi','hey','hello','yo','luna','who are you','what are you','greetings'],
  reply:"I'm Luna. Ask me about " + LP_categoryLower + " in this post, or just tell me where you want to jump to.",
  detail:"I match what you ask against this post's actual content and take you straight to the right section.",
  target:null });

const DEFAULT_GUESS_IDS = ['overview'].concat(LP_faqs.slice(0,2).map(function(_,i){ return 'faq-'+i; })).concat(['more']);
const byId = id => KB.find(t=>t.id===id);

/* ───────── keyword matcher (the offline brain) ───────── */
const KeywordEngine = (() => {
  const MATCH_MIN = 3;
  const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9&\s-]/g,' ').replace(/\s+/g,' ').trim();
  const toks = s => norm(s).split(' ').filter(Boolean);
  function lev(a,b){
    if(Math.abs(a.length-b.length)>1) return 2;
    const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);
    for(let j=0;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    return d[m][n];
  }
  function score(query, topic){
    const q=' '+norm(query)+' ', qt=toks(query); let s=0;
    for(const raw of topic.keywords){
      const k=norm(raw); if(!k) continue;
      if(k.includes(' ')||k.includes('-')){ if(q.includes(' '+k+' ')) s += 3 + k.split(/[\s-]/).length; }
      else for(const t of qt){
        if(t===k) s+=3;
        else if(t.length>3 && k.length>3 && (t.startsWith(k)||k.startsWith(t))) s+=1;
        else if(t.length>3 && k.length>3 && lev(t,k)===1) s+=1;
      }
    }
    return s;
  }
  function retrieve(query){
    if(!norm(query)) return null;
    const ranked = KB.map(t=>({t,s:score(query,t)})).sort((a,b)=>b.s-a.s);
    return ranked[0] && ranked[0].s>0 ? ranked[0] : null;
  }
  async function answer(query, onToken, lastCiteId){
    const FOLLOWUP=/^(how (does|do) (it|that|this) work|how it works?|tell me more|more|details?|why|explain( that| this| it)?|go on|what else|and\??|elaborate)$/;
    const nq=norm(query);
    if(lastCiteId && FOLLOWUP.test(nq)){
      const t=byId(lastCiteId);
      if(t){
        const reply=t.detail||t.reply;
        onToken && onToken(reply, true);
        return { grounded:true, reply, citeId:t.id, target:t.target, signals:null,
                 engine:'keyword', followup:true };
      }
    }
    const best = retrieve(query);
    if(best && best.s>=MATCH_MIN){
      onToken && onToken(best.t.reply, true);
      return { grounded:true, reply:best.t.reply, citeId:best.t.id, target:best.t.target,
               signals:best.s, engine:'keyword' };
    }
    const ranked = KB.map(t=>({t,s:score(query,t)})).sort((a,b)=>b.s-a.s);
    let pool = ranked.filter(r=>r.s>0).slice(0,3).map(r=>r.t);
    if(!pool.length) pool = DEFAULT_GUESS_IDS.map(byId);
    const reply = "Hmm, I don't have a note on that one. Did you mean:";
    onToken && onToken(reply, true);
    return { grounded:false, reply, guesses:pool.map(t=>({id:t.id,label:t.title})),
             signals:best?best.s:0, engine:'keyword' };
  }
  function topic(id){ const t=byId(id); return t
    ? { grounded:true, reply:t.reply, citeId:t.id, target:t.target, signals:null, engine:'keyword' }
    : answer(id); }
  return { answer, topic, retrieve, ready:()=>true, status:()=>'ready' };
})();

/* ───────── grounding prompt (feeds the trained LLM, if/when wired up) ───────── */
function buildSystemPrompt(){
  const lines = KB.filter(t=>t.id!=='greeting').map(t =>
    '- ['+t.id+'] '+t.title+': '+t.reply);
  return [
    "You are Luna, a terse, warm assistant helping a reader navigate this blog post.",
    "Answer ONLY from the archive below, in 1-2 sentences, in a calm lowercase machine voice.",
    "After your answer, on a new line, cite the single most relevant section as [[cite: <id>]].",
    "If the question isn't covered by the archive, reply exactly: UNKNOWN",
    "",
    "ARCHIVE (allowed cite ids in brackets):",
    lines.join('\n')
  ].join('\n');
}
function parseCitation(text){
  const m = text.match(/\[\[cite:\s*([a-z]+)\s*\]\]/i);
  const id = m ? m[1].toLowerCase() : null;
  const clean = text.replace(/\[\[cite:[^\]]*\]\]/ig,'').trim();
  return { id, clean };
}

/* ───────── LLM engine (in-browser WebLLM) ─────────
   As in the source this was adapted from: model weights can't be downloaded
   in this sandbox, so a labelled MockLLM runs instead. It produces a
   grounded, streamed, citation-tagged answer so the whole pipeline (status,
   streaming, fallback, cite→jump) is real and swap-ready. Set USE_REAL_LLM
   true and drop in a model id/URL to go live — no other code needs to change. */
const LLMEngine = (() => {
  const USE_REAL_LLM = false;
  const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
  let engine=null, status='idle', progress=0, sys=buildSystemPrompt();
  const webgpuOK = () => (typeof navigator!=='undefined' && 'gpu' in navigator);
  async function load(onProgress){
    if(status==='ready'||status==='warming') return;
    if(USE_REAL_LLM && !webgpuOK()){ status='unsupported'; return; }
    status='warming';
    try{
      if(!USE_REAL_LLM){
        for(let p=0;p<=1;p+=0.08){ progress=p; onProgress && onProgress(p); await sleep(90); }
      }
      status='ready';
    }catch(e){ console.error('LLM load failed',e); status='error'; }
  }
  async function answer(query, onToken, lastCiteId){
    if(status!=='ready') throw new Error('llm-not-ready');
    const raw = await mockGenerate(query, onToken, lastCiteId);
    if(/^\s*UNKNOWN\s*$/i.test(parseCitation(raw).clean)) throw new Error('llm-unknown');
    const { id, clean } = parseCitation(raw);
    const t = id ? byId(id) : null;
    return { grounded:true, reply:clean, citeId:t?t.id:null, target:t?t.target:null,
             signals:null, engine:'llm' };
  }
  async function mockGenerate(query, onToken, lastCiteId){
    const FOLLOWUP=/^(how (does|do) (it|that|this) work|how it works?|tell me more|more|details?|why|explain( that| this| it)?|go on|what else|and\??|elaborate)$/;
    const nq=(query||'').toLowerCase().trim();
    let t=null, useDetail=false;
    if(lastCiteId && FOLLOWUP.test(nq)){ t=byId(lastCiteId); useDetail=true; }
    if(!t){ const hit=KeywordEngine.retrieve(query); if(!hit||hit.s<2) return 'UNKNOWN'; t=hit.t; }
    const body = (useDetail && t.detail) ? t.detail : t.reply;
    for(let i=0;i<=body.length;i+=2){ onToken && onToken(body.slice(0,i), false); await sleep(12); }
    onToken && onToken(body, false);
    return body + '\n[[cite: '+t.id+']]';
  }
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  return { load, answer, ready:()=>status==='ready', status:()=>status, progress:()=>progress, webgpuOK };
})();

/* ───────── router: LLM-if-ready, else keyword; fallback on error ───────── */
const Router = (() => {
  let mode='auto', lastCiteId=null;
  function setMode(m){ mode=m; }
  function activeStatus(){
    if(mode==='keyword') return 'offline';
    if(mode==='warming') return 'warming';
    if(mode==='llm')     return 'online';
    const s=LLMEngine.status();
    if(s==='ready')   return 'online';
    if(s==='warming') return 'warming';
    return 'offline';
  }
  async function answer(query, onToken){
    const useLLM = (mode==='llm') || (mode==='auto' && LLMEngine.ready());
    let result;
    if(useLLM){
      try{ result = await LLMEngine.answer(query, onToken, lastCiteId); }
      catch(e){ /* llm-unknown or error: fall through to keyword */ }
    }
    if(!result) result = await KeywordEngine.answer(query, onToken, lastCiteId);
    if(result.grounded && result.citeId) lastCiteId = result.citeId;
    return result;
  }
  function topic(id){ const r=KeywordEngine.topic(id); if(r.citeId) lastCiteId=r.citeId; return r; }
  return { answer, topic, setMode, activeStatus, getMode:()=>mode };
})();

/* related topics for the follow-up chips — each entry relates to the next
   2 topics in KB order (wrapping), since KB is now built per-post rather
   than a fixed hand-tuned set of ids. */
const RELATED = {};
KB.forEach(function(entry, i){
  const others = [];
  for (let o = 1; o <= 2; o++){
    const idx = (i + o) % KB.length;
    if (idx !== i) others.push(KB[idx].id);
  }
  RELATED[entry.id] = others;
});

/* ═══════════ DRAWER (site integration — namespaced, opens on pill/creature click) ═══════════ */
(() => {
  const $=id=>document.getElementById(id);
  const drawer=$('ldw-drawer'), scrim=$('ldw-scrim'), ask=$('ldw-ask'), send=$('ldw-send'),
        thread=$('ldw-thread'), dbody=$('ldw-dbody'), chips=$('ldw-chips'), identity=$('ldw-identity'),
        head=drawer.querySelector('.ldw-head'), statusEl=$('ldw-status'),
        avatarEl=$('ldw-avatar'), pillBtn=$('luna-pill');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let open=false, busy=false, lunaBlobURL=null, lastFocused=null;

  /* live Luna in the avatar — same document as the corner companion,
     lazy-mounted so it only runs while the drawer is open */
  let avatarWin=null, avatarIdleT=null;
  const GENTLE=['blink','wink','nod','wiggle','stretch','yawn'];
  function sendAvatarAction(name){ try{ avatarWin && avatarWin.postMessage({type:'lunaAction',name:name}, location.origin); }catch(e){} }
  function startAvatarIdle(){
    clearTimeout(avatarIdleT);
    const loop=()=>{ sendAvatarAction(GENTLE[Math.floor(Math.random()*GENTLE.length)]);
                     avatarIdleT=setTimeout(loop, 5000+Math.random()*4500); };
    avatarIdleT=setTimeout(loop, 4000+Math.random()*3000);
  }
  function stopAvatarIdle(){ clearTimeout(avatarIdleT); avatarIdleT=null; avatarWin=null; }
  function mountLuna(){
    if(!avatarEl || avatarEl.firstChild) return;
    try{
      const html=window.SITE.__LUNA_HTML; if(!html) return;
      lunaBlobURL=URL.createObjectURL(new Blob([html],{type:'text/html'}));
      const fr=document.createElement('iframe');
      fr.setAttribute('tabindex','-1'); fr.setAttribute('scrolling','no'); fr.setAttribute('aria-hidden','true');
      fr.setAttribute('title','Luna'); fr.setAttribute('sandbox','allow-scripts allow-same-origin');
      fr.addEventListener('load', ()=>{ avatarWin=fr.contentWindow;
        setTimeout(()=>sendAvatarAction('wave'), 550);
        startAvatarIdle();
      }, {once:true});
      fr.src=lunaBlobURL; avatarEl.appendChild(fr);
    }catch(e){ console.error('luna avatar mount failed',e); }
  }
  function unmountLuna(){
    stopAvatarIdle();
    if(avatarEl) avatarEl.innerHTML='';
    if(lunaBlobURL){ try{ URL.revokeObjectURL(lunaBlobURL); }catch(_){} lunaBlobURL=null; }
  }

  /* typewriter placeholder — cycles example prompts into the search bar */
  const TW = LP_faqs.slice(0,3).map(function(f){ return f.q; });
  while (TW.length < 2) TW.push('who wrote this?');
  let twI=0,twJ=0,twDel=false,twTimer=null,twOn=false;
  function twStep(){
    if(!twOn) return;
    const word=TW[twI]; twJ+=twDel?-1:1;
    ask.setAttribute('placeholder', word.slice(0,twJ)+'█');
    let d=twDel?38:70;
    if(!twDel&&twJ===word.length){ twDel=true; d=1500; }
    else if(twDel&&twJ===0){ twDel=false; twI=(twI+1)%TW.length; d=250; }
    twTimer=setTimeout(twStep,d);
  }
  function startTypewriter(){ if(twOn||document.activeElement===ask||ask.value||drawer.classList.contains('ldw-compact')) return; twOn=true; twI=0;twJ=0;twDel=false; twStep(); }
  function stopTypewriter(){ twOn=false; clearTimeout(twTimer); ask.setAttribute('placeholder','ask, search, or explain…'); }
  ask.addEventListener('focus',stopTypewriter);
  ask.addEventListener('blur',()=>{ if(!ask.value && !drawer.classList.contains('ldw-compact')) startTypewriter(); });

  function refreshStatus(){
    const st=Router.activeStatus();
    head.classList.remove('ldw-warming','ldw-offline','ldw-online');
    head.classList.add('ldw-'+st);
    statusEl.textContent = st==='online'?'online':st==='warming'?('warming · '+Math.round(LLMEngine.progress()*100)+'%'):'offline mode';
  }
  refreshStatus();
  let statusTimer=null; // only ticks while the drawer is actually open — see openD/closeD

  /* ── Accessibility: focus moves into the dialog on open and returns to
     whatever opened it on close; Tab is trapped inside while open. ── */
  function focusableEls(){
    return Array.prototype.slice.call(
      drawer.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
    ).filter(el => el.offsetParent !== null);
  }
  function trapTab(e){
    if(e.key!=='Tab' || !open) return;
    const els=focusableEls(); if(!els.length) return;
    const first=els[0], last=els[els.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }

  function openD(){ if(open)return; open=true;
    window.SITE.__lunaEverOpened = true;   // stop the corner quip's periodic nudges once she's actually been used
    /* Clicking the (non-focusable) quip bubble or creature leaves
       document.activeElement on <body> — focusing that on close is a
       silent no-op, so fall back to the pill trigger in that case. */
    lastFocused = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement : pillBtn;
    drawer.classList.add('on'); scrim.classList.add('on');
    document.body.classList.add('ldw-drawer-open'); drawer.setAttribute('aria-hidden','false');
    if(pillBtn) pillBtn.setAttribute('aria-expanded','true');
    mountLuna(); startTypewriter();
    statusTimer=setInterval(refreshStatus,400);
    setTimeout(()=>{ $('ldw-close').focus(); }, reduce?0:80);
    if(Router.getMode()==='auto') LLMEngine.load(()=>refreshStatus()); }
  function closeD(){ if(!open)return; open=false; drawer.classList.remove('on'); scrim.classList.remove('on');
    document.body.classList.remove('ldw-drawer-open'); drawer.setAttribute('aria-hidden','true'); ask.blur();
    if(pillBtn) pillBtn.setAttribute('aria-expanded','false');
    clearInterval(statusTimer); statusTimer=null;
    setTimeout(unmountLuna, reduce?0:650); stopTypewriter();
    (lastFocused||pillBtn)&&(lastFocused||pillBtn).focus(); }

  // OPEN PATH: Luna lives in an iframe; her document posts this on click/tap.
  addEventListener('message', e=>{ if(e.origin===location.origin && e.data && e.data.type==='lunaOpenChat') open?closeD():openD(); });
  addEventListener('keydown', e=>{
    if(e.key==='Escape' && open) closeD();
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='l'){ e.preventDefault(); open?ask.focus():openD(); }
    trapTab(e);
  });
  $('ldw-close').addEventListener('click',closeD);
  scrim.addEventListener('click',closeD);

  const arm=()=>send.classList.toggle('on',ask.value.trim().length>0);
  ask.addEventListener('input',arm);

  function bubble(role){ const el=document.createElement('div'); el.className='ldw-msg ldw-'+role;
    thread.appendChild(el); dbody.scrollTop=dbody.scrollHeight; return el; }

  /* jump target resolution (scroll → anchor, url → new tab) */
  function navigate(target){
    if(!target) return null;
    if(target.type==='scroll'){ const n=document.querySelector(target.value);
      return n?{label:'Take me there',run:()=>{closeD();n.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});}}:null; }
    if(target.type==='url') return {label:'Open '+target.value.replace(/^https?:\/\//,''),run:()=>window.open(target.value,'_blank','noopener')};
    return null;
  }

  function decorate(el,result){
    if(result.grounded){
      const r=document.createElement('div'); r.className='ldw-readout';
      r.innerHTML = result.engine==='llm'
        ? '<span class="ldw-tick">◇</span> inferred · '+(result.citeId||'archive')+' · luna'
        : '<span class="ldw-tick">▸</span> matched · '+result.citeId+(result.signals!=null?(' · '+result.signals+' signal'+(result.signals===1?'':'s')):'');
      el.appendChild(r);
      const nav=navigate(result.target);
      if(nav){ const g=document.createElement('div'); g.className='ldw-goto';
        const b=document.createElement('button'); b.textContent='→ '+nav.label; b.onclick=nav.run; g.appendChild(b); el.appendChild(g); }
      if(result.citeId){
        const fu=document.createElement('div'); fu.className='ldw-followups';
        const t=KB.find(k=>k.id===result.citeId);
        if(t && t.detail){
          const more=document.createElement('button'); more.className='ldw-fu';
          more.innerHTML='<span class="ldw-plus">+</span>tell me more';
          more.onclick=()=>query('tell me more'); fu.appendChild(more);
        }
        (RELATED[result.citeId]||[]).slice(0,2).forEach(rid=>{
          const rt=KB.find(k=>k.id===rid); if(!rt) return;
          const b=document.createElement('button'); b.className='ldw-fu';
          b.innerHTML='<span class="ldw-plus">+</span>'+rt.title.toLowerCase();
          b.onclick=()=>query(rt.keywords[0]); fu.appendChild(b);
        });
        if(fu.children.length) el.appendChild(fu);
      }
    } else if(result.guesses){
      const wrap=document.createElement('div'); wrap.className='ldw-guesses';
      result.guesses.forEach(gs=>{ const b=document.createElement('button');
        b.textContent=gs.label;
        b.onclick=()=>surface(Router.topic(gs.id)); wrap.appendChild(b); });
      el.appendChild(wrap);
    }
    dbody.scrollTop=dbody.scrollHeight;
  }

  async function query(text){
    if(!text.trim()||busy) return; busy=true;
    drawer.classList.add('ldw-compact'); chips.classList.add('ldw-hide'); stopTypewriter();
    bubble('you').textContent=text; ask.value=''; arm();
    const el=bubble('luna'), txt=document.createElement('span'); el.appendChild(txt);
    const onToken=p=>{ txt.textContent=p; dbody.scrollTop=dbody.scrollHeight; };
    try{ const result=await Router.answer(text,onToken); txt.textContent=result.reply; decorate(el,result);
         sendAvatarAction(result.grounded?'nod':'wiggle'); }
    catch(err){ console.error('luna query failed',err); txt.textContent='Signal dropped mid-answer. Ask me again?';
      const r=document.createElement('div'); r.className='ldw-readout'; r.innerHTML='<span class="ldw-tick">▸</span> error · recovered'; el.appendChild(r); }
    finally{ refreshStatus(); busy=false; }
  }
  function surface(result){ drawer.classList.add('ldw-compact'); chips.classList.add('ldw-hide'); stopTypewriter();
    const el=bubble('luna'); el.textContent=result.reply; decorate(el,result); }

  send.addEventListener('click',()=>query(ask.value));
  ask.addEventListener('keydown',e=>{ if(e.key==='Enter') query(ask.value); });
  chips.querySelectorAll('.ldw-chip').forEach(c=>c.addEventListener('click',()=>surface(Router.topic(c.dataset.id))));

  /* Public handle: lets the corner quip open the chat and answer the clicked topic. */
  window.SITE.LunaChat = {
    open: openD, close: closeD, isOpen: function(){ return open; },
    ask: function(text){ var was=open; openD(); setTimeout(function(){ query(text); }, was?0:180); },
    askTopic: function(id){
      var was=open, t=(window.Router||Router).topic ? (window.Router||Router).topic(id) : null;
      openD();
      if(t) setTimeout(function(){ surface(t); }, was?0:180);
    }
  };
})();
