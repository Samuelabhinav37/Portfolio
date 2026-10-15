/* Controls for src/pages/prototype/kai.astro (dev only). */
(function () {
  'use strict';
  var main = window.Kai(document.getElementById('kai-main'), { auto: true, imgWidth: 640 });
  window.kai = main;
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
