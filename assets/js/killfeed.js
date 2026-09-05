/* RSPKL Kill Feed — the homepage ticker and the /killfeed/ newsfeed.

   Both read the same /api/killfeed endpoint, which records every eligible
   server-side PvP kill. A post links to /killcams/ for replay only when the kill actually sampled one
   - not every kill does, and a link into a cam that is not there would be a
   dead end dressed as a feature. */
(function () {
  'use strict';

  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* A name in the feed is a way into that player's profile
     (website/assets/js/player.js) - the ticker and the newsfeed share this, so
     a name reads and links the same in both. */
  function playerLink(name, killer) {
    var inner = killer ? '<b>' + escapeHtml(name) + '</b>' : '<span>' + escapeHtml(name) + '</span>';
    return '<a class="u-link" href="/player/?name=' + encodeURIComponent(name) + '">' + inner + '</a>';
  }

  function ago(iso) {
    var then = new Date(iso).getTime();
    if (!then) { return ''; }
    var mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) { return 'just now'; }
    if (mins < 60) { return mins + 'm ago'; }
    if (mins < 1440) { return Math.round(mins / 60) + 'h ago'; }
    return Math.round(mins / 1440) + 'd ago';
  }

  // Pure < 95, Med 95-112, Main 113+ — CLAUDE.md's bracket law, mirrored here
  // only as a fallback for a post the API served before it started sending
  // the label itself. The API's label always wins when present.
  function bracket(combat) {
    var c = Number(combat) || 0;
    if (c < 95) { return 'Pure'; }
    if (c <= 112) { return 'Med'; }
    return 'Main';
  }

  function postLine(p) {
    var kb = p.killerBracket || bracket(p.killerCombat);
    var vb = p.victimBracket || bracket(p.victimCombat);
    var wild = p.wildernessLevel ? 'Wild ' + p.wildernessLevel : 'Wilderness';
    var weapon = escapeHtml(p.weaponName || 'Unarmed');
    return playerLink(p.killer, true) + ' <span class="kf-b">(' + kb + ')</span>' +
      ' <i class="bi bi-caret-right-fill"></i> ' +
      playerLink(p.victim, false) + ' <span class="kf-b">(' + vb + ')</span>' +
      ' <span class="kf-weapon">with ' + weapon + '</span>' +
      ' <span class="kf-loc">&middot; ' + wild + '</span>';
  }

  function postCardHtml(p) {
    var replay = p.hasReplay
      ? '<a class="btn btn-outline btn-sm" href="/killcams/?cam=' + encodeURIComponent(p.replayId || p.id) +
        '">WATCH REPLAY</a>'
      : '<span class="kf-noreplay">No replay sampled</span>';
    return '' +
      '<div class="kf-time">' + ago(p.killedAt) + '</div>' +
      '<div class="kf-body">' +
      '  <div class="kf-line">' + postLine(p) + '</div>' +
      '  <div class="kf-meta">' +
      '    <span>' + p.killingBlow + ' dmg blow</span>' +
      '    <span>' + p.hitpointsLeft + '% hp left</span>' +
      '  </div>' +
      '</div>' +
      '<div class="kf-actions">' + replay + '</div>';
  }

  // ---- /killfeed/ — the paginated newsfeed --------------------------------

  function initFeedPage() {
    var list = $('#kf-list');
    if (!list) { return; }
    var state = { page: 1, loading: false, done: false };

    function renderPage(posts, append) {
      if (!append) { list.innerHTML = ''; }
      if (!posts.length && !append) {
        list.appendChild(el('p', 'kc-empty', 'No kills recorded yet — the first one lands here.'));
        return;
      }
      posts.forEach(function (p) {
        list.appendChild(el('div', 'kc-card kf-card', postCardHtml(p)));
      });
    }

    function load(append) {
      if (state.loading || state.done) { return; }
      state.loading = true;
      if (typeof window.rspklApi !== 'function') {
        renderPage([]);
        var note = $('#kf-note');
        if (note) { note.style.display = ''; }
        state.loading = false;
        state.done = true;
        return;
      }
      window.rspklApi('/api/killfeed?page=' + state.page).then(function (d) {
        var posts = d.posts || [];
        renderPage(posts, append);
        state.loading = false;
        if (posts.length < (d.perPage || 20)) { state.done = true; }
        var note = $('#kf-note');
        if (note) { note.style.display = 'none'; }
      }).catch(function () {
        renderPage([]);
        var note = $('#kf-note');
        if (note) { note.style.display = ''; }
        state.loading = false;
        state.done = true;
      });
    }

    var more = $('#kf-more');
    if (more) {
      more.addEventListener('click', function () {
        state.page += 1;
        load(true);
      });
    }
    load(false);
  }

  // ---- homepage ticker -----------------------------------------------------

  function initTicker() {
    var track = $('#feed-ticker-track');
    if (!track) { return; }

    function render(posts) {
      if (!posts.length) { return; }
      // Duplicated once so the CSS marquee can loop without a visible seam.
      var html = posts.map(function (p) {
        return '<span class="feed-ticker-item">' + postLine(p) + '</span>';
      }).join('<span class="feed-ticker-sep">&bull;</span>');
      track.innerHTML = html + '<span class="feed-ticker-sep">&bull;</span>' + html;
    }

    if (typeof window.rspklApi !== 'function') { return; }
    window.rspklApi('/api/killfeed?page=1').then(function (d) {
      render((d.posts || []).slice(0, 12));
    }).catch(function () { /* ticker simply stays hidden with no live feed */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFeedPage();
    initTicker();
  });
})();
