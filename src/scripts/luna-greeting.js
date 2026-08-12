/* Luna's drawer greeting — time-of-day, with rotating phrasing and a
   distinct set for returning visitors, so it doesn't read the same
   line every single time. Single source of truth, loaded from every
   page that has a Luna drawer (#ldw-greeting). */
(function () {
  "use strict";
  var greetEl = document.getElementById("ldw-greeting");
  if (!greetEl) return;

  var VISIT_KEY = "luna_last_visit";
  /* "Returning" should mean a genuine gap since last time — someone who left
     and came back — not literally every reload/page-nav after the first-ever
     visit. Without this window, the timestamp gets overwritten on every load,
     so isReturning flips true after visit #1 and stays true forever; the
     "first visit" lines become effectively dead. 30min: still counts as the
     same sitting if you're reloading/navigating around within it. */
  var RETURN_WINDOW_MS = 30 * 60 * 1000;
  var isReturning = false;
  try {
    var last = localStorage.getItem(VISIT_KEY);
    isReturning = !!last && (Date.now() - Number(last)) > RETURN_WINDOW_MS;
    localStorage.setItem(VISIT_KEY, String(Date.now()));
  } catch (e) {
    /* localStorage unavailable (private mode, etc.) — treat as first visit */
  }

  var h = new Date().getHours();
  var bucket = h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";

  var LINES = {
    night: {
      first: [
        "Late night. Welcome to the archive.",
        "Still up? I keep watch here too.",
        "Late night — glad you found your way in.",
      ],
      returning: [
        "Back at this hour — welcome back.",
        "Late night again. Good to see you.",
        "Burning the midnight oil, or just visiting? Either way, welcome back.",
      ],
    },
    morning: {
      first: [
        "Good morning. Welcome to the archive.",
        "Morning — glad you stopped by.",
        "Good morning. I keep watch over this archive.",
      ],
      returning: [
        "Good morning — welcome back.",
        "Morning again. Good to see you.",
        "Back already? Good morning.",
      ],
    },
    afternoon: {
      first: [
        "Good afternoon. Welcome to the archive.",
        "Afternoon — glad you stopped by.",
        "Good afternoon. I keep watch over this archive.",
      ],
      returning: [
        "Good afternoon — welcome back.",
        "Afternoon again. Good to see you.",
        "Back for more? Good afternoon.",
      ],
    },
    evening: {
      first: [
        "Good evening. Welcome to the archive.",
        "Evening — glad you found your way here.",
        "Good evening. I keep watch over this archive.",
      ],
      returning: [
        "Good evening — welcome back.",
        "Evening again. Good to see you.",
        "Back so soon? Good evening.",
      ],
    },
  };

  var set = LINES[bucket][isReturning ? "returning" : "first"];
  greetEl.textContent = set[Math.floor(Math.random() * set.length)];
})();
