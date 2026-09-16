/* Kai chat drawer knowledge base for the contact page — see luna-kb-base.js
   for the shared entries. Overrides the 'about'/'contact' entries' reply
   and target (both point at the message field here) and adds a
   page-specific extraTargetHandler that scrolls to and focuses it. */
window.SITE.initLunaDrawer(window.SITE.buildLunaKB({
  about: {
    reply:"Samuel got into security chasing how interconnected everything really is, and what it takes to keep that trust intact — thinks like an attacker first, then builds the defense. That's Sentinel, PRISM, and Axon. MS in cybersecurity, on OPT, open to SOC analyst and security engineering roles. I'm the companion he built to keep watch over the archive.",
    target:{type:'focus', value:'#nm'} },
  contact: {
    target:{type:'focus', value:'#nm'} }
}), function extraTargetHandler(target, ctx){
  if(target.type==='focus'){ const n=document.querySelector(target.value);
    return n?{label:'Start a message',run:()=>{ctx.close();
      n.scrollIntoView({behavior:ctx.reduce?'auto':'smooth',block:'center'});
      setTimeout(()=>n.focus({preventScroll:true}), ctx.reduce?0:420);}}:null; }
  return null;
});
