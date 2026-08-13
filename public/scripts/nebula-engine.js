var glslCanvas = document.getElementById('gc');
var SCR        = document.getElementById('screen');
var SW = window.innerWidth, SH = window.innerHeight;

/* OVERSIZE — the network canvas is drawn larger than the viewport so objects
   (shooting stars, fleets, freighters) can fly in from off-screen. It was 2.0
   (a 4x pixel surface) on the assumption the layer panned via _setParallax, but
   parallax is never driven, so the canvas is static and ~75% of that surface was
   cleared+composited every frame for nothing. 1.65 keeps a generous off-screen
   margin while cutting ~32% of the per-frame fill. One knob: lower = cheaper /
   tighter spawn margin, raise toward 2.0 to restore the original runway. */
var OVERSIZE = 1.65;
var CW = SW * OVERSIZE, CH = SH * OVERSIZE;
var OX = -(CW - SW) / 2, OY = -(CH - SH) / 2;

/* ── Safe spawn zones ─────────────────────────────────────────────────
   Each page knows its own layout (hero art, card grids, form columns) —
   craft that spawn or park underneath opaque foreground content just burn
   frames nobody sees, and by the time they drift into a gap the visitor
   is often gone. Pages set window.SITE.NEBULA_SAFE_ZONES (screen-fraction
   rects, 0..1 of the viewport, before this script loads) to mark their
   known-open regions; spawn/target pickers below draw from these first.
   No zones set = the full visible band, same as before. Converted once
   to canvas space using the same OX/OY offset the mouse tracker uses. */
function _toCanvasX(sf){ return OX + sf * SW; }
function _toCanvasY(sf){ return OY + sf * SH; }
var _safeZones = (window.SITE.NEBULA_SAFE_ZONES && window.SITE.NEBULA_SAFE_ZONES.length
  ? window.SITE.NEBULA_SAFE_ZONES : [{x0:0,y0:0,x1:1,y1:1}]
).map(function(z){ return { x0:_toCanvasX(z.x0), y0:_toCanvasY(z.y0), x1:_toCanvasX(z.x1), y1:_toCanvasY(z.y1) }; });
function randomSafePoint(){
  var z = _safeZones[Math.random() * _safeZones.length | 0];
  return { x: z.x0 + Math.random() * (z.x1 - z.x0), y: z.y0 + Math.random() * (z.y1 - z.y0) };
}
/* Axis-only pickers — for craft whose OTHER coordinate is already fixed
   (freighter/probe/bigAst travel a fixed X, entering off one edge), only
   the perpendicular axis is free to choose. Picking that axis from a zone
   that doesn't actually span the fixed coordinate would land the craft
   outside every zone (e.g. a tall side-margin zone can't help a craft
   traveling through the horizontal center) — so filter to zones whose
   range includes the anchor first, falling back to any zone if none do. */
function _safeY(atX){
  var pool = _safeZones.filter(function(z){ return atX===undefined || (atX>=z.x0 && atX<=z.x1); });
  if(!pool.length) pool = _safeZones;
  var z = pool[Math.random() * pool.length | 0];
  return z.y0 + Math.random() * (z.y1 - z.y0);
}
function _safeX(atY){
  var pool = _safeZones.filter(function(z){ return atY===undefined || (atY>=z.y0 && atY<=z.y1); });
  if(!pool.length) pool = _safeZones;
  var z = pool[Math.random() * pool.length | 0];
  return z.x0 + Math.random() * (z.x1 - z.x0);
}
function inSafeZone(x, y){
  for(var i = 0; i < _safeZones.length; i++){
    var z = _safeZones[i];
    if(x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return true;
  }
  return false;
}

/* ── Background tuning ─────────────────────────────────────────────────
   Shared by index/about/contact/blog. ATMO_DIM lower = dimmer nebula and
   starfield; CRAFT (below) compensates ships/satellites separately so they
   stay legible as this goes darker. CALM/BG_PACE: event cadence + motion
   pace, unrelated to brightness. */
var ATMO_DIM = 0.40;
var CALM     = 1.75;
var BG_PACE  = 0.55;

/* ── Constellation drift (live-tunable) ─────────────────────────────────
   Two scales of motion, ported from the drift harness:
   LOCAL  "water"  — every node reads one shared low-frequency noise field at
                     its own position, so neighbours sway together (correlated)
                     instead of each bobbing on an independent phase.
   GLOBAL "space"  — the whole constellation slowly wanders + gently tumbles as
                     one body about the field centre, parallaxing against the
                     nebula/stars behind it. Applied as a canvas transform on
                     the network-map layer only; hover is inverse-mapped so the
                     proximity reveal stays aligned with what's on screen.
   Defaults are whispers — the map is oversized and sits over the nebula, so a
   little reads as a lot. Raise NET_WATER_AMP / NET_GLOBAL_* to taste. */
var NET_WATER_AMP  = 6.0;    // multiplies each node's existing sway amplitude
var NET_WATER_FREQ = 1.5;    // flow spatial scale (bigger = tighter eddies)
var NET_WATER_TSC  = 0.16;   // flow time scale (how fast the water moves)
var NET_QUIET = 1;           // constellation alpha multiplier — left neutral since the
                              // constellation itself is disabled below (_constellationEnabled).
                              // Turns out index.astro shuts its own constellation off after
                              // its 6s intro window and never brings it back — its resting
                              // background is just ships/satellites/grain/scanlines/dim/bloom,
                              // no network-map geometry at all. Matching that here rather
                              // than dimming a system index doesn't actually keep running.
var NET_GLOBAL_AMP = 55;     // px — how far the whole cluster wanders
var NET_GLOBAL_SPD = 0.045;  // global drift speed
var NET_GLOBAL_ROT = 3.5;    // deg — gentle tumble amplitude
var _gDx=0,_gDy=0,_gRot=0;   // global transform state (recomputed each frame)

/* tiny 3D value noise — the one shared field the whole cluster reads */
function _h3(i,j,k){ var s=Math.sin(i*127.1+j*311.7+k*74.7)*43758.5453; return s-Math.floor(s); }
function _sm(t){ return t*t*(3-2*t); }
function vnoise3(x,y,z){
  var xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi;
  var u=_sm(xf),v=_sm(yf),w=_sm(zf);
  function c(a,b,d){ return _h3(xi+a,yi+b,zi+d); }
  var x00=c(0,0,0)+(c(1,0,0)-c(0,0,0))*u, x10=c(0,1,0)+(c(1,1,0)-c(0,1,0))*u;
  var x01=c(0,0,1)+(c(1,0,1)-c(0,0,1))*u, x11=c(0,1,1)+(c(1,1,1)-c(0,1,1))*u;
  var y0=x00+(x10-x00)*v, y1=x01+(x11-x01)*v;
  return y0+(y1-y0)*w;
}
function netFlow(bx,by,t){
  var f=NET_WATER_FREQ*0.0016;
  return [ (vnoise3(bx*f,by*f,t)-0.5)*2.0,
           (vnoise3(bx*f+41.3,by*f+17.7,t+5.0)-0.5)*2.0 ];
}

/* Raw WebGL replaces THREE.js for this single fullscreen-quad shader use
   case. Drops ~600KB of CDN dependency, preserves the same shader output
   byte-for-byte. The exported `U` (uniforms) and `renderer` API mimic
   what existed before so the rest of the page (intro liftBrightness, the
   resize handler, the per-frame uTime tick) doesn't need to change.      */
/* Default U to a no-op shim so the main 2D canvas loop survives even if
   WebGL initialization fails (old/headless browsers, GPU process crash). */
var U = { uTime: { value: 0 }, uBright: { value: 0.85 }, uRes: { value: { set: function(){} } } };
var renderer = null;
var threeClock;

/* ──────────────────────────────────────────────────────────────────
   initGL — now with an FBO TEMPORAL CACHE for the nebula shader.
   The nebula's uTime advances at 0.038 — visible delta between frames
   is sub-perceptual. We render into a ping-pong texture at ~5Hz and
   composite to screen every frame with a 250ms crossfade. External
   API (U, renderer) is byte-identical to v6's contract.
   ────────────────────────────────────────────────────────────────── */
(function initGL(){
  /* Ported from nebula-engine-home.js, which already had this and this file
     didn't: phones skip the WebGL nebula shader entirely under LOW_POWER,
     rather than loading/compiling/running it and only backing off the
     decorative ship systems below. Tablets (LOW_POWER true but width>=600)
     keep it; it's a single fullscreen-quad shader, not heavy. */
  if(window.SITE && window.SITE.LOW_POWER && innerWidth < 600){ return; }
  var gl = glslCanvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if(!gl){ console.warn('WebGL unavailable; nebula will not render.'); return; }

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function compile(type, src){
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.warn('Shader compile failed:', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null;
    }
    return s;
  }
  function linkProg(vsSrc, fsSrc){
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if(!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      console.warn('GL link failed:', gl.getProgramInfoLog(p)); return null;
    }
    return p;
  }

  var VS = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';

  /* Nebula fragment shader — UNCHANGED from v6, byte-for-byte. */
  var FS = 'precision highp float;\n' +
    'uniform float uTime; uniform vec2 uRes; uniform float uBright;\n' +
    'float h21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}\n' +
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}\n' +
    'float fbm(vec2 p){float v=0.,a=.52,fr=1.;mat2 r=mat2(.877,.480,-.480,.877);for(int i=0;i<6;i++){v+=a*noise(p*fr);p=r*p;fr*=2.05;a*=.48;}return v;}\n' +
    'void main(){\n' +
    '  vec2 uv=gl_FragCoord.xy/uRes.xy;\n' +
    '  vec2 st=uv; st.x*=uRes.x/uRes.y;\n' +
    '  float t=uTime*.038;\n' +
    '  vec2 q=vec2(fbm(st+t*.26),fbm(st+vec2(5.2,1.3)+t*.20));\n' +
    '  vec2 r2=vec2(fbm(st+3.8*q+vec2(1.7,9.2)+t*.14),fbm(st+3.8*q+vec2(8.3,2.8)+t*.10));\n' +
    '  float wave=fbm(st+3.8*r2+t*.07);\n' +
    '  float luma=pow(wave,2.2)*.14+pow(wave,.5)*.025;\n' +
    '  vec3 col=vec3(luma*.76,luma*.80,luma*.94)*uBright;\n' +
    '  vec2 vig=uv-.5; col*=pow(clamp(1.-dot(vig,vig*1.4),0.,1.),.8);\n' +
    '  gl_FragColor=vec4(clamp(col,0.,1.),1.);\n' +
    '}';

  /* Composite — samples two cached textures and crossfades. */
  var COMP_FS = 'precision highp float;\n' +
    'varying vec2 vUv;\n' +
    'uniform sampler2D uTexA;\n' +
    'uniform sampler2D uTexB;\n' +
    'uniform float uMix;\n' +
    'void main(){\n' +
    '  vec4 a = texture2D(uTexA, vUv);\n' +
    '  vec4 b = texture2D(uTexB, vUv);\n' +
    '  gl_FragColor = mix(a, b, uMix);\n' +
    '}';

  var nebulaProg = linkProg(VS, FS);
  var compProg   = linkProg(VS, COMP_FS);
  if(!nebulaProg || !compProg) return;

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  var nLoc = {
    p:       gl.getAttribLocation(nebulaProg, 'p'),
    uTime:   gl.getUniformLocation(nebulaProg, 'uTime'),
    uRes:    gl.getUniformLocation(nebulaProg, 'uRes'),
    uBright: gl.getUniformLocation(nebulaProg, 'uBright')
  };
  var cLoc = {
    p:    gl.getAttribLocation(compProg, 'p'),
    texA: gl.getUniformLocation(compProg, 'uTexA'),
    texB: gl.getUniformLocation(compProg, 'uTexB'),
    uMix: gl.getUniformLocation(compProg, 'uMix')
  };

  var fbo  = gl.createFramebuffer();
  var texA = null, texB = null;
  var fboW = 0, fboH = 0;
  function makeTex(w, h){
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /* Cache state. */
  var cacheEnabled    = true;
  var cacheIntervalMs = 200;     /* 5Hz default */
  var crossfadeMs     = 250;
  var lastCacheTime   = -Infinity;
  var crossfadeStart  = -Infinity;
  var pingPongFlip    = false;
  var firstCacheRender = true;
  var shaderRenderCount = 0;

  function setSize(w, h){
    glslCanvas.width  = w * dpr;
    glslCanvas.height = h * dpr;
    fboW = glslCanvas.width;
    fboH = glslCanvas.height;
    if(texA){ gl.deleteTexture(texA); }
    if(texB){ gl.deleteTexture(texB); }
    texA = makeTex(fboW, fboH);
    texB = makeTex(fboW, fboH);
    firstCacheRender = true;
    lastCacheTime    = -Infinity;
  }
  setSize(SW, SH);

  function bindQuad(attrLoc){
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(attrLoc);
    gl.vertexAttribPointer(attrLoc, 2, gl.FLOAT, false, 0, 0);
  }

  function renderNebulaTo(targetTex){
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTex, 0);
    gl.viewport(0, 0, fboW, fboH);
    gl.useProgram(nebulaProg);
    bindQuad(nLoc.p);
    gl.uniform1f(nLoc.uTime,   U.uTime.value);
    gl.uniform1f(nLoc.uBright, U.uBright.value);
    gl.uniform2f(nLoc.uRes,    fboW, fboH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    shaderRenderCount++;
  }

  U = {
    uTime:   { value: 0 },
    uBright: { value: 0.85 },
    uRes:    { value: { set: function(){} } }
  };

  renderer = {
    setSize: setSize,
    render: function(){
      var now = performance.now();
      if(!cacheEnabled){
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, glslCanvas.width, glslCanvas.height);
        gl.useProgram(nebulaProg);
        bindQuad(nLoc.p);
        gl.uniform1f(nLoc.uTime,   U.uTime.value);
        gl.uniform1f(nLoc.uBright, U.uBright.value);
        gl.uniform2f(nLoc.uRes,    glslCanvas.width, glslCanvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        shaderRenderCount++;
        return;
      }
      if(now - lastCacheTime >= cacheIntervalMs){
        if(firstCacheRender){
          renderNebulaTo(texA);
          renderNebulaTo(texB);
          pingPongFlip = true;
          firstCacheRender = false;
        } else {
          pingPongFlip = !pingPongFlip;
          renderNebulaTo(pingPongFlip ? texB : texA);
        }
        crossfadeStart = now;
        lastCacheTime  = now;
      }
      var t = Math.min(1, (now - crossfadeStart) / crossfadeMs);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, glslCanvas.width, glslCanvas.height);
      gl.useProgram(compProg);
      bindQuad(cLoc.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, pingPongFlip ? texA : texB);
      gl.uniform1i(cLoc.texA, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pingPongFlip ? texB : texA);
      gl.uniform1i(cLoc.texB, 1);
      gl.uniform1f(cLoc.uMix, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  /* Devtools control surface — toggle from console if you ever need to
     diagnose a regression. Defaults are "all optimizations on". */
  window.SITE.NEBULA_CACHE = {
    isEnabled: function(){ return cacheEnabled; },
    setEnabled: function(b){
      cacheEnabled = !!b;
      firstCacheRender = true;
      lastCacheTime    = -Infinity;
    },
    getRateHz: function(){ return 1000 / cacheIntervalMs; },
    setRateHz: function(hz){
      cacheIntervalMs = 1000 / Math.max(0.05, hz);
      lastCacheTime   = -Infinity;
    },
    getRenderCount: function(){ return shaderRenderCount; },
    resetCount: function(){ shaderRenderCount = 0; }
  };
})();

/* Tiny Clock shim — was THREE.Clock(). Returns seconds-since-last-call. */
threeClock = (function(){
  var last = performance.now() / 1000;
  return {
    getDelta: function(){
      var now = performance.now() / 1000;
      var d = now - last; last = now; return d;
    }
  };
})();

var canvas = document.getElementById('sc');
var ctx    = canvas.getContext('2d');
canvas.width  = CW;
canvas.height = CH;
var W = CW, H = CH;

/* Honor prefers-reduced-motion: gate optional simulation systems (grain,
   glitch bands, fleets, patrols, chase, freighter, probe, asteroids, meteor
   shower, shooting stars). Hubs, districts, lines, traceroutes, and data
   streams still run so the page reads as a network, not a still image.    */
/* LOW_POWER (set early in each page's <head>, viewport-width or reduced-motion
   driven) folds into REDUCED_MOTION so every existing RM-gated optional system
   below (grain, glitch, fleets, patrols, chase, freighter, probe, asteroids,
   meteor shower, shooting stars) also backs off on phones/tablets, not just
   under the accessibility preference. */
var REDUCED_MOTION = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(window.SITE && window.SITE.LOW_POWER);

function positionCanvases(){
  /* cssText fully replaces the inline style, so if the nebula has already
     been hidden (_bgIntroOver), re-assert display:none here too — otherwise
     a resize (window resize, orientation change) silently un-hides it. */
  glslCanvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:0;'
    + (typeof _bgIntroOver!=='undefined' && _bgIntroOver ? 'display:none;' : '');
  canvas.style.cssText = 'position:absolute;left:'+OX+'px;top:'+OY+'px;width:'+CW+'px;height:'+CH+'px;z-index:1;pointer-events:none;';
}
positionCanvases();

var BIO_CX = CW/2, BIO_CY = CH/2, BIO_R = 300;
var canvasMX=CW/2,canvasMY=CH/2;
/* cursor inverse-mapped through the global drift transform, so the
   proximity reveal stays aligned with the cluster as it wanders. */
var canvasMXt=CW/2,canvasMYt=CH/2;
/* A getBoundingClientRect() inside a non-passive mousemove handler: a forced
   synchronous layout on every single pointer sample, on the busiest listener on
   the page. #screen is a fixed, full-viewport box, so its rect only changes on
   resize — cache it there and read a number here instead. */
var _scrRect = SCR.getBoundingClientRect();
window.addEventListener('resize', function(){ _scrRect = SCR.getBoundingClientRect(); }, {passive:true});
SCR.addEventListener('mousemove', function(e){
  var r = _scrRect;
  if(!r.width || !r.height) return;
  canvasMX = ((e.clientX - r.left) / r.width)  * CW;
  canvasMY = ((e.clientY - r.top)  / r.height) * CH;
}, {passive:true});

// Star colors for hubs
var HUB_COLORS=[
  {r:245,g:235,b:220},{r:210,g:220,b:242},{r:230,g:228,b:235},
  {r:235,g:220,b:195},{r:195,g:215,b:245},{r:220,g:225,b:240},
  {r:225,g:230,b:245},{r:215,g:222,b:238},{r:240,g:230,b:215},{r:235,g:225,b:210}
];

function fin(){for(var i=0;i<arguments.length;i++)if(!isFinite(arguments[i]))return false;return true;}
function rg(x0,y0,r0,x1,y1,r1){return fin(x0,y0,r0,x1,y1,r1)?ctx.createRadialGradient(x0,y0,r0,x1,y1,r1):null;}

/* ══════════════ CRAFT LUMINANCE ══════════════
   The ships, the satellites and their trails all live on the SAME 2D canvas
   as the star field, the nebulae, the galaxy and the grain — so a CSS
   filter:brightness() on #sc would have lifted the background right along with
   them, which is the exact opposite of what we want. The scene is therefore
   pushed DOWN globally (darker base colour, dimmer nebula shader, harder
   brightness on #window) and the craft are pushed UP here, at the source, in
   the only four primitives that draw them. Net: blacker sky, hotter traffic.

   Live-tunable — open devtools and try:
       CRAFT.boost = 3.0        // body + aura alpha multiplier
       CRAFT.halo  = 2.0        // aura radius multiplier (the glow spread)
       CRAFT.trail = 3.0        // wake brightness
       CRAFT.satHalo = 0        // kill the new satellite glow
   Nothing is cached; the next frame picks it up.                          */
var CRAFT = window.SITE.CRAFT = {
  boost:   2.05,   /* how much hotter the hulls and auras burn      */
  halo:    1.45,   /* how much further the aura bleeds into the dark */
  trail:   1.90,   /* how much brighter the wakes read              */
  satHalo: 0.30    /* satellites had NO aura at all — this is theirs */
};

/* alpha helpers — clamp, because a boosted alpha above 1 makes canvas throw
   away the whole colour string silently and the craft vanishes. */
function cA(a){ a *= CRAFT.boost; return a > 1 ? 1 : a; }
function tA(a){ a *= CRAFT.trail; return (a > 1 ? 1 : a).toFixed(3); }
function lg(x0,y0,x1,y1){return fin(x0,y0,x1,y1)?ctx.createLinearGradient(x0,y0,x1,y1):null;}
function expD(c,t,s,dt){if(dt<=0)return c;var r=t+(c-t)*Math.exp(-s*dt);return isFinite(r)?r:t;}
function sn(v){return isFinite(v)?v:0;}
function edgeCP(a,b,idx){var mx=(a.x+b.x)*0.5,my=(a.y+b.y)*0.5,dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy);if(len<1)return null;var nx=-dy/len,ny=dx/len;var curve=(idx%2===0?1:-1)*len*0.06;return{x:mx+nx*curve,y:my+ny*curve,len:len};}
function inBio(x,y){var dx=x-BIO_CX,dy=y-BIO_CY;return dx*dx+dy*dy<BIO_R*BIO_R;}

var sessionStart = Date.now();
function sTime(){var s=Math.floor((Date.now()-sessionStart)/1000);return pad(s/3600|0)+':'+pad((s%3600)/60|0)+':'+pad(s%60);}
function pad(n){return String(n).padStart(2,'0');}

var HUB_N=6;

/* All six hubs are city-style clusters with their own districts; no two
   cities look alike — density, hub size, district size, and cluster spread
   are deliberately varied. Hubs 0-3 are the primary foreground cities;
   hubs 4-5 are distant background clusters, tucked into opposing corners,
   visually rendered smaller, fainter, more compact.                         */
var CITY_DIST_COUNTS = [13, 9, 7, 5, 5, 5];   // hub[i] gets CITY_DIST_COUNTS[i] districts
var DIST_N = CITY_DIST_COUNTS.reduce(function(a,b){return a+b;},0);  // = 44
var CITY_HUBS = [0,1,2,3,4,5];                // every hub is a city
var TOTAL = HUB_N + DIST_N;

/* Pushed-outward asymmetric pinwheel — opens up the central viewport
   for breathing room. Foreground cities still in their original quadrants
   but slid further toward the edges; backgrounds tucked deeper into the
   opposing corners. Positions are fractions of the 2x canvas (CW=SW*2,
   CH=SH*2). Visible viewport maps to canvas 0.25–0.75 on both axes —
   converting back to viewport space:
     H0 viewport (0.13, 0.50), H1 (0.85, 0.22),
     H2 (0.87, 0.78),          H3 (0.16, 0.83),
     H4 (0.04, 0.10) bg,       H5 (0.96, 0.90) bg.                          */
var HUB_POS = [
  [0.295, 0.500],  // hub 0 — densest, center-left, pushed further left to peek beside the window
  [0.675, 0.360],  // hub 1 — medium,  upper-right, pushed up + out
  [0.685, 0.640],  // hub 2 — small,   lower-right, pushed down + out
  [0.285, 0.665],  // hub 3 — sparse,  lower-left,  pushed further left to stay showing
  [0.305, 0.360],  // hub 4 — distant bg, upper-left, brought further in toward the terminal
  [0.730, 0.700],  // hub 5 — distant bg, tucked deeper into lower-right corner
];

/* ──────────────────────────────────────────────────────────────────
   BACKGROUND OUTPOSTS — small wireframe geometric structures placed
   around the perimeter. The aesthetic is "3D shape seen at an oblique
   angle": triangulated facets with internal crossings that imply
   depth, one prominent "lead star" per shape acting as the visual
   anchor. Solid thin lines (not dashed), bright lead vertex with a
   soft radial halo, smaller flat dots for the remaining vertices.

   Five distinct geometric forms:
     O1 Tetrahedral       — pyramidal 3D form, 5 vertices
     O2 Octahedral        — symmetric 8-faced form, 6 vertices
     O3 Irregular polyhedron — asymmetric organic form, 7 vertices
     O4 Directional spear  — arrow-like, lead at the tip
     O5 Faceted crystal    — radial gem with spokes to an internal vertex

   Drawn once into _staticLayer in _buildStaticLayer — zero per-frame
   cost beyond the blit that's already happening.

   Format:
     cx, cy   — canvas-fraction center of the outpost
     dots     — [[dx, dy], ...] in pixels relative to (cx, cy);
                INDEX 0 IS THE LEAD STAR (brighter, with glow halo)
     edges    — [[i, j], ...] connecting dot indices                        */
var BG_CONSTELLATIONS = [
  /* O1 + O2 (the two upper-centre outposts) removed — they cluttered the area above the terminal */

  /* O3 — Irregular polyhedron (right edge mid)
     7-vertex asymmetric shape with one internal vertex creating
     organic-looking triangulation. The most "natural-feeling" outpost. */
  { cx: 0.735, cy: 0.475,
    dots:  [[-4,10], [-18,-4], [-8,-14], [8,-12], [16,-2], [12,8], [-2,-2]],
    edges: [[0,1], [0,5], [0,6],
            [1,2], [2,3], [3,4], [4,5],
            [2,6], [3,6],
            [1,5]] },

  /* O4 — Directional spear (bottom-left)
     6-vertex arrow-like form with internal bracing. The lead is at
     the SHARP TIP (right side), giving the cluster directional intent. */
  { cx: 0.440, cy: 0.715,
    dots:  [[18,2], [-2,-8], [-2,10], [-16,-2], [-16,6], [8,0]],
    edges: [[0,1], [0,2], [0,5],
            [1,5], [2,5],
            [1,3], [2,4], [3,4],
            [1,2]] },

  /* O5 — Faceted crystal (bottom-right)
     7-vertex radial gem with spokes from all outer vertices to a
     central internal vertex — classic faceted-gemstone wireframe. */
  { cx: 0.560, cy: 0.715,
    dots:  [[-2,16], [-14,4], [-10,-10], [4,-16], [14,-6], [10,10], [0,-2]],
    edges: [[0,1], [0,5], [0,6],
            [1,2], [2,3], [3,4], [4,5],
            [1,6], [2,6], [3,6], [4,6], [5,6]] },
];

/* Per-city visual character — what makes each cluster distinct.
     tight = nominal cluster radius multiplier (smaller -> tighter pack)
     hubR  = base radius of the city hub itself
     dR    = base district radius range [min, max]
     bg    = is this a distant background cluster?  (faded, parallaxed feel) */
var CITY_STYLE = [
  {tight:1.00, hubR:13.0, dR:[1.25,2.10], bg:false},  // 0 — biggest, densest
  {tight:1.10, hubR:10.5, dR:[1.05,1.75], bg:false},  // 1 — medium
  {tight:1.00, hubR:8.8,  dR:[0.95,1.55], bg:false},  // 2 — small-medium
  {tight:1.05, hubR:7.9,  dR:[0.85,1.35], bg:false},  // 3 — sparse, smallest fg
  {tight:0.55, hubR:5.7,  dR:[0.48,0.80], bg:true },  // 4 — far background
  {tight:0.50, hubR:5.3,  dR:[0.48,0.80], bg:true },  // 5 — far background
];

var HUB_IPS = ['NODE-CORE','NODE-ALPHA','172.16.0.1','10.0.0.254','SOC-EDGE','10.31.4.8'];

/* IPs scattered across selected foreground districts — keyed by [city][localIdx].
   Only a handful per city are labelled so the rest stay anonymous (otherwise
   the IPs become noise). Bg cities (4,5) have nothing — they're too distant.  */
var DISTRICT_IPS_BY_CITY = {
  0: { 2:'192.168.0.7', 5:'10.31.4.8',  9:'172.16.4.3' },   // densest city — 3 labels
  1: { 1:'10.0.5.12',   4:'192.168.4.2' },
  2: { 0:'10.20.1.8',   3:'192.168.3.99' },
  3: { 1:'10.6.2.7' },
};

/* Convert a flat district index into {city, local} — which city it belongs to
   and which position-within-that-city it is. */
function districtCity(distI){
  var cum=0;
  for(var c=0;c<CITY_DIST_COUNTS.length;c++){
    if(distI < cum+CITY_DIST_COUNTS[c]) return {city:c, local:distI-cum};
    cum+=CITY_DIST_COUNTS[c];
  }
  return {city:CITY_DIST_COUNTS.length-1, local:0};
}

function districtPos(distI, hub){
  /* Two-ring pack — inner crowd + outer satellites. `tight` scales the
     whole cluster: smaller = denser. */
  var d = districtCity(distI);
  var style = CITY_STYLE[d.city];
  var n = CITY_DIST_COUNTS[d.city];
  var innerN = Math.ceil(n * 0.55);
  var inner = d.local < innerN;
  /* Expanded ring radii — cities span ~150-200px now (was ~90-130). */
  var ringR = inner ? (42 + Math.random()*28)
                    : (98 + Math.random()*55);
  ringR *= style.tight;
  /* Angle distribution: BG hubs keep a full 360° spread (their cluster
     reads as a small distant town). FG hubs fan into a 252° arc facing
     AWAY from canvas center, so the densest cluster (Hub 0, 13 districts)
     stops crowding into the center and the empty middle stays empty. */
  var angle;
  if(style.bg){
    angle = (d.local / n) * Math.PI*2 + (Math.random()-0.5)*0.85;
  } else {
    var outward = Math.atan2(hub.y - CH/2, hub.x - CW/2);
    var arc = Math.PI * 1.4;            /* 252° fan; 108° inward shadow */
    angle = outward + ((d.local / n) - 0.5) * arc + (Math.random()-0.5)*0.45;
  }
  for(var tries=0; tries<24; tries++){
    var x = hub.x + Math.cos(angle)*ringR;
    var y = hub.y + Math.sin(angle)*ringR;
    if(x>40 && x<CW-40 && y>40 && y<CH-40 && !inBio(x,y)) return {x:x, y:y};
    angle += 0.5;
    ringR *= 0.94;
  }
  return {x: hub.x + (Math.random()-0.5)*60, y: hub.y + (Math.random()-0.5)*60};
}

var nodes=[], memLines=[], scanRings=[];

function Node(i, hubs){
  this.id=i;
  var t=i<HUB_N?'hub':'district';
  this.tier=t;
  this.dead=false; this.deadA=1; this.drifts=false;
  this.vx=0; this.vy=0; this.trail=[]; this.rings=[];
  this.labelAlpha=0; this.label=null; this.fullLabel=null;
  this.typeIdx=0; this.typeT=0; this.typeDelay=0.06;
  this.lastPing=0; this.pendingRing=null;
  this.phase=Math.random()*Math.PI*2;
  this.hbPhase=Math.random()*Math.PI*2;
  this.breathes=false; this.breathPhase=0; this.breathSpd=0.2;
  this.gravHub=null;
  this.constellReveal=0;
  this.starColor=null;

  if(t==='hub'){
    var fp = HUB_POS[i];
    var style = CITY_STYLE[i] || CITY_STYLE[0];
    this.cityStyle = style;
    this.x = fp[0]*CW; this.y = fp[1]*CH;
    this.baseR = style.hubR;
    this.cR = Math.min(CW,CH) * (style.bg ? .055 : .12);
    /* Background hubs glow much less to read as far away */
    this.peak = style.bg ? (.14 + Math.random()*.05)
                         : (.38 + Math.random()*.12);
    this.label = HUB_IPS[i] || ''; this.fullLabel = this.label;
    this.typeIdx = this.label.length;
    this.cr = style.bg ? 175 : 245;
    this.cg = style.bg ? 185 : 242;
    this.cb = style.bg ? 210 : 235;
    this.starColor = HUB_COLORS[i] || {r:220,g:228,b:240};
    this.discovered = true; this.visited = true;
    this.glow = this.peak * .55; this.labelAlpha = 0;
    this.maxT = 0;
    /* Subtle hub pulse — baseR breathes ±10% on a slow phase, each hub
       different. Adds quiet life without competing for attention.        */
    this.breathes = true;
    this.breathPhase = Math.random() * Math.PI*2;
    this.breathSpd = 0.22 + Math.random()*0.12;
    /* Binary disabled — hubs 8/9 no longer exist in this layout. */
    this.isPulsar = (i === 0);
    this.pulsarT = 0; this.pulsarNext = 8 + Math.random()*12;
    this.pulsarRings = [];
    /* willDie is fully off — every hub is a city now, none of them die. */
    this.willDie = false;
    this.dieAt = Infinity;
  } else {
    /* ── district node — member of a city cluster ── */
    var distI = i - HUB_N;
    var dc = districtCity(distI);
    var cityIdx = dc.city;
    var cHub = hubs[cityIdx] || hubs[0];
    var cStyle = CITY_STYLE[cityIdx] || CITY_STYLE[0];
    var dp = districtPos(distI, cHub);
    this.x = dp.x; this.y = dp.y;
    this.baseR = cStyle.dR[0] + Math.random()*(cStyle.dR[1]-cStyle.dR[0]);
    this.cR = Math.min(CW,CH) * (cStyle.bg ? 0.030 : 0.052);
    this.peak = cStyle.bg ? (0.06 + Math.random()*0.04)
                          : (0.13 + Math.random()*0.11);
    /* bg districts dimmer + cooler so they read as far away */
    this.cr = cStyle.bg ? 168 : 198;
    this.cg = cStyle.bg ? 180 : 208;
    this.cb = cStyle.bg ? 206 : 226;
    this.discovered = true; this.visited = true;
    this.glow = this.peak * 0.5; this.labelAlpha = 0; this.maxT = 0;
    /* Label a handful of foreground districts with IPs so addresses
       aren't only visible on the four hubs. Picks varied locals across
       the four cities; bg districts stay anonymous (too distant).        */
    if(!cStyle.bg && DISTRICT_IPS_BY_CITY[cityIdx] && DISTRICT_IPS_BY_CITY[cityIdx][dc.local]){
      this.fullLabel = DISTRICT_IPS_BY_CITY[cityIdx][dc.local];
      this.label = this.fullLabel;
      this.typeIdx = this.fullLabel.length;
    }
    this.gravHub = cityIdx;
    this.gravStrength = cStyle.bg ? (0.00016 + Math.random()*0.00006)   // bg pulls tighter — compact
                                  : (0.00011 + Math.random()*0.00005);
    this.sinePhX = Math.random()*Math.PI*2;
    this.sinePhY = Math.random()*Math.PI*2;
    this.sineFreqX = 0.05 + Math.random()*0.03;
    this.sineFreqY = 0.045 + Math.random()*0.025;
    /* Slightly more sine drift on foreground districts than before — the
       "small animation to make it alive" beat. Bg districts almost still.   */
    var ampScale = cStyle.bg ? 0.35 : 1.0;
    this.sineAmpX = (0.6 + Math.random()*0.8) * ampScale;
    this.sineAmpY = (0.5 + Math.random()*0.7) * ampScale;
  }
}

Node.prototype.ping = function(){
  if(this.tier==='tiny'||this.dead||!this.discovered)return;
  var now=U.uTime.value, cd=this.tier==='hub'?2.0:1.3;
  if(now-this.lastPing<cd)return;
  this.lastPing=now; this.tGlow=this.peak;
  if(this.label)this.labelAlpha=1.0;
  if(!this.visited){
    this.visited=true;
    for(var k=0;k<nodes.length;k++){
      var m=nodes[k];
      if(m===this||m.tier==='tiny'||!m.visited||!m.discovered)continue;
      var dx=m.x-this.x,dy=m.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<Math.max(this.cR,m.cR)*1.1){
        var ex=false;
        for(var j=0;j<memLines.length;j++){
          if((memLines[j].a===this&&memLines[j].b===m)||(memLines[j].a===m&&memLines[j].b===this)){ex=true;break;}
        }
        if(!ex){memLines.push({a:this,b:m,alpha:0});if(memLines.length>200)memLines.shift();}
      }
    }
  }
  var sp=this.tier==='hub'?.10+Math.random()*.06:.14+Math.random()*.10;
  this.rings.push({r:0,alpha:.18,speed:sp});
  if(this.tier==='hub')this.pendingRing={delay:.38,speed:sp*1.6};
};

Node.prototype.update = function(dt){
  if(this.dead){
    this.deadA=Math.max(.04,this.deadA-dt*.004);
    this.glow=this.deadA*.06*(Math.random()<.04?Math.random():1);
    this.tGlow=0; return;
  }
  if(!this.discovered)return;

  if(this.willDie && U.uTime.value > this.dieAt && !this.dead){
    this.dead=true; this.deadA=1.0;
    scanRings.push({x:this.x,y:this.y,r:this.baseR*2,alpha:.25,spd:.08,col:'180,180,200',maxR:this.baseR*10});
  }

  if(this.isPulsar){
    this.pulsarT+=dt;
    if(this.pulsarT>this.pulsarNext){
      this.pulsarT=0; this.pulsarNext=10+Math.random()*15;
      this.pulsarRings.push({r:this.baseR*2, alpha:.18, spd:.12});
    }
    for(var pi=this.pulsarRings.length-1;pi>=0;pi--){
      this.pulsarRings[pi].r+=this.pulsarRings[pi].spd*dt*60*0.4;
      this.pulsarRings[pi].alpha-=dt*.008;
      if(this.pulsarRings[pi].alpha<=0)this.pulsarRings.splice(pi,1);
    }
  }

  var eI=this.tier==='hub'?1.1:1.7, eO=this.tier==='hub'?.028:.050;
  if(this.glow<this.tGlow) this.glow=Math.min(this.tGlow,this.glow+dt*eI);
  else{this.glow=Math.max(0,this.glow-dt*eO);if(this.glow<.01)this.tGlow=0;}

  if((this.label||this.fullLabel)&&this.glow>.09) this.labelAlpha=Math.min(this.labelAlpha+dt*1.4,1);
  else this.labelAlpha=Math.max(0,this.labelAlpha-dt*.012);   // slower decay — labels linger

  if(this.fullLabel&&this.typeIdx<this.fullLabel.length){
    this.typeT+=dt;
    if(this.typeT>=this.typeDelay){this.typeT=0;this.typeIdx++;this.label=this.fullLabel.substring(0,this.typeIdx);}
  }

  for(var k=0;k<this.rings.length;k++){this.rings[k].r+=this.rings[k].speed*.3;this.rings[k].alpha-=this.tier==='hub'?.008:.014;}
  this.rings=this.rings.filter(function(r){return r.alpha>0;});
  if(this.pendingRing){
    this.pendingRing.delay-=dt;
    if(this.pendingRing.delay<=0){this.rings.push({r:0,alpha:.06,speed:this.pendingRing.speed*.4});this.pendingRing=null;}
  }

  if(this.drifts){
    this.trail.push({x:this.x,y:this.y,g:this.glow});
    if(this.trail.length>this.maxT)this.trail.shift();
  }

  if(this.gravHub!==null && nodes[this.gravHub]){
    var gh=nodes[this.gravHub];
    var gdx=gh.x-this.x, gdy=gh.y-this.y, gd2=gdx*gdx+gdy*gdy;
    /* Cheap-compare squared: gd>80 && gd<400 → gd2>6400 && gd2<160000.
       sqrt only runs for the small fraction of nodes inside the ring. */
    if(gd2>6400 && gd2<160000){
      var gd=Math.sqrt(gd2);
      this.vx+=(gdx/gd)*this.gravStrength*dt*60;
      this.vy+=(gdy/gd)*this.gravStrength*dt*60;
    }
  } else if(this.tier==='tiny'){
    var bestD=1e9, bestHub=null;
    for(var k=0;k<HUB_N;k++){
      var hn=nodes[k]; if(!hn||hn.dead)continue;
      var dx=hn.x-this.x,dy=hn.y-this.y,d=dx*dx+dy*dy;
      if(d<bestD){bestD=d;bestHub=hn;}
    }
    if(bestHub && bestD>100*100 && bestD<600*600){
      var bd=Math.sqrt(bestD);
      this.vx+=(bestHub.x-this.x)/bd*this.gravStrength*dt*60;
      this.vy+=(bestHub.y-this.y)/bd*this.gravStrength*dt*60;
    }
  }

  var _damp=(this.tier==='mid'||this.tier==='district')?0.92:0.97;   // mid + district nodes bleed velocity faster — tethered
  this.vx*=_damp; this.vy*=_damp;
  var vs=Math.sqrt(this.vx*this.vx+this.vy*this.vy), vmax=this.tier==='hub'?.02:this.tier==='mid'?.04:.03;
  if(vs>vmax){this.vx*=vmax/vs;this.vy*=vmax/vs;}
  this.x+=this.vx;this.y+=this.vy;
  if(this.x<40){this.x=40;this.vx=Math.abs(this.vx)*.5;}
  if(this.x>CW-40){this.x=CW-40;this.vx=-Math.abs(this.vx)*.5;}
  if(this.y<40){this.y=40;this.vy=Math.abs(this.vy)*.5;}
  if(this.y>CH-40){this.y=CH-40;this.vy=-Math.abs(this.vy)*.5;}

  // LOCAL water: sample the shared flow field at this node's position so
  // neighbours drift together (correlated), instead of each bobbing on its
  // own phase. Applied as a delta (like the old sine) so it never accumulates.
  if((this.tier==='mid'||this.tier==='district')&&this.sineAmpX){
    var _wf=netFlow(this.x, this.y, U.uTime.value*NET_WATER_TSC);
    var nsx=_wf[0]*this.sineAmpX*NET_WATER_AMP;
    var nsy=_wf[1]*this.sineAmpY*NET_WATER_AMP;
    var lsx=this.lastSineX||0, lsy=this.lastSineY||0;
    this.x+=(nsx-lsx);
    this.y+=(nsy-lsy);
    this.lastSineX=nsx; this.lastSineY=nsy;
  }
  // Mouse-proximity reveal — squared compare, no sqrt. Uses the inverse-mapped
  // cursor so the reveal stays aligned while the whole cluster drifts/tumbles.
  var _cr2=78400 /* 280*280 */,_mdx=canvasMXt-this.x,_mdy=canvasMYt-this.y,_md2=_mdx*_mdx+_mdy*_mdy;
  var _near=_md2<_cr2;
  this.constellReveal=expD(this.constellReveal,_near?1:0,_near?3:1.2,dt);
  if(!isFinite(this.constellReveal))this.constellReveal=0;
};

Node.prototype.drawTrail = function(){
  if(!this.drifts||this.trail.length<2)return;
  for(var i=1;i<this.trail.length;i++){
    var f=i/this.trail.length,p0=this.trail[i-1];
    if(!fin(p0.x,p0.y,this.trail[i].x,this.trail[i].y))continue;
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(this.trail[i].x,this.trail[i].y);
    ctx.strokeStyle='rgba('+this.cr+','+this.cg+','+this.cb+','+(f*f*.06).toFixed(3)+')';
    ctx.lineWidth=f*.5; ctx.stroke();
  }
};

Node.prototype.drawRings = function(){
  if(!fin(this.x,this.y))return;
  for(var k=0;k<this.rings.length;k++){
    var rr=this.rings[k];
    ctx.beginPath();ctx.arc(this.x,this.y,rr.r,0,Math.PI*2);
    ctx.strokeStyle='rgba('+this.cr+','+this.cg+','+this.cb+','+rr.alpha.toFixed(3)+')';
    ctx.lineWidth=.6; ctx.stroke();
  }
  if(this.isPulsar){
    for(var pi=0;pi<this.pulsarRings.length;pi++){
      var pr=this.pulsarRings[pi];
      ctx.beginPath();ctx.arc(this.x,this.y,pr.r,0,Math.PI*2);
      ctx.strokeStyle='rgba(200,215,240,'+pr.alpha.toFixed(3)+')';
      ctx.lineWidth=.4; ctx.stroke();
    }
  }
};

Node.prototype.drawHB = function(t){
  if(this.tier!=='hub'||this.glow<.25||this.dead||!fin(this.x,this.y))return;
  var b=Math.sin(t*1.2+this.hbPhase);if(b<.55)return;
  var hbR=this.baseR*(1.2+b*0.6),hbA=(b-.55)*.10*this.glow;
  var gr=rg(this.x,this.y,0,this.x,this.y,hbR);if(!gr)return;
  gr.addColorStop(0,'rgba(235,242,252,'+hbA.toFixed(3)+')');
  gr.addColorStop(1,'rgba(200,215,238,0)');
  ctx.beginPath();ctx.arc(this.x,this.y,hbR,0,Math.PI*2);ctx.fillStyle=gr;ctx.fill();
};

Node.prototype._getSprite = function(brBucket){
  /* Lazy sprite cache. Builds a small offscreen canvas containing the
     halo + core gradient combo at a representative br for this bucket.
     Per-frame draws then become a single drawImage instead of two
     createRadialGradient + addColorStop + fillStyle assignments.
     Memory: ~6 hubs × 12 buckets × ~25KB + 44 districts × 12 × ~1KB =
     ~2.2MB worst case, built lazily so typically <500KB.                */
  if(!this._sprites) this._sprites = {};
  if(this._sprites[brBucket]) return this._sprites[brBucket];
  var br = (brBucket + 0.5) / 12;
  /* Reference radii used to bake the sprite — picked at the maximum the
     node could ever reach (peak glow × max breathScale). At draw time we
     scale the sprite via drawImage to match the current actual hR.       */
  var maxBoost = 1 + 0.5 * (this.tier === 'hub' ? 1.4 : 1.9);
  var refR  = this.baseR * 1.10 * maxBoost;
  var refHR = this.tier === 'hub' ? refR * 5 : refR * 3;
  var sz = Math.max(8, Math.ceil(refHR * 2) + 4);
  var off = document.createElement('canvas');
  off.width = off.height = sz;
  var sx = off.getContext('2d');
  sx.translate(sz / 2, sz / 2);
  if(br > 0.020){
    var gh = sx.createRadialGradient(0, 0, 0, 0, 0, refHR);
    if(gh){
      gh.addColorStop(0, 'rgba(' + this.cr + ',' + this.cg + ',' + this.cb + ',' + Math.min(br * (this.tier === 'hub' ? .28 : .20), .42).toFixed(3) + ')');
      gh.addColorStop(.38, 'rgba(' + this.cr + ',' + this.cg + ',' + this.cb + ',' + Math.min(br * .07, .13).toFixed(3) + ')');
      gh.addColorStop(1, 'rgba(' + this.cr + ',' + this.cg + ',' + this.cb + ',0)');
      sx.beginPath(); sx.arc(0, 0, refHR, 0, Math.PI * 2); sx.fillStyle = gh; sx.fill();
    }
  }
  if(refR > 0){
    var gc = sx.createRadialGradient(0, 0, 0, 0, 0, refR);
    if(gc){
      gc.addColorStop(0, 'rgba(255,255,255,' + Math.min(.20 + br * (this.tier === 'hub' ? .78 : .65), 1).toFixed(3) + ')');
      gc.addColorStop(.5, 'rgba(' + this.cr + ',' + this.cg + ',' + this.cb + ',' + Math.max((br * .52 + .03), 0).toFixed(3) + ')');
      gc.addColorStop(1, 'rgba(' + this.cr + ',' + this.cg + ',' + this.cb + ',0)');
      sx.beginPath(); sx.arc(0, 0, refR, 0, Math.PI * 2); sx.fillStyle = gc; sx.fill();
    }
  }
  this._sprites[brBucket] = { c: off, half: sz / 2, refHR: refHR };
  return this._sprites[brBucket];
};

Node.prototype.draw = function(t){
  if(!this.discovered||!fin(this.x,this.y))return;
  var da=this.dead?this.deadA:1;
  var amb=.038+.025*Math.sin(t*.22+this.phase);
  var dm=(this.tier==='hub'&&!this.dead)?.055:0;
  var br=(this.glow+amb+dm)*da;
  var breathScale=1;
  if(this.breathes&&!this.dead) breathScale=1+0.10*Math.sin(t*this.breathSpd+this.breathPhase);
  var r=this.baseR*breathScale*(1+this.glow*(this.tier==='hub'?1.4:1.9));
  var hR=this.tier==='hub'?r*5:this.tier==='mid'?r*4:r*3;
  if(!fin(r,hR)||r<=0)return;
  /* Sprite-cache blit replaces two per-frame createRadialGradient calls. */
  if(br > 0.005){
    var brBucket = Math.min(11, Math.max(0, Math.floor(br * 12)));
    var sp = this._getSprite(brBucket);
    if(sp){
      var scale = hR / sp.refHR;
      var sz = sp.half * 2 * scale;
      if(da < 0.999){ ctx.save(); ctx.globalAlpha = da; }
      ctx.drawImage(sp.c, this.x - sp.half * scale, this.y - sp.half * scale, sz, sz);
      if(da < 0.999) ctx.restore();
    }
  }
  if(this.tier==='hub'&&br>.08){
    ctx.beginPath();ctx.arc(this.x,this.y,1.2,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+Math.min(br*0.82,.62).toFixed(3)+')';ctx.fill();
    var olt=getOverloadTint(this);
    if(olt){var og=rg(this.x,this.y,0,this.x,this.y,this.baseR*4);if(og){og.addColorStop(0,'rgba(255,140,30,'+(olt*.55).toFixed(3)+')');og.addColorStop(1,'rgba(255,80,0,0)');ctx.beginPath();ctx.arc(this.x,this.y,this.baseR*4,0,Math.PI*2);ctx.fillStyle=og;ctx.fill();}}
    // Diffraction spikes - only during active ping (glow well above idle) OR mouse reveal
    var spikeActive=(this.glow > this.peak*0.78) || ((this.constellReveal||0) > 0.25);
    if(this.starColor && spikeActive){
      var sc=this.starColor;
      var sLen=r*(2.5+this.glow*4+(this.constellReveal||0)*3);
      var sA=(this.glow*0.20+(this.constellReveal||0)*0.10);
      ctx.lineWidth=0.4+(this.constellReveal||0)*0.3;
      for(var s=0;s<4;s++){
        var ang=s*Math.PI*0.5+Math.PI*0.25;
        var sx1=this.x+Math.cos(ang)*r*0.8,sy1=this.y+Math.sin(ang)*r*0.8;
        var sx2=this.x+Math.cos(ang)*sLen,sy2=this.y+Math.sin(ang)*sLen;
        var sg=lg(sx1,sy1,sx2,sy2);
        if(sg){sg.addColorStop(0,'rgba('+Math.min(sc.r+20,255)+','+Math.min(sc.g+15,255)+','+Math.min(sc.b+10,255)+','+sn(sA*1.5).toFixed(4)+')');sg.addColorStop(1,'rgba('+sc.r+','+sc.g+','+sc.b+',0)');ctx.strokeStyle=sg;}
        ctx.beginPath();ctx.moveTo(sx1,sy1);ctx.lineTo(sx2,sy2);ctx.stroke();
      }
    }
  }
  if((this.label||this.fullLabel)&&this.labelAlpha>.012){
    var lx=Math.min(this.x+r+6,CW-110),ly=this.y+3;
    ctx.font="11px 'JetBrains Mono', monospace";
    var typing=this.fullLabel&&this.typeIdx<this.fullLabel.length;
    var cursor=typing&&Math.floor(U.uTime.value*3)%2===0?'_':'';
    ctx.fillStyle='rgba(255,255,255,'+(this.labelAlpha*.55).toFixed(3)+')';
    ctx.fillText(this.label+cursor,lx,ly);
    if(this.visited&&this.tier!=='tiny'&&!typing){
      ctx.font="8px 'JetBrains Mono', monospace";
      ctx.fillStyle='rgba(220,228,245,'+(this.labelAlpha*.36).toFixed(3)+')';
      ctx.fillText(sTime(),lx,ly+12);
    }
    // Crosshair only on strong mouse reveal (hub + mid nodes only, since tiny nodes have no label)
    if((this.constellReveal||0)>0.4){
      var cra=(this.constellReveal||0);cra=cra*cra*(3-2*cra)*0.45;
      var arm=5+cra*3;
      ctx.strokeStyle='rgba(220,235,255,'+sn(cra).toFixed(4)+')';
      ctx.lineWidth=0.7;
      ctx.beginPath();
      ctx.moveTo(this.x-arm,this.y);ctx.lineTo(this.x+arm,this.y);
      ctx.moveTo(this.x,this.y-arm);ctx.lineTo(this.x,this.y+arm);
      ctx.stroke();
    }
  }
};

function initNodes(){
  nodes=[];memLines=[];
  var hubs=[];
  for(var i=0;i<TOTAL;i++){
    var n=new Node(i,hubs);
    nodes.push(n);
    if(n.tier==='hub')hubs.push(n);
  }
}

function preloadMemLines(){
  memLines=[];
  var disc=nodes.filter(function(n){return n.tier!=='tiny'&&n.discovered;});
  for(var i=0;i<disc.length;i++){
    var a=disc[i];
    for(var j=i+1;j<disc.length;j++){
      var b=disc[j];
      var sameCluster = (a.tier==='mid'&&b.tier==='hub'&&a.hubIdx===b.id) ||
                        (b.tier==='mid'&&a.tier==='hub'&&b.hubIdx===a.id) ||
                        (a.tier==='mid'&&b.tier==='mid'&&a.hubIdx===b.hubIdx);
      var dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
      var maxD = sameCluster ? 220 : Math.max(a.cR||0,b.cR||0)*1.1;
      if(d<maxD&&d>0) memLines.push({a:a,b:b,alpha:0});
    }
  }
  /* ── city-cluster webs ──
     Districts don't form connections through the visited/ping path (they're
     pre-visited at construction), so wire them explicitly here:
       1. every district → its city hub (radial spokes)
       2. each district → ~3 nearest district neighbours within its city
     This is what makes hubs 0 and 3 read as dense "cities" rather than as
     loose dust clouds around a hub.                                        */
  var districts=nodes.filter(function(n){return n.tier==='district';});
  /* group by city hub for local nearest-neighbour search */
  var byCity={};
  for(var k=0;k<districts.length;k++){
    var dn=districts[k];
    (byCity[dn.gravHub]=byCity[dn.gravHub]||[]).push(dn);
  }
  Object.keys(byCity).forEach(function(cityIdx){
    var pool=byCity[cityIdx];
    var cityHub=nodes[parseInt(cityIdx,10)];
    /* 1. each district to its city hub */
    if(cityHub){
      for(var i=0;i<pool.length;i++){
        memLines.push({a:cityHub, b:pool[i], alpha:0});
      }
    }
    /* 2. each district to its 3 nearest neighbours inside the same city */
    for(var i=0;i<pool.length;i++){
      var a=pool[i];
      var neigh=[];
      for(var j=0;j<pool.length;j++){
        if(j===i)continue;
        var b=pool[j];
        var dx=a.x-b.x, dy=a.y-b.y, dd=dx*dx+dy*dy;
        neigh.push({n:b,d2:dd});
      }
      neigh.sort(function(p,q){return p.d2-q.d2;});
      for(var k2=0;k2<Math.min(3,neigh.length);k2++){
        var b=neigh[k2].n;
        /* skip if a line a↔b already exists (avoid duplicates from the
           symmetric "b's 3 nearest also includes a" case) */
        var dup=false;
        for(var m=0;m<memLines.length;m++){
          var L=memLines[m];
          if((L.a===a&&L.b===b)||(L.a===b&&L.b===a)){dup=true;break;}
        }
        if(!dup) memLines.push({a:a,b:b,alpha:0});
      }
    }
  });
}

var stars=[], dust=[], nebulae=[];
/* Offscreen canvas holding the static layers (dust + galaxy). These are
   functionally fixed for the lifetime of a viewport size, so paying their
   per-frame draw cost (~220 dust ops + galaxy gradient) is wasteful. We
   render them once into this offscreen, then blit each frame via a single
   drawImage. Rebuilt on resize via buildStars/_buildStaticLayer.          */
var _staticLayer=null, _staticCtx=null;
function _ensureStaticLayer(){
  if(!_staticLayer || _staticLayer.width !== CW || _staticLayer.height !== CH){
    _staticLayer = document.createElement('canvas');
    _staticLayer.width = CW; _staticLayer.height = CH;
    _staticCtx = _staticLayer.getContext('2d');
  }
}

/* ──────────────────────────────────────────────────────────────────
   GRAIN CACHE — single-blit replacement for the 500-point per-frame
   pass. Per-point flicker is sacrificed; its time-mean (|sin| ~ 0.637)
   is folded into the global alpha so the average density matches the
   original. Rebuild on resize (positions are CW/CH-relative).
   ────────────────────────────────────────────────────────────────── */
var _grainLayer=null, _grainCtx=null;
function _ensureGrainLayer(){
  if(!_grainLayer || _grainLayer.width !== CW || _grainLayer.height !== CH){
    _grainLayer = document.createElement('canvas');
    _grainLayer.width = CW; _grainLayer.height = CH;
    _grainCtx = _grainLayer.getContext('2d');
  }
}
function _bakeGrain(){
  if(typeof GRAIN_COUNT === 'undefined' || !grainPts || !grainPts.length) return;
  _ensureGrainLayer();
  var sx = _grainCtx;
  sx.clearRect(0,0,CW,CH);
  _buildGrainBuckets();
  for(var i=0;i<GRAIN_COUNT;i++){
    var g=grainPts[i];
    var px=g.x*CW,py=g.y*CH;
    var dx=(g.x-.5)*2,dy=(g.y-.5)*2,distCenter=Math.sqrt(dx*dx+dy*dy);
    var centerMask=Math.min(1,Math.max(0,(distCenter-.28)/.35));
    var nodeMask=1.0;
    var bgx=Math.floor(g.x*GRAIN_GX), bgy=Math.floor(g.y*GRAIN_GY);
    for(var oy=-1; oy<=1; oy++){
      var by=bgy+oy; if(by<0||by>=GRAIN_GY) continue;
      for(var ox2=-1; ox2<=1; ox2++){
        var bx=bgx+ox2; if(bx<0||bx>=GRAIN_GX) continue;
        var bucket=_grainBuckets[by*GRAIN_GX+bx];
        for(var b=0;b<bucket.length;b++){
          var n=bucket[b];
          var nx=px-n.x, ny=py-n.y, nd2=nx*nx+ny*ny;
          var zone=n.tier==='hub'?80:40, z2=zone*zone;
          if(nd2<z2){ var nd=Math.sqrt(nd2); var nm=nd/zone; if(nm<nodeMask) nodeMask=nm; }
        }
      }
    }
    var a = 0.11 * g.r * centerMask * nodeMask;
    if(a<0.005) continue;
    var radius=.4+g.r*.8;
    sx.beginPath();sx.arc(px,py,radius,0,Math.PI*2);
    sx.fillStyle='rgba(220,228,240,'+a.toFixed(3)+')';sx.fill();
  }
}

/* ──────────────────────────────────────────────────────────────────
   ADAPTIVE FRAME BUDGET — measures rolling-median frame time, drops
   cosmetic passes when the page is struggling. Climbs back up after
   sustained recovery. Tiers (0 = best, 3 = leanest):
     T0: everything · T1: -glitch · T2: -trails · T3: -corona
   ────────────────────────────────────────────────────────────────── */
var _budget = {
  samples: [], tier: 0, maxTier: 3,
  downCounter: 0, upCounter: 0, enabled: true,
  push: function(dtMs){
    this.samples.push(dtMs);
    if(this.samples.length > 60) this.samples.shift();
  },
  median: function(){
    if(this.samples.length < 10) return 16;
    var s = this.samples.slice().sort(function(a,b){return a-b;});
    return s[Math.floor(s.length/2)];
  },
  step: function(dt){
    if(!this.enabled){ this.tier = 0; return; }
    if(this.samples.length < 30) return;
    var med = this.median();
    if(med > 22){
      this.downCounter += dt; this.upCounter = 0;
      if(this.downCounter > 0.6 && this.tier < this.maxTier){
        this.tier++; this.downCounter = 0;
      }
    } else if(med < 15){
      this.upCounter += dt; this.downCounter = 0;
      if(this.upCounter > 2.0 && this.tier > 0){
        this.tier--; this.upCounter = 0;
      }
    } else {
      this.downCounter *= 0.95; this.upCounter *= 0.95;
    }
  }
};

/* Devtools control surface — all optimizations on by default; flip
   from console (window.SITE.PERF.grainBakeEnabled = false, etc) to A/B. */
window.SITE.PERF = {
  nebulaCacheEnabled: true,
  grainBakeEnabled:   true,
  adaptiveEnabled:    true
};
function _buildStaticLayer(){
  _ensureStaticLayer();
  var sx = _staticCtx;
  sx.clearRect(0,0,CW,CH);
  /* dust */
  for(var j=0;j<dust.length;j++){
    var d=dust[j];
    sx.beginPath();sx.arc(d.x,d.y,d.r,0,Math.PI*2);
    sx.fillStyle='rgba(200,212,232,'+d.a.toFixed(3)+')';sx.fill();
  }
  /* galaxy disc */
  var gx=CW*.82, gy=CH*.18, gw=CW*.09, gh=CH*.03, rot=0.38;
  sx.save();sx.translate(gx,gy);sx.rotate(rot);
  var g=sx.createRadialGradient(0,0,0,0,0,gw);
  if(g){
    g.addColorStop(0,'rgba(180,185,200,0.045)');
    g.addColorStop(0.4,'rgba(160,168,185,0.022)');
    g.addColorStop(1,'rgba(140,150,170,0)');
    sx.scale(1, gh/gw);
    sx.beginPath();sx.arc(0,0,gw,0,Math.PI*2);sx.fillStyle=g;sx.fill();
  }
  sx.restore();
  /* deep-field stars — seeded RNG so positions are stable across loads.
     Scattered across the visible viewport, biased AWAY from the empty
     middle (rejection-sample anything within radius 0.2 of viewport center). */
  _drawDeepFieldStars(sx);
  /* bg constellations — small dot+line patterns at the visible edges */
  _drawBgConstellations(sx);
}
function _drawDeepFieldStars(sx){
  var seed = 1729;
  function rng(){
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  var placed = 0, attempts = 0;
  while(placed < 28 && attempts < 400){
    attempts++;
    var vx = rng(), vy = rng();             /* viewport-space [0,1] */
    var dx = vx - 0.5, dy = vy - 0.5;
    if(dx*dx + dy*dy < 0.04) continue;       /* skip empty middle (r<0.2) */
    var cx = (vx * 0.5 + 0.25) * CW;         /* convert to canvas pixels */
    var cy = (vy * 0.5 + 0.25) * CH;
    var r  = 0.5 + rng() * 0.6;
    var a  = 0.20 + rng() * 0.25;
    sx.beginPath();
    sx.arc(cx, cy, r, 0, Math.PI*2);
    sx.fillStyle = 'rgba(180,195,215,'+a.toFixed(3)+')';
    sx.fill();
    placed++;
  }
}
function _drawBgConstellations(sx){
  if(typeof BG_CONSTELLATIONS === 'undefined') return;
  for(var c=0;c<BG_CONSTELLATIONS.length;c++){
    var con = BG_CONSTELLATIONS[c];
    var ox  = con.cx * CW, oy = con.cy * CH;
    var pts = [];
    for(var i=0;i<con.dots.length;i++){
      pts.push([ox + con.dots[i][0], oy + con.dots[i][1]]);
    }
    sx.save();
    /* 1. Wireframe edges — SOLID thin lines, faint but readable.
       The triangulated structure is what gives each outpost its
       distinctive "3D-shape-seen-from-an-angle" character. */
    sx.strokeStyle = 'rgba(178,195,222,0.22)';
    sx.lineWidth   = 0.4;
    for(var e=0;e<con.edges.length;e++){
      var a = pts[con.edges[e][0]], b = pts[con.edges[e][1]];
      sx.beginPath();
      sx.moveTo(a[0], a[1]);
      sx.lineTo(b[0], b[1]);
      sx.stroke();
    }
    /* 2. Regular vertex nodes (indices 1+) — small flat dots */
    sx.fillStyle = 'rgba(200,215,235,0.58)';
    for(var p=1;p<pts.length;p++){
      sx.beginPath();
      sx.arc(pts[p][0], pts[p][1], 1.4, 0, Math.PI*2);
      sx.fill();
    }
    /* 3. Lead star (index 0) — bright dot with a soft radial glow
       halo. Acts as the visual anchor of each outpost the way the
       brightest star in a real constellation does. */
    var lx = pts[0][0], ly = pts[0][1];
    var glow = sx.createRadialGradient(lx, ly, 0, lx, ly, 5.5);
    if(glow){
      glow.addColorStop(0,    'rgba(225,235,255,0.50)');
      glow.addColorStop(0.45, 'rgba(190,210,232,0.16)');
      glow.addColorStop(1,    'rgba(170,190,220,0)');
      sx.fillStyle = glow;
      sx.beginPath();
      sx.arc(lx, ly, 5.5, 0, Math.PI*2);
      sx.fill();
    }
    sx.fillStyle = 'rgba(238,245,255,0.90)';
    sx.beginPath();
    sx.arc(lx, ly, 1.7, 0, Math.PI*2);
    sx.fill();
    sx.restore();
  }
}
function buildStars(){
  stars=[];
  /* Main star layer — gentle twinkle, varied size */
  for(var i=0;i<500;i++){
    stars.push({x:Math.random()*CW, y:Math.random()*CH, r:.3+Math.random()*.9, a:.15+Math.random()*.55, phase:Math.random()*Math.PI*2, spd:.2+Math.random()*.4});
  }
  /* Dust tier — much fainter, smaller, no twinkle. Reads as deep-space
     dust behind the main star field. Together with the stars this gives
     real sense of depth.                                                 */
  dust=[];
  for(var j=0;j<220;j++){
    dust.push({x:Math.random()*CW, y:Math.random()*CH, r:.18+Math.random()*.22, a:.05+Math.random()*.07});
  }
  _buildStaticLayer();
}
function drawStars(t){
  /* Single blit of the pre-rendered dust + galaxy layer (replaces 221
     individual arc/fill calls per frame). Twinkling stars still draw
     live since their alpha animates and pre-rendering them at one
     instant would freeze the field. */
  if(_staticLayer) ctx.drawImage(_staticLayer, 0, 0);
  for(var i=0;i<stars.length;i++){
    var s=stars[i];
    var twk=s.a*(0.7+0.3*Math.sin(t*s.spd+s.phase))*ATMO_DIM;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(220,228,245,'+twk.toFixed(3)+')';ctx.fill();
  }
}
function buildNebulae(){
  nebulae=[];
  var centers=[[0.12,0.18],[0.72,0.15],[0.82,0.70],[0.28,0.80],[0.18,0.42]];
  for(var i=0;i<centers.length;i++){
    nebulae.push({cx:centers[i][0]*CW, cy:centers[i][1]*CH,rx:CW*0.09, ry:CH*0.07,a:0.018+Math.random()*0.014, phase:Math.random()*Math.PI*2});
  }
}
function drawNebulae(t){
  for(var i=0;i<nebulae.length;i++){
    var n=nebulae[i];
    var pulse=0.75+0.25*Math.sin(t*0.14+n.phase);
    var g=ctx.createRadialGradient(n.cx,n.cy,0,n.cx,n.cy,n.rx);
    if(!g)continue;
    var a=(n.a*pulse*ATMO_DIM).toFixed(4);
    g.addColorStop(0,'rgba(160,170,185,'+a+')');
    g.addColorStop(0.5,'rgba(120,130,145,'+(n.a*pulse*0.4*ATMO_DIM).toFixed(4)+')');
    g.addColorStop(1,'rgba(100,110,125,0)');
    ctx.save();ctx.scale(1, n.ry/n.rx);
    ctx.beginPath();ctx.arc(n.cx,n.cy*n.rx/n.ry,n.rx,0,Math.PI*2);
    ctx.fillStyle=g;ctx.fill();ctx.restore();
  }
}

var GRID_STEP=42, GRID_ARM=3.5;
function drawCrosshairGrid(){
  var hubs=nodes.filter(function(n){return n.tier==='hub'&&!n.dead&&n.glow>0.05;});
  if(!hubs.length) return;
  var ox=(CW%GRID_STEP)/2, oy=(CH%GRID_STEP)/2;
  for(var k=0;k<hubs.length;k++){
    var n=hubs[k], zone=150;
    var cMin=Math.floor((n.x-zone-ox)/GRID_STEP), cMax=Math.ceil((n.x+zone-ox)/GRID_STEP);
    var rMin=Math.floor((n.y-zone-oy)/GRID_STEP), rMax=Math.ceil((n.y+zone-oy)/GRID_STEP);
    for(var r=rMin;r<=rMax;r++){
      for(var c=cMin;c<=cMax;c++){
        var gx=ox+c*GRID_STEP, gy=oy+r*GRID_STEP;
        var dx=gx-n.x, dy=gy-n.y, dist2=dx*dx+dy*dy, z2=zone*zone;
        if(dist2>z2) continue;
        var dist=Math.sqrt(dist2);
        var f=1-dist/zone, pulse=f*f*(0.08+n.glow*0.18);
        if(pulse<0.008) continue;
        ctx.strokeStyle='rgba(160,185,220,'+Math.min(pulse,0.40).toFixed(3)+')';
        ctx.lineWidth=0.6;
        ctx.beginPath();
        ctx.moveTo(gx-GRID_ARM,gy);ctx.lineTo(gx+GRID_ARM,gy);
        ctx.moveTo(gx,gy-GRID_ARM);ctx.lineTo(gx,gy+GRID_ARM);
        ctx.stroke();
      }
    }
  }
}

var revealAlpha=0, revealDone=false;
var REVEAL_DUR=1.8;
function updReveal(dt){
  if(!window.SITE._introRevealReady||revealDone)return;
  revealAlpha=Math.min(1,revealAlpha+dt/REVEAL_DUR);
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];if(!n.discovered||n.tier==='tiny')continue;
    var stagger=(n.x/CW)*.4+(n.y/CH)*.3;
    var nr=Math.max(0,Math.min(1,revealAlpha*1.4-stagger));
    n.labelAlpha=nr*.72;
    if(n.tier==='hub') n.glow=n.peak*(.65+nr*.35);
    else n.glow=n.peak*(.55+nr*.35);
  }
  for(var i=0;i<memLines.length;i++) memLines[i].alpha=revealAlpha*.20;
  if(revealAlpha>=1)revealDone=true;
}
function updMemLines(dt){if(revealDone)for(var i=0;i<memLines.length;i++)memLines[i].alpha=Math.min(memLines[i].alpha+dt*.025,.38);}
function drawMemLines(){
  ctx.lineCap='round';
  for(var i=0;i<memLines.length;i++){
    var l=memLines[i];if(l.alpha<.004||!fin(l.a.x,l.a.y,l.b.x,l.b.y))continue;
    var grad=lg(l.a.x,l.a.y,l.b.x,l.b.y);
    if(grad){var ea=sn(l.alpha*1.3).toFixed(4),ma=sn(l.alpha).toFixed(4);grad.addColorStop(0,'rgba(195,208,232,'+ea+')');grad.addColorStop(0.25,'rgba(185,195,220,'+ma+')');grad.addColorStop(0.75,'rgba(185,195,220,'+ma+')');grad.addColorStop(1,'rgba(195,208,232,'+ea+')');ctx.strokeStyle=grad;}
    else{ctx.strokeStyle='rgba(185,195,220,'+sn(l.alpha).toFixed(3)+')';}
    ctx.beginPath();ctx.moveTo(l.a.x,l.a.y);ctx.lineTo(l.b.x,l.b.y);
    ctx.lineWidth=.6;ctx.stroke();
  }
}
function drawBackbone(){
  var h=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});
  ctx.lineCap='round';
  for(var i=0;i<h.length;i++)for(var j=i+1;j<h.length;j++){
    var a=h[i],b=h[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d>a.cR*1.1)continue;
    var f=1-d/(a.cR*1.1),glowMax=Math.max(a.glow,b.glow),la=glowMax*f*.40;
    var alpha=Math.min(f*.12+la,.65),lw=.55+glowMax*f*1.1;
    var grad=lg(a.x,a.y,b.x,b.y);
    if(grad){var ea=sn(Math.min(alpha*1.3,0.8)).toFixed(4),ma=sn(alpha).toFixed(4);grad.addColorStop(0,'rgba(210,225,245,'+ea+')');grad.addColorStop(0.3,'rgba(200,215,235,'+ma+')');grad.addColorStop(0.7,'rgba(200,215,235,'+ma+')');grad.addColorStop(1,'rgba(210,225,245,'+ea+')');ctx.strokeStyle=grad;}
    else{ctx.strokeStyle='rgba(200,215,235,'+sn(alpha).toFixed(3)+')';}
    ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
}
function drawConns(){
  /* Active brightening between same-city districts when they're glowing —
     adds a flicker of life through the city when traffic moves through it.  */
  var act=nodes.filter(function(n){return n.glow>.05&&n.tier==='district'&&!n.dead&&n.discovered;});
  ctx.lineCap='round';
  for(var i=0;i<act.length;i++)for(var j=i+1;j<act.length;j++){
    var a=act[i],b=act[j];
    if(a.gravHub!==b.gravHub)continue;
    var dx=a.x-b.x,dy=a.y-b.y,mD=Math.max(a.cR,b.cR);
    if(dx*dx+dy*dy>mD*mD*2.5)continue;
    var d=Math.sqrt(dx*dx+dy*dy),f=1-d/(mD*1.6),gAB=Math.max(a.glow,b.glow);
    if(f<=0)continue;
    var alpha=f*f*(.10+gAB*.50);
    var grad=lg(a.x,a.y,b.x,b.y);
    if(grad){var ea=sn(alpha*1.3).toFixed(4),ma=sn(alpha).toFixed(4);grad.addColorStop(0,'rgba(175,190,215,'+ea+')');grad.addColorStop(0.25,'rgba(165,175,200,'+ma+')');grad.addColorStop(0.75,'rgba(165,175,200,'+ma+')');grad.addColorStop(1,'rgba(175,190,215,'+ea+')');ctx.strokeStyle=grad;}
    else{ctx.strokeStyle='rgba(165,175,200,'+sn(alpha).toFixed(3)+')';}
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
    ctx.lineWidth=f*.40+gAB*.85;ctx.stroke();
  }
}

var connHeat={};
function heatKey(a,b){return Math.min(a.id,b.id)+'_'+Math.max(a.id,b.id);}
function addHeat(a,b){var k=heatKey(a,b);connHeat[k]=(connHeat[k]||0)+.18;}
function coolHeat(dt){for(var k in connHeat){connHeat[k]=Math.max(0,connHeat[k]-dt*.04);if(connHeat[k]===0)delete connHeat[k];}}
function drawNebulaTrails(){
  var h=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});
  for(var i=0;i<h.length;i++)for(var j=i+1;j<h.length;j++){
    var a=h[i],b=h[j],k=heatKey(a,b),heat=connHeat[k]||0;
    if(heat<.05)continue;
    var dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d>a.cR*1.2)continue;
    var steps=12;
    for(var s=0;s<steps;s++){
      var f=s/steps,fx=a.x+(b.x-a.x)*f,fy=a.y+(b.y-a.y)*f;
      var spread=heat*16*(1-Math.abs(f-.5)*1.8);if(spread<1)continue;
      var gl=ctx.createRadialGradient(fx,fy,0,fx,fy,spread);
      if(gl){gl.addColorStop(0,'rgba(130,150,190,'+(heat*.10).toFixed(3)+')');gl.addColorStop(1,'rgba(80,100,160,0)');ctx.beginPath();ctx.arc(fx,fy,spread,0,Math.PI*2);ctx.fillStyle=gl;ctx.fill();}
    }
  }
}

var pulses=[];
function spawnPulse(nA,nB,isH){if(pulses.length>48)return;pulses.push({nA:nA,nB:nB,t:0,isH:isH||false});}
function updPulses(dt){
  for(var i=pulses.length-1;i>=0;i--){
    pulses[i].t+=dt*(pulses[i].isH?.0028:.0022)*60;
    if(pulses[i].t>=1)pulses.splice(i,1);
  }
}
function drawPulses(){
  for(var i=0;i<pulses.length;i++){
    var p=pulses[i],ax=p.nA.x,ay=p.nA.y,bx=p.nB.x,by=p.nB.y;
    if(!fin(ax,ay,bx,by))continue;
    var x=ax+(bx-ax)*p.t,y=ay+(by-ay)*p.t;if(!fin(x,y))continue;
    var dAB=Math.sqrt((bx-ax)*(bx-ax)+(by-ay)*(by-ay)),mR=Math.max(p.nA.cR,p.nB.cR);
    var f=mR>0?Math.max(0,1-dAB/mR):.5;
    var wS=Math.max(0,p.t-.12),wE=Math.min(1,p.t+.04);
    ctx.beginPath();ctx.moveTo(ax+(bx-ax)*wS,ay+(by-ay)*wS);ctx.lineTo(ax+(bx-ax)*wE,ay+(by-ay)*wE);
    ctx.strokeStyle='rgba(210,232,255,'+(f*(.18+p.isH?.12:0)).toFixed(3)+')';ctx.lineWidth=p.isH?1.2:.72;ctx.stroke();
    var rad=p.isH?5.5:3.8,g=rg(x,y,0,x,y,rad);
    if(g){g.addColorStop(0,'rgba(238,248,255,0.95)');g.addColorStop(1,'rgba(125,175,215,0)');ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}
  }
}

var dataStreams=[];
function spawnDS(){
  if(dataStreams.length>10)return;
  var h=nodes.filter(function(n){return n.tier==='hub'&&n.glow>.08&&!n.dead;});
  if(h.length<2)return;
  var a=h[Math.random()*h.length|0],b,tries=0;
  do{b=h[Math.random()*h.length|0];tries++;}while(b===a&&tries<20);
  if(b===a)return;
  var count=4+Math.random()*4|0,dots=[];
  for(var i=0;i<count;i++)dots.push({t:-i*.12});
  dataStreams.push({nA:a,nB:b,dots:dots,spd:.0024+Math.random()*.0012});
}
function updDS(dt){
  for(var i=dataStreams.length-1;i>=0;i--){
    var s=dataStreams[i];
    for(var j=0;j<s.dots.length;j++)s.dots[j].t+=s.spd*dt*60;
    if(s.dots[s.dots.length-1].t>1.1)dataStreams.splice(i,1);
  }
  if(Math.random()<dt*.18&&dataStreams.length<12)spawnDS();
}
function drawDS(){
  for(var i=0;i<dataStreams.length;i++){
    var s=dataStreams[i];
    var ax=s.nA.x,ay=s.nA.y,bx=s.nB.x,by=s.nB.y;
    if(!fin(ax,ay,bx,by))continue;
    var streamAng=Math.atan2(by-ay,bx-ax);   // align packets to the conduit
    for(var j=0;j<s.dots.length;j++){
      var t=s.dots[j].t;if(t<0||t>1)continue;
      var x=ax+(bx-ax)*t,y=ay+(by-ay)*t;if(!fin(x,y))continue;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(streamAng);
      // trailing edge first (motion blur), then the hard packet body on top
      ctx.fillStyle='rgba(150,190,255,0.40)';
      ctx.fillRect(-8,-1,4,2);
      ctx.fillStyle='rgba(210,235,255,0.95)';
      ctx.fillRect(-4,-1,8,2);
      ctx.restore();
    }
  }
}

function updScanRings(dt){
  while(scanRings.length>64)scanRings.shift();
  for(var i=scanRings.length-1;i>=0;i--){
    var sr=scanRings[i];sr.r+=sr.spd*dt*60;sr.alpha-=dt*.06;
    if(sr.maxR&&sr.r>sr.maxR)sr.alpha=0;
    if(sr.alpha<=0)scanRings.splice(i,1);
  }
}
function drawScanRings(){
  for(var i=0;i<scanRings.length;i++){
    var sr=scanRings[i];if(!fin(sr.x,sr.y,sr.r))continue;
    ctx.beginPath();ctx.arc(sr.x,sr.y,sr.r,0,Math.PI*2);
    ctx.strokeStyle='rgba('+sr.col+','+sr.alpha.toFixed(3)+')';ctx.lineWidth=.6;ctx.stroke();
  }
}

var autoPingT=0, autoPingNext=1.8;
function updAutoPing(dt){
  autoPingT+=dt;if(autoPingT<autoPingNext)return;
  autoPingT=0;autoPingNext=(3.5+Math.random()*2.5)*CALM;
  var hubs=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});
  if(!hubs.length)return;
  var n=hubs[Math.floor(Math.random()*hubs.length)];
  n.ping();
  for(var j=0;j<nodes.length;j++){
    var m=nodes[j];
    if(m===n||m.tier==='tiny'||m.dead||!m.discovered)continue;
    var dx=m.x-n.x,dy=m.y-n.y,mD=Math.max(n.cR,m.cR);
    if(dx*dx+dy*dy<mD*mD)spawnPulse(n,m);
  }
}

var traceroutes=[], trT=0, trNext=18;
function spawnTraceroute(){
  if(traceroutes.length>14)return;
  var h=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});
  if(h.length<2)return;
  var src=h[Math.random()*h.length|0],dst,tries=0;
  do{dst=h[Math.random()*h.length|0];tries++;}while(dst===src&&tries<20);
  if(dst===src)return;
  var hops=[src];var current=src;
  for(var steps=0;steps<3;steps++){
    var bestN=null,bestD=1e9;
    for(var k=0;k<h.length;k++){
      if(h[k]===current||hops.indexOf(h[k])>=0)continue;
      var dx=h[k].x-dst.x,dy=h[k].y-dst.y,d=Math.sqrt(dx*dx+dy*dy);
      var dx2=h[k].x-current.x,dy2=h[k].y-current.y,d2=Math.sqrt(dx2*dx2+dy2*dy2);
      if(d<bestD&&d2<current.cR*2.2){bestD=d;bestN=h[k];}
    }
    if(!bestN||bestN===dst)break;
    hops.push(bestN);current=bestN;
  }
  hops.push(dst);
  traceroutes.push({hops:hops,seg:0,t:0,spd:.014,alpha:1,done:false,hopTimes:[]});
}
function updTraceroutes(dt){
  trT+=dt;if(trT>trNext){spawnTraceroute();trNext=(20+Math.random()*18)*CALM;trT=0;}
  for(var i=traceroutes.length-1;i>=0;i--){
    var tr=traceroutes[i];
    if(tr.done){tr.alpha-=dt*.8;if(tr.alpha<=0)traceroutes.splice(i,1);continue;}
    tr.t+=tr.spd*dt*60;
    if(tr.t>=1){
      tr.t=0;tr.seg++;
      var arrived=tr.hops[tr.seg];
      if(arrived){
        arrived.ping();
        scanRings.push({x:arrived.x,y:arrived.y,r:arrived.baseR*2,alpha:.18,spd:.35,col:'180,220,255'});
        tr.hopTimes.push(Math.floor(Math.random()*80+2));
        if(tr.seg>0){addHeat(tr.hops[tr.seg-1],arrived);addPathGlow(tr.hops[tr.seg-1],arrived);registerHubHit(arrived);window._socAdd&&window._socAdd('TRACEROUTE → '+arrived.fullLabel,'info');}
      }
      if(tr.seg>=tr.hops.length-1)tr.done=true;
    }
  }
}
function drawTraceroutes(){
  for(var i=0;i<traceroutes.length;i++){
    var tr=traceroutes[i];
    if(tr.seg>=tr.hops.length)continue;
    var a=tr.hops[tr.seg],b=tr.hops[Math.min(tr.seg+1,tr.hops.length-1)];
    if(!fin(a.x,a.y,b.x,b.y))continue;
    var x=a.x+(b.x-a.x)*tr.t, y=a.y+(b.y-a.y)*tr.t;
    /* Trail buffer — the leading edge leaves a short fading tail. When the
       traceroute crosses a hop, the trail bends naturally rather than the
       line jumping from one segment to the next.                          */
    if(!tr.trail) tr.trail=[];
    tr.trail.push({x:x, y:y});
    if(tr.trail.length>16) tr.trail.shift();
    /* leading-edge glow */
    var g=rg(x,y,0,x,y,5);
    if(g){
      g.addColorStop(0,'rgba(220,240,255,'+(tr.alpha*.85).toFixed(2)+')');
      g.addColorStop(1,'rgba(100,160,220,0)');
      ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    }
    /* fading trail — older positions fade toward zero */
    var tn=tr.trail.length;
    for(var k=0;k<tn-1;k++){
      var p1=tr.trail[k], p2=tr.trail[k+1];
      var trailA = (k/(tn-1)) * tr.alpha * 0.24;
      ctx.strokeStyle='rgba(160,200,240,'+trailA.toFixed(3)+')';
      ctx.lineWidth=0.7;
      ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
    }
  }
}

var intrusions=[];
var intruT=0,intruNext=25+Math.random()*20;
function updIntrusions(dt){
  intruT+=dt;if(intruT>intruNext){intruT=0;intruNext=(25+Math.random()*25)*CALM;
    var tgts=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});
    if(tgts.length){var tgt=tgts[Math.random()*tgts.length|0];intrusions.push({node:tgt,life:1,phase:0});window._socAdd&&window._socAdd('INTRUSION ATTEMPT: '+tgt.fullLabel,'alert');}
  }
  for(var i=intrusions.length-1;i>=0;i--){intrusions[i].life-=dt*.055;intrusions[i].phase+=dt*2.8;if(intrusions[i].life<=0)intrusions.splice(i,1);}
}
function drawIntrusions(){
  for(var i=0;i<intrusions.length;i++){
    var x=intrusions[i],n=x.node;if(!fin(n.x,n.y))continue;
    var pulse=Math.abs(Math.sin(x.phase)),al=x.life*pulse*.45;
    var ir=n.baseR*3+pulse*6,ig=rg(n.x,n.y,0,n.x,n.y,ir);
    if(ig){ig.addColorStop(0,'rgba(255,160,40,'+(al*.35).toFixed(3)+')');ig.addColorStop(1,'rgba(200,80,20,0)');ctx.beginPath();ctx.arc(n.x,n.y,ir,0,Math.PI*2);ctx.fillStyle=ig;ctx.fill();}
    ctx.beginPath();ctx.arc(n.x,n.y,n.baseR*1.4,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,140,30,'+(al*.60).toFixed(3)+')';ctx.lineWidth=.8;ctx.stroke();
    if(pulse>.7&&x.life>.3){ctx.font="7px 'JetBrains Mono', monospace";ctx.fillStyle='rgba(255,160,50,'+(x.life*pulse*.70).toFixed(3)+')';ctx.fillText('ALERT',n.x+n.baseR+4,n.y-n.baseR-4);}
  }
}

var stormT=0, stormNext=45+Math.random()*30, stormActive=false, stormDur=0;
function updDataStorm(dt){
  stormT+=dt;
  if(!stormActive&&stormT>stormNext){stormActive=true;stormDur=4+Math.random()*3;stormT=0;stormNext=(50+Math.random()*35)*CALM;for(var i=0;i<9;i++) setTimeout(function(){spawnTraceroute();},i*200);}
  if(stormActive){stormT+=dt;if(stormT>stormDur){stormActive=false;stormT=0;}}
}

var wormholes=[];
var whT=0,whNext=22+Math.random()*15;
function initWormhole(){wormholes=[];}
function spawnWormhole(){
  function edgePt(){var e=Math.random()*4|0;if(e===0)return{x:Math.random()*CW,y:20};if(e===1)return{x:Math.random()*CW,y:CH-20};if(e===2)return{x:20,y:Math.random()*CH};return{x:CW-20,y:Math.random()*CH};}
  var a=edgePt(),b=edgePt();var unstable=Math.random()<0.35;
  wormholes.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,life:1,maxLife:8+Math.random()*6,t:0,unstable:unstable,flicker:0});
}
function updWormhole(dt){
  whT+=dt;if(whT>whNext){spawnWormhole();whNext=(22+Math.random()*18)*CALM;whT=0;}
  for(var i=wormholes.length-1;i>=0;i--){var w=wormholes[i];w.t+=dt;if(w.unstable)w.flicker=Math.sin(w.t*18)*0.5+0.5;if(w.t>w.maxLife){wormholes.splice(i,1);}}
}
function drawWormhole(){
  for(var i=0;i<wormholes.length;i++){
    var w=wormholes[i];var fade=Math.min(1,w.t*2)*Math.min(1,(w.maxLife-w.t)*2);var vis=w.unstable?fade*w.flicker:fade;if(vis<.01)continue;
    [[w.ax,w.ay],[w.bx,w.by]].forEach(function(pt){var g=rg(pt[0],pt[1],0,pt[0],pt[1],18);if(g){g.addColorStop(0,'rgba(220,235,255,'+(vis*.7).toFixed(2)+')');g.addColorStop(0.4,'rgba(160,190,230,'+(vis*.3).toFixed(2)+')');g.addColorStop(1,'rgba(80,120,180,0)');ctx.beginPath();ctx.arc(pt[0],pt[1],18,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.beginPath();ctx.arc(pt[0],pt[1],5,0,Math.PI*2);ctx.strokeStyle='rgba(200,220,255,'+(vis*.85).toFixed(2)+')';ctx.lineWidth=.8;ctx.stroke();}});
    ctx.beginPath();ctx.moveTo(w.ax,w.ay);ctx.lineTo(w.bx,w.by);ctx.strokeStyle='rgba(140,175,220,'+(vis*.06).toFixed(3)+')';ctx.lineWidth=.4;ctx.stroke();
  }
}

function mkShip(x,y){return{x:x,y:y,vx:0,vy:0,ang:0,trail:[],mT:80};}
function mkFleet(startHubIdx){
  var h=nodes[startHubIdx]||{x:CW*.3,y:CH*.3};
  return{cx:h.x||CW*.3,cy:h.y||CH*.3,tx:h.x||CW*.3,ty:h.y||CH*.3,vx:0,vy:0,ships:[mkShip(h.x||CW*.3,h.y||CH*.3),mkShip((h.x||CW*.3)+15,(h.y||CH*.3)+10),mkShip((h.x||CW*.3)-12,(h.y||CH*.3)+12)],state:'moving',_target:null,discussNode:null,discussT:0,scanT:0,orbiting:false,oA:0,oDur:5,oT:0};
}
var fleet1,fleet2;
function pickFleetTarget(fl){var h=nodes.filter(function(n){return n.tier==='hub'&&!n.dead;});if(!h.length)return;var vis=h.filter(function(n){return inSafeZone(n.x,n.y);});var pool=vis.length?vis:h;var t=pool[Math.random()*pool.length|0];fl._target=t;fl.tx=t.x;fl.ty=t.y;fl.state='moving';}
function updFleet(fl,dt){
  var dx=fl.tx-fl.cx,dy=fl.ty-fl.cy,d=Math.sqrt(dx*dx+dy*dy);
  if(d>0.1){var spd=fl.state==='discussing'?0.06:0.16;fl.vx=fl.vx*.85+(dx/d)*spd*.15;fl.vy=fl.vy*.85+(dy/d)*spd*.15;if(d<60){fl.vx*=.88;fl.vy*=.88;}}else{fl.vx*=.85;fl.vy*=.85;}
  fl.cx+=fl.vx*dt*60;fl.cy+=fl.vy*dt*60;
  for(var i=0;i<fl.ships.length;i++){var s=fl.ships[i];s.ang+=dt*(fl.state==='discussing'?.04:.10);var orR=fl.state==='discussing'?10:16,fA=s.ang+i*2.094;var formX=fl.cx+Math.cos(fA)*orR,formY=fl.cy+Math.sin(fA)*orR*.72;if(fl.state==='discussing'){formX+=Math.sin(U.uTime.value*1.8+i)*1.2;formY+=Math.cos(U.uTime.value*1.5+i)*.9;}var lF=0.10+0.05*Math.abs(Math.sin(U.uTime.value*.4+i*1.3));s.x+=(formX-s.x)*lF;s.y+=(formY-s.y)*lF;s.trail.push({x:s.x,y:s.y});if(s.trail.length>s.mT)s.trail.shift();}
  if(fl.state==='moving'&&fl._target&&d<28){fl.state='discussing';fl.discussNode=fl._target;fl.discussT=0;fl.scanT=0;}
  if(fl.state==='discussing'){fl.discussT+=dt;fl.scanT+=dt;var nd=fl.discussNode;if(fl.scanT>1.8){fl.scanT=0;scanRings.push({x:nd.x,y:nd.y,r:nd.baseR*2,alpha:.20,spd:.55,col:'155,215,175'});}nd.tGlow=nd.peak*.80;if(fl.discussT>=3.5+Math.random()*2){nd.ping();fl.state='orbiting';fl.oA=Math.atan2(fl.cy-nd.y,fl.cx-nd.x);fl.oDur=4.0+Math.random()*3;fl.oT=0;}}
  if(fl.state==='orbiting'){fl.oT+=dt;fl.oA+=dt*.28;var oR=(fl.discussNode.baseR||2)*6+20;fl.tx=fl.discussNode.x+Math.cos(fl.oA)*oR;fl.ty=fl.discussNode.y+Math.sin(fl.oA)*oR*.72;if(fl.oT>fl.oDur)pickFleetTarget(fl);}
}

var patrol1={ship:null,hubA:0,hubB:2,t:0,spd:.0006,dir:1};
var patrol2={ship:null,hubA:5,hubB:7,t:0,spd:.0005,dir:1};
function initPatrols(){
  var h0=nodes[patrol1.hubA]||{x:CW*.15,y:CH*.15};patrol1.ship=mkShip(h0.x,h0.y);
  var h5=nodes[patrol2.hubA]||{x:CW*.6,y:CH*.8};patrol2.ship=mkShip(h5.x,h5.y);
}
function updPatrol(p,dt){
  var hA=nodes[p.hubA],hB=nodes[p.hubB];if(!hA||!hB)return;
  p.t+=p.spd*p.dir*dt*60;if(p.t>=1){p.t=1;p.dir=-1;}if(p.t<=0){p.t=0;p.dir=1;}
  var tx=hA.x+(hB.x-hA.x)*p.t, ty=hA.y+(hB.y-hA.y)*p.t;
  p.ship.x+=(tx-p.ship.x)*.08; p.ship.y+=(ty-p.ship.y)*.08;
  p.ship.ang+=dt*.15;
  p.ship.trail.push({x:p.ship.x,y:p.ship.y});if(p.ship.trail.length>60)p.ship.trail.shift();
}

var _freighterX0=CW*.25;
var freighter={x:_freighterX0,y:_safeY(_freighterX0),vx:.045,vy:.014,ang:0,trail:[],mT:30,size:2.2};
function updFreighter(dt){freighter.ang+=dt*.08;freighter.x+=freighter.vx*dt*60;freighter.y+=freighter.vy*dt*60;freighter.trail.push({x:freighter.x,y:freighter.y});if(freighter.trail.length>freighter.mT)freighter.trail.shift();if(freighter.x>CW*.70){freighter.x=CW*.25;freighter.y=_safeY(freighter.x);freighter.vy=(Math.random()-.5)*.04;}}

var probe={x:-10,y:_safeY(-10),vx:.012,vy:.003,ang:0,trail:[],mT:20,active:true};
function updProbe(dt){if(!probe.active)return;probe.ang+=dt*.04;probe.x+=probe.vx*dt*60;probe.y+=probe.vy*dt*60;probe.trail.push({x:probe.x,y:probe.y});if(probe.trail.length>probe.mT)probe.trail.shift();if(probe.x>CW+20){probe.active=false;setTimeout(function(){probe.x=-10;probe.y=_safeY(-10);probe.active=true;},60000+Math.random()*60000);}}

/* Chase group spawns near the top-left of the ON-SCREEN band instead of dead
   center. The canvas is 2x oversized for off-screen entries/exits (see
   newWaypoint above) — only canvas fraction ~0.25-0.75 is actually visible,
   so the anchor has to live inside that band (~0.30), not near 0 (which is
   the off-screen margin and was why the ships went invisible). It still
   roams the whole band via newWaypoint() within a few seconds; relative
   spacing between the four craft is unchanged, just the cluster's anchor. */
var robber={x:CW*.30,y:CH*.30,tx:CW*.45,ty:CH*.32,vx:0,vy:0,spd:.52,trail:[],mT:70,ang:0,pause:0};
var cop={x:CW*.30,y:CH*.33,tx:0,ty:0,vx:0,vy:0,spd:.46,trail:[],mT:60,ang:0};
var esc1={x:CW*.31,y:CH*.31,vx:0,vy:0,spd:.32,trail:[],mT:45,ang:0};
var esc2={x:CW*.29,y:CH*.31,vx:0,vy:0,spd:.18,trail:[],mT:45,ang:0};
var chLasers=[];
function newWaypoint(){
  /* The hacker actively dives at a real Hub node — but the #sc canvas is 2x
     oversized and only its center band (canvas fraction ~0.25-0.75) is on
     screen. Filter to hubs inside that band so the chase never wanders into
     the off-screen void and leaves the user staring at empty space. */
  var vxMin=CW*0.28,vxMax=CW*0.72,vyMin=CH*0.28,vyMax=CH*0.72;
  var targets=nodes.filter(function(n){
    return n.tier==='hub'&&!n.dead&&
           n.x>vxMin&&n.x<vxMax&&n.y>vyMin&&n.y<vyMax;
  });
  /* Prefer hubs the page has marked as actually open, not just on-screen —
     falls back to the plain on-screen band above if none qualify. */
  var openTargets=targets.filter(function(n){return inSafeZone(n.x,n.y);});
  if(openTargets.length>0)targets=openTargets;
  if(targets.length>0){
    var tgt=targets[Math.floor(Math.random()*targets.length)];
    robber.tx=tgt.x+(Math.random()-0.5)*35;   // slight off-center — an attack vector, not a dock
    robber.ty=tgt.y+(Math.random()-0.5)*35;
  }else{
    robber.tx=vxMin+Math.random()*(vxMax-vxMin);
    robber.ty=vyMin+Math.random()*(vyMax-vyMin);
  }
}
function steerShip(ship,tx,ty,spd){var dx=tx-ship.x,dy=ty-ship.y,d=Math.sqrt(dx*dx+dy*dy);if(d<1)return;var s=Math.min(spd,d*.08);ship.vx=ship.vx*.88+(dx/d)*s*.12;ship.vy=ship.vy*.88+(dy/d)*s*.12;ship.ang=Math.atan2(dy,dx);}
function varSpd(base,phase){return base*(0.72+0.42*Math.abs(Math.sin(U.uTime.value*0.55+phase)));}
function updChase(dt){
  robber.wayT=(robber.wayT||0)+dt;
  var dw=Math.sqrt((robber.x-robber.tx)*(robber.x-robber.tx)+(robber.y-robber.ty)*(robber.y-robber.ty));
  if(dw<40||robber.wayT>18+Math.random()*10){newWaypoint();robber.wayT=0;}
  if(robber.pause>0){robber.pause-=dt;}else{steerShip(robber,robber.tx,robber.ty,varSpd(robber.spd,0));}
  robber.x+=robber.vx*dt*60;robber.y+=robber.vy*dt*60;
  robber.trail.push({x:robber.x,y:robber.y});if(robber.trail.length>robber.mT)robber.trail.shift();
  cop.tx=robber.x;cop.ty=robber.y;steerShip(cop,cop.tx,cop.ty,varSpd(cop.spd,.8));
  cop.x+=cop.vx*dt*60;cop.y+=cop.vy*dt*60;cop.trail.push({x:cop.x,y:cop.y});if(cop.trail.length>60)cop.trail.shift();
  var escT=[{tx:robber.x-Math.cos(robber.ang)*25,ty:robber.y-Math.sin(robber.ang)*25},{tx:robber.x-Math.cos(robber.ang)*42,ty:robber.y-Math.sin(robber.ang)*42}];
  [esc1,esc2].forEach(function(e,i){steerShip(e,escT[i].tx,escT[i].ty,varSpd(e.spd,i+1.2));e.x+=e.vx*dt*60;e.y+=e.vy*dt*60;e.trail.push({x:e.x,y:e.y});if(e.trail.length>e.mT)e.trail.shift();});
  checkWormholeTransit(robber);checkWormholeTransit(cop);
  var dCop=Math.sqrt((cop.x-robber.x)*(cop.x-robber.x)+(cop.y-robber.y)*(cop.y-robber.y));
  if(dCop<120&&Math.random()<dt*0.7){chLasers.push({x1:cop.x,y1:cop.y,x2:robber.x+(Math.random()-0.5)*20,y2:robber.y+(Math.random()-0.5)*20,alpha:.7,life:0.18});if(dCop<60)triggerRobberHit();}
  for(var i=chLasers.length-1;i>=0;i--){chLasers[i].life-=dt;chLasers[i].alpha-=dt*3.5;if(chLasers[i].alpha<=0)chLasers.splice(i,1);}
}
function drawChaseShip(ship,size,warm,threat){
  if(!fin(ship.x,ship.y))return;
  /* The aura IS the glow — widening it and lifting its alpha buys a real bloom
     for zero extra draw calls, which a second additive pass would not. */
  var R   = size*3.8*CRAFT.halo;
  var rgb = threat ? '255,90,50' : (warm ? '255,220,160' : '180,210,250');
  var aA  = cA(threat ? 0.34 : (warm ? 0.35 : 0.28));
  var h   = rg(ship.x,ship.y,0,ship.x,ship.y,R);
  if(h){
    h.addColorStop(0,   'rgba('+rgb+','+aA.toFixed(3)+')');
    h.addColorStop(0.45,'rgba('+rgb+','+(aA*0.30).toFixed(3)+')');
    h.addColorStop(1,   'rgba(80,100,140,0)');
    ctx.beginPath();ctx.arc(ship.x,ship.y,R,0,Math.PI*2);ctx.fillStyle=h;ctx.fill();
  }
  ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.ang);
  ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.7,size*.5);ctx.lineTo(-size*.4,0);ctx.lineTo(-size*.7,-size*.5);ctx.closePath();
  ctx.fillStyle = threat ? 'rgba(255,120,80,'+cA(0.90).toFixed(3)+')'
                : (warm  ? 'rgba(245,228,195,'+cA(0.82).toFixed(3)+')'
                         : 'rgba(205,225,250,'+cA(0.78).toFixed(3)+')');
  ctx.fill();
  ctx.restore();
}
function drawChase(){
  for(var i=0;i<chLasers.length;i++){var l=chLasers[i];if(!fin(l.x1,l.y1,l.x2,l.y2))continue;var g=lg(l.x1,l.y1,l.x2,l.y2);if(g){g.addColorStop(0,'rgba(215,222,242,'+(l.alpha*.85).toFixed(3)+')');g.addColorStop(1,'rgba(175,185,215,'+(l.alpha*.08).toFixed(3)+')');ctx.beginPath();ctx.moveTo(l.x1,l.y1);ctx.lineTo(l.x2,l.y2);ctx.strokeStyle=g;ctx.lineWidth=.50;ctx.stroke();}}
  // robber + its two escorts = threat group (red); cop = defender (blue)
  var ships=[robber,cop,esc1,esc2],tC=['rgba(255,80,40,','rgba(195,212,242,','rgba(235,90,55,','rgba(235,90,55,'],tW=[.95,.72,.50,.50];
  for(var i=0;i<ships.length;i++){var s=ships[i];for(var j=1;j<s.trail.length;j++){var f=j/s.trail.length,p0=s.trail[j-1];if(!fin(p0.x,p0.y,s.trail[j].x,s.trail[j].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(s.trail[j].x,s.trail[j].y);ctx.strokeStyle=tC[i]+(f*f*.17).toFixed(3)+')';ctx.lineWidth=f*tW[i];ctx.stroke();}}
  ctx.globalAlpha=robberDamageAlpha();drawChaseShip(robber,5.5,false,true);ctx.globalAlpha=1;drawChaseShip(cop,4.8,false);drawChaseShip(esc1,2.8,false,true);drawChaseShip(esc2,2.8,false,true);
}
function drawFleet(fl){for(var i=0;i<fl.ships.length;i++){var s=fl.ships[i];for(var j=1;j<s.trail.length;j++){var f=j/s.trail.length,p0=s.trail[j-1];if(!fin(p0.x,p0.y,s.trail[j].x,s.trail[j].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(s.trail[j].x,s.trail[j].y);ctx.strokeStyle='rgba(200,220,248,'+tA(f*f*.14)+')';ctx.lineWidth=f*.55;ctx.stroke();}drawChaseShip(s,3.2,false);}}
function drawPatrol(p){var s=p.ship;if(!s)return;for(var j=1;j<s.trail.length;j++){var f=j/s.trail.length,p0=s.trail[j-1];if(!fin(p0.x,p0.y,s.trail[j].x,s.trail[j].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(s.trail[j].x,s.trail[j].y);ctx.strokeStyle='rgba(195,215,245,'+tA(f*f*.12)+')';ctx.lineWidth=f*.45;ctx.stroke();}drawChaseShip(s,2.8,false);}
function drawSlowShip(ship,sz,warm){if(!fin(ship.x,ship.y))return;for(var j=1;j<ship.trail.length;j++){var f=j/ship.trail.length,p0=ship.trail[j-1];if(!fin(p0.x,p0.y,ship.trail[j].x,ship.trail[j].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(ship.trail[j].x,ship.trail[j].y);ctx.strokeStyle='rgba(195,215,245,'+tA(f*f*.09)+')';ctx.lineWidth=f*.4;ctx.stroke();}drawChaseShip(ship,sz,warm);}

var _wanStart=randomSafePoint(), _wanTarget=randomSafePoint();
var wan={x:_wanStart.x,y:_wanStart.y,tx:_wanTarget.x,ty:_wanTarget.y,vx:0,vy:0,spd:.32,trail:[],mT:50,ang:0};
var orb={angle:0,spd:.022,rX:0,rY:0,cx:CW*.33,cy:CH*.30,tilt:0,tiltSpd:.0012,trail:[],mT:50,x:CW*.33,y:CH*.30};
var sct={x:-20,y:CH*.4,tx:CW+20,ty:CH*.6,vx:0,vy:0,spd:.18,trail:[],mT:40,ang:0,dT:0};
/* deadSat drifts and bounces off canvas edges, so a bad initial spot self-
   corrects over time; relaySat and geoSat never move at all, so wherever
   they spawn is where they sit for the whole visit — those two lean on
   the safe zone, not just deadSat's starting point. */
var _deadSatStart=randomSafePoint(), _relaySatStart=randomSafePoint(), _geoSatStart=randomSafePoint();
var deadSat={x:_deadSatStart.x,y:_deadSatStart.y,vx:.022,vy:.008,ang:0,angSpd:.025,trail:[],mT:20,alpha:.25};
var relaySat={x:_relaySatStart.x,y:_relaySatStart.y,ang:0,pulseT:0,pulseNext:6};
var geoSat={x:_geoSatStart.x,y:_geoSatStart.y,ang:0};
var reticles=[];

function initOrb(){var h=nodes.filter(function(n){return n.tier==='hub';});var vis=h.filter(function(n){return inSafeZone(n.x,n.y);});var pool=vis.length?vis:h;if(pool.length){var pick=pool[Math.random()*pool.length|0];orb.cx=pick.x;orb.cy=pick.y;}orb.rX=45+Math.random()*20;orb.rY=22+Math.random()*12;orb.tilt=Math.random()*.5;}
function resetSct(){var e=Math.random()*4|0;if(e===0){sct.x=Math.random()*CW;sct.y=-8;sct.tx=Math.random()*CW;sct.ty=CH+8;}else if(e===1){sct.x=Math.random()*CW;sct.y=CH+8;sct.tx=Math.random()*CW;sct.ty=-8;}else if(e===2){sct.x=-8;sct.y=Math.random()*CH;sct.tx=CW+8;sct.ty=Math.random()*CH;}else{sct.x=CW+8;sct.y=Math.random()*CH;sct.tx=-8;sct.ty=Math.random()*CH;}}
function updWan(dt){wan.ang+=dt*.36;if(wan.pause>0){wan.pause-=dt;return;}var dx=wan.tx-wan.x,dy=wan.ty-wan.y,d=Math.sqrt(dx*dx+dy*dy);if(d<30){var _p=randomSafePoint();wan.tx=_p.x;wan.ty=_p.y;wan.pause=1+Math.random()*2;return;}var s=Math.min(.85,d*.008)*60;wan.vx=wan.vx*.88+(dx/d)*s*.12;wan.vy=wan.vy*.88+(dy/d)*s*.12;wan.x+=wan.vx*dt;wan.y+=wan.vy*dt;wan.trail.push({x:wan.x,y:wan.y});if(wan.trail.length>wan.mT)wan.trail.shift();}
function updOrb(dt){orb.ang+=dt*.30;orb.angle+=orb.spd*dt;orb.tilt+=orb.tiltSpd*dt;var lx=Math.cos(orb.angle)*orb.rX,ly=Math.sin(orb.angle)*orb.rY;var ct=Math.cos(orb.tilt),st=Math.sin(orb.tilt);orb.x=orb.cx+lx*ct-ly*st;orb.y=orb.cy+lx*st+ly*ct;orb.trail.push({x:orb.x,y:orb.y});if(orb.trail.length>orb.mT)orb.trail.shift();}
function updSct(dt){sct.ang+=dt*.52;var dx=sct.tx-sct.x,dy=sct.ty-sct.y,d=Math.sqrt(dx*dx+dy*dy);if(d<12){resetSct();sct.trail=[];return;}sct.vx=sct.vx*.82+(dx/d)*sct.spd*.18;sct.vy=sct.vy*.82+(dy/d)*sct.spd*.18;sct.x+=sct.vx*dt*60;sct.y+=sct.vy*dt*60;sct.trail.push({x:sct.x,y:sct.y});if(sct.trail.length>sct.mT)sct.trail.shift();sct.dT+=dt;if(sct.dT>4.5){sct.dT=0;var SR=Math.min(CW,CH)*.06;var nb=nodes.filter(function(n){return n.tier!=='tiny'&&!n.dead&&n.discovered&&(n.x-sct.x)*(n.x-sct.x)+(n.y-sct.y)*(n.y-sct.y)<SR*SR;});for(var k=0;k<nb.length;k++){if(Math.random()<.55){nb[k].ping();if(reticles.length<16)reticles.push({node:nb[k],r:nb[k].baseR*4.5,life:1});}}}}
function updDeadSat(dt){deadSat.ang+=dt*deadSat.angSpd;deadSat.x+=deadSat.vx*dt*60;deadSat.y+=deadSat.vy*dt*60;if(deadSat.x>CW+40||deadSat.x<-40){deadSat.vx*=-1;}if(deadSat.y>CH+40||deadSat.y<-40){deadSat.vy*=-1;}deadSat.trail.push({x:deadSat.x,y:deadSat.y});if(deadSat.trail.length>deadSat.mT)deadSat.trail.shift();}
function updRelaySat(dt){relaySat.ang+=dt*.12;relaySat.pulseT+=dt;if(relaySat.pulseT>relaySat.pulseNext){relaySat.pulseT=0;relaySat.pulseNext=6+Math.random()*5;scanRings.push({x:relaySat.x,y:relaySat.y,r:5,alpha:.18,spd:.40,col:'170,200,230'});}}
function updReticles(dt){for(var i=reticles.length-1;i>=0;i--){reticles[i].life-=dt*.18;if(reticles[i].life<=0)reticles.splice(i,1);}}
/* The satellites were the dimmest things on the canvas for a simple reason:
   unlike every ship, they were drawn as two flat rectangles with NO aura at
   all. Against a blacker sky they'd have disappeared entirely. They get a halo
   of their own now (one radial per satellite — four ops a frame), plus the
   same boosted hull alpha as the ships. */
function drawSatBody(x,y,ang,sc,al){
  if(!fin(x,y))return;
  if(CRAFT.satHalo > 0){
    var R = 11*sc*CRAFT.halo;
    var g = rg(x,y,0,x,y,R);
    if(g){
      var gA = cA(al*CRAFT.satHalo);
      g.addColorStop(0,   'rgba(185,215,255,'+gA.toFixed(3)+')');
      g.addColorStop(0.5, 'rgba(150,185,240,'+(gA*0.28).toFixed(3)+')');
      g.addColorStop(1,   'rgba(90,120,170,0)');
      ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
    }
  }
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  ctx.beginPath();ctx.rect(-3*sc,-1.2*sc,6*sc,2.4*sc);
  ctx.fillStyle='rgba(205,222,248,'+cA(al).toFixed(3)+')';ctx.fill();
  ctx.beginPath();ctx.rect(-8*sc,-0.6*sc,5*sc,1.2*sc);ctx.rect(3*sc,-0.6*sc,5*sc,1.2*sc);
  ctx.fillStyle='rgba(165,190,232,'+cA(al*.7).toFixed(3)+')';ctx.fill();
  ctx.restore();
}
function drawWan(){for(var i=1;i<wan.trail.length;i++){var f=i/wan.trail.length,p0=wan.trail[i-1];if(!fin(p0.x,p0.y,wan.trail[i].x,wan.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(wan.trail[i].x,wan.trail[i].y);ctx.strokeStyle='rgba(198,216,245,'+tA(f*.08)+')';ctx.lineWidth=f*.5;ctx.stroke();}drawSatBody(wan.x,wan.y,wan.ang,1,.72);}
function drawOrb(){for(var i=1;i<orb.trail.length;i++){var f=i/orb.trail.length,p0=orb.trail[i-1];if(!fin(p0.x,p0.y,orb.trail[i].x,orb.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(orb.trail[i].x,orb.trail[i].y);ctx.strokeStyle='rgba(198,216,245,'+tA(f*.07)+')';ctx.lineWidth=f*.45;ctx.stroke();}drawSatBody(orb.x,orb.y,orb.ang,1,.65);}
function drawSct(){for(var i=1;i<sct.trail.length;i++){var f=i/sct.trail.length,p0=sct.trail[i-1];if(!fin(p0.x,p0.y,sct.trail[i].x,sct.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(sct.trail[i].x,sct.trail[i].y);ctx.strokeStyle='rgba(198,216,245,'+tA(f*.08)+')';ctx.lineWidth=f*.5;ctx.stroke();}drawSatBody(sct.x,sct.y,sct.ang,.8,.58);}
function drawDeadSat(){for(var i=1;i<deadSat.trail.length;i++){var f=i/deadSat.trail.length,p0=deadSat.trail[i-1];if(!fin(p0.x,p0.y,deadSat.trail[i].x,deadSat.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(deadSat.trail[i].x,deadSat.trail[i].y);ctx.strokeStyle='rgba(150,162,180,'+tA(f*.05)+')';ctx.lineWidth=f*.3;ctx.stroke();}drawSatBody(deadSat.x,deadSat.y,deadSat.ang,.85,deadSat.alpha*.6);}
function drawRelaySat(){drawSatBody(relaySat.x,relaySat.y,relaySat.ang,1.1,.50);}
function drawGeoSat(){drawSatBody(geoSat.x,geoSat.y,geoSat.ang*.02,.9,.22);}
function drawReticles(){for(var i=0;i<reticles.length;i++){var r=reticles[i],s=r.r,rx=r.node.x,ry=r.node.y,al=r.life*.35;ctx.strokeStyle='rgba(160,200,230,'+al.toFixed(3)+')';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(rx-s,ry);ctx.lineTo(rx-s*.4,ry);ctx.moveTo(rx+s*.4,ry);ctx.lineTo(rx+s,ry);ctx.moveTo(rx,ry-s);ctx.lineTo(rx,ry-s*.4);ctx.moveTo(rx,ry+s*.4);ctx.lineTo(rx,ry+s);ctx.stroke();ctx.beginPath();ctx.arc(rx,ry,s*.38,0,Math.PI*2);ctx.strokeStyle='rgba(160,200,230,'+(al*.5).toFixed(3)+')';ctx.lineWidth=.4;ctx.stroke();}}

var ss=null,ssNext=14+Math.random()*12,ssT=0;
var meteorShower=null,showerT=0,showerNext=55+Math.random()*40;
var bigAst={x:-120,y:_safeY(-120),vx:.035,vy:.010,ang:0,trail:[],mT:50,debris:[],active:true};
function spawnSS(){var e=Math.random()*4|0,sx,sy,ang;if(e===0){sx=Math.random()*CW;sy=-8;ang=Math.PI*.5+.4*(Math.random()-.5);}else if(e===1){sx=Math.random()*CW;sy=CH+8;ang=-Math.PI*.5+.4*(Math.random()-.5);}else if(e===2){sx=-8;sy=Math.random()*CH;ang=.4*(Math.random()-.5);}else{sx=CW+8;sy=Math.random()*CH;ang=Math.PI+.4*(Math.random()-.5);}ss={x:sx,y:sy,vx:Math.cos(ang)*1.8,vy:Math.sin(ang)*1.8,trail:[],mT:18,life:1};}
function updSS(dt){if(!ss)return;ss.trail.push({x:ss.x,y:ss.y});if(ss.trail.length>ss.mT)ss.trail.shift();if(ss.trail.length>0){var lt=ss.trail[ss.trail.length-1];spawnAfterGlow(lt.x,lt.y);}ss.x+=ss.vx*dt*60;ss.y+=ss.vy*dt*60;if(ss.x<-20||ss.x>CW+20||ss.y<-20||ss.y>CH+20){if(ss)spawnAfterGlow(ss.x,ss.y);ss=null;}}
function drawSS(){if(!ss||ss.trail.length<2)return;for(var i=1;i<ss.trail.length;i++){var f=i/ss.trail.length,p0=ss.trail[i-1];if(!fin(p0.x,p0.y,ss.trail[i].x,ss.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(ss.trail[i].x,ss.trail[i].y);ctx.strokeStyle='rgba(240,246,255,'+(f*f*.55).toFixed(3)+')';ctx.lineWidth=f*.8;ctx.stroke();}}
function spawnMeteorShower(){var angle=Math.random()*.3;var startX=Math.random()*CW;meteorShower={meteors:[],count:4+Math.random()*3|0,spawnT:0,spawnInterval:0.12};for(var i=0;i<meteorShower.count;i++){var sx=startX+i*30,sy=-10;meteorShower.meteors.push({x:sx,y:sy,vx:Math.cos(angle)*1.6+i*.05,vy:Math.sin(angle)*1.6+1.0,trail:[],mT:14,done:false});}}
function updMeteorShower(dt){showerT+=dt;if(!meteorShower&&showerT>showerNext){showerNext=55+Math.random()*40;showerT=0;spawnMeteorShower();}if(!meteorShower)return;var allDone=true;for(var i=0;i<meteorShower.meteors.length;i++){var m=meteorShower.meteors[i];if(m.done)continue;allDone=false;m.trail.push({x:m.x,y:m.y});if(m.trail.length>m.mT)m.trail.shift();m.x+=m.vx*dt*60;m.y+=m.vy*dt*60;if(m.x>CW+20||m.y>CH+20)m.done=true;}if(allDone)meteorShower=null;}
function drawMeteorShower(){if(!meteorShower)return;for(var i=0;i<meteorShower.meteors.length;i++){var m=meteorShower.meteors[i];if(m.trail.length<2)continue;for(var j=1;j<m.trail.length;j++){var f=j/m.trail.length,p0=m.trail[j-1];if(!fin(p0.x,p0.y,m.trail[j].x,m.trail[j].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(m.trail[j].x,m.trail[j].y);ctx.strokeStyle='rgba(235,242,255,'+(f*f*.45).toFixed(3)+')';ctx.lineWidth=f*.7;ctx.stroke();}}}
var ast={x:-80,y:CH*.28,vx:.08,vy:.016,ang:0,trail:[],mT:22,debris:[]};
function updAst(dt){ast.ang+=dt*.15;ast.x+=ast.vx*dt*60;ast.y+=ast.vy*dt*60;ast.trail.push({x:ast.x,y:ast.y});if(ast.trail.length>ast.mT)ast.trail.shift();if(ast.x>CW+100){ast.x=-80;ast.y=CH*.1+Math.random()*CH*.8;ast.vy=(Math.random()-.5)*.05;ast.debris=[];}if(Math.random()<dt*.06&&ast.debris.length<8){ast.debris.push({x:ast.x,y:ast.y,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,life:1+Math.random()*2});}for(var i=ast.debris.length-1;i>=0;i--){ast.debris[i].x+=ast.debris[i].vx*dt*60;ast.debris[i].y+=ast.debris[i].vy*dt*60;ast.debris[i].life-=dt*.25;if(ast.debris[i].life<=0)ast.debris.splice(i,1);}}
function drawAst(){for(var i=0;i<ast.debris.length;i++){var d=ast.debris[i];if(!fin(d.x,d.y))continue;ctx.beginPath();ctx.arc(d.x,d.y,.8,0,Math.PI*2);ctx.fillStyle='rgba(200,210,225,'+(d.life*.25).toFixed(3)+')';ctx.fill();}if(ast.trail.length<2)return;for(var i=1;i<ast.trail.length;i++){var f=i/ast.trail.length,p0=ast.trail[i-1];if(!fin(p0.x,p0.y,ast.trail[i].x,ast.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(ast.trail[i].x,ast.trail[i].y);ctx.strokeStyle='rgba(210,218,232,'+(f*.12).toFixed(3)+')';ctx.lineWidth=f*.6;ctx.stroke();}ctx.beginPath();ctx.arc(ast.x,ast.y,2.2,0,Math.PI*2);ctx.fillStyle='rgba(220,225,238,0.72)';ctx.fill();}
function updBigAst(dt){bigAst.ang+=dt*.06;bigAst.x+=bigAst.vx*dt*60;bigAst.y+=bigAst.vy*dt*60;bigAst.trail.push({x:bigAst.x,y:bigAst.y});if(bigAst.trail.length>bigAst.mT)bigAst.trail.shift();if(bigAst.x>CW+150){bigAst.x=-120;bigAst.y=_safeY(-120);bigAst.vy=(Math.random()-.5)*.03;}}
function drawBigAst(){if(bigAst.trail.length<2)return;for(var i=1;i<bigAst.trail.length;i++){var f=i/bigAst.trail.length,p0=bigAst.trail[i-1];if(!fin(p0.x,p0.y,bigAst.trail[i].x,bigAst.trail[i].y))continue;ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(bigAst.trail[i].x,bigAst.trail[i].y);ctx.strokeStyle='rgba(200,210,225,'+(f*.09).toFixed(3)+')';ctx.lineWidth=f*1.2;ctx.stroke();}ctx.beginPath();ctx.arc(bigAst.x,bigAst.y,5.5,0,Math.PI*2);ctx.fillStyle='rgba(205,212,228,0.65)';ctx.fill();ctx.beginPath();ctx.arc(bigAst.x-3,bigAst.y+2,3,0,Math.PI*2);ctx.fillStyle='rgba(180,188,205,0.4)';ctx.fill();}

var GRAIN_COUNT=500,grainPts=[];
(function buildGrain(){for(var i=0;i<GRAIN_COUNT;i++){grainPts.push({x:Math.random(),y:Math.random(),r:Math.random(),cluster:Math.random()});}})();

/* Spatial bucket grid for drawGrain's node-mask lookup. The old loop was
   O(grain × nodes) = 500 × 50 = 25,000 distance checks per frame, even
   though most nodes were rejected immediately by glow<0.08. Building a
   coarse 8×6 grid of visible glowing nodes once per frame, then checking
   only the grain point's cell + 8 neighbours, brings the inner cost to
   ~500 × 4 = 2,000 checks. ~12× speedup on the slowest fn in the file.   */
var GRAIN_GX=8, GRAIN_GY=6, _grainBuckets=null;
function _buildGrainBuckets(){
  if(!_grainBuckets){ _grainBuckets = []; for(var i=0;i<GRAIN_GX*GRAIN_GY;i++) _grainBuckets[i]=[]; }
  for(var i=0;i<_grainBuckets.length;i++) _grainBuckets[i].length=0;
  if(!CW||!CH) return;   // guard div-by-zero -> NaN bucket index if called before layout has real dimensions
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];
    if(n.tier==='tiny'||!n.discovered||n.glow<0.08) continue;
    var gx=Math.floor(n.x/CW*GRAIN_GX), gy=Math.floor(n.y/CH*GRAIN_GY);
    if(gx<0||gx>=GRAIN_GX||gy<0||gy>=GRAIN_GY) continue;
    _grainBuckets[gy*GRAIN_GX+gx].push(n);
  }
}

function drawGrain(t){
  /* Cached path: 1 drawImage + globalAlpha modulation, replacing 500
     arcs + 9-neighbour lookups per frame. Per-point flicker mean
     (~0.637) is folded into the global alpha. */
  if(window.SITE.PERF && window.SITE.PERF.grainBakeEnabled){
    if(!_grainLayer) _bakeGrain();
    if(!_grainLayer) return;
    var breathe=0.80+0.20*Math.sin(t*.4);
    ctx.save();
    ctx.globalAlpha = breathe * 0.637;
    ctx.drawImage(_grainLayer, 0, 0);
    ctx.restore();
    return;
  }
  /* Fallback: original per-frame implementation. */
  var breathe=0.80+0.20*Math.sin(t*.4),MAX_A=0.11*breathe;
  _buildGrainBuckets();
  ctx.save();
  for(var i=0;i<GRAIN_COUNT;i++){
    var g=grainPts[i];
    var px=g.x*CW,py=g.y*CH;
    var dx=(g.x-.5)*2,dy=(g.y-.5)*2,distCenter=Math.sqrt(dx*dx+dy*dy);
    var centerMask=Math.min(1,Math.max(0,(distCenter-.28)/.35));
    var nodeMask=1.0;
    /* Probe own cell + 8 neighbours only. */
    var bgx=Math.floor(g.x*GRAIN_GX), bgy=Math.floor(g.y*GRAIN_GY);
    for(var oy=-1; oy<=1; oy++){
      var by=bgy+oy; if(by<0||by>=GRAIN_GY) continue;
      for(var ox2=-1; ox2<=1; ox2++){
        var bx=bgx+ox2; if(bx<0||bx>=GRAIN_GX) continue;
        var bucket=_grainBuckets[by*GRAIN_GX+bx];
        for(var b=0;b<bucket.length;b++){
          var n=bucket[b];
          var nx=px-n.x, ny=py-n.y, nd2=nx*nx+ny*ny;
          var zone=n.tier==='hub'?80:40, z2=zone*zone;
          if(nd2<z2){ var nd=Math.sqrt(nd2); var nm=nd/zone; if(nm<nodeMask) nodeMask=nm; }
        }
      }
    }
    var flicker=Math.abs(Math.sin(t*3.1+g.r*6.28+i*.0013));
    var a=MAX_A*g.r*centerMask*nodeMask*flicker;
    if(a<0.008)continue;
    var radius=.4+g.r*.8;
    ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);
    ctx.fillStyle='rgba(220,228,240,'+a.toFixed(3)+')';ctx.fill();
  }
  ctx.restore();
}

var glitch={active:false,timer:0,next:10+Math.random()*14,bands:[],duration:0,rgbShift:0};
function spawnGlitch(){glitch.active=true;glitch.duration=0.08+Math.random()*.18;glitch.timer=0;glitch.rgbShift=1.5+Math.random()*3.5;glitch.bands=[];var count=1+(Math.random()<.3?1:0);for(var i=0;i<count;i++){glitch.bands.push({y:Math.random()*CH,h:1+Math.random()*4,alpha:.06+Math.random()*.10,shift:(Math.random()-.5)*6});}}
function updGlitch(dt){if(!glitch.active){glitch.timer+=dt;if(glitch.timer>glitch.next){spawnGlitch();glitch.next=8+Math.random()*18;glitch.timer=0;}}else{glitch.timer+=dt;if(glitch.timer>glitch.duration){glitch.active=false;glitch.timer=0;}}}
function drawGlitch(){if(!glitch.active)return;var prog=glitch.timer/glitch.duration,fade=1-prog*prog;ctx.save();for(var i=0;i<glitch.bands.length;i++){var b=glitch.bands[i];ctx.fillStyle='rgba(180,220,255,'+(b.alpha*fade).toFixed(3)+')';ctx.fillRect(0,b.y,CW,b.h);ctx.fillStyle='rgba(255,80,80,'+(b.alpha*fade*.4).toFixed(3)+')';ctx.fillRect(b.shift,b.y-1,CW,1);ctx.fillStyle='rgba(80,180,255,'+(b.alpha*fade*.4).toFixed(3)+')';ctx.fillRect(-b.shift,b.y+b.h,CW,1);}if(fade>.5){var burstA=(fade-.5)*.05;ctx.fillStyle='rgba(200,215,235,'+burstA.toFixed(3)+')';for(var j=0;j<18;j++){ctx.fillRect(Math.random()*CW,Math.random()*CH,1+Math.random()*3,1);}}ctx.restore();}

var BLOOM_EL=document.getElementById('bg-bloom');
var _bloomLast = '';
var activitySmooth=0,activityPeak=0,peakDecay=0;
function computeActivity(){var sum=0,wt=0;for(var i=0;i<nodes.length;i++){var n=nodes[i];if(!n.discovered||n.dead)continue;var w=n.tier==='hub'?4.0:n.tier==='mid'?1.0:.2;sum+=n.glow*w;wt+=w;}var nodeAct=wt>0?sum/wt:0;var pulseBoost=Math.min(pulses.length*.012,.18);var ringBoost=Math.min(scanRings.length*.018,.14);var trBoost=Math.min(traceroutes.length*.022,.12);return Math.min(1.0,nodeAct+pulseBoost+ringBoost+trBoost);}
function updReactiveGlow(dt,t){
  /* Network activity drives the #bg-bloom layer (and only that — the window
     frame and titlebar are gone). The post-Luna brightness lift multiplies
     the bloom intensity via window.SITE._bgBoost (default 1.0, lifted to ~1.5
     when Luna arrives). The bloom anchors to whichever hub is brightest, so
     the glow visibly follows the most active part of the network.

     The DOM write here used to fire every frame — 60×/sec the browser had
     to re-parse a CSS gradient string and re-composite the layer. Now we
     quantize bx/by to 1 decimal, color channels to 8-unit steps, and alpha
     to 0.02 steps, then only write when the resulting string actually
     changes. Brings the write rate down to ~5–10×/sec in practice.       */
  var raw=computeActivity();
  var rise=raw>activitySmooth?4.5:.8;
  activitySmooth+=(raw-activitySmooth)*Math.min(1,dt*rise);
  if(raw>activityPeak){activityPeak=raw;peakDecay=0;}
  else{peakDecay+=dt*.9;activityPeak=Math.max(activitySmooth,activityPeak-peakDecay*dt);}
  var a=activitySmooth, p=Math.max(0,activityPeak-a);
  var hShift=Math.sin(t*.07)*.5+.5;
  var r=Math.round((40+hShift*25+a*30)/8)*8;
  var g=Math.round((70+hShift*30+a*20)/8)*8;
  var b=Math.round((160+hShift*35+a*40)/8)*8;
  var boost=window.SITE._bgBoost||1.0;
  var innerAlpha=(Math.round((0.08+a*.20+p*.18)*boost*ATMO_DIM*50)/50).toFixed(3);
  var bx=50,by=55,maxG=0;
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];
    if(n.tier==='hub'&&!n.dead&&n.glow>maxG){
      maxG=n.glow; bx=Math.round(n.x/CW*1000)/10; by=Math.round(n.y/CH*1000)/10;
    }
  }
  var s='radial-gradient(ellipse at '+bx+'% '+by+'%, rgba('+r+','+g+','+b+','+innerAlpha+') 0%, transparent 72%)';
  if(s !== _bloomLast){ BLOOM_EL.style.background = s; _bloomLast = s; }
}

function drawConstellationLines(){
  ctx.save();ctx.lineCap='round';
  /* Fiber-optic conduits: every revealed hub->mid link is drawn as TWO strokes
     over the same path — a wide, near-invisible CORE (the physical conduit)
     and a thin, bright, mechanically-dashed PULSE crawling down it like signal.
     Dash crawl is computed once per frame so all conduits pulse in sync —
     deliberate, not chaotic. Both layers still gate on `eased`, so the reveal
     interaction is preserved (nothing shows when the mouse is away). */
  var DASH=[12,4,2,4];                       // total length 22 — packet-interval rhythm
  var dashCrawl=-(U.uTime.value*46)%22;      // negative => crawls hub -> node
  for(var i=0;i<nodes.length;i++){
    var m=nodes[i];
    /* Iterate district nodes (the new "satellites"); look up the host hub
       via gravHub. Mids no longer exist but the rest of this draw code
       stays unchanged — the fiber-optic treatment now overlays the static
       mem-lines, reading as data flowing through wires.                    */
    if(m.tier!=='district'||m.dead||m.gravHub===undefined)continue;
    var hub=nodes[m.gravHub];
    if(!hub||hub.dead)continue;
    var reveal=Math.max(m.constellReveal||0,hub.constellReveal||0);
    if(reveal<0.003)continue;
    var eased=reveal*reveal*(3-2*reveal);
    var baseA=Math.min(0.11,0.04+hub.glow*0.09);
    var alpha=baseA*eased;
    if(alpha<0.003)continue;
    var cp=edgeCP(hub,m,i);
    if(!cp)continue;

    /* ── CORE — solid, wider, very faint. Reads as a tube, not a wire. ── */
    ctx.setLineDash([]);
    ctx.lineDashOffset=0;
    ctx.strokeStyle='rgba(150,170,205,'+sn(alpha*0.65).toFixed(4)+')';
    ctx.lineWidth=2.6;
    ctx.beginPath();ctx.moveTo(hub.x,hub.y);ctx.quadraticCurveTo(cp.x,cp.y,m.x,m.y);ctx.stroke();

    /* ── PULSE — thin, bright, mechanically dashed, crawling toward the node. ── */
    var pulseA=Math.min(alpha*2.6,0.42);
    var grad=lg(hub.x,hub.y,m.x,m.y);
    if(grad){
      var ea=sn(pulseA*1.15).toFixed(4),ma=sn(pulseA).toFixed(4);
      grad.addColorStop(0,'rgba(205,222,248,'+ea+')');
      grad.addColorStop(0.2,'rgba(195,210,235,'+ma+')');
      grad.addColorStop(0.8,'rgba(195,210,235,'+ma+')');
      grad.addColorStop(1,'rgba(205,222,248,'+ea+')');
      ctx.strokeStyle=grad;
    }else{ctx.strokeStyle='rgba(195,210,235,'+sn(pulseA).toFixed(4)+')';}
    ctx.setLineDash(DASH);
    ctx.lineDashOffset=dashCrawl;
    ctx.lineWidth=0.9+hub.glow*0.8;
    ctx.beginPath();ctx.moveTo(hub.x,hub.y);ctx.quadraticCurveTo(cp.x,cp.y,m.x,m.y);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.restore();
}

var bootSeq={active:false,queue:[],t:0,interval:0.35};
function startBootSeq(){bootSeq.active=true;bootSeq.queue=nodes.filter(function(n){return n.tier==='hub';}).sort(function(a,b){return a.id-b.id;});for(var i=0;i<bootSeq.queue.length;i++){var n=bootSeq.queue[i];n.glow=0;n.labelAlpha=0;n.typeIdx=0;n.label='';}}
function updBootSeq(dt){if(!bootSeq.active||bootSeq.queue.length===0)return;bootSeq.t+=dt;if(bootSeq.t<bootSeq.interval)return;bootSeq.t=0;var n=bootSeq.queue.shift();if(!n)return;n.tGlow=n.peak;n.typeIdx=0;n.label='';scanRings.push({x:n.x,y:n.y,r:n.baseR*2,alpha:.30,spd:.25,col:'185,200,230'});if(bootSeq.queue.length===0)bootSeq.active=false;}

var activePathGlows=[];
function addPathGlow(a,b){activePathGlows.push({ax:a.x,ay:a.y,bx:b.x,by:b.y,alpha:.55,life:.55});}
function updPathGlows(dt){for(var i=activePathGlows.length-1;i>=0;i--){activePathGlows[i].life-=dt*.28;activePathGlows[i].alpha=activePathGlows[i].life;if(activePathGlows[i].life<=0)activePathGlows.splice(i,1);}}
function drawPathGlows(){for(var i=0;i<activePathGlows.length;i++){var g=activePathGlows[i];var gl=lg(g.ax,g.ay,g.bx,g.by);if(!gl)continue;gl.addColorStop(0,'rgba(160,210,255,'+(g.alpha*.6).toFixed(3)+')');gl.addColorStop(0.5,'rgba(180,220,255,'+(g.alpha*.9).toFixed(3)+')');gl.addColorStop(1,'rgba(160,210,255,'+(g.alpha*.6).toFixed(3)+')');ctx.beginPath();ctx.moveTo(g.ax,g.ay);ctx.lineTo(g.bx,g.by);ctx.strokeStyle=gl;ctx.lineWidth=1.4;ctx.stroke();}}

var parallaxOX=0, parallaxOY=0;
window.SITE._setParallax=function(px,py){parallaxOX=px;parallaxOY=py;};
function drawStarsParallax(t){
  ctx.save();
  ctx.translate(parallaxOX*0.3, parallaxOY*0.3);
  /* Blit pre-rendered dust + galaxy (replaces ~221 arc/fill ops/frame
     plus 1 gradient allocation for the galaxy disc). */
  if(_staticLayer) ctx.drawImage(_staticLayer, 0, 0);
  /* Stars stay live — twinkle alpha animates per-frame. */
  for(var i=0;i<stars.length;i++){
    var s=stars[i];
    var twk=s.a*(0.7+0.3*Math.sin(t*s.spd+s.phase))*ATMO_DIM;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fillStyle='rgba(220,228,245,'+twk.toFixed(3)+')';ctx.fill();
  }
  ctx.restore();
}

/* drawGalaxy is now baked into _staticLayer — no-op kept for call-site
   compatibility so I don't have to touch every loop invocation. */
function drawGalaxy(){}

var afterglows=[];
function spawnAfterGlow(x,y){if(afterglows.length>40)return;afterglows.push({x:x,y:y,r:3,alpha:.45,life:.45});}
function updAfterGlows(dt){for(var i=afterglows.length-1;i>=0;i--){afterglows[i].r+=dt*12;afterglows[i].life-=dt*1.8;afterglows[i].alpha=afterglows[i].life;if(afterglows[i].life<=0)afterglows.splice(i,1);}}
function drawAfterGlows(){for(var i=0;i<afterglows.length;i++){var ag=afterglows[i];var g=rg(ag.x,ag.y,0,ag.x,ag.y,ag.r);if(!g)continue;g.addColorStop(0,'rgba(240,246,255,'+ag.alpha.toFixed(3)+')');g.addColorStop(1,'rgba(200,215,240,0)');ctx.beginPath();ctx.arc(ag.x,ag.y,ag.r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}}

var robberHit=0;
function triggerRobberHit(){ robberHit=0.35; }
function updBattleDamage(dt){if(robberHit>0)robberHit=Math.max(0,robberHit-dt);}
function robberDamageAlpha(){if(robberHit<=0)return 1;return 0.25+0.75*Math.abs(Math.sin(robberHit*60));}

var hubHitCount={}, hubOverload={};
function registerHubHit(node){var id=node.id;hubHitCount[id]=(hubHitCount[id]||0)+1;if(hubHitCount[id]>=3&&!hubOverload[id]){hubOverload[id]=2.0;hubHitCount[id]=0;}}
function updOverloads(dt){for(var k in hubOverload){hubOverload[k]-=dt;if(hubOverload[k]<=0)delete hubOverload[k];}for(var k in hubHitCount){hubHitCount[k]=Math.max(0,(hubHitCount[k]||0)-dt*.8);if(hubHitCount[k]<0.01) delete hubHitCount[k];}}
function getOverloadTint(node){var v=hubOverload[node.id];if(!v)return null;return Math.min(1,v);}

function checkWormholeTransit(ship){for(var i=0;i<wormholes.length;i++){var w=wormholes[i];var fade=Math.min(1,w.t*2)*Math.min(1,(w.maxLife-w.t)*2);if(fade<0.5)continue;var dA=Math.sqrt((ship.x-w.ax)*(ship.x-w.ax)+(ship.y-w.ay)*(ship.y-w.ay));var dB=Math.sqrt((ship.x-w.bx)*(ship.x-w.bx)+(ship.y-w.by)*(ship.y-w.by));if(dA<30){ship.x=w.bx; ship.y=w.by;ship.trail=[];scanRings.push({x:w.bx,y:w.by,r:8,alpha:.50,spd:.60,col:'200,220,255'});return;}if(dB<30){ship.x=w.ax; ship.y=w.ay;ship.trail=[];scanRings.push({x:w.ax,y:w.ay,r:8,alpha:.50,spd:.60,col:'200,220,255'});return;}if(dA<80){var f=(1-dA/80)*.004;ship.vx+=(w.ax-ship.x)/dA*f;ship.vy+=(w.ay-ship.y)/dA*f;}if(dB<80){var f=(1-dB/80)*.004;ship.vx+=(w.bx-ship.x)/dB*f;ship.vy+=(w.by-ship.y)/dB*f;}}}

function drawCorona(t){for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n.tier!=='hub'||n.dead||!n.discovered)continue;var pulse=0.4+0.6*Math.sin(t*0.38+n.phase*3.7);var r=n.baseR*(2.8+pulse*1.4);var a=(0.025+pulse*0.018)*n.glow;if(a<0.005)continue;var g=rg(n.x,n.y,0,n.x,n.y,r);if(!g)continue;g.addColorStop(0,'rgba(200,215,240,'+a.toFixed(4)+')');g.addColorStop(1,'rgba(160,185,220,0)');ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}}

/* ── INIT ── */
initNodes();
buildStars();
buildNebulae();
preloadMemLines();
initOrb();
resetSct();
initPatrols();
fleet1 = mkFleet(0);
fleet2 = mkFleet(4);
pickFleetTarget(fleet1);
pickFleetTarget(fleet2);
initWormhole();
ast.x=-80;ast.y=CH*.28;
/* Grain mask depends on node positions — must bake after initNodes. */
_bakeGrain();

/* ── MAIN LOOP ── */
var RM = REDUCED_MOTION;
/* This shared engine runs on About/Contact/Blog — none of which have
   index.astro's "Samuel Abhinav" name-reveal intro. index itself runs its
   nebula AND constellation only for a timed 6s intro flourish, then shuts
   both off permanently — its real resting background is just ships,
   satellites, grain, scanlines, dim and bloom, with no network-map geometry
   at all. The nebula runs here as a permanent ambient backdrop instead of a
   timed flourish (no intro to time a shutoff against), but the constellation
   (nodes, connector lines, IP-style labels) stays off, matching index's own
   actual resting state rather than a dimmed version of its intro-only look.
   Ships and satellites are unaffected either way and keep animating forever. */
var _constellationEnabled = false;
var _bgIntroOver = false;
/* Perf: cap the simulation to 30fps and fully pause when the tab is hidden,
   so this page stops competing for GPU/CPU with other tabs (e.g. video). */
var _FRAME_MIN = 1000/30, _frameLast = 0, _loopPaused = false, _frameErrs = 0;
function loop(ts){
  if(document.hidden){ _loopPaused = true; return; }
  requestAnimationFrame(loop);
  if(ts && (ts - _frameLast) < _FRAME_MIN) return;
  _frameLast = ts || 0;
  try{
    var rdt=Math.min(threeClock.getDelta(),0.05);   // real frame delta (seconds)
    var dt = rdt * BG_PACE;                          // scaled: slows ALL background motion
    var t  = U.uTime.value += dt;
    /* Feed the adaptive budget with the REAL frame time (ms), not the scaled
       one — otherwise the scaling would fool the perf tier system. */
    _budget.push(rdt * 1000);
    _budget.step(rdt);
    if(renderer && !_bgIntroOver) renderer.render();
    ctx.clearRect(0,0,CW,CH);
    ctx.lineCap='round';
    if(!_bgIntroOver){ drawNebulae(t);drawStarsParallax(t); }
    /* No crosshair grid here — it's a stark technical-grid overlay that reads
       fine under index's hero/tour cinematic but not against body copy. */
    updReveal(dt);
    if(!RM) updGlitch(dt);
    updReactiveGlow(dt,t);
    // GLOBAL constellation drift — the whole cluster wanders + gently tumbles as
    // one body about the field centre. Computed here so the node updates below can
    // inverse-map the cursor against it (keeps proximity reveal aligned).
    (function(){
      var gt=U.uTime.value*NET_GLOBAL_SPD;
      // organic 2-octave noise meander — walks a noise line per axis so the cluster
      // wanders in ALL directions and changes heading naturally (no one-way slide).
      // Centred on 0 (noise-0.5) so it drifts out and returns rather than escaping.
      _gDx=((vnoise3(gt*2.0,       0.0, 3.0)-0.5)*1.4 + (vnoise3(gt*4.6,       0.0, 9.0)-0.5)*0.6)*NET_GLOBAL_AMP;
      _gDy=((vnoise3(0.0, gt*2.0+11.0, 5.0)-0.5)*1.4 + (vnoise3(0.0, gt*4.2+3.0, 13.0)-0.5)*0.6)*NET_GLOBAL_AMP;
      _gRot=((vnoise3(gt*1.6, 7.0, 21.0)-0.5)*2.0)*(NET_GLOBAL_ROT*Math.PI/180);
      var dx=canvasMX-(BIO_CX+_gDx), dy=canvasMY-(BIO_CY+_gDy);
      var cr=Math.cos(-_gRot), sr=Math.sin(-_gRot);
      canvasMXt=BIO_CX+dx*cr-dy*sr; canvasMYt=BIO_CY+dx*sr+dy*cr;
    })();
    if(_constellationEnabled){ for(var i=0;i<nodes.length;i++) nodes[i].update(dt); }
    updMemLines(dt);updPulses(dt);updDS(dt);coolHeat(dt);
    updAutoPing(dt);updScanRings(dt);updTraceroutes(dt);
    updWormhole(dt);updIntrusions(dt);
    if(!RM){
      updChase(dt);
      updFleet(fleet1,dt);updFleet(fleet2,dt);
      updPatrol(patrol1,dt);updPatrol(patrol2,dt);
      updFreighter(dt);updProbe(dt);
      updAst(dt);updBigAst(dt);
      ssT+=dt;if(ssT>ssNext){spawnSS();ssNext=(12+Math.random()*14)*CALM;ssT=0;}updSS(dt);
      updMeteorShower(dt);
      updBattleDamage(dt);
    }
    updWan(dt);updOrb(dt);updSct(dt);
    updDeadSat(dt);updRelaySat(dt);
    updReticles(dt);
    updDataStorm(dt);
    updBootSeq(dt);
    updPathGlows(dt);
    updAfterGlows(dt);
    updOverloads(dt);
    // global constellation drift: translate + gently rotate the whole cluster
    // about the field centre. Only wraps the network map — ships, satellites and
    // the nebula are drawn outside this save(), so they stay put and the cluster
    // parallaxes against them.
    if(_constellationEnabled){
    ctx.save();
    ctx.globalAlpha = NET_QUIET;
    ctx.translate(BIO_CX+_gDx, BIO_CY+_gDy); ctx.rotate(_gRot); ctx.translate(-BIO_CX, -BIO_CY);
    drawGalaxy();
    drawConstellationLines();
    if(_budget.tier < 3) drawCorona(t);
    if(_budget.tier < 2) drawNebulaTrails();
    drawMemLines();drawBackbone();
    for(var i=0;i<nodes.length;i++) nodes[i].drawTrail();
    drawPathGlows();
    drawConns();drawPulses();drawDS();drawTraceroutes();drawScanRings();
    for(var i=0;i<nodes.length;i++) nodes[i].drawRings();
    for(var i=0;i<nodes.length;i++) nodes[i].drawHB(t);
    for(var i=0;i<nodes.length;i++) nodes[i].draw(t);
    drawIntrusions();drawReticles();
    ctx.restore();   /* end constellation drift transform */
    }
    if(!RM){
      drawChase();
      drawFleet(fleet1);drawFleet(fleet2);
      drawPatrol(patrol1);drawPatrol(patrol2);
      drawSlowShip(freighter,freighter.size,true);
      if(probe.active)drawSlowShip(probe,.8,false);
    }
    drawOrb();drawWan();drawSct();
    drawDeadSat();drawRelaySat();drawGeoSat();
    drawWormhole();
    if(!RM){
      drawAst();drawBigAst();drawSS();
      drawMeteorShower();
    }
    drawAfterGlows();
    if(!RM){
      drawGrain(t);
      if(_budget.tier < 1) drawGlitch();
    }
  }catch(e){
    /* A throw here recurs every frame; log the first few then go quiet so
       the console isn't flooded at 30fps. */
    if(_frameErrs < 5){ console.warn('Frame:',e.message,e.stack); _frameErrs++; }
    else if(_frameErrs === 5){ console.warn('Frame: further frame errors suppressed.'); _frameErrs++; }
  }
}
loop();
document.addEventListener('visibilitychange', function(){
  if(!document.hidden && _loopPaused){
    _loopPaused = false;
    if(typeof threeClock !== 'undefined' && threeClock.getDelta) threeClock.getDelta();
    _frameLast = 0;
    requestAnimationFrame(loop);
  }
});

/* Luna fade-in is now driven by the intro/portal sequence below — see the
   intro IIFE for the post-main-intro arrival choreography. */

window._softResize = function(){SW=window.innerWidth; SH=window.innerHeight;positionCanvases();};
window._alignCanvases = function(){};

/* Debounced full resize — recomputes CW/CH/OX/OY, resizes both canvases,
   rescales node positions proportionally, and rebuilds the absolute-pixel
   static layers (stars, dust, nebulae). Without this the network drifts
   off-screen the moment the window resizes. */
var _resizeT = null;
function _doResize(){
  var oldCW = CW, oldCH = CH;
  SW = window.innerWidth; SH = window.innerHeight;
  CW = SW * OVERSIZE; CH = SH * OVERSIZE;
  OX = -(CW - SW) / 2; OY = -(CH - SH) / 2;
  W = CW; H = CH;
  BIO_CX = CW / 2; BIO_CY = CH / 2;
  /* renderer is null whenever WebGL failed to initialise — a path this file
     explicitly supports (there's a no-op U shim for exactly that case). This
     line assumed it always existed, so the first resize on a machine without
     WebGL threw and took the whole resize handler down with it: canvases never
     resized, nodes never rescaled, network drifted off-screen. */
  if(renderer) renderer.setSize(SW, SH);
  if(U && U.uRes) U.uRes.value.set(SW, SH);
  canvas.width = CW; canvas.height = CH;
  var sx = CW / oldCW, sy = CH / oldCH;
  for(var i = 0; i < nodes.length; i++){
    nodes[i].x *= sx; nodes[i].y *= sy;
  }
  positionCanvases();
  buildStars();
  buildNebulae();
  /* Grain mask depends on node positions — rebake to match new layout. */
  _bakeGrain();
}
window.addEventListener('resize', function(){
  if(_resizeT) clearTimeout(_resizeT);
  _resizeT = setTimeout(_doResize, 200);
});

/* Debug namespace — single window handle for poking from devtools without
   relying on the dozens of bare globals. The bare globals are kept for
   back-compat; this just adds a cleaner introspection surface.            */
window.NS = {
  get nodes(){ return nodes; },
  get pulses(){ return pulses; },
  get traceroutes(){ return traceroutes; },
  get intrusions(){ return intrusions; },
  get fleet1(){ return fleet1; },
  get fleet2(){ return fleet2; },
  U: U, renderer: renderer,
  startBootSeq: startBootSeq,
  forcePing: function(hubIdx){ var n = nodes[hubIdx]; if(n && n.tier==='hub') n.ping(); },
  forceTraceroute: function(){ spawnTraceroute(); },
  reducedMotion: REDUCED_MOTION
};
