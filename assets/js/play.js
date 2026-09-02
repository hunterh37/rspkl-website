/* RSPKL web client launcher — mock until client hosting is wired (RSPKL-API: /play embed) */
(function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  var form = $('#launch-form');
  if (!form) { return; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#launch-btn');
    var status = $('#client-status');
    btn.disabled = true;
    btn.textContent = 'CONNECTING…';
    status.textContent = 'HANDSHAKE — LEAGUE GATEWAY';
    var steps = ['HANDSHAKE — LEAGUE GATEWAY', 'CACHE — 0%', 'CACHE — 38%', 'CACHE — 71%', 'CACHE — 100%', 'STANDBY'];
    var i = 0;
    var iv = setInterval(function () {
      i++;
      if (i < steps.length) {
        status.textContent = steps[i];
        if (steps[i].indexOf('%') !== -1) { btn.textContent = 'LOADING ' + steps[i].split('— ')[1]; }
      } else {
        clearInterval(iv);
        btn.textContent = 'LAUNCH CLIENT';
        btn.disabled = false;
        rspklToast('Web client deployment completes with Season 1 — your Discord invite pings first.');
      }
    }, 900);
  });
})();
