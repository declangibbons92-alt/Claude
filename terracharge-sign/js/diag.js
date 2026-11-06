/*
 * Tiny error reporter (classic script, loaded before the app).
 * If anything fails on the iPhone, a red bar shows the error and app version
 * so a screenshot is enough to diagnose it. Tap the bar to hide it.
 */
(function () {
  window.TC_APP_VERSION = "v9";
  var shown = [];
  function report(msg) {
    msg = String(msg || "Unknown error");
    if (shown.indexOf(msg) !== -1) return;
    shown.push(msg);
    var bar = document.getElementById("diagBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "diagBar";
      bar.className = "diag";
      bar.addEventListener("click", function () { bar.remove(); });
      (document.body || document.documentElement).appendChild(bar);
    }
    var line = document.createElement("div");
    line.textContent = "⚠ " + msg;
    bar.appendChild(line);
    if (!bar.dataset.v) {
      var v = document.createElement("div");
      v.className = "diag__v";
      v.textContent = "App " + window.TC_APP_VERSION + " · tap to hide · please screenshot this";
      bar.appendChild(v);
      bar.dataset.v = "1";
    }
  }
  window.TC_REPORT = report;
  window.addEventListener("error", function (e) {
    if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {
      report("Could not load " + (e.target.src || e.target.href));
    } else {
      report((e && e.message) + (e && e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : ""));
    }
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    report("Promise: " + (e && e.reason && (e.reason.message || e.reason)));
  });
  // If the main app never finishes starting, say so.
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!window.TC_APP_READY) report("App did not finish starting");
    }, 4000);
  });
})();
