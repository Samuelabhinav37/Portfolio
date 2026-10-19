/* The site sky: night cloud banks drifting across a navy sky, three depths
   of GPU stars, and a small cast that flies in and out of the clouds. Every
   page's background (components/SkyBackground.astro boots it via sky.js).

   Touches no DOM, so the same code runs on the main thread or inside
   sky-worker.js on an OffscreenCanvas (sky.js decides which). The page
   hands it two canvases and talks to it through handle(msg):
     { type:'size', w, h, dpr }     viewport in CSS px
     { type:'card', rects }         the blocks the cast should fly around
                                    (cards, text), viewport px; the first is
                                    the one the contact courier launches from
     { type:'running', on }         tab hidden/visible
     { type:'launch', ok }          the contact form sent (ok) or failed (!ok)

   Tiers, picked by the page:
     full   desktop: full-detail clouds, two research satellites, the
            police/robber chase over two vaults (one a honeypot), meteors
     calm   desktop reading pages (the blog): the same clouds with one slow
            satellite and the odd shooting star, nothing chasing anything
     lite   phones/tablets: cheaper clouds, one satellite + shooting stars
     still  reduced motion: one rendered frame, no cast

   The cast was cut back on purpose (October 2026): ambient aircraft, the
   freighter and the satellite-to-satellite packets made the sky too busy
   behind text. Their code stays; raise aircraft / freighter / packets in a
   tier to bring them back.

   Depth: every flying thing has a z from 0 (far, above the clouds' far
   side) to 1 (near). The cloud density at its position is computed on the
   CPU with the shader's own noise, so far craft fade out inside thick cloud
   and come back out of it, while near craft stay in front. */
(function(root){
  'use strict';

  var TIERS = {
    full:  { res:.5,  oct:6, fps:30, aircraft:0, freighter:0, research:2, patrol:true,  vaults:2, packets:false, satSpeed:44, meteorGap:[25,55] },
    calm:  { res:.45, oct:5, fps:24, aircraft:0, freighter:0, research:1, patrol:false, vaults:0, packets:false, satSpeed:24, meteorGap:[45,90] },
    lite:  { res:.35, oct:4, fps:24, aircraft:0, freighter:0, research:1, patrol:false, vaults:0, packets:false, satSpeed:44, meteorGap:[35,75] },
    still: { res:.5,  oct:6, fps:0,  aircraft:0, freighter:0, research:0, patrol:false, vaults:0, packets:false, satSpeed:0,  meteorGap:null }
  };

  /* The "Night clouds" look from the workbench, frozen. */
  var LOOK = {
    deep:[.020,.035,.090], body:[.090,.141,.271], cloud:[.600,.659,.800], rim:[.875,.902,.961],
    scale:1.15, warp:.65, drift:1.4, vign:.9, bright:1,
    starDen:1, starSize:.9, starBright:.8, twinkle:.38, glow:.12, depth:1
  };

  /* ══════════ SKY SHADER ══════════ */
  function fragSrc(oct){
    return 'precision highp float;\n' +
    '#define OCT ' + oct + '\n' +
    'uniform float uTime; uniform vec2 uRes;\n' +
    'uniform vec3 uDeep,uBody,uCloud,uRim;\n' +
    'float h21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}\n' +
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);}\n' +
    'float fbm(vec2 p){float v=0.,a=.52,fr=1.;mat2 r=mat2(.877,.480,-.480,.877);for(int i=0;i<OCT;i++){v+=a*noise(p*fr);p=r*p;fr*=2.05;a*=.48;}return v;}\n' +
    /* one cell-grid star layer; a fraction of cells hold a jittered, twinkling star */
    'vec3 starLayer(vec2 p,float scale,float density,float t,float glowAmt){\n' +
    '  vec2 g=p*scale; vec2 id=floor(g); vec2 f=fract(g)-.5;\n' +
    '  float h=h21(id); if(h>density) return vec3(0.);\n' +
    '  vec2 o=vec2(h21(id+11.3),h21(id+27.1))-.5; float d=length(f-o*.8);\n' +
    '  float b=h21(id+5.7); float tw=' + (1-LOOK.twinkle).toFixed(3) + '+' + LOOK.twinkle.toFixed(3) + '*(.5+.5*sin(t*(.8+b*2.5)+b*60.));\n' +
    '  float core=smoothstep(' + (.1*LOOK.starSize).toFixed(3) + ',0.,d);\n' +
    '  float glow=exp(-d*' + (12/LOOK.starSize).toFixed(2) + ')*glowAmt*step(.80,b);\n' +
    '  float k=h21(id+41.9);\n' +
    '  vec3 tint=mix(vec3(.92,.95,1.), k<.5?vec3(.66,.78,1.):vec3(1.,.84,.66), abs(k-.5)*1.6);\n' +
    '  return tint*(core*(.35+.65*b)+glow)*tw;\n' +
    '}\n' +
    'vec3 stars(vec2 st,float t){\n' +
    '  vec3 c=vec3(0.);\n' +
    '  c+=.55*starLayer(st+vec2(t*.0030,0.),95.,' + (.12*LOOK.starDen).toFixed(3) + ',t,0.);\n' +
    '  c+=.85*starLayer(st+vec2(t*.0065,0.),48.,' + (.07*LOOK.starDen).toFixed(3) + ',t,' + LOOK.glow.toFixed(3) + ');\n' +
    '  c+=1.0*starLayer(st+vec2(t*.0130,0.),22.,' + (.045*LOOK.starDen).toFixed(3) + ',t,' + (LOOK.glow*1.4).toFixed(3) + ');\n' +
    '  return c*' + LOOK.starBright.toFixed(3) + ';\n' +
    '}\n' +
    'void main(){\n' +
    '  vec2 uv=gl_FragCoord.xy/uRes.xy; vec2 st=uv; st.x*=uRes.x/uRes.y;\n' +
    '  float t=uTime*.02*' + LOOK.drift.toFixed(3) + ';\n' +
    '  vec2 p=st*' + LOOK.scale.toFixed(3) + '+vec2(t*.55,0.);\n' +
    '  vec2 wq=vec2(fbm(p*1.7+t*.1),fbm(p*1.7+vec2(4.,2.)));\n' +
    '  vec2 pw=p+' + LOOK.warp.toFixed(3) + '*wq;\n' +
    '  float base=fbm(pw);\n' +
    '  float c=smoothstep(.44,.80,base);\n' +
    /* lit from the upper left: brighter where the density falls off that way */
    '  float shade=.78+3.2*(base-fbm(pw+vec2(.035,-.035)));\n' +
    '  vec3 sky=mix(uDeep,uBody,smoothstep(0.,1.,uv.y));\n' +
    '  vec3 cl=mix(uCloud,uRim,smoothstep(.95,1.25,shade));\n' +
    '  vec3 col=mix(sky,cl*clamp(shade,.45,1.25),c*.85)*' + LOOK.bright.toFixed(3) + ';\n' +
    '  vec2 v=uv-.5; col*=pow(clamp(1.-dot(v,v*' + LOOK.vign.toFixed(3) + '),0.,1.),.8);\n' +
    '  col+=stars(st,uTime)*(1.-c);\n' +
    '  gl_FragColor=vec4(clamp(col,0.,1.),1.);\n' +
    '}';
  }
  var VERT = 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }';

  /* ══════════ CPU twin of the cloud density ══════════
     Same maths as the shader so a craft fades exactly where a cloud is drawn. */
  function fract(x){ return x - Math.floor(x); }
  function h21(x, y){
    x = fract(x*234.34); y = fract(y*435.345);
    var d = x*(x+34.23) + y*(y+34.23); x += d; y += d;
    return fract(x*y);
  }
  function noise(x, y){
    var ix = Math.floor(x), iy = Math.floor(y), fx = x-ix, fy = y-iy;
    var ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    var a = h21(ix,iy), b = h21(ix+1,iy), c = h21(ix,iy+1), d = h21(ix+1,iy+1);
    return (a + (b-a)*ux) + ((c + (d-c)*ux) - (a + (b-a)*ux))*uy;
  }
  function fbm(x, y, oct){
    var v = 0, a = .52, fr = 1;
    for(var i=0;i<oct;i++){
      v += a*noise(x*fr, y*fr);
      var nx = .877*x - .480*y, ny = .480*x + .877*y; x = nx; y = ny;
      fr *= 2.05; a *= .48;
    }
    return v;
  }
  function smooth(e0, e1, x){ var t = Math.min(1, Math.max(0, (x-e0)/(e1-e0))); return t*t*(3-2*t); }

  function create(skyCanvas, fxCanvas, opts){
    var tier = TIERS[opts && opts.tier] || TIERS.full;
    var W = 1, H = 1, DPR = 1, card = null, zones = [], running = true;
    var sceneT = 40 + Math.random()*400;    /* a different sky on every visit */
    var raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : function(f){ return setTimeout(function(){ f(Date.now()); }, 1000/30); };

    /* ── GL ── */
    var gl = null, U = {};
    try{ gl = skyCanvas.getContext('webgl', { antialias:false, alpha:false, depth:false, stencil:false, preserveDrawingBuffer:false }); }catch(e){ gl = null; }
    if(gl){
      var mk = function(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.warn('sky shader:', gl.getShaderInfoLog(s)); return null; } return s; };
      var vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, fragSrc(tier.oct));
      if(vs && fs){
        var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
        if(gl.getProgramParameter(pr, gl.LINK_STATUS)){
          gl.useProgram(pr);
          var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
          var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          ['uTime','uRes','uDeep','uBody','uCloud','uRim'].forEach(function(n){ U[n] = gl.getUniformLocation(pr, n); });
          gl.uniform3fv(U.uDeep, LOOK.deep); gl.uniform3fv(U.uBody, LOOK.body);
          gl.uniform3fv(U.uCloud, LOOK.cloud); gl.uniform3fv(U.uRim, LOOK.rim);
        } else gl = null;
      } else gl = null;
    }
    var ctx = fxCanvas.getContext('2d');

    function drawSky(){
      if(!gl) return;
      gl.viewport(0, 0, skyCanvas.width, skyCanvas.height);
      gl.uniform1f(U.uTime, sceneT);
      gl.uniform2f(U.uRes, skyCanvas.width, skyCanvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /* cloud density 0..1 at a viewport point, matching the shader */
    function density(x, y){
      var u = x / W, v = 1 - y / H;
      var sx = u * (W/H), sy = v;
      var t = sceneT * .02 * LOOK.drift;
      var px = sx*LOOK.scale + t*.55, py = sy*LOOK.scale;
      var wx = fbm(px*1.7 + t*.1, py*1.7 + t*.1, tier.oct), wy = fbm(px*1.7 + 4, py*1.7 + 2, tier.oct);
      var base = fbm(px + LOOK.warp*wx, py + LOOK.warp*wy, tier.oct);
      return smooth(.44, .80, base) * .85;
    }
    /* how much of a craft at depth z shows through the cloud at (x,y) */
    function seen(x, y, z){
      if(x < -80 || y < -80 || x > W+80 || y > H+80) return 0;
      var d = density(x, y);
      return 1 - smooth(.08, .7, d) * (1 - z);
    }

    function rnd(a, b){ return a + Math.random()*(b-a); }
    function glow(x, y, r, rgb, a){
      if(a <= .003 || r <= 0) return;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    function pushTrail(o, max){ o.trail.push(o.x, o.y, o.a); while(o.trail.length > max*3) o.trail.splice(0, 3); }
    function drawTrail(o, rgb, maxA, width){
      var tr = o.trail, n = tr.length/3; if(n < 2) return;
      for(var i=1;i<n;i++){
        var f = i/n, a = f*f*maxA*tr[i*3+2];
        if(a < .004) continue;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
        ctx.lineWidth = f*width;
        ctx.beginPath(); ctx.moveTo(tr[(i-1)*3], tr[(i-1)*3+1]); ctx.lineTo(tr[i*3], tr[i*3+1]); ctx.stroke();
      }
    }

    /* ══════════ THE CAST ══════════ */

    /* An aircraft at night: a dark silhouette you only half see, red light on
       the left wingtip, green on the right, a white double-flash strobe and
       an engine glow. role: civil | defender | hacker (runs dark) | courier */
    var ENGINE = { civil:'255,206,160', defender:'150,200,255', hacker:'255,84,60', courier:'190,226,255' };
    function drawCraft(o, t){
      var a = o.a; if(a < .01) return;
      var s = o.s;
      drawTrail(o, o.role === 'hacker' ? '255,140,120' : '205,215,238', o.role === 'courier' ? .34 : .2, 1.3*s);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.ang);
      glow(-5.5*s, 0, (o.role === 'courier' ? 11 : 7)*s, ENGINE[o.role], (o.role === 'civil' ? .45 : .7)*a);
      ctx.beginPath();
      ctx.moveTo(7*s, 0); ctx.lineTo(1*s, -1*s); ctx.lineTo(-1.5*s, -5*s); ctx.lineTo(-3*s, -5*s); ctx.lineTo(-2.5*s, -1.2*s);
      ctx.lineTo(-5.5*s, -1*s); ctx.lineTo(-5.5*s, 1*s); ctx.lineTo(-2.5*s, 1.2*s); ctx.lineTo(-3*s, 5*s); ctx.lineTo(-1.5*s, 5*s);
      ctx.lineTo(1*s, 1*s); ctx.closePath();
      ctx.fillStyle = 'rgba(16,20,32,' + (.85*a).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = o.role === 'hacker' ? 'rgba(255,120,100,' + (.45*a).toFixed(3) + ')' : 'rgba(170,186,214,' + (.4*a).toFixed(3) + ')';
      ctx.lineWidth = .7; ctx.stroke();
      if(o.role !== 'hacker'){
        glow(-2.2*s, -5*s, 3.2*s, '255,70,70', .85*a);
        glow(-2.2*s,  5*s, 3.2*s, '80,255,140', .85*a);
        var ph = (t*.77 + o.seed) % 1;
        if(ph < .04 || (ph > .1 && ph < .14)) glow(-5.5*s, 0, 7*s, '255,255,255', a);
      } else if(o.flicker > 0 && (o.flicker*30 | 0) % 2){
        glow(0, 0, 14*s, '255,180,140', .7*a);
      }
      ctx.restore();
    }

    /* the freighter: long, slow, cabin lights, a slow red beacon on top */
    function drawFreighter(o, t){
      var a = o.a; if(a < .01) return;
      var s = o.s;
      ctx.save(); ctx.translate(o.x, o.y); if(o.vx < 0) ctx.scale(-1, 1);
      glow(-15*s, -1.2*s, 6*s, '255,196,150', .4*a); glow(-15*s, 1.2*s, 6*s, '255,196,150', .4*a);
      ctx.beginPath(); ctx.moveTo(13*s, 0); ctx.lineTo(9*s, -2.6*s); ctx.lineTo(-14*s, -2.6*s); ctx.lineTo(-14*s, 2.6*s); ctx.lineTo(9*s, 2.6*s); ctx.closePath();
      ctx.fillStyle = 'rgba(18,22,34,' + (.9*a).toFixed(3) + ')'; ctx.fill();
      ctx.strokeStyle = 'rgba(160,174,200,' + (.35*a).toFixed(3) + ')'; ctx.lineWidth = .7; ctx.stroke();
      for(var i=0;i<4;i++) glow((-8 + i*4.5)*s, 0, 1.6*s, '255,214,160', .7*a);
      var ph = (t*.62 + o.seed) % 1;
      glow(-2*s, -3.4*s, (ph < .12 ? 9 : 3)*s, '255,70,60', (ph < .12 ? .95 : .3)*a);
      ctx.restore();
    }

    /* aircraft crossing the sky at random depths */
    function newAircraft(){
      var z = rnd(.15, .95), dir = Math.random() < .5 ? 1 : -1, ang = rnd(-.35, .35);
      var spd = rnd(38, 64) * (.6 + z*.7);
      var o = { role:'civil', z:z, s:.7 + z*.6, seed:Math.random(), trail:[], a:0,
        x: dir > 0 ? -40 : W+40, y: rnd(H*.08, H*.92), vx: dir*Math.cos(ang)*spd, vy: Math.sin(ang)*spd, wait:0 };
      o.ang = Math.atan2(o.vy, o.vx);
      return o;
    }
    function newFreighter(){
      var dir = Math.random() < .5 ? 1 : -1;
      return { z:.3, s:1, seed:Math.random(), a:0, x: dir > 0 ? -60 : W+60, y: rnd(H*.12, H*.88), vx: dir*rnd(11,16), vy: rnd(-1.2,1.2) };
    }
    /* ── shared movement ──
       Everything that lives on screen (researchers, the patrol) steers toward
       a point with a little inertia and is held inside the viewport by a soft
       wall. In flight it passes behind the cards (pushing it round them made
       it bounce off every block on a busy page); only the places it stops at
       (scan spots, vaults, the robber's hideouts) are picked in open sky. */
    var TOP = 70;   /* clear of the site header */
    function zoneAt(x, y, pad){
      for(var i=0;i<zones.length;i++){ var z = zones[i]; if(x > z.x0-pad && x < z.x1+pad && y > z.y0-pad && y < z.y1+pad) return z; }
      return null;
    }
    function inCard(x, y, pad){ return !!zoneAt(x, y, pad); }
    function freeSpot(pad, from, minD){
      for(var i=0;i<40;i++){
        var x = rnd(44, W-44), y = rnd(TOP+24, H-44);
        if(inCard(x, y, pad)) continue;
        if(from && Math.hypot(x-from.x, y-from.y) < (minD || 0)) continue;
        return { x:x, y:y };
      }
      /* the card fills the screen (phones): settle for the side margins */
      return { x: Math.random() < .5 ? rnd(16, 40) : rnd(W-40, W-16), y: rnd(TOP+20, H-30) };
    }
    function steer(o, tx, ty, maxSpd, accel, dt){
      var dx = tx-o.x, dy = ty-o.y, d = Math.hypot(dx, dy) || 1;
      var want = Math.min(maxSpd, d*1.4), k = Math.min(1, accel*dt);
      o.vx += ((dx/d)*want - o.vx)*k; o.vy += ((dy/d)*want - o.vy)*k;
      var m = 34;
      if(o.x < m) o.vx += (m-o.x)*8*dt; else if(o.x > W-m) o.vx -= (o.x-(W-m))*8*dt;
      if(o.y < TOP) o.vy += (TOP-o.y)*8*dt; else if(o.y > H-m) o.vy -= (o.y-(H-m))*8*dt;
      o.x = Math.max(6, Math.min(W-6, o.x + o.vx*dt));
      o.y = Math.max(TOP-24, Math.min(H-6, o.y + o.vy*dt));
      if(Math.abs(o.vx) + Math.abs(o.vy) > 6) o.ang = Math.atan2(o.vy, o.vx);
      return d;
    }

    /* expanding rings: scans, handshakes, patches, honeypot alarms */
    var rings = [];
    function ring(x, y, rgb, r0, r1, life, w){ rings.push({ x:x, y:y, rgb:rgb, r0:r0, r1:r1, life:life, t:0, w:w || 1 }); }
    function stepRings(dt){
      for(var i=rings.length-1;i>=0;i--){
        var g = rings[i]; g.t += dt;
        var u = g.t/g.life; if(u >= 1){ rings.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(' + g.rgb + ',' + (.6*(1-u)).toFixed(3) + ')'; ctx.lineWidth = g.w;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r0 + (g.r1-g.r0)*(1 - (1-u)*(1-u)), 0, 6.2832); ctx.stroke();
      }
    }
    function mix3(a, b, u){ return Math.round(a[0]+(b[0]-a[0])*u) + ',' + Math.round(a[1]+(b[1]-a[1])*u) + ',' + Math.round(a[2]+(b[2]-a[2])*u); }
    var RED = [255,82,82], AMBER = [255,190,80], GREEN = [110,232,150];

    /* ── research satellites ──
       Each one flies to a fresh patch of sky, parks and sweeps it with a scan.
       Some sweeps turn up a bug, a red glitching mark. The satellite closes
       in and beams a patch at it: the mark goes amber, then green, a check
       pulses, and the satellite moves on to research somewhere else. */
    var researchers = [];
    function newResearcher(){
      var p = freeSpot(40);
      return { x:p.x, y:p.y, vx:0, vy:0, ang:0, rot:rnd(0, 6.28), spin:rnd(-.35, .35), state:'travel', t:0,
        tx:p.x, ty:p.y, bug:null, seed:Math.random() };
    }
    function nextSpot(r){ var p = freeSpot(50, r, 170); r.tx = p.x; r.ty = p.y; r.state = 'travel'; r.t = 0; }
    function drawSat(x, y, rot, lamp, lampOn){
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      glow(0, 0, 13, '170,205,255', .18);
      ctx.fillStyle = 'rgba(200,214,240,.92)'; ctx.fillRect(-3, -2.2, 6, 4.4);
      ctx.fillStyle = 'rgba(95,130,190,.85)'; ctx.fillRect(-12, -1.8, 7, 3.6); ctx.fillRect(5, -1.8, 7, 3.6);
      ctx.strokeStyle = 'rgba(170,200,245,.55)'; ctx.lineWidth = .6;
      ctx.strokeRect(-12, -1.8, 7, 3.6); ctx.strokeRect(5, -1.8, 7, 3.6);
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-3, 0); ctx.moveTo(3, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -2.2); ctx.lineTo(0, -5); ctx.stroke();
      ctx.restore();
      if(lampOn) glow(x + Math.cos(rot - 1.57)*5, y + Math.sin(rot - 1.57)*5, 4, lamp, .9);
    }
    function drawBug(b, t){
      var col = b.fix < .5 ? mix3(RED, AMBER, b.fix*2) : mix3(AMBER, GREEN, (b.fix-.5)*2);
      var jit = b.fix < .9 ? 1.4*(1-b.fix) : 0, jx = rnd(-jit, jit), jy = rnd(-jit, jit);
      glow(b.x, b.y, 12, col, .45);
      ctx.save(); ctx.translate(b.x + jx, b.y + jy);
      /* the bug: a little body with legs, flickering while it's live */
      if(b.fix < .98 && Math.random() < .15*(1-b.fix)){ ctx.translate(rnd(-3, 3), 0); }
      ctx.fillStyle = 'rgba(' + col + ',.95)';
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 4, 0, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(' + col + ',.85)'; ctx.lineWidth = .8; ctx.beginPath();
      for(var i=-1;i<=1;i++){ ctx.moveTo(-3, i*2.4); ctx.lineTo(-6, i*3.4 - 1); ctx.moveTo(3, i*2.4); ctx.lineTo(6, i*3.4 - 1); }
      ctx.moveTo(-1.2, -4); ctx.lineTo(-2.6, -6.4); ctx.moveTo(1.2, -4); ctx.lineTo(2.6, -6.4); ctx.stroke();
      ctx.restore();
      if(b.fix > 0 && b.fix < 1){
        ctx.strokeStyle = 'rgba(' + col + ',.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 11, -1.57, -1.57 + b.fix*6.2832); ctx.stroke();
      }
    }
    function stepResearcher(r, dt, t){
      r.t += dt; r.rot += r.spin*dt;
      var lamp = '120,200,255', on = ((t*1.3 + r.seed) % 1) < .1;
      if(r.state === 'travel'){
        if(steer(r, r.tx, r.ty, tier.satSpeed, 1.3, dt) < 5){ r.state = 'scan'; r.t = 0; r.scanDur = rnd(2.8, 4.4); }
      } else {
        var hx = r.state === 'fix' ? r.bug.x + (r.x - r.bug.x)*.5 : r.x, hy = r.state === 'fix' ? r.bug.y + (r.y - r.bug.y)*.5 - 6 : r.y;
        steer(r, r.state === 'fix' ? hx : r.x + r.vx*.1, r.state === 'fix' ? hy : r.y + r.vy*.1, 14, 2, dt);
      }
      if(r.state === 'scan'){
        /* radar sweep: a fading wedge chasing its leading edge */
        var a = r.t*2.6, R = 48;
        ctx.strokeStyle = 'rgba(140,200,255,.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r.x, r.y, R, 0, 6.2832); ctx.stroke();
        var g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, R);
        g.addColorStop(0, 'rgba(140,200,255,.0)'); g.addColorStop(1, 'rgba(140,200,255,.16)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.arc(r.x, r.y, R, a - .7, a); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(170,220,255,.5)'; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(a)*R, r.y + Math.sin(a)*R); ctx.stroke();
        lamp = '255,200,110'; on = ((t*2.4 + r.seed) % 1) < .3;
        if(r.t > r.scanDur){
          if(Math.random() < .62){
            var ba = rnd(0, 6.28), bd = rnd(24, 40), bx = r.x + Math.cos(ba)*bd, by = r.y + Math.sin(ba)*bd;
            if(inCard(bx, by, 8)){ bx = r.x - Math.cos(ba)*bd; by = r.y - Math.sin(ba)*bd; }
            r.bug = { x:bx, y:by, fix:0 }; r.state = 'found'; r.t = 0;
            ring(bx, by, '255,90,90', 4, 26, .9, 1.2);
          } else { r.state = 'clear'; r.t = 0; ring(r.x, r.y, '120,230,160', 6, 40, 1.1); }
        }
      } else if(r.state === 'found'){
        lamp = '255,80,80'; on = ((t*4 + r.seed) % 1) < .5;
        if(r.t > 1.2){ r.state = 'fix'; r.t = 0; r.fixDur = rnd(2.4, 3.6); }
      } else if(r.state === 'fix'){
        r.bug.fix = Math.min(1, r.t/r.fixDur);
        /* the patch beam: a crawling dashed line, red → green as the fix lands */
        var col = r.bug.fix < .5 ? mix3(RED, AMBER, r.bug.fix*2) : mix3(AMBER, GREEN, (r.bug.fix-.5)*2);
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -t*30;
        ctx.strokeStyle = 'rgba(' + col + ',.75)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.bug.x, r.bug.y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        lamp = col; on = true;
        if(r.bug.fix >= 1){ r.state = 'patched'; r.t = 0; ring(r.bug.x, r.bug.y, '110,232,150', 6, 34, 1, 1.4); }
      } else if(r.state === 'patched'){
        lamp = '110,232,150'; on = true;
        var u = Math.min(1, r.t/1.6), ca = 1 - u;
        ctx.strokeStyle = 'rgba(110,232,150,' + ca.toFixed(3) + ')'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(r.bug.x - 4, r.bug.y); ctx.lineTo(r.bug.x - 1, r.bug.y + 3); ctx.lineTo(r.bug.x + 5, r.bug.y - 4); ctx.stroke();
        if(r.t > 1.6){ r.bug = null; nextSpot(r); }
      } else if(r.state === 'clear'){
        lamp = '110,232,150'; on = true;
        if(r.t > 1.1) nextSpot(r);
      }
      if(r.bug && r.state !== 'patched') drawBug(r.bug, t);
      drawSat(r.x, r.y, r.rot, lamp, on);
    }

    /* ── encrypted packets ──
       Now and then two satellites open a secure link: a padlocked packet
       crosses between them and lands with a handshake pulse. */
    var packets = [], packetIn = rnd(4, 8);
    function stepPackets(dt){
      if(tier.packets && researchers.length > 1){
        packetIn -= dt;
        if(packetIn <= 0){
          packetIn = rnd(7, 13);
          var i = Math.random()*researchers.length | 0, j = (i + 1 + (Math.random()*(researchers.length-1) | 0)) % researchers.length;
          packets.push({ a:researchers[i], b:researchers[j], u:0 });
        }
      }
      for(var k=packets.length-1;k>=0;k--){
        var p = packets[k], d = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) || 1;
        p.u += dt*110/d;
        if(p.u >= 1){ ring(p.b.x, p.b.y, '120,220,255', 5, 22, .8); packets.splice(k, 1); continue; }
        var env = Math.min(1, p.u*6, (1-p.u)*6);
        ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(120,200,255,' + (.18*env).toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke(); ctx.setLineDash([]);
        var x = p.a.x + (p.b.x - p.a.x)*p.u, y = p.a.y + (p.b.y - p.a.y)*p.u;
        glow(x, y, 9, '120,220,255', .45);
        ctx.fillStyle = 'rgba(200,240,255,.95)'; ctx.fillRect(x - 3, y - 1, 6, 5);
        ctx.strokeStyle = 'rgba(200,240,255,.95)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(x, y - 1, 2.2, 3.1416, 0); ctx.stroke();
      }
    }

    /* ── data vaults, the firewall and the honeypot ──
       Small locked nodes the robber goes after. Hitting one throws up a
       firewall hex; one of them is secretly a honeypot, which flashes amber
       and tags the robber so the cop closes in faster. */
    var vaults = [];
    function placeVaults(){
      vaults = [];
      for(var i=0;i<tier.vaults;i++){
        var p = null;
        for(var k=0;k<30;k++){
          var q = freeSpot(70);
          if(vaults.every(function(v){ return Math.hypot(v.x - q.x, v.y - q.y) > 200; })){ p = q; break; }
          p = p || q;
        }
        vaults.push({ x:p.x, y:p.y, honey:false, hit:0, shield:0, reveal:0, down:0 });
      }
      vaults[Math.random()*vaults.length | 0].honey = true;
    }
    function hexPath(x, y, r){
      ctx.beginPath();
      for(var i=0;i<6;i++){ var a = i*1.0472 + .5236; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a)*r, y + Math.sin(a)*r); }
      ctx.closePath();
    }
    function drawVault(v, t, dt){
      var wasDown = v.down > 0;
      v.shield = Math.max(0, v.shield - dt*.8); v.reveal = Math.max(0, v.reveal - dt*.35); v.down = Math.max(0, v.down - dt);
      if(wasDown && v.down === 0) ring(v.x, v.y, '110,232,150', 6, 26, .8);   /* restored */
      var col = v.reveal > 0 ? '255,190,80' : (v.down > 0 ? '255,96,96' : '130,200,255');
      var pulse = .55 + .25*Math.sin(t*1.6 + v.x);
      glow(v.x, v.y, 14, col, .22*pulse + (v.hit > 0 ? .25 : 0));
      ctx.strokeStyle = 'rgba(' + col + ',' + (.7*pulse + .2).toFixed(3) + ')'; ctx.lineWidth = 1;
      hexPath(v.x, v.y, 7); ctx.stroke();
      /* the lock inside */
      ctx.fillStyle = 'rgba(' + col + ',.9)'; ctx.fillRect(v.x - 2, v.y - .5, 4, 3.2);
      ctx.beginPath(); ctx.arc(v.x, v.y - .6, 1.5, 3.1416, 0); ctx.strokeStyle = 'rgba(' + col + ',.9)'; ctx.lineWidth = .9; ctx.stroke();
      if(v.shield > 0){
        ctx.strokeStyle = 'rgba(120,210,255,' + (.75*v.shield).toFixed(3) + ')'; ctx.lineWidth = 1.4;
        hexPath(v.x, v.y, 18 + (1-v.shield)*6); ctx.stroke();
      }
    }

    /* ── the patrol: police and robber, always on screen ──
       The robber prowls from vault to vault trying to breach them; the cop
       hunts it, fires when it's in range, and a hit sends the robber
       running. Both stay inside the viewport and go round the card. */
    var robber = null, cop = null;
    function newPatrol(){
      var a = freeSpot(40), b = freeSpot(40, a, 260);
      robber = { role:'hacker', x:a.x, y:a.y, vx:0, vy:0, ang:0, s:1.15, seed:.3, trail:[], a:1, flicker:0,
        state:'prowl', t:0, target:null, tx:a.x, ty:a.y, tagged:0 };
      cop = { role:'defender', x:b.x, y:b.y, vx:0, vy:0, ang:0, s:1.05, seed:.7, trail:[], a:1, cd:2 };
    }
    function robberPickVault(){
      var options = vaults.filter(function(v){ return v.down <= 0 && v !== robber.target; });
      robber.target = options.length ? options[Math.random()*options.length | 0] : null;
      if(robber.target){ robber.state = 'prowl'; } else { var p = freeSpot(50); robber.tx = p.x; robber.ty = p.y; robber.state = 'roam'; }
      robber.t = 0;
    }
    function robberFlee(){
      var best = null, bd = -1;
      for(var i=0;i<6;i++){ var p = freeSpot(50), d = Math.hypot(p.x - cop.x, p.y - cop.y); if(d > bd){ bd = d; best = p; } }
      robber.tx = best.x; robber.ty = best.y; robber.state = 'flee'; robber.t = 0; robber.target = null;
    }
    function stepPatrol(dt, t){
      var R = robber, C = cop;
      R.t += dt; R.flicker = Math.max(0, R.flicker - dt); R.tagged = Math.max(0, R.tagged - dt);
      var rSpd = R.tagged > 0 ? 72 : 98, cSpd = R.tagged > 0 ? 112 : 86;
      if(R.state === 'prowl' && R.target){
        var v = R.target;
        if(steer(R, v.x + Math.cos(t*.8)*20, v.y + Math.sin(t*.8)*20, rSpd, 1.6, dt) < 30 || Math.hypot(R.x - v.x, R.y - v.y) < 30){
          R.state = 'breach'; R.t = 0; v.shield = 1;
          if(v.honey){ v.reveal = 1; R.tagged = 9; ring(v.x, v.y, '255,190,80', 8, 60, 1.4, 1.6); ring(v.x, v.y, '255,190,80', 4, 40, 1, 1); }
        }
      } else if(R.state === 'breach'){
        var w = R.target;
        steer(R, w.x + Math.cos(t*2)*22, w.y + Math.sin(t*2)*22, 40, 2.2, dt);
        w.hit = 1;
        /* the siphon: a jittery red line pulling from the vault */
        ctx.setLineDash([2, 3]); ctx.lineDashOffset = t*40;
        ctx.strokeStyle = 'rgba(255,90,80,' + (.5 + .3*Math.random()).toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(R.x, R.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
        if(Math.hypot(C.x - R.x, C.y - R.y) < 130 || w.honey && R.t > .8){ w.hit = 0; robberFlee(); }
        else if(R.t > 2.8){ w.hit = 0; w.down = 10; robberPickVault(); }
      } else {
        if(steer(R, R.tx, R.ty, R.state === 'flee' ? rSpd*1.2 : rSpd, 1.6, dt) < 24) robberPickVault();
      }
      if(!R.target && R.state === 'prowl') robberPickVault();

      /* the cop leads its target a little and keeps a short standoff */
      var px = R.x + R.vx*.6, py = R.y + R.vy*.6, dRC = Math.hypot(C.x - R.x, C.y - R.y);
      steer(C, dRC < 70 ? C.x + (C.x - R.x)*.3 : px, dRC < 70 ? C.y + (C.y - R.y)*.3 : py, cSpd, 1.4, dt);
      C.cd -= dt;
      if(C.cd <= 0 && dRC < 240){
        C.cd = rnd(1.6, 2.8);
        var hit = Math.random() < (R.tagged > 0 ? .75 : .45);
        launches.push({ bolt:true, x0:C.x, y0:C.y, x1:R.x + (hit ? 0 : rnd(-24, 24)), y1:R.y + (hit ? 0 : rnd(-24, 24)), t:0, hit:hit });
      }
      pushTrail(R, 26); pushTrail(C, 26);
      if(R.tagged > 0){
        /* tagged by the honeypot: a red reticle rides with the robber */
        var rs = 15, ra = t*1.5;
        ctx.save(); ctx.translate(R.x, R.y); ctx.rotate(ra);
        ctx.strokeStyle = 'rgba(255,110,90,' + Math.min(.8, R.tagged*.3).toFixed(3) + ')'; ctx.lineWidth = 1;
        for(var q=0;q<4;q++){ ctx.rotate(1.5708); ctx.beginPath(); ctx.moveTo(rs, -5); ctx.lineTo(rs, -rs); ctx.lineTo(5, -rs); ctx.stroke(); }
        ctx.restore();
      }
      drawCraft(C, t); drawCraft(R, t);
    }

    var aircraft = [], freighters = [], meteors = [], launches = [], sparks = [];
    var waitFreight = 0, meteorIn = tier.meteorGap ? rnd(6, 14) : Infinity;
    function seed(){
      aircraft = []; freighters = []; researchers = []; vaults = []; packets = [];
      for(var i=0;i<tier.aircraft;i++){ var a = newAircraft(); a.x = rnd(W*.05, W*.95); aircraft.push(a); }
      for(var j=0;j<tier.freighter;j++){ var f = newFreighter(); f.x = rnd(W*.1, W*.9); freighters.push(f); }
      for(var k=0;k<tier.research;k++) researchers.push(newResearcher());
      if(tier.patrol) newPatrol();
    }

    /* ── the courier: the form's message leaving (or bouncing) ── */
    function launch(ok){
      var r = card || { x0:W*.4, y0:H*.75, x1:W*.6, y1:H*.8 };
      /* lift off beside the card, low down, so the whole climb is in open
         sky; on a phone the card fills the width, so rise from its top */
      var side = W - r.x1 > 120, x0 = side ? r.x1 + Math.min(80, (W - r.x1)/2) : (r.x0 + r.x1)/2;
      var y0 = side ? Math.min(H - 40, r.y1 - 70) : r.y0 + 14;
      launches.push({ courier:true, ok:ok, t:0, x0:x0, y0:y0,
        o:{ role:'courier', s:1.25, seed:.1, trail:[], a:0 } });
    }
    function stepLaunches(dt, t){
      for(var i=launches.length-1;i>=0;i--){
        var L = launches[i]; L.t += dt;
        if(L.bolt){
          /* a laser bolt: a short bright dash flying defender -> target */
          var k = Math.min(1, L.t/.2), bx = L.x0 + (L.x1-L.x0)*k, by = L.y0 + (L.y1-L.y0)*k;
          var tx = L.x0 + (L.x1-L.x0)*Math.max(0, k-.35), ty = L.y0 + (L.y1-L.y0)*Math.max(0, k-.35);
          ctx.strokeStyle = 'rgba(200,228,255,.9)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();
          glow(bx, by, 6, '170,215,255', .6);
          if(k >= 1){
            if(L.hit){
              if(robber){ robber.flicker = .5; robberFlee(); }
              for(var s=0;s<9;s++){ var an = rnd(0, 6.2832), sp = rnd(30, 110); sparks.push({ x:L.x1, y:L.y1, vx:Math.cos(an)*sp, vy:Math.sin(an)*sp, life:rnd(.35,.7) }); }
            }
            launches.splice(i, 1);
          }
          continue;
        }
        var o = L.o, T = L.t, x, y, dx, dy;
        if(L.ok){
          /* climbs, accelerating, drifting sideways, and shrinks into the far clouds */
          y = L.y0 - (34*T + 46*T*T); x = L.x0 + Math.sin(T*.9)*38*T;
          dy = -(34 + 92*T); dx = 38*(Math.sin(T*.9) + T*.9*Math.cos(T*.9));
          o.z = Math.max(.05, 1 - T/3.4);
          o.s = 1.25 - (1 - o.z)*.55;
        } else {
          /* lifts off, falters, and turns back down behind the card */
          var D = 2.8, u = Math.min(1, T/D);
          y = L.y0 - Math.sin(u*Math.PI)*95; x = L.x0 + Math.sin(u*Math.PI*2)*30;
          dy = -Math.cos(u*Math.PI)*95*Math.PI/D; dx = Math.cos(u*Math.PI*2)*30*Math.PI*2/D;
          o.z = 1; o.s = 1.2;
        }
        o.x = x; o.y = y; o.ang = Math.atan2(dy, dx);
        o.a = smooth(0, .25, T) * seen(x, y, o.z) * (L.ok ? 1 : 1 - smooth(.85, 1, T/2.8));
        pushTrail(o, 40);
        drawCraft(o, t);
        if((L.ok && (y < -60 || T > 7)) || (!L.ok && T > 2.8)) launches.splice(i, 1);
      }
      for(var j=sparks.length-1;j>=0;j--){
        var p = sparks[j]; p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= .94; p.vy *= .94;
        if(p.life <= 0){ sparks.splice(j, 1); continue; }
        glow(p.x, p.y, 3.5, '255,190,140', Math.min(1, p.life*1.6));
      }
    }

    function stepCast(dt, t){
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';

      /* shooting stars, also far: they vanish into cloud */
      if(tier.meteorGap){
        meteorIn -= dt;
        if(meteorIn <= 0){
          meteorIn = rnd(tier.meteorGap[0], tier.meteorGap[1]);
          var dir = Math.random() < .5 ? 1 : -1, an = rnd(.35, .6), sp = rnd(520, 720);
          meteors.push({ x:rnd(W*.1, W*.9), y:rnd(-10, H*.35), vx:dir*Math.cos(an)*sp, vy:Math.sin(an)*sp, life:rnd(.6, .9), t:0 });
        }
        for(var m=meteors.length-1;m>=0;m--){
          var me = meteors[m]; me.t += dt; me.x += me.vx*dt; me.y += me.vy*dt;
          if(me.t >= me.life){ meteors.splice(m, 1); continue; }
          var k = me.t/me.life, ma = Math.sin(k*Math.PI) * seen(me.x, me.y, 0), len = .16;
          var tx = me.x - me.vx*len, ty = me.y - me.vy*len;
          var g = ctx.createLinearGradient(tx, ty, me.x, me.y);
          g.addColorStop(0, 'rgba(240,246,255,0)'); g.addColorStop(1, 'rgba(240,246,255,' + (.85*ma).toFixed(3) + ')');
          ctx.strokeStyle = g; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(me.x, me.y); ctx.stroke();
          glow(me.x, me.y, 4, '240,246,255', .5*ma);
        }
      }

      for(var f=0;f<freighters.length;f++){
        var fr = freighters[f];
        if(!fr){ waitFreight -= dt; if(waitFreight <= 0) freighters[f] = newFreighter(); continue; }
        fr.x += fr.vx*dt; fr.y += fr.vy*dt;
        fr.a = seen(fr.x, fr.y, fr.z);
        drawFreighter(fr, t);
        if(fr.x < -90 || fr.x > W+90){ freighters[f] = null; waitFreight = rnd(15, 40); }
      }

      /* ambient aircraft, sorted far to near so near ones draw on top */
      aircraft.sort(function(a, b){ return a.z - b.z; });
      for(var c=0;c<aircraft.length;c++){
        var o = aircraft[c];
        if(o.gone){ o.gone -= dt; if(o.gone <= 0) aircraft[c] = newAircraft(); continue; }
        o.x += o.vx*dt; o.y += o.vy*dt;
        o.a = seen(o.x, o.y, o.z) * smooth(-40, 10, Math.min(o.x, W - o.x));
        pushTrail(o, 22);
        drawCraft(o, t);
        if(o.x < -60 || o.x > W+60 || o.y < -60 || o.y > H+60) o.gone = rnd(4, 14);
      }

      /* the security layer, nearest of all: it never hides in cloud */
      if(tier.patrol && tier.vaults && !vaults.length && (card || t > 1.5)) placeVaults();
      for(var v=0;v<vaults.length;v++) drawVault(vaults[v], t, dt);
      stepPackets(dt);
      for(var r=0;r<researchers.length;r++) stepResearcher(researchers[r], dt, t);
      stepRings(dt);
      if(robber && vaults.length) stepPatrol(dt, t);
      stepLaunches(dt, t);
    }

    /* ══════════ LOOP ══════════ */
    var last = 0, frameMin = tier.fps ? 1000/tier.fps : 0, scheduled = false;
    function frame(now){
      scheduled = false;
      if(!running) return;
      if(tier.fps){ schedule(); if(last && now - last < frameMin - 1) return; }
      var dt = last ? Math.min((now - last)/1000, .1) : 0; last = now;
      sceneT += dt * .55;                     /* the site's background pace */
      drawSky();
      if(tier.fps) stepCast(dt, sceneT);
    }
    function schedule(){ if(!scheduled){ scheduled = true; raf(frame); } }
    function renderOnce(){ drawSky(); if(ctx){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); } }

    function handle(m){
      if(m.type === 'size'){
        var reseed = W === 1;
        W = Math.max(1, m.w); H = Math.max(1, m.h); DPR = Math.min(m.dpr || 1, tier === TIERS.full ? 2 : 1.5);
        var q = Math.min(m.dpr || 1, 1.5) * tier.res;
        skyCanvas.width = Math.max(2, Math.round(W*q)); skyCanvas.height = Math.max(2, Math.round(H*q));
        fxCanvas.width = Math.round(W*DPR); fxCanvas.height = Math.round(H*DPR);
        if(reseed) seed(); else vaults = [];   /* re-place vaults for the new layout */
        if(!tier.fps) renderOnce();
      } else if(m.type === 'card'){
        zones = m.rects || (m.rect ? [m.rect] : []);
        card = zones[0] || null;
        /* a vault the card now covers (scroll, resize) moves to open sky */
        for(var i=0;i<vaults.length;i++) if(inCard(vaults[i].x, vaults[i].y, 30)){ var p = freeSpot(70); vaults[i].x = p.x; vaults[i].y = p.y; }
      } else if(m.type === 'running'){
        running = !!m.on; last = 0;
        if(running && tier.fps) schedule();
      } else if(m.type === 'launch'){
        if(tier.fps) launch(!!m.ok);
      }
    }
    if(tier.fps) schedule();

    return { handle:handle, hasGL:!!gl };
  }

  root.SiteSky = { create:create };
})(typeof self !== 'undefined' ? self : this);
