/* RSPKL hiscores — sample ladder data (RSPKL-API: GET /api/hiscores?board=&mode=) */
(function () {
  'use strict';
  var NAMES = [
    'Zezima_PK','DdsSpecOnly','Callisto','TankBrid','NhPure','Obby Mauler','Vengeance',
    'Lakiska','Hybrid King','Welfare Zerk','Pure F2P','Smite Range','Deep Wild Dad',
    'Claws OF GUTHIX','Agroth','Spec N Run','Maxed Zerk','P0ker Face','Ice Barrage',
    'D Hide Dan','Rune Crossbow','Brid Flicker','Skulled 24 7','Ags Pure','Granite Bob',
    'Void Ranger','Mystic Mary','D Scim Sammy','Tormented Soul','Karils Kevin','Blood Money',
    'Ghostly PK','Fally Mass','Edge Pk God','Lumby Legend','Varrock Viper','Al Kharid Ali',
    'Bandos Billy','Sara Sword','Zammy Zapper','Arma Andy','Ancient Rick','Blood Rune',
    'D Hally Hank','Mithril Mike','Addy Adam','Black Bess','Rune Rachel','Dragon Drake',
    'Barb Villager','TzHaar Titan','Jad Champ','Fire Cape Fred','Infinity Ian','Virtus Vic',
    'Pernix Pete','Torva Tom','Zuriel Zoe','Morrigan Mo','Vanguard Val','Elder Elf',
    'Wildy Wraith','Chaos Chris','Death Dot Dan','Red Skull Ray','Gold Skull Gus'
  ];
  var MONSTERS = ['King Black Dragon','Corporeal Beast','Zulrah','Kraken','Callisto','Venenatis','Vet\'ion','Scorpia','Chaos Elemental','TzTok-Jad','Skotizo','Revenant Dragon'];

  function seeded(name, board) {
    var h = 2166136261;
    var s = name + '::' + board;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = (h >>> 0) / 4294967295;
    return h;
  }
  function fmt(n) { return n.toLocaleString('en-US'); }

  function build(mode) {
    var off = mode === 'hc' ? 0.38 : 0;
    return NAMES.map(function (name, i) {
      var kills = Math.round((seeded(name, 'k' + mode) * 0.92 + 0.08) * (mode === 'hc' ? 34000 : 66000) * (1 - i / (NAMES.length * 1.6)));
      var deaths = Math.round(kills * (0.12 + seeded(name, 'd' + mode) * 0.55));
      var kdr = kills / Math.max(1, deaths);
      return {
        name: name,
        kills: Math.max(120, kills),
        deaths: Math.max(30, deaths),
        kdr: kdr,
        elo: Math.round(1000 + seeded(name, 'e' + mode) * 2100),
        streak: Math.round(seeded(name, 's' + mode) * 58),
        best: Math.round(40 + seeded(name, 'b' + mode) * 210),
        total: Math.round(400 + seeded(name, 't' + mode) * 1787),
        slayer: Math.round(30 + seeded(name, 'sl' + mode) * 69),
        lms: Math.round(900 + seeded(name, 'l' + mode) * 2600),
        log: Math.round(40 + seeded(name, 'c' + mode) * 640),
        mc: MONSTERS.map(function (m) { return Math.round(seeded(name, m + mode) * 3400); })
      };
    });
  }

  var BOARDS = [
    { id: 'kills',   label: 'Top Kills',        cols: ['KILLS', 'DEATHS', 'KDR'],  get: function (p) { return [fmt(p.kills), fmt(p.deaths), p.kdr.toFixed(2)]; }, key: 'kills', desc: true },
    { id: 'deaths',  label: 'Top Deaths',       cols: ['KILLS', 'DEATHS', 'KDR'],  get: function (p) { return [fmt(p.kills), fmt(p.deaths), p.kdr.toFixed(2)]; }, key: 'deaths', desc: true },
    { id: 'kdr',     label: 'Top KDR',          cols: ['KILLS', 'DEATHS', 'KDR'],  get: function (p) { return [fmt(p.kills), fmt(p.deaths), p.kdr.toFixed(2)]; }, key: 'kdr', desc: true },
    { id: 'elo',     label: 'Top Elo',          cols: ['ELO', 'KILLS', 'KDR'],     get: function (p) { return [fmt(p.elo), fmt(p.kills), p.kdr.toFixed(2)]; }, key: 'elo', desc: true },
    { id: 'streak',  label: 'Current Streak',   cols: ['STREAK', 'KILLS', 'KDR'],  get: function (p) { return [fmt(p.streak), fmt(p.kills), p.kdr.toFixed(2)]; }, key: 'streak', desc: true },
    { id: 'best',    label: 'Highest Streak',   cols: ['BEST', 'KILLS', 'KDR'],    get: function (p) { return [fmt(p.best), fmt(p.kills), p.kdr.toFixed(2)]; }, key: 'best', desc: true },
    { id: 'total',   label: 'Total Level',      cols: ['TOTAL LVL', 'SLAYER', 'KDR'], get: function (p) { return [fmt(p.total), fmt(p.slayer), p.kdr.toFixed(2)]; }, key: 'total', desc: true },
    { id: 'slayer',  label: 'Slayer',           cols: ['SLAYER', 'TOTAL LVL', 'KDR'], get: function (p) { return [fmt(p.slayer), fmt(p.total), p.kdr.toFixed(2)]; }, key: 'slayer', desc: true },
    { id: 'lms',     label: 'LMS Rating',       cols: ['LMS RATING', 'KILLS', 'KDR'], get: function (p) { return [fmt(p.lms), fmt(p.kills), p.kdr.toFixed(2)]; }, key: 'lms', desc: true },
    { id: 'log',     label: 'Collection Log',   cols: ['LOG', 'KILLS', 'KDR'],     get: function (p) { return [fmt(p.log), fmt(p.kills), p.kdr.toFixed(2)]; }, key: 'log', desc: true }
  ];
  MONSTERS.forEach(function (m, idx) {
    BOARDS.push({
      id: 'mc' + idx, label: m, monster: true,
      cols: ['KILLCOUNT', 'KILLS', 'KDR'],
      get: function (p) { return [fmt(p.mc[idx]), fmt(p.kills), p.kdr.toFixed(2)]; },
      key: null, mcIdx: idx, desc: true
    });
  });

  var state = { board: 'kills', mode: 'normal', page: 1, query: '' };
  var PER = 25;

  function data() { return build(state.mode); }

  function currentBoard() {
    return BOARDS.filter(function (b) { return b.id === state.board; })[0] || BOARDS[0];
  }

  function sortFor(board, rows) {
    var out = rows.slice();
    out.sort(function (a, b) {
      var av, bv;
      if (board.mcIdx != null) { av = a.mc[board.mcIdx]; bv = b.mc[board.mcIdx]; }
      else { av = a[board.key]; bv = b[board.key]; }
      return bv - av;
    });
    return out;
  }

  function render() {
    var board = currentBoard();
    var rows = data();
    if (state.query) {
      var q = state.query.toLowerCase();
      rows = rows.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
    }
    rows = sortFor(board, rows);
    var pages = Math.max(1, Math.ceil(rows.length / PER));
    if (state.page > pages) { state.page = 1; }
    var slice = rows.slice((state.page - 1) * PER, state.page * PER);

    var head = $('#hs-head'), body = $('#hs-body');
    var colsHtml = board.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
    head.innerHTML = '<th>Rank</th><th>Username</th>' + colsHtml;
    body.innerHTML = slice.map(function (p, i) {
      var rank = (state.page - 1) * PER + i + 1;
      var cls = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : '';
      var vals = board.get(p).map(function (v, ci) {
        return '<td class="' + (ci === board.cols.length - 1 && board.cols[ci] === 'KDR' ? 'kdr' : 'num') + '">' + v + '</td>';
      }).join('');
      return '<tr class="' + cls + '"><td class="rank">#' + rank + '</td><td class="u">' + p.name + '</td>' + vals + '</tr>';
    }).join('') || '<tr><td colspan="5" class="num" style="padding:30px;text-align:center">No players found.</td></tr>';

    var boardTitle = $('#hs-board-title');
    if (boardTitle) { boardTitle.textContent = board.label.toUpperCase() + ' HISCORE (' + (state.mode === 'hc' ? 'HARDCORE PVP' : 'NORMAL') + ')'; }

    var pager = $('#hs-pager');
    if (pager) {
      var html = '';
      for (var pg = 1; pg <= pages; pg++) {
        html += '<button data-pg="' + pg + '"' + (pg === state.page ? ' class="on"' : '') + '>' + pg + '</button>';
      }
      pager.innerHTML = html;
      $$('button', pager).forEach(function (b) {
        b.addEventListener('click', function () {
          state.page = parseInt(b.getAttribute('data-pg'), 10);
          render();
        });
      });
    }
  }

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  // category sidebar
  $$('.hs-cats a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      state.board = a.getAttribute('data-board');
      state.page = 1;
      $$('.hs-cats a').forEach(function (x) { x.classList.toggle('on', x === a); });
      render();
    });
  });

  // mode toggle
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      state.mode = b.getAttribute('data-mode');
      state.page = 1;
      render();
    });
  });

  // search
  var form = $('#hs-search');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      state.query = $('#hs-query').value.trim();
      state.page = 1;
      render();
      if (state.query) { rspklToast('Showing players matching "' + state.query + '".'); }
    });
  }

  render();
})();
