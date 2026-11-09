/* Homepage light/dark theme. Loaded without defer in <head> so the saved
   theme is set before the first paint. The toggle (#theme-toggle in
   SiteMenu) flips html[data-theme] and remembers it; in light mode a small
   picker (trial UI) chooses the sky: day, dawn or paper
   (html[data-light-sky]). 'theme:change' tells sky.js to switch tone. */
(() => {
  const root = document.documentElement;
  const SKIES = ['day', 'dawn', 'paper'];
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  if (get('home-theme') === 'light') root.setAttribute('data-theme', 'light');
  root.setAttribute('data-light-sky', SKIES.includes(get('home-light-sky')) ? get('home-light-sky') : 'day');
  const changed = () => document.dispatchEvent(new CustomEvent('theme:change'));
  addEventListener('load', changed); // deferred sky scripts have run by now

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const picker = document.createElement('div');
    picker.className = 'sky-pick';
    picker.setAttribute('role', 'radiogroup');
    picker.setAttribute('aria-label', 'Light sky');
    SKIES.forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.sky = name;
      b.textContent = name[0].toUpperCase() + name.slice(1);
      b.addEventListener('click', () => { root.setAttribute('data-light-sky', name); set('home-light-sky', name); sync(); changed(); });
      picker.appendChild(b);
    });
    document.body.appendChild(picker);
    const sync = () => {
      const light = root.getAttribute('data-theme') === 'light';
      btn.setAttribute('aria-pressed', String(light));
      btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
      picker.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.sky === root.getAttribute('data-light-sky'))));
    };
    sync();
    btn.addEventListener('click', () => {
      const light = root.getAttribute('data-theme') !== 'light';
      if (light) root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
      set('home-theme', light ? 'light' : 'dark');
      sync(); changed();
    });
  });
})();
