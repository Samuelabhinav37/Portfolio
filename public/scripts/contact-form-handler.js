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
  var reason = document.getElementById('rs');
  var busy = false;

  /* ── Turnstile: always on screen, never silently missing ──
     It used to load on the first interaction with the form, to spare
     visitors who never write ~600KB. That left an empty gap where the check
     should be, and when api.js failed (blocked, slow network) nothing said
     so. Now it loads as soon as the page is idle and renders explicitly, so
     every failure path is ours to handle: a "Loading verification…" note
     holds its place, Turnstile retries and refreshes expired tokens on its
     own, and if it errors or the script never arrives the visitor gets a
     plain message, a Try again button and the email address. */
  var tsBox   = document.getElementById('turnstile-widget');
  var tsNote  = document.getElementById('ts-note');
  var tsRetry = document.getElementById('ts-retry');
  var tsId = null, tsScript = null, tsTimer = 0;
  function tsState(state){
    if(!tsNote) return;
    tsNote.dataset.state = state;
    tsNote.querySelector('.ts-msg').textContent =
      state === 'loading' ? 'Loading verification\u2026' :
      state === 'failed'  ? 'The verification check didn\u2019t load.' : '';
    if(tsRetry) tsRetry.hidden = state !== 'failed';
  }
  function tsRender(){
    clearTimeout(tsTimer);
    if(!window.turnstile || !tsBox) return tsState('failed');
    try{
      if(tsId !== null){ window.turnstile.remove(tsId); tsId = null; }
      tsId = window.turnstile.render(tsBox, {
        sitekey: tsBox.dataset.sitekey,
        action:  tsBox.dataset.action,
        theme:   'dark',
        size:    'flexible',
        retry:   'auto',
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        callback:              function(){ tsState('ready'); },
        'error-callback':      function(){ tsState('failed'); },
        'unsupported-callback':function(){ tsState('failed'); }
      });
      tsState('ready');
    }catch(e){ tsState('failed'); }
  }
  window.__onTurnstileLoad = tsRender;
  function loadTurnstile(){
    if(window.turnstile) return tsRender();
    tsState('loading');
    if(tsScript) tsScript.remove();
    tsScript = document.createElement('script');
    tsScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad';
    tsScript.async = true;
    tsScript.addEventListener('error', function(){ clearTimeout(tsTimer); tsState('failed'); });
    document.head.appendChild(tsScript);
    clearTimeout(tsTimer);
    tsTimer = setTimeout(function(){ if(!window.turnstile) tsState('failed'); }, 10000);
  }
  if(tsRetry) tsRetry.addEventListener('click', loadTurnstile);
  if('requestIdleCallback' in window) requestIdleCallback(loadTurnstile, { timeout: 1500 });
  else setTimeout(loadTurnstile, 300);

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
    var turnstileToken = (window.turnstile && tsId !== null) ? (window.turnstile.getResponse(tsId) || '') : '';
    /* form field is named hp_topic (not "company") — see the honeypot
       comment in contact.astro; the JSON key sent to the server stays
       "company" since that's just our own payload shape, unrelated to the
       HTML field name that autofill engines key off of. */
    return { name:nm, email:em, message:ms, reason:(reason ? reason.value : ''), company:(form.hp_topic ? form.hp_topic.value : ''), turnstileToken:turnstileToken };
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
    if(ok && window.SITE && window.SITE.kaiMoment) window.SITE.kaiMoment('sent');
    /* the background sky launches a courier on send (contact-sky.js) */
    window.dispatchEvent(new CustomEvent(ok ? 'contact:sent' : 'contact:failed'));
    if(window.turnstile && tsId !== null) window.turnstile.reset(tsId);  /* tokens are single-use */
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
    if(!data.turnstileToken){
      if(!window.turnstile || (tsNote && tsNote.dataset.state === 'failed')){ loadTurnstile(); say('Verification didn\u2019t load. Try again, or email ' + FALLBACK, 'bad'); }
      else say('Please complete the verification check.', 'bad');
      return;
    }

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
