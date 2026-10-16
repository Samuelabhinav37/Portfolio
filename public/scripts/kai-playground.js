/* Controls for src/pages/prototype/kai.astro (dev only). */
(function () {
  'use strict';
  var main = window.Kai(document.getElementById('kai-main'), { auto: true, imgWidth: 640 });
  window.kai = main;
  window.chat = window.KaiChat({ kb: (window.SITE && window.SITE.LUNA_KB_BASE) || [] });
  document.querySelectorAll('.kai-small').forEach(function (n) {
    window.Kai(n, { imgWidth: Number(n.dataset.size) || 320, lite: n.hasAttribute('data-lite') });
  });

  var moods = document.getElementById('moods');
  window.Kai.MOODS.forEach(function (m) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = m;
    if (m === 'neutral') b.classList.add('on');
    b.onclick = function () {
      moods.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
      main.setMood(m);
    };
    moods.appendChild(b);
  });
  var actions = document.getElementById('actions');
  window.Kai.ACTIONS.forEach(function (a) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = a;
    b.onclick = function () { if (a === 'blink') main.blink(); else main.do(a); };
    actions.appendChild(b);
  });
  [['talk', function () { main.talk(1600); }], ['think on/off', function () { main.think(!main.thinking); }], ['antenna light', function () { main.lightAntenna(); }]].forEach(function (x) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = x[0]; b.onclick = x[1]; actions.appendChild(b);
  });

  // Scenes: the moments Kai reacts to in each product, with its line.
  var say = document.getElementById('say'), note = document.getElementById('scene-note'), sayT = 0;
  function line(text, ms) {
    clearTimeout(sayT);
    say.textContent = text; say.classList.add('on');
    main.talk(Math.min(2600, 400 + text.length * 22));
    sayT = setTimeout(function () { say.classList.remove('on'); }, ms || 3200);
  }
  var target = document.querySelector('.targets a');
  var SCENES = [
    ['Show me', 'Everywhere: before the ring appears, Kai looks at the spot and leans its antenna toward it.', function () {
      main.pointAt(target);
      setTimeout(function () { target.classList.add('ring'); main.lightAntenna(); setTimeout(function () { target.classList.remove('ring'); }, 1800); }, 650);
      line('Right here.');
    }],
    ['Doesn’t know', 'Everywhere: a question it has no note for.', function () { main.do('shrug'); line('That one isn’t in my memory yet.'); }],
    ['Welcome back', 'Everywhere: you come back after a while.', function () { main.do('peek'); setTimeout(function () { line('Welcome back.'); }, 500); }],
    ['Got it', 'Moat and Cluster: a setting changed. A nod, no words.', function () { main.do('nodSmall'); }],
    ['Protection off', 'Moat: protection is turned off. Kai stays worried until it is back on.', function () { main.setMood('worried'); line('Heads up. Moat is off, so ads are getting through.', 4200); }],
    ['Back on', 'Moat: protection is on again.', function () { main.setMood('neutral'); main.do('relief'); setTimeout(function () { line('Back on guard.'); }, 600); }],
    ['Pause a site', 'Moat: a site is paused.', function () { main.do('lookAway'); line('Paused. I’ll look away there.'); }],
    ['Milestone', 'Moat: a blocking milestone on Overview, once.', function () { main.do('puff'); main.lightAntenna(1800); line('That’s 1,000 blocked.'); }],
    ['Sorted', 'Cluster: sorting finished.', function () { main.do('celebrate'); line('All sorted.'); }],
    ['Flagged sender', 'Cluster: you open a sender that looks like someone else.', function () { main.do('squint'); line('Careful with this one.'); }],
    ['Unsubscribed', 'Cluster: a batch of unsubscribes is done.', function () { main.do('bye'); line('Bye to 12 senders.'); }],
    ['Undo', 'Cluster: something was undone.', function () { main.do('nodSmall'); line('Undone.', 1800); }],
    ['Arcade win', 'Portfolio: you beat the About page game.', function () { main.do('celebrate'); line('Nice. You beat it.'); }],
    ['Arcade loss', 'Portfolio: game over.', function () { main.do('startle'); setTimeout(function () { main.setMood('sad', 1600); }, 700); line('Oof. One more go?'); }],
    ['Message sent', 'Portfolio: the contact form went through.', function () { main.do('celebrate'); line('Sent. Samuel reads every one.'); }],
    ['Project hover', 'Portfolio: you hover a project card. Kai looks and its eyes widen a little.', function () { main.lookAt(target); main.setMood('curious', 1600); setTimeout(function () { main.lookAt(null); }, 1700); }],
  ];
  var scenes = document.getElementById('scenes');
  SCENES.forEach(function (sc) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = sc[0];
    b.onclick = function () { note.textContent = sc[1]; sc[2](); };
    scenes.appendChild(b);
  });

  // Fake answers, only to see how Kai behaves around a reply.
  var KB = [
    { k: ['hi', 'hello', 'hey', 'yo'], kind: 'hello', a: "Hi, I'm Kai. I keep watch over Samuel's work. Ask me about a project, or where to start." },
    { k: ['moat', 'ad', 'blocker'], kind: 'found', a: 'Moat is the ad blocker Samuel built. It blocks ads and trackers inside your browser, with no account and no server.' },
    { k: ['sentinel', 'soc', 'siem', 'detection'], kind: 'found', a: 'Sentinel is his detection lab. Every rule is tested against a real attack before it counts.' },
    { k: ['joke', 'funny'], kind: 'joke', a: 'I would tell you a UDP joke, but you might not get it.' },
  ];
  var reply = document.getElementById('reply');
  document.getElementById('chat').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = document.getElementById('q').value.toLowerCase();
    var hit = KB.find(function (x) { return x.k.some(function (k) { return q.indexOf(k) !== -1; }); });
    reply.textContent = '';
    main.think(true);
    setTimeout(function () {
      var text = hit ? hit.a : "I don't know that one yet. The contact page reaches Samuel directly.";
      main.react(hit ? hit.kind : 'miss', text.length);
      var i = 0, iv = setInterval(function () { reply.textContent = text.slice(0, ++i * 2); if (i * 2 >= text.length) clearInterval(iv); }, 22);
    }, 900);
  });
})();
