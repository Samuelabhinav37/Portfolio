// Shared Luna drawer engine — the byte-identical algorithm (KeywordEngine,
// LLMEngine, Router, buildSystemPrompt/parseCitation) and the drawer's
// open/close/typewriter wiring, extracted from 4 near-identical inline
// copies previously duplicated in index.astro, about.astro, contact.astro,
// and src/pages/blog/index.astro.
//
// Each page still owns its own KB (topic content — replies/details/targets
// genuinely differ per page) and, where it needs one, a small
// extraTargetHandler for the one navigate() target type that page adds on
// top of the built-in 'scroll' and 'url' types (contact: 'focus', blog
// index: 'case', index: 'project'; about needs none). Call
// window.SITE.initLunaDrawer(KB, extraTargetHandler) once per page, after
// the KB is defined and the <LunaDrawerShell /> markup is on the page.
//
// extraTargetHandler(target, ctx) — ctx = { close, reduce } — should return
// a { label, run } descriptor (same shape navigate() returns for the
// built-in types) or a falsy value if it doesn't recognize target.type.
window.SITE = window.SITE || {};
window.SITE.initLunaDrawer = function (KB, extraTargetHandler) {
  'use strict';

  const DEFAULT_GUESS_IDS = ['sentinel','prism','bounty','about'];
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
    function retrieve(query){                       // shared with the LLM (picks grounding section)
      if(!norm(query)) return null;
      const ranked = KB.map(t=>({t,s:score(query,t)})).sort((a,b)=>b.s-a.s);
      return ranked[0] && ranked[0].s>0 ? ranked[0] : null;
    }
    async function answer(query, onToken, lastCiteId){
      /* FIX: follow-up context. "how does it work", "tell me more" etc. carry
         no keywords, but they are about whatever was just discussed. */
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
      const reply = "Hm — I don't have a note on that. Did you mean:";
      onToken && onToken(reply, true);
      reportMiss(query);
      return { grounded:false, reply, guesses:pool.map(t=>({id:t.id,label:t.title})),
               signals:best?best.s:0, engine:'keyword' };
    }
    /* Fire-and-forget: lets the KB's keyword coverage actually improve from
       real usage instead of guessing. 404s harmlessly under `astro dev`
       (Cloudflare Pages Functions don't run there — see functions/api/) and
       never blocks or surfaces errors into the chat UX either way. */
    function reportMiss(query){
      try{
        fetch('/api/luna-miss', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ query: String(query||'').slice(0,300), page: location.pathname })
        }).catch(function(){});
      }catch(e){}
    }
    function topic(id){ const t=byId(id); return t
      ? { grounded:true, reply:t.reply, citeId:t.id, target:t.target, signals:null, engine:'keyword' }
      : answer(id); }
    return { answer, topic, retrieve, ready:()=>true, status:()=>'ready' };
  })();

  /* ───────── grounding prompt (feeds the trained LLM) ───────── */
  function buildSystemPrompt(){
    const lines = KB.filter(t=>t.id!=='greeting').map(t =>
      '- ['+t.id+'] '+t.title+': '+t.reply);
    return [
      "You are Luna, a terse, warm companion guarding Samuel's security portfolio.",
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
     The real wiring is below, commented. Because model weights can't be
     downloaded in this sandbox, a labelled MockLLM runs instead — it produces
     a grounded, streamed, citation-tagged answer so the whole pipeline (status,
     streaming, fallback, cite→jump) is real and swap-ready. Set USE_REAL_LLM
     true and drop in your MLC-converted model id / URL to go live. */
  const LLMEngine = (() => {
    const USE_REAL_LLM = false;
    const MODEL_ID = "Llama-3.2-1B-Instruct-q4f32_1-MLC";   // ← replace with your trained MLC model
    let engine=null, status='idle', progress=0, sys=buildSystemPrompt();

    const webgpuOK = () => (typeof navigator!=='undefined' && 'gpu' in navigator);

    async function load(onProgress){
      if(status==='ready'||status==='warming') return;
      if(USE_REAL_LLM && !webgpuOK()){ status='unsupported'; return; }
      status='warming';
      try{
        if(USE_REAL_LLM){
          /* ── real WebLLM (uncomment; npm i @mlc-ai/web-llm) ──
          const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
          engine = await CreateMLCEngine(MODEL_ID, { initProgressCallback: p => {
            progress = p.progress||0; onProgress && onProgress(progress);
          }});
          */
        } else {
          /* mock warm-up so the loading UX is visible */
          for(let p=0;p<=1;p+=0.08){ progress=p; onProgress && onProgress(p); await sleep(90); }
        }
        status='ready';
      }catch(e){ console.error('LLM load failed',e); status='error'; }
    }

    async function answer(query, onToken, lastCiteId){
      if(status!=='ready') throw new Error('llm-not-ready');
      let raw='';
      if(USE_REAL_LLM){
        /* ── real streamed completion ──
        const stream = await engine.chat.completions.create({
          messages:[{role:'system',content:sys},{role:'user',content:query}],
          stream:true, temperature:0.3, max_tokens:160
        });
        for await (const c of stream){
          const d = c.choices[0]?.delta?.content || ''; raw+=d;
          const shown = parseCitation(raw).clean; onToken && onToken(shown, false);
        }
        */
        raw='';
      } else {
        raw = await mockGenerate(query, onToken, lastCiteId);
      }
      // UNKNOWN → not grounded → hand back for keyword-style guesses
      if(/^\s*UNKNOWN\s*$/i.test(parseCitation(raw).clean)) throw new Error('llm-unknown');
      const { id, clean } = parseCitation(raw);
      const t = id ? byId(id) : null;
      return { grounded:true, reply:clean, citeId:t?t.id:null, target:t?t.target:null,
               signals:null, engine:'llm' };
    }

    /* MockLLM: retrieves the grounding section, lightly re-voices it, streams it,
       and appends the citation — mirroring the trained model's output shape. */
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
    let mode='auto', lastCiteId=null;                              // auto | keyword | (dev-forced states)
    function setMode(m){ mode=m; }
    function activeStatus(){
      if(mode==='keyword') return 'offline';
      if(mode==='warming') return 'warming';
      if(mode==='llm')     return 'online';
      // auto:
      const s=LLMEngine.status();
      if(s==='ready')   return 'online';
      if(s==='warming') return 'warming';
      return 'offline';                            // idle/unsupported/error → keyword serves
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
    function topic(id){ const r=KeywordEngine.topic(id); if(r.citeId) lastCiteId=r.citeId; return r; }  // quick chips: instant, deterministic
    return { answer, topic, setMode, activeStatus, getMode:()=>mode };
  })();

  /* ═══════════ DRAWER (site integration — namespaced, opens on Luna click) ═══════════ */
  (() => {
    const $=id=>document.getElementById(id);
    const drawer=$('ldw-drawer'), scrim=$('ldw-scrim'), ask=$('ldw-ask'), send=$('ldw-send'),
          thread=$('ldw-thread'), dbody=$('ldw-dbody'), chips=$('ldw-chips'), identity=$('ldw-identity'),
          head=drawer.querySelector('.ldw-head'), statusEl=$('ldw-status'),
          avatarEl=$('ldw-avatar');
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let open=false, busy=false, lunaBlobURL=null;

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
          setTimeout(()=>sendAvatarAction('wave'), 550);   // a little hello
          startAvatarIdle();                                // gentle life inside the bubble
        }, {once:true});
        fr.src=lunaBlobURL; avatarEl.appendChild(fr);
      }catch(e){ console.error('luna avatar mount failed',e); }
    }
    function unmountLuna(){
      stopAvatarIdle();
      if(avatarEl) avatarEl.innerHTML='';
      if(lunaBlobURL){ try{ URL.revokeObjectURL(lunaBlobURL); }catch(_){} lunaBlobURL=null; }
    }

    /* related topics for the follow-up chips */
    const RELATED={
      sentinel:['prism','skills','labs'], prism:['sentinel','axon','skills'],
      axon:['prism','skills','about'],   bounty:['labs','blog','about'],
      labs:['bounty','blog','sentinel'], blog:['bounty','labs','about'],
      skills:['sentinel','prism','about'],about:['bounty','skills','contact'],
      contact:['about','blog','bounty'], greeting:['sentinel','bounty','about']
    };

    /* typewriter placeholder — cycles example prompts into the search bar */
    const TW=['what is sentinel?','how does prism work?','show me the bounty findings','are you hiring?','where should i start?'];
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

    function openD(){ if(open)return; open=true;
      window.SITE.__lunaEverOpened = true;   // stop the corner quip's periodic nudges once she's actually been used
      /* Symmetric to SiteMenu's own check: the hamburger menu overlay sits
         well above this drawer (z-index 10000+ vs 1200) and neither knew
         about the other, so both open at once let the menu cover the
         drawer's close button. Close the menu when she opens instead. */
      const mt=document.getElementById('menu-trigger'), mo=document.getElementById('menu-overlay');
      if(mt && mo && mo.classList.contains('open')) mt.click();
      drawer.classList.add('on'); scrim.classList.add('on');
      document.body.classList.add('ldw-drawer-open'); drawer.setAttribute('aria-hidden','false');
      mountLuna(); startTypewriter();
      statusTimer=setInterval(refreshStatus,400);
      if(Router.getMode()==='auto') LLMEngine.load(()=>refreshStatus()); }
    function closeD(){ if(!open)return; open=false; drawer.classList.remove('on'); scrim.classList.remove('on');
      document.body.classList.remove('ldw-drawer-open'); drawer.setAttribute('aria-hidden','true'); ask.blur();
      clearInterval(statusTimer); statusTimer=null;
      setTimeout(unmountLuna, reduce?0:650); stopTypewriter(); }   // unmount after the slide-out finishes

    // OPEN PATH: Luna lives in an iframe; her document posts this on click/tap.
    // Touch-to-click synthesis across an iframe boundary can occasionally
    // deliver two 'lunaOpenChat' messages for a single tap (seen on mobile) —
    // since this handler TOGGLES, a double-delivery opens then immediately
    // closes again, which looks from the outside like tapping her did
    // nothing at all. Coalesce anything arriving within one toggle's worth
    // of time into a single open/close.
    let lastLunaMsgT=0;
    addEventListener('message', e=>{
      if(e.origin!==location.origin || !e.data || e.data.type!=='lunaOpenChat') return;
      const now=performance.now();
      if(now-lastLunaMsgT<350) return;
      lastLunaMsgT=now;
      open?closeD():openD();
    });
    // also allow Ctrl/Cmd+L from the page
    addEventListener('keydown', e=>{
      if(e.key==='Escape' && open) closeD();
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='l'){ e.preventDefault(); open?ask.focus():openD(); }
    });
    $('ldw-close').addEventListener('click',closeD);
    scrim.addEventListener('click',closeD);

    const arm=()=>send.classList.toggle('on',ask.value.trim().length>0);
    ask.addEventListener('input',arm);

    function bubble(role){ const el=document.createElement('div'); el.className='ldw-msg ldw-'+role;
      thread.appendChild(el); dbody.scrollTop=dbody.scrollHeight; return el; }

    /* jump target resolution: 'scroll' → anchor, 'url' → new tab, anything
       else is handed to the page's own extraTargetHandler (project → globe
       tour, focus → contact field, case → case study, ...). */
    function navigate(target){
      if(!target) return null;
      if(target.type==='scroll'){ const n=document.querySelector(target.value);
        return n?{label:'Take me there',run:()=>{closeD();n.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});}}:null; }
      if(target.type==='url') return {label:'Open '+target.value.replace(/^https?:\/\//,''),run:()=>window.open(target.value,'_blank','noopener')};
      if(extraTargetHandler){ const r = extraTargetHandler(target, { close: closeD, reduce }); if(r) return r; }
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
        /* follow-up suggestions under the answer */
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

    /* Public handle: lets the quip nudge (and the corner companion) open the chat and answer the clicked topic. */
    window.SITE.LunaChat = {
      open: openD, close: closeD, isOpen: function(){ return open; },
      ask: function(text){ var was=open; openD(); setTimeout(function(){ query(text); }, was?0:180); },
      askTopic: function(id){
        var was=open, t=Router.topic ? Router.topic(id) : null;
        openD();
        if(t) setTimeout(function(){ surface(t); }, was?0:180);
      }
    };
  })();
};
