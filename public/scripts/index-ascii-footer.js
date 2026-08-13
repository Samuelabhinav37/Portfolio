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
  function loop(ts){
    if(!reduce && isVideo && media && visible && !document.hidden && !vid.paused && !vid.ended){
      if(ts-lastT>75){ render(); lastT=ts; }
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
  vid.addEventListener('loadeddata', function(){ lastRows=0; render(); }, {once:true});
  vid.src=DEFAULT_CLIP;
  var p=vid.play();
  if(p && p.catch) p.catch(function(){
    var resume=function(){ vid.play().catch(function(){}); document.removeEventListener('pointerdown', resume); };
    document.addEventListener('pointerdown', resume);
  });
})();
