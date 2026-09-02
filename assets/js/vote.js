/* RSPKL vote flow — UI only (RSPKL-API: POST /api/vote/start) */
(function () {
  'use strict';
  function $(s) { return document.querySelector(s); }
  var form = $('#vote-form');
  var sites = $('#vote-sites');
  if (!form || !sites) { return; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#vote-username').value.trim();
    if (!name) {
      rspklToast('Enter your log-in name first.');
      return;
    }
    $('#vote-for').textContent = name;
    form.closest('.panel-body').style.display = 'none';
    sites.style.display = 'block';
    rspklToast('Vote links unlocked for ' + name + '. Claim rewards after voting in-game.');
  });
})();
