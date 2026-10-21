/* The contact page's found objects come alive here (ContactArtifacts.astro
   and ContactSkyArtifacts.astro):

   - the intercept console encodes the message as it's typed: a hex dump of
     its last few lines, a byte count and a CRC-32. All of it is worked out
     here in the browser; nothing is sent or stored.
   - the console, the postcard and the picture tied to it all look torn out
     of the sky: stepped edges, smears around them, a slow broken-screen
     video over them, and every so often a glitch. The console glitches
     fastest (and as the visitor types); the card and picture slowly. With
     reduced motion they take one torn shape and hold it.
   - while the form is sending, an XP dial-up box walks through its steps
     and the console reports the transmission; both settle on the result.
   - a notification balloon pops up once and points the visitor at the
     message.

   Each piece checks it exists first, so any of the markup can be removed
   on its own. */
(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };

  /* ── intercept console ── */
  var body = $('ic-body'), ms = $('ms');
  var CRC = (function(){
    var t = [];
    for(var n = 0; n < 256; n++){
      var c = n;
      for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes){
    var c = 0xFFFFFFFF;
    for(var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
  function hex2(b){ return (b < 16 ? '0' : '') + b.toString(16).toUpperCase(); }
  var enc = window.TextEncoder ? new TextEncoder() : null;
  var tail = '';   // lines the send step appends under the dump
  function render(){
    if(!body || !ms || !enc) return;
    var text = ms.value;
    var lines = ['C:\\> encode correspondence.txt'];
    if(!text.trim()){
      lines = ['Microsoft Windows XP [Version 5.1.2600]', '(C) Copyright 1985-2001 Microsoft Corp.', '', 'C:\\> listen --band 1420MHz', 'listening for transmissions...'];
    } else {
      var bytes = enc.encode(text);
      /* six bytes a row, so the text column stays clear of the card */
      var start = Math.max(0, Math.floor((bytes.length - 1) / 6) * 6 - 5 * 6);
      for(var o = start; o < bytes.length; o += 6){
        var row = [], asc = '';
        for(var j = 0; j < 6; j++){
          var b = bytes[o + j];
          row.push(b === undefined ? '  ' : hex2(b));
          asc += b === undefined ? ' ' : (b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
        }
        lines.push(' ' + o.toString(16).toUpperCase().padStart(4, '0') + '  ' + row.join(' ') + '  ' + asc);
      }
      lines.push('', ' bytes: ' + bytes.length + '   crc32: ' + crc32(bytes));
    }
    body.textContent = lines.concat(tail ? ['', tail] : []).join('\n');
    var cur = document.createElement('span');
    cur.className = 'ic-cursor';
    cur.textContent = '_';
    body.appendChild(cur);
  }
  if(ms) ms.addEventListener('input', function(){ tail = ''; render(); });
  if(ms && ms.value) render();   // a restored draft

  /* ── the wreck: the console's tear, the card and the picture ──
     All three share one look. Each has a stepped outline (a clip-path built
     from thin bands, each pushed in a little at its ends), smears and colour
     slices drawn on a canvas around its edges, and a slow broken-screen video
     over it (see .wreck in ContactArtifacts.astro). Now and then each one
     glitches: a few reshapes with a sideways jolt, then a new calm shape. */
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rnd = function(a, b){ return a + Math.random() * (b - a); };
  var pick = function(a){ return a[Math.floor(Math.random() * a.length)]; };

  /* the stepped outline of a w x h box, notched only on `sides` ('trbl') */
  var stepped = function(w, h, amt, sides){
    var pts = [], x, y, d;
    var steps = function(len, lo, hi, on){
      var out = [], p = 0;
      while(p < len){ var n = Math.min(len - p, rnd(lo, hi)); out.push([p, n, on && Math.random() < 0.5 ? rnd(0, amt) : 0]); p += n; }
      return out;
    };
    var has = function(c){ return sides.indexOf(c) >= 0; };
    steps(w, 10, 46, has('t')).forEach(function(c){ d = c[2] * 0.5; pts.push([c[0], d], [c[0] + c[1], d]); });
    steps(h, 5, 26, has('r')).forEach(function(b){ x = w - b[2]; pts.push([x, b[0]], [x, b[0] + b[1]]); });
    steps(w, 10, 46, has('b')).reverse().forEach(function(c){ y = h - c[2] * 0.5; pts.push([c[0] + c[1], y], [c[0], y]); });
    steps(h, 5, 26, has('l')).reverse().forEach(function(b){ pts.push([b[2], b[0] + b[1]], [b[2], b[0]]); });
    return 'polygon(' + pts.map(function(q){ return q[0].toFixed(1) + 'px ' + q[1].toFixed(1) + 'px'; }).join(',') + ')';
  };

  var GLYPHS = ['BBB', 'BB#', 'QNp', 'RHH', 'pWE', 'B8', 'dBBV', 'NB', 'Vq'];
  var SLABS = ['150,215,210', '205,95,95', '226,214,190'];
  var fitCanvas = function(cv, cw, ch){
    var dpr = Math.min(2, devicePixelRatio || 1), c = cv.getContext('2d');
    if(cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)){ cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    return c;
  };
  /* smears running off a box's notched edges, colour slices, stray text.
     r = {x, y, w, h, sides, scraps}, in the canvas's own coordinates */
  var paintEdges = function(ctx, r, k){
    var i, x, y, len, g, has = function(c){ return r.sides.indexOf(c) >= 0; };
    var X = r.x, Y = r.y, w = r.w, h = r.h;
    /* vertical streaks, as if the sky's pixels had been dragged off the edge */
    for(i = 0; i < 70 * k * Math.min(1, w / 300); i++){
      var up = Math.random() < 0.5;
      if(up ? !has('t') : !has('b')) continue;
      x = X + (Math.random() < 0.6 ? pick([rnd(-18, 30), rnd(w - 30, w + 18)]) : rnd(0, w));
      len = rnd(8, 70) * (0.6 + k * 0.4);
      y = up ? Y + rnd(-4, 10) : Y + h + rnd(-10, 4);
      g = ctx.createLinearGradient(0, y, 0, up ? y - len : y + len);
      var c = Math.random() < 0.12 ? pick(SLABS.slice(0, 2)) : pick(['120,110,98', '70,62,54', '190,180,165']);
      g.addColorStop(0, 'rgba(' + c + ',' + rnd(0.25, 0.6).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, up ? y - len : y, Math.random() < 0.8 ? 1 : 2, len);
    }
    /* shorter ones down the sides, crossing the edge */
    for(i = 0; i < 24 * k * Math.min(1, h / 200); i++){
      var left = Math.random() < 0.5;
      if(left ? !has('l') : !has('r')) continue;
      x = X + (left ? rnd(-14, 6) : rnd(w - 6, w + 14));
      y = Y + rnd(0, h); len = rnd(6, 40);
      ctx.fillStyle = 'rgba(' + pick(['120,110,98', '190,180,165']) + ',' + rnd(0.15, 0.4).toFixed(2) + ')';
      ctx.fillRect(x, y, 1, len);
    }
    /* colour slabs, copied off somewhere just outside the edge */
    for(i = 0; i < 4 * k; i++){
      var sw = rnd(14, 70), sh = rnd(3, 14), side = pick(r.sides.split(''));
      x = side === 'l' ? X - sw - rnd(0, 10) : side === 'r' ? X + w + rnd(0, 10) : X + rnd(0, w - sw);
      y = side === 't' ? Y - sh - rnd(0, 8) : side === 'b' ? Y + h + rnd(0, 8) : Y + rnd(0, h - sh);
      ctx.fillStyle = 'rgba(' + pick(SLABS) + ',' + rnd(0.18, 0.45).toFixed(2) + ')';
      ctx.fillRect(x, y, sw, sh);
    }
    /* scraps of sky that didn't break, lying across the hole */
    if(r.scraps){
      var calm = k < 1.5;   // settled: a couple of thin ones, so the text stays readable
      for(i = 0; i < (calm ? 2 : 6); i++){
        var bw = rnd(30, w * 0.6), bh = calm ? rnd(2, 6) : rnd(4, 18);
        x = X + pick([0, w - bw, rnd(0, w - bw)]); y = Y + rnd(0, h - bh);
        ctx.fillStyle = 'rgba(' + pick(['24,20,16', '30,25,20', '19,16,13']) + ',0.96)';
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = 'rgba(150,138,120,0.25)';
        ctx.fillRect(Math.random() < 0.5 ? x : x + bw - 1, y - rnd(2, 10), 1, bh + rnd(4, 20));
      }
    }
    /* stray glyphs from whatever is under the sky */
    ctx.font = '9px "Lucida Console", "JetBrains Mono", monospace';
    for(i = 0; i < 6 * k; i++){
      var gs = pick(r.sides.split(''));
      ctx.fillStyle = 'rgba(220,208,186,' + rnd(0.25, 0.55).toFixed(2) + ')';
      x = gs === 'l' ? X - rnd(10, 40) : gs === 'r' ? X + w + rnd(4, 30) : X + rnd(0, w);
      y = gs === 't' ? Y - rnd(6, 30) : gs === 'b' ? Y + h + rnd(10, 40) : Y + rnd(0, h);
      ctx.fillText(pick(GLYPHS), x, y);
    }
  };

  /* the slow broken-screen videos: each starts at its own point in the loop */
  var wrecks = Array.prototype.slice.call(document.querySelectorAll('[data-wreck]'));
  if(!still && wrecks.length){
    wrecks.forEach(function(v){
      v.addEventListener('loadedmetadata', function(){ v.currentTime = rnd(0, v.duration || 10); }, { once:true });
      v.playbackRate = 0.5;   // half speed: a slow drift, not a jitter
      v.defaultPlaybackRate = 0.5;
    });
    /* only overlays that are on show: a hidden one (the plate on a phone, the
       console and picture on narrow screens) is never fetched */
    var playW = function(){
      wrecks.forEach(function(v){
        if(!v.getClientRects().length){ if(!v.paused) v.pause(); return; }
        var q = v.play(); if(q && q.catch) q.catch(function(){});
      });
    };
    if(document.readyState === 'complete') playW(); else addEventListener('load', playW, { once:true });
    document.addEventListener('visibilitychange', function(){
      if(document.hidden) wrecks.forEach(function(v){ v.pause(); }); else playW();
    });
    /* a window resized wider can bring hidden overlays into view */
    var wreckResize = 0;
    addEventListener('resize', function(){ clearTimeout(wreckResize); wreckResize = setTimeout(playW, 400); });
  }

  /* ── the tear the console shows through ── */
  var tear = $('tear');
  var glitch = function(){};
  if(tear){
    var hole = tear.querySelector('.tear-hole'), fx = tear.querySelector('.tear-fx');
    var PX = 70, PY = 60;   // how far the canvas reaches past the hole (see .tear-fx)
    var tw = 0, th = 0;
    var shape = function(amt){ hole.style.clipPath = stepped(tw, th, amt, 'trbl'); };
    var paint = function(k){
      paintEdges(fitCanvas(fx, tw + PX * 2, th + PY * 2), { x:PX, y:PY, w:tw, h:th, sides:'trbl', scraps:true }, k);
    };
    var measure = function(){ tw = tear.offsetWidth; th = tear.offsetHeight; };
    var settle = function(){ shape(24); paint(1); hole.style.transform = ''; };
    var timer = 0, busy = false, lastGlitch = 0;
    /* a burst: a few quick reshapes with the console jolting, then a new calm shape */
    glitch = function(power, frames){
      if(busy || still || document.hidden || !tw) return;
      busy = true; lastGlitch = Date.now();
      var n = 0;
      (function step(){
        if(n++ >= frames){ busy = false; settle(); return; }
        shape(34 + 40 * power);
        paint(1 + power);
        hole.style.transform = 'translateX(' + (rnd(-7, 7) * power).toFixed(1) + 'px)';
        setTimeout(step, rnd(90, 160));
      })();
    };
    var idle = function(){
      clearTimeout(timer);
      timer = setTimeout(function(){ glitch(1, 4 + Math.floor(Math.random() * 3)); idle(); }, rnd(8000, 15000));
    };

    measure();
    if(tw){
      /* it opens from a sliver */
      hole.style.clipPath = 'polygon(0 45%, 100% 45%, 100% 55%, 0 55%)';
      if(still) settle();
      else setTimeout(function(){ glitch(1.2, 7); idle(); }, 900);
    }
    /* the height follows the text: reshape whenever it changes size */
    var resized = function(){
      var w = tw, h = th; measure();
      if(tw && (tw !== w || th !== h) && !busy) settle();
    };
    if(window.ResizeObserver) new ResizeObserver(resized).observe(tear);
    else addEventListener('resize', resized);
    if(ms) ms.addEventListener('input', function(){ if(Date.now() - lastGlitch > 700) glitch(0.5, 2); });
  }

  /* ── the card and the picture: torn out of the sky the same way ──
     Slower than the console: they reshape every 13-22s, a frame every
     180-280ms, like an old screen losing hold. The ledger keeps its shape
     while someone is writing on it, so the fields never move under them. */
  var poster = document.querySelector('.poster');
  var cardFx = document.querySelector('.wreck-fx');
  if(poster && cardFx){
    var plate = poster.querySelector('.poster-art'), panel = poster.querySelector('.form-panel');
    var bar = poster.querySelector(':scope > .xp-bar'), attach = poster.querySelector('.attach');
    var aCv = attach && attach.querySelector('.attach-glitch'), aImg = attach && attach.querySelector('img');
    /* each piece: which of its edges face the sky, and how deep its notches
       go. Side by side the plate's left edge is open sky; stacked (phones)
       the plate sits on the ledger, so only their outer sides tear. */
    var stacked = matchMedia('(max-width:900px)');
    var pieces = [
      { el:plate, sides:'lb', stackedSides:'lr', amt:30 },
      { el:panel, sides:'rb', stackedSides:'lrb', amt:30, writable:true },
      { el:bar, sides:'tlr', amt:12 },
      { el:attach, sides:'trbl', amt:22 }
    ].filter(function(pc){ return pc.el; });
    var sidesOf = function(pc){ return stacked.matches && pc.stackedSides ? pc.stackedSides : pc.sides; };
    var depth = function(pc){ return stacked.matches ? Math.min(pc.amt, 12) : pc.amt; };
    var writing = function(){ return panel && panel.matches(':focus-within'); };
    var visible = function(el){ return el.offsetWidth && getComputedStyle(el).display !== 'none'; };

    var cardShape = function(power){
      pieces.forEach(function(pc){
        if(!visible(pc.el) || (pc.writable && writing() && pc.el.style.clipPath)) return;
        pc.el.style.clipPath = stepped(pc.el.offsetWidth, pc.el.offsetHeight, depth(pc) * (1 + power * 1.2), sidesOf(pc));
      });
    };
    var cardPaint = function(k){
      var ctx = fitCanvas(cardFx, cardFx.offsetWidth, cardFx.offsetHeight);
      /* the canvas starts past the poster's top left (see .wreck-fx) */
      var FX_L = -cardFx.offsetLeft, FX_T = -cardFx.offsetTop;
      pieces.forEach(function(pc){
        if(pc.el === bar || !visible(pc.el)) return;
        paintEdges(ctx, { x:pc.el.offsetLeft + FX_L, y:pc.el.offsetTop + FX_T, w:pc.el.offsetWidth, h:pc.el.offsetHeight,
          sides:sidesOf(pc), scraps:false }, k * 0.7);
      });
    };

    /* the picture's own glitch: bands slip sideways, red and cyan copies split off */
    var tints = null, actx = aCv && aCv.getContext('2d');
    var tint = function(col){
      var c = document.createElement('canvas');
      c.width = aImg.naturalWidth; c.height = aImg.naturalHeight;
      var x = c.getContext('2d');
      x.drawImage(aImg, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(aImg, 0, 0);
      return c;
    };
    var picFrame = function(){
      if(!actx || !aImg.complete || !aImg.naturalWidth) return;
      var w = aImg.naturalWidth, h = aImg.naturalHeight;
      if(aCv.width !== w){ aCv.width = w; aCv.height = h; }
      if(!tints) tints = [tint('#ff2a3a'), tint('#2affee')];
      actx.clearRect(0, 0, w, h);
      actx.globalCompositeOperation = 'screen'; actx.globalAlpha = 0.45;
      actx.drawImage(tints[0], -rnd(3, 7), 0);
      actx.drawImage(tints[1], rnd(3, 7), 0);
      actx.globalCompositeOperation = 'source-over'; actx.globalAlpha = 1;
      for(var i = 0, n = 3 + Math.floor(Math.random() * 4); i < n; i++){
        var y = rnd(0, h - 30), bh = rnd(3, 28), sh = rnd(-24, 24);
        actx.fillStyle = 'rgba(8,7,6,0.92)';
        actx.fillRect(0, y, w, bh);
        actx.drawImage(aImg, 0, y, w, bh, sh, y, w, bh);
      }
    };

    var cardSettle = function(){
      cardShape(0); cardPaint(1);
      if(plate) plate.style.transform = '';
      if(attach) attach.style.translate = '';
      if(actx) actx.clearRect(0, 0, aCv.width, aCv.height);
    };
    var cardBusy = false;
    var cardGlitch = function(){
      if(cardBusy || still || document.hidden || !poster.offsetWidth) return;
      cardBusy = true;
      var n = 0, frames = 3 + Math.floor(Math.random() * 2);
      (function step(){
        if(n++ >= frames){ cardBusy = false; cardSettle(); return; }
        cardShape(1); cardPaint(2);
        if(plate) plate.style.transform = 'translateX(' + rnd(-5, 5).toFixed(1) + 'px)';
        if(attach && visible(attach)){ attach.style.translate = rnd(-6, 6).toFixed(1) + 'px 0'; picFrame(); }
        setTimeout(step, rnd(180, 280));
      })();
    };

    cardSettle();
    if(window.ResizeObserver) new ResizeObserver(function(){ if(!cardBusy) cardSettle(); }).observe(poster);
    if(aImg && !aImg.complete) aImg.addEventListener('load', function(){ if(!cardBusy) cardSettle(); }, { once:true });
    if(!still) (function next(){ setTimeout(function(){ cardGlitch(); next(); }, rnd(13000, 22000)); })();
  }

  /* ── the form status, mirrored under the card for the hologram tone ── */
  var fStatus = $('form-status'), hStatus = $('holo-status');
  if(fStatus && hStatus && window.MutationObserver){
    var mirror = function(){ hStatus.textContent = fStatus.textContent; hStatus.className = 'holo-status ' + fStatus.className.replace('form-status', '').trim(); };
    new MutationObserver(mirror).observe(fStatus, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  /* ── sending: dial-up box + console report, driven by the send button ── */
  var send = $('send'), dial = $('dialup'), dialStatus = $('dialup-status'), dialFill = $('dialup-fill'), formStatus = $('form-status');
  var STEPS = ['Dialing...', 'Verifying username and password...', 'Registering your computer on the network...', 'Sending...'];
  var stepTimer = 0;
  function startDial(){
    tail = 'C:\\> transmit --baud 56000\n connecting [          ]';
    render();
    if(!dial) return;
    var i = 0;
    dial.hidden = false;
    (function next(){
      dialStatus.textContent = STEPS[i];
      dialFill.style.width = Math.round((i + 1) / STEPS.length * 92) + '%';
      tail = 'C:\\> transmit --baud 56000\n connecting [' + '##########'.slice(0, (i + 1) * 2) + '          '.slice((i + 1) * 2) + ']';
      render();
      if(i < STEPS.length - 1){ i++; stepTimer = setTimeout(next, 700); }
    })();
  }
  function endDial(){
    clearTimeout(stepTimer);
    var ok = formStatus && formStatus.classList.contains('ok');
    if(dial){
      dialStatus.textContent = ok ? 'Connected.' : 'Disconnected.';
      dialFill.style.width = ok ? '100%' : dialFill.style.width;
      setTimeout(function(){ dial.hidden = true; }, ok ? 900 : 1400);
    }
    tail = 'C:\\> transmit --baud 56000\n ' + (ok ? 'TRANSMISSION SENT. awaiting reply...' : 'ERROR: carrier lost. retry?');
    render();
  }
  if(send && window.MutationObserver){
    new MutationObserver(function(){ send.disabled ? startDial() : endDial(); })
      .observe(send, { attributes:true, attributeFilter:['disabled'] });
  }

  /* ── the balloon: once, a few seconds in, gone after a while ── */
  var balloon = $('xp-balloon');
  if(balloon){
    var hide = function(){ balloon.hidden = true; };
    setTimeout(function(){
      balloon.hidden = false;
      setTimeout(hide, 9000);
    }, 4500);
    balloon.addEventListener('click', function(e){
      hide();
      if(e.target.classList.contains('xp-balloon-x')) return;
      if(ms) ms.focus();
    });
  }
})();
