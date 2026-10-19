/* Page editor: a design overlay for a copy of a built page.
 *
 * Not shipped with the site. scripts/page-editor/make-copy.mjs injects it
 * into a copy of dist/index.html so Samuel can restyle the homepage in the
 * browser (fonts, sizes, colours, spacing, wording, hiding blocks), then
 * export the list of changes for Claude to fold into src/pages/index.astro.
 *
 * Everything lives in a shadow root so the page's CSS can't touch the panel.
 * Work is saved in localStorage (when the browser allows it) so a reload
 * doesn't lose it.
 */
(function () {
  'use strict';
  if (window.__pageEditor) return;
  window.__pageEditor = true;

  var KEY = 'page-editor:' + location.pathname;
  var FONTS = [
    ['', '(unchanged)'],
    ["'Inter', sans-serif", 'Inter'],
    ["'Inter Tight', sans-serif", 'Inter Tight'],
    ["'JetBrains Mono', monospace", 'JetBrains Mono'],
    ["'Cormorant Garamond', serif", 'Cormorant Garamond'],
    ['system-ui, sans-serif', 'System UI'],
    ['Georgia, serif', 'Georgia'],
    ['Helvetica, Arial, sans-serif', 'Helvetica / Arial'],
  ];
  // property, label, unit, min, max, step
  var NUMS = [
    ['font-size', 'Size', 'px', 6, 160, 1],
    ['line-height', 'Line height', '', 0.6, 3, 0.05],
    ['letter-spacing', 'Letter spacing', 'em', -0.1, 0.4, 0.005],
    ['max-width', 'Max width', 'px', 0, 2000, 10],
    ['margin-top', 'Space above', 'px', -200, 400, 2],
    ['margin-bottom', 'Space below', 'px', -200, 400, 2],
    ['padding-top', 'Padding top', 'px', 0, 400, 2],
    ['padding-bottom', 'Padding bottom', 'px', 0, 400, 2],
    ['padding-left', 'Padding left', 'px', 0, 400, 2],
    ['padding-right', 'Padding right', 'px', 0, 400, 2],
    ['opacity', 'Opacity', '', 0, 1, 0.05],
  ];

  /* ── state ─────────────────────────────────────────────────────── */
  // edits: { [selector]: { label, text, styles:{prop:{from,to}}, hidden, newText, note } }
  var edits = {};
  var picking = true, sel = null, selKey = null;

  function load() {
    try { edits = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { edits = {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch (_) {}
  }

  /* ── selectors ─────────────────────────────────────────────────── */
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'); }
  function selectorFor(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      if (el.id) { parts.unshift('#' + cssEsc(el.id)); break; }
      var part = el.tagName.toLowerCase();
      var cls = Array.prototype.filter.call(el.classList, function (c) { return !/^(is-|has-|lit|motion)/.test(c); });
      if (cls.length) part += '.' + cls.slice(0, 2).map(cssEsc).join('.');
      var p = el.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(part);
      el = p;
    }
    return parts.join(' > ');
  }
  function snippet(el) {
    var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  function label(el) {
    var l = el.tagName.toLowerCase();
    if (el.id) l += '#' + el.id;
    else if (el.classList.length) l += '.' + el.classList[0];
    return l;
  }

  /* ── applying edits to the page ────────────────────────────────── */
  function find(key) { try { return document.querySelector(key); } catch (_) { return null; } }
  function applyOne(key) {
    var e = edits[key], el = find(key);
    if (!el || !e) return;
    Object.keys(e.styles || {}).forEach(function (p) {
      el.style.setProperty(p, e.styles[p].to, 'important');
    });
    if (e.hidden) el.style.setProperty('display', 'none', 'important');
    if (e.newText != null && el.innerText !== e.newText) el.innerText = e.newText;
  }
  function applyAll() { Object.keys(edits).forEach(applyOne); }

  function entry(el) {
    var key = selectorFor(el);
    if (!edits[key]) edits[key] = { label: label(el), text: snippet(el), styles: {} };
    return { key: key, e: edits[key] };
  }
  function setStyle(el, prop, value) {
    var x = entry(el), cs = getComputedStyle(el);
    if (!x.e.styles[prop]) x.e.styles[prop] = { from: cs.getPropertyValue(prop) };
    if (value === '' || value == null) {
      delete x.e.styles[prop];
      el.style.removeProperty(prop);
    } else {
      x.e.styles[prop].to = value;
      el.style.setProperty(prop, value, 'important');
    }
    tidy(x.key); save(); renderList();
  }
  function tidy(key) {
    var e = edits[key];
    if (e && !Object.keys(e.styles).length && !e.hidden && e.newText == null && !e.note) delete edits[key];
  }
  function resetEl(key) {
    var e = edits[key], el = find(key);
    if (el && e) {
      Object.keys(e.styles).forEach(function (p) { el.style.removeProperty(p); });
      if (e.hidden) el.style.removeProperty('display');
    }
    delete edits[key]; save();
    if (e && e.newText != null) toast('Reload the page to bring back the original text');
  }

  /* ── panel ─────────────────────────────────────────────────────── */
  var host = document.createElement('div');
  host.id = 'page-editor-host';
  host.style.cssText = 'position:fixed;inset:auto 0 0 auto;z-index:2147483647;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.pane{position:fixed;top:12px;right:12px;bottom:12px;width:min(340px,calc(100vw - 24px));display:flex;flex-direction:column;',
    '  background:#fbfbfd;color:#16181d;border:1px solid #d6d9e0;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:13px;overflow:hidden}',
    '.pane.min{bottom:auto}',
    '.pane.min .body{display:none}',
    'header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #e3e5ea;background:#f1f2f6}',
    'header b{flex:1;font-size:13px}',
    'button{font:inherit;font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid #c9ccd4;background:#fff;color:#16181d;cursor:pointer}',
    'button:hover{background:#eef0f5}',
    'button.on{background:#2f5bd8;border-color:#2f5bd8;color:#fff}',
    'button.warn{color:#b3261e;border-color:#e3b4b0}',
    '.body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:14px}',
    '.hint{color:#5c6170;font-size:12px;line-height:1.45;margin:0}',
    '.card{border:1px solid #e3e5ea;border-radius:9px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:8px}',
    '.tag{font:12px ui-monospace,Menlo,monospace;color:#2f5bd8;word-break:break-all}',
    '.txt{color:#5c6170;font-size:12px}',
    '.row{display:grid;grid-template-columns:96px 1fr 64px;align-items:center;gap:8px}',
    '.row label{font-size:12px;color:#3b3f4a}',
    '.row input[type=range]{width:100%}',
    '.row input[type=text],.row input[type=number],select,textarea{width:100%;font:inherit;font-size:12px;padding:5px 6px;border:1px solid #c9ccd4;border-radius:6px;background:#fff;color:#16181d}',
    '.row.two{grid-template-columns:96px 1fr}',
    'textarea{min-height:60px;resize:vertical}',
    '.btns{display:flex;flex-wrap:wrap;gap:6px}',
    'h4{margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5c6170}',
    'ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}',
    'li{border:1px solid #e3e5ea;border-radius:8px;padding:7px 8px;background:#fff;display:flex;gap:6px;align-items:flex-start}',
    'li div{flex:1;min-width:0;font-size:12px;line-height:1.4}',
    'li .what{color:#5c6170;word-break:break-word}',
    'li button{padding:3px 7px}',
    'footer{padding:10px 12px;border-top:1px solid #e3e5ea;display:flex;gap:6px;flex-wrap:wrap;background:#f1f2f6}',
    'footer button.main{background:#2f5bd8;border-color:#2f5bd8;color:#fff}',
    'footer textarea{flex-basis:100%;min-height:140px;font:11px ui-monospace,Menlo,monospace}',
    '.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#16181d;color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}',
    '.toast.show{opacity:1}',
    '.box{position:fixed;pointer-events:none;border:2px solid #2f5bd8;background:rgba(47,91,216,.08);border-radius:3px;z-index:1;display:none}',
    '.box.sel{border-color:#e8590c;background:rgba(232,89,12,.06)}',
    '.box span{position:absolute;left:-2px;top:-20px;background:#2f5bd8;color:#fff;font:11px ui-monospace,Menlo,monospace;padding:2px 5px;border-radius:3px;white-space:nowrap}',
    '.box.sel span{background:#e8590c}',
  ].join('\n') + '</style>' +
    '<div class="box hover"><span></span></div><div class="box sel"><span></span></div>' +
    '<div class="pane">' +
    '  <header><b>Page editor</b><button data-act="pick" class="on" title="Click things on the page to select them">Select</button><button data-act="min" title="Fold the panel">–</button></header>' +
    '  <div class="body">' +
    '    <p class="hint" data-ref="hint">Turn on <b>Select</b>, then click anything on the page. Change it here. Esc stops selecting so links and buttons work again. When you\'re done, press <b>Copy changes</b> and paste the result to Claude. Your work is kept in this browser if you reload.</p>' +
    '    <div class="card" data-ref="ed" hidden></div>' +
    '    <h4>Changes</h4><ul data-ref="list"></ul>' +
    '  </div>' +
    '  <footer><button class="main" data-act="copy">Copy changes</button><button data-act="show">Show as text</button><button data-act="clear" class="warn">Clear all</button><textarea data-ref="out" readonly hidden></textarea></footer>' +
    '</div><div class="toast"></div>';
  var $ = function (s) { return root.querySelector(s); };
  var pane = $('.pane'), boxH = $('.box.hover'), boxS = $('.box.sel'), edBox = $('[data-ref=ed]'), list = $('[data-ref=list]'), toastEl = $('.toast');

  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function place(box, el) {
    if (!el) { box.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = r.left - 2 + 'px'; box.style.top = r.top - 2 + 'px';
    box.style.width = r.width + 4 + 'px'; box.style.height = r.height + 4 + 'px';
    box.querySelector('span').textContent = label(el) + '  ' + Math.round(r.width) + '×' + Math.round(r.height);
  }

  /* ── the selected element's controls ───────────────────────────── */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? '' : n; }
  function toHex(c) {
    var m = c.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return '#000000';
    return '#' + m.slice(0, 3).map(function (x) { return ('0' + Math.round(+x).toString(16)).slice(-2); }).join('');
  }
  function current(prop, cs) {
    var v = cs.getPropertyValue(prop);
    if (prop === 'letter-spacing') {
      if (v === 'normal') return 0;
      return +(num(v) / num(cs.fontSize)).toFixed(3);
    }
    if (prop === 'line-height') {
      if (v === 'normal') return 1.2;
      return +(num(v) / num(cs.fontSize)).toFixed(2);
    }
    if (prop === 'max-width' && v === 'none') return '';
    var n = num(v);
    return n === '' ? '' : Math.round(n * 100) / 100;
  }

  function renderEditor() {
    if (!sel) { edBox.hidden = true; place(boxS, null); return; }
    edBox.hidden = false;
    var cs = getComputedStyle(sel), key = selectorFor(sel), e = edits[key] || { styles: {} };
    var h = '';
    h += '<div class="tag">' + esc(key) + '</div>';
    h += '<div class="txt">' + esc(snippet(sel) || '(no text)') + '</div>';
    h += '<div class="btns"><button data-act="parent">Select parent</button><button data-act="child">First child</button></div>';
    h += '<div class="row two"><label>Font</label><select data-prop="font-family">' +
      FONTS.map(function (f) { return '<option value="' + esc(f[0]) + '"' + (e.styles['font-family'] && e.styles['font-family'].to === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') +
      '</select></div>';
    h += '<div class="txt">Now: ' + esc(cs.fontFamily.split(',')[0].replace(/["\']/g, '')) + ', ' + cs.fontWeight + ', ' + Math.round(num(cs.fontSize) * 10) / 10 + 'px</div>';
    h += '<div class="row two"><label>Weight</label><select data-prop="font-weight">' +
      ['', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map(function (w) {
        return '<option value="' + w + '"' + ((e.styles['font-weight'] && e.styles['font-weight'].to === w) ? ' selected' : '') + '>' + (w || '(unchanged: ' + cs.fontWeight + ')') + '</option>';
      }).join('') + '</select></div>';
    NUMS.forEach(function (n) {
      var cur = e.styles[n[0]] ? num(e.styles[n[0]].to) : current(n[0], cs);
      h += '<div class="row"><label>' + n[1] + '</label><input type="range" data-num="' + n[0] + '" min="' + n[3] + '" max="' + n[4] + '" step="' + n[5] + '" value="' + (cur === '' ? n[3] : cur) + '">' +
        '<input type="number" data-num="' + n[0] + '" step="' + n[5] + '" value="' + cur + '"></div>';
    });
    h += '<div class="row two"><label>Colour</label><input type="color" data-prop="color" value="' + toHex(e.styles.color ? e.styles.color.to : cs.color) + '"></div>';
    h += '<div class="row two"><label>Align</label><select data-prop="text-align">' +
      ['', 'left', 'center', 'right', 'justify'].map(function (a) {
        return '<option value="' + a + '"' + ((e.styles['text-align'] && e.styles['text-align'].to === a) ? ' selected' : '') + '>' + (a || '(unchanged: ' + cs.textAlign + ')') + '</option>';
      }).join('') + '</select></div>';
    h += '<div class="row two"><label>Uppercase</label><select data-prop="text-transform">' +
      ['', 'none', 'uppercase', 'capitalize'].map(function (a) {
        return '<option value="' + a + '"' + ((e.styles['text-transform'] && e.styles['text-transform'].to === a) ? ' selected' : '') + '>' + (a || '(unchanged)') + '</option>';
      }).join('') + '</select></div>';
    h += '<div class="btns"><button data-act="text">' + (sel.isContentEditable ? 'Done editing text' : 'Edit text') + '</button>' +
      '<button data-act="hide" class="warn">' + (e.hidden ? 'Unhide' : 'Remove (hide)') + '</button>' +
      '<button data-act="reset">Reset this</button></div>';
    h += '<div class="row two"><label>Note for Claude</label><textarea data-ref="note" placeholder="e.g. make this match the blog title, or: delete this whole section">' + esc(e.note || '') + '</textarea></div>';
    edBox.innerHTML = h;
    place(boxS, sel);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  edBox.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!sel) return;
    if (t.dataset.num) {
      var spec = NUMS.filter(function (n) { return n[0] === t.dataset.num; })[0];
      var twin = edBox.querySelectorAll('[data-num="' + t.dataset.num + '"]');
      twin.forEach(function (o) { if (o !== t) o.value = t.value; });
      setStyle(sel, spec[0], t.value === '' ? '' : t.value + spec[2]);
      place(boxS, sel);
    } else if (t.dataset.prop) {
      setStyle(sel, t.dataset.prop, t.value);
      place(boxS, sel);
    } else if (t.dataset.ref === 'note') {
      var x = entry(sel);
      x.e.note = t.value.trim() || undefined;
      tidy(x.key); save(); renderList();
    }
  });
  edBox.addEventListener('change', function (ev) {
    if (ev.target.tagName === 'SELECT') renderEditor();
  });
  edBox.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b || !sel) return;
    var act = b.dataset.act;
    if (act === 'parent' && sel.parentElement && sel.parentElement !== document.documentElement) select(sel.parentElement);
    else if (act === 'child' && sel.firstElementChild) select(sel.firstElementChild);
    else if (act === 'hide') {
      var x = entry(sel);
      x.e.hidden = !x.e.hidden || undefined;
      if (x.e.hidden) sel.style.setProperty('display', 'none', 'important'); else sel.style.removeProperty('display');
      tidy(x.key); save(); renderList(); renderEditor();
    } else if (act === 'reset') { resetEl(selectorFor(sel)); renderList(); renderEditor(); }
    else if (act === 'text') toggleText();
  });

  function toggleText() {
    if (sel.isContentEditable) {
      sel.contentEditable = 'false';
      var x = entry(sel), now = sel.innerText;
      if (now.replace(/\s+/g, ' ').trim() !== (x.e.originalFull || '').replace(/\s+/g, ' ').trim()) x.e.newText = now;
      delete x.e.originalFull;
      tidy(x.key); save(); renderList();
    } else {
      var y = entry(sel);
      if (y.e.originalFull == null) y.e.originalFull = sel.innerText;
      sel.contentEditable = 'true'; sel.focus();
      picking = false; syncPick();
    }
    renderEditor();
  }

  /* ── the change list ───────────────────────────────────────────── */
  function describe(e) {
    var bits = [];
    Object.keys(e.styles || {}).forEach(function (p) { bits.push(p + ': ' + e.styles[p].to); });
    if (e.hidden) bits.push('removed');
    if (e.newText != null) bits.push('text: "' + (e.newText.length > 50 ? e.newText.slice(0, 47) + '…' : e.newText) + '"');
    if (e.note) bits.push('note: ' + e.note);
    return bits.join(' · ');
  }
  function renderList() {
    var keys = Object.keys(edits);
    if (!keys.length) { list.innerHTML = '<li><div class="what">No changes yet.</div></li>'; return; }
    list.innerHTML = keys.map(function (k) {
      var e = edits[k];
      return '<li><div><b>' + esc(e.label) + '</b> <span class="what">' + esc(e.text ? '“' + e.text.slice(0, 40) + '”' : '') + '</span><div class="what">' + esc(describe(e)) + '</div></div>' +
        '<button data-go="' + esc(k) + '" title="Select it">↗</button><button data-undo="' + esc(k) + '" title="Undo this">✕</button></li>';
    }).join('');
  }
  list.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.go) { var el = find(b.dataset.go); if (el) { el.scrollIntoView({ block: 'center' }); select(el); } else toast('Not on the page any more'); }
    if (b.dataset.undo) { resetEl(b.dataset.undo); renderList(); renderEditor(); }
  });

  /* ── export ────────────────────────────────────────────────────── */
  function report() {
    var keys = Object.keys(edits);
    var out = {
      page: location.pathname,
      made: new Date().toISOString(),
      viewport: innerWidth + 'x' + innerHeight,
      changes: keys.map(function (k) {
        var e = edits[k], c = { selector: k, element: e.label, text: e.text };
        if (Object.keys(e.styles).length) {
          c.styles = {};
          Object.keys(e.styles).forEach(function (p) { c.styles[p] = e.styles[p].from + ' → ' + e.styles[p].to; });
        }
        if (e.hidden) c.remove = true;
        if (e.newText != null) c.newText = e.newText;
        if (e.note) c.note = e.note;
        return c;
      }),
    };
    return 'Page editor changes for ' + out.page + ' (' + keys.length + ')\n\n```json\n' + JSON.stringify(out, null, 2) + '\n```\n';
  }
  root.querySelector('footer').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'copy') {
      var text = report();
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(function () { toast('Copied. Paste it to Claude.'); })
        .catch(function () { showText(text); toast('Copy blocked here: select the text and copy it'); });
    } else if (b.dataset.act === 'show') showText(report());
    else if (b.dataset.act === 'clear') {
      // Some viewers (Claude's artifact frame) never show confirm(), so
      // clearing asks for a second press instead.
      if (b.dataset.armed) { edits = {}; save(); location.reload(); return; }
      b.dataset.armed = '1'; b.textContent = 'Press again to clear';
      setTimeout(function () { delete b.dataset.armed; b.textContent = 'Clear all'; }, 3000);
    }
  });
  function showText(text) {
    var out = root.querySelector('[data-ref=out]');
    out.hidden = false; out.value = text; out.focus(); out.select();
  }

  /* ── picking ───────────────────────────────────────────────────── */
  var hovered = null;
  function ours(ev) { return ev.composedPath().indexOf(host) !== -1; }
  function select(el) {
    if (sel && sel.isContentEditable && sel !== el) toggleText();
    sel = el; renderEditor();
  }
  // Animated text is split into a span per word or line; those pieces are
  // rebuilt on every load, so a click on one selects the whole block.
  function block(el) {
    var lit = el.closest('[data-scroll-lit], [data-reveal="lines"]');
    return lit || el;
  }
  function syncPick() {
    $('[data-act=pick]').classList.toggle('on', picking);
    document.documentElement.style.cursor = picking ? 'crosshair' : '';
    if (!picking) { hovered = null; place(boxH, null); }
  }
  document.addEventListener('pointerover', function (ev) {
    if (!picking || ours(ev)) return;
    hovered = block(ev.target); place(boxH, hovered);
  }, true);
  ['click', 'mousedown', 'pointerdown', 'mouseup', 'pointerup'].forEach(function (type) {
    document.addEventListener(type, function (ev) {
      if (!picking || ours(ev)) return;
      ev.preventDefault(); ev.stopPropagation();
      if (type === 'click') select(block(ev.target));
    }, true);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (sel && sel.isContentEditable) { toggleText(); return; }
      picking = false; syncPick();
    }
  }, true);
  var follow = function () { if (sel) place(boxS, sel); if (hovered) place(boxH, hovered); };
  addEventListener('scroll', follow, { passive: true, capture: true });
  addEventListener('resize', follow);

  pane.querySelector('header').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'pick') { picking = !picking; syncPick(); }
    if (b.dataset.act === 'min') { pane.classList.toggle('min'); b.textContent = pane.classList.contains('min') ? '+' : '–'; }
  });

  /* ── boot ──────────────────────────────────────────────────────── */
  function boot() {
    document.body.appendChild(host);
    load();
    // Scroll reveals hide blocks until they're scrolled to; in the editor
    // everything should be visible and still.
    var st = document.createElement('style');
    st.textContent = '[data-reveal],[data-reveal-group],[data-reveal-group]>*{visibility:visible!important;opacity:1!important;transform:none!important}';
    document.head.appendChild(st);
    // Apply saved work once the page's own scripts have built their DOM.
    applyAll(); setTimeout(applyAll, 1200); setTimeout(applyAll, 3000);
    renderList(); syncPick();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
