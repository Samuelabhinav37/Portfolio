/* Kai's chat: the "Ask Kai" pill, and the panel it grows into.
   Answers come from a keyword knowledge base (window.SITE.LUNA_KB_BASE
   shape: { id, title, keywords, reply, detail, target }). Kai reacts the
   whole way: watches you type, thinks with dots on its screen while a light
   runs round the panel, lights its antenna when it knows, tilts its head
   when it doesn't, and talks while the answer appears.

   Usage: KaiChat({ kb: window.SITE.LUNA_KB_BASE, mount: document.body }) */
(function () {
  'use strict';
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var CHIPS = ['What has Samuel built?', 'Tell me about Moat', 'Is he open to work?', 'How do I reach him?'];

  // where a knowledge-base target leads
  function linkFor(target) {
    if (!target) return null;
    if (target.type === 'page' || target.type === 'url') return target.value;
    if (target.type === 'project') return '/projects/' + target.value + '/';
    return null;
  }
  function labelFor(entry) {
    var t = entry.target;
    if (!t) return null;
    if (t.type === 'project' || (t.type === 'page' && /^\/projects\//.test(t.value))) return 'Open the ' + entry.title + ' case study';
    if (entry.id === 'blog') return 'Read the blog';
    return 'Take me there';
  }

  // Score each entry by the keywords the question contains. Longer
  // keywords count more, so "bug bounty" beats "bug".
  function answer(kb, q) {
    var text = ' ' + q.toLowerCase().replace(/[^a-z0-9&+.\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var best = null, bestScore = 0;
    kb.forEach(function (e) {
      var score = 0;
      e.keywords.forEach(function (k) { if (text.indexOf(' ' + k + ' ') !== -1 || (k.length > 4 && text.indexOf(k) !== -1)) score += 1 + k.length / 8; });
      if (score > bestScore) { bestScore = score; best = e; }
    });
    return best;
  }

  window.KaiChat = function (opts) {
    opts = opts || {};
    var kb = opts.kb || [];
    var root = document.createElement('div');
    root.className = 'kc';
    root.innerHTML =
      '<button class="kc-pill" type="button" aria-expanded="false" aria-controls="kc-panel"><span class="kc-mini"></span>Ask Kai</button>' +
      '<section class="kc-panel" id="kc-panel" role="dialog" aria-label="Chat with Kai">' +
        '<div class="kc-pad" aria-hidden="true"></div>' +
        '<div class="kc-stage"><div class="kc-kai"></div></div>' +
        '<header class="kc-head"><div class="kc-slot"></div><div class="kc-id"><div class="kc-name">Kai</div><div class="kc-status">Here to show you around</div></div>' +
          '<button class="kc-close" type="button" aria-label="Close chat">' + CLOSE_ICON + '</button></header>' +
        '<div class="kc-body"><div class="kc-hello"><h3>Hi, I’m Kai.</h3><p>I know Samuel’s projects, writing and work. Ask me anything about them.</p>' +
          '<div class="kc-chips"></div></div><div class="kc-log" aria-live="polite"></div></div>' +
        '<div class="kc-foot"><form class="kc-form"><input class="kc-input" type="text" placeholder="Ask about Samuel’s work" aria-label="Message Kai" autocomplete="off" maxlength="200">' +
          '<button class="kc-send" type="submit" aria-label="Send" disabled>' + SEND_ICON + '</button></form></div>' +
      '</section>';
    (opts.mount || document.body).appendChild(root);

    var pill = root.querySelector('.kc-pill'), panel = root.querySelector('.kc-panel');
    var input = root.querySelector('.kc-input'), send = root.querySelector('.kc-send');
    var body = root.querySelector('.kc-body'), log = root.querySelector('.kc-log');
    var mini = window.Kai(root.querySelector('.kc-mini'), { imgWidth: 160, lite: true });
    var kai = window.Kai(root.querySelector('.kc-kai'), { imgWidth: 320, auto: true });
    var busy = false;
    var status = root.querySelector('.kc-status'), STATUS = status.textContent;

    root.querySelector('.kc-chips').append.apply(root.querySelector('.kc-chips'), CHIPS.map(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'kc-chip'; b.textContent = c;
      b.onclick = function () { ask(c); };
      return b;
    }));

    // the pill's Kai perks up when you come near
    pill.addEventListener('pointerenter', function () { mini.setMood('happy', 1200); mini.do('hop'); });
    pill.addEventListener('click', open);
    root.querySelector('.kc-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) close(); });

    function open() {
      root.classList.add('open');
      pill.setAttribute('aria-expanded', 'true');
      kai.lookAt(null);
      setTimeout(function () { kai.do('wave'); kai.setMood('happy', 1600); }, REDUCED ? 0 : 260);
      setTimeout(function () { input.focus({ preventScroll: true }); }, REDUCED ? 0 : 380);
    }
    function close() {
      root.classList.remove('open');
      pill.setAttribute('aria-expanded', 'false');
      pill.focus({ preventScroll: true });
    }

    // Kai watches you type, and glances at each word you finish
    input.addEventListener('input', function () {
      send.disabled = !input.value.trim() || busy;
      kai.lookAt(input);
      if (/\s$/.test(input.value) && Math.random() < .3) kai.blink();
    });
    root.querySelector('.kc-form').addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });

    function bubble(cls, text) {
      var m = document.createElement('div'); m.className = 'kc-msg ' + cls;
      if (text != null) m.textContent = text;
      log.appendChild(m); body.scrollTop = body.scrollHeight;
      return m;
    }

    function ask(q) {
      q = (q || '').trim();
      if (!q || busy) return;
      busy = true; send.disabled = true; input.value = '';
      if (!root.classList.contains('started')) root.classList.add('started');
      bubble('me', q);
      var typing = bubble('kai-says typing'); typing.innerHTML = '<i></i><i></i><i></i>';
      root.classList.add('thinking'); kai.think(true); kai.lookAt(null);
      status.textContent = 'Thinking';
      var hit = answer(kb, q);
      var greeting = hit && hit.id === 'greeting';
      var text = hit ? hit.reply : 'I don’t know that one yet. Samuel can answer it himself on the contact page.';
      var link = hit ? linkFor(hit.target) : '/contact';
      var label = hit ? labelFor(hit) : 'Go to contact';
      setTimeout(function () {
        root.classList.remove('thinking');
        status.textContent = STATUS;
        typing.remove();
        kai.react(greeting ? 'hello' : hit ? 'found' : 'miss', text.length);
        var m = bubble('kai-says'), span = document.createElement('span'); m.appendChild(span);
        var i = 0, step = REDUCED ? text.length : 2;
        (function type() {
          i = Math.min(text.length, i + step);
          span.textContent = text.slice(0, i);
          body.scrollTop = body.scrollHeight;
          if (i < text.length) return setTimeout(type, 18);
          if (link && label) {
            var a = document.createElement('a'); a.className = 'kc-go'; a.href = link; a.textContent = label + ' →';
            if (/^https?:/.test(link)) { a.target = '_blank'; a.rel = 'noopener'; }
            m.appendChild(a);
          }
          body.scrollTop = body.scrollHeight;
          busy = false; send.disabled = !input.value.trim();
        })();
      }, REDUCED ? 200 : 700 + Math.random() * 500);
    }

    return { root: root, kai: kai, open: open, close: close, ask: ask };
  };
})();
