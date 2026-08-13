/* About page ASCII-art video converter (middle card), continuous rAF loop.
   Extracted from an inline <script> block. Same widget/renderer as the
   footer's index-ascii-footer.js, different element IDs. */
(function(){
  var card=document.getElementById('asciiCard'); if(!card)return;
  /* .c-skills (this widget's whole card) is display:none on phone/tablet
     (<=900px, see about.astro) — the live video decode + per-frame
     getImageData sampling is real CPU/GPU cost that shouldn't run behind a
     hidden element. Matches index-ascii-footer.js's own LOW_POWER bail. */
  if(window.SITE && window.SITE.LOW_POWER) return;
  var out=document.getElementById('asciiOut'), stage=document.getElementById('asciiStage'),
      vid=document.getElementById('asciiVid'), samp=document.getElementById('asciiSamp');
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
  function loop(ts){
    if(!reduce && isVideo && media && visible && !document.hidden && !vid.paused && !vid.ended){
      if(ts-lastT>75){ render(); lastT=ts; }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ── DEFAULT CLIP ── baked-in flowers loop.
     240px grayscale h264 @13fps (matches the 75ms render tick), ~154KB.
     The sampler only reads 200 cols of luminance, so anything bigger
     is wasted bytes. Static — no in-page way to swap it (see astro source). */
  var DEFAULT_CLIP='/videos/ascii-default-clip.mp4';
  isVideo=true; media=vid;
  vid.addEventListener('loadeddata', function(){ lastRows=0; render(); }, {once:true});
  vid.src=DEFAULT_CLIP;
  var p=vid.play();
  if(p && p.catch) p.catch(function(){
    var resume=function(){ vid.play().catch(function(){}); document.removeEventListener('pointerdown', resume); };
    document.addEventListener('pointerdown', resume);
  });
})();
