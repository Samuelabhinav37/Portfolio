/* Contact page form handler — validates, posts to /api/contact, announces the result. Extracted from an inline <script> block, unmodified. */
/* ══════════ CONTACT FORM ══════════
   The old handler was a lie: it printed "✓ Message sent" after a 700ms
   timeout, with no validation, no backend, and no way for anyone to tell that
   nothing had been sent. It also fired on every click, so a bored visitor could
   stack a dozen "sends".

   Now: validate, block double-submit, announce the result to a live region,
   and POST for real, to the Cloudflare Pages Function at /api/contact (see
   functions/api/contact.js), which relays via Resend. Sends JSON and treats
   any 2xx as success; on failure it falls back to showing FALLBACK so the
   visitor still has a way to reach out.                                       */
(function(){
  "use strict";

  var ENDPOINT = '/api/contact';
  var FALLBACK = 'samuelabhinav37@gmail.com';

  var form   = document.getElementById('contact-form');
  var btn    = document.getElementById('send');
  var status = document.getElementById('form-status');
  if(!form || !btn || !status) return;

  var F = {
    nm: document.getElementById('nm'),
    em: document.getElementById('em'),
    ms: document.getElementById('ms')
  };
  var busy = false;

  /* deliberately permissive — the server is the real validator; this is only
     here to catch the obvious typo before it costs a round trip */
  function emailish(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function mark(key, bad){
    var wrap = form.querySelector('[data-field="' + key + '"]');
    if(wrap) wrap.classList.toggle('invalid', !!bad);
    F[key].setAttribute('aria-invalid', bad ? 'true' : 'false');
  }
  function say(msg, cls){
    status.textContent = msg;
    status.className = 'form-status' + (cls ? ' ' + cls : '');
  }

  function validate(){
    var bad = null;
    var nm = F.nm.value.trim(), em = F.em.value.trim(), ms = F.ms.value.trim();
    mark('nm', !nm);            if(!nm) bad = bad || F.nm;
    mark('em', !emailish(em));  if(!emailish(em)) bad = bad || F.em;
    mark('ms', ms.length < 2);  if(ms.length < 2) bad = bad || F.ms;
    if(bad){ bad.focus(); say('Three fields, that\u2019s all.', 'bad'); return null; }
    var turnstileToken = (window.turnstile && window.turnstile.getResponse) ? window.turnstile.getResponse() : '';
    return { name:nm, email:em, message:ms, company:(form.company ? form.company.value : ''), turnstileToken:turnstileToken };
  }

  /* clear an error the moment the visitor starts fixing it */
  Object.keys(F).forEach(function(k){
    F[k].addEventListener('input', function(){
      var wrap = form.querySelector('[data-field="' + k + '"]');
      if(wrap && wrap.classList.contains('invalid')) mark(k, false);
    });
  });

  function done(ok, msg){
    busy = false;
    btn.disabled = false;
    btn.classList.toggle('sent', ok);
    btn.textContent = ok ? '\u2713 Message sent' : 'Send Message';
    say(msg, ok ? 'ok' : 'bad');
    if(window.turnstile && window.turnstile.reset) window.turnstile.reset();  /* tokens are single-use */
    if(ok) setTimeout(function(){
      btn.classList.remove('sent');
      btn.textContent = 'Send Message';
    }, 3200);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(busy) return;

    var data = validate();
    if(!data) return;
    if(data.company){ done(true, 'Received.'); return; }   /* honeypot: silent no-op */
    if(!data.turnstileToken){ say('Please complete the verification check.', 'bad'); return; }

    busy = true;
    btn.disabled = true;
    btn.textContent = 'Sending\u2026';
    say('Sending\u2026');

    if(!ENDPOINT){
      /* No backend wired. Say so, honestly, and give them the address. */
      setTimeout(function(){
        busy = false; btn.disabled = false; btn.textContent = 'Send Message';
        say('Channel not wired yet \u2014 mail ' + FALLBACK, 'bad');
      }, 500);
      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      form.reset();
      done(true, 'Received. I\u2019ll come back to you.');
    }).catch(function(){
      done(false, 'Didn\u2019t get through \u2014 mail ' + FALLBACK);
    });
  });
})();
