/* About page network-formation diagram (#sig-canvas) — an unrelated widget
   that used to live bundled inside about-ascii-converter.js under a
   misleading filename; split out here for clarity and independent
   cacheability. Extracted verbatim, no behavior change. */
(function(){
  var canvas=document.getElementById('sig-canvas');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  /* On-screen gate: this canvas sits in the "signature" bento partway down a
     long page. Its per-frame node physics + edge/packet/glow render (and the
     1.6s fireConv interval that feeds it) ran the whole time the tab was
     visible, on-screen or not. Only run while it's near the viewport; the
     draw loop is (re)kicked by the IntersectionObserver below. */
  var _onScreen=true;
  var logEl=document.getElementById('sig-log');
  var startTime=Date.now();
  var NODE_NAMES=['GATEWAY','FIREWALL','AUTH','DNS','HOST·01','HOST·02','DB','PROXY'];
  var FORMATIONS=[
    {name:'WOLF',pts:[[0,-0.80,0],[-0.45,-0.30,0.20],[0.45,-0.30,0.20],[-0.30,0.10,0.30],[0.30,0.10,0.30],[0,0.40,0.40],[-0.50,0.80,-0.10],[0.50,0.80,-0.10]],edges:[[0,1],[0,2],[1,3],[2,4],[3,4],[3,5],[4,5],[5,6],[5,7],[6,7],[0,5]]},
    {name:'SHIELD',pts:[[0,-0.85,0],[-0.70,-0.40,-0.10],[0.70,-0.40,-0.10],[-0.80,0.20,0.10],[0.80,0.20,0.10],[-0.45,0.70,0.20],[0.45,0.70,0.20],[0,1.00,0]],edges:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6,7],[1,2],[3,4],[5,6]]},
    {name:'LOCK',pts:[[-0.30,-0.90,0.20],[0.30,-0.90,0.20],[-0.55,-0.40,0.10],[0.55,-0.40,0.10],[-0.70,0.10,-0.10],[0.70,0.10,-0.10],[-0.70,0.85,-0.10],[0.70,0.85,-0.10]],edges:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[4,6],[5,7],[6,7],[4,7],[5,6]]},
    {name:'EYE',pts:[[0,-0.80,0.10],[-0.90,0,0],[0.90,0,0],[0,0.80,0.10],[-0.42,-0.35,0.30],[0.42,-0.35,0.30],[0,0,0.65],[0,0,-0.40]],edges:[[0,4],[4,1],[1,6],[6,2],[2,5],[5,0],[4,5],[1,3],[3,2],[6,7],[0,6],[3,6]]},
  ];
  var CONVS=[
    {a:'GATEWAY',b:'FIREWALL',msgs:[function(a,b){return a+' got a new connection — asking '+b+' if it\'s safe';},]},
    {a:'FIREWALL',b:'AUTH',msgs:[function(a,b){return a+' stopped a login — sending it to '+b+' to verify';},]},
    {a:'AUTH',b:'DB',msgs:[function(a,b){return a+' asked '+b+' — does this user exist?';},]},
    {a:'HOST·01',b:'DNS',msgs:[function(a,b){return a+' needs an address — asking '+b+' to look it up';},]},
    {a:'HOST·02',b:'PROXY',msgs:[function(a,b){return a+' sending a request through '+b+' to stay hidden';},]},
  ];
  // LOW_POWER (narrow viewport, set in about.astro's own inline script) is
  // independent of an explicit reduced-motion preference — a mobile visitor
  // who never touched that OS setting should still get the lighter path.
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches || (window.SITE && window.SITE.LOW_POWER);
  var nodes=[],formIdx=0,rotY=0,rotX=0.28,morphT=1,morphStart=0,MORPH_DUR=2400,fromPts=[],toPts3d=[],packets=[],activeNodes={},activeEdges={};
  function pad2(n){return n<10?'0'+n:''+n;}
  function elapsed(){var s=Math.floor((Date.now()-startTime)/1000);return pad2(Math.floor(s/60))+':'+pad2(s%60);}
  function lerp(a,b,t){return a+(b-a)*t;}
  function ease(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function project(x3,y3,z3,W,H){var cosY=Math.cos(rotY),sinY=Math.sin(rotY),x1=x3*cosY+z3*sinY,z1=-x3*sinY+z3*cosY;var cosX=Math.cos(rotX),sinX=Math.sin(rotX),y2=y3*cosX-z1*sinX,z2=y3*sinX+z1*cosX;var fov=2.8,scale=fov/(fov+z2),range=Math.min(W,H)*0.62;return {sx:W/2+x1*range*scale,sy:H/2+y2*range*scale,depth:z2,scale:scale};}
  function init(){var f=FORMATIONS[0];nodes=NODE_NAMES.map(function(name,i){var p=f.pts[i];return {name:name,x:p[0],y:p[1],z:p[2],tx:p[0],ty:p[1],tz:p[2],phase:Math.random()*Math.PI*2,active:0};});fromPts=nodes.map(function(n){return[n.x,n.y,n.z];});toPts3d=fromPts.slice();var fl=document.getElementById('sig-form');if(fl)fl.textContent=f.name;if(!reduce)setInterval(function(){formIdx=(formIdx+1)%FORMATIONS.length;fromPts=nodes.map(function(n){return[n.tx,n.ty,n.tz];});toPts3d=FORMATIONS[formIdx].pts.map(function(p){return[p[0],p[1],p[2]];});morphT=0;morphStart=performance.now();var fl2=document.getElementById('sig-form');if(fl2)fl2.textContent=FORMATIONS[formIdx].name;},5500);}
  var convIdx=0;
  function fireConv(){if(!_onScreen)return;var conv=CONVS[convIdx%CONVS.length];convIdx++;var ai=NODE_NAMES.indexOf(conv.a),bi=NODE_NAMES.indexOf(conv.b);if(ai<0||bi<0)return;var msg=conv.msgs[0](conv.a,conv.b);activeNodes[ai]=1.0;activeNodes[bi]=0.7;activeEdges[ai+'-'+bi]=1;packets.push({a:ai,b:bi,t:0,speed:0.013+Math.random()*0.012});writeLog(msg);setTimeout(function(){activeNodes[ai]=0;},900);setTimeout(function(){activeNodes[bi]=0;delete activeEdges[ai+'-'+bi];},1400);}
  function writeLog(msg){if(!logEl)return;var line=document.createElement('div');line.className='sig-line';line.innerHTML='<span class="sig-ts">'+elapsed()+'</span><span class="sig-msg">'+msg+'</span>';logEl.appendChild(line);while(logEl.children.length>4)logEl.removeChild(logEl.firstChild);var n=logEl.children.length;for(var i=0;i<n;i++){logEl.children[i].style.opacity=(0.28+0.72*(i+1)/n).toFixed(2);}var latEl=document.getElementById('sig-lat');if(latEl)latEl.textContent=(8+Math.floor(Math.random()*22))+'ms';}
  function draw(){if(document.hidden||!_onScreen){if(!reduce&&_onScreen)requestAnimationFrame(draw);return;}var cw=canvas.clientWidth,chh=canvas.clientHeight;if(cw>10&&canvas.width!==cw){canvas.width=cw;}if(chh>10&&canvas.height!==chh){canvas.height=chh;}var W=canvas.width,H=canvas.height;if(W<=0||H<=0){if(!reduce&&_onScreen)requestAnimationFrame(draw);return;}ctx.clearRect(0,0,W,H);rotY+=0.006;var now=performance.now();if(morphT<1){morphT=Math.min(1,(now-morphStart)/MORPH_DUR);var te=ease(morphT);nodes.forEach(function(n,i){var fp=fromPts[i]||[0,0,0],tp=toPts3d[i]||[0,0,0];n.tx=lerp(fp[0],tp[0],te);n.ty=lerp(fp[1],tp[1],te);n.tz=lerp(fp[2],tp[2],te);});}
  nodes.forEach(function(n,i){n.phase+=0.010;n.x=n.tx+Math.sin(n.phase)*0.022;n.y=n.ty+Math.cos(n.phase*0.7)*0.018;n.z=n.tz+Math.sin(n.phase*0.5)*0.015;if(n.active>0)n.active*=0.93;var an=activeNodes[i];if(an)n.active=an;});
  var proj=nodes.map(function(n){return project(n.x,n.y,n.z,W,H);});
  FORMATIONS[formIdx].edges.map(function(e){return{e:e,d:(proj[e[0]].depth+proj[e[1]].depth)/2};}).sort(function(a,b){return a.d-b.d;}).forEach(function(se){var e=se.e,a=proj[e[0]],b=proj[e[1]],isAct=activeEdges[e[0]+'-'+e[1]]||0,df=0.10+(a.depth+b.depth+2)/4*0.22;ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(b.sx,b.sy);ctx.strokeStyle='rgba(255,255,255,'+Math.min(0.80,df+isAct*0.40).toFixed(3)+')';ctx.lineWidth=0.8+isAct*0.8;ctx.stroke();});
  if(packets.length)ctx.shadowColor='rgba(255,255,255,0.45)';
  packets.forEach(function(p){p.t+=p.speed;var a=proj[p.a],b=proj[p.b];var x=a.sx+(b.sx-a.sx)*p.t,y=a.sy+(b.sy-a.sy)*p.t,s=a.scale+(b.scale-a.scale)*p.t;for(var i=0;i<5;i++){var tp2=Math.max(0,p.t-i*0.025);ctx.beginPath();ctx.arc(a.sx+(b.sx-a.sx)*tp2,a.sy+(b.sy-a.sy)*tp2,1.5*s,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,'+(0.35*(1-i/5)).toFixed(3)+')';ctx.fill();}ctx.beginPath();ctx.arc(x,y,2.5*s,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.92)';ctx.shadowBlur=7;ctx.fill();ctx.shadowBlur=0;});
  packets=packets.filter(function(p){return p.t<1;});
  ctx.shadowColor='rgba(255,255,255,0.40)';
  nodes.map(function(n,i){return{n:n,p:proj[i],i:i};}).sort(function(a,b){return a.p.depth-b.p.depth;}).forEach(function(item){var n=item.n,p=item.p,glow=activeNodes[item.i]||0,r=(4+glow*2)*p.scale,da=0.20+(p.depth+1)/2*0.45;if(glow>0.05){ctx.beginPath();ctx.arc(p.sx,p.sy,r+5+glow*4,0,Math.PI*2);ctx.strokeStyle='rgba(255,255,255,'+(0.09*glow).toFixed(3)+')';ctx.lineWidth=1.5;ctx.stroke();}ctx.beginPath();ctx.arc(p.sx,p.sy,r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,'+Math.min(0.92,da+glow*0.40).toFixed(3)+')';if(glow>0.1){ctx.shadowBlur=10;}ctx.fill();ctx.shadowBlur=0;if(p.depth>-0.3){var la=Math.min(0.50,(p.depth+1)/2*0.30+glow*0.38);ctx.font=(5*p.scale+2)+'px JetBrains Mono,monospace';ctx.fillStyle='rgba(255,255,255,'+la.toFixed(3)+')';ctx.textAlign='center';ctx.fillText(n.name,p.sx,p.sy-r-3);}});
  if(!reduce&&_onScreen&&nodes.length)requestAnimationFrame(draw);}
  setTimeout(function(){
    init();
    draw();   // first paint — safe now that init() has populated nodes
    // Observer is wired AFTER init() so its callback can never call draw()
    // before nodes exist (that raced on the about page, where #sig-canvas is
    // in view on load — "Cannot read properties of undefined (reading 'depth')").
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        var vis=es[0].isIntersecting;
        if(vis&&!_onScreen){_onScreen=true;if(!reduce)requestAnimationFrame(draw);}
        else if(!vis){_onScreen=false;}
      },{rootMargin:'200px'}).observe(canvas);
    }
    if(!reduce){setTimeout(fireConv,400);setTimeout(fireConv,1100);setTimeout(fireConv,1900);setInterval(fireConv,1600);}
  },200);
})();
