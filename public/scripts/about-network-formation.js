/* About page network card: eight nodes turning slowly, folding from one
   shape into the next while packets run between them. The picture is a
   40s video loop (scripts/bake-network.mjs); this only plays it while it's
   on screen and writes the log under it from the video's clock, so each
   line lands as its packet leaves. LOOP, SHAPES and CONVS must match the
   bake script. */
(function(){
  var v=document.querySelector('.c-signal .sig-rec');
  var logEl=document.getElementById('sig-log');
  if(!v||!logEl)return;
  var LOOP=40, SHAPES=['WOLF','SHIELD','LOCK','EYE'], EVERY=4, FIRST=1;
  var CONVS=[
    'GATEWAY got a new connection, asking FIREWALL if it\'s safe',
    'FIREWALL stopped a login, sending it to AUTH to verify',
    'AUTH asked DB: does this user exist?',
    'HOST·01 needs an address, asking DNS to look it up',
    'HOST·02 is sending a request through PROXY to stay hidden'
  ];
  var formEl=document.getElementById('sig-form'), latEl=document.getElementById('sig-lat');
  var start=performance.now();
  function pad2(n){return n<10?'0'+n:''+n;}
  function write(k){
    var s=Math.floor((performance.now()-start)/1000);
    var line=document.createElement('div'); line.className='sig-line';
    var ts=document.createElement('span'); ts.className='sig-ts'; ts.textContent=pad2(Math.floor(s/60))+':'+pad2(s%60);
    var msg=document.createElement('span'); msg.className='sig-msg'; msg.textContent=CONVS[k%CONVS.length];
    line.appendChild(ts); line.appendChild(msg); logEl.appendChild(line);
    while(logEl.children.length>4) logEl.removeChild(logEl.firstChild);
    for(var i=0,n=logEl.children.length;i<n;i++) logEl.children[i].style.opacity=(0.28+0.72*(i+1)/n).toFixed(2);
    if(latEl) latEl.textContent=(8+Math.floor(Math.random()*22))+'ms';
  }
  // every conversation that started in (a, b] of the loop, in order
  function between(a,b){ for(var k=0;k<LOOP/EVERY;k++){ var t0=FIRST+k*EVERY; if(t0>a&&t0<=b) write(k); } }
  var last=0;
  function tick(){
    var t=v.currentTime;
    if(t<last){ between(last,LOOP); between(-1,t); } else between(last,t); // wrapped round the loop
    last=t;
    if(formEl) formEl.textContent=SHAPES[Math.floor(t/(LOOP/SHAPES.length))%SHAPES.length];
  }
  v.addEventListener('timeupdate',tick);

  if(matchMedia('(prefers-reduced-motion: reduce)').matches||(window.SITE&&window.SITE.LOW_POWER)||!('IntersectionObserver' in window)){
    write(0); write(1); write(2); // a still picture (the poster) and a few lines
    return;
  }
  var seen=false;
  function go(){ if(seen&&!document.hidden){ var q=v.play(); if(q&&q.catch) q.catch(function(){}); } else v.pause(); }
  new IntersectionObserver(function(es){ seen=es[0].isIntersecting; go(); }).observe(v);
  document.addEventListener('visibilitychange',go);
})();
