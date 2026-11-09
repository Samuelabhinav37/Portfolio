/* The nav's tool strip (NavTools.astro): tabs that swap the panel between
   the latest posts, the cursor picker and the Darknet Diaries player, plus
   the theme switch (handled by theme.js). The player never downloads or
   plays anything until Play is pressed; it remembers the episode and the
   spot, so after changing pages one press carries on where it stopped. */
(() => {
  'use strict';
  const nt = document.getElementById('nav-tools');
  if (!nt) return;
  const root = document.documentElement;
  const tabs = [...nt.querySelectorAll('.nt-tab[data-tab]')];
  const panes = [...nt.querySelectorAll('.nt-pane')];
  const narrow = matchMedia('(max-width: 1100px)');
  const SPEED = 28; // px a second, like the scrolling cells on About
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* the drifting lines: two copies of the run, moved one copy's width at SPEED */
  function drift(scope) {
    scope.querySelectorAll('.nt-track').forEach((t) => {
      const w = t.firstElementChild.offsetWidth;
      if (w) t.style.setProperty('--d', (w / SPEED).toFixed(1) + 's');
    });
  }

  /* tabs */
  let current = 'news';
  function show(name) {
    current = name;
    const open = !narrow.matches || nt.hasAttribute('data-open');
    panes.forEach((p) => { p.hidden = p.dataset.pane !== name; });
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(open && t.dataset.tab === name)));
    if (name === 'music') pod.init();
    if (open) drift(nt.querySelector(`.nt-pane[data-pane="${name}"]`));
  }
  const close = () => { if (nt.hasAttribute('data-open')) { nt.removeAttribute('data-open'); show(current); } };
  tabs.forEach((t) => t.addEventListener('click', () => {
    if (narrow.matches) {
      if (nt.hasAttribute('data-open') && current === t.dataset.tab) { close(); return; }
      nt.setAttribute('data-open', '');
    }
    show(t.dataset.tab);
  }));
  document.addEventListener('click', (e) => { if (narrow.matches && !nt.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  narrow.addEventListener('change', () => { nt.removeAttribute('data-open'); show(current); });

  /* cursors: theme.js applies the saved one before the first paint */
  const picks = [...nt.querySelectorAll('[data-cursor]')];
  const syncCursor = () => {
    const on = root.getAttribute('data-cursor') || 'arrow';
    picks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cursor === on)));
  };
  picks.forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.cursor;
    if (k === 'arrow') root.removeAttribute('data-cursor'); else root.setAttribute('data-cursor', k);
    try { localStorage.setItem('cursor', k); } catch (e) {}
    syncCursor();
  }));
  syncCursor();

  /* the podcast player */
  const pod = (() => {
    const pane = nt.querySelector('.nt-music');
    const line = pane.querySelector('.nt-ep');
    const playB = pane.querySelector('.nt-play');
    const nextB = pane.querySelector('.nt-next');
    const muteB = pane.querySelector('.nt-mute');
    const tab = nt.querySelector('.nt-tab[data-tab="music"]');
    let st = read('pod'); // { url, title, subtitle, t, muted }
    if (st && typeof st.url !== 'string') st = null;
    let list = null, loading = null, audio = null, lastSave = 0;

    const pick = (e) => ({ url: e.url, title: e.title, subtitle: e.subtitle || '', t: 0, muted: !!(st && st.muted) });
    const save = () => write('pod', st);
    function render() {
      // reads "Darknet Diaries  182: Blackshades  What if you got infected..."
      const fill = (sel, v) => line.querySelectorAll(sel).forEach((b) => { b.textContent = v || ''; b.hidden = !v; });
      fill('.nt-ep-t', st && st.title);
      fill('.nt-ep-s', st && st.subtitle);
      muteB.setAttribute('aria-pressed', String(!!(st && st.muted)));
      muteB.setAttribute('aria-label', st && st.muted ? 'Unmute' : 'Mute');
      if (!pane.hidden) drift(pane);
    }
    function load() {
      return loading || (loading = fetch('/api/podcast')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('podcast ' + r.status))))
        .then((d) => {
          list = Array.isArray(d.episodes) ? d.episodes : [];
          if (!st && list[0]) { st = pick(list[0]); render(); }
          else if (st && st.subtitle == null) { // saved before subtitles existed
            const e = list.find((x) => x.url === st.url);
            st.subtitle = (e && e.subtitle) || ''; save(); render();
          }
          return list;
        })
        .catch(() => { loading = null; return []; }));
    }
    function setPlaying(on) {
      playB.setAttribute('aria-pressed', String(on));
      playB.setAttribute('aria-label', on ? 'Pause' : 'Play');
      tab.classList.toggle('on-air', on);
    }
    function ensureAudio() {
      if (audio) return audio;
      audio = new Audio();
      audio.preload = 'none';
      audio.muted = !!(st && st.muted);
      audio.addEventListener('play', () => setPlaying(true));
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('timeupdate', () => {
        if (!st) return;
        st.t = audio.currentTime;
        if (Date.now() - lastSave > 5000) { lastSave = Date.now(); save(); }
      });
      audio.addEventListener('ended', () => next(true));
      return audio;
    }
    async function play() {
      if (!st) await load();
      if (!st) return;
      const a = ensureAudio();
      if (a.dataset.url !== st.url) {
        a.src = st.url;
        a.dataset.url = st.url;
        const t = st.t || 0;
        if (t > 1) a.addEventListener('loadedmetadata', () => { a.currentTime = t; }, { once: true });
      }
      a.play().catch(() => setPlaying(false));
    }
    async function next(keepPlaying) {
      const l = list || (await load());
      if (!l.length) return;
      const i = l.findIndex((e) => st && e.url === st.url);
      st = pick(l[(i + 1) % l.length]);
      save(); render();
      if (keepPlaying || (audio && !audio.paused)) play();
    }
    playB.addEventListener('click', () => { if (audio && !audio.paused) audio.pause(); else play(); });
    nextB.addEventListener('click', () => next(false));
    muteB.addEventListener('click', () => {
      if (!st) return;
      st.muted = !st.muted;
      if (audio) audio.muted = st.muted;
      save(); render();
    });
    addEventListener('pagehide', () => { if (audio && st) { st.t = audio.currentTime; save(); } });

    let ready = false;
    return { init() { if (ready) return; ready = true; render(); load(); } };
  })();

  show(current);
})();
