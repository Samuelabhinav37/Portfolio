/* ascii.cam widget for the footer (live luminance-ramp ASCII renderer). Extracted from an inline <script> block, unmodified. */
/* ascii.cam widget (footer) — same live luminance-ramp ASCII renderer used on
   the About page's skills card, ported in place of the old CRT recon map. */
(function(){
  var card=document.getElementById('footerAsciiCard'); if(!card)return;
  /* .crt (this widget's container) is display:none on phone/tablet
     (<=980px, see index.astro) — the live video decode + per-frame
     getImageData sampling is real CPU/GPU cost that shouldn't run behind a
     hidden element. Static at load: orientation changes on a phone don't
     cross the tablet boundary, so no resize listener is needed here. */
  if(matchMedia('(max-width:980px)').matches) return;
  var out=document.getElementById('footerAsciiOut'), stage=document.getElementById('footerAsciiStage'),
      vid=document.getElementById('footerAsciiVid'), samp=document.getElementById('footerAsciiSamp');
  var sctx=samp.getContext('2d',{willReadFrequently:true});
  var cols=(window.SITE&&window.SITE.LOW_POWER)?100:200, contrast=1.70, brightness=0, RAMP=' .:oO@', L=RAMP.length;
  var media=null, isVideo=false, visible=true, lastT=0, lastRows=0;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ visible=es[0].isIntersecting; }, {threshold:0});
    io.observe(card);
  }

  function fit(rows){
    var bw=stage.clientWidth, bh=stage.clientHeight;
    if(bw<2||bh<2)return;
    var fs=Math.max(1, Math.min(bw/(cols*0.6), bh/rows));
    out.style.fontSize=fs+'px'; out.style.lineHeight=fs+'px';
  }
  function dims(){ return isVideo?[vid.videoWidth,vid.videoHeight]:(media?[media.naturalWidth,media.naturalHeight]:[0,0]); }
  function render(){
    var d0=dims(), dw=d0[0], dh=d0[1];
    if(!dw||!dh) return;
    var rows=Math.max(1, Math.round(cols*(dh/dw)*0.52));
    if(samp.width!==cols||samp.height!==rows){ samp.width=cols; samp.height=rows; }
    if(rows!==lastRows){ fit(rows); lastRows=rows; }
    try{ sctx.drawImage(isVideo?vid:media, 0,0, cols,rows); }catch(e){ return; }
    var data; try{ data=sctx.getImageData(0,0,cols,rows).data; }catch(e){ return; }
    var s='';
    for(var y=0;y<rows;y++){
      for(var x=0;x<cols;x++){
        var i=(y*cols+x)*4;
        var lum=(0.299*data[i]+0.587*data[i+1]+0.114*data[i+2])/255;
        lum=(lum-0.5)*contrast+0.5+brightness;
        lum = lum<0?0:lum>1?1:lum;
        s+=RAMP[Math.min(L-1,(lum*L)|0)];
      }
      s+='\n';
    }
    out.textContent=s;
  }
  /* Reading video pixels back to the page (drawImage + getImageData, or
     VideoFrame.copyTo) makes the page wait for the graphics card on every
     frame: ~40% of the main thread while the footer was on screen. So where
     WebGL is available the whole render happens on the graphics card: the
     video is a texture, and a shader picks each cell's character from a
     small picture of the ramp. Same grid, ramp, contrast and font as
     render(), which stays as the fallback. */
  function glAscii(){
    var cv=document.createElement('canvas'), gl;
    try{ gl=cv.getContext('webgl',{alpha:false,antialias:false}); }catch(e){}
    if(!gl) return null;
    var dpr=Math.min(2, devicePixelRatio||1), gfs=0;
    // the ramp, one glyph per cell (the <pre>'s 0.6em x 1em), white on black,
    // drawn at the size it shows at so the browser's own text smoothing applies
    var at=document.createElement('canvas'), ac=at.getContext('2d');
    function glyphs(fs){
      if(fs) gfs=fs; if(!gfs) return;
      var GH=Math.max(2, Math.round(gfs)), GW=Math.max(2, Math.round(gfs*0.6));
      at.width=GW*L; at.height=GH;
      ac.fillStyle='#000'; ac.fillRect(0,0,at.width,GH);
      ac.fillStyle='#fff'; ac.font=gfs+"px 'JetBrains Mono','DejaVu Sans Mono',monospace"; ac.textAlign='center'; ac.textBaseline='middle';
      for(var k=0;k<L;k++) ac.fillText(RAMP[k], GW*k+GW/2, GH/2);
      gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,at);
    }
    var VS='attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
    var BG='vec3(.0196,.0196,.0235)'; // .ascii-stage #050506
    var FS='precision mediump float;varying vec2 v;uniform sampler2D vid,glyph;uniform vec2 grid;uniform vec4 box;uniform float con;'+
      'void main(){vec2 q=(vec2(v.x,1.-v.y)-box.xy)/box.zw;'+
      'if(q.x<0.||q.y<0.||q.x>=1.||q.y>=1.){gl_FragColor=vec4('+BG+',1.);return;}'+
      'vec2 c=q*grid,cell=floor(c);vec3 rgb=texture2D(vid,(cell+.5)/grid).rgb;'+
      'float lum=clamp((dot(rgb,vec3(.299,.587,.114))-.5)*con+.5,0.,1.);float i=min('+(L-1)+'.,floor(lum*'+L+'.));'+
      'float a=texture2D(glyph,vec2((i+fract(c.x))/'+L+'.,fract(c.y))).r;'+
      'gl_FragColor=vec4(mix('+BG+',vec3(.84),a),1.);}';
    function sh(t,src){ var s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); return s; }
    var pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(pr,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    function tex(unit){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
      [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(function(w){ gl.texParameteri(gl.TEXTURE_2D,w,gl.CLAMP_TO_EDGE); });
      [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(function(f){ gl.texParameteri(gl.TEXTURE_2D,f,gl.LINEAR); }); }
    tex(1);
    if(document.fonts&&document.fonts.load) document.fonts.load("10px 'JetBrains Mono'").then(function(){ glyphs(); }, function(){}); // redraw once the font is in
    tex(0);
    gl.uniform1i(gl.getUniformLocation(pr,'vid'),0); gl.uniform1i(gl.getUniformLocation(pr,'glyph'),1);
    gl.uniform1f(gl.getUniformLocation(pr,'con'),contrast);
    var uGrid=gl.getUniformLocation(pr,'grid'), uBox=gl.getUniformLocation(pr,'box'), sized=false;
    cv.setAttribute('aria-hidden','true');
    cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block';
    stage.appendChild(cv); out.style.display='none';
    function size(){
      var bw=stage.clientWidth, bh=stage.clientHeight, dw=vid.videoWidth, dh=vid.videoHeight;
      if(bw<2||bh<2||!dw) return false;
      cv.width=Math.round(bw*dpr); cv.height=Math.round(bh*dpr); gl.viewport(0,0,cv.width,cv.height);
      var rows=Math.max(1, Math.round(cols*(dh/dw)*0.52)), fs=Math.max(1, Math.min(bw/(cols*0.6), bh/rows));
      var w=cols*0.6*fs/bw, h=rows*fs/bh; // the text block's share of the stage, centred like the <pre>
      gl.uniform2f(uGrid,cols,rows); gl.uniform4f(uBox,(1-w)/2,(1-h)/2,w,h);
      glyphs(fs*dpr);
      return true;
    }
    return {
      draw:function(){
        if(!sized) sized=size();
        if(!sized) return;
        gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,vid);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      },
      resize:function(){ sized=false; }
    };
  }
  var glr=glAscii();
  if(glr) addEventListener('resize', function(){ glr.resize(); }, {passive:true});
  function loop(ts){
    if(!reduce && isVideo && media && visible && !document.hidden && !vid.paused && !vid.ended){
      if(ts-lastT>75){ if(glr) glr.draw(); else render(); lastT=ts; }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  /* fit() only reruns inside render() when the row count changes, which is
     driven by the source video's own aspect ratio and never changes after
     load — so the glyph grid was sized once for whatever box existed at
     first render and then stayed that size forever, overflowing/misaligning
     inside the CRT frame whenever the container later resizes (viewport
     resize, orientation change, or the .crt breakpoint swapping between the
     16:9/4:3 aspect ratios). Force a refit on both. */
  var _fitT;
  function refit(){ if(lastRows) fit(lastRows); }
  addEventListener('resize', function(){ clearTimeout(_fitT); _fitT=setTimeout(refit,120); }, {passive:true});
  addEventListener('orientationchange', refit);
  /* default clip — same baked-in flowers loop used on the About page widget */
  var DEFAULT_CLIP='/videos/ascii-default-clip.mp4';
  isVideo=true; media=vid;
  vid.addEventListener('loadeddata', function(){ lastRows=0; if(glr) glr.draw(); else render(); }, {once:true});
  vid.src=DEFAULT_CLIP;
  var p=vid.play();
  if(p && p.catch) p.catch(function(){
    var resume=function(){ vid.play().catch(function(){}); document.removeEventListener('pointerdown', resume); };
    document.addEventListener('pointerdown', resume);
  });
})();
