/* Kai's knowledge base for a blog post, built from the post itself:
   its description, FAQs and section headings (window.SITE.__LUNA_POST, set
   by KaiPost.astro), plus a few fixed entries. Kai's chat
   (kai-site-chat.js) does the matching and drawing. */

const LP = window.SITE.__LUNA_POST || {};
const LP_faqs = LP.faqs || [];
const LP_headings = LP.headings || [];
const LP_category = LP.category || 'this topic';
const LP_categoryLower = LP_category.toLowerCase();
const LP_tagWords = (LP.tags || []).concat(LP.mitre || []);

function lunaSlugKeywords(text){
  return String(text||'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(w=>w.length>3);
}
/* FAQ answers may contain inline HTML (code/link chips) meant for the
   visible on-page FAQ accordion, which renders it as markup. The chat
   bubble here deliberately renders replies via textContent (safe-by-
   default), so strip tags down to plain text first. */
function lunaStripHtml(html){
  var s = String(html||''), prev;
  // Single-pass tag stripping can leave a new "<...>" behind where removing
  // one malformed/nested tag splices two surviving fragments back together —
  // reapply until a pass makes no further change.
  do { prev = s; s = s.replace(/<[^>]+>/g,''); } while (s !== prev);
  return s.replace(/\s+/g,' ').trim();
}

const KB = [];

KB.push({ id:'overview', title:'What happened',
  keywords:['what happened','summary','tldr','tl;dr','overview','what is this post about','what is this about']
    .concat(lunaSlugKeywords(LP.title)).concat(LP_tagWords.map(t=>String(t).toLowerCase())),
  reply: LP.description || ('This post is about ' + LP_categoryLower + '.'),
  detail: null,
  target:{type:'scroll', value:'#main-content'} });

LP_faqs.forEach(function(f, i){
  KB.push({ id:'faq-'+i, title:f.q,
    keywords: lunaSlugKeywords(f.q).concat([String(f.q).toLowerCase()]),
    reply: lunaStripHtml(f.a),
    detail: null,
    target: null });
});

LP_headings.forEach(function(h){
  KB.push({ id:'h-'+h.slug, title:h.text,
    keywords: lunaSlugKeywords(h.text).concat([String(h.text).toLowerCase()]),
    reply: "Let me take you to the '" + h.text + "' section.",
    detail: null,
    target:{type:'scroll', value:'#'+h.slug} });
});

KB.push({ id:'more', title:'More stories',
  keywords:['other posts','more stories','related','read next','other articles','more writing','what else'],
  reply:"There's more further down this page under 'more stories' — worth a look if this one was useful.",
  detail:null,
  target:{type:'scroll', value:'#more-stories'} });

KB.push({ id:'author', title:'The author',
  keywords:['who wrote','author','samuel','who are you','byline'],
  reply:"This one's by Samuel Abhinav. He's a security engineer and this blog is where he writes up the history behind the exploits and defenses he works with.",
  detail:"He's also behind the rest of the portfolio this blog lives in. It has shipped security projects, accepted bounty findings and hands-on IR labs.",
  target:null });

KB.push({ id:'greeting', title:'Say hi',
  keywords:['hi','hey','hello','yo','luna','kai','who are you','what are you','greetings'],
  reply:"Hi, I'm Kai. Ask about " + LP_categoryLower + " in this post or tell me where to jump.",
  detail:"I match what you ask against this post's content and take you to the right section.",
  target:null });

const DEFAULT_GUESS_IDS = ['overview'].concat(LP_faqs.slice(0,2).map(function(_,i){ return 'faq-'+i; })).concat(['more']);

/* related topics for the follow-up chips — each entry relates to the next
   2 topics in KB order (wrapping), since KB is now built per-post rather
   than a fixed hand-tuned set of ids. */
const RELATED = {};
KB.forEach(function(entry, i){
  const others = [];
  for (let o = 1; o <= 2; o++){
    const idx = (i + o) % KB.length;
    if (idx !== i) others.push(KB[idx].id);
  }
  RELATED[entry.id] = others;
});

/* starter questions: the post's own FAQs first, then general ones */
const CHIPS = LP_faqs.slice(0, 3).map(function(f, i){ return { label: f.q, topic: 'faq-' + i }; })
  .concat([{ label: "What's this post about?", topic: 'overview' }, { label: 'What else should I read?', topic: 'more' }, { label: 'Who wrote this?', topic: 'author' }])
  .slice(0, 3);

window.SITE.initLunaDrawer(KB, null, {
  chips: CHIPS,
  related: RELATED,
  guesses: DEFAULT_GUESS_IDS,
  hello: { title: 'Hi, I’m Kai.', text: 'I read this post too. Ask me about it, or where to jump.' },
  placeholder: 'Ask about this post'
});
