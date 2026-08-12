/* Homepage globe/Three.js orchestration. Extracted from an inline <script
   type="module"> block. Loads Three.js lazily via the page's importmap
   (bare 'three' specifier -> CDN URL) on idle/scroll, not eagerly, so this
   file being separately cacheable doesn't change that deferred-load design. */
(function(){
  "use strict";
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Phones skip the globe entirely under LOW_POWER — it's the single heaviest
     system on the page (~600KB fetch + WebGL geometry build) and already
     lazy/optional by design. Tablets (LOW_POWER true but width>=600) keep it. */
  var _lowPowerPhone = !!(window.SITE && window.SITE.LOW_POWER) && innerWidth < 600;
  if(RM || _lowPowerPhone) return;

  /* Lazy-load Three only when the visitor scrolls toward the arc. The module
     is ~600KB; a static `import * as THREE` would fetch + parse + build a WebGL
     context on every page load, including the many sessions that never leave the
     fold. Deferring it keeps initial load cheap. The importmap above only maps
     the bare specifier — it fetches nothing on its own.

     BUT: doing all of that on the *first scroll* paid the whole import + parse +
     geometry/texture/WebGL build as a main-thread spike right as the user started
     scrolling toward the globe — felt as a stutter at the CRT→globe handoff. So
     we keep the deferral but move the work into the idle window AFTER the intro
     has settled: by the time the user scrolls, Three is already loaded and the
     globe already built, so the handoff is smooth. The scroll probe stays as a
     fallback — if the user scrolls before the idle warm fires, it boots then. */
  var _booted=false;
  function bootGlobe(){
    if(_booted) return; _booted=true;
    import('three')
      .then(function(THREE){ initGlobe(THREE); })
      .catch(function(e){ console.warn('Globe arc: Three failed to load', e); });
  }
  function _scrollProbe(){
    if(scrollY>40){ removeEventListener('scroll',_scrollProbe); bootGlobe(); }
  }
  addEventListener('scroll',_scrollProbe,{passive:true});
  if(scrollY>40) bootGlobe();   // reload mid-page: boot immediately

  /* Idle pre-warm: once the intro is fully done, build the globe during a quiet
     frame so the first scroll doesn't hitch. Polls cheaply (~2Hz) until the
     intro flag is set, then defers to requestIdleCallback (timeout-bounded so it
     still runs on browsers that stay busy). Never fires if the user already
     scrolled (bootGlobe is idempotent via _booted). */
  (function _warmGate(){
    if(_booted) return;
    if(window.SITE._introFullyDone){
      var ric = window.requestIdleCallback || function(cb){ return setTimeout(function(){ cb(); }, 200); };
      ric(function(){ if(!_booted) bootGlobe(); }, { timeout: 3000 });
    } else {
      setTimeout(_warmGate, 500);
    }
  })();

  function initGlobe(THREE){

  var clamp01=function(t){return t<0?0:t>1?1:t;};
  var smooth=function(t){t=clamp01(t);return t*t*(3-2*t);};
  var lerp=function(a,b,t){return a+(b-a)*t;};
  var map=function(v,a,b){return clamp01((v-a)/(b-a));};
  /* easeOutCubic — decelerates into rest, reads as a physical "settle" rather
     than the symmetric ease-in-out that makes box transitions feel canned. */
  var easeOutCubic=function(t){t=clamp01(t);return 1-Math.pow(1-t,3);};
  var easeInCubic=function(t){t=clamp01(t);return t*t*t;};
  var seed=7, rand=function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

  var NNODES=120, NDOTS=340, SPHERE_R=1.5;
  var LABELS=['SENTINEL','PRISM','AXON','CVE-2025-24813','T1486','T1190'];
  /* The last three are telemetry markers, not navigation (About/Blog/Contact live in
     the corner menu): CVE-2025-24813 = Tomcat partial-PUT RCE reconstructed in the
     SignetDynamics IR lab; T1486 = Data Encrypted for Impact (EduNexus SSE-C chain);
     T1190 = Exploit Public-Facing Application (bug bounty umbrella). Deliberately
     lab-derived rather than trending KEV entries so they never go stale — each can
     later deep-link to its blog writeup via LABEL_HREF. */
  /* Project nodes (first three) live in the EQUATOR BAND now (indices 55/53/54,
     latitudes y≈0.08/0.11/0.09) so that yawing to face one also lands it near
     vertical centre. The old 5/22/40 were upper-hemisphere (y≈0.92/0.63/0.33),
     which is why a faced project floated high. They're spread ~120° in longitude
     (≈3°/88°/225°) for a clean turn between holds, and kept ≥6 indices clear of
     the BLOG/ABOUT/CONTACT nodes so labels don't pile up. A small eased pitch in
     the tour (TOUR_PITCH_SIGN below) nulls the residual offset. */
  var LABEL_NODE=[55,53,54,61,83,104];
  /* Routing. Projects now point at per-project anchors on /blog — CONFIRM these
     match your real Blog-page routing (anchor ids / slugs). The rest mirror the
     nav slugs (same caveat as the living-chrome nav). */
  var LABEL_HREF=['/blog#sentinel','/blog#prism','/blog#axon',null,null,null];
  var SEED_NODE=0;

  var canvas=document.getElementById('globe-gl');
  var tw=document.getElementById('term-window');
  var labelHost=document.getElementById('globe-labels');
  if(!canvas||!tw) return;

  /* W/H are the VIEWPORT and must stay that way: #term-window's beat-1 shrink
     is driven by them (tw.style.width = lerp(W, W*2.7, dv)). Making them
     square collapsed T1 into a square — that was the bug. GL_SIDE below is
     used ONLY for the renderer buffer and the camera aspect. */
  var GL_SIDE = Math.round(Math.min(1180, Math.max(innerWidth, innerHeight) * 0.92));
  var W=innerWidth, H=innerHeight, progress=0, drift=0;
  var renderer,scene,camera,worldGroup,nodePoints,labelNodes,dotPoints,lineSeg,glowMesh;
  var wireSegs=[];   // [a,b] node-index pairs for the wireframe — kept for wave-time endpoint rewrites
  var dirs=[], labelEls=[], tmpV;

  function fibDir(i,n){ var ga=Math.PI*(3-Math.sqrt(5));
    var y=1-(i/(n-1))*2, r=Math.sqrt(1-y*y), th=ga*i;
    return new THREE.Vector3(Math.cos(th)*r,y,Math.sin(th)*r); }
  function dotTexture(){ var c=document.createElement('canvas');c.width=c.height=64;
    var x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
    // tight sharp core + faint halo = real-star look (jungheonlee silk-and-starlight)
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(0.08,'rgba(244,248,255,0.95)');
    g.addColorStop(0.20,'rgba(210,224,250,0.35)');
    g.addColorStop(0.55,'rgba(190,210,245,0.06)');
    g.addColorStop(1,'rgba(190,210,245,0)');
    x.fillStyle=g;x.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c); }
  // bright solid orb — the shining project node itself (wide bright plateau so it
  // reads as a lit point, not a faint smudge when scaled up)
  function coreGlowTex(){ var c=document.createElement('canvas');c.width=c.height=64;
    var x=c.getContext('2d'); var g=x.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,   'rgba(255,255,255,1)');
    g.addColorStop(0.34,'rgba(238,249,255,0.97)');
    g.addColorStop(0.58,'rgba(150,206,255,0.42)');
    g.addColorStop(1,   'rgba(120,190,255,0)');
    x.fillStyle=g;x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
  // soft wide bloom — the halo around the node
  function bloomGlowTex(){ var c=document.createElement('canvas');c.width=c.height=64;
    var x=c.getContext('2d'); var g=x.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,  'rgba(160,210,255,0.72)');
    g.addColorStop(0.4,'rgba(120,190,255,0.26)');
    g.addColorStop(1,  'rgba(110,180,255,0)');
    x.fillStyle=g;x.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
  function fresnelMat(){ return new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(0x4a78d8)},uIntensity:{value:0}},
    vertexShader:'varying float vR;void main(){vec3 n=normalize(normalMatrix*normal);'+
      'vec3 e=normalize((modelViewMatrix*vec4(position,1.0)).xyz);vR=pow(1.0+dot(e,n),4.5);'+
      'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 uColor;uniform float uIntensity;varying float vR;'+
      'void main(){gl_FragColor=vec4(uColor,clamp(vR,0.0,1.0)*uIntensity);}',
    transparent:true,blending:THREE.AdditiveBlending,side:THREE.BackSide,depthWrite:false}); }

  try{
    tmpV=new THREE.Vector3();
    var tmpW=new THREE.Vector3();   // world-facing checks for the signal-label tiers
    renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1));
    /* third arg updateStyle=false: without it Three writes width/height as
       INLINE styles on the canvas, which override the stylesheet and pin it
       to the buffer size regardless of --gl-s. */
    renderer.setSize(GL_SIDE,GL_SIDE,false);
    scene=new THREE.Scene();
    // depth cue: fade the far side so the wireframe reads as a round sphere instead of a
    // flat tangle. Camera sits ~4.3 out, globe radius 1.5 → front ≈2.8, back ≈5.8 away;
    // fog starts just behind the front face and the back settles to a dim ghost (~35%).
    scene.fog=new THREE.Fog(0x05060d, 3.0, 7.6);
    camera=new THREE.PerspectiveCamera(50,1,0.1,100); camera.position.z=3.9;   // square buffer -> aspect 1
    scene.add(new THREE.AmbientLight(0xffffff,0.9));
    var key=new THREE.DirectionalLight(0xcfe0ff,0.5); key.position.set(2,1,3); scene.add(key);
    worldGroup=new THREE.Group(); worldGroup.rotation.z=-0.18; scene.add(worldGroup);

    var i;
    for(i=0;i<NNODES;i++) dirs.push(fibDir(i,NNODES));

    // node points
    (function(){ var pos=new Float32Array(NNODES*3);
      for(var i=0;i<NNODES;i++){var d=dirs[i].clone().multiplyScalar(SPHERE_R);
        pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;}
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      nodePoints=new THREE.Points(g,new THREE.PointsMaterial({size:0.05,map:dotTexture(),
        transparent:true,opacity:0,color:0xeef3ff,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
      worldGroup.add(nodePoints); })();
    // label nodes (bigger)
    (function(){ var pos=new Float32Array(LABEL_NODE.length*3);
      LABEL_NODE.forEach(function(idx,k){var d=dirs[idx].clone().multiplyScalar(SPHERE_R);
        pos[k*3]=d.x;pos[k*3+1]=d.y;pos[k*3+2]=d.z;});
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      labelNodes=new THREE.Points(g,new THREE.PointsMaterial({size:0.115,map:dotTexture(),
        transparent:true,opacity:0,color:0xffffff,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
      worldGroup.add(labelNodes); })();
    // dot field
    (function(){ var pos=new Float32Array(NDOTS*3);
      for(var i=0;i<NDOTS;i++){var d=fibDir(i,NDOTS).multiplyScalar(SPHERE_R);
        pos[i*3]=d.x;pos[i*3+1]=d.y;pos[i*3+2]=d.z;}
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      dotPoints=new THREE.Points(g,new THREE.PointsMaterial({size:0.022,map:dotTexture(),
        transparent:true,opacity:0,color:0xcdd8f0,depthWrite:false,blending:THREE.AdditiveBlending}));
      worldGroup.add(dotPoints); })();
    // edges
    (function(){
      // jungheonlee-style graph: each node links to K others chosen across the
      // WHOLE sphere (not just neighbors), so lines cross the interior. We mix
      // a few near links (structure) with several far links (the web).
      var segs=[], seen={};
      function addEdge(i,j){ if(i===j)return; var a=Math.min(i,j),b=Math.max(i,j),key=a*1000+b;
        if(seen[key])return; seen[key]=1; segs.push([a,b]); }
      for(var i=0;i<NNODES;i++){
        // rank all others by angular distance
        var others=[];
        for(var j=0;j<NNODES;j++) if(j!==i) others.push([dirs[i].dot(dirs[j]),j]);
        others.sort(function(a,b){return b[0]-a[0];}); // closest first
        // 2 nearest (surface structure)
        addEdge(i,others[0][1]); addEdge(i,others[1][1]);
        // 4 spread across the rest of the sphere (mid + far range) -> crossing lines
        var picks=[ (others.length*0.30)|0, (others.length*0.52)|0,
                    (others.length*0.74)|0, (others.length*0.92)|0 ];
        for(var p=0;p<picks.length;p++) addEdge(i, others[picks[p]][1]);
      }
      var pos=new Float32Array(segs.length*6);
      segs.forEach(function(s,k){var a=dirs[s[0]].clone().multiplyScalar(SPHERE_R),
        b=dirs[s[1]].clone().multiplyScalar(SPHERE_R);pos.set([a.x,a.y,a.z,b.x,b.y,b.z],k*6);});
      var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      lineSeg=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xe6eefb,
        transparent:true,opacity:0,depthWrite:false}));   // no additive -> uniform thin white, no blowout where they cross
      worldGroup.add(lineSeg); wireSegs=segs; })();

    glowMesh=new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R*1.02,48,48),fresnelMat());
    worldGroup.add(glowMesh);

    /* ── WAVE PROPAGATION (Codrops cube-grid mechanic, on our geometry) ─────────
       A wave radiates across the sphere from an origin node: each node lifts
       radially as the front (measured in angular distance) passes it, and since
       the wireframe endpoints derive from the same node radii, the ripple travels
       visibly through the mesh itself. Per-node deterministic jitter offsets each
       node's distance so the front is organic, never a perfect circle — the
       article's own point: that jitter is the visual identity.
       Triggers: tour landings (wave from the landing project's node) and label
       hover (smaller ping). fireWave(nodeIdx, strength) is the public entry.
       Cost: only while a wave is live (~2s), 120 nodes + segment endpoints on CPU. */
    var WAVE_SPEED  = 2.2;    // rad/s — default front speed for interaction waves
    var WAVE_AMP    = 0.11;   // radial lift at the crest (fraction of SPHERE_R)
    var WAVE_WIDTH  = 0.38;   // gaussian front thickness (radians)
    var WAVE_JITTER = 0.22;   // per-node distance jitter (0 = perfect ring)
    var WAVE_DECAY  = 0.75;   // energy falloff per second
    var BREATH_R    = 0.016;  // baseline radial breath (fraction of SPHERE_R) — the mesh's resting inhale/exhale
    var _waves=[], _waveDirty=false;
    var _nodeJit=new Float32Array(NNODES);
    for(i=0;i<NNODES;i++){ var _h=Math.sin(i*127.1+311.7)*43758.5453; _nodeJit[i]=(_h-Math.floor(_h))*2-1; }
    var _lift=new Float32Array(NNODES);
    function fireWave(originIdx, strength, opts){
      if(window.REDUCED_MOTION) return;                    // waves are pure motion — honor the preference
      if(originIdx==null || !dirs[originIdx]) return;
      if(_waves.length>=3) _waves.shift();                 // cap concurrent waves
      var d=new Float32Array(NNODES), od=dirs[originIdx];
      for(var n=0;n<NNODES;n++){ var dp=od.dot(dirs[n]); d[n]=Math.acos(dp>1?1:(dp<-1?-1:dp)); }
      _waves.push({ t:0, s:strength||1, d:d,
                    sp:(opts&&opts.speed)||WAVE_SPEED, wd:(opts&&opts.width)||WAVE_WIDTH });
    }
    function _writeWaveBuffers(){
      var np=nodePoints.geometry.attributes.position, npa=np.array;
      for(var n=0;n<NNODES;n++){ var r=SPHERE_R*(1+_lift[n]), dd=dirs[n];
        npa[n*3]=dd.x*r; npa[n*3+1]=dd.y*r; npa[n*3+2]=dd.z*r; }
      np.needsUpdate=true;
      var lp=labelNodes.geometry.attributes.position, lpa=lp.array;
      for(var k=0;k<LABEL_NODE.length;k++){ var li2=LABEL_NODE[k], r2=SPHERE_R*(1+_lift[li2]), d2=dirs[li2];
        lpa[k*3]=d2.x*r2; lpa[k*3+1]=d2.y*r2; lpa[k*3+2]=d2.z*r2; }
      lp.needsUpdate=true;
      var sp=lineSeg.geometry.attributes.position, spa=sp.array;
      for(var s=0;s<wireSegs.length;s++){ var a=wireSegs[s][0], b=wireSegs[s][1];
        var ra=SPHERE_R*(1+_lift[a]), rb=SPHERE_R*(1+_lift[b]), da=dirs[a], db=dirs[b];
        spa[s*6  ]=da.x*ra; spa[s*6+1]=da.y*ra; spa[s*6+2]=da.z*ra;
        spa[s*6+3]=db.x*rb; spa[s*6+4]=db.y*rb; spa[s*6+5]=db.z*rb; }
      sp.needsUpdate=true;
    }
    function updWaves(dt, breathK, tSec){
      // ONE motion system: breath = uniform baseline radial swell; waves = local
      // gaussian fronts; both compose additively into the same _lift buffer and
      // the same geometry write. No transform-level motion to fight against.
      var bl=0;
      if(breathK>0.001){
        var bp=Math.sin(tSec*0.7)*0.85 + Math.sin(tSec*0.26+1.1)*0.15;   // shaped, never perfectly periodic
        bl=BREATH_R*((bp<0?-1:1)*Math.pow(Math.abs(bp),0.72))*breathK;
      }
      if(!_waves.length && Math.abs(bl)<0.0005){
        if(_waveDirty){ for(var z=0;z<NNODES;z++) _lift[z]=0; _writeWaveBuffers(); _waveDirty=false; return true; }
        return false;
      }
      for(var n=0;n<NNODES;n++) _lift[n]=bl;
      for(var w=_waves.length-1; w>=0; w--){
        var wv=_waves[w]; wv.t+=dt;
        var front=wv.t*wv.sp, env=Math.exp(-wv.t*WAVE_DECAY)*wv.s;
        if(env<0.02 && front>Math.PI+1.0){ _waves.splice(w,1); continue; }
        for(var n2=0;n2<NNODES;n2++){
          var x=wv.d[n2]*(1+_nodeJit[n2]*WAVE_JITTER)-front;
          var g2=Math.exp(-(x*x)/(2*wv.wd*wv.wd));
          _lift[n2]+=WAVE_AMP*env*g2;
        }
      }
      _writeWaveBuffers(); _waveDirty=true; return true;
    }

    var _LCH='ABCDEFGHIJKLMNOPQRSTUVWXYZ#%/<>0123456789';
    LABELS.forEach(function(name,li){
      var el=document.createElement('div'); el.className='glbl'; el.textContent=name;
      el.setAttribute('role','link'); el.tabIndex=0;
      var go=function(){ var href=LABEL_HREF[li]; if(href) location.href=href; };
      el.addEventListener('click', go);
      el.addEventListener('keydown', function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); go(); } });
      /* one-shot scramble-settle on hover — same grammar as the nav, but a single
         timed pass (rAF only runs while one label is hovered) so it stays cheap. */
      var _sc=null;
      el.addEventListener('mouseenter', function(){
        fireWave(LABEL_NODE[li], 0.9);   // wave ping from this node — the label touches the mesh
        if(_sc) return;
        var start=performance.now(), dur=300;
        _sc=requestAnimationFrame(function tick(now){
          var p=(now-start)/dur;
          if(p>=1){ el.textContent=name; _sc=null; return; }
          var rev=(p*name.length)|0, out='';
          for(var c=0;c<name.length;c++) out += c<rev ? name[c] : _LCH[(Math.random()*_LCH.length)|0];
          el.textContent=out; _sc=requestAnimationFrame(tick);
        });
      });
      el.addEventListener('mouseleave', function(){ if(_sc){ cancelAnimationFrame(_sc); _sc=null; } el.textContent=name; });
      labelHost.appendChild(el); labelEls.push(el);
    });

    /* Pre-warm can run before any scroll, so globe-active flips the canvas to
       opacity:1 while nothing is rendered yet. Keep it hidden until the frame
       loop decides the globe is live (progress>0.02); the frame already toggles
       visibility, this just guarantees no 1-frame reveal at progress 0. */
    canvas.style.visibility='hidden';
    document.body.classList.add('globe-active');

    /* Label projection basis: the canvas's ACTUAL client rect, not innerWidth/
       innerHeight. The window-size shortcut only holds while the canvas exactly
       fills the viewport (documented three.js pitfall — mrdoob/three.js#23120);
       measuring the rect makes label alignment robust to any layout change.
       Cached; refreshed on resize only (no per-frame layout read). */
    var _glRect = canvas.getBoundingClientRect();
    /* cLabelsEl doesn't exist yet at this point in boot (created further down)
       — positionLabels() below fills this in once it does. Refreshed here on
       resize alongside _glRect so both stay in sync without a per-frame read. */
    var _lblRect = null;
    addEventListener('resize',function(){ W=innerWidth;H=innerHeight;
      GL_SIDE=Math.round(Math.min(1180,Math.max(innerWidth,innerHeight)*0.92));
      camera.aspect=1;camera.updateProjectionMatrix();renderer.setSize(GL_SIDE,GL_SIDE,false);
      _glRect = canvas.getBoundingClientRect();
      if(cLabelsEl) _lblRect = cLabelsEl.getBoundingClientRect();
      cacheArcMetrics(); },{passive:true});

    // progress source: total runway = beat1 + beat-arc
    /* Cache the runway metrics — beat1's doc-space top and the total height
       only change on resize/refresh, so reading them every frame just forces
       needless layout. Cache once, recompute on resize. Then per-frame we only
       read scrollY (cheap, no layout flush). */
    var _arcTop=0, _arcTotal=1, _arcCached=false;
    var _tourTop=0, _tourTotal=1, _tourOK=false;
    function cacheArcMetrics(){
      var b1=document.getElementById('beat1'), ba=document.getElementById('beat-arc');
      if(!b1||!ba){ _arcCached=false; return; }
      _arcTop   = ba.getBoundingClientRect().top + scrollY;   /* clean flow: globe trigger moved to beat-arc */
      _arcTotal = Math.max(1, ba.offsetHeight);
      _arcCached=true;
      var bt=document.getElementById('beat-tour');
      if(bt && bt.offsetHeight>0){ _tourTop=bt.getBoundingClientRect().top+scrollY; _tourTotal=Math.max(1,bt.offsetHeight); _tourOK=true; }
      else { _tourOK=false; }
    }
    function computeProgress(){
      if(!_arcCached) cacheArcMetrics();
      if(!_arcCached) return 0;
      return clamp01((scrollY - _arcTop)/_arcTotal);
    }
    function computeTourP(){
      if(!_tourOK){ cacheArcMetrics(); if(!_tourOK) return 0; }
      return clamp01((scrollY - _tourTop)/_tourTotal);
    }

    /* Smoothness knobs:
       SMOOTH_LAMBDA — how fast the rendered progress chases the scroll target.
                       Higher = snappier, lower = more cinematic lag. ~9 reads
                       as "liquid". This is a second smoothing layer on top of
                       Lenis: Lenis smooths the scroll INPUT, this smooths the
                       value we actually render, which is what removes the last
                       bit of rigidity from scroll-driven 3D.
       ARC_FAST/IDLE — dynamic frame cap. Full-rate (60fps) while the arc is
                       engaged so the visual matches the scrollbar; 30fps when
                       idle to save the battery. */
    var SMOOTH_LAMBDA=30, ARC_FAST=1000/30, ARC_IDLE=1000/30;   // globe capped at 30fps to match the network loop; on an integrated GPU a steady 30 beats a stuttering 45. Lenis still smooths the input.
    var renderProgress=-1;
    /* Pass B idle render-gate: the tour keeps `engaged` true across its whole
       360vh, so without this the globe re-renders at full rate even while parked
       on a project with the scroll stopped. We track the few values that actually
       drive the picture and skip the WebGL render when none of them moved — the
       last framebuffer persists, so a held project costs ~zero GPU. (The halo's
       idle pulse is intentionally excluded; it freezes while everything is still,
       which is the point of the pause.) */
    var _pPrev=-1,_tpPrev=-1,_ryPrev=0,_rxPrev=0,_fPrev=-1,_fmPrev=-1,_sPrev=-1,_pxPrev=0,_pyPrev=0,_renderedOnce=false,_lastWaveIdx=-1;
    var _holdIdx=-1,_lastWaveT=-1e9,_nbrShow=0,_projVis=[1,1,1];   // Schmitt-held project, wave cooldown clock, neighbor-tier fade, per-project label fades

    /* ════════════════ PROJECT TOUR setup ════════════════
       Rides on the held globe (descent is neutralized in the frame). The
       #beat-tour scroll band drives tourP 0..1, split into three focus bands —
       one per project. In each band the globe eases to face that project's node,
       the node + its neighbours glow, and that project's blueprint card fades in.
       To edit content: PROJECTS below. To add real images: set `img` to the URL
       (the blueprint duotone is applied by CSS). */
    /* Sentinel screenshots (base64-embedded to keep this a single portable file).
       hero = SOC autotriage terminal; frames = live threat feed + architecture flow.
       The blueprint duotone / screen-blend is applied by CSS (.pblue img). */
    var SENTINEL_IMG  = '/images/sentinel-hero.webp';
    var SENTINEL_IMGL = ['/images/sentinel-frame-1.webp','/images/sentinel-frame-2.webp'];
    /* PRISM figures (SELA): hero = three-tier network architecture;
       frames = secure-aggregation FL flow + system component interaction.
       Source figures are white-background diagrams (see note in chat re: treatment). */
    var PRISM_IMG  = '/images/prism-hero.webp';
    var PRISM_IMGL = ['/images/prism-frame-1.webp','/images/prism-frame-2.webp'];
    /* AXON figures (all dark-bg terminals): hero = risk-eval + FIDO2 step-up;
       frames = session risk-signal JSON + continuous risk-scoring graph. */
    var AXON_IMG  = '/images/axon-hero.webp';
    var AXON_IMGL = ['/images/axon-frame-1.webp','/images/axon-frame-2.webp'];
    var PROJECTS = [
      { node:LABEL_NODE[0], kicker:'Project 01 / Detection', title:'SENTINEL',
        cap:'log to alert to autotriage', href:LABEL_HREF[0], img:SENTINEL_IMG, imgL:SENTINEL_IMGL, capL:['wazuh alert feed // T1190','detection pipeline flow'],
        metric:['9 → 15','ATT&CK techniques'],
        spec:[['Stack','Splunk · Wazuh · Security Onion'],
              ['Pipeline','Shuffle SOAR · n8n · Ollama'],
              ['Coverage','MITRE ATT&CK 9 → 15']] },
      { node:LABEL_NODE[1], kicker:'Project 02 / Federated ML', title:'PRISM',
        cap:'passive detection across 7 federated sites', href:LABEL_HREF[1], img:PRISM_IMG, imgL:PRISM_IMGL, invert:true, capL:['secure aggregation // masked ΔΘ','three-tier OT/ICS topology'],
        metric:['< 8%','false-positive rate'],
        spec:[['Stack','Flower FedProx · Temporal VAE'],
              ['Data','SWaT · 7 OT/ICS nodes'],
              ['Result','sub-8% false-positive rate']] },
      { node:LABEL_NODE[2], kicker:'Project 03 / Identity', title:'AXON',
        cap:'auth that tightens only when risk rises', href:LABEL_HREF[2], img:AXON_IMG, imgL:AXON_IMGL, capL:['session risk signals // live','risk score vs NIST 800-63B'],
        metric:['800-63B','NIST standard'],
        spec:[['Standard','NIST 800-63B'],
              ['Model','continuous risk signals'],
              ['Action','adaptive step-up auth']] },
    ];
    var NP = PROJECTS.length;
    var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

    /* ──────────────── TOUR FEEL — one place to tune pacing & motion ────────────────
       TOUR_ROT_EASE   how fast the globe parks on the faced project. Higher = snappier
                       park + longer still hold; lower = lazier drift. (was 3.4 inline)
       TOUR_PITCH      strength of the vertical-centre correction (0 = off, 1 = full).
       TOUR_PITCH_SIGN flip to -1 if a faced project lands LOW instead of centred.
       TOUR_HOLD       focus plateau width: higher = each project holds longer before
                       it starts fading to the next (more reading time). (was 0.42)
       Band LENGTH (scroll distance per project) is the #beat-tour height in CSS —
       360vh = ~120vh/project. Raise it for a slower tour, lower for a quicker one. */
    var TOUR_ROT_EASE   = 4.4;
    var TOUR_HOLD       = 0.52;
    /* GLOBE_BRIGHT      global multiplier on node/dot/edge brightness — lifts the
                         whole web (image-1 crispness). 1 = old, ~1.6 = brighter.
       TOUR_SCRIM        how dark the background goes behind a held project.
       TOUR_GLOBE_X      horizontal globe offset during the tour (0 = centred, now
                         that windows flank both sides; was a -0.55 left slide).
       TOUR_GLOBE_SCALE  globe shrinks to this during the tour, leaving margins for
                         the side windows (1 = no shrink).
       TOUR_CENTER_Y     screen target for the faced node (0 = dead centre).
       TOUR_CENTER_EASE  how fast the globe glides to vertically centre the node.
       Vertical centring is now a screen-space closed loop (projects the node and
       eases the globe to null the offset), so it works for every project regardless
       of latitude and never fights the globe's roll. */
    var GLOBE_BRIGHT    = 1.7;
    var TOUR_SCRIM      = 0.34;   // gentle: tones the busy starfield down a touch but keeps it visible
    var TOUR_GLOBE_X    = -0.55;  // shift the globe to the left; project card sits on the right
    var TOUR_GLOBE_SCALE= 1.0;    // no shrink (the 0.9 was only to make room for the old side windows)
    /* Ambient breathing THROUGH the wave medium: a slow, low swell fired from a
       random node every few seconds keeps 1–2 gentle waves always crossing the
       mesh — the globe's resting breath. Interaction waves share the engine. */
    var AMBIENT_EVERY_MS  = 6500;
    var AMBIENT_STRENGTH  = 0.30;
    var AMBIENT_OPTS      = { speed:1.1, width:0.60 };   // slower + broader than interaction waves
    var _nextAmbient      = 0;
    var TOUR_CENTER_Y   = 0.0;
    var TOUR_CENTER_EASE= 3.2;

    // facing yaw per project: rotate the node's azimuth to point at the camera (+z)
    var projYaw = PROJECTS.map(function(p){ var d=dirs[p.node]; return -Math.atan2(d.x, d.z); });
    // facing pitch per project: after the yaw lands the node on the +z meridian, its
    // remaining elevation is asin(y); rotating the globe by that on X brings it to the
    // horizontal centre line. Small now that the project nodes sit near the equator.
    var projPitch = PROJECTS.map(function(p){ return Math.asin(Math.max(-1,Math.min(1,dirs[p.node].y))); });
    // each project's 6 nearest nodes (by direction) for the "nearby glow"
    // each project's 6 nearest nodes — built GREEDILY DISJOINT: a candidate is
    // skipped if it's any labeled node (projects + telemetry markers) or already
    // claimed by an earlier project, so no node ever carries two meanings.
    var _claimed={}; LABEL_NODE.forEach(function(n){_claimed[n]=1;});
    var projNbr = PROJECTS.map(function(p){
      var base=dirs[p.node], scored=[];
      for(var i=0;i<dirs.length;i++){ if(_claimed[i]) continue; scored.push([base.dot(dirs[i]), i]); }
      scored.sort(function(a,b){return b[0]-a[0];});
      var take=scored.slice(0,6).map(function(s){return s[1];});
      take.forEach(function(n){_claimed[n]=1;});
      return take;
    });

    /* ── TWO-PHASE SIGNAL LABELS ──────────────────────────────────────────────
       Phase 1 (formed globe, pre-tour): an AMBIENT knowledge field — the working
       vocabulary of the discipline scattered as faint telemetry across the sphere.
       Phase 2 (tour): the field fades and the active project's six NEIGHBOR nodes
       (projNbr — same nodes the glow already uses) relabel with that project's own
       artifacts: the CVE it addresses, technique class, defensive discipline.
       Broad field -> focused cluster; the tour is a lens. */
    var AMBIENT_TERMS=['T1078','EID-4624','EID-4776','D3-NTA','D3-UBA','SIGMA','YARA',
      'IOC','TTP','C2','EDR','PCAP','NETFLOW','IDOR','CNAME-TKO','ZERO-TRUST'];
    var PROJECT_SIGNALS=[
      /* SENTINEL — detection/IR chain  */ ['CVE-2025-24813','T1190','EID-4624','D3-NTA','SIGMA','IOC'],
      /* PRISM — OT/ICS anomaly stack   */ ['T0866','ANOMALY','FEDPROX','T-VAE','OT/ICS','ATT&CK-ICS'],
      /* AXON — adaptive auth           */ ['NIST-800-63B','T1078','AAL2','RISK-SCORE','MFA','D3-UBA']
    ];   // vocabularies kept fully disjoint so no word ever appears in two clusters
    // spread ambient terms over the sphere, skipping project nodes, their neighbor
    // sets, and the main telemetry markers so tiers never collide on one node
    var _taken={}; LABEL_NODE.forEach(function(n){_taken[n]=1;});
    projNbr.forEach(function(arr){ arr.forEach(function(n){_taken[n]=1;}); });
    var ambientEls=[], ambientNode=[];
    (function(){
      var stride=Math.floor(NNODES/AMBIENT_TERMS.length), idx=2;
      // a node is unusable if taken, or within ~20° of a project node (dot > 0.94):
      // phase 1 must never crowd the destinations
      function _clear(n){ if(_taken[n]) return false;
        for(var p2=0;p2<PROJECTS.length;p2++){ if(dirs[n].dot(dirs[PROJECTS[p2].node])>0.94) return false; }
        return true; }
      for(var a=0;a<AMBIENT_TERMS.length;a++){
        var guard=0;
        while(!_clear(idx) && guard++<NNODES) idx=(idx+1)%NNODES;
        _taken[idx]=1; ambientNode.push(idx); idx=(idx+stride)%NNODES;
        var el=document.createElement('div'); el.className='gsig'; el.textContent=AMBIENT_TERMS[a];
        labelHost.appendChild(el); ambientEls.push(el);
      }
    })();
    var nbrSigEls=[];
    for(var ns=0; ns<6; ns++){ var nel=document.createElement('div'); nel.className='gsig sig-n';
      labelHost.appendChild(nel); nbrSigEls.push(nel); }
    var _nbrTextIdx=-1;   // which project's texts are currently loaded into the neighbor tier

    // active-node glow: a brighter, pulsing version of the SAME tight dot the label
    // nodes use (sharp, clean) with a small tight bloom behind it — reads as "that
    // node lit up", consistent with the rest-state look, not a diffuse orb.
    var bloomTex = bloomGlowTex();
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:bloomTex, color:0x8fd4ff,
      transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    halo.scale.setScalar(0.5); worldGroup.add(halo);
    var core = new THREE.Sprite(new THREE.SpriteMaterial({ map:dotTexture(), color:0xfaffff,
      transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    core.scale.setScalar(0.17); worldGroup.add(core);
    var nbrGeo = new THREE.BufferGeometry();
    var nbrPos = new Float32Array(6*3);
    nbrGeo.setAttribute('position', new THREE.BufferAttribute(nbrPos,3));
    var nbrPoints = new THREE.Points(nbrGeo, new THREE.PointsMaterial({ map:dotTexture(), color:0xcfe8ff,
      size:0.085, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, sizeAttenuation:true }));
    worldGroup.add(nbrPoints);
    // bright connection lines from the focused project node to its neighbours — makes
    // a hold read as "this one node and what it links to" rather than the whole web
    var feGeo = new THREE.BufferGeometry();
    var fePos = new Float32Array(6*2*3);
    feGeo.setAttribute('position', new THREE.BufferAttribute(fePos,3));
    var focusEdges = new THREE.LineSegments(feGeo, new THREE.LineBasicMaterial({ color:0x86d4ff,
      transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
    worldGroup.add(focusEdges);
    var _tmpN = new THREE.Vector3();
    // temporaries for publishing the globe's screen-space disk (for 2D ship avoidance)
    var _gCenter = new THREE.Vector3(), _gEdge = new THREE.Vector3();
    // ---- rotation-to-present: turn the globe (not translate it) so the active
    // project's node faces front-centre. Quaternion + slerp is the correct way to
    // tween orientation without whip/gimbal. Keeps the globe planted in the centre.
    var GLOBE_ROLL = -0.18;                               // the globe's resting aesthetic tilt
    var _qTarget = new THREE.Quaternion();

    /* ══ T2 ══════════════════════════════════════════════════════════════
         capP  terminal takes the globe: chrome in, box closes to fit
         conP  terminal and globe shrink together and travel right
         outP  T2 leaves at the footer beat. T3 does its own thing, as always. */
    var GT_BAR=34;   // matches T3's .fterm-bar
    var _gtEl=document.getElementById('globe-term');
    var _gtTitle=document.getElementById('gt-title');
    var _cdEl=document.getElementById('cr-detail');
    var _railEl=document.getElementById('case-rail');
    var _root=document.documentElement;
    var _capFired=false;
    function lerpN(a,b,t){ return a+(b-a)*t; }

    /* The terminal is BORN at its final size, centred, and then only slides
       right. Nothing about it resizes: w, h, y and the radius are constant from
       the moment of capture, so the only animated property is x. That kills the
       continuous re-layout that everything inside was fighting. */
    function gtCapture(){
      var c=gtConsole();
      return {x:(innerWidth-c.w)/2, y:c.y, w:c.w, h:c.h, r:c.r};
    }
    function gtConsole(){                 // right side, fills vertically
      var vw=innerWidth, vh=innerHeight;
      var edge=Math.min(48,Math.max(16,vw*0.030));
      var rail=Math.min(240,Math.max(160,vw*0.17));
      var left=(vw<=980)? edge : edge+rail+Math.min(40,Math.max(14,vw*0.024));
      var top=Math.min(88,vh*0.09), bot=Math.min(56,vh*0.055);
      return {x:left, y:top, w:Math.max(220,vw-left-edge), h:Math.max(200,vh-top-bot), r:9};
    }

    var _glR={left:0,top:0,width:1,height:1};
    /* Change-guarded custom-property writer. Mutating a custom property on :root
       invalidates style for every element that references it; during the held
       and idle portions of the tour capP/conP/outP are constant, so the values
       below are identical frame-to-frame. Only write when a value actually
       changed — the browser then skips the style/layout pass entirely. */
    var _gtvCache={};
    function _setV(n,v){ if(_gtvCache[n]!==v){ _gtvCache[n]=v; _root.style.setProperty(n,v); } }
    function gtApply(capP, conP, outP){
      var vw=innerWidth, vh=innerHeight;
      var B=gtCapture(), C=gtConsole();
      /* The frame is full-viewport until capture. It has overflow:hidden, so a
         console-sized box was cropping the full-bleed globe top and bottom while
         still invisible — that was the "square terminal". Size closes in during
         capture only; from there w/h/y are CONSTANT and just x travels. */
      var w=lerpN(vw, C.w, capP), h=lerpN(vh, C.h, capP);
      var y=lerpN(0, C.y, capP),  r=lerpN(0, C.r, capP);
      var x=lerpN(lerpN(0, B.x, capP), C.x, conP);
      var bar=GT_BAR*capP;

      _setV('--gt-x',x.toFixed(1)+'px');
      _setV('--gt-y',y.toFixed(1)+'px');
      _setV('--gt-w',w.toFixed(1)+'px');
      _setV('--gt-h',h.toFixed(1)+'px');
      _setV('--gt-r',r.toFixed(1)+'px');
      _setV('--gt-chrome',capP.toFixed(3));
      _setV('--gt-bar',bar.toFixed(1)+'px');
      _setV('--gt-o',(1-outP).toFixed(3));
      _setV('--rail-o',Math.max(0,Math.min(conP,1-outP)).toFixed(3));

      /* v9 parity at formation. The 50deg VERTICAL fov is unchanged by the
         square buffer, so a square canvas of side ~vh frames the sphere exactly
         as v9's full-viewport canvas did; only the horizontal field changed, and
         a sphere is governed by the vertical. 0.62 was an over-correction. */
      var free  = Math.min(vw,vh)*0.98;      // formation: matches v9
      var inWin = Math.min(w, h-bar)*0.88;   // inside the terminal: shrinks a little
      var side=lerpN(free, inWin, capP);
      /* Before capture the canvas must land at VIEWPORT centre even though it is
         a child of the terminal, so its offset is corrected by the terminal's
         own position; after capture it simply centres inside the frame. */
      var glx=lerpN((vw-side)/2 - x, (w-side)/2, capP);
      var gly=lerpN((vh-side)/2 - y, bar+((h-bar)-side)/2, capP);
      _setV('--gl-x',glx.toFixed(1)+'px');
      _setV('--gl-y',gly.toFixed(1)+'px');
      _setV('--gl-s',side.toFixed(1)+'px');

      /* labels are guests of T2, so _glRect is T2-relative and computed from
         the same numbers that placed the canvas — exact, and no forced layout */
      _glR.left=glx; _glR.top=gly; _glR.width=side; _glR.height=side;
      _glRect=_glR;

      if(!_capFired && capP>0.04){ _capFired=true;
        if(!RM && _gtEl){ _gtEl.classList.add('capture');
          setTimeout(function(){ _gtEl.classList.remove('capture'); },460); } }
      if(_capFired && capP<0.01) _capFired=false;
      /* Clicks: set INLINE rather than via a body class. #window is a
         full-viewport fixed element with default pointer-events sitting under
         the rail, so any failure of the class to apply sent every click into it.
         An inline style cannot be overridden or missed. */
      var railVis = Math.max(0, Math.min(conP, 1-outP));
      if(_railEl) _railEl.style.visibility = railVis > 0.02 ? 'visible' : 'hidden';
      document.body.classList.toggle('console-live', railVis > 0.3);
    }

    /* ── selection: rail is now the case DETAIL panel too ──────────────── */
    var _csSel=0,_csAnim=0,_csBtns=[];
    (function buildRail(){
      var ul=document.getElementById('case-list'); if(!ul) return;
      PROJECTS.forEach(function(p,i){
        var li=document.createElement('li'),b=document.createElement('button');
        /* role="presentation": #case-list is role="tablist", which requires its
           direct children to be role="tab". Without this, the <li> wrapper's
           implicit listitem role sits between tablist and tab, an invalid ARIA
           parent/child relationship (flagged by Lighthouse: aria-required-children
           on the ul, listitem on the li). Presentation makes AT skip straight to
           the button's own role="tab" below. */
        li.setAttribute('role','presentation');
        b.type='button'; b.setAttribute('role','tab'); b.setAttribute('aria-selected','false');
        b.innerHTML='<span class="cr-id">CASE-00'+(i+1)+'</span><span class="cr-nm">'+p.title+'</span>';
        b.addEventListener('click',function(){ csSelect(i); });
        li.appendChild(b); ul.appendChild(li); _csBtns.push(b);
      });
      ul.addEventListener('keydown',function(e){
        if(e.key!=='ArrowDown'&&e.key!=='ArrowUp') return; e.preventDefault();
        var n=(_csSel+(e.key==='ArrowDown'?1:-1)+_csBtns.length)%_csBtns.length;
        _csBtns[n].focus(); csSelect(n);
      });
    })();
    function csSelect(i){
      i=Math.max(0,Math.min(NP-1,i|0));
      var changed=(i!==_csSel); _csSel=i;
      var p=PROJECTS[i];
      for(var k=0;k<_csBtns.length;k++) _csBtns[k].setAttribute('aria-selected',k===i?'true':'false');
      if(_gtTitle) _gtTitle.textContent='root@console : globe : '+String(p.title).toLowerCase();
      /* rail is names only — the case detail renders inside the terminal */
      if(_gtEl && changed && !RM){ _gtEl.classList.remove('sweep'); void _gtEl.offsetWidth; _gtEl.classList.add('sweep'); }
    }
    window.SITE.__csSelect=csSelect;
    csSelect(0);
    var _qFace   = new THREE.Quaternion();
    var _qRoll   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), GLOBE_ROLL);
    var _eRest   = new THREE.Euler(0,0,GLOBE_ROLL,'XYZ');
    var _frontDir= new THREE.Vector3(0,0,1);              // toward the camera = screen centre
    var _nodeDir = new THREE.Vector3();

    /* ---- build the blueprint window clusters ----
       Each project = an asymmetric stack of tiles. Each tile carries a reveal
       order (dly) and an enter direction (dir, ±1 = from left/right) so they
       stagger in from alternating sides as the globe lands, Codrops-style. */
    var scrim = document.getElementById('tour-scrim');
    var cardHost = document.getElementById('project-cards');
    var clusters = [];   // [{ el, tiles:[{el,dly,dir,dy}] }]
    if(cardHost){
      // a simple schematic screen (the two corner screens reuse this)
      function reconStamp(s){ s=String(s||''); var h=0x811c;
        for(var i=0;i<s.length;i++){ h=((h^s.charCodeAt(i))*0x0193)&0xffff; }
        return '\u25A3 REC\u00B70x'+('000'+h.toString(16).toUpperCase()).slice(-4); }
      function winHTML(cls, src, cap, inv){
        return '<div class="ptile '+cls+'"><div class="pblue'+(src?'':' pblue--empty')+(inv||'')+'">'
          + '<img alt="" src="'+(src||BLANK_IMG)+'">'
          + '<i class="phud-ret"></i>'
          + '<span class="phud-empty">awaiting feed</span>'
          + (src?'<span class="phud-meta">'+reconStamp(cap)+'</span>':'')
          + '</div><div class="pcap">'+cap+'</div></div>';
      }
      PROJECTS.forEach(function(p){
        var imgL = p.imgL || [];   // optional [url,url] for the two corner screens
        var invCls = p.invert ? ' pblue--invert' : '';
        var capL = p.capL || ['// frame 02','// frame 03'];
        var cl=document.createElement('div'); cl.className='pcluster';
        var specHTML = p.spec.map(function(s){ return '<li><span class="k">'+s[0]+'</span><span class="v">'+s[1]+'</span></li>'; }).join('');
        cl.innerHTML =
            '<div class="ptile ptile--title"><div class="pk">'+p.kicker+'</div><div class="pt">'+p.title+'</div></div>'
          + '<div class="ptile ptile--img"><div class="pblue'+(p.img?'':' pblue--empty')+invCls+'">'
              + '<img alt="" src="'+(p.img||BLANK_IMG)+'">'
              + '<span class="phud-tag">'+p.title+'</span>'
              + '<i class="phud-ret"></i>'
              + '<span class="phud-empty">awaiting feed</span>'
              + (p.img?'<span class="phud-meta">'+reconStamp(p.title)+'</span>':'')
            + '</div><div class="pcap">'+p.cap+'</div></div>'
          + '<div class="ptile ptile--spec"><ul>'+specHTML+'</ul></div>'
          + (p.href ? '<div class="ptile ptile--link"><a href="'+p.href+'">view project &rarr;</a></div>' : '');
        cardHost.appendChild(cl);
        // two corner screens framing the globe on the left
        var clL=document.createElement('div'); clL.className='pcluster-l';
        clL.innerHTML = winHTML('ptile--limg l1', imgL[0], capL[0], invCls)
                      + winHTML('ptile--limg l2', imgL[1], capL[1], invCls);
        cardHost.appendChild(clL);
        var tEls = [].slice.call(cl.querySelectorAll('.ptile'))
                     .concat([].slice.call(clL.querySelectorAll('.ptile')));
        var tiles=[];
        for(var ti=0; ti<tEls.length; ti++){
          var isL = tEls[ti].classList.contains('ptile--limg');
          tiles.push({ el:tEls[ti], dly:ti, dir:(isL?-1:(ti%2===0?-1:1)), dy:(isL?12:(ti%2===0?-14:18)) });
        }
        clusters.push({ el:cl, tiles:tiles });
      });
    }
    var _clusterOn = clusters.map(function(){return true;});  // force first hide pass

    // shortest-path angular approach (so the globe never spins the long way round)
    function approachAngle(cur, tgt, k){
      var d = Math.atan2(Math.sin(tgt-cur), Math.cos(tgt-cur));
      return cur + d*k;
    }
    // trapezoid focus: 0 outside the band, ramps to 1 across a plateau centred on the project
    // Projects occupy the first TOUR_SPAN of the band; the tail (TOUR_SPAN..1) is Axon's
    // hold-out + exit runway and the footer's entrance, so Axon reads as long as the others
    // instead of getting cut off at the band end.
    var TOUR_SPAN = 0.80;
    function bandFocus(tp, idx){
      var tps = Math.min(1, tp / TOUR_SPAN);     // stretch projects into [0..TOUR_SPAN]
      var c=(idx+0.5)/NP, half=0.5/NP;           // band centre + half-width
      // Axon (last project) holds its focus through the tail instead of fading after centre.
      if(idx===NP-1 && tps>c){ return 1.0; }
      var x=Math.abs(tps-c)/half;                // 0 at centre, 1 at band edge
      return clamp01((1.0 - x) / TOUR_HOLD);     // hold near centre, fade toward edges
    }

    // ═══ per-project constellation layer (reactive to the accordion) ═══
    var cLabelsEl = document.getElementById('c-labels');
    if(cLabelsEl) _lblRect = cLabelsEl.getBoundingClientRect();
    var _cUp=new THREE.Vector3(), _cT1=new THREE.Vector3(), _cT2=new THREE.Vector3(), _projV=new THREE.Vector3();
    var _zAxis=new THREE.Vector3(0,0,1), _qRollDyn=new THREE.Quaternion(), _cSpin=0;
    function placeOnSphere(center,u,v,scale){
      _cUp.set(0,1,0); if(Math.abs(center.y)>0.86) _cUp.set(1,0,0);
      _cT1.crossVectors(_cUp,center).normalize();
      _cT2.crossVectors(center,_cT1).normalize();
      return center.clone().addScaledVector(_cT1,u*scale).addScaledVector(_cT2,v*scale).normalize().multiplyScalar(SPHERE_R*1.03);
    }
    // each figure: a centre direction (reuses the project node), a tangent-plane (u,v)
    // point set forming a simple constellation, its edges, tool labels + anchor flags
    /* Each figure mixes labeled tool-stars with a few unlabeled "connector" stars
       (label:'') purely for shape — same trick real constellation charts use so the
       figure reads as an actual asterism instead of a bare triangle or a straight
       chain. Edges include internal cross-braces, not just an outline. */
    var CFIG=[
      { c:dirs[PROJECTS[0].node].clone().normalize(), scale:0.66,
        pts:[[-1.05,0.10],[-0.62,0.55],[-0.30,-0.42],[0.05,0.50],[0.30,-0.55],[0.65,0.35],[0.55,-0.05],[1.05,-0.20]],
        edges:[[0,1],[0,2],[1,2],[1,3],[2,4],[3,6],[4,6],[6,5],[6,7],[4,7]],
        labels:['Wazuh','','Security Onion','Splunk','','Shuffle','','Ollama'], anchors:[3,7] },
      { c:dirs[PROJECTS[1].node].clone().normalize(), scale:0.60,
        pts:[[-0.65,0.48],[0,0.62],[0.68,0.30],[0.15,-0.60],[-0.60,-0.35]],
        edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[0,2],[4,1]],
        labels:['Temporal VAE','','SWaT','','Flower FedProx'], anchors:[4] },
      { c:dirs[PROJECTS[2].node].clone().normalize(), scale:0.62,
        pts:[[-0.95,-0.15],[-0.45,0.48],[0.05,0.58],[0.50,0.05],[0.95,0.15],[0.10,-0.55]],
        edges:[[0,1],[1,2],[2,3],[3,4],[0,5],[4,5],[1,5],[3,0]],
        labels:['risk signals','','NIST 800-63B','','step-up','session'], anchors:[2] }
    ];
    var cNodesMat=new THREE.PointsMaterial({size:0.15,map:dotTexture(),sizeAttenuation:true,color:0xe6ecff,transparent:true,opacity:0,depthTest:false,depthWrite:false});
    var cNodes=new THREE.Points(new THREE.BufferGeometry(),cNodesMat); cNodes.renderOrder=6; cNodes.frustumCulled=false; worldGroup.add(cNodes);
    var cLinesMat=new THREE.LineBasicMaterial({color:0xc2d2ff,transparent:true,opacity:0,depthTest:false,depthWrite:false});
    var cLines=new THREE.LineSegments(new THREE.BufferGeometry(),cLinesMat); cLines.renderOrder=5; cLines.frustumCulled=false; worldGroup.add(cLines);
    var _cCur=-1,_cState='idle',_cT=0,_cPend=-1,_cPos=[],_cLabelEls=[];
    function buildConstellation(idx){
      var f=CFIG[idx];
      _cPos=f.pts.map(function(uv){ return placeOnSphere(f.c,uv[0],uv[1],f.scale); });
      var np=new Float32Array(_cPos.length*3);
      _cPos.forEach(function(p,i){ np[i*3]=p.x; np[i*3+1]=p.y; np[i*3+2]=p.z; });
      cNodes.geometry.dispose(); cNodes.geometry=new THREE.BufferGeometry();
      cNodes.geometry.setAttribute('position',new THREE.BufferAttribute(np,3));
      var ep=new Float32Array(f.edges.length*6);
      f.edges.forEach(function(e,i){ var a=_cPos[e[0]],b=_cPos[e[1]];
        ep[i*6]=a.x;ep[i*6+1]=a.y;ep[i*6+2]=a.z; ep[i*6+3]=b.x;ep[i*6+4]=b.y;ep[i*6+5]=b.z; });
      cLines.geometry.dispose(); cLines.geometry=new THREE.BufferGeometry();
      cLines.geometry.setAttribute('position',new THREE.BufferAttribute(ep,3));
      if(cLabelsEl){
        _cLabelEls.forEach(function(e){ if(e&&e.parentNode) e.parentNode.removeChild(e); });
        _cLabelEls=f.labels.map(function(name,i){
          if(!name) return null;   // unlabeled connector star — shape only, no DOM label
          var el=document.createElement('div');
          el.className='clbl'+(f.anchors.indexOf(i)>=0?' anchor':'');
          el.textContent=name; cLabelsEl.appendChild(el); return el;
        });
      }
      try{ updateOverlay(idx); }catch(e){}
    }
    function updateOverlay(idx){
      var pj=PROJECTS[idx]; if(!pj) return;
      var t=document.getElementById('pv-title');
      if(t){
        if(window.SITE.__twTO){ clearTimeout(window.SITE.__twTO); }
        var twFull=pj.title, twI=0, twGen=(window.SITE.__twGen=(window.SITE.__twGen||0)+1);
        t.textContent='';
        (function typeName(){
          if(twGen!==window.SITE.__twGen) return;
          t.textContent=twFull.slice(0,twI);
          if(twI<=twFull.length){ twI++; window.SITE.__twTO=setTimeout(typeName, 55); }
        })();
      }
      var im=document.getElementById('pv-img');
      if(im){
        if(window.SITE.__pvSlide){ clearInterval(window.SITE.__pvSlide); window.SITE.__pvSlide=null; }
        if(window.SITE.__pvTO){ clearTimeout(window.SITE.__pvTO); window.SITE.__pvTO=null; }
        var gen=(window.SITE.__pvGen=(window.SITE.__pvGen||0)+1);   // invalidates any in-flight fade from the previous project
        var imgs=(pj.imgL && pj.imgL.length) ? pj.imgL : (pj.img ? [pj.img] : []);
        if(imgs.length){
          var si=0;
          var showImg=function(n){ if(gen!==window.SITE.__pvGen) return; im.onload=function(){ if(gen===window.SITE.__pvGen) im.style.opacity='1'; }; im.src=imgs[n]; if(im.complete && gen===window.SITE.__pvGen) im.style.opacity='1'; };
          im.style.opacity='0'; showImg(0);
          if(imgs.length>1){ window.SITE.__pvSlide=setInterval(function(){
            if(gen!==window.SITE.__pvGen){ clearInterval(window.SITE.__pvSlide); return; }
            im.style.opacity='0';
            window.SITE.__pvTO=setTimeout(function(){ if(gen!==window.SITE.__pvGen) return; si=(si+1)%imgs.length; showImg(si); }, 320);
          }, 3600); }
        }
      }
      var pp=document.getElementById('pv-pills');
      if(pp){
        var terms=[];
        (pj.spec||[]).forEach(function(row){ (row[1]||'').split('·').forEach(function(t){ t=t.trim(); if(t) terms.push(t); }); });
        function buildRun(){
          var frag=document.createDocumentFragment();
          terms.forEach(function(t){
            var s=document.createElement('span'); s.className='pv-pill'; s.textContent=t; frag.appendChild(s);
            var sep=document.createElement('span'); sep.className='pv-pill-sep'; sep.textContent='·'; frag.appendChild(sep);
          });
          return frag;
        }
        pp.innerHTML='';
        pp.appendChild(buildRun());
        pp.appendChild(buildRun());
      }
      var v=document.getElementById('pv-view'); if(v && pj.href) v.href=pj.href;
    }
    // Ambient cybersecurity-skills field — the broader discipline, scattered as dim
    // background texture across whatever globe nodes a project hasn't already claimed
    // (LABEL_NODE + each project's 6-node neighbor cluster, tracked in _claimed).
    // Auto-placed by striding evenly around the sphere and skipping claimed nodes,
    // rather than hand-picked indices, so it degrades gracefully if NNODES or the
    // project neighbor counts ever change. Kept disjoint from the CFIG tool names
    // (Wazuh, Splunk, Flower FedProx, etc.) so no term ever appears twice on the globe.
    var AMBIENT_SKILLS=[
      'SIEM','EDR','XDR','SOAR','IAM','PAM','ZERO-TRUST','MFA',
      'IOC','TTP','THREAT-INTEL','THREAT-HUNTING','OSINT','FORENSICS','DFIR','HONEYPOT',
      'RED-TEAM','BLUE-TEAM','PENTEST','ATT&CK','NIST-CSF','OWASP-TOP10','VULN-MGMT',
      'INCIDENT-RESPONSE','MALWARE-ANALYSIS','REVERSE-ENG','CRYPTOGRAPHY','PKI',
      'WAF','DLP','CLOUD-SEC','DEVSECOPS'
    ];
    var _ambEls=[], _ambPos=[];
    (function buildAmbient(){
      if(!cLabelsEl) return;
      var stride=Math.max(1,Math.floor(NNODES/AMBIENT_SKILLS.length)), idx=1;
      for(var s=0;s<AMBIENT_SKILLS.length;s++){
        var guard=0;
        while(_claimed[idx] && guard++<NNODES) idx=(idx+1)%NNODES;
        if(_claimed[idx]) break;   // sphere fully claimed — shouldn't happen at this density
        _claimed[idx]=1;
        _ambPos.push(dirs[idx].clone().normalize().multiplyScalar(SPHERE_R*1.03));
        var el=document.createElement('div'); el.className='clbl amb'; el.textContent=AMBIENT_SKILLS[s];
        cLabelsEl.appendChild(el); _ambEls.push(el);
        idx=(idx+stride)%NNODES;
      }
    })();
    function positionLabels(){
      if(!cLabelsEl||!_lblRect) return;
      /* Was two fresh getBoundingClientRect() reads every call (every frame
         while labels are on-screen) — forced synchronous layout, flagged by
         DevTools as a top reflow site. Both rects only change on resize, so
         reuse the cached ones (kept in sync by the resize listener above). */
      var cr=_glRect, lr=_lblRect;
      for(var i=0;i<_cLabelEls.length;i++){
        var el=_cLabelEls[i]; if(!el||!_cPos[i]) continue;
        _projV.copy(_cPos[i]).applyQuaternion(worldGroup.quaternion).add(worldGroup.position);
        var front=_projV.z>0.02;
        _projV.project(camera);
        var x=(_projV.x*0.5+0.5)*cr.width+(cr.left-lr.left);
        var y=(-_projV.y*0.5+0.5)*cr.height+(cr.top-lr.top);
        el.style.left=x+'px'; el.style.top=y+'px';
        el.classList.toggle('back',!front);
      }
      for(var a=0;a<_ambEls.length;a++){
        var ael=_ambEls[a]; if(!_ambPos[a]) continue;
        _projV.copy(_ambPos[a]).applyQuaternion(worldGroup.quaternion).add(worldGroup.position);
        var af=_projV.z>0.02; _projV.project(camera);
        ael.style.left=((_projV.x*0.5+0.5)*cr.width+(cr.left-lr.left))+'px';
        ael.style.top=((-_projV.y*0.5+0.5)*cr.height+(cr.top-lr.top))+'px';
        ael.classList.toggle('back',!af);
      }
    }
    // Base opacity a constellation label eases toward once fully revealed — anchors
    // (the 1-2 headline tools per project) read slightly brighter/bolder than the
    // rest of that project's tool set, but ALL of them are visible with no hover
    // required: the whole point of clicking a project is that its tools light up.
    function _clblTarget(f,i){ return (f.anchors.indexOf(i)>=0) ? 0.95 : 0.72; }
    function updateConstellation(dtI){
      var want=(typeof window.SITE.__globeFocus==='number')?window.SITE.__globeFocus:-1;
      if(want<0) want=_cCur;
      if(want>=0 && want<CFIG.length){
        if(want!==_cCur && _cState!=='out'){
          if(_cCur<0){ buildConstellation(want); _cCur=want; _cState='in'; _cT=0; try{fireWave(PROJECTS[want].node,1.0);}catch(e){} }
          else { _cPend=want; _cState='out'; _cT=0; }
        }
        var f=CFIG[_cCur];
        if(_cState==='out'){
          _cT+=dtI; var o=1-Math.min(1,_cT/0.26);
          cNodesMat.opacity=1.0*o; cLinesMat.opacity=0.62*o;
          for(var li=0; li<_cLabelEls.length; li++){ if(!_cLabelEls[li]) continue; _cLabelEls[li].style.opacity=(_clblTarget(f,li)*o).toFixed(3); }
          if(_cT>=0.26){ buildConstellation(_cPend); _cCur=_cPend; _cState='in'; _cT=0; try{fireWave(PROJECTS[_cPend].node,1.0);}catch(e){} }
        } else if(_cState==='in'){
          _cT+=dtI; var tt=Math.min(1,_cT/0.85);
          cNodesMat.opacity=1.0*Math.min(1,tt*1.6); cNodesMat.size=0.14*(0.4+0.6*Math.min(1,tt*1.6));
          cLinesMat.opacity=0.62*Math.max(0,(tt-0.32)/0.68);
          // labels cascade in one after another, just behind the node/line reveal —
          // a gentle "constellation forming" read rather than everything popping at once.
          for(var lj=0; lj<_cLabelEls.length; lj++){
            if(!_cLabelEls[lj]) continue;
            var lp=clamp01((tt - lj*0.09 - 0.12)/0.4);
            _cLabelEls[lj].style.opacity=(_clblTarget(f,lj)*lp).toFixed(3);
          }
          if(tt>=1){ _cState='idle'; cNodesMat.size=0.14; cNodesMat.opacity=1.0; cLinesMat.opacity=0.62;
            for(var lk=0; lk<_cLabelEls.length; lk++){ if(!_cLabelEls[lk]) continue; _cLabelEls[lk].style.opacity=_clblTarget(f,lk).toFixed(3); }
          }
        }
        // face the active project's cluster, plus a slow in-plane spin so it stays alive
        _cSpin+=0.05*dtI;
        _qRollDyn.setFromAxisAngle(_zAxis, GLOBE_ROLL+_cSpin);
        _nodeDir.copy(CFIG[want].c);
        _qFace.setFromUnitVectors(_nodeDir,_frontDir);
        _qTarget.copy(_qFace).premultiply(_qRollDyn);
        worldGroup.quaternion.slerp(_qTarget, 1-Math.exp(-3.4*dtI));
      }
      positionLabels();
    }
    window.SITE.__setConstellation=function(i){ window.SITE.__globeFocus=i; };

    var _gLast=0, _tourCleared=false, _lastFocus=-1;
    function frame(t){
      // ── REACTIVE IDLE GLOBE ────────────────────────────────────────────────
      // Decorative + reactive: free-spins at rest, and rotates to face the active
      // project's node while the projects sticky-split is in view (window.SITE.__globeFocus
      // is set 0/1/2 by the IntersectionObserver on the .proj blocks). A wave ripples
      // from the node each time the focus changes. Legacy choreography below is dead.
      if(document.hidden) return;                        // pause on hidden tab
      if(window.SITE.__globeInView===false) return;           // skip render while off-screen
      if((t-_gLast) < ARC_IDLE) return;                  // ~30fps idle cap
      var _dtI=Math.min(0.05,(t-_gLast)/1000); _gLast=t;

      var _want=(typeof window.SITE.__globeFocus==='number')?window.SITE.__globeFocus:-1;
      if(_want<0){
        drift += 0.05*_dtI;                                       // free resting spin (no project selected)
        _eRest.set(0, drift, GLOBE_ROLL);
        _qTarget.setFromEuler(_eRest);
        worldGroup.quaternion.slerp(_qTarget, 1-Math.exp(-3.0*_dtI));
      } else {
        try{ updateConstellation(_dtI); }catch(e){}               // rotate-to-face + redraw the project's constellation
      }
      worldGroup.position.set(0,0,0);
      worldGroup.scale.setScalar(1);
      camera.position.z = 4.3;                           // formed resting distance
      try{ updWaves(_dtI, 0, t*0.001); }catch(e){}       // ripple physics (no-op when still)
      nodePoints.material.opacity = 0.72;                // formed-state opacities (previous phosphor style)
      labelNodes.material.opacity = 1.0;
      dotPoints.material.opacity  = 0.3;
      lineSeg.material.opacity    = 0.078;
      if(glowMesh && glowMesh.material.uniforms) glowMesh.material.uniforms.uIntensity.value = 0.0;
      window.SITE.__globeOwnsScreen = false;                  // never a full-screen overlay now
      window.SITE.__globeScreen = null;
      window.SITE.__arcProgress = 1;
      if(canvas.style.visibility==='hidden') canvas.style.visibility='';
      renderer.render(scene, camera);
      return;
      // ───────────────────── legacy scroll choreography (dead) ─────────────────
      var target=computeProgress();
      var tourT=computeTourP();
      // While the arc or tour is engaged, render EVERY frame (smooth scroll-linked
      // motion). Only throttle to 30fps when idle, to save battery.
      var _fCalm = window.SITE.__footerCalm||0;
      var engaged = (target>0.005 && target<0.995) || (tourT>0.001 && tourT<0.999)
                    || (_fCalm>0.001 && _fCalm<0.999);   // stay live through the footer exit/enter beat
      if(!engaged && (t-_gLast) < ARC_IDLE) return;
      var dtS=Math.min(0.05,(t-_gLast)/1000);  // render delta for time-based motion
      _gLast=t;

      /* Damp the rendered progress toward the scroll target (frame-rate
         independent). Seed on first frame so there's no startup slide. */
      if(renderProgress<0) renderProgress=target;
      renderProgress += (target-renderProgress)*(1-Math.exp(-SMOOTH_LAMBDA*dtS));
      progress=renderProgress;
      window.SITE.__arcProgress = progress;   // published for additive beat layers

      // ---- tour state (held globe rides a second scroll band) ----
      /* capP rides the tail of the arc, so beats 1-2 are visually untouched:
         T2 only reaches for the globe once it has finished forming. */
      /* Capture used to ride the ARC's tail, so it began the moment the globe
         finished forming — that is the rush. It now owns the first third of the
         TOUR band instead, which gives the formed globe a full beat to sit
         full-bleed before anything reaches for it. Phases no longer overlap:
           capture  tour 0.00 -> 0.30   (~144vh)
           travel   tour 0.32 -> 0.70   (~182vh)
           hold     tour 0.70 -> 1.00
           exit     calm 0.05 -> 0.50   (done before the footer enters at 0.55) */
      var capP = smooth(clamp01(tourT/0.30));
      var conP = smooth(clamp01((tourT-0.32)/0.38));
      var outP = smooth(clamp01(((window.SITE.__footerCalm||0)-0.05)/0.45));

      /* tourP comes from the SELECTION now. It is the one scalar the tour reads
         (active index, per-cluster focus, globe scale, dirty check), so this
         single swap converts it to click with nothing downstream touched. */
      var _csTgt=(_csSel+0.5)/Math.max(1,NP);
      _csAnim += (_csTgt-_csAnim)*(1-Math.exp(-2.3*Math.max(0.0001,dtS)));   // slower globe turn
      if(Math.abs(_csTgt-_csAnim)<0.0002) _csAnim=_csTgt;
      var tourP = _csAnim * conP * (1-outP);

      gtApply(capP, conP, outP);
      var tourActive   = _tourOK && tourP>0.0008 && tourP<0.9992;
      var tourComplete = _tourOK && tourP>=0.9992;
      var formedHold   = progress>0.62;     // globe has formed; hold it (descent disabled)
      var tourPresence = tourActive ? (smooth(clamp01(tourP/0.05)) * smooth(clamp01((1-tourP)/0.05))) : 0;
      // Footer exit multiplier: 1 -> 0 over calm 0..0.42. EVERYTHING the tour owns
      // (globe canvas, labels, scrim, and the tile rv below) rides this one curve,
      // so no tour element can survive into the footer.
      var _fcNow    = window.SITE.__footerCalm || 0;
      // Exit timing: the old curve started ghosting the globe from the FIRST pixel of
      // footer-calm, leaving a long washed-out limbo where a dimmed globe sat under
      // still-readable text. Hold everything solid until calm 0.10, then leave
      // decisively by 0.40 — still fully clear before the footer enters at 0.45.
      var _tourExit = _fcNow > 0.001 ? (1 - smooth(clamp01((_fcNow - 0.10) / 0.30))) : 1;

      // ---- visibility gate ----
      // Live during the dive/form (0.02-0.995), while the formed globe is held,
      // and across the tour band. Only fully off before the transition and after
      // the tour finishes (placeholder ending — globe simply clears for now).
      var live = (progress>0.02 && progress<0.995) || (formedHold && !tourComplete) || tourActive;
      if(!live){
        window.SITE.__globeOwnsScreen=false;
        window.SITE.__globeScreen=null;   // globe hidden: ships roam freely, no avoidance
        if(canvas.style.visibility!=='hidden'){ canvas.style.visibility='hidden'; }
        if(progress<=0.02){ tw.style.transform=''; tw.style.filter=''; tw.style.width='100vw'; tw.style.height='100vh'; tw.style.borderRadius='0'; tw.style.opacity='1'; }
        /* Hard-clear tour leftovers. A scroll JUMP (scrollbar drag, End key, a
           reload that restores scrollY) can skip the whole calm 0..0.42 exit
           window between two ticks — the loop then dies here with tiles, labels
           and the scrim frozen at whatever the last live frame set. Zero them
           explicitly whenever the globe is off; they re-stagger on re-entry. */
        if(!_tourCleared){
          _tourCleared = true;
          for(var cc=0; cc<clusters.length; cc++){
            var tt=clusters[cc].tiles;
            for(var zz=0; zz<tt.length; zz++){ tt[zz].el.style.opacity='0'; tt[zz].el.classList.remove('live'); tt[zz].el.style.willChange=''; }
            _clusterOn[cc]=false;
          }
          for(var lz=0; lz<labelEls.length; lz++) labelEls[lz].style.opacity='0';
          if(scrim) scrim.style.opacity='0';
        }
        return;
      }
      _tourCleared = false;
      if(canvas.style.visibility==='hidden') canvas.style.visibility='';

      // hand off: the globe owns the screen (and the nebula/network loop stops
      // drawing) while it's opaque during the form, and through the whole tour —
      // the scrim already hides the background there, so skipping its draw is free
      // GPU for the globe. Updates still run, so nothing snaps on the way back up.
      // Constellations stay live at the top/rest, but clear out of the project area:
      // once the globe forms and through the whole tour the background stops drawing,
      // leaving the globe on a clean dark field.
      window.SITE.__globeOwnsScreen = (progress>0.50 && progress<0.995) || formedHold || tourActive;

      // rotation-to-present: free drift at rest; in the tour, ROTATE the globe so the
      // active project's node turns to front-centre (no translation, so the globe stays
      // planted). Slerp toward the target each frame for a smooth, whip-free turn.
      drift += 0.09 * dtS;                                 // always advance the resting spin
      if(tourPresence>0.001){
        var ai = Math.min(NP-1, Math.floor(tourP*NP));
        _nodeDir.copy(dirs[PROJECTS[ai].node]).normalize();
        _qFace.setFromUnitVectors(_nodeDir, _frontDir);    // turn node to face the camera
        _qTarget.copy(_qFace).premultiply(_qRoll);         // keep the aesthetic roll (node stays centred, it's on the view axis)
        worldGroup.quaternion.slerp(_qTarget, 1-Math.exp(-TOUR_ROT_EASE*dtS));
      } else {
        _eRest.set(0, drift, GLOBE_ROLL);
        _qTarget.setFromEuler(_eRest);
        worldGroup.quaternion.slerp(_qTarget, 1-Math.exp(-3.0*dtS));
      }
      // placement: centred, no vertical translation (rotation does the centring now),
      // slightly smaller during the tour. tourPresence is 0 outside the tour.
      // ── ONE MOTION MEDIUM ──────────────────────────────────────────────────
      // The scale-breath/bob system is gone: the wave field is now the globe's only
      // motion. At rest it breathes via gentle ambient swells crossing the mesh;
      // interactions (hover pings, tour landings) inject stronger waves into the
      // SAME medium — so nothing ever fights, it's all one water.
      var _vis=clamp01((progress-0.50)/0.14)*clamp01(1-_fcNow/0.42);
      if(_vis>0.5 && !document.hidden && t>_nextAmbient){
        fireWave((Math.random()*NNODES)|0, AMBIENT_STRENGTH, AMBIENT_OPTS);
        _nextAmbient = t + AMBIENT_EVERY_MS*(0.7+Math.random()*0.6);
      }
      /* T2 carries the globe right now; the old lateral offset would double
         the travel and push it out of frame. */
      worldGroup.position.x = 0;
      worldGroup.position.y = 0;
      worldGroup.scale.setScalar(1 - (1-TOUR_GLOBE_SCALE)*tourPresence);

      var pForm=map(progress,0.46,0.64);    // node -> globe
      var pDesc=0;   // descent disabled — the globe holds formed and flows into the tour (real ending TBD)

      /* ============================================================
         CRT -> globe TRANSITION: DIVE + DISSOLVE.
         The feed dives forward — scales up past the viewport while the camera
         pushes in — and as it goes it breaks up: positional jitter, a contrast
         and brightness crush, and dropout flicker, all ramping with signal loss.
         You punch through a tearing, degrading screen into the globe rather than
         watching a clean fade. pSeed below lights the globe seed up as the feed
         dissolves, so it reads as one continuous move.
         Tuning knobs: scale target (2.7), the jitter/contrast/dropout maxima,
         and the timing windows (dive 0.0-0.36, signal loss 0.08-0.34, fade
         0.14-0.36). ============================================================ */
      var pSeed;
      tw.style.left=''; tw.style.top='';
      tw.style.borderRadius='0';

      var dv=easeInCubic(map(progress,0.0,0.36));       // forward dive (scale)
      var ls=map(progress,0.08,0.34);                   // signal-loss ramp
      /* The dive is now a compositor transform scale, not a per-frame width/height
         layout. The box stays full-viewport; scale(2.7) reproduces the old
         W*2.7 / H*2.7 growth about the centre, but stays on the GPU thread so it
         doesn't fight the WebGL globe rendering in the same tick. */
      tw.style.width='100vw'; tw.style.height='100vh';
      var _diveS=lerp(1,2.7,dv);
      var _jx=(Math.random()*2-1)*lerp(0,14,ls), _jy=(Math.random()*2-1)*lerp(0,5,ls);
      // glitch jitter on both axes rides on top of the dive scale, growing with loss
      tw.style.transform='translate('+_jx.toFixed(2)+'px,'+_jy.toFixed(2)+'px) scale('+_diveS.toFixed(4)+')';
      tw.style.filter='contrast('+lerp(1,2.4,ls)+') brightness('+lerp(1,1.6,ls)+')';
      // the dive fade is the real disappearance; dropout flickers it as it tears apart
      var diveFade=1-smooth(map(progress,0.14,0.36));
      var drop=(Math.random() < lerp(0,0.55,ls)) ? lerp(1,0.2,ls) : 1;
      tw.style.opacity=String(diveFade*drop);
      pSeed=map(progress,0.24,0.42);
      var seedK=smooth(pSeed);                            // drives globe seed opacity below

      // camera push-in for the dive
      camera.position.z=lerp(5.6,4.3,smooth(map(progress,0.08,0.50)));
      // (globe position + scale are set in the rotation/centring block above)

      /* Publish the globe's screen-space disk (CSS px) so the 2D background layer
         can steer ships + satellites around it. Project the centre and a point one
         radius out along screen-x; the silhouette is rotation-invariant, so that
         horizontal span is a good radius. camera.updateMatrixWorld() makes the
         projection use this frame's camera push-in. */
      camera.updateMatrixWorld();
      _gCenter.copy(worldGroup.position).project(camera);
      _gEdge.set(worldGroup.position.x + SPHERE_R*worldGroup.scale.x, worldGroup.position.y, worldGroup.position.z).project(camera);
      var _gcx=(_gCenter.x*0.5+0.5)*W, _gcy=(-_gCenter.y*0.5+0.5)*H;
      var _gex=(_gEdge.x*0.5+0.5)*W,   _gey=(-_gEdge.y*0.5+0.5)*H;
      window.SITE.__globeScreen={ x:_gcx, y:_gcy, r:Math.hypot(_gex-_gcx,_gey-_gcy), on:true };

      // per-project focus envelope (reused for the scrim, the globe dim, and the tiles)
      var focusArr=[], focusMax=0, activeIdx=0;
      for(var fz=0; fz<NP; fz++){
        var ff = tourActive ? bandFocus(tourP,fz) : 0;
        // After the tour ends AND the footer beat is engaging, keep Axon (last project)
        // mounted so its tiles animate OUT via the calm-driven reverse stagger. Gated on
        // _calm>0 so this only fires at the END (footer approaching), never at the start
        // where tourActive is also false but _calm is 0.
        if(!tourActive && fz===NP-1 && (window.SITE.__footerCalm||0) > 0.001 && (window.SITE.__footerCalm||0) < 0.999){ ff = 1; }
        focusArr.push(ff);
        if(ff>focusMax){ focusMax=ff; activeIdx=fz; }
      }
      // TOUR HOLD — Schmitt trigger, not a raw threshold: a project becomes "held"
      // only when its focus crosses 0.6 upward, and releases only below 0.3. At the
      // crossover between adjacent holds both curves hover near any single cutoff,
      // so a plain compare flaps A/B for several frames — spamming waves (the whole-
      // globe jitter) and flashing both projects' signal sets at once. Hysteresis
      // gives one clean enter/exit per hold; the cooldown guarantees one wave each.
      if(_holdIdx>=0 && (activeIdx!==_holdIdx || focusArr[_holdIdx]<0.30)) _holdIdx=-1;
      if(_holdIdx<0 && focusMax>0.60) _holdIdx=activeIdx;
      if(_holdIdx>=0 && _holdIdx!==_lastWaveIdx && (t-_lastWaveT)>1200){
        _lastWaveIdx=_holdIdx; _lastWaveT=t; fireWave(PROJECTS[_holdIdx].node, 1.0);
      }
      else if(focusMax<=0.05 && _lastWaveIdx!==-1){ _lastWaveIdx=-1; _holdIdx=-1; }
      // formed01: 0 while forming -> 1 once formed and held. Drives the globe
      // brightening and the background darkening together, so there's no gap where
      // the background flashes back between the form beat and the tour.
      var formed01 = smooth(map(progress,0.60,0.84));
      // brightness: the tour now renders at the SAME level as the rest state (no dim,
      // no separate tour-lift); GLOBE_BRIGHT lifts the whole web for image-1 crispness.
      var nLift = (1 + 0.8*formed01) * GLOBE_BRIGHT;   // nodes
      var dLift = (1 + 1.4*formed01) * GLOBE_BRIGHT;   // discovery dots
      var eLift = (1 + 2.8*formed01) * GLOBE_BRIGHT;   // edges (faintest at rest, lifted most)

      var formA=smooth(pForm);
      nodePoints.material.opacity=clamp01(clamp01(Math.max(seedK*0.6,formA*0.9))*0.5*nLift);
      labelNodes.material.opacity=clamp01(clamp01(formA)*(0.7+0.3*formed01));
      dotPoints.material.opacity=clamp01(clamp01(smooth(map(progress,0.54,0.8))*0.38)*0.5*dLift);
      lineSeg.material.opacity=clamp01(clamp01(smooth(map(progress,0.56,0.84))*0.042)*eLift);  // dimmer still: quiet structure behind the labels
      glowMesh.material.uniforms.uIntensity.value = 0.0;   // atmosphere glow off (was reading too blue)

      var showLabels=smooth(map(progress,0.66,0.82));
      // Refresh matrices explicitly before projecting, so labels use exactly the
      // transform the renderer will draw this frame — never a stale matrix.
      worldGroup.updateMatrixWorld();
      camera.updateMatrixWorld();
      // All label tiers project from the LIFTED radius (SPHERE_R*(1+_lift[node])) so
      // text rides the breath and waves with its node — dots and labels never detach.
      for(var k=0;k<LABELS.length;k++){
        var _kn=LABEL_NODE[k];
        tmpV.copy(dirs[_kn]).multiplyScalar(SPHERE_R*(1+_lift[_kn]));
        worldGroup.localToWorld(tmpV); tmpV.project(camera);
        var vis=tmpV.z<1 && showLabels>0.05;
        var e=labelEls[k];
        e.style.left=(_glRect.left+(tmpV.x*0.5+0.5)*_glRect.width)+'px';
        e.style.top=(_glRect.top+(-tmpV.y*0.5+0.5)*_glRect.height)+'px';
        // Exclusivity during the tour: while a project is HELD, only its own name
        // stays up; the other two fade with the hold and return on release. The
        // telemetry markers (idx 3+) belong to the knowledge field and hand off to
        // the neighbor signals whenever the tour is engaged at all.
        var _tf;
        if(k<3){
          var _tgt=(_holdIdx<0||_holdIdx===k)?1:0;
          _projVis[k]+= (_tgt-_projVis[k])*Math.min(1,dtS*6);
          _tf=_projVis[k];
        } else { _tf=(1-tourPresence); }
        e.style.opacity=vis?String(showLabels*_tourExit*_tf):'0';
      }
      // Phase 1 — ambient knowledge field: front-hemisphere only, gone during tour
      var ambA=showLabels*_tourExit*(1-tourPresence);
      for(var a2=0;a2<ambientEls.length;a2++){
        var an=ambientNode[a2], ae=ambientEls[a2];
        if(ambA<=0.02){ if(ae.style.opacity!=='0') ae.style.opacity='0'; continue; }
        tmpW.copy(dirs[an]).applyQuaternion(worldGroup.quaternion);
        var face=smooth(clamp01((tmpW.z-0.02)/0.4));          // fade out toward the limb
        if(face<=0.02){ if(ae.style.opacity!=='0') ae.style.opacity='0'; continue; }
        tmpV.copy(dirs[an]).multiplyScalar(SPHERE_R*(1+_lift[an]));
        worldGroup.localToWorld(tmpV); tmpV.project(camera);
        ae.style.left=(_glRect.left+(tmpV.x*0.5+0.5)*_glRect.width)+'px';
        ae.style.top=(_glRect.top+(-tmpV.y*0.5+0.5)*_glRect.height)+'px';
        ae.style.opacity=String(0.55*ambA*face);
      }
      // Phase 2 — neighbor signals: the HELD project's artifacts on its 6 claimed
      // nodes. Crossfade on change: ease out, swap words at the bottom, ease in —
      // never an instant retext mid-transition. Positions always follow the project
      // whose words are displayed (_nbrTextIdx), not the live hold index.
      var _nbrTgt=(_holdIdx>=0 && _holdIdx===_nbrTextIdx)?1:0;
      if(_holdIdx>=0 && _holdIdx!==_nbrTextIdx && _nbrShow<0.15){
        _nbrTextIdx=_holdIdx;
        for(var nt=0;nt<6;nt++) nbrSigEls[nt].textContent=PROJECT_SIGNALS[_holdIdx][nt];
      }
      _nbrShow += (_nbrTgt-_nbrShow)*Math.min(1,dtS*5);
      var nbrA=_nbrShow*_tourExit;
      for(var n3=0;n3<6;n3++){
        var ne=nbrSigEls[n3];
        if(nbrA<=0.02 || _nbrTextIdx<0){ if(ne.style.opacity!=='0') ne.style.opacity='0'; continue; }
        var nn2=projNbr[_nbrTextIdx][n3];
        tmpW.copy(dirs[nn2]).applyQuaternion(worldGroup.quaternion);
        var face2=smooth(clamp01((tmpW.z-0.02)/0.4));
        if(face2<=0.02){ if(ne.style.opacity!=='0') ne.style.opacity='0'; continue; }
        tmpV.copy(dirs[nn2]).multiplyScalar(SPHERE_R*(1+_lift[nn2]));
        worldGroup.localToWorld(tmpV); tmpV.project(camera);
        ne.style.left=(_glRect.left+(tmpV.x*0.5+0.5)*_glRect.width)+'px';
        ne.style.top=(_glRect.top+(-tmpV.y*0.5+0.5)*_glRect.height)+'px';
        ne.style.opacity=String(0.9*nbrA*face2);
      }

      // ---- focus scrim: darkens as the globe finishes forming and stays down
      // through the whole tour (no gap where the background flashes back) ----
      if(scrim){ scrim.style.opacity = String(clamp01((formed01*TOUR_SCRIM + focusMax*0.05) * _tourExit)); }

      // ---- window clusters: staggered tile reveal (Codrops-style column stagger) ----
      for(var ci=0; ci<clusters.length; ci++){
        var f=focusArr[ci];
        var ts=clusters[ci].tiles;
        if(f<=0.001){
          if(_clusterOn[ci]){
            for(var z0=0; z0<ts.length; z0++){ ts[z0].el.style.opacity='0'; ts[z0].el.classList.remove('live'); ts[z0].el.style.willChange=''; }
            _clusterOn[ci]=false;
          }
          continue;
        }
        if(!_clusterOn[ci]){ _clusterOn[ci]=true;
          for(var zc=0; zc<ts.length; zc++){ ts[zc].el.style.willChange='transform,opacity'; } }
        for(var z=0; z<ts.length; z++){
          var k_i = (ts[z].dly/ts.length)*0.5;            // per-tile entry delay within the band
          var rv = smooth(clamp01((f - k_i)/(1 - k_i)));  // 0..1 staggered reveal
          // Footer exit: as the footer nears, drive rv back down with a per-tile stagger
          // (reverse of the entrance) so the project elements scale/slide/fade OUT the same
          // way they came in, rather than snapping to hidden. Later tiles leave first.
          if(_fcNow>0){
            // Same window as _tourExit: hold until calm 0.10, fully out by 0.40 —
            // cards, labels and globe all depart together, before the footer's 0.45.
            var _ex = Math.max(0, Math.min(1, (_fcNow-0.10)/0.30));
            var exitK = (1 - ts[z].dly/ts.length)*0.45;   // reversed per-tile stagger
            var exitRv = smooth(clamp01((_ex - exitK)/(1 - exitK)));
            rv = rv * (1 - exitRv);
          }
          var inv = 1-rv, el = ts[z].el;
          // clamp tiny residue to exactly 0 so nothing ghosts at higher calm values
          if(rv < 0.004) rv = 0;
          el.style.opacity = String(rv);
          el.style.transform = 'translate('+(ts[z].dir*34*inv).toFixed(1)+'px,'+(ts[z].dy*1.4*inv).toFixed(1)+'px) scale('+(0.94+0.06*rv).toFixed(3)+')';
          var liveNow = rv>0.6;
          if(liveNow !== el.classList.contains('live')) el.classList.toggle('live', liveNow);
        }
      }

      // halo + bright core + neighbour sparkles + connection lines ride the focused node
      var fnode = dirs[PROJECTS[activeIdx].node];
      _tmpN.copy(fnode).multiplyScalar(SPHERE_R*1.02);
      halo.position.copy(_tmpN);
      core.position.copy(_tmpN);
      // lift partial focus so the node reads as clearly lit across most of the band,
      // not only at the exact centre (focusMax often sits ~0.6 mid-hold)
      var glowK = Math.pow(clamp01(focusMax),0.5);
      var _pulse = 0.5+0.5*Math.sin(t*0.004);
      halo.material.opacity=clamp01(glowK*0.6);
      halo.scale.setScalar(0.42+0.1*_pulse);
      core.material.opacity=clamp01(glowK*1.3);            // the bright sharp shine on the node
      core.scale.setScalar(0.15+0.035*_pulse);
      var nb=projNbr[activeIdx];
      for(var n=0;n<6;n++){
        _tmpN.copy(dirs[nb[n]]).multiplyScalar(SPHERE_R*1.01);
        nbrPos[n*3]=_tmpN.x; nbrPos[n*3+1]=_tmpN.y; nbrPos[n*3+2]=_tmpN.z;
        // segment: focused node -> this neighbour
        fePos[n*6]  =fnode.x*SPHERE_R; fePos[n*6+1]=fnode.y*SPHERE_R; fePos[n*6+2]=fnode.z*SPHERE_R;
        fePos[n*6+3]=dirs[nb[n]].x*SPHERE_R; fePos[n*6+4]=dirs[nb[n]].y*SPHERE_R; fePos[n*6+5]=dirs[nb[n]].z*SPHERE_R;
      }
      nbrGeo.attributes.position.needsUpdate=true;
      feGeo.attributes.position.needsUpdate=true;
      nbrPoints.material.opacity=glowK*0.9;
      focusEdges.material.opacity=glowK*0.7;

      // Globe exit: fade the globe canvas out over calm 0..0.42 (same window as the tour
      // cards), so the globe animates away together with the project tiles as the footer
      // approaches. The nebula/stars/ships keep drawing on the 2D layer underneath, so the
      // background stays alive — only the 3D globe leaves.
      if(_tourExit < 1){
        canvas.style.opacity = String(_tourExit);
      } else if(canvas.style.opacity!==''){
        canvas.style.opacity='';
      }

      // idle render-gate: only touch the GPU when the picture actually changed.
      // Breath runs only while the globe is on screen (same window as the ambient
      // timer's _vis) and never under reduced motion — off-screen, updWaves goes
      // fully quiescent and the gate can sleep as before.
      var _breathGate = (window.REDUCED_MOTION?0:1)*clamp01((progress-0.50)/0.14)*clamp01(1-_fcNow/0.42);
      var _wavesOn = updWaves(dtS, _breathGate, t*0.001);
      var _moved = !_renderedOnce
        || _wavesOn
        || Math.abs(progress-_pPrev)>1e-4
        || Math.abs(tourP-_tpPrev)>1e-4
        || Math.abs(worldGroup.rotation.y-_ryPrev)>1e-4
        || Math.abs(worldGroup.rotation.x-_rxPrev)>1e-4
        || Math.abs(worldGroup.scale.x-_sPrev)>1e-5
        || Math.abs(worldGroup.position.x-_pxPrev)>1e-5
        || Math.abs(worldGroup.position.y-_pyPrev)>1e-5
        || Math.abs(formed01-_fPrev)>1e-3
        || Math.abs(focusMax-_fmPrev)>1e-3;
      if(_moved){
        renderer.render(scene,camera);
        _renderedOnce=true;
        _pPrev=progress; _tpPrev=tourP;
        _ryPrev=worldGroup.rotation.y; _rxPrev=worldGroup.rotation.x; _fPrev=formed01; _fmPrev=focusMax;
        _sPrev=worldGroup.scale.x; _pxPrev=worldGroup.position.x; _pyPrev=worldGroup.position.y;
      }
    }
    // Run the globe on the shared GSAP ticker so it ticks in the same loop as Lenis,
    // right after the scroll position updates. ticker time is in seconds -> ms.
    if(window.gsap && gsap.ticker){ gsap.ticker.add(function(time){ frame(time*1000); }); }
    else { (function loop(t){ requestAnimationFrame(loop); frame(t); })(performance.now()); }

  }catch(err){
    console.warn('Globe arc disabled:', err);
    canvas.style.display='none';
    // leave the page exactly as it was; restore window to rest size
    tw.style.width='68vw'; tw.style.height='70vh'; tw.style.borderRadius='10px';
  }
  } /* end initGlobe */
})();
