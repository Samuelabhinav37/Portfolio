/* Dev mockup only (src/pages/prototype/kai-ext-frame.astro): Kai's tap-mode
   chat over real screenshots of Moat's Settings and Cluster's dashboard.
   Moat's questions are the ones its Settings Kai guide already has
   (src/options/options.ts) plus one from the website FAQ; Cluster's are a
   draft from its README, for review. "Show me" actions only show a toast
   here; in the extensions they open the screen and outline the control. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var app = params.get('app') || 'moat', theme = params.get('theme') || 'dark';
  document.documentElement.style.backgroundImage = 'url(/prototype-ext/' + app + '-' + theme + '.png)';

  var toast = document.createElement('div'); toast.className = 'demo-toast'; document.body.appendChild(toast);
  function show(text) { return function () { toast.textContent = text; toast.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { toast.classList.remove('on'); }, 2600); }; }

  var MOAT = [
    { id: 'pause', ask: 'How do I pause Moat on a site?', answer: 'On the site, click the Moat icon next to the address bar and turn off its switch. You can also add a site here, under Exceptions and Paused.', action: { label: 'Show me', run: show('Opens Exceptions and outlines Paused sites') }, follow: ['broken', 'hide'] },
    { id: 'level', ask: 'Where do I change how much Moat blocks?', answer: 'Under Protection, pick a level. Balanced suits most people.', action: { label: 'Show me', run: show('Opens Protection and outlines the level picker') }, follow: ['broken', 'working'] },
    { id: 'blocked', ask: 'Where do I see what Moat blocked?', answer: 'Overview shows your week. Trackers shows who tried to follow you, and Sites shows where.', action: { label: 'Show me', run: show('Opens Trackers') }, follow: ['working', 'data'] },
    { id: 'hide', ask: 'How do I hide something on a page?', answer: 'On the page, click the Moat icon and choose Hide something on this page. Everything you hid is listed here.', action: { label: 'Show me', run: show('Opens Exceptions and outlines Hidden elements') }, follow: ['block', 'pause'] },
    { id: 'block', ask: 'How do I always block a site?', answer: 'Type the site under Always block and press Block.', action: { label: 'Show me', run: show('Opens Exceptions and outlines Always block') }, follow: ['hide'] },
    { id: 'backup', ask: 'How do I keep my settings on another computer?', answer: 'Under Backup and sync, save a backup file or turn on sync.', action: { label: 'Show me', run: show('Opens Backup and sync') } },
    { id: 'broken', ask: 'A site isn’t working', answer: 'Let’s fix it step by step.', action: { label: 'Start', run: show('Opens Help: Fix a site that breaks') }, follow: ['pause'] },
    { id: 'working', ask: 'Is Moat working?', answer: 'Here’s how to check.', action: { label: 'Check now', run: show('Opens Help: Check Moat is working') }, follow: ['blocked'] },
    { id: 'data', ask: 'Does Moat collect my data?', answer: 'No. Blocking runs on your device, with no account and no analytics. The daily list updates carry nothing about you.', follow: ['blocked'] },
  ];
  var CLUSTER = [
    { id: 'read', ask: 'Does Cluster read my emails?', answer: 'No. It reads senders, subjects, dates, labels and a few headers, never the message itself. Everything runs in your browser.', follow: ['undo', 'flagged'] },
    { id: 'flagged', ask: 'Why was this sender flagged?', answer: 'It looked like someone else: a lookalike domain, a failed sender check, or a reply address that goes somewhere different. Each flag lists the reasons.', action: { label: 'Show me', run: show('Opens Security') }, follow: ['read'] },
    { id: 'sort', ask: 'How do I sort my inbox?', answer: 'Open Clean up and press Sort my inbox. You see every group first and tick what to file. Nothing moves until you confirm.', action: { label: 'Show me', run: show('Opens Clean up') }, follow: ['undo', 'keep'] },
    { id: 'undo', ask: 'How do I undo something?', answer: 'Recently done lists every action Cluster took, newest first, with Undo wherever Gmail allows it.', action: { label: 'Show me', run: show('Opens Recently done') }, follow: ['sort'] },
    { id: 'unsub', ask: 'How do I unsubscribe from lots at once?', answer: 'Subscriptions lists every sender you can leave. Pick the ones you want, or unsubscribe from all verified one-click senders together.', action: { label: 'Show me', run: show('Opens Subscriptions') }, follow: ['undo'] },
    { id: 'keep', ask: 'Can Cluster keep new mail sorted?', answer: 'Yes. Turn on Keep sorting new mail and Cluster adds Gmail filters, so new mail is filed when it arrives, even with your browser closed.', follow: ['undo'] },
    { id: 'starred', ask: 'Will it touch my starred mail?', answer: 'Never. Starred mail is always skipped, and nothing is deleted or moved before you confirm.', follow: ['undo'] },
  ];

  var isMoat = app === 'moat';
  var chat = window.KaiChat({
    mode: 'tap', theme: theme,
    questions: isMoat ? MOAT : CLUSTER,
    status: isMoat ? 'Here to help with Moat' : 'Here to help with Cluster',
    hello: isMoat ? 'Hi, I’m Kai. What can I help you with?' : 'Hi, I’m Kai. Ask me anything about Cluster.',
    order: function () { return isMoat ? ['blocked', 'working'] : ['read', 'sort', 'flagged']; },
  });
  window.chat = chat;
  if (params.get('open') === '1') setTimeout(chat.open, 400);
})();
