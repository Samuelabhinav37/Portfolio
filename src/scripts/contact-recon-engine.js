/* Contact page recon-card engine. Extracted from an inline <script> block.
   Fully self-contained (no bare identifiers shared with other scripts on the
   page), so this is a straight move — no window.* export shim needed.
   Note: the WebGL particle system (THREE stub, MODE, sampleImage, shaders,
   ReconCard class) is currently dead code — mountAll() early-returns before
   ever instantiating ReconCard ("particles disabled — cards use the real
   image base + HUD"). The live HUD canvas overlays (HUDS/attachHUD) are
   unaffected and still render every card's animated readout. Preserved
   verbatim rather than stripped, since removing it wasn't in scope. */
var THREE = {}; /* particle engine disabled; stub keeps class parseable */

/* ════════════════════════════════════════════════════════════════════════
   RECONSTRUCTION ENGINE  ·  config-driven, one module for all 8 cards
   ------------------------------------------------------------------------
   Usage:
     const card = new ReconCard(rootEl, CONFIG);
   Where CONFIG defines the still, aspect, motion type, event and HUD.

   Motion types (mode uniform):
     0 DRIFT  — baseline orbit + event pushes the anomaly mask outward
     1 SCAN   — a reveal line sweeps; particles light as it passes; mask ignites
     2 BREACH — surface held; event bursts the mask region forward
     3 TRACK  — figure stays formed; motion is in the HUD, not the points
   ════════════════════════════════════════════════════════════════════════ */

const MODE = { DRIFT:0, SCAN:1, BREACH:2, TRACK:3 };

/* ---------- sampling: still -> home positions + anomaly mask ---------- */
function sampleImage(img, target, cfg){
  const nw = img.naturalWidth || img.width || 0;
  const nh = img.naturalHeight || img.height || 0;
  if(!nw || !nh){ throw new Error('image not decoded (nat '+nw+'x'+nh+')'); }
  const cw = 520, ch = Math.max(2, Math.round(cw * nh / nw));
  const cv = document.createElement('canvas'); cv.width=cw; cv.height=ch;
  const c = cv.getContext('2d',{willReadFrequently:true});
  c.drawImage(img,0,0,cw,ch);
  const data = c.getImageData(0,0,cw,ch).data;
  const mask = cfg.anomalyMask; // {x0,y0,x1,y1} in normalized coords or null

  const cand=[];
  for (let y=0;y<ch;y++) for (let x=0;x<cw;x++){
    const i=(y*cw+x)*4;
    const l=(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114)/255;
    if (l>0.10){
      const keep = Math.min(0.7, l*0.85);
      if (Math.random()<keep) cand.push([x/cw, y/ch, l]);
    }
  }
  for (let i=cand.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [cand[i],cand[j]]=[cand[j],cand[i]]; }

  const N = Math.min(target, cand.length);
  const side = Math.max(2, Math.ceil(Math.sqrt(N)));
  const total = side*side;
  const home = new Float32Array(total*4);
  const seed = new Float32Array(total*4);
  const aspect = ch/cw;

  for (let k=0;k<total;k++){
    const src = cand[k % cand.length];
    const wx = (src[0]-0.5)*2.0;
    const wy = (0.5-src[1])*2.0*aspect;
    const wz = (Math.random()-0.5)*0.10;
    let isAnom = 0.0;
    if (mask && src[0]>=mask.x0 && src[0]<=mask.x1 && src[1]>=mask.y0 && src[1]<=mask.y1) isAnom=1.0;
    home[k*4]=wx; home[k*4+1]=wy; home[k*4+2]=wz; home[k*4+3]=isAnom;
    seed[k*4]=Math.random(); seed[k*4+1]=Math.random(); seed[k*4+2]=Math.random(); seed[k*4+3]=src[2];
  }
  return { side, total, home, seed, aspect };
}

/* ---------- shaders ---------- */
const simVert = `
  attribute vec2 uvRef; varying vec2 vUv;
  void main(){ vUv=uvRef; gl_Position=vec4(position.xy,0.,1.); }`;

const simFrag = `
  precision highp float;
  uniform sampler2D uHome, uSeed;
  uniform float uTime, uDrift, uEvent, uPush, uMode;
  varying vec2 vUv;
  vec3 hash3(vec3 p){
    p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
    return fract(sin(p)*43758.5453)*2.0-1.0;
  }
  void main(){
    vec4 h=texture2D(uHome,vUv); vec4 s=texture2D(uSeed,vUv);
    vec3 home=h.xyz; float anom=h.w;
    float t=uTime*0.25 + s.x*6.28;
    vec3 n=hash3(home*3.0 + s.xyz*10.0);
    vec3 orbit=vec3(sin(t+n.x*6.28),cos(t*1.1+n.y*6.28),sin(t*0.7+n.z*6.28))
               *(0.02+0.05*uDrift)*(0.5+s.w);
    vec3 pos=home+orbit;
    float reveal=1.0; // for SCAN: dim particles the sweep hasn't reached

    // ---- DRIFT (0): anomaly mask flees outward on event ----
    if (uMode < 0.5){
      if (anom>0.5){
        vec3 dir=normalize(home+vec3(0.4,0.4,0.0));
        pos+=dir*uEvent*uPush*(0.35+0.4*s.y);
        pos+=hash3(home*7.0+uTime*0.5)*uEvent*0.06;
      }
    }
    // ---- SCAN (1): a horizontal line sweeps bottom->top each event ----
    else if (uMode < 1.5){
      float sweepY = mix(-1.2, 1.4, fract(uTime*0.12));
      float d = home.y - sweepY;
      float lit = smoothstep(0.35,0.0,abs(d));
      reveal = 0.35 + 0.65*step(home.y, sweepY+0.05); // revealed once passed
      pos += vec3(0.0,0.0,lit*0.15);                   // slight pop as scanned
      if (anom>0.5){ // the flagged cell ignites when scanned
        pos += hash3(home*9.0)*uEvent*0.05;
      }
    }
    // ---- BREACH (2): mask region bursts forward on event ----
    else if (uMode < 2.5){
      if (anom>0.5){
        vec3 dir=normalize(vec3(0.6,0.1,0.8)+n*0.3);
        pos+=dir*uEvent*uPush*(0.5+0.6*s.y);
      }
    }
    // ---- TRACK (3): figure holds; only gentle drift ----
    // (points barely move; the story is in the HUD)

    gl_FragColor=vec4(pos, anom + reveal*0.001); // pack reveal in tiny w offset
  }`;

const renderVert = `
  precision highp float;
  uniform sampler2D uPos; uniform float uSize, uDpr;
  attribute vec2 uvRef; varying float vAnom, vDepth, vReveal;
  void main(){
    vec4 p=texture2D(uPos,uvRef);
    vAnom=floor(p.w);
    vReveal=fract(p.w)*1000.0;
    vec4 mv=modelViewMatrix*vec4(p.xyz,1.0);
    vDepth=-mv.z;
    gl_Position=projectionMatrix*mv;
    gl_PointSize=uSize*uDpr*(2.6/-mv.z*3.15);
  }`;

const renderFrag = `
  precision highp float;
  varying float vAnom, vDepth, vReveal;
  uniform float uEventProg;
  void main(){
    vec2 d=gl_PointCoord-0.5; float r=length(d);
    if(r>0.5) discard;
    float a=smoothstep(0.5,0.28,r)*0.85;
    vec3 base=vec3(0.82,0.87,0.96);
    vec3 hot=vec3(1.0,0.29,0.11);
    vec3 col=mix(base,hot, vAnom*uEventProg);
    // gentle lift as the wave passes — soft, no hard flash
    col += vec3(0.05,0.07,0.10) * uEventProg;
    float df=clamp(1.4-vDepth*0.5,0.30,1.0);
    float rev = mix(1.0, clamp(vReveal,0.35,1.0), step(0.001, vReveal)); // SCAN dim
    float surge = 1.0 + 0.18*uEventProg;   // subtle opacity lift on the wave
    gl_FragColor=vec4(col, a*df*rev*surge);
  }`;

/* ---------- a single card instance ---------- */
class ReconCard {
  constructor(root, cfg){
    this.root = root; this.cfg = Object.assign({
      mode:MODE.DRIFT, count:50, drift:0.5, size:0.9, push:1.0,
      aspect:[5,7], anomalyMask:null, autoEvery:10, eventHold:1.6
    }, cfg);
    this.DPR = Math.min(2, window.devicePixelRatio||1);
    this.eventProg=0; this.eventTarget=0; this.autoTimer=0;
    this.running=false; this.visible=false;
    this._build();
  }

  _build(){
    const glc = this.root.querySelector('canvas.gl');
    const hud = this.root.querySelector('canvas.hud');
    this.glc=glc; this.hud=hud; this.hctx=hud.getContext('2d');
    this.img = this.root.querySelector('img.src');

    this.renderer=new THREE.WebGLRenderer({canvas:glc,alpha:true,antialias:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x000000,0);
    this.renderer.setPixelRatio(this.DPR);

    const s=sampleImage(this.img, this.cfg.count*1000, this.cfg);
    this.side=s.side; this.count=s.total;
    this.homeTex=this._tex(s.home,s.side);
    this.seedTex=this._tex(s.seed,s.side);

    this.rt=new THREE.WebGLRenderTarget(s.side,s.side,{type:THREE.FloatType,format:THREE.RGBAFormat,
      minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false});

    this.simScene=new THREE.Scene();
    this.simCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const quad=new THREE.PlaneGeometry(2,2);
    quad.setAttribute('uvRef',new THREE.BufferAttribute(new Float32Array([0,0,1,0,0,1,1,1]),2));
    this.simMat=new THREE.ShaderMaterial({vertexShader:simVert,fragmentShader:simFrag,uniforms:{
      uHome:{value:this.homeTex},uSeed:{value:this.seedTex},uTime:{value:0},
      uDrift:{value:this.cfg.drift},uEvent:{value:0},uPush:{value:this.cfg.push},uMode:{value:this.cfg.mode}
    }});
    this.simScene.add(new THREE.Mesh(quad,this.simMat));

    this.scene=new THREE.Scene();
    this.cam=new THREE.PerspectiveCamera(45, this.cfg.aspect[0]/this.cfg.aspect[1], 0.1, 20);
    this.cam.position.z=3.15;

    const geo=new THREE.BufferGeometry();
    const refs=new Float32Array(this.count*2), dummy=new Float32Array(this.count*3);
    for(let i=0;i<this.count;i++){ refs[i*2]=(i%this.side+0.5)/this.side; refs[i*2+1]=(Math.floor(i/this.side)+0.5)/this.side; }
    geo.setAttribute('position',new THREE.BufferAttribute(dummy,3));
    geo.setAttribute('uvRef',new THREE.BufferAttribute(refs,2));
    this.posMat=new THREE.ShaderMaterial({vertexShader:renderVert,fragmentShader:renderFrag,uniforms:{
      uPos:{value:this.rt.texture},uSize:{value:this.cfg.size},uDpr:{value:this.DPR},uEventProg:{value:0}
    },transparent:true,depthTest:false,depthWrite:false,blending:THREE.NormalBlending});
    this.points=new THREE.Points(geo,this.posMat);
    this.scene.add(this.points);

    this.resize();
    // cards may animate in with a transition-delay; re-measure once settled
    setTimeout(()=>this.resize(), 400);
    setTimeout(()=>this.resize(), 1000);
    window.addEventListener('resize',()=>this.resize());
    this._observe();
  }

  _tex(data,side){ const t=new THREE.DataTexture(data,side,side,THREE.RGBAFormat,THREE.FloatType); t.needsUpdate=true; return t; }

  resize(){
    const r=this.root.getBoundingClientRect();
    const w=Math.max(1,r.width), h=Math.max(1,r.height);
    this.renderer.setSize(w,h,false);
    this.cam.aspect=w/h; this.cam.updateProjectionMatrix();
    this.hud.width=Math.round(w*this.DPR); this.hud.height=Math.round(h*this.DPR);
  }

  // only run while on screen (Phase-4 performance contract)
  _observe(){
    // start running immediately; the observer only PAUSES when off-screen.
    this.visible = true;
    this.running = true;
    this._loop();
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(es=>{
        const on = es[0].isIntersecting;
        this.visible = on;
        if(on && !this.running){ this.running=true; this._loop(); }
      },{threshold:0});
      io.observe(this.root);
    }
  }

  trigger(){ this.eventTarget=1; clearTimeout(this._evT); this._evT=setTimeout(()=>this.eventTarget=0, this.cfg.eventHold*1000); }

  // continuous wave energy (0..1) from the conductor — smoothly sets the target
  setWave(e){ this._wave = e; }

  _loop(){
    if(!this.visible){ this.running=false; return; } // stop when off-screen
    const now=performance.now(); if(!this.t0)this.t0=now;
    const t=(now-this.t0)/1000;

    if(this.cfg.autoEvery){
      this.autoTimer+=1/60;
      if(this.autoTimer>this.cfg.autoEvery){ this.autoTimer=0; this.trigger(); }
    }
    // The wave conductor sets this._wave (0..1) as a smooth, flowing target.
    // eventProg eases toward it gently so motion is continuous, never snappy.
    var target = (this._wave != null) ? this._wave : this.eventTarget;
    this.eventProg += (target - this.eventProg) * 0.08;

    this.simMat.uniforms.uTime.value=t;
    this.simMat.uniforms.uEvent.value=this.eventProg;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.simScene,this.simCam);
    this.renderer.setRenderTarget(null);

    this.posMat.uniforms.uEventProg.value=this.eventProg;
    this.renderer.render(this.scene,this.cam);

    if(this.cfg.drawHUD) this.cfg.drawHUD(this.hctx, this.hud, this.eventProg, t, this.DPR);

    requestAnimationFrame(()=>this._loop());
  }
}

const hudGeneric=(ctx,cv,ev,t,dpr)=>{
  const W=cv.width,H=cv.height,S=dpr; ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(190,215,255,0.20)';ctx.lineWidth=1*S;
  ctx.beginPath();ctx.moveTo(W-15*S,H-6*S);ctx.lineTo(W-6*S,H-6*S);ctx.lineTo(W-6*S,H-15*S);ctx.stroke();
  if(ev>0.06){const a=Math.min(1,ev*1.5);
    ctx.fillStyle='rgba(255,90,40,'+a+')';ctx.textAlign='right';
    ctx.font=(8*S)+"px 'JetBrains Mono',monospace";
    ctx.fillText('\u25CF EVENT',W-15*S,18*S);}
};
function mountAll(){
  var stack=document.querySelector('.stack'); if(stack) stack.classList.add('ready');
  window.SITE._dbg=function(){};
  return; // particles disabled — cards use the real image base + HUD
  document.querySelectorAll('.recon-card').forEach(function(marker){
    const inner=marker.closest('.card-inner');
    const img=inner.querySelector('img.src');
    const ap=marker.dataset.aspect.split(',').map(Number);
    const maskStr=marker.dataset.mask; let mask=null;
    if(maskStr){const m=maskStr.split(',').map(Number);mask={x0:m[0],y0:m[1],x1:m[2],y1:m[3]};}
    const mode=MODE[marker.dataset.mode]!=null?MODE[marker.dataset.mode]:MODE.DRIFT;
    const start=function(){try{
      const r=inner.getBoundingClientRect();
      const c=new ReconCard(inner,{mode:mode,aspect:ap,anomalyMask:mask,
        autoEvery:0,drift:0.45,push:1.0,size:1.0,drawHUD:hudGeneric});
      const seq=Number(marker.dataset.seq)||99;
      window.SITE._RC=window.SITE._RC||[]; window.SITE._RC.push({seq:seq, card:c});
      window.SITE._dbg && window.SITE._dbg(marker.dataset.mode+' seq'+seq+' pts='+(c.count||'?')+' vis='+c.visible);
    }catch(e){console.error('card mount failed',e); window.SITE._dbg && window.SITE._dbg('FAIL '+marker.dataset.mode+': '+e.message);}};
    if(img.decode){ img.decode().then(start).catch(function(){ window.SITE._dbg && window.SITE._dbg('decode fail '+marker.dataset.mode); start(); }); }
    else if(img.complete&&img.naturalWidth)start();
    else { img.onload=start; img.onerror=function(){ window.SITE._dbg && window.SITE._dbg('img ERROR '+marker.dataset.mode+' src='+(img.getAttribute('src')||'').slice(-24)); }; }
  });
}
if(document.readyState!=='loading')mountAll(); else document.addEventListener('DOMContentLoaded',mountAll);

/* ── HUD LAYER + GENTLE SYNC ─────────────────────────────────────────────
   Each card gets its own data readout matching its story beat, drawn sharp
   on the .hud canvas above the particles. A single slow global phase gives
   the whole board a shared, gentle breath (the "sync") without hard beats.  */

// slow global breath 0..1, shared by every HUD so the board feels unified
window.SITE._phase = 0;
(function breathe(){ window.SITE._phase = (performance.now()/1000); requestAnimationFrame(breathe); })();

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
  (function loop(now){ var W=cv.width,H=cv.height,S=DPR,t=now/1000; ctx.clearRect(0,0,W,H); fn(ctx,W,H,S,t); requestAnimationFrame(loop); })(performance.now());
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
  function travel(phase,W,H){
    if(!nodes.length) return {x:W*0.5,y:H*0.5};
    var pts=[{x:-0.1*W,y:0.52*H}]; nodes.forEach(function(n){pts.push({x:n.x,y:n.y});}); pts.push({x:1.1*W,y:0.5*H});
    var segs=pts.length-1, ph=((phase%1)+1)%1, p=ph*segs;
    var i=Math.max(0,Math.min(segs-1,Math.floor(p))), f=p-i; f=f*f*(3-2*f);
    var a=pts[i],b=pts[i+1];
    return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
  }
  function loop(now){
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
        var g=ax.createRadialGradient(n.x,n.y,0,n.x,n.y,(10+n.lit*10)*S);
        g.addColorStop(0,'rgba(210,228,255,'+(n.lit*0.7)+')'); g.addColorStop(1,'rgba(210,228,255,0)');
        ax.fillStyle=g; ax.beginPath(); ax.arc(n.x,n.y,(10+n.lit*10)*S,0,6.28); ax.fill();
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
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function startHUDs(){
  document.querySelectorAll('.recon-card').forEach(function(marker){
    var seq = Number(marker.dataset.seq)||0;
    attachHUD(marker.closest('.card-inner'), seq);
  });
}
if(document.readyState!=='loading'){ startHUDs(); startSlot04(); } else document.addEventListener('DOMContentLoaded', function(){ startHUDs(); startSlot04(); });
