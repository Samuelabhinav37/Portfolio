/* Dev mockup only: scale each 1440x900 frame to fit, never below half size. */
(function () {
  function fit() {
    document.querySelectorAll(".frame").forEach(function (f) {
      var s = Math.max(.5, Math.min(1, f.clientWidth / 1440));
      f.style.height = (900 * s) + "px";
      f.querySelector("iframe").style.transform = "scale(" + s + ")";
    });
  }
  addEventListener("resize", fit); fit();
})();
