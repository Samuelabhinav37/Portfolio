/* Shared GMT clock + Open-Meteo weather widget logic. Previously
   reimplemented identically in SiteMenu.astro's script (used on /, /about,
   /contact, /blog) and blog-client.js (used on individual blog posts, which
   don't render SiteMenu). Both now import from here; each keeps its own
   surrounding DOM wiring since the two live in different markup. */

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n) => (n < 10 ? '0' : '') + n;

/** live GMT (UTC) clock — single line: GMT DD MON YY  HH:MM:SS */
export function renderClock(el) {
  if (!el) return;
  function upd() {
    const d = new Date();
    const u = new Date(d.getTime() + d.getTimezoneOffset() * 60000); // -> UTC/GMT
    el.innerHTML =
      '<span class="d1">GMT</span> ' + pad(u.getDate()) + ' ' + MON[u.getMonth()] + ' ' +
      String(u.getFullYear()).slice(2) + ' ' +
      pad(u.getHours()) + ':' + pad(u.getMinutes()) + ':' + pad(u.getSeconds());
  }
  upd();
  return setInterval(upd, 1000);
}

const WMO = {
  0: 'CLEAR', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOG', 48: 'RIME FOG', 51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'HEAVY DRIZZLE',
  61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN', 71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW',
  80: 'RAIN SHOWERS', 81: 'RAIN SHOWERS', 82: 'VIOLENT SHOWERS',
  95: 'THUNDERSTORM', 96: 'THUNDERSTORM', 99: 'THUNDERSTORM',
};

function iconFor(code) {
  if (code === 0 || code === 1) return '☀';
  if (code === 2) return '⛅';
  if (code === 3 || code === 45 || code === 48) return '☁';
  if (code >= 51 && code <= 65) return '☂';
  if (code >= 71 && code <= 75) return '❄';
  if (code >= 80 && code <= 82) return '☂';
  if (code >= 95) return '⚡';
  return '☁';
}

/** live weather — Open-Meteo (no API key), fixed coordinates by default. */
export function renderWeather(el, { lat = 36.78, lon = -119.42, city = 'CALIFORNIA' } = {}) {
  if (!el) return;
  function render(tempF, code) {
    el.innerHTML =
      '<span class="mw-icon">' + iconFor(code) + '</span> ' +
      '<span class="mw-city">' + city + '</span><br>' +
      Math.round(tempF) + '° ' + (WMO[code] || '—');
  }
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,weather_code&temperature_unit=fahrenheit';
  fetch(url)
    .then((r) => r.json())
    .then((j) => {
      const c = j && j.current;
      if (c) render(c.temperature_2m, c.weather_code);
    })
    .catch(() => { el.innerHTML = '<span class="mw-city">' + city + '</span>'; });
}
