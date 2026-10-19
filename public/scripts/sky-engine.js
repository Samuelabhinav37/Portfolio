/* Contact sky: night cloud banks drifting across a navy sky, three depths of
   GPU stars, and a small cast that flies in and out of the clouds.

   Touches no DOM, so the same code runs on the main thread or inside
   sky-worker.js on an OffscreenCanvas (contact-sky.js decides which). The
   page hands it two canvases and talks to it through handle(msg):
     { type:'size', w, h, dpr }     viewport in CSS px
     { type:'card', rect }          the form card in viewport px, or null
     { type:'running', on }         tab hidden/visible
     { type:'launch', ok }          the form sent (ok) or failed (!ok)

   Tiers, picked by the page:
     full   desktop: full-detail clouds, every member of the cast
     lite   phones/tablets: cheaper clouds, one satellite + shooting stars
     still  reduced motion: one rendered frame, no cast

   Depth: every flying thing has a z from 0 (far, above the clouds' far
   side) to 1 (near). The cloud density at its position is computed on the
   CPU with the shader's own noise, so far craft fade out inside thick cloud
   and come back out of it, while near craft stay in front. */
(function(root){
  'use strict';

  var TIERS = {
    full:  { res:.5,  oct:6, fps:30, aircraft:2, freighter:1, satellites:2, chase:true,  meteorGap:[25,55] },
    lite:  { res:.35, oct:4, fps:24, aircraft:0, freighter:0, satellites:1, chase:false, meteorGap:[35,75] },
    still: { res:.5,  oct:6, fps:0,  aircraft:0, freighter:0, satellites:0, chase:false, meteorGap:null }
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
    var W = 1, H = 1, DPR = 1, card = null, running = true;
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
    /* satellites: a steady point crossing in a straight line, far above
       the clouds, so they only show through the gaps; now and then one
       catches the sun and flares */
    function newSatellite(){
      var a = rnd(0, 6.2832), cx = W/2, cy = H/2, R = Math.hypot(W, H)/2 + 30;
      var tx = cx - Math.cos(a)*R + rnd(-W*.3, W*.3), ty = cy - Math.sin(a)*R + rnd(-H*.3, H*.3);
      var sx = cx + Math.cos(a)*R, sy = cy + Math.sin(a)*R, d = Math.hypot(tx-sx, ty-sy), spd = rnd(16, 26);
      return { x:sx, y:sy, vx:(tx-sx)/d*spd, vy:(ty-sy)/d*spd, life:0, dur:d/spd, flareAt: Math.random() < .4 ? rnd(.25,.75) : -1, a:0 };
    }

    var aircraft = [], freighters = [], sats = [], meteors = [], launches = [], sparks = [];
    var waitFreight = 0, waitSat = [], meteorIn = tier.meteorGap ? rnd(6, 14) : Infinity;
    function seed(){
      aircraft = []; freighters = []; sats = []; waitSat = [];
      for(var i=0;i<tier.aircraft;i++){ var a = newAircraft(); a.x = rnd(W*.05, W*.95); aircraft.push(a); }
      for(var j=0;j<tier.freighter;j++){ var f = newFreighter(); f.x = rnd(W*.1, W*.9); freighters.push(f); }
      for(var k=0;k<tier.satellites;k++){ var s = newSatellite(); s.life = rnd(0, s.dur*.6); s.x += s.vx*s.life; s.y += s.vy*s.life; sats.push(s); }
    }

    /* ── the chase: an occasional scene, not a constant ──
       A hacker running dark breaks out of a cloud, a defender follows a beat
       later, three shots, one hit, and the hacker dives back into the cloud.
       Flown along a curve through whichever margin the card leaves open. */
    var chase = null, chaseIn = tier.chase ? rnd(8, 14) : Infinity;
    function lanes(){
      var r = card || { x0:W*.5, y0:H*.5, x1:W*.5, y1:H*.5 }, L = [];
      if(r.y0 > 120) L.push({ p:[[-60, r.y0*.55], [W*.3, r.y0*.15], [W*.7, r.y0*.95], [W+60, r.y0*.45]] });
      if(H - r.y1 > 120){ var b = (H + r.y1)/2; L.push({ p:[[-60, b], [W*.35, b+50], [W*.65, b-50], [W+60, b+10]] }); }
      if(r.x0 > 170){ var lx = r.x0*.5; L.push({ p:[[lx-40, H+60], [lx+60, H*.65], [lx-60, H*.35], [lx+20, -60]] }); }
      if(W - r.x1 > 170){ var rx = (W + r.x1)/2; L.push({ p:[[rx+40, H+60], [rx-60, H*.6], [rx+60, H*.3], [rx-20, -60]] }); }
      if(!L.length) L.push({ p:[[-60, H*.12], [W*.3, H*.05], [W*.7, H*.2], [W+60, H*.1]] });
      var lane = L[Math.random()*L.length | 0];
      if(Math.random() < .5) lane.p.reverse();
      return lane.p;
    }
    function bez(P, u){
      var v = 1-u, a = v*v*v, b = 3*v*v*u, c = 3*v*u*u, d = u*u*u;
      return [a*P[0][0] + b*P[1][0] + c*P[2][0] + d*P[3][0], a*P[0][1] + b*P[1][1] + c*P[2][1] + d*P[3][1]];
    }
    function startChase(){
      var P = lanes(), len = 0, prev = P[0];
      for(var i=1;i<=20;i++){ var q = bez(P, i/20); len += Math.hypot(q[0]-prev[0], q[1]-prev[1]); prev = q; }
      chase = { P:P, t:0, dur: len/210, lag:1.25, shots:[.36, .47, .6], fired:0,
        hacker:{ role:'hacker', s:1.15, seed:.3, trail:[], a:0, flicker:0 },
        defender:{ role:'defender', s:1.05, seed:.7, trail:[], a:0 } };
    }
    function flyChaser(o, u, zCurve){
      var p = bez(chase.P, Math.min(1, Math.max(0, u))), q = bez(chase.P, Math.min(1, u + .01));
      o.ang = Math.atan2(q[1]-p[1], q[0]-p[0]); o.x = p[0]; o.y = p[1];
      o.z = zCurve(u);
      var fade = smooth(0, .04, u) * (1 - smooth(.96, 1, u));
      o.a = fade * seen(o.x, o.y, o.z);
    }
    function stepChase(dt, t){
      if(!chase){ chaseIn -= dt; if(chaseIn <= 0) startChase(); return; }
      chase.t += dt;
      var h = chase.hacker, d = chase.defender;
      var uh = chase.t / chase.dur, ud = (chase.t - chase.lag) / chase.dur;
      /* hacker: out of the cloud, run, then dive back in */
      flyChaser(h, uh, function(u){ return u < .18 ? .2 + u/.18*.7 : (u > .74 ? Math.max(.05, .9 - (u-.74)/.16*.85) : .9); });
      flyChaser(d, ud, function(u){ return u < .18 ? .3 + u/.18*.55 : .85; });
      if(h.flicker > 0) h.flicker -= dt;
      pushTrail(h, 26); pushTrail(d, 26);
      while(chase.fired < chase.shots.length && uh >= chase.shots[chase.fired] && ud > 0){
        var hit = chase.fired === chase.shots.length - 1;
        launches.push({ bolt:true, x0:d.x, y0:d.y, x1:h.x + (hit ? 0 : rnd(-26, 26)), y1:h.y + (hit ? 0 : rnd(-26, 26)), t:0, hit:hit });
        chase.fired++;
      }
      drawCraft(d, t); drawCraft(h, t);
      if(ud >= 1.02){ chase = null; chaseIn = rnd(70, 140); }
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
              if(chase) chase.hacker.flicker = .5;
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

      /* satellites first: they're the farthest thing */
      for(var i=0;i<sats.length;i++){
        var s = sats[i];
        if(!s){ waitSat[i] -= dt; if(waitSat[i] <= 0) sats[i] = newSatellite(); continue; }
        s.life += dt; s.x += s.vx*dt; s.y += s.vy*dt;
        var u = s.life/s.dur;
        if(u >= 1){ sats[i] = null; waitSat[i] = rnd(6, 20); continue; }
        var vis = seen(s.x, s.y, 0) * smooth(0, .04, u) * (1 - smooth(.96, 1, u));
        var flare = s.flareAt < 0 ? 0 : Math.exp(-Math.pow((u - s.flareAt)*s.dur/0.7, 2));
        glow(s.x, s.y, 2.4 + flare*11, '228,236,252', (.7 + flare*.3)*vis);
        if(vis > .02){ ctx.fillStyle = 'rgba(236,242,255,' + (.85*vis).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(s.x, s.y, .9 + flare*.8, 0, 6.2832); ctx.fill(); }
      }

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

      if(tier.chase) stepChase(dt, t);
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
        if(reseed) seed();
        if(!tier.fps) renderOnce();
      } else if(m.type === 'card'){
        card = m.rect;
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

  root.ContactSky = { create:create };
})(typeof self !== 'undefined' ? self : this);
