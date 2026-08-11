/* Safety net: ensures Luna is revealed even if the intro was interrupted. Extracted from an inline <script> block, unmodified. */
setTimeout(function(){ var lw=document.getElementById('luna-wrap'); if(lw){ var o=lw.style.opacity; if(o===''||o==='0'){ lw.style.transition='opacity .6s ease'; lw.style.opacity='1'; } } }, 6800);
