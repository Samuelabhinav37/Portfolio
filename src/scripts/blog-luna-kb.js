/* Kai chat drawer's knowledge base for the blog index page — see
   luna-kb-base.js (loaded globally, see blog/index.astro) for the shared
   entries. Diffed field-by-field against that base: sentinel/prism/axon/
   bounty/skills only differ in `target` (this page jumps straight to a
   case-study card or the grid instead of pointing elsewhere); 'blog'
   differs in both `reply` (this page IS the blog, so "lives right here"
   reads correctly here, unlike the base's "lives on the threat-intel
   blog" phrasing written for about/contact) and `target`; 'greeting'
   differs only in wording. labs/about/contact matched the base exactly,
   so they carry no override.

   As a separate module this no longer shares an implicit global scope
   with blog-index-client.js the way two classic <script> tags used to,
   so it reads window.projects / window.openCase (explicitly exported
   there) instead of the bare identifiers the inline version relied on. */
const KB = window.SITE.buildLunaKB({
  sentinel: { target:{type:'case', value:'sentinelnode'} },
  prism:    { target:{type:'case', value:'prismgrid'} },
  axon:     { target:{type:'case', value:'axonauth'} },
  bounty:   { target:{type:'case', value:'cnamedns'} },
  blog: {
    reply:"The writing lives right here — filter to 'Writing' below for the threat-intel posts: IOC breakdowns, MITRE ATT&CK mappings, case files.",
    target:{type:'scroll', value:'#grid'} },
  skills:   { target:{type:'scroll', value:'#grid'} },
  greeting: {
    reply:"I am Kai. I keep watch over this archive. Ask about the work, the labs, or the writing.",
    detail:"I match what you ask against Samuel's real work and take you to the right section. Soon he is training a small model of me to answer in fuller sentences." },
});

/* case-study jump: hand the seed to the page's own openCase() —
   seeds come straight from the projects[] array this page already
   builds its grid from, so the drawer and the grid can never drift. */
function openCaseBySeed(seed, reduce){
  try{
    const p = window.projects && window.projects.find(x => x.seed === seed);
    if(p && typeof window.openCase === 'function'){ window.openCase(p, null); return; }
  }catch(e){ console.warn('case jump failed', e); }
  const g = document.getElementById('grid');
  g && g.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start'});
}
function extraTargetHandler(target, ctx){
  if(target.type==='case'){
    return {label:'Open the case study', run:()=>{ ctx.close(); openCaseBySeed(target.value, ctx.reduce); }}; }
  return null;
}

window.SITE.initLunaDrawer(KB, extraTargetHandler);
