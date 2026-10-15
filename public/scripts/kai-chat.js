/* Kai's chat, two ways:
   - typed (the portfolio): the "Ask Kai" pill grows into a glass panel;
     Kai stands on a light pad while it's empty, then lives in the header.
     It watches you type, thinks with dots on its screen while a light runs
     round the panel, lights its antenna when it knows, tilts its head when
     it doesn't, and talks while the answer appears.
   - tap (the extensions): see tapChat below.

   Typed usage:
     KaiChat({
       respond(text, { topic }) -> Promise<{ text, kind, action?, choices? }>,
       chips: [{ label, topic }],      // starter questions
       hello: { title, text }, status, placeholder, mount, hidden
     })
   kind is 'found' | 'miss' | 'hello' | 'joke' (how Kai reacts); action is
   { label, run } or { label, href }; choices are follow-ups { label, topic }
   or { label, text }. Without respond, a small keyword match over opts.kb
   (playground only). */
(function () {
  'use strict';
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CLOSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  // Playground fallback: score entries by the keywords the question contains.
  function simpleRespond(kb) {
    var link = function (t) { return !t ? null : t.type === 'page' || t.type === 'url' ? t.value : t.type === 'project' ? '/projects/' + t.value + '/' : null; };
    return function (q, ctx) {
      var best = null;
      if (ctx && ctx.topic) best = kb.find(function (e) { return e.id === ctx.topic; });
      if (!best) {
        var text = ' ' + q.toLowerCase().replace(/[^a-z0-9&+.\s-]/g, ' ').replace(/\s+/g, ' ') + ' ', top = 0;
        kb.forEach(function (e) {
          var s = 0;
          e.keywords.forEach(function (k) { if (text.indexOf(' ' + k + ' ') !== -1 || (k.length > 4 && text.indexOf(k) !== -1)) s += 1 + k.length / 8; });
          if (s > top) { top = s; best = e; }
        });
      }
      if (!best) return Promise.resolve({ text: 'I don’t know that one yet. Samuel can answer it himself on the contact page.', kind: 'miss', action: { label: 'Go to contact', href: '/contact' } });
      var href = link(best.target);
      return Promise.resolve({ text: best.reply, kind: best.id === 'greeting' ? 'hello' : 'found', action: href ? { label: 'Take me there', href: href } : null });
    };
  }

  window.KaiChat = function (opts) {
    opts = opts || {};
    if (opts.mode === 'tap') return tapChat(opts);
    var respond = opts.respond || simpleRespond(opts.kb || []);
    var hello = opts.hello || { title: 'Hi, I’m Kai.', text: 'I know Samuel’s projects, writing and work. Ask me anything about them.' };
    var root = document.createElement('div');
    root.className = 'kc';
    root.innerHTML =
      '<button class="kc-pill" type="button" aria-expanded="false" aria-controls="kc-panel"><span class="kc-mini"></span>Ask Kai</button>' +
      '<section class="kc-panel" id="kc-panel" role="dialog" aria-label="Chat with Kai">' +
        '<div class="kc-pad" aria-hidden="true"></div>' +
        '<div class="kc-stage"><div class="kc-kai"></div></div>' +
        '<header class="kc-head"><div class="kc-slot"></div><div class="kc-id"><div class="kc-name">Kai</div><div class="kc-status"></div></div>' +
          '<button class="kc-close" type="button" aria-label="Close chat">' + CLOSE_ICON + '</button></header>' +
        '<div class="kc-body"><div class="kc-hello"><h3></h3><p></p><div class="kc-chips"></div></div><div class="kc-log" aria-live="polite"></div></div>' +
        '<div class="kc-foot"><form class="kc-form"><input class="kc-input" type="text" aria-label="Message Kai" autocomplete="off" maxlength="200">' +
          '<button class="kc-send" type="submit" aria-label="Send" disabled>' + SEND_ICON + '</button></form></div>' +
      '</section>';
    root.querySelector('.kc-hello h3').textContent = hello.title;
    root.querySelector('.kc-hello p').textContent = hello.text;
    (opts.mount || document.body).appendChild(root);

    var pill = root.querySelector('.kc-pill');
    var input = root.querySelector('.kc-input'), send = root.querySelector('.kc-send');
    input.placeholder = opts.placeholder || 'Ask about Samuel’s work';
    var body = root.querySelector('.kc-body'), log = root.querySelector('.kc-log');
    var status = root.querySelector('.kc-status'), STATUS = opts.status || 'Here to show you around';
    status.textContent = STATUS;
    var mini = window.Kai(root.querySelector('.kc-mini'), { src: opts.kaiSrc, imgWidth: 160, lite: true });
    var kai = window.Kai(root.querySelector('.kc-kai'), { src: opts.kaiSrc, imgWidth: 320, auto: true });
    var busy = false;

    var chipsEl = root.querySelector('.kc-chips');
    (opts.chips || [{ label: 'What has Samuel built?' }, { label: 'Tell me about Moat' }, { label: 'Is he open to work?' }, { label: 'How do I reach him?' }]).forEach(function (c) {
      chipsEl.appendChild(chip(c));
    });

    // the pill's Kai perks up when you come near
    pill.addEventListener('pointerenter', function () { mini.setMood('happy', 1200); mini.do('hop'); });
    pill.addEventListener('click', open);
    root.querySelector('.kc-close').addEventListener('click', function () { close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close(); });

    function isOpen() { return root.classList.contains('open'); }
    function open() {
      if (isOpen()) return;
      root.classList.add('open');
      pill.setAttribute('aria-expanded', 'true');
      kai.lookAt(null);
      setTimeout(function () { kai.do('wave'); kai.setMood('happy', 1600); }, REDUCED ? 0 : 260);
      setTimeout(function () { input.focus({ preventScroll: true }); }, REDUCED ? 0 : 380);
      if (opts.onOpen) opts.onOpen();
    }
    function close(keepFocus) {
      if (!isOpen()) return;
      root.classList.remove('open');
      pill.setAttribute('aria-expanded', 'false');
      if (!keepFocus) pill.focus({ preventScroll: true });
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
    function chip(c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'kc-chip'; b.textContent = c.label;
      b.onclick = function () { ask(c.text || c.label, c.topic); };
      return b;
    }
    function actionEl(a) {
      var el;
      if (a.href) {
        el = document.createElement('a'); el.href = a.href;
        if (/^https?:/.test(a.href)) { el.target = '_blank'; el.rel = 'noopener'; }
      } else {
        el = document.createElement('button'); el.type = 'button';
        el.onclick = function () { close(true); a.run(); };
      }
      el.className = 'kc-go'; el.textContent = a.label + ' →';
      return el;
    }

    function ask(q, topic) {
      q = (q || '').trim();
      if (!q || busy) return;
      busy = true; send.disabled = true; input.value = '';
      if (!root.classList.contains('started')) root.classList.add('started');
      log.querySelectorAll('.kc-follow').forEach(function (n) { n.remove(); });
      bubble('me', q);
      var typing = bubble('kai-says typing'); typing.innerHTML = '<i></i><i></i><i></i>';
      root.classList.add('thinking'); kai.think(true); kai.lookAt(null);
      status.textContent = 'Thinking';
      var started = performance.now(), pause = REDUCED ? 150 : 650 + Math.random() * 450;
      Promise.resolve(respond(q, { topic: topic })).catch(function () { return null; }).then(function (r) {
        r = r || { text: 'Something went wrong on my side. Try asking again.', kind: 'miss' };
        setTimeout(function () {
          root.classList.remove('thinking'); status.textContent = STATUS; typing.remove();
          var text = r.text || '';
          kai.react(r.kind || 'found', text.length);
          var m = bubble('kai-says'), span = document.createElement('span'); m.appendChild(span);
          var i = 0, step = REDUCED ? text.length : 2;
          (function type() {
            i = Math.min(text.length, i + step);
            span.textContent = text.slice(0, i);
            body.scrollTop = body.scrollHeight;
            if (i < text.length) return setTimeout(type, 16);
            if (r.action) m.appendChild(actionEl(r.action));
            if (r.choices && r.choices.length) {
              var f = document.createElement('div'); f.className = 'kc-follow';
              r.choices.forEach(function (c) { f.appendChild(chip(c)); });
              log.appendChild(f);
            }
            body.scrollTop = body.scrollHeight;
            busy = false; send.disabled = !input.value.trim();
          })();
        }, Math.max(0, pause - (performance.now() - started)));
      });
    }

    return { root: root, kai: kai, open: open, close: close, ask: ask, isOpen: isOpen };
  };

  /* ---------------------------------------------------------------------
     Tap mode, for the extensions: Kai in the corner at full size with an
     "Ask Kai" bubble above it, and a panel of predefined questions. No text
     box, so nothing goes unanswered. Kai stays in the corner and does the
     talking (one Kai on screen), in calm mode so an idle Settings page draws
     no frames.
       questions: [{ id, ask, answer, action?: { label, run }, follow?: [ids] }]
       order():   ids to list first (for the screen you're on)
       notice():  null, or { text, action } said before anything else
       theme:     'dark' | 'light' */
  function tapChat(opts) {
    var Q = opts.questions || [];
    var byId = {}; Q.forEach(function (q) { byId[q.id] = q; });
    var asked = {};
    var root = document.createElement('div');
    root.className = 'kc kc-tapmode' + (opts.theme === 'light' ? ' light' : '');
    root.innerHTML =
      '<section class="kc-panel kc-dock" id="kc-dock" role="dialog" aria-label="Ask Kai">' +
        '<header class="kc-head"><div class="kc-id"><div class="kc-name">Kai</div><div class="kc-status"></div></div>' +
          '<button class="kc-close" type="button" aria-label="Close">' + CLOSE_ICON + '</button></header>' +
        '<div class="kc-body"><div class="kc-log" aria-live="polite"></div></div>' +
      '</section>' +
      '<div class="kc-launch">' +
        '<button class="kc-tag" type="button" tabindex="-1" aria-hidden="true">Ask Kai</button>' +
        '<button class="kc-kaibtn" type="button" aria-label="Ask Kai" aria-expanded="false" aria-controls="kc-dock"><span class="kc-corner"></span></button>' +
      '</div>';
    (opts.mount || document.body).appendChild(root);
    var status = root.querySelector('.kc-status'), STATUS = opts.status || 'Here to help';
    status.textContent = STATUS;
    var body = root.querySelector('.kc-body'), log = root.querySelector('.kc-log');
    var btn = root.querySelector('.kc-kaibtn'), tag = root.querySelector('.kc-tag');
    var kai = window.Kai(root.querySelector('.kc-corner'), { src: opts.kaiSrc, imgWidth: 320, calm: true });
    if (opts.theme === 'light') kai.root.classList.add('on-light');
    var busy = false;

    // Kai notices the pointer when it comes near, and perks up on hover
    var pending = false, near = false;
    addEventListener('pointermove', function (e) {
      if (pending) return; pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var r = kai.root.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        if (d < 420) { near = true; kai.lookAt({ x: e.clientX, y: e.clientY }); }
        else if (near) { near = false; kai.lookAt(null); }
      });
    }, { passive: true });
    btn.addEventListener('pointerenter', function () { if (!root.classList.contains('open')) { kai.setMood('happy', 1100); kai.do('hop'); } });
    btn.addEventListener('click', function () { if (root.classList.contains('open')) close(); else open(); });
    tag.addEventListener('click', open);
    root.querySelector('.kc-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('open')) close(); });

    function bubble(cls, text) {
      var m = document.createElement('div'); m.className = 'kc-msg ' + cls;
      if (text != null) m.textContent = text;
      log.appendChild(m); body.scrollTop = body.scrollHeight;
      return m;
    }
    function say(text, action, then) {
      kai.react('found', text.length);
      var m = bubble('kai-says'), span = document.createElement('span'); m.appendChild(span);
      var i = 0, step = REDUCED ? text.length : 2;
      (function type() {
        i = Math.min(text.length, i + step); span.textContent = text.slice(0, i); body.scrollTop = body.scrollHeight;
        if (i < text.length) return setTimeout(type, 16);
        if (action) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'kc-go'; b.textContent = action.label + ' →';
          b.onclick = function () { action.run(); if (action.close !== false) close(); };
          m.appendChild(b);
        }
        body.scrollTop = body.scrollHeight;
        if (then) then();
      })();
    }
    function choices(ids, more) {
      var wrap = document.createElement('div'); wrap.className = 'kc-choices';
      ids.forEach(function (id) {
        var q = byId[id]; if (!q) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'kc-chip kc-q'; b.textContent = q.ask;
        b.onclick = function () { choose(q, wrap); };
        wrap.appendChild(b);
      });
      if (more) {
        var m = document.createElement('button'); m.type = 'button'; m.className = 'kc-chip kc-q kc-more'; m.textContent = 'Something else';
        m.onclick = function () { wrap.remove(); choices(Q.map(function (q) { return q.id; }).filter(function (id) { return ids.indexOf(id) === -1; }), false); };
        wrap.appendChild(m);
      }
      log.appendChild(wrap); body.scrollTop = body.scrollHeight;
    }
    function firstIds() {
      var first = (opts.order && opts.order()) || [];
      var rest = Q.map(function (q) { return q.id; }).filter(function (id) { return first.indexOf(id) === -1; });
      return first.concat(rest).slice(0, 4);
    }
    function choose(q, wrap) {
      if (busy) return;
      busy = true; asked[q.id] = true;
      wrap.remove();
      bubble('me', q.ask);
      var typing = bubble('kai-says typing'); typing.innerHTML = '<i></i><i></i><i></i>';
      root.classList.add('thinking'); kai.think(true); status.textContent = 'Thinking';
      setTimeout(function () {
        root.classList.remove('thinking'); typing.remove(); status.textContent = STATUS;
        say(q.answer, q.action, function () {
          busy = false;
          var next = (q.follow || []).filter(function (id) { return !asked[id]; });
          Q.forEach(function (o) { if (next.length < 3 && !asked[o.id] && next.indexOf(o.id) === -1) next.push(o.id); });
          if (next.length) choices(next.slice(0, 3), true);
        });
      }, REDUCED ? 150 : 520 + Math.random() * 300);
    }

    function open() {
      root.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      kai.do('wave');
      if (!log.childElementCount) {
        var n = opts.notice && opts.notice();
        busy = true;
        setTimeout(function () {
          say(n ? n.text : (opts.hello || 'Hi, I’m Kai. What can I help with?'), n ? n.action : null, function () { busy = false; choices(firstIds(), true); });
        }, REDUCED ? 0 : 260);
      }
      setTimeout(function () { var c = root.querySelector('.kc-q'); if (c) c.focus({ preventScroll: true }); }, 900);
    }
    function close() {
      root.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      kai.lookAt(null);
    }
    return { root: root, kai: kai, open: open, close: close };
  }
})();
