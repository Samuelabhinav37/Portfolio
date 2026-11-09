/* Site light/dark theme (SiteSky.astro). Loaded without defer in <head> so the saved
   theme is set before the first paint. The toggle (#theme-toggle in
   SiteMenu) flips html[data-theme] and remembers it; 'theme:change' tells
   sky.js to switch the sky between night and day. */
(() => {
  const root = document.documentElement;
  // 'home-theme' was the key while only the homepage had the switch
  try { if ((localStorage.getItem('theme') || localStorage.getItem('home-theme')) === 'light') root.setAttribute('data-theme', 'light'); } catch (e) {}
  const changed = () => document.dispatchEvent(new CustomEvent('theme:change'));
  addEventListener('load', changed); // deferred sky scripts have run by now
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const sync = () => {
      const light = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-pressed', String(light));
      btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    };
    sync();
    btn.addEventListener('click', () => {
      const light = root.getAttribute('data-theme') !== 'light';
      if (light) root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
      sync(); changed();
    });
  });
})();
