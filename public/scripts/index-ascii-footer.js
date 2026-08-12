/* ascii.cam widget for the footer (live luminance-ramp ASCII renderer). Extracted from an inline <script> block, unmodified. */
/* ascii.cam widget (footer) — same live luminance-ramp ASCII renderer used on
   the About page's skills card, ported in place of the old CRT recon map. */
(function(){
  var card=document.getElementById('footerAsciiCard'); if(!card)return;
  var out=document.getElementById('footerAsciiOut'), stage=document.getElementById('footerAsciiStage'),
      vid=document.getElementById('footerAsciiVid'), samp=document.getElementById('footerAsciiSamp');
  var sctx=samp.getContext('2d',{willReadFrequently:true});
  var cols=(window.SITE&&window.SITE.LOW_POWER)?100:200, contrast=1.70, brightness=0, RAMP=' .:oO@', L=RAMP.length;
  var media=null, isVideo=false, visible=true, lastT=0, lastRows=0;

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
    if(isVideo && media && visible && !vid.paused && !vid.ended){
      if(ts-lastT>75){ render(); lastT=ts; }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
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
