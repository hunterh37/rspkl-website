/* RSPKL player profile — /player/?name=<name>.

   The web half of the in-game player card (spec/PLAYER_CARD.md, spec/PLAYER_PAGE.md):
   one name, one screen, readable by anyone. Everything here comes from a single
   GET /api/player/:name, which answers the account, both modes with their
   ladder positions, the skills and the cams the player is in - a profile that
   made six requests would paint six times and rank nothing consistently.

   A killcam row links out to /killcams/?cam=<id> rather than embedding a second
   viewer: the replay is a 3D stage with a cache behind it, and there is one of
   those on the site. */
(function () {
  'use strict';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) { return (Number(n) || 0).toLocaleString('en-US'); }

  function ago(iso) {
    var then = new Date(iso).getTime();
    if (!then) { return ''; }
    var mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) { return 'just now'; }
    if (mins < 60) { return mins + 'm ago'; }
    if (mins < 1440) { return Math.round(mins / 60) + 'h ago'; }
    return Math.round(mins / 1440) + 'd ago';
  }

  /* The ladder's tiers, mirroring EloRank and the copy in killcams.js. A tier's
     emblem is a real item id, so a tier shows here the same way it shows on a
     killcam card - the client's own render - and a tier added to EloRank needs
     no new art on this page either. */
  var RANKS = [
    { title: 'Bronze', floor: 0, emblem: 1155 },
    { title: 'Iron', floor: 1100, emblem: 1153 },
    { title: 'Steel', floor: 1250, emblem: 1157 },
    { title: 'Black', floor: 1400, emblem: 1165 },
    { title: 'Mithril', floor: 1550, emblem: 1159 },
    { title: 'Adamant', floor: 1700, emblem: 1161 },
    { title: 'Rune', floor: 1850, emblem: 1163 },
    { title: 'Dragon', floor: 2000, emblem: 11335 }
  ];

  function rankOf(rating) {
    if (!(rating > 0)) { return null; }
    var found = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (rating >= RANKS[i].floor) { found = RANKS[i]; }
    }
    return found;
  }

  function icon(id, cls, title) {
    return window.KillcamIcons ? window.KillcamIcons.icon(id, cls, title) : '';
  }

  /* A signed rating move, as a player reads it. Zero is "unrated" and not
     "+0" - the world states an unrated kill deliberately. */
  function moveText(move) {
    if (move == null) { return ''; }
    if (!move) { return 'unrated'; }
    return move > 0 ? '+' + move : String(move);
  }
  function moveClass(move) { return !move ? 'flat' : (move > 0 ? 'up' : 'down'); }

  // The name in the address bar. Accepts ?name= and the older ?player=, and
  // tolerates a name typed with spaces or underscores, which is how a player
  // copies one out of the game.
  function nameFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var raw = p.get('name') || p.get('player') || '';
    return raw.replace(/[_+]/g, ' ').trim().slice(0, 24);
  }

  function profileHref(name) {
    return '/player/?name=' + encodeURIComponent(name);
  }
  window.rspklProfileHref = profileHref;

  var state = { name: '', mode: 'normal', tab: 'kills', data: null, live: false };

  // ---- sample profile ------------------------------------------------------

  /* With no API the page still has to show what a profile is. Built from the
     name itself so a link from the sample hiscore board lands on a profile that
     matches the row that was clicked, rather than on an error. */
  function seeded(name, key) {
    var h = 2166136261, s = name + '::' + key;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }

  var SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer',
    'slayer', 'agility', 'herblore', 'thieving', 'crafting', 'fletching', 'mining',
    'smithing', 'fishing', 'cooking', 'firemaking', 'woodcutting', 'farming',
    'runecrafting', 'hunter', 'construction'];

  var SAMPLE_WEAPONS = [
    [11802, 'Armadyl godsword'], [13652, 'Dragon claws'], [4153, 'Granite maul'],
    [11791, 'Staff of the dead'], [861, 'Magic shortbow'], [1215, 'Dragon dagger']
  ];

  function sampleCam(name, i, won) {
    var w = SAMPLE_WEAPONS[Math.floor(seeded(name, 'w' + i + won) * SAMPLE_WEAPONS.length)];
    var foe = ['Ags Rushed', 'Tank Btw', 'Pure Rage', 'Void Pray', 'Zerk Andy', 'Deep Wild Dad'][
      Math.floor(seeded(name, 'f' + i + won) * 6)];
    var rating = Math.round(1100 + seeded(name, 'r' + i) * 950);
    var move = Math.round((seeded(name, 'm' + i + won) * 30) + 4) * (won ? 1 : -1);
    return {
      id: 'sample-' + i, killer: won ? name : foe, victim: won ? foe : name,
      won: won, opponent: foe,
      opponentCombat: Math.round(80 + seeded(name, 'c' + i) * 46),
      opponentBracket: 'Main', rating: rating, move: move,
      killedAt: new Date(Date.now() - (i + 1) * 5400000).toISOString(),
      wildernessLevel: Math.round(1 + seeded(name, 'l' + i) * 55),
      weapon: w[0], weaponName: w[1],
      killingBlow: Math.round(18 + seeded(name, 'b' + i) * 40),
      hitpointsLeft: won ? Math.round(seeded(name, 'h' + i) * 70) : 0,
      votes: Math.round(seeded(name, 'v' + i) * 180),
      views: Math.round(seeded(name, 'vw' + i) * 2400),
      hasReplay: true, sample: true
    };
  }

  function sampleProfile(name) {
    function stats(mode) {
      var kills = Math.round(400 + seeded(name, 'k' + mode) * 24000);
      var deaths = Math.round(kills * (0.16 + seeded(name, 'd' + mode) * 0.5));
      var skills = {};
      SKILLS.forEach(function (s) { skills[s] = Math.round(seeded(name, s + mode) * 13034431); });
      return {
        row: {
          kills: kills, deaths: deaths, kdr: kills / Math.max(1, deaths),
          elo: Math.round(1050 + seeded(name, 'e' + mode) * 1100),
          streak: Math.round(seeded(name, 's' + mode) * 41),
          best: Math.round(30 + seeded(name, 'b' + mode) * 180),
          total: Math.round(1200 + seeded(name, 't' + mode) * 1100),
          slayer: Math.round(60 + seeded(name, 'sl' + mode) * 39),
          lms: Math.round(900 + seeded(name, 'l' + mode) * 2200),
          log: Math.round(40 + seeded(name, 'cl' + mode) * 600),
          votes: Math.round(seeded(name, 'vt' + mode) * 900), mc: []
        },
        ranks: {
          kills: 1 + Math.round(seeded(name, 'rk' + mode) * 240),
          deaths: 1 + Math.round(seeded(name, 'rd' + mode) * 240),
          kdr: 1 + Math.round(seeded(name, 'rr' + mode) * 240),
          elo: 1 + Math.round(seeded(name, 're' + mode) * 240),
          streak: 1 + Math.round(seeded(name, 'rs' + mode) * 240),
          best: 1 + Math.round(seeded(name, 'rb' + mode) * 240),
          total: 1 + Math.round(seeded(name, 'rt' + mode) * 240),
          lms: 1 + Math.round(seeded(name, 'rl' + mode) * 240)
        },
        skills: skills
      };
    }
    var normal = stats('normal'), hc = stats('hc');
    var kills = [0, 1, 2, 3, 4].map(function (i) { return sampleCam(name, i, true); });
    var deaths = [5, 6, 7].map(function (i) { return sampleCam(name, i, false); });
    return {
      name: name, title: '', lastSeen: new Date(Date.now() - 3600000).toISOString(),
      combat: Math.round(96 + seeded(name, 'cb') * 30),
      bracket: null, rating: kills[0].rating,
      stats: { normal: normal.row, hc: hc.row },
      ranks: { normal: normal.ranks, hc: hc.ranks },
      skills: { normal: normal.skills, hc: hc.skills },
      cams: {
        kills: kills, deaths: deaths,
        top: kills.slice().sort(function (a, b) { return b.votes - a.votes; })
      },
      record: {
        camKills: kills.length, camDeaths: deaths.length,
        camVotes: kills.reduce(function (a, c) { return a + c.votes; }, 0),
        camViews: kills.reduce(function (a, c) { return a + c.views; }, 0),
        lastFight: kills[0].killedAt
      },
      sample: true
    };
  }

  // ---- render --------------------------------------------------------------

  // Pure < 95, Med 95-112, Main 113+ — CLAUDE.md's bracket law. The API sends
  // the label when it has a combat level; this is the fallback for when it
  // does not.
  function bracket(combat) {
    var c = Number(combat) || 0;
    if (!c) { return ''; }
    if (c < 95) { return 'Pure'; }
    if (c <= 112) { return 'Med'; }
    return 'Main';
  }

  function renderHeader(d) {
    document.title = d.name + ' — Player Profile | PK League';
    $('#pp-name').textContent = d.name;
    var tier = rankOf(d.rating);
    var chips = [];
    if (d.combat) {
      chips.push('<span class="pp-chip"><span>Combat</span><b>' + d.combat + '</b></span>');
      chips.push('<span class="pp-chip"><span>Bracket</span><b>' +
        escapeHtml(d.bracket || bracket(d.combat)) + '</b></span>');
    }
    if (tier) {
      chips.push('<span class="pp-chip tier" title="' + escapeHtml(tier.title + ' tier') + '">' +
        icon(tier.emblem, 'tier', tier.title + ' tier') +
        '<span>' + tier.title + '</span><b>' + fmt(d.rating) + '</b></span>');
    }
    chips.push('<span class="pp-chip"><span>Cam kills</span><b>' + fmt(d.record.camKills) + '</b></span>');
    chips.push('<span class="pp-chip"><span>Cam votes</span><b>' + fmt(d.record.camVotes) + '</b></span>');
    $('#pp-chips').innerHTML = chips.join('');
    $('#pp-kicker').textContent = d.title ? d.title : 'Profile';
    var seen = d.lastSeen ? 'Last seen ' + ago(d.lastSeen) : 'Never seen in the league';
    var fight = d.record.lastFight ? ' · last fight ' + ago(d.record.lastFight) : '';
    $('#pp-sub').textContent = seen + fight + '.';

    var cams = $('#pp-link-cams');
    if (cams) { cams.setAttribute('href', '/killcams/?player=' + encodeURIComponent(d.name)); }
  }

  var TILES = [
    ['kills', 'Kills'], ['deaths', 'Deaths'], ['kdr', 'K/D'],
    ['elo', 'Rating'], ['streak', 'Streak'], ['best', 'Best streak']
  ];

  function renderTiles(d) {
    var st = d.stats[state.mode];
    var host = $('#pp-tiles');
    if (!st) {
      host.innerHTML = '<p class="kc-empty">No ' +
        (state.mode === 'hc' ? 'Hardcore PvP' : 'Normal') + ' record for this account yet.</p>';
      $('#pp-total').textContent = '—';
      $('#pp-skills').innerHTML = '<p class="kc-empty">No skills recorded.</p>';
      return;
    }
    var ranks = (d.ranks && d.ranks[state.mode]) || {};
    var rating = Number(st.elo) || 0;
    var tier = rankOf(rating);
    var position = ranks.elo;
    var lead = '<div class="pp-rank-tile">' +
      '<div class="pp-rank-tile-copy"><span>League rank</span>' +
      '<b>' + (tier ? escapeHtml(tier.title) : 'Unrated') + '</b>' +
      '<em>' + (position ? 'Ladder position #' + fmt(position) : 'No ladder position yet') + '</em></div>' +
      '<div class="pp-rank-tile-rating"><span>Rating</span><strong>' + fmt(rating) + '</strong></div>' +
      (tier ? icon(tier.emblem, 'pp-rank-crest', tier.title + ' tier') : '') +
      '</div>';
    host.innerHTML = lead + TILES.map(function (t) {
      var key = t[0];
      var value = key === 'kdr' ? (Number(st.kdr) || 0).toFixed(2) : fmt(st[key]);
      var rank = ranks[key] ? '<em>Rank #' + fmt(ranks[key]) + '</em>' : '';
      return '<div class="pp-tile"><span>' + t[1] + '</span><b>' + value + '</b>' + rank + '</div>';
    }).join('');
    renderSkills(d);
  }

  /* XP to level, the standard curve, so the page prints levels rather than raw
     xp - the ladder ranks xp, but a profile is read by a person. */
  function levelFor(xp) {
    var points = 0, level = 1;
    for (var l = 1; l < 99; l++) {
      points += Math.floor(l + 300 * Math.pow(2, l / 7));
      if (Math.floor(points / 4) > (Number(xp) || 0)) { return level; }
      level = l + 1;
    }
    return 99;
  }

  function renderSkills(d) {
    var skills = (d.skills && d.skills[state.mode]) || {};
    var names = Object.keys(skills);
    var host = $('#pp-skills');
    if (!names.length) {
      host.innerHTML = '<p class="kc-empty">No skills recorded for this mode.</p>';
      $('#pp-total').textContent = '—';
      return;
    }
    names.sort();
    var total = 0;
    host.innerHTML = names.map(function (s) {
      var lvl = levelFor(skills[s]);
      total += lvl;
      return '<div class="pp-skill"><span>' + escapeHtml(s) + '</span>' +
        '<b>' + lvl + '</b><em>' + fmt(skills[s]) + ' xp</em></div>';
    }).join('');
    $('#pp-total').textContent = 'Total level ' + fmt(total);
  }

  var RANK_ROWS = [
    ['kills', 'Kills'], ['deaths', 'Deaths'], ['kdr', 'K/D'], ['elo', 'Rating'],
    ['streak', 'Streak'], ['best', 'Best streak'], ['total', 'Total level'], ['lms', 'LMS']
  ];

  // Board ids here are the hiscore page's own (assets/js/hiscore.js BOARDS), so
  // a rank links to the ladder it was read from rather than to a generic board.
  function renderRanks(d) {
    var ranks = (d.ranks && d.ranks[state.mode]) || null;
    var host = $('#pp-ranks');
    if (!ranks) {
      host.innerHTML = '<p class="kc-empty">Unranked in this mode.</p>';
      return;
    }
    host.innerHTML = RANK_ROWS.map(function (r) {
      var v = ranks[r[0]];
      if (!v) { return ''; }
      return '<a class="pp-rank" href="/hiscore/#' + r[0] + '">' +
        '<span>' + r[1] + '</span><b>#' + fmt(v) + '</b></a>';
    }).join('') || '<p class="kc-empty">Unranked in this mode.</p>';
  }

  function camRowHtml(c) {
    var weapon = c.weapon >= 0
      ? '<span class="kc-weapon-chip">' + icon(c.weapon, '', c.weaponName) +
        '<span>' + escapeHtml(c.weaponName) + '</span></span>'
      : '<span>' + escapeHtml(c.weaponName || 'Unarmed') + '</span>';
    var tier = rankOf(c.rating);
    var ladder = tier
      ? '<span class="kc-rank-chip" title="' + escapeHtml(tier.title + ' tier') + '">' +
        icon(tier.emblem, 'tier', tier.title + ' tier') +
        '<span>' + tier.title + ' ' + c.rating + '</span>' +
        (c.move == null ? '' : '<em class="' + moveClass(c.move) + '">' + moveText(c.move) + '</em>') +
        '</span>'
      : '';
    var verb = c.won ? 'Killed' : 'Died to';
    var wild = c.wildernessLevel ? 'Wilderness ' + c.wildernessLevel : 'Wilderness';
    var watch = c.hasReplay && !c.sample
      ? '<a class="btn btn-outline btn-sm" href="/killcams/?cam=' + encodeURIComponent(c.id) + '">WATCH</a>'
      : '<span class="kf-noreplay">No replay</span>';
    return '' +
      '<div class="kc-rank pp-verdict ' + (c.won ? 'win' : 'loss') + '">' + (c.won ? 'KILL' : 'DEATH') + '</div>' +
      '<div class="kc-body">' +
      '  <div class="kc-names">' + verb + ' <a href="' + profileHref(c.opponent) + '"><b>' +
           escapeHtml(c.opponent) + '</b></a>' +
      '    <span class="pp-foe">(' + escapeHtml(c.opponentBracket || bracket(c.opponentCombat)) +
           (c.opponentCombat ? ' · ' + c.opponentCombat : '') + ')</span></div>' +
      '  <div class="kc-meta">' +
      '    ' + weapon + ladder +
      '    <span>' + c.killingBlow + ' dmg blow</span>' +
      '    <span>' + wild + '</span>' +
      '    <span>' + ago(c.killedAt) + '</span>' +
      '    <span>' + fmt(c.votes) + ' votes</span>' +
      '  </div>' +
      '</div>' +
      '<div class="kc-actions">' + watch + '</div>';
  }

  var EMPTY = {
    kills: 'No recorded kills yet.',
    deaths: 'No recorded deaths — or none the world cut a cam for.',
    top: 'No cams on the board for this player yet.'
  };

  function renderCams(d) {
    var list = $('#pp-cam-list');
    var cams = (d.cams && d.cams[state.tab]) || [];
    if (!cams.length) {
      list.innerHTML = '<p class="kc-empty">' + EMPTY[state.tab] + '</p>';
      return;
    }
    list.innerHTML = cams.map(function (c) {
      return '<div class="kc-card pp-cam">' + camRowHtml(c) + '</div>';
    }).join('');
  }

  function renderAll() {
    var d = state.data;
    if (!d) { return; }
    renderHeader(d);
    renderTiles(d);
    renderRanks(d);
    renderCams(d);
    var note = $('#pp-note');
    if (note) { note.style.display = state.live ? 'none' : ''; }
  }

  function missing(name) {
    $('#pp-name').textContent = name || 'Player';
    $('#pp-sub').textContent = name
      ? 'No account by that name has been seen in the league.'
      : 'Search for a player to open their profile.';
    $('#pp-chips').innerHTML = '';
    $('#pp-tiles').innerHTML = '<p class="kc-empty">Nothing to show yet.</p>';
    $('#pp-cam-list').innerHTML = '<p class="kc-empty">No fights on record.</p>';
    $('#pp-ranks').innerHTML = '<p class="kc-empty">Unranked.</p>';
    $('#pp-skills').innerHTML = '<p class="kc-empty">No skills recorded.</p>';
  }

  function load(name) {
    state.name = name;
    if (!name) { missing(''); return; }
    if (typeof window.rspklApi !== 'function') {
      state.live = false;
      state.data = sampleProfile(name);
      renderAll();
      return;
    }
    window.rspklApi('/api/player/' + encodeURIComponent(name)).then(function (d) {
      state.live = true;
      state.data = d;
      renderAll();
    }).catch(function (e) {
      // A 404 is a real answer - that name has never been seen - and is not the
      // same as the API being down, which is what the sample profile stands in
      // for. Only the second one gets a stand-in.
      if (String(e && e.message).indexOf('404') !== -1) {
        state.live = true;
        missing(name);
        var note = $('#pp-note');
        if (note) { note.style.display = 'none'; }
        return;
      }
      state.live = false;
      state.data = sampleProfile(name);
      renderAll();
    });
  }

  // ---- wiring --------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('#pp-tiles')) { return; }

    var items = $('#pp-items');
    if (items && window.KillcamIcons) {
      window.KillcamIcons.setVersion(items.getAttribute('data-items') || '');
    }

    $$('#pp-mode button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#pp-mode button').forEach(function (x) { x.classList.toggle('on', x === b); });
        state.mode = b.getAttribute('data-mode');
        if (state.data) { renderTiles(state.data); renderRanks(state.data); }
      });
    });

    $$('#pp-cams button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#pp-cams button').forEach(function (x) { x.classList.toggle('on', x === b); });
        state.tab = b.getAttribute('data-cams');
        if (state.data) { renderCams(state.data); }
      });
    });

    var form = $('#pp-search');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = $('#pp-query').value.trim();
        if (!q) { return; }
        // Same document, new subject: the URL is the state, so it is pushed
        // rather than reloaded and the back button walks the names visited.
        window.history.pushState({}, '', profileHref(q));
        $('#pp-suggest').innerHTML = '';
        load(q);
      });
    }

    // Name completion, when the API is up. Prefix matches only - this answers
    // "did I spell it right", not "who else is there".
    var box = $('#pp-query'), suggest = $('#pp-suggest'), timer = null;
    if (box && suggest) {
      box.addEventListener('input', function () {
        clearTimeout(timer);
        var term = box.value.trim();
        if (term.length < 2 || typeof window.rspklApi !== 'function') {
          suggest.innerHTML = '';
          return;
        }
        timer = setTimeout(function () {
          window.rspklApi('/api/players/search?q=' + encodeURIComponent(term)).then(function (d) {
            suggest.innerHTML = (d.players || []).map(function (p) {
              return '<a href="' + profileHref(p.name) + '">' + escapeHtml(p.name) +
                '<em>' + fmt(p.kills) + ' kills</em></a>';
            }).join('');
          }).catch(function () { suggest.innerHTML = ''; });
        }, 180);
      });
    }

    window.addEventListener('popstate', function () { load(nameFromUrl()); });

    load(nameFromUrl());
  });
})();
