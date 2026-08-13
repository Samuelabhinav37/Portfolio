/* Contact page recon-card engine. Extracted from an inline <script> block.
   Fully self-contained (no bare identifiers shared with other scripts on the
   page), so this is a straight move — no window.* export shim needed.
   The WebGL particle system (THREE stub, MODE, sampleImage, shaders,
   ReconCard class) that used to live here was confirmed 100% unreachable —
   mountAll() early-returned before ever instantiating ReconCard — and has
   been removed. The live HUD canvas overlays (HUDS/attachHUD) are the real
   per-card animated readout and are unaffected. */

function mountAll(){
  var stack=document.querySelector('.stack'); if(stack) stack.classList.add('ready');
  window.SITE._dbg=function(){};
}
if(document.readyState!=='loading')mountAll(); else document.addEventListener('DOMContentLoaded',mountAll);

// this whole engine had zero prefers-reduced-motion handling — the only
// animated widget on the site missing it. Every loop below now draws a
// single static frame and stops instead of animating continuously.
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// .stack (all 8 cards) is display:none on phone/tablet (<=900px, see
// contact.astro) — this engine is up to 8 concurrent per-frame canvas HUD
// loops, the heaviest thing on the page, so it never boots behind a hidden
// element rather than running invisibly. contact-window-stack.js mirrors this.
var LOW_POWER = !!(window.SITE && window.SITE.LOW_POWER);

/* ── HUD LAYER + GENTLE SYNC ─────────────────────────────────────────────
   Each card gets its own data readout matching its story beat, drawn sharp
   on the .hud canvas above the particles. A single slow global phase gives
   the whole board a shared, gentle breath (the "sync") without hard beats.  */

// slow global breath 0..1, shared by every HUD so the board feels unified
window.SITE._phase = 0;
(function breathe(){
  if(LOW_POWER) return;
  if(!document.hidden){ window.SITE._phase = (performance.now()/1000); }
  if(!reduce) requestAnimationFrame(breathe);
})();

// helper: standard corner ticks + shared breath glow
function hudChrome(ctx,W,H,S,t){
  ctx.strokeStyle='rgba(190,215,255,0.28)';ctx.lineWidth=1*S;
  ctx.beginPath();ctx.moveTo(W-15*S,H-6*S);ctx.lineTo(W-6*S,H-6*S);ctx.lineTo(W-6*S,H-15*S);ctx.stroke();
}
function mono(ctx,S){ ctx.font=(8*S)+"px 'JetBrains Mono',monospace"; }

// ---- per-card HUD draw functions, keyed by seq ----
var HUDS = {
  1: function(ctx,W,H,S,t){ // RECON — scan line, dead node, subnet
    mono(ctx,S);
    var sy=H*(0.16+0.46*(0.5+0.5*Math.sin(t*0.4)));
    ctx.strokeStyle='rgba(140,180,255,0.5)';ctx.lineWidth=1*S;
    ctx.beginPath();ctx.moveTo(W*0.46,sy);ctx.lineTo(W*0.93,sy);ctx.stroke();
    ctx.fillStyle='rgba(140,180,255,0.62)';ctx.textAlign='left';
    ctx.fillText('SCAN \u25b8 '+Math.floor(210+40*Math.sin(t*0.7))+' HOSTS',W*0.47,sy-5*S);
    var dx=W*0.82,dy=H*0.11,p=0.5+0.5*Math.sin(t*2);
    ctx.strokeStyle='rgba(255,74,28,'+(0.55+0.4*p)+')';ctx.lineWidth=1*S;
    ctx.beginPath();ctx.arc(dx,dy,(8+p*4)*S,0,6.28);ctx.stroke();
    ctx.beginPath();ctx.arc(dx,dy,2.3*S,0,6.28);ctx.fillStyle='rgba(255,74,28,'+(0.7+0.3*p)+')';ctx.fill();
    ctx.fillStyle='rgba(255,95,45,0.95)';ctx.textAlign='left';
    ctx.fillText('DANGLING CNAME',W*0.26,dy-5*S);
    ctx.fillStyle='rgba(255,95,45,0.6)';ctx.fillText('\u2192 NXDOMAIN',W*0.26,dy+7*S);
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.textAlign='right';
    ctx.fillText('10.4.0.0/16',W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  },
  2: function(ctx,W,H,S,t){ // ACCESS — breach box, PUT->200
    mono(ctx,S);
    var bx=W*0.6,by=H*0.5,p=0.5+0.5*Math.sin(t*2.2);
    ctx.strokeStyle='rgba(255,74,28,'+(0.55+0.4*p)+')';ctx.lineWidth=1.2*S;
    ctx.strokeRect(bx-22*S,by-20*S,44*S,40*S);
    ctx.beginPath();ctx.moveTo(bx-22*S,by);ctx.lineTo(W*0.4,by-H*0.06);ctx.strokeStyle='rgba(255,74,28,0.4)';ctx.lineWidth=1*S;ctx.stroke();
    ctx.fillStyle='rgba(255,95,45,0.95)';ctx.textAlign='left';
    ctx.fillText('PUT /x.jsp \u2192 200',W*0.14,by-H*0.06-4*S);
    ctx.fillStyle='rgba(140,180,255,0.45)';ctx.textAlign='right';
    ctx.fillText('PARTIAL PUT',W-10*S,20*S);
    ctx.fillText('BREACH \u25b8 :8080',W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  },
  3: function(ctx,W,H,S,t){ // PAYLOAD — section markers, C2
    mono(ctx,S);
    ctx.strokeStyle='rgba(140,180,255,0.4)';ctx.lineWidth=1*S;ctx.textAlign='left';
    var secs=[['0x00 .text',0.32],['0x40 .rdata',0.5],['main.init()',0.68]];
    for(var k=0;k<secs.length;k++){var y=H*secs[k][1];
      ctx.beginPath();ctx.moveTo(W*0.5,y);ctx.lineTo(W*0.6,y);ctx.stroke();
      ctx.fillStyle='rgba(140,180,255,0.5)';ctx.fillText(secs[k][0],W*0.62,y+3*S);}
    var p=0.5+0.5*Math.sin(t*2);
    ctx.fillStyle='rgba(255,95,45,'+(0.7+0.3*p)+')';ctx.textAlign='left';
    ctx.fillText('C2 \u25b8 :443',W*0.5,H*0.84);
    ctx.beginPath();ctx.arc(W*0.46,H*0.835,2.5*S,0,6.28);ctx.fillStyle='rgba(255,74,28,'+(0.7+0.3*p)+')';ctx.fill();
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.textAlign='right';ctx.fillText('GHIDRA',W-10*S,20*S);
    hudChrome(ctx,W,H,S,t);
  },
  5: function(ctx,W,H,S,t){ // ANOMALY — baseline ellipse, outlier box
    mono(ctx,S);
    ctx.strokeStyle='rgba(140,180,255,0.32)';ctx.lineWidth=1*S;ctx.setLineDash([3*S,3*S]);
    ctx.beginPath();ctx.ellipse(W*0.64,H*0.6,W*0.28,H*0.26,0,0,6.28);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(140,180,255,0.5)';ctx.textAlign='left';ctx.fillText('BASELINE \u03c3',W*0.4,H*0.3);
    var ox=W*0.82,oy=H*0.12,p=0.5+0.5*Math.sin(t*1.8);
    ctx.strokeStyle='rgba(255,74,28,'+(0.55+0.35*p)+')';ctx.lineWidth=1*S;
    ctx.strokeRect(ox-15*S,oy-13*S,30*S,26*S);
    ctx.fillStyle='rgba(255,95,45,0.95)';ctx.textAlign='right';ctx.fillText('ANOMALY',ox-19*S,oy-3*S);
    ctx.fillStyle='rgba(255,95,45,0.65)';ctx.fillText('\u03c3 4.7',ox-19*S,oy+8*S);
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.textAlign='right';
    ctx.fillText('PKT/S '+Math.floor(1200+180*Math.sin(t*3)),W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  },
  6: function(ctx,W,H,S,t){ // DETECTION — match box, rule
    mono(ctx,S);
    var mx=W*0.63,my=H*0.55,p=0.5+0.5*Math.sin(t*2.4);
    ctx.strokeStyle='rgba(255,74,28,'+(0.55+0.4*p)+')';ctx.lineWidth=1.2*S;
    ctx.strokeRect(mx-16*S,my-14*S,32*S,28*S);
    ctx.fillStyle='rgba(255,95,45,0.95)';ctx.textAlign='left';ctx.fillText('1 MATCH',mx+22*S,my);
    ctx.fillStyle='rgba(140,180,255,0.5)';ctx.textAlign='left';
    ctx.fillText('rule: proc_create',W*0.42,H*0.24);
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.textAlign='right';ctx.fillText('SIGMA \u25b8 SPL',W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  },
  7: function(ctx,W,H,S,t){ // IDENTITY — gate, step-up denied
    mono(ctx,S);
    ctx.strokeStyle='rgba(140,180,255,0.4)';ctx.lineWidth=1*S;
    ctx.beginPath();ctx.moveTo(W*0.5,H*0.2);ctx.lineTo(W*0.5,H*0.8);ctx.stroke();
    ctx.fillStyle='rgba(140,180,255,0.5)';ctx.textAlign='left';ctx.fillText('GATE',W*0.53,H*0.24);
    var p=0.5+0.5*Math.sin(t*2);
    ctx.fillStyle='rgba(255,95,45,'+(0.7+0.3*p)+')';ctx.textAlign='right';
    ctx.fillText('STEP-UP \u25b8 DENIED',W-10*S,H*0.55);
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.fillText('RISK 0.91',W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  },
  8: function(ctx,W,H,S,t){ // CONTAINMENT — flatline, host isolated
    mono(ctx,S);
    ctx.strokeStyle='rgba(140,180,255,0.5)';ctx.lineWidth=1*S;
    var y=H*0.55;ctx.beginPath();ctx.moveTo(W*0.44,y);
    for(var x=W*0.44;x<W*0.94;x+=4*S){var n=(x<W*0.6)?(Math.sin(x*0.3+t*4)*6*S):0;ctx.lineTo(x,y+n);}
    ctx.stroke();
    ctx.fillStyle='rgba(140,180,255,0.55)';ctx.textAlign='left';ctx.fillText('HOST ISOLATED',W*0.44,H*0.4);
    ctx.fillStyle='rgba(140,180,255,0.4)';ctx.textAlign='right';ctx.fillText('72H \u25b8 CLEAN',W-10*S,H-12*S);
    hudChrome(ctx,W,H,S,t);
  }
};

// attach a HUD loop to each card's .hud canvas
function attachHUD(inner, seq){
  var cv = inner.querySelector('canvas.hud');
  if(!cv || !HUDS[seq]) return;
  var ctx = cv.getContext('2d');
  var DPR = Math.min(2, window.devicePixelRatio||1);
  function size(){ var r=inner.getBoundingClientRect(); cv.width=Math.max(1,r.width*DPR); cv.height=Math.max(1,r.height*DPR); }
  size(); window.addEventListener('resize', size); setTimeout(size,500);
  var fn = HUDS[seq];
  (function loop(now){
    if(!document.hidden){ var W=cv.width,H=cv.height,S=DPR,t=now/1000; ctx.clearRect(0,0,W,H); fn(ctx,W,H,S,t); }
    if(!reduce) requestAnimationFrame(loop);
  })(performance.now());
}

/* ── SLOT 04 — coded traveler over image base ──────────────────────────── */
function startSlot04(){
  var card=document.querySelector('.c-mal');
  if(!card) return;
  var inner=card.querySelector('.card-inner');
  var ac=inner.querySelector('canvas.anim04');
  var hc=inner.querySelector('canvas.hud');
  if(!ac||!hc) return;
  var ax=ac.getContext('2d'), hx=hc.getContext('2d');
  var DPR=Math.min(2,window.devicePixelRatio||1);
  var NAMES=['leo.sanders','kate.wilson','charlie','henry'];
  var NX=[0.32,0.52,0.70,0.87], NY=[0.55,0.42,0.62,0.47];
  var nodes=[];
  function size(){
    var r=inner.getBoundingClientRect();
    ac.width=Math.max(1,r.width*DPR); ac.height=Math.max(1,r.height*DPR);
    hc.width=ac.width; hc.height=ac.height;
    nodes=NAMES.map(function(n,i){return {x:NX[i]*ac.width,y:NY[i]*ac.height,name:n,lit:0};});
  }
  size(); window.addEventListener('resize',size); setTimeout(size,500);
  var LOOP=14, t0=performance.now();
  // Per-node glow gradients are anchored to a FIXED point (node position never
  // changes) but their outer radius grows/shrinks with n.lit — cache by
  // (node index, quantized radius) so consecutive frames at a similar lit
  // level reuse the same gradient object instead of allocating a new one
  // every frame. The travel-dot gradients (wake/final glow below) can't use
  // this trick — their center follows a continuously moving point, so a new
  // gradient genuinely is required each frame regardless of caching.
  var nodeGradCache=[];
  function nodeGlowGradient(ctx,idx,n){
    var bucket=Math.round(n.lit*20); // 0..20, i.e. steps of 0.05
    var cache=nodeGradCache[idx]||(nodeGradCache[idx]={});
    var key=String(bucket);
    if(!cache[key]){
      var r=(10+bucket/20*10)*DPR;
      var g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r);
      g.addColorStop(0,'rgba(210,228,255,'+((bucket/20)*0.7)+')'); g.addColorStop(1,'rgba(210,228,255,0)');
      cache[key]=g;
    }
    return cache[key];
  }
  function travel(phase,W,H){
    if(!nodes.length) return {x:W*0.5,y:H*0.5};
    var pts=[{x:-0.1*W,y:0.52*H}]; nodes.forEach(function(n){pts.push({x:n.x,y:n.y});}); pts.push({x:1.1*W,y:0.5*H});
    var segs=pts.length-1, ph=((phase%1)+1)%1, p=ph*segs;
    var i=Math.max(0,Math.min(segs-1,Math.floor(p))), f=p-i; f=f*f*(3-2*f);
    var a=pts[i],b=pts[i+1];
    return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
  }
  function loop(now){
    if(document.hidden){ if(!reduce) requestAnimationFrame(loop); return; }
    var t=(now-t0)/1000, phase=(t%LOOP)/LOOP;
    var W=ac.width,H=ac.height,S=DPR;
    var trav=travel(phase,W,H);
    ax.clearRect(0,0,W,H);
    var wake=ax.createRadialGradient(trav.x,trav.y,0,trav.x,trav.y,55*S);
    wake.addColorStop(0,'rgba(150,185,255,0.28)'); wake.addColorStop(1,'rgba(150,185,255,0)');
    ax.fillStyle=wake; ax.beginPath(); ax.arc(trav.x,trav.y,55*S,0,6.28); ax.fill();
    for(var j=0;j<nodes.length;j++){ var n=nodes[j];
      var d=Math.hypot(n.x-trav.x,n.y-trav.y);
      n.lit += ((d<26*S?1:0)-n.lit)*0.06;
      if(n.lit>0.05){
        var bucket=Math.round(n.lit*20);
        var r=(10+bucket/20*10)*DPR;
        ax.fillStyle=nodeGlowGradient(ax,j,n); ax.beginPath(); ax.arc(n.x,n.y,r,0,6.28); ax.fill();
        ax.beginPath(); ax.arc(n.x,n.y,2.4*S,0,6.28); ax.fillStyle='rgba(235,244,255,'+(0.5+n.lit*0.5)+')'; ax.fill();
      }
    }
    for(var k=1;k<=8;k++){ var pp=travel(((phase-k*0.006)+1)%1,W,H);
      ax.beginPath(); ax.arc(pp.x,pp.y,(1.5-k*0.14)*S,0,6.28);
      ax.fillStyle='rgba(225,238,255,'+(0.45-k*0.045)+')'; ax.fill(); }
    var grd=ax.createRadialGradient(trav.x,trav.y,0,trav.x,trav.y,7*S);
    grd.addColorStop(0,'rgba(255,255,255,0.95)'); grd.addColorStop(0.4,'rgba(205,225,255,0.5)'); grd.addColorStop(1,'rgba(205,225,255,0)');
    ax.fillStyle=grd; ax.beginPath(); ax.arc(trav.x,trav.y,7*S,0,6.28); ax.fill();
    ax.beginPath(); ax.arc(trav.x,trav.y,1.4*S,0,6.28); ax.fillStyle='#fff'; ax.fill();
    // HUD
    hx.clearRect(0,0,W,H);
    hx.font=(8*S)+"px 'JetBrains Mono',monospace";
    var rx=trav.x,ry=trav.y,rs=12*S;
    hx.strokeStyle='rgba(140,180,255,0.7)'; hx.lineWidth=1*S; hx.strokeRect(rx-rs,ry-rs,rs*2,rs*2);
    hx.beginPath();
    hx.moveTo(rx-rs,ry-rs+4*S);hx.lineTo(rx-rs,ry-rs);hx.lineTo(rx-rs+4*S,ry-rs);
    hx.moveTo(rx+rs-4*S,ry+rs);hx.lineTo(rx+rs,ry+rs);hx.lineTo(rx+rs,ry+rs-4*S); hx.stroke();
    hx.fillStyle='rgba(140,180,255,0.75)'; hx.textAlign='left'; hx.fillText('TRACK 04',rx+rs+4*S,ry-2*S);
    var cur=''; for(var m=0;m<nodes.length;m++){ if(nodes[m].lit>0.5) cur=nodes[m].name; }
    if(cur){ hx.fillStyle='rgba(255,95,45,0.9)'; hx.textAlign='left'; hx.fillText('\u25b8 '+cur,W*0.14,H*0.86); }
    hx.fillStyle='rgba(140,180,255,0.45)'; hx.textAlign='right'; hx.fillText('CRED CHAIN 4/4',W-10*S,20*S);
    hx.strokeStyle='rgba(190,215,255,0.28)'; hx.beginPath(); hx.moveTo(W-15*S,H-6*S);hx.lineTo(W-6*S,H-6*S);hx.lineTo(W-6*S,H-15*S); hx.stroke();
    if(!reduce) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function startHUDs(){
  document.querySelectorAll('.recon-card').forEach(function(marker){
    var seq = Number(marker.dataset.seq)||0;
    attachHUD(marker.closest('.card-inner'), seq);
  });
}
function startAll(){ if(LOW_POWER) return; startHUDs(); startSlot04(); }
if(document.readyState!=='loading'){ startAll(); } else document.addEventListener('DOMContentLoaded', startAll);
