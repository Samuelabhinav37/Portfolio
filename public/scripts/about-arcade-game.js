/* INFILTRATE // DEFEND, the /about arcade game. Runs inside #game-iframe's
   srcdoc document. External rather than inline in the srcdoc because the
   srcdoc inherits the page's hash-based CSP, which blocks unhashed inline
   scripts; 'self' covers this file. */
// ═══════════════════════════════════════════════════════════
// BACKGROUND (intro screens only, stops when game starts)
// ═══════════════════════════════════════════════════════════
const bgC=document.getElementById('bg');
const bgX=bgC.getContext('2d');
let BW,BH;
function rsz(){BW=bgC.width=innerWidth;BH=bgC.height=innerHeight;}
rsz();addEventListener('resize',rsz);
const BN=Array.from({length:30},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.00009,vy:(Math.random()-.5)*.00009,b:Math.random()*.05+.02}));
let bgActive=true,bgLoopRunning=false;
function drawBg(t){
  if(!bgActive)return;
  bgX.fillStyle='rgba(0,0,0,.97)';bgX.fillRect(0,0,BW,BH);
  bgX.strokeStyle='rgba(255,255,255,.005)';bgX.lineWidth=1;
  for(let x=0;x<BW;x+=42){bgX.beginPath();bgX.moveTo(x,0);bgX.lineTo(x,BH);bgX.stroke();}
  for(let y=0;y<BH;y+=42){bgX.beginPath();bgX.moveTo(0,y);bgX.lineTo(BW,y);bgX.stroke();}
  BN.forEach(n=>{n.x=(n.x+n.vx+1)%1;n.y=(n.y+n.vy+1)%1;});
  BN.forEach((a,i)=>{
    BN.slice(i+1).forEach(b=>{
      const dx=(a.x-b.x)*BW,dy=(a.y-b.y)*BH,d=Math.sqrt(dx*dx+dy*dy);
      if(d<108){bgX.strokeStyle=`rgba(255,255,255,${(1-d/108)*.012})`;bgX.lineWidth=.7;bgX.beginPath();bgX.moveTo(a.x*BW,a.y*BH);bgX.lineTo(b.x*BW,b.y*BH);bgX.stroke();}
    });
    bgX.fillStyle=`rgba(255,255,255,${a.b*(.6+.4*Math.sin(t*.0005+i*.9))})`;bgX.fillRect(a.x*BW-1,a.y*BH-1,2,2);
  });
}
function bgLoop(t){
  if(!bgActive){bgLoopRunning=false;return;}
  drawBg(t);
  requestAnimationFrame(bgLoop);
}
function startBgLoop(){if(bgLoopRunning)return;bgLoopRunning=true;requestAnimationFrame(bgLoop);}
startBgLoop();

// ═══════════════════════════════════════════════════════════
// MODE CARD SPRITES (intro only)
// ═══════════════════════════════════════════════════════════
const PS=3;
const HR=['  HHHHHHH ','  HHEEEEH ','  HHEEEEH ','  HHHHHHH ','   JJJJJ  ','  JCCCCCJ ','  JCCCCCJ ','   JJJJJ  ','  PP  PP  ','  PP  PP  ','  BB  BB  '];
const HP={H:'#0d1830',E:'#00e5ff',J:'#060c14',C:'#0a2038',P:'#060c14',B:'#030810'};
const SR=['  UUUUUU  ',' UUBBBBUУ ',' UUBBBBUУ ','  UUUUUU  ','   AAAA   ','  ACCCCA  ','  ACCCCA  ','   AAAA   ','  TT  TT  ','  TT  TT  ','  FF  FF  '];
const SP={U:'#0a2218',B:'#00ff88',A:'#041810',C:'#083820',T:'#041810',F:'#020e08'};
function drawSpr(cv,rows,pal,glow,wt){
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  const cw=cv.width,ch=cv.height,w=Math.max(...rows.map(r=>r.length)),h=rows.length;
  const ox=(cw-w*PS)/2,oy=(ch-h*PS)/2,bob=Math.sin(wt*Math.PI*2)*1.5;
  const sL=Math.sin(wt*Math.PI*2)*1.2,sR=-sL;
  ctx.shadowColor=glow;ctx.shadowBlur=2;
  rows.forEach((row,ry)=>{
    for(let rx=0;rx<row.length;rx++){
      const c=row[rx];if(c===' ')continue;const col=pal[c];if(!col)continue;
      let py=ry;if(ry>=8)py+=(rx<w/2?sL:sR);
      ctx.fillStyle=col;
      ctx.fillRect(ox+rx*PS,oy+py*PS+bob,PS,PS);
    }
  });
  ctx.shadowBlur=0;ctx.fillStyle='rgba(0,0,0,.22)';
  for(let y=0;y<ch;y+=2)ctx.fillRect(0,y,cw,1);
}
let wt=0;
function sprLoop(){
  if(CUR!==1)return;
  wt=(wt+.011)%1;drawSpr(document.getElementById('sp-h'),HR,HP,'#00e5ff',wt);drawSpr(document.getElementById('sp-s'),SR,SP,'#00ff88',wt+.5);requestAnimationFrame(sprLoop);
}
requestAnimationFrame(sprLoop);

// ═══════════════════════════════════════════════════════════
// BOOT TYPING SEQUENCE
// ═══════════════════════════════════════════════════════════
(function(){
  const ROWS=[
    ['MAZE','28 × 28'],['GUARDS','3'],['KEYS','3 REQUIRED'],
    ['EXIT','1'],['POWER-UPS','2 PER RUN'],['HIDE SPOTS','8'],
  ];
  const grid=document.getElementById('boot-stats-grid');
  const pressEl=document.getElementById('boot-press');
  // pre-build hidden rows
  ROWS.forEach(([l,v])=>{
    const d=document.createElement('div');d.className='bs';d.style.opacity='0';
    d.innerHTML=`<span class="bs-l"></span><span class="bs-v"></span>`;
    grid.appendChild(d);
  });
  function typeRow(rowIdx,cb){
    if(rowIdx>=ROWS.length){cb&&cb();return;}
    const row=grid.children[rowIdx];
    const lEl=row.querySelector('.bs-l');
    const vEl=row.querySelector('.bs-v');
    const [label,val]=ROWS[rowIdx];
    row.style.opacity='1';
    let li=0,vi=0;
    function typeLabel(){
      if(li<=label.length){lEl.textContent=label.slice(0,li)+(li<label.length?'█':'');li++;setTimeout(typeLabel,38);}
      else{lEl.textContent=label;setTimeout(typeVal,60);}
    }
    function typeVal(){
      if(vi<=val.length){vEl.textContent=val.slice(0,vi)+(vi<val.length?'█':'');vi++;setTimeout(typeVal,42);}
      else{vEl.textContent=val;setTimeout(()=>typeRow(rowIdx+1,cb),80);}
    }
    typeLabel();
  }
  setTimeout(()=>{typeRow(0,()=>{pressEl.style.transition='opacity .4s';pressEl.style.opacity='1';});},400);
})();

// ═══════════════════════════════════════════════════════════
// SCREEN MANAGER
// ═══════════════════════════════════════════════════════════
const SCREENS=['s-boot','s-mode','s-rules','s-theme','s-game'];
const PLABS=['BOOT','ROLE','RULES','MAP','PLAY'];
let CUR=0,selMode=null,selTheme=null;
function goTo(i){
  ft(()=>{
    document.getElementById(SCREENS[CUR]).classList.remove('on');
    CUR=i;
    document.getElementById(SCREENS[CUR]).classList.add('on');
    updateProg();
    document.getElementById('back').classList.toggle('on',CUR>0&&CUR<4);
    if(CUR<4){bgActive=true;bgC.style.display='';startBgLoop();gameRunning=false;}
    if(CUR===1)requestAnimationFrame(sprLoop);
    if(CUR===2)buildRules();
    if(CUR===3)buildThemeSel();
    if(CUR===4)startGame();
  });
}
function goBack(){if(CUR>0&&CUR<4)goTo(CUR-1);}
function ft(cb){
  const f=document.getElementById('flash');
  f.style.cssText='opacity:1;background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,229,255,.18) 2px,rgba(0,229,255,.18) 3px);transition:opacity .06s;';
  setTimeout(()=>{cb();f.style.cssText='opacity:0;background:transparent;transition:opacity .18s;';},70);
}
function updateProg(){
  PLABS.forEach((_,i)=>{
    const el=document.getElementById('p'+i);
    el.classList.toggle('cur',i===CUR);
    el.classList.toggle('done',i<CUR);
  });
}
document.addEventListener('keydown',e=>{
  // prevent page scroll on arrow/space always
  if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
  if(CUR===0){goTo(1);return;}
  if(CUR===1){
    if(e.key==='a'||e.key==='A'){e.preventDefault();selectMode('attacker');return;}
    if(e.key==='d'||e.key==='D'){e.preventDefault();selectMode('defender');return;}
  }
  if(CUR===4&&G.status==='playing')handleKey(e);
});
document.getElementById('s-boot').addEventListener('click',()=>{if(CUR===0)goTo(1);});
function selectMode(m){selMode=m;goTo(2);}

// ═══════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════
const RDATA={
  attacker:{badge:'ATTACKER',bc:'#00e5ff',
    rules:[
      {ic:'[K]',t:'GRAB THE KEYS',b:"3 keys hidden in the maze. Walk onto them to collect. You need ALL THREE before the exit unlocks."},
      {ic:'[X]',t:'FIND THE EXIT',b:"One exit — glows in the map accent color. Get there with all 3 keys to escape."},
      {ic:'[!]',t:'DODGE THE WARDENS',b:"3 guards hunt you. One chases directly. Two patrol routes and intercept. Tagged = game over."},
      {ic:'[~]',t:'HIDE IN THE SHADOWS',b:"Glowing floor alcoves are hiding spots. Step inside and the chasing guard loses your signal."},
    ],
    pus:[
      {ic:'◉',nm:'PHANTOM',col:'#00e5ff',dc:'SPACE TO USE · 5s immunity — guards pass through you.'},
      {ic:'⚡',nm:'VOLTAGE',col:'#ffcc00',dc:'SPACE TO USE · Walk into a guard to eliminate it instantly.'},
    ],
  },
  defender:{badge:'DEFENDER',bc:'#00ff88',
    rules:[
      {ic:'[?]',t:'TRACK THE PHANTOM',b:"An AI PHANTOM is hunting for 3 keys. You are SENTINEL. Find it and tag it before it escapes."},
      {ic:'[>]',t:'INTERCEPT IT',b:"Move onto the same tile as the PHANTOM to tag it. Win instantly. But it will dodge you."},
      {ic:'[W]',t:'WARDEN ALLIES',b:"Two WARDEN guards patrol automatically. Watch their routes — use them to corner the PHANTOM."},
      {ic:'[~]',t:'HIDING SPOTS HURT YOU',b:"If the PHANTOM hides, it vanishes for 5 seconds. Keep moving. Predict where it emerges."},
    ],
    pus:[
      {ic:'◼',nm:'TITAN BLOCK',col:'#5599ff',dc:'SPACE TO USE · Places a wall tile to cut off the Phantom.'},
      {ic:'▶▶',nm:'SURGE',col:'#00ff88',dc:'SPACE TO USE · 5s speed boost — move faster to close the gap.'},
    ],
  },
};
function buildRules(){
  if(!selMode)return;
  const r=RDATA[selMode];
  const b=document.getElementById('rb');
  b.textContent=r.badge;b.style.color=r.bc;b.style.borderColor=r.bc+'44';
  document.getElementById('rt').style.color=r.bc;
  const mc=document.getElementById('mode-chosen');if(mc){mc.textContent='▶ PLAYING AS '+r.badge;mc.style.color=r.bc;mc.style.borderColor=r.bc+'55';}
  document.getElementById('rules-list').innerHTML=r.rules.map(rl=>`<div class="rule-item"><div class="ri-icon">${rl.ic}</div><div><div class="ri-title" style="color:${r.bc}">${rl.t}</div><div class="ri-body">${rl.b}</div></div></div>`).join('');
  document.getElementById('pu-row').innerHTML=r.pus.map(p=>`<div class="pu-chip" style="border-color:${p.col}22"><div class="pu-ic">${p.ic}</div><div class="pu-nm" style="color:${p.col}">${p.nm}</div><div class="pu-dc">${p.dc}</div></div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// THEMES + MINI PREVIEW
// ═══════════════════════════════════════════════════════════
const THEMES=[
  {id:'server',nm:'SERVER ROOM', sg:'Digital Fortress',col:'#00cc66',sw:['#010804','#001a08','#002a10','#00cc66']},
  {id:'office',nm:'OFFICE FLOOR',sg:'Corporate Grid',  col:'#8899ff',sw:['#080c18','#0d1220','#1a2240','#8899ff']},
  {id:'arctic',nm:'ARCTIC BASE', sg:'Frozen Facility', col:'#88ccee',sw:['#060d14','#0c1a26','#1a2e44','#88ccee']},
  {id:'neon',  nm:'CYBER CITY',  sg:'Rooftop Run',     col:'#cc44bb',sw:['#080010','#0e0018','#1e0030','#cc44bb']},
  {id:'bunker',nm:'BUNKER',      sg:'Concrete Maze',   col:'#cc6622',sw:['#0a0600','#140c02','#1e1206','#cc6622']},
];
function buildThemeSel(){
  document.getElementById('th-grid').innerHTML=THEMES.map(th=>`
    <div class="th-tile${selTheme===th.id?' sel':''}" style="--tc:${th.col}" data-theme="${th.id}">
      <div class="ttsw" style="background:linear-gradient(155deg,${th.sw[0]} 0%,${th.sw[1]} 40%,${th.sw[2]} 70%,${th.sw[3]}55 100%)"></div>
      <div class="ttnm" style="color:${th.col}">${th.nm}</div>
      <div class="ttsg">${th.sg}</div>
      <div class="ttchk">${selTheme===th.id?'✓':''}</div>
    </div>`).join('');
  // Listeners, not onclick=""/onmouseenter="" attributes: this document is
  // a srcdoc under the page's hash-based CSP, which blocks inline handlers.
  document.querySelectorAll('#th-grid .th-tile').forEach(el=>{
    el.addEventListener('click',()=>pickTheme(el.dataset.theme));
    el.addEventListener('mouseenter',()=>hoverTheme(el.dataset.theme));
  });
  updateLaunch();drawMiniPrev();
}
function pickTheme(id){selTheme=id;buildThemeSel();}
function hoverTheme(id){const th=THEMES.find(t=>t.id===id);if(!th)return;const c=document.getElementById('mini-canvas');const ctx=c.getContext('2d');const TW=7;ctx.fillStyle=th.sw[0];ctx.fillRect(0,0,c.width,c.height);for(let row=0;row<miniPat.length;row++)for(let col=0;col<miniPat[row].length;col++){const px=col*TW,py=row*TW;ctx.fillStyle=miniPat[row][col]===1?th.sw[2]:th.sw[1];ctx.fillRect(px,py,TW,TW);}const pd=6;ctx.fillStyle=th.col;ctx.fillRect(pd,c.height/2-2,4,4);}
function updateLaunch(){
  const btn=document.getElementById('launch-btn'),sm=document.getElementById('lsum');
  const th=THEMES.find(t=>t.id===selTheme);
  if(selMode&&selTheme){
    btn.disabled=false;btn.style.borderColor=th.col;btn.style.color=th.col;
    sm.innerHTML=`MODE: <span style="color:${selMode==='attacker'?'#00e5ff':'#00ff88'}">${selMode.toUpperCase()}</span> · MAP: <span style="color:${th.col}">${th.nm}</span>`;
  } else {btn.disabled=true;btn.style.borderColor='';btn.style.color='';sm.textContent='SELECT A MAP TO CONTINUE';}
}
const miniPat=[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],[1,0,1,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,1,1,0,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1],[1,0,1,1,0,1,1,1,0,1,0,1,1,1,1,0,1,1,0,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,0,1,1,0,1,1,1,1,0,1,0,1,1,0,1,1,0,1,1,1,1,1,0,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]];
let miniSX=0;
function drawMiniPrev(){
  const th=THEMES.find(t=>t.id===selTheme);
  const c=document.getElementById('mini-canvas');
  const ctx=c.getContext('2d');
  const TW=7;
  function animMini(){
    if(CUR!==3)return;
    miniSX=(miniSX+.35)%(TW*miniPat[0].length);
    ctx.fillStyle=th?th.sw[0]:'#000';ctx.fillRect(0,0,c.width,c.height);
    if(!th){requestAnimationFrame(animMini);return;}
    for(let row=0;row<miniPat.length;row++)for(let col=0;col<miniPat[row].length+2;col++){
      const ci=col%miniPat[row].length,px=col*TW-miniSX,py=row*TW;
      if(px>c.width+TW||px<-TW)continue;
      ctx.fillStyle=miniPat[row][ci]===1?th.sw[2]:th.sw[1];ctx.fillRect(px,py,TW,TW);
      if(miniPat[row][ci]===1){ctx.fillStyle=th.sw[3]+'33';ctx.fillRect(px,py,TW,2);}
    }
    const pd=6+Math.sin(Date.now()*.003)*2;
    ctx.fillStyle=th.col;ctx.fillRect(pd,c.height/2-2,4,4);
    requestAnimationFrame(animMini);
  }
  animMini();
}
function launchGame(){
  const btn=document.getElementById('launch-btn');
  const chars='!#%&<>?|01';const orig='START MISSION';let gi=0;
  const gl=setInterval(()=>{
    btn.textContent=Array.from(orig).map(c=>c===' '?' ':Math.random()<.5?chars[Math.floor(Math.random()*chars.length)]:c).join('');
    if(gi++>16){clearInterval(gl);goTo(4);}
  },42);
}

// ═══════════════════════════════════════════════════════════
// ── SPRITE SYSTEM ──────────────────────────────────────────
// Pre-render pixel art sprites to offscreen canvases
// Each sprite = array of strings (row per char = 1 px) + palette
// ═══════════════════════════════════════════════════════════
const SPRITE_DEFS={
  // PLAYER / HACKER (8 wide × 12 tall)
  hacker:{
    rows:['_HHHHHH_','_HEEEEH_','_HHHHHH_','__JJJJ__',
          '_JCCCCJ_','JCCCCCCJ','_JJJJJJ_','_PP__PP_',
          '_PP__PP_','_BB__BB_','_ff__ff_','________'],
    pal:{H:'#1a3a6a',E:'#00e5ff',J:'#091828',C:'#0d2a48',P:'#091022',B:'#04080e',f:'#3070c0','_':null}
  },
  // SENTINEL (defender player, green)
  sentinel:{
    rows:['_UUUUUU_','_UBBBBU_','_UUUUUU_','__AAAA__',
          '_ACCCCA_','ACCCCCCA','_AAAAAA_','_PP__PP_',
          '_PP__PP_','_TT__TT_','_ff__ff_','________'],
    pal:{U:'#0a2218',B:'#00ff88',A:'#041810',C:'#083820',P:'#041810',T:'#020e08',f:'#20a060','_':null}
  },
  // GUARD CHASER — red, menacing skull-face visor
  warden:{
    rows:['_RRRRRR_','RRXEEXXR','RRXEEXXR','_RRRRRR_',
          '__DDDD__','_DDDDDD_','KDDDDDDX','_KDDDDX_',
          '_QQ__QQ_','_QQ__QQ_','_qq__qq_','________'],
    pal:{R:'#8a0010',E:'#ff2244',X:'#440008',D:'#580010',K:'#300008',Q:'#200006',q:'#100002','_':null}
  },
  // PATROL ORANGE — interceptor, wider visor
  interceptor:{
    rows:['_OOOOOO_','_OYYYOO_','_OYYYOO_','_OOOOOO_',
          '__DDDD__','_DSSSSD_','_DSSSSD_','__DDDD__',
          '_LL__LL_','_LL__LL_','_bb__bb_','________'],
    pal:{O:'#7a3a00',Y:'#ffaa00',D:'#4a2400',S:'#603000',L:'#301800',b:'#180c00','_':null}
  },
  // PATROL PURPLE — scanner, antenna head
  scanner:{
    rows:['___PP___','__PPPP__','_PVVVVP_','_PVVVVP_',
          '__PPPP__','__SSSS__','_SSSSSS_','__SSSS__',
          '_MM__MM_','_MM__MM_','_mm__mm_','________'],
    pal:{P:'#4a1060',V:'#cc44ff',S:'#2a0840',M:'#180428',m:'#0c0218','_':null}
  },
  // PHANTOM (AI enemy, defender mode) — ghostly
  phantom:{
    rows:['__PPPP__','_PPPPPP_','_PVVVVP_','_PVVVVP_',
          '_PPPPPP_','_PPPPPP_','_PPPPPP_','__PPPP__',
          '_P_PP_P_','_P____P_','________','________'],
    pal:{P:'#6600aa',V:'#ee44ff','_':null}
  },
  // KEY — proper key shape: round head + shaft + teeth
  key:{
    rows:['__RRRR__','_RRmmRR_','_RRmmRR_','__RRRR__',
          '___KK___','___KK___','___KKKK_','___KK___',
          '___KK___','________','________','________'],
    pal:{R:'#e8b800',m:'#000000',K:'#e8b800','_':null}
  },
  // PHANTOM PU — ghost head shape
  pu_phantom:{
    rows:['__PPPP__','_PPPPPP_','_PmmmmP_','_PmmmmP_',
          '_PPPPPP_','_PPPPPP_','_P_PP_P_','________'],
    pal:{P:'#00e5ff',m:'#003344','_':null}
  },
  // KILLSHOT PU — lightning bolt
  pu_killshot:{
    rows:['____KK__','___KKK__','__KKK___','_KKKKKK_',
          '__KKKK__','___KKK__','____KK__','________'],
    pal:{K:'#ffcc00','_':null}
  },
  // TITAN PU — wall/block symbol
  pu_titan:{
    rows:['TTTTTTTT','TmmTmmTT','TmmTmmTT','TTTTTTTT',
          'TTTmmTmm','TTTmmTmm','TTTTTTTT','________'],
    pal:{T:'#5599ff',m:'#001144','_':null}
  },
  // SURGE PU — double forward arrow
  pu_surge:{
    rows:['__S_____','_SS_S___','SSSSSS__','SSSSSSS_',
          'SSSSSS__','_SS_S___','__S_____','________'],
    pal:{S:'#00ff88','_':null}
  },
};

// Cache: sprite type → OffscreenCanvas (pre-rendered)
const spriteCaches={};
function makeSprite(def,size){
  const oc=new OffscreenCanvas(size,size);
  const ctx=oc.getContext('2d');
  const rows=def.rows;const pal=def.pal;
  const sw=rows[0].length,sh=rows.length;
  const px=size/sw,py=size/sh;
  rows.forEach((row,ry)=>{
    for(let rx=0;rx<row.length;rx++){
      const c=row[rx];const col=pal[c];if(!col)continue;
      ctx.fillStyle=col;ctx.fillRect(Math.round(rx*px),Math.round(ry*py),Math.ceil(px),Math.ceil(py));
    }
  });
  return oc;
}
// Also make a "powered" version of player with recolored palette
function makePoweredSprite(type,size,mode){
  const cols={phantom:'#00e5ff',killshot:'#ffcc00',titan:'#5599ff',surge:'#00ff88'};
  const baseKey=(mode==='defender')?'sentinel':'hacker';
  const base=SPRITE_DEFS[baseKey];
  const tint=cols[type]||'#00e5ff';
  const oc=new OffscreenCanvas(size,size);
  const ctx=oc.getContext('2d');
  const rows=base.rows;const pal={...base.pal};
  // Force the large-coverage helmet region to white (guaranteed distinct from
  // every base palette AND every power-up tint, even on the two power-ups
  // whose tint happens to equal that character's own visor color) and tint
  // the hood/body too, so every power-up reads as visibly different from
  // the base character, not just KILLSHOT/TITAN.
  if(baseKey==='hacker'){pal.H='#ffffff';pal.E=tint;pal.C=tint;}
  else{pal.U='#ffffff';pal.B=tint;pal.C=tint;}
  const sw=rows[0].length,sh=rows.length;
  const px=size/sw,py=size/sh;
  rows.forEach((row,ry)=>{
    for(let rx=0;rx<row.length;rx++){
      const c=row[rx];const col=pal[c];if(!col)continue;
      ctx.fillStyle=col;ctx.fillRect(Math.round(rx*px),Math.round(ry*py),Math.ceil(px),Math.ceil(py));
    }
  });
  return oc;
}

function buildSpriteCaches(tileSize){
  ['hacker','sentinel','warden','interceptor','scanner','phantom','key','pu_phantom','pu_killshot','pu_titan','pu_surge'].forEach(k=>{
    spriteCaches[k]=makeSprite(SPRITE_DEFS[k],tileSize);
  });
  ['phantom','killshot','titan','surge'].forEach(k=>{
    spriteCaches['powered_atk_'+k]=makePoweredSprite(k,tileSize,'attacker');
    spriteCaches['powered_def_'+k]=makePoweredSprite(k,tileSize,'defender');
  });
}

// Animated walk frame (offset rows for bob/step), re-render into a temp canvas each N frames
// We use a simple "which frame" counter: 0=stand,1=step_left,2=stand,3=step_right
let walkFrame=0,walkTimer=0;
function stepWalk(dt){walkTimer+=dt;if(walkTimer>.12){walkTimer=0;walkFrame=(walkFrame+1)%8;}}

// ═══════════════════════════════════════════════════════════
// PROP DRAWERS (same as before — called into MAZE CANVAS only)
// ═══════════════════════════════════════════════════════════
function drawServerRack(c,x,y,t,aT){
  c.fillStyle='#001c0c';c.fillRect(x+1,y+1,t-2,t-2);
  c.fillStyle='#002e14';c.fillRect(x+2,y+2,t-4,t-4);
  c.fillStyle='#001408';for(let i=5;i<t-2;i+=5)c.fillRect(x+2,y+i,t-4,1);
  const lc=['#00ff44','#ffaa00','#ff3300','#00aaff'];
  [[3,3],[3,8],[3,13],[t-6,3],[t-6,8],[t-6,13]].forEach(([lx,ly],i)=>{
    c.fillStyle=((Math.floor(aT*1.8)+i*3)%8)===0?lc[i%4]:'#001a08';c.fillRect(x+lx,y+ly,2,2);
  });
  c.fillStyle='#00cc55';c.fillRect(x+1,y+1,t-2,2);
}
function drawCableBox(c,x,y,t){
  c.fillStyle='#011a0a';c.fillRect(x+1,y+1,t-2,t-2);
  [['#005522',2],['#003344',5],['#440033',8],['#334400',11]].forEach(([col,oy])=>{
    c.fillStyle=col;c.fillRect(x+2,y+oy,t-4,3);
  });
}
function drawComputer(c,x,y,t,aT){
  c.fillStyle='#181828';c.fillRect(x+1,y+t-5,t-2,4);
  c.fillStyle='#0e0e1e';c.fillRect(x+3,y+3,t-6,t-10);
  c.fillStyle=((Math.floor(aT*.5)+Math.floor(x/t))%4)===0?'#0044aa':'#002266';c.fillRect(x+4,y+4,t-8,t-12);
  c.fillStyle='rgba(255,255,255,.18)';[0,3,6].forEach(i=>c.fillRect(x+5,y+6+i,t-12,1));
  c.fillStyle='#1a1a2e';c.fillRect(x+3,y+t-8,t-6,3);
}
function drawPlant(c,x,y,t,aT){
  const sw=Math.sin(aT*1.1+(x+y)*.3)*1.2;
  c.fillStyle='#7a3a10';c.fillRect(x+5,y+t-6,t-10,5);
  c.fillStyle='#2a6018';c.fillRect(x+t/2-1+sw,y+t-11,2,5);
  c.fillStyle='#3a8a22';c.fillRect(x+t/2-5+sw,y+t-13,5,3);c.fillRect(x+t/2+1+sw,y+t-12,5,3);
  c.fillStyle='#ff5577';c.fillRect(x+t/2-1+sw,y+t-16,3,3);
}
function drawFilingCabinet(c,x,y,t){
  c.fillStyle='#141428';c.fillRect(x+2,y+1,t-4,t-2);
  c.fillStyle='#1e1e3a';c.fillRect(x+3,y+2,t-6,t-4);
  [4,9,14].forEach(dy=>{c.fillStyle='#3a3a66';c.fillRect(x+t/2-3,y+dy+2,6,2);});
}
function drawIcePillar(c,x,y,t,aT){
  c.fillStyle='#0e2236';c.fillRect(x+2,y+1,t-4,t-2);
  c.fillStyle='rgba(160,210,255,.12)';c.fillRect(x+2,y+1,(t-4)/2,t-2);
  c.fillStyle='#8ad4ff';c.fillRect(x+t/2-1,y,2,3);
}
function drawSnowCrate(c,x,y,t){
  c.fillStyle='#0a1824';c.fillRect(x+1,y+2,t-2,t-3);
  c.fillStyle='#c8e8ff';c.fillRect(x+1,y,t-2,4);c.fillStyle='#e8f4ff';c.fillRect(x+2,y,t-4,2);
  c.strokeStyle='rgba(80,140,200,.22)';c.lineWidth=.7;c.strokeRect(x+2,y+3,t-4,t-5);
}
function drawVentStack(c,x,y,t,aT){
  c.fillStyle='#140022';c.fillRect(x+1,y+1,t-2,t-2);
  c.fillStyle='rgba(80,0,140,.6)';for(let i=3;i<t-2;i+=4)c.fillRect(x+3,y+i,t-6,2);
  const a=aT*4,fx=x+t/2,fy=y+t/2;
  c.fillStyle='#aa44ff';[[3,0],[0,3],[-3,0],[0,-3]].forEach(([dx,dy])=>{
    const ra=Math.atan2(dy,dx)+a;c.fillRect(fx+Math.cos(ra)*3-1,fy+Math.sin(ra)*3-1,2,2);
  });
}
function drawNeonSign(c,x,y,t,aT){
  c.fillStyle='#0e0020';c.fillRect(x+1,y+2,t-2,t-4);
  const on=Math.sin(aT*3+(x+y)*.5)>-.3;
  c.fillStyle=on?'#ff44cc':'#330022';c.fillRect(x+3,y+4,t-6,4);
}
function drawBarrel(c,x,y,t){
  c.fillStyle='#1a1006';c.fillRect(x+3,y+2,t-6,t-3);
  c.fillStyle='#2a1a0a';c.fillRect(x+4,y+3,t-8,t-5);
  [4,9,14].forEach(dy=>c.fillRect(x+3,y+dy,t-6,2));
  c.fillStyle='rgba(255,100,0,.35)';c.fillRect(x+4,y+6,t-8,2);
}
function drawPipe(c,x,y,t){
  c.fillStyle='#1e1006';c.fillRect(x+t/2-3,y,6,t);
  c.fillStyle='#2e1808';c.fillRect(x+t/2-2,y+1,4,t-2);
  c.fillStyle='#3a2010';[2,t/2,t-3].forEach(ry=>c.fillRect(x+t/2-3,y+ry,6,2));
}

// ═══════════════════════════════════════════════════════════
// GAME THEMES
// ═══════════════════════════════════════════════════════════
const GTHEMES=[
  {id:'server',col:'#00cc66',bg:'#041008',propChance:.20,propTypes:['rack','rack','cable'],
    drawWall(c,x,y,t,aT,ip,pt){
      if(ip){if(pt==='rack')drawServerRack(c,x,y,t,aT);else drawCableBox(c,x,y,t);return;}
      c.fillStyle='#001a08';c.fillRect(x,y,t,t);
      c.fillStyle='#002a10';for(let i=0;i<t;i+=4)c.fillRect(x,y+i,t,2);
      c.fillStyle='#003018';c.fillRect(x,y,t,4);
    },
    drawFloor(c,x,y,t,gx,gy){c.fillStyle=(gx+gy)%2===0?'#020d06':'#030f07';c.fillRect(x,y,t,t);c.strokeStyle='rgba(0,40,15,.7)';c.lineWidth=.5;c.strokeRect(x+.5,y+.5,t-1,t-1);},
    drawHide(c,x,y,t){c.fillStyle='#001808';c.fillRect(x,y,t,t);c.strokeStyle='rgba(0,255,100,.32)';c.lineWidth=.8;c.strokeRect(x+1,y+1,t-2,t-2);}
  },
  {id:'office',col:'#8899ff',bg:'#0d1220',propChance:.18,propTypes:['computer','plant','cabinet'],
    drawWall(c,x,y,t,aT,ip,pt){
      if(ip){c.fillStyle='#0a0f1c';c.fillRect(x,y,t,t);if(pt==='computer')drawComputer(c,x,y,t,aT);else if(pt==='plant')drawPlant(c,x,y,t,aT);else drawFilingCabinet(c,x,y,t);return;}
      c.fillStyle='#1a2240';c.fillRect(x,y,t,t);c.fillStyle='#101828';for(let i=2;i<t;i+=6)c.fillRect(x+2,y+i,t-4,1);c.fillStyle='#2a3a60';c.fillRect(x,y,t,3);
    },
    drawFloor(c,x,y,t,gx,gy){c.fillStyle=(gx+gy)%2===0?'#0d1220':'#0a0f1c';c.fillRect(x,y,t,t);c.strokeStyle='rgba(40,60,100,.35)';c.lineWidth=.5;if(gx%2===0)c.strokeRect(x+2,y+2,t-4,t-4);},
    drawHide(c,x,y,t){c.fillStyle='#0c1830';c.fillRect(x,y,t,t);c.strokeStyle='rgba(100,130,255,.32)';c.lineWidth=.8;c.strokeRect(x+1,y+1,t-2,t-2);}
  },
  {id:'arctic',col:'#88ccee',bg:'#0a141e',propChance:.18,propTypes:['pillar','crate'],
    drawWall(c,x,y,t,aT,ip,pt){
      if(ip){c.fillStyle='#060d14';c.fillRect(x,y,t,t);if(pt==='pillar')drawIcePillar(c,x,y,t,aT);else drawSnowCrate(c,x,y,t);return;}
      c.fillStyle='#1a2e44';c.fillRect(x,y,t,t);c.fillStyle='rgba(180,220,255,.06)';c.fillRect(x,y,t/2,t/2);
      c.strokeStyle='rgba(80,140,200,.18)';c.lineWidth=.7;c.strokeRect(x+1,y+1,t-2,t-2);
    },
    drawFloor(c,x,y,t,gx,gy){c.fillStyle=(gx+gy)%2===0?'#0c1a26':'#0a1620';c.fillRect(x,y,t,t);c.strokeStyle='rgba(80,140,200,.10)';c.lineWidth=.5;c.strokeRect(x+.5,y+.5,t-1,t-1);},
    drawHide(c,x,y,t){c.fillStyle='#0a1c2c';c.fillRect(x,y,t,t);c.strokeStyle='rgba(120,200,255,.32)';c.lineWidth=.8;c.strokeRect(x+1,y+1,t-2,t-2);}
  },
  {id:'neon',col:'#cc44bb',bg:'#0f0018',propChance:.18,propTypes:['vent','sign'],
    drawWall(c,x,y,t,aT,ip,pt){
      if(ip){c.fillStyle='#080010';c.fillRect(x,y,t,t);if(pt==='vent')drawVentStack(c,x,y,t,aT);else drawNeonSign(c,x,y,t,aT);return;}
      c.fillStyle='#1e0030';c.fillRect(x,y,t,t);c.fillStyle='rgba(80,0,120,.45)';for(let i=3;i<t;i+=5)c.fillRect(x+2,y+i,t-4,2);
      c.fillStyle='rgba(200,68,180,.25)';c.fillRect(x,y,1,t);c.fillRect(x+t-1,y,1,t);
    },
    drawFloor(c,x,y,t,gx,gy){c.fillStyle=(gx+gy)%2===0?'#0e0018':'#0c0015';c.fillRect(x,y,t,t);c.strokeStyle='rgba(140,0,110,.12)';c.lineWidth=.5;c.strokeRect(x+.5,y+.5,t-1,t-1);},
    drawHide(c,x,y,t){c.fillStyle='#080010';c.fillRect(x,y,t,t);c.strokeStyle='rgba(200,60,220,.32)';c.lineWidth=.8;c.strokeRect(x+1,y+1,t-2,t-2);}
  },
  {id:'bunker',col:'#cc6622',bg:'#120a02',propChance:.18,propTypes:['barrel','pipe'],
    drawWall(c,x,y,t,aT,ip,pt){
      if(ip){c.fillStyle='#0a0600';c.fillRect(x,y,t,t);if(pt==='barrel')drawBarrel(c,x,y,t);else drawPipe(c,x,y,t);return;}
      c.fillStyle='#1e1206';c.fillRect(x,y,t,t);c.strokeStyle='rgba(10,6,0,.65)';c.lineWidth=1;
      const off=(Math.floor(y/t)%2)*Math.floor(t/2);c.beginPath();c.moveTo(x+off,y+t/2);c.lineTo(x+t,y+t/2);c.stroke();
      c.fillStyle='#2e1a08';c.fillRect(x,y,t,3);
    },
    drawFloor(c,x,y,t,gx,gy){c.fillStyle=(gx+gy)%2===0?'#140c02':'#100a02';c.fillRect(x,y,t,t);c.strokeStyle='rgba(30,15,0,.40)';c.lineWidth=.5;c.strokeRect(x+.5,y+.5,t-1,t-1);},
    drawHide(c,x,y,t){c.fillStyle='#0a0600';c.fillRect(x,y,t,t);c.strokeStyle='rgba(220,120,0,.32)';c.lineWidth=.8;c.strokeRect(x+1,y+1,t-2,t-2);}
  },
];

// ═══════════════════════════════════════════════════════════
// MAZE GENERATOR
// ═══════════════════════════════════════════════════════════
function generateMaze(C,R){
  const g=Array.from({length:R},()=>Array(C).fill(1));
  const v=Array.from({length:R},()=>Array(C).fill(false));
  function carve(cx,cy){
    v[cy][cx]=true;g[cy][cx]=0;
    const dirs=[[0,-2],[0,2],[-2,0],[2,0]].sort(()=>Math.random()-.5);
    for(const[dx,dy]of dirs){const nx=cx+dx,ny=cy+dy;if(nx>0&&nx<C-1&&ny>0&&ny<R-1&&!v[ny][nx]){g[cy+dy/2][cx+dx/2]=0;carve(nx,ny);}}
  }
  carve(1,1);
  for(let y=1;y<R-1;y++)for(let x=1;x<C-1;x++){
    if(g[y][x]===1&&Math.random()<.28){
      if((g[y][x-1]===0&&g[y][x+1]===0)||(g[y-1][x]===0&&g[y+1][x]===0))g[y][x]=0;
    }
  }
  return g;
}

// ═══════════════════════════════════════════════════════════
// BFS — parent-map approach (no array spread, no GC pressure)
// ═══════════════════════════════════════════════════════════
function bfs(maze,sx,sy,ex,ey,C,R){
  if(maze[sy][sx]!==0||maze[ey][ex]!==0)return[];
  const INF=999999;
  const dist=new Int32Array(C*R).fill(INF);
  const par =new Int32Array(C*R).fill(-1);
  const queue=new Int32Array(C*R*4);
  let head=0,tail=0;
  const si=sy*C+sx;dist[si]=0;queue[tail++]=sx;queue[tail++]=sy;
  while(head<tail){
    const cx=queue[head++],cy=queue[head++];
    if(cx===ex&&cy===ey)break;
    const ci=cy*C+cx;
    const nbrs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(let k=0;k<4;k++){
      const nx=cx+nbrs[k][0],ny=cy+nbrs[k][1];
      if(nx<0||nx>=C||ny<0||ny>=R||maze[ny][nx]!==0)continue;
      const ni=ny*C+nx;
      if(dist[ni]===INF){dist[ni]=dist[ci]+1;par[ni]=ci;queue[tail++]=nx;queue[tail++]=ny;}
    }
  }
  const path=[];let ci=ey*C+ex;
  if(dist[ci]===INF)return[];
  while(ci!==si){
    path.unshift({x:ci%C,y:Math.floor(ci/C)});ci=par[ci];
  }
  return path;
}

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
const COLS=28,ROWS=28;
let TILE=20;
const G={
  mode:null,themeIdx:0,maze:null,propGrid:null,hideGrid:null,
  px:1,py:1,pDir:1,keysGot:0,
  puHeld:null,puActive:null,blockPlaced:false,
  keys:[],exit:null,powerups:[],
  guards:[],guardTimers:[0,0,0],patrolT:[0,0],chaseUntil:[0,0],nextDecision:[0,0],
  phantom:null,phantomTimer:0,phantomHiding:false,phantomHideTimer:0,
  animT:0,lastTs:0,status:'playing',
  particles:[],
  pickupFlash:0,   // timer for pickup flash overlay
  pickupColor:'#fff',
};
// Static maze canvas — re-rendered only when maze changes
let mazeCanvas=null;
let mazeDirty=true;
let propAnimFrame=0,propAnimTimer=0; // for animated props (plants, LEDs)

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function buildGame(){
  const tidx=GTHEMES.findIndex(t=>t.id===selTheme);
  G.themeIdx=tidx>=0?tidx:0;G.mode=selMode;
  G.maze=generateMaze(COLS,ROWS);
  G.propGrid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  G.hideGrid=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  G.keysGot=0;G.puHeld=null;G.puActive=null;G.blockPlaced=false;
  G.status='playing';G.animT=0;G.lastTs=0;
  G.guardTimers=[0,0,0];G.patrolT=[0,0];G.chaseUntil=[0,0];G.nextDecision=[0,0];
  G.phantomTimer=0;G.phantomHiding=false;G.phantomHideTimer=0;
  G.particles=[];G.pDir=1;G.pickupFlash=0;
  mazeDirty=true;walkTimer=0;walkFrame=0;

  const th=GTHEMES[G.themeIdx];
  const wt=[];
  for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){
    if(G.maze[y][x]===1){let wn=0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{if(G.maze[y+dy]?.[x+dx]===1)wn++;});if(wn>=2)wt.push({x,y});}
  }
  shuffle(wt);
  wt.forEach((t,i)=>{if(Math.random()<th.propChance)G.propGrid[t.y][t.x]=th.propTypes[i%th.propTypes.length];});

  const free=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(G.maze[y][x]===0)free.push({x,y});
  shuffle(free);let fi=0;
  const taken=new Set(['1,1']);
  function nf(md=0){
    while(fi<free.length){
      const t=free[fi++];if(taken.has(`${t.x},${t.y}`))continue;
      if(md>0&&Math.abs(t.x-1)+Math.abs(t.y-1)<md)continue;
      taken.add(`${t.x},${t.y}`);return t;
    }
    // Shuffled pass (respecting the min-distance constraint) ran out — retry the
    // full free-cell list ignoring `md` instead of falling back to a hardcoded
    // coordinate, which isn't guaranteed to be open or unclaimed (it happens to
    // be guard 0's own start tile) and could place an item on a wall or on top
    // of something else.
    for(let i=0;i<free.length;i++){
      const t=free[i];if(taken.has(`${t.x},${t.y}`))continue;
      taken.add(`${t.x},${t.y}`);return t;
    }
    return{x:COLS-3,y:ROWS-3}; // every open cell in the maze is already claimed
  }
  G.px=1;G.py=1;
  G.guards=[
    {x:COLS-3,y:ROWS-3,path:[],pathAge:0,spd:0,col:'#ee2244',skey:'warden'},
    {x:COLS-3,y:1,     path:[],pathAge:0,spd:0,col:'#ee6600',skey:'interceptor'},
    {x:1,     y:ROWS-3,path:[],pathAge:0,spd:0,col:'#cc22ee',skey:'scanner'},
  ];
  // Guard speeds: chaser fast, patrollers medium
  G.guards[0].spd=0.28; G.guards[1].spd=0.42; G.guards[2].spd=0.42;
  G.guards.forEach(g=>taken.add(`${g.x},${g.y}`));
  G.exit=nf(12);
  G.keys=[nf(4),nf(4),nf(4)].map(k=>({...k,got:false}));
  G.powerups=[nf(3),nf(3)].map((p,i)=>({...p,got:false,
    type:selMode==='attacker'?(i===0?'phantom':'killshot'):(i===0?'titan':'surge')}));
  for(let i=0;i<8;i++){const h=nf(2);if(h)G.hideGrid[h.y][h.x]=true;}
  if(selMode==='defender'){G.phantom=nf(10);G.phantom.path=[];G.phantom.keysGot=0;}
}

// ═══════════════════════════════════════════════════════════
// GUARD AI — per-guard timers
// ═══════════════════════════════════════════════════════════
const PAT_WP=[
  [{x:COLS-3,y:ROWS-3},{x:COLS-3,y:1}],
  [{x:1,y:ROWS-3},{x:COLS-3,y:ROWS-3}],
];
function stepGuards(dt){
  const playerHiding=G.hideGrid[G.py]?.[G.px];
  G.guards.forEach((g,gi)=>{
    if(g.x<0)return; // eliminated
    G.guardTimers[gi]+=dt;
    if(G.guardTimers[gi]<g.spd)return;
    G.guardTimers[gi]=0;
    let tx,ty;
    if(gi===0){
      if(playerHiding){
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{const nx=g.x+dx,ny=g.y+dy;return nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&G.maze[ny][nx]===0;});
        if(dirs.length){const d=dirs[Math.floor(Math.random()*dirs.length)];g.x+=d[0];g.y+=d[1];}return;
      }
      tx=G.mode==='attacker'?G.px:G.phantom?.x??G.px;
      ty=G.mode==='attacker'?G.py:G.phantom?.y??G.py;
    } else {
      // Sticky chase/patrol decision: re-rolled only every ~2-4s (not every
      // AI tick) so a guard commits to chasing or patrolling instead of
      // flip-flopping tick-to-tick. Hiding always interrupts an active chase.
      const idx=gi-1;
      if(playerHiding){
        G.chaseUntil[idx]=0;
      } else if(G.animT>=G.nextDecision[idx]){
        G.nextDecision[idx]=G.animT+2+Math.random()*2;
        G.chaseUntil[idx]=Math.random()<.35?G.animT+2+Math.random()*2:0;
      }
      if(!playerHiding&&G.animT<G.chaseUntil[idx]){
        tx=G.mode==='attacker'?G.px:G.phantom?.x??G.px;
        ty=G.mode==='attacker'?G.py:G.phantom?.y??G.py;
      } else {
        const wp=PAT_WP[idx];const cur=wp[G.patrolT[idx]];
        if(g.x===cur.x&&g.y===cur.y)G.patrolT[idx]=(G.patrolT[idx]+1)%wp.length;
        const next=wp[G.patrolT[idx]];tx=next.x;ty=next.y;
      }
    }
    g.pathAge++;
    if(g.path.length===0||g.pathAge>6){g.path=bfs(G.maze,g.x,g.y,tx,ty,COLS,ROWS);g.pathAge=0;}
    if(g.path.length){const n=g.path.shift();g.x=n.x;g.y=n.y;}
  });
}

// ═══════════════════════════════════════════════════════════
// PHANTOM AI — smarter path, 0.5s step
// ═══════════════════════════════════════════════════════════
function stepPhantom(dt){
  if(!G.phantom||G.status!=='playing')return;
  G.phantomTimer+=dt;
  if(G.phantomHiding){G.phantomHideTimer-=dt;if(G.phantomHideTimer<=0)G.phantomHiding=false;return;}
  if(G.phantomTimer<0.5)return;
  G.phantomTimer=0;
  const ph=G.phantom;
  const uncollected=G.keys.filter(k=>!k.got);
  let tx,ty;
  if(uncollected.length>0){
    let best=null,bd=99999;
    uncollected.forEach(k=>{const d=Math.abs(k.x-ph.x)+Math.abs(k.y-ph.y);if(d<bd){bd=d;best=k;}});
    tx=best.x;ty=best.y;
    // occasional feint
    if(Math.random()<.12){tx+=Math.round((Math.random()-.5)*4);ty+=Math.round((Math.random()-.5)*4);}
    tx=Math.max(1,Math.min(COLS-2,tx));ty=Math.max(1,Math.min(ROWS-2,ty));
    if(G.maze[ty][tx]!==0){tx=best.x;ty=best.y;}
  } else {tx=G.exit.x;ty=G.exit.y;}
  if(ph.path.length===0||Math.random()<.12)ph.path=bfs(G.maze,ph.x,ph.y,tx,ty,COLS,ROWS);
  if(ph.path.length){const n=ph.path.shift();ph.x=n.x;ph.y=n.y;}
  G.keys.forEach(k=>{if(!k.got&&k.x===ph.x&&k.y===ph.y){k.got=true;ph.keysGot++;}});
  if(G.hideGrid[ph.y]?.[ph.x]&&Math.random()<.35){G.phantomHiding=true;G.phantomHideTimer=5;}
}

// ═══════════════════════════════════════════════════════════
// STATIC MAZE CANVAS — only redrawn when mazeDirty
// ═══════════════════════════════════════════════════════════
function rebakeMaze(aT){
  const th=GTHEMES[G.themeIdx];
  const ctx=mazeCanvas.getContext('2d');
  ctx.fillStyle=th.bg;ctx.fillRect(0,0,mazeCanvas.width,mazeCanvas.height);
  for(let gy=0;gy<ROWS;gy++)for(let gx=0;gx<COLS;gx++){
    const px=gx*TILE,py=gy*TILE;
    if(G.maze[gy][gx]===1)th.drawWall(ctx,px,py,TILE,aT,!!G.propGrid[gy][gx],G.propGrid[gy][gx]);
    else if(G.hideGrid[gy][gx])th.drawHide(ctx,px,py,TILE);
    else th.drawFloor(ctx,px,py,TILE,gx,gy);
  }
  mazeDirty=false;
}

// Prop animation only needs to re-render wall tiles with animated props
// We re-render only the animated prop tiles (not the whole maze) every ~0.5s
let propRerenderTimer=0;
const ANIM_PROP_TYPES=new Set(['rack','computer','plant','vent','sign','pillar']);
function rerenderAnimatedProps(aT){
  const th=GTHEMES[G.themeIdx];
  const ctx=mazeCanvas.getContext('2d');
  for(let gy=0;gy<ROWS;gy++)for(let gx=0;gx<COLS;gx++){
    const pt=G.propGrid[gy][gx];
    if(pt&&ANIM_PROP_TYPES.has(pt)){
      const px=gx*TILE,py=gy*TILE;
      th.drawWall(ctx,px,py,TILE,aT,true,pt);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// HERO ROBOT ROWS + PALETTES (from hero-transform)
// ═══════════════════════════════════════════════════════════
const robotRows=[
  '       2344443333432        ','      23455555555443 2      ','     2Q4555Q555Q5554Q2      ',
  '    2QQ445555555554QQ2      ','    2QQ45Qn3333nQ54QQ2      ','    2QQ4VVVVVVVVV4QQ2       ',
  '    2QQ4VvvLLLLvvV4QQ2      ','    2QQ4VvLlllllLvV4QQ2     ','    2QQ4VvLlllllLvV4QQ2     ',
  '    2QQ4VvvvvvvvvvV4QQ2     ','    2QQ4VVVVVVVVV4QQ2       ','    2QQ45Qn3333nQ54QQ2      ',
  '     2QQ45555555554QQ2      ','      23Q444444444Q32       ','       233333333332         ',
  '  AaDD23CCcxXXXxcCC32DDAa   ','  AaDD23CcxXeeeXxcC32DDAa   ','  AaDD23CcxXeeeXxcC32DDAa   ',
  '  AaDD23CcxXeeeXxcC32DDAa   ','  AaDD23CCcxXXXxcCC32DDAa   ','   AaD233n2nnnnn2n332DAa    ',
  '   AaD23BBbBBBBbBB32DAa     ','  GGgq23PPpPPPPpPP32qgGG    ','  GGgq23PPpPPPPpPP32qgGG    ',
  '  GGgq23PPpPPPPpPP32qgGG    ','  GGgr23PPpPPPPpPP32rgGG    ','   GGg23PP      PP32gGG     ',
  '   FFt23FwFFF FFFwF32tFF    ','   FFt23FwFFF FFFwF32tFF    ','   FFt23FwFFF FFFwF32tFF    ',
  '   FFs23FFFFF FFFFF32sFF    ','   FFs23FFFFF FFFFF32sFF    ','  FFss23FFFFF FFFFF32ssFF   ',
  '  FffssFFFFFF FFFFFF32ssffF  ',
];
const HERO_PALS={
  phantom:{'0':'#010810','1':'#040f1e','2':'#081828','3':'#102a42','4':'#1c4a70','5':'#2e6a90','6':'#60a0c0',Q:'#1a5a7a',n:'#040e1a',r:'#60b0d0',V:'#020c16',v:'#0a2030',L:'#00bbdd',l:'#00e5ff',A:'#103858',a:'#040e18',D:'#206888',C:'#102a42',c:'#040e18',X:'#00e5ff',e:'#0090aa',B:'#040e1a',b:'#00ccee',P:'#0c2238',p:'#060f1c',G:'#c8dde8',g:'#ffffff',F:'#b0ccd8',t:'#6090a8',w:'#ffffff',s:'#405060',f:'#d8eaf4'},
  killshot:{'0':'#0e0300','1':'#1c0700','2':'#340e00','3':'#5a1c00','4':'#8a3000','5':'#b04400','6':'#d06020',Q:'#7a2c00',n:'#cc6600',r:'#e8a000',V:'#0e0300',v:'#340e00',L:'#ffcc00',l:'#fff0aa',A:'#6a2400',a:'#200800',D:'#9a3800',C:'#5a1c00',c:'#1c0700',X:'#ff8800',e:'#cc5500',B:'#120500',b:'#ffaa00',P:'#341000',p:'#180700',G:'#8a1a00',g:'#cc3300',F:'#6e0000',t:'#3a0000',w:'#cc2200',s:'#280000',f:'#8a0000'},
  titan:   {'0':'#040810','1':'#080f1c','2':'#101c34','3':'#1c2e50','4':'#2a4270','5':'#3a5a90','6':'#5a7aaa',Q:'#1c3060',n:'#5599ff',r:'#5599ff',V:'#04080e',v:'#0c1830',L:'#5599ff',l:'#bbddff',A:'#101c34',a:'#040810',D:'#2a4270',C:'#1c2e50',c:'#080f1c',X:'#5599ff',e:'#1c3a88',B:'#06090e',b:'#2266dd',P:'#101c34',p:'#060c18',G:'#5a3a00',g:'#8a6000',F:'#4a3000',t:'#1e1400',w:'#9a7000',s:'#1e1400',f:'#6a4800'},
  surge:   {'0':'#000e04','1':'#001808','2':'#002810','3':'#003c18','4':'#005828','5':'#007838','6':'#00aa50',Q:'#004820',n:'#00ff88',r:'#00ff88',V:'#000e04',v:'#001c0a',L:'#00ff88',l:'#aaffcc',A:'#003418',a:'#001208',D:'#006030',C:'#003c18',c:'#001208',X:'#00ff88',e:'#008040',B:'#000e04',b:'#00dd66',P:'#002810',p:'#001008',G:'#c8f0d8',g:'#ffffff',F:'#b0ddc0',t:'#508060',w:'#ffffff',s:'#304840',f:'#d0f0e0'},
};
const HERO_COLORS={phantom:'#00e5ff',killshot:'#ffcc00',titan:'#5599ff',surge:'#00ff88'};
const HERO_NAMES={phantom:'PHANTOM',killshot:'VOLTAGE',titan:'TITAN',surge:'SURGE'};
const HERO_SUBS={phantom:'5 SEC IMMUNITY · GUARDS PASS THROUGH',killshot:'VOLTAGE · ONE-HIT GUARD KILL',titan:'TITAN BLOCK · SEAL A CORRIDOR',surge:'SURGE SPEED · 5 SEC BOOST'};

// ─── TRANSFORM OVERLAY ────────────────────────────────────
const TC=document.getElementById('tc');
const tctx=TC.getContext('2d');
let txActive=false,txTimer=0,txHero=null,txWt=0;
const RPS=4;

function triggerTransform(type){txHero=type;txTimer=0;txActive=true;txWt=0;TC.style.opacity='1';}

function drawRobotOnCtx(ctx,pal,cx,cy,scale,wt){
  const rw=Math.max(...robotRows.map(r=>r.length)),rh=robotRows.length;
  const bob=Math.sin(wt*Math.PI*2)*2;
  const sL=Math.sin(wt*Math.PI*2)*2.5,sR=-sL;
  ctx.save();ctx.translate(cx,cy+bob);ctx.scale(scale,scale);
  robotRows.forEach((row,ry)=>{
    for(let rx=0;rx<row.length;rx++){
      const ch=row[rx];if(ch===' ')continue;const col=pal[ch];if(!col)continue;
      let px=rx,py=ry;
      if(ry<=14)px+=Math.sin(wt*Math.PI*2)*.5;
      else if(ry>=22&&ry<=26)py+=(rx<rw/2?sL*.3:sR*.3);
      else if(ry>=27)py+=(rx<rw/2?sL:sR);
      ctx.fillStyle=col;ctx.fillRect(-rw/2*RPS+px*RPS,-rh/2*RPS+py*RPS,RPS,RPS);
    }
  });
  ctx.restore();
}

function updateTransform(dt){
  if(!txActive)return;
  txTimer+=dt;txWt=(txWt+dt*.9)%1;
  tctx.clearRect(0,0,TC.width,TC.height);
  const col=HERO_COLORS[txHero]||'#fff';
  const pal=HERO_PALS[txHero]||HERO_PALS.phantom;
  const cx=TC.width/2,cy=TC.height/2;
  const rgb=parseInt(col.slice(1),16);
  const r=(rgb>>16)&255,gb=(rgb>>8)&255,b=rgb&255;
  if(txTimer<0.25){
    const p=txTimer/0.25;
    tctx.fillStyle=`rgba(${r},${gb},${b},${.5*(1-p)})`;tctx.fillRect(0,0,TC.width,TC.height);
    for(let i=0;i<3;i++){
      const rr=p*TC.width*.6*(i*.3+.4);
      tctx.strokeStyle=`rgba(${r},${gb},${b},${Math.max(0,1-p-i*.2)})`;
      tctx.lineWidth=3-i;tctx.beginPath();tctx.arc(cx,cy,rr,0,Math.PI*2);tctx.stroke();
    }
  } else if(txTimer<3.0){
    const entry=Math.min(1,(txTimer-.25)/.4);
    tctx.fillStyle='rgba(0,0,0,.88)';tctx.fillRect(0,0,TC.width,TC.height);
    const grd=tctx.createRadialGradient(cx,cy,0,cx,cy,120);
    grd.addColorStop(0,`rgba(${r},${gb},${b},.14)`);grd.addColorStop(1,'rgba(0,0,0,0)');
    tctx.fillStyle=grd;tctx.fillRect(0,0,TC.width,TC.height);
    const sc=entry*(TC.width<400?.7:.9);
    drawRobotOnCtx(tctx,pal,cx,cy-24,sc,txWt);
    const fs1=Math.max(8,Math.floor(TC.width*.026));
    tctx.font=`bold ${fs1}px 'Press Start 2P'`;tctx.textAlign='center';
    tctx.fillStyle=col;tctx.fillText(HERO_NAMES[txHero]||'',cx,cy+88);
    const fs2=Math.max(5,Math.floor(TC.width*.014));
    tctx.font=`${fs2}px 'Press Start 2P'`;tctx.fillStyle='rgba(255,255,255,.32)';
    tctx.fillText(HERO_SUBS[txHero]||'',cx,cy+108);
  } else {
    const fade=Math.max(0,1-(txTimer-3.0)/.4);
    tctx.fillStyle=`rgba(0,0,0,${1-fade})`;tctx.fillRect(0,0,TC.width,TC.height);
    TC.style.opacity=String(fade);
    if(txTimer>3.4){txActive=false;TC.style.opacity='0';}
  }
}

// ═══════════════════════════════════════════════════════════
// PARTICLE EFFECTS
// ═══════════════════════════════════════════════════════════
function spawnParticles(x,y,col,count=10){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,spd=TILE*(.3+Math.random()*.7);
    G.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:1,col,size:Math.random()*3+1});
  }
}
function updateParticles(dt){
  G.particles=G.particles.filter(p=>{
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;p.life-=dt*2;return p.life>0;
  });
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
const GC=document.getElementById('gc');
const gctx=GC.getContext('2d');
gctx.imageSmoothingEnabled=false;

function renderGame(){
  const th=GTHEMES[G.themeIdx];
  // 1. Blit static maze (no filter — killed for perf)
  if(mazeDirty)rebakeMaze(G.animT);
  gctx.drawImage(mazeCanvas,0,0);

  // 2. Prop anim re-bake every 0.5s (only animated props, timer advanced in gameLoop)

  // 3. Vignette (single gradient, no shadowBlur)
  const vg=gctx.createRadialGradient(GC.width/2,GC.height/2,GC.width*.12,GC.width/2,GC.height/2,GC.width*.58);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.22)');
  gctx.fillStyle=vg;gctx.fillRect(0,0,GC.width,GC.height);

  // 4. Exit
  const exitOpen=G.mode==='attacker'&&G.keysGot>=3;
  const ex=G.exit.x*TILE,ey=G.exit.y*TILE;
  gctx.fillStyle=th.col;gctx.globalAlpha=exitOpen?.95:.45;
  gctx.fillRect(ex+3,ey+3,TILE-6,TILE-6);
  gctx.globalAlpha=1;
  if(exitOpen){
    gctx.strokeStyle=th.col;gctx.lineWidth=2;
    gctx.strokeRect(ex+1,ey+1,TILE-2,TILE-2);
  }
  gctx.fillStyle='rgba(255,255,255,.38)';gctx.font=`${Math.max(4,TILE*.24)}px "JetBrains Mono"`;
  gctx.textAlign='center';gctx.fillText('EXIT',ex+TILE/2,ey+TILE/2+2);

  // 5. Keys — pixel art sprite with warm glow
  const keySpr=spriteCaches.key;
  G.keys.forEach((k,i)=>{
    if(k.got)return;
    const bob=Math.sin(G.animT*3+i*2.1)*2;
    // warm amber background tile
    gctx.fillStyle='rgba(200,140,0,.12)';gctx.fillRect(k.x*TILE,k.y*TILE,TILE,TILE);
    gctx.drawImage(keySpr,k.x*TILE,k.y*TILE+bob,TILE,TILE);
    // single gold ring
    gctx.strokeStyle='#e8b800';gctx.lineWidth=1;gctx.globalAlpha=.35+.2*Math.sin(G.animT*2+i);
    gctx.strokeRect(k.x*TILE+1,k.y*TILE+1+bob,TILE-2,TILE-2);
    gctx.globalAlpha=1;
  });

  // 6. Power-ups — pixel art + glow ring + type label
  G.powerups.forEach((p,i)=>{
    if(p.got)return;
    const col=HERO_COLORS[p.type]||'#ff7700';
    const puSprKey='pu_'+p.type;
    const spr=spriteCaches[puSprKey]||spriteCaches.pu_phantom;
    // color tint overlay first
    gctx.fillStyle=col;gctx.globalAlpha=.22;gctx.fillRect(p.x*TILE,p.y*TILE,TILE,TILE);gctx.globalAlpha=1;
    gctx.drawImage(spr,p.x*TILE,p.y*TILE,TILE,TILE);
    // pulsing double border
    const pa=.5+.4*Math.sin(G.animT*4+i);
    gctx.strokeStyle=col;gctx.lineWidth=2;gctx.globalAlpha=pa;
    gctx.strokeRect(p.x*TILE+1,p.y*TILE+1,TILE-2,TILE-2);
    gctx.lineWidth=1;gctx.globalAlpha=pa*.5;
    gctx.strokeRect(p.x*TILE+3,p.y*TILE+3,TILE-6,TILE-6);
    gctx.globalAlpha=1;
    // type label above sprite
    const label=HERO_NAMES[p.type]||'PU';
    const fs=Math.max(4,TILE*.20);
    gctx.font=`${fs}px "JetBrains Mono"`;
    gctx.textAlign='center';
    gctx.fillStyle=col;
    gctx.globalAlpha=.8+.2*Math.sin(G.animT*3+i);
    gctx.fillText(label,p.x*TILE+TILE/2,p.y*TILE-2);
    gctx.globalAlpha=1;
  });

  // 7. Guards — pixel art sprites
  const gWalkPhase=[G.animT,G.animT+.33,G.animT+.66];
  G.guards.forEach((g,gi)=>{
    if(g.x<0)return;
    const spr=spriteCaches[g.skey]||spriteCaches.warden;
    const px=g.x*TILE,py=g.y*TILE;
    // walk bob
    const bob=Math.abs(Math.sin(gWalkPhase[gi]*Math.PI*2))*2;
    gctx.drawImage(spr,px,py-bob,TILE,TILE);
    // colored outline ring for readability
    gctx.strokeStyle=g.col;gctx.lineWidth=1.5;gctx.globalAlpha=.6+.2*Math.sin(G.animT*3+gi);
    gctx.strokeRect(px+1,py+1-bob,TILE-2,TILE-2);gctx.globalAlpha=1;
  });

  // 8. Phantom
  if(G.mode==='defender'&&G.phantom&&!G.phantomHiding){
    const ph=G.phantom;
    const spr=spriteCaches.phantom;
    const bob=Math.sin(G.animT*2)*2;
    gctx.drawImage(spr,ph.x*TILE,ph.y*TILE+bob,TILE,TILE);
    gctx.strokeStyle='#cc00ff';gctx.lineWidth=1.5;
    gctx.globalAlpha=.5+.3*Math.sin(G.animT*3);gctx.strokeRect(ph.x*TILE+1,ph.y*TILE+1+bob,TILE-2,TILE-2);gctx.globalAlpha=1;
    // key count
    gctx.fillStyle='#ffcc44';gctx.font=`${Math.max(4,TILE*.22)}px "JetBrains Mono"`;gctx.textAlign='center';
    gctx.fillText(`[${ph.keysGot}/3]`,ph.x*TILE+TILE/2,ph.y*TILE+bob-2);
  }

  // 9. Player — pixel art sprite with walk bob
  {
    const hiding=G.hideGrid[G.py]?.[G.px];
    const ppx=G.px*TILE,ppy=G.py*TILE;
    const bob=Math.abs(Math.sin(walkFrame/8*Math.PI*2))*2;
    // player glow ring (no shadowBlur — just an alpha rect)
    gctx.fillStyle=HERO_COLORS[G.puActive?.type]||'#00c8e0';
    gctx.globalAlpha=.08;gctx.fillRect(ppx-2,ppy-2,TILE+4,TILE+4);gctx.globalAlpha=1;
    // sprite
    const isAtk=G.mode==='attacker';
    let spr;
    if(G.puActive){const prefix=isAtk?'powered_atk_':'powered_def_';spr=spriteCaches[prefix+G.puActive.type]||spriteCaches[isAtk?'hacker':'sentinel'];}
    else spr=spriteCaches[isAtk?'hacker':'sentinel'];
    gctx.globalAlpha=hiding?.28:1;
    gctx.drawImage(spr,ppx,ppy-bob,TILE,TILE);
    gctx.globalAlpha=1;
    if(hiding){
      gctx.strokeStyle='rgba(255,255,255,.5)';
      gctx.lineWidth=1;
      gctx.setLineDash([2,3]);
      gctx.globalAlpha=.5+.3*Math.sin(G.animT*6);
      gctx.strokeRect(ppx+1,ppy-bob+1,TILE-2,TILE-2);
      gctx.globalAlpha=1;
      gctx.setLineDash([]);
    }
    // power-up active: colored border
    if(G.puActive){
      const ac=HERO_COLORS[G.puActive.type];
      gctx.strokeStyle=ac;gctx.lineWidth=2;
      gctx.globalAlpha=.7+.2*Math.sin(G.animT*8);
      gctx.strokeRect(ppx+1,ppy+1-bob,TILE-2,TILE-2);gctx.globalAlpha=1;
    }
    if(hiding){
      gctx.fillStyle='rgba(0,200,255,.20)';gctx.font=`${Math.max(4,TILE*.22)}px "JetBrains Mono"`;
      gctx.textAlign='center';gctx.fillText('HIDDEN',ppx+TILE/2,ppy-4);
    }
  }

  // 10. Particles
  G.particles.forEach(p=>{
    gctx.globalAlpha=p.life;gctx.fillStyle=p.col;
    gctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  });
  gctx.globalAlpha=1;

  // 11. Pickup flash overlay
  if(G.pickupFlash>0){
    gctx.fillStyle=G.pickupColor;
    gctx.globalAlpha=G.pickupFlash*.35;
    gctx.fillRect(0,0,GC.width,GC.height);gctx.globalAlpha=1;
  }
}

// ═══════════════════════════════════════════════════════════
// COLLISION / LOGIC
// ═══════════════════════════════════════════════════════════
function checkCollisions(){
  if(G.status!=='playing')return;
  const ppx=G.px*TILE+TILE/2,ppy=G.py*TILE+TILE/2;
  // keys
  G.keys.forEach((k)=>{
    if(!k.got&&k.x===G.px&&k.y===G.py){
      k.got=true;G.keysGot++;
      spawnParticles(ppx,ppy,'#ccaa00',14);
      G.pickupFlash=1;G.pickupColor='#ccaa00';
      updateHUD();
    }
  });
  // power-ups
  G.powerups.forEach(p=>{
    if(!p.got&&p.x===G.px&&p.y===G.py&&!G.puHeld&&!G.puActive){
      p.got=true;G.puHeld={type:p.type};
      spawnParticles(ppx,ppy,HERO_COLORS[p.type]||'#ff7700',16);
      G.pickupFlash=1;G.pickupColor=HERO_COLORS[p.type]||'#ff7700';
      updateHUD();
    }
  });
  // guard collision (attacker)
  if(G.mode==='attacker'){
    const immune=G.puActive&&G.puActive.type==='phantom';
    G.guards.forEach((g,gi)=>{
      if(g.x<0)return;
      if(g.x===G.px&&g.y===G.py){
        if(G.puActive&&G.puActive.type==='killshot'){
          spawnParticles(g.x*TILE+TILE/2,g.y*TILE+TILE/2,'#ff2244',18);
          G.guards[gi]={...g,x:-99,y:-99,path:[]};
          G.puActive=null;updateHUD();
        } else if(!immune){endGame(false,'WARDEN CAUGHT YOU','mission failed — tagged by guard');}
      }
    });
    if(G.keysGot>=3&&G.px===G.exit.x&&G.py===G.exit.y)endGame(true,'MISSION COMPLETE','you escaped with all 3 keys');
  }
  // defender
  if(G.mode==='defender'&&G.phantom){
    if(!G.phantomHiding&&G.px===G.phantom.x&&G.py===G.phantom.y){
      spawnParticles(ppx,ppy,'#cc00ff',20);
      endGame(true,'PHANTOM TAGGED','breach intercepted — system secured');
    }
    if(G.phantom.keysGot>=3&&G.phantom.x===G.exit.x&&G.phantom.y===G.exit.y)
      endGame(false,'PHANTOM ESCAPED','breach successful — all keys extracted');
    G.guards.forEach(g=>{if(G.phantom&&!G.phantomHiding&&g.x===G.phantom.x&&g.y===G.phantom.y)
      endGame(true,'WARDEN TAGGED PHANTOM','automated defense intercepted the breach');});
  }
}
function endGame(win,title,sub){
  G.status=win?'win':'lose';
  document.getElementById('gm-title').textContent=title.toUpperCase();
  document.getElementById('gm-title').style.color=win?'#00ff88':'#ff2244';
  document.getElementById('gm-sub').textContent=sub;
  document.getElementById('game-msg').style.display='block';
}
function updateHUD(){
  for(let i=0;i<3;i++){
    const pip=document.getElementById(`kp${i}`);
    const wasGot=pip.classList.contains('got');
    pip.classList.toggle('got',i<G.keysGot);
    if(!wasGot&&i<G.keysGot){pip.classList.remove('flash');void pip.offsetWidth;pip.classList.add('flash');}
  }
  if(G.puActive){
    const t=Math.ceil(G.puActive.timer);
    const hpEl2=document.getElementById('hud-power');
    hpEl2.textContent=`${HERO_NAMES[G.puActive.type]} ${t}s`;
    hpEl2.style.fontWeight='bold';
    hpEl2.style.opacity='1';
    hpEl2.style.color=HERO_COLORS[G.puActive.type];
    hpEl2.style.cursor='';
  } else if(G.puHeld){
    const hpEl=document.getElementById('hud-power');
    hpEl.textContent=`[SPC/TAP] ${HERO_NAMES[G.puHeld.type]}`;
    hpEl.style.color=HERO_COLORS[G.puHeld.type];
    hpEl.style.fontWeight='bold';
    hpEl.style.opacity='1';
    hpEl.style.cursor='pointer';
  } else {
    const hpEl=document.getElementById('hud-power');
    hpEl.textContent='—';
    hpEl.style.color='';
    hpEl.style.fontWeight='';
    hpEl.style.opacity='';
    hpEl.style.cursor='';
  }
  if(G.mode==='defender'&&G.phantom)document.getElementById('ph-keys').textContent=G.phantom.keysGot;
  // hiding indicator
  const hiding=G.hideGrid[G.py]?.[G.px];
  const hidEl=document.getElementById('hud-hide');
  if(hidEl)hidEl.style.opacity=hiding?'1':'0';
}

// ═══════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════
let gameRunning=false;
let gameGen=0;
function gameLoop(ts,gen){
  if(!gameRunning||gen!==gameGen)return;
  const dt=Math.min((ts-G.lastTs)/1000,.05);G.lastTs=ts;G.animT+=dt;
  if(G.status==='playing'){
    stepGuards(dt);
    if(G.mode==='defender')stepPhantom(dt);
    checkCollisions();
    if(G.puActive){G.puActive.timer-=dt;if(G.puActive.timer<=0){G.puActive=null;updateHUD();}}
    // Surge speed: player moves every input but guard speed buff handled in input
    updateParticles(dt);
    stepWalk(dt);
    updateHUD();
    if(G.pickupFlash>0)G.pickupFlash-=dt*3;
    // re-bake animated props every 0.4s
    propRerenderTimer+=dt;
    if(propRerenderTimer>0.4){propRerenderTimer=0;rerenderAnimatedProps(G.animT);}
  }
  updateTransform(dt);
  renderGame();
  requestAnimationFrame(function(ts2){gameLoop(ts2,gen);});
}

// ═══════════════════════════════════════════════════════════
// START + RESTART
// ═══════════════════════════════════════════════════════════
function startGame(){
  bgActive=false;bgC.style.display='none';
  const maxSide=Math.min(innerWidth*.96,innerHeight*.82,640);
  TILE=Math.max(16,Math.floor(maxSide/28));
  GC.width=TC.width=TILE*COLS;GC.height=TC.height=TILE*ROWS;
  mazeCanvas=new OffscreenCanvas(TILE*COLS,TILE*ROWS);
  document.getElementById('game-hud').style.width=GC.width+'px';
  document.getElementById('game-bottom').style.width=GC.width+'px';
  buildSpriteCaches(TILE);
  buildGame();
  const th=GTHEMES[G.themeIdx];
  const badge=document.getElementById('hud-mode-badge');
  badge.textContent=G.mode==='attacker'?'ATK':'DEF';
  badge.style.color=G.mode==='attacker'?'#00e5ff':'#00ff88';
  badge.style.borderColor=G.mode==='attacker'?'rgba(0,229,255,.3)':'rgba(0,255,136,.3)';
  document.getElementById('gbot-phantom').style.display=G.mode==='defender'?'':'none';
  document.getElementById('game-msg').style.display='none';
  for(let i=0;i<3;i++)document.getElementById(`kp${i}`).classList.remove('got');
  document.getElementById('hud-power').textContent='—';
  updateHUD();
  gameGen++;const myGen=gameGen;
  gameRunning=true;G.lastTs=performance.now();
  requestAnimationFrame(function(ts){gameLoop(ts,myGen);});
}
function restartGame(){document.getElementById('game-msg').style.display='none';G.status='playing';buildGame();mazeDirty=true;updateHUD();}

// ═══════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════
function tryMove(dx,dy){
  if(G.status!=='playing')return;
  const surgeOn=G.puActive&&G.puActive.type==='surge';
  const steps=surgeOn?2:1; // surge = covers two tiles per keypress instead of one
  for(let i=0;i<steps;i++){
    const nx=G.px+dx,ny=G.py+dy;
    if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&G.maze[ny][nx]===0){
      G.px=nx;G.py=ny;G.pDir=dx>0?1:(dx<0?-1:G.pDir);
      checkCollisions();
      if(G.status!=='playing')break; // run ended mid-dash (e.g. caught by a guard)
    } else break; // wall blocked the rest of the dash
  }
}
// Was only reachable via the Space key — a touch player who picks up a
// power-up had no way to ever activate it. Extracted so both the keydown
// handler and a tap on the HUD power-up chip (see below) can trigger it.
function activatePower(){
  if(!G.puHeld||G.puActive)return;
  const type=G.puHeld.type;
  if(type==='titan'&&!G.blockPlaced){
    const ph=G.phantom;if(ph){
      const dx=Math.sign(ph.x-G.px),dy=Math.sign(ph.y-G.py);
      // Only fall back to placing the block to the right when the phantom is on
      // the player's own tile (dx===0 AND dy===0) — if the phantom is directly
      // above/below (dx===0, dy!==0), the block must follow dy, not default right.
      const fbx=(dx===0&&dy===0)?1:dx;
      const bx=G.px+fbx,by=G.py+dy;
      if(bx>0&&bx<COLS-1&&by>0&&by<ROWS-1&&G.maze[by][bx]===0){
        G.maze[by][bx]=1;G.blockPlaced=true;mazeDirty=true;
        spawnParticles(bx*TILE+TILE/2,by*TILE+TILE/2,'#5599ff',12);
      }
    }
    G.puHeld=null;triggerTransform(type);G.puActive={type,timer:.5,max:.5};
  } else {
    const dur=(type==='surge'||type==='phantom')?5:8;
    G.puActive={type,timer:dur,max:dur};G.puHeld=null;triggerTransform(type);
  }
  updateHUD();
}
function handleKey(e){
  // Always block scrolling keys when game is active
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)||e.code==='Space'){
    e.preventDefault();
  }
  const mv={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]}[e.key];
  if(mv){tryMove(mv[0],mv[1]);}
  if(e.code==='Space'||e.key===' '){
    activatePower();
  }
}
document.getElementById('hud-power').addEventListener('click',activatePower);
let touchX=0,touchY=0;
document.addEventListener('touchstart',e=>{touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;},{passive:true});
document.addEventListener('touchend',e=>{
  if(CUR!==4||G.status!=='playing')return;
  const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;
  if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
  if(Math.abs(dx)>Math.abs(dy))tryMove(dx>0?1:-1,0);else tryMove(0,dy>0?1:-1);
},{passive:true});

