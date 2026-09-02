/* RSPKL drop tables + rank drop-rate calculator (RSPKL-API: GET /api/droptables) */
(function () {
  'use strict';
  var RANKS = [
    { id: 'regular', label: 'Regular Player', pct: 0 },
    { id: 'qualifier', label: 'Qualifier', pct: 15 },
    { id: 'div3', label: 'Div 3', pct: 20 },
    { id: 'div2', label: 'Div 2', pct: 25 },
    { id: 'div1', label: 'Div 1', pct: 30 },
    { id: 'grandmaster', label: 'Grandmaster', pct: 35 },
    { id: 'champion', label: 'Champion', pct: 40 }
  ];
  var MONSTERS = {
    'King Black Dragon': [
      ['Black dragon trophy', 2500, '64,000 PKP'], ['Draconic relic', 1250, '32,000 PKP'],
      ['Draconic medallion', 625, '16,000 PKP'], ['Draconic statuette', 400, '8,000 PKP'],
      ['Draconic totem', 200, '4,000 PKP'], ['Dragon hunter wand', 128, '15,000 PKP'],
      ['Dragonfire shield', 128, '50,000 PKP'], ['Kbd heads', 64, '5,000 PKP'],
      ['Fire cape', 32, '1,000 PKP'], ['Fighter torso', 32, '1,000 PKP'],
      ['Berserker ring', 16, '500 PKP'], ['Dragon pickaxe', 16, '3,000 PKP'],
      ['Super combat potion(4)', 1, '10 - 40 PKP'], ['Anglerfish', 1, '4 - 16 PKP']
    ],
    'Corporeal Beast': [
      ['Elysigian sigil', 3600, '260,000 PKP'], ['Spectral sigil', 1600, '120,000 PKP'],
      ['Arcane sigil', 1600, '120,000 PKP'], ['Holy elixir', 320, '44,000 PKP'],
      ['Spirit shield', 68, '12,000 PKP'], ['White crystal key', 5, '400 PKP'],
      ['Mystic robe top (dark)', 1, '12 - 60 PKP']
    ],
    'Zulrah': [
      ['Tanzanite mutagen', 4000, '300,000 PKP'], ['Magma mutagen', 4000, '300,000 PKP'],
      ['Jar of swamp', 1000, '40,000 PKP'], ['Pet snakeling', 3000, '90,000 PKP'],
      ['Serpentine visage', 320, '26,000 PKP'], ['Magic fang', 200, '14,000 PKP'],
      ['Toxic blowpipe', 128, '11,500 PKP'], ['Uncharged toxic staff', 128, '18,000 PKP'],
      ['Zul-andra teleport', 8, '80 - 320 PKP'], ['Snakeskin', 1, '2 - 9 PKP']
    ],
    'Kraken': [
      ['Jar of sand', 1000, '40,000 PKP'], ['Pet kraken', 3000, '90,000 PKP'],
      ['Kraken tentacle', 180, '16,500 PKP'], ['Trident of the seas (full)', 120, '10,500 PKP'],
      ['Mystic hat (dark)', 1, '9 - 45 PKP']
    ],
    'Callisto': [
      ['Callisto cub', 2500, '180,000 PKP'], ['Tyrannical ring', 128, '36,000 PKP'],
      ['Dark bow', 180, '21,000 PKP'], ['Dragon 2h sword', 96, '19,000 PKP'],
      ['Callisto teleport', 8, '80 - 320 PKP']
    ],
    'Venenatis': [
      ['Venenatis spiderling', 2500, '180,000 PKP'], ['Treasonous ring', 128, '36,000 PKP'],
      ['Dragon pickaxe', 96, '26,000 PKP'], ['Venenatis teleport', 8, '80 - 320 PKP']
    ],
    "Vet'ion": [
      ["Vet'ion jr.", 2500, '180,000 PKP'], ['Ring of the gods', 128, '36,000 PKP'],
      ['Mystic boots (dark)', 96, '4,000 PKP'], ["Vet'ion teleport", 8, '80 - 320 PKP']
    ],
    'Scorpia': [
      ['Scorpia offspring', 2500, '180,000 PKP'], ['Odium ward', 128, '28,000 PKP'],
      ['Malediction ward', 128, '28,000 PKP'], ['Scorpia teleport', 8, '80 - 320 PKP']
    ],
    'Chaos Elemental': [
      ['Pet chaos elemental', 2500, '180,000 PKP'], ['Dragon 2h sword', 128, '19,000 PKP'],
      ['Rune platebody', 64, '3,400 PKP'], ['Ancient staff', 32, '8,000 PKP']
    ],
    'TzTok-Jad': [
      ['Fire cape', 1, '1,000 PKP'], ['Tzrek-jad', 200, '120,000 PKP'],
      ['Jad teleport', 8, '80 - 320 PKP']
    ],
    'Skotizo': [
      ['Jar of darkness', 1000, '40,000 PKP'], ['Skotos pet', 3000, '90,000 PKP'],
      ['Uncut zenyte', 80, '30,000 PKP'], ['Dark claw', 30, '9,500 PKP'],
      ['Ancient shard', 5, '1,200 PKP']
    ],
    'Revenant Dragon': [
      ['Revenant ether', 1, '300 - 900 PKP'], ['Bracelet of ethereum (uncharged)', 24, '6,400 PKP'],
      ['Ancient crystal', 32, '9,800 PKP'], ['Viggora\'s chainmace (u)', 128, '58,000 PKP'],
      ['Craw\'s bow (u)', 128, '58,000 PKP'], ['Thammaron\'s sceptre (u)', 128, '58,000 PKP'],
      ['Revenant cave teleport', 12, '400 - 1,600 PKP']
    ]
  };

  var rank = RANKS[0], monster = 'King Black Dragon';

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function fmtRate(base) {
    if (base === 1) { return 'Always'; }
    var boosted = Math.max(2, Math.round(base / (1 + rank.pct / 100)));
    return '1/' + boosted.toLocaleString('en-US');
  }

  function render() {
    $('#dt-monster').textContent = monster.toUpperCase();
    $('#dt-rank-view').textContent = rank.label + (rank.pct ? ' (+' + rank.pct + '%' + ')' : '') + ' — ' +
      (rank.pct ? '+' + rank.pct + '% DROP RATES' : 'BASE DROP RATES');
    var drops = MONSTERS[monster];
    $('#dt-count').textContent = drops.length + ' DROPS';
    $('#dt-body').innerHTML = drops.map(function (d) {
      return '<tr><td class="u">' + d[0].toUpperCase() + '</td><td class="rate">' + fmtRate(d[1]) + '</td><td class="pkp">' + d[2] + '</td></tr>';
    }).join('');
  }

  $$('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.chip').forEach(function (x) { x.classList.toggle('on', x === c); });
      rank = RANKS.filter(function (r) { return r.id === c.getAttribute('data-rank'); })[0];
      render();
    });
  });

  var mGrid = $('#dt-monsters');
  var names = Object.keys(MONSTERS);
  mGrid.innerHTML = names.map(function (n) {
    return '<button class="monster-btn' + (n === monster ? ' on' : '') + '" data-m="' + n + '">' + n + '</button>';
  }).join('');
  $$('button', mGrid).forEach(function (b) {
    b.addEventListener('click', function () {
      monster = b.getAttribute('data-m');
      $$('button', mGrid).forEach(function (x) { x.classList.toggle('on', x === b); });
      render();
    });
  });

  $('#dt-search').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#dt-query').value.trim().toLowerCase();
    if (!q) { return; }
    var hit = names.filter(function (n) { return n.toLowerCase().indexOf(q) !== -1; })[0];
    if (hit) {
      monster = hit;
      $$('button', mGrid).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-m') === hit); });
      render();
    } else {
      rspklToast('No monster named "' + $('#dt-query').value.trim() + '" in the database.');
    }
  });

  render();
})();
