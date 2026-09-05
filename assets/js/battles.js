/* RSPKL Battle Finder board.
 *
 * Same conventions as hiscore.js: one IIFE, ES5 only, no framework, no build
 * step. The board falls back to an empty state rather than an error, because a
 * page that says "failed to load" is worse than one that says "nothing booked
 * yet" - both are true when the world is down, and only one of them reads like
 * the site is broken.
 */
(function () {
  'use strict';

  var api = window.rspklApi;
  /* ---------------------------------------------------------- the board */

  var sort = 'hype';
  var reqSeq = 0;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Seconds to "5m 12s" - two units at most, matching the in-game clock. */
  function until(seconds) {
    if (seconds == null) return '—';
    var s = Math.max(0, Math.round(seconds));
    if (s === 0) return 'now';
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60), rest = s % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + rest + 's';
    return rest + 's';
  }

  function fight(battle) {
    var left = battle.left && battle.left.name ? battle.left.name : 'TBA';
    var right = battle.right && battle.right.name ? battle.right.name : 'open seat';
    return esc(left) + ' <span class="dim">vs</span> ' + esc(right);
  }

  function rating(battle) {
    var a = battle.left ? battle.left.elo : 0;
    var b = battle.right ? battle.right.elo : 0;
    if (!b) return a ? esc(a) : '—';
    return esc(a) + ' v ' + esc(b);
  }

  function status(battle) {
    if (battle.status === 'live') return '<b class="live">LIVE</b>';
    if (!battle.right || !battle.right.name) return '<b>OPEN SEAT</b>';
    return esc((battle.right.rank || '') + '');
  }

  function empty(message) {
    return '<tr><td colspan="5" class="empty">' + esc(message) + '</td></tr>';
  }

  function render(battles) {
    var body = document.getElementById('bf-body');
    if (!body) return;
    if (!battles || !battles.length) {
      body.innerHTML = empty('Nothing booked right now — log in and use ::battles to post one.');
      return;
    }
    var html = '';
    for (var i = 0; i < battles.length; i++) {
      var b = battles[i];
      html += '<tr>' +
        '<td>' + esc(until(b.startsInSeconds)) + '</td>' +
        '<td>' + fight(b) + '</td>' +
        '<td>' + esc(b.build || '') + '</td>' +
        '<td>' + rating(b) + '</td>' +
        '<td>' + status(b) + '</td>' +
        '</tr>';
    }
    body.innerHTML = html;
  }

  function load() {
    var seq = ++reqSeq;
    if (!api) {
      render(null);
      return;
    }
    api('/api/battles?sort=' + sort + '&limit=25').then(function (data) {
      if (seq !== reqSeq) return;
      render(data && data.battles);
    }, function () {
      if (seq !== reqSeq) return;
      render(null);
    });
  }

  function bindSort() {
    var head = document.querySelector('#bf-board-title');
    var buttons = document.querySelectorAll('.seg [data-sort]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var all = document.querySelectorAll('.seg [data-sort]');
        for (var j = 0; j < all.length; j++) all[j].className = '';
        this.className = 'on';
        sort = this.getAttribute('data-sort');
        if (head) {
          head.textContent = sort === 'hype' ? 'HIGH VALUE BATTLES' : 'NEXT BATTLES';
        }
        load();
      });
    }
  }

  bindSort();
  load();
  // The board is a countdown, so it has to move on its own. Thirty seconds is
  // the API's own cache window plus a little - polling faster would only
  // re-read the same cached page.
  setInterval(load, 30000);
})();
