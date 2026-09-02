/* RSPKL item database — sample slice (RSPKL-API: GET /api/items?q=&page=) */
(function () {
  'use strict';
  var ITEMS = [
    [1,'Cannonball'],[2,'Cannon Base'],[3,'Cannon Stand'],[4,'Cannon Barrels'],[5,'Cannon Furnace'],
    [8,'Bronze dagger'],[12,'Bronze axe'],[20,'Bronze pickaxe'],[24,'Bronze med helm'],[33,'Bronze kiteshield'],
    [40,'Bronze arrow'],[48,'Leather boots'],[58,'Leather gloves'],[66,'Leather cowl'],[74,'Leather vambraces'],
    [88,'Bronze sword'],[96,'Bronze scimitar'],[110,'Bronze longsword'],[120,'Bronze full helm'],[128,'Bronze sq shield'],
    [142,'Iron dagger'],[156,'Iron axe'],[164,'Iron pickaxe'],[172,'Iron med helm'],[186,'Iron kiteshield'],
    [200,'Iron arrow'],[216,'Bronze chainbody'],[232,'Iron chainbody'],[252,'Iron sword'],[264,'Iron scimitar'],
    [284,'Steel dagger'],[300,'Steel axe'],[312,'Steel pickaxe'],[322,'Steel med helm'],[340,'Steel kiteshield'],
    [392,'Steel arrow'],[408,'Steel chainbody'],[426,'Steel sword'],[440,'Steel scimitar'],[456,'Steel longsword'],
    [528,'Black dagger'],[544,'Black axe'],[556,'Black pickaxe'],[568,'Black med helm'],[584,'Black kiteshield'],
    [640,'Black sword'],[654,'Black scimitar'],[668,'Black longsword'],[680,'Black full helm'],[692,'Black sq shield'],
    [800,'Mithril dagger'],[820,'Mithril axe'],[832,'Mithril pickaxe'],[844,'Mithril med helm'],[862,'Mithril kiteshield'],
    [920,'Mithril sword'],[934,'Mithril scimitar'],[948,'Mithril longsword'],[960,'Mithril full helm'],[972,'Mithril sq shield'],
    [1100,'Adamant dagger'],[1120,'Adamant axe'],[1132,'Adamant pickaxe'],[1144,'Adamant med helm'],[1162,'Adamant kiteshield'],
    [1220,'Adamant sword'],[1234,'Adamant scimitar'],[1248,'Adamant longsword'],[1260,'Adamant full helm'],[1272,'Adamant sq shield'],
    [1300,'Rune dagger'],[1320,'Rune axe'],[1332,'Rune pickaxe'],[1344,'Rune med helm'],[1362,'Rune kiteshield'],
    [1420,'Rune sword'],[1434,'Rune scimitar'],[1448,'Rune longsword'],[1460,'Rune full helm'],[1472,'Rune sq shield'],
    [1560,'Dragon dagger'],[1580,'Dragon axe'],[1592,'Dragon pickaxe'],[1604,'Dragon med helm'],[1622,'Dragon kiteshield'],
    [1680,'Dragon sword'],[1694,'Dragon scimitar'],[1708,'Dragon longsword'],[1720,'Dragon full helm'],[1732,'Dragon sq shield'],
    [2400,'Amulet of strength'],[2402,'Amulet of power'],[2404,'Amulet of glory'],[2406,'Amulet of fury'],[2408,'Amulet of torture'],
    [2500,'Ring of recoil'],[2502,'Ring of dueling'],[2504,'Ring of forging'],[2506,'Ring of life'],[2508,'Berserker ring'],
    [2510,'Warrior ring'],[2512,'Archers ring'],[2514,'Seers ring'],[2516,'Ring of wealth'],
    [3000,'Fire rune'],[3002,'Water rune'],[3004,'Air rune'],[3006,'Earth rune'],[3008,'Mind rune'],
    [3010,'Chaos rune'],[3012,'Death rune'],[3014,'Blood rune'],[3016,'Soul rune'],[3018,'Wrath rune'],
    [4000,'Shortbow'],[4002,'Oak shortbow'],[4004,'Maple shortbow'],[4006,'Yew shortbow'],[4008,'Magic shortbow'],
    [4010,'Dark bow'],[4012,'Longbow'],[4014,'Oak longbow'],[4016,'Maple longbow'],[4018,'Yew longbow'],
    [5000,'Bronze full helm (g)'],[5002,'Iron full helm (g)'],[5004,'Steel full helm (g)'],[5006,'Black full helm (g)'],[5008,'Mithril full helm (g)'],
    [6000,'Shark'],[6002,'Manta ray'],[6004,'Tuna'],[6006,'Lobster'],[6008,'Swordfish'],
    [7000,'Prayer potion(4)'],[7002,'Super attack(4)'],[7004,'Super strength(4)'],[7006,'Super defence(4)'],[7008,'Super combat potion(4)'],
    [7010,'Saradomin brew(4)'],[7012,'Antidote++(4)'],[7014,'Antifire potion(4)'],[7016,'Ranging potion(4)'],[7018,'Magic potion(4)'],
    [8000,'Strength amulet (t)'],[8002,'Power amulet (t)'],[8004,'Glory (t)'],[8006,'Team cape x'],[8008,'Team cape zero'],
    [9000,'Mystic hat'],[9002,'Mystic robe top'],[9004,'Mystic robe bottom'],[9006,'Mystic gloves'],[9008,'Mystic boots'],
    [10000,'Infinity hat'],[10002,'Infinity top'],[10004,'Infinity bottoms'],[10006,'Infinity gloves'],[10008,'Infinity boots'],
    [11000,'Fighter torso'],[11002,'Fire cape'],[11004,'Abyssal whip'],[11006,'Granite maul'],[11008,'Dragon claws'],
    [12000,'Armadyl godsword'],[12002,'Bandos godsword'],[12004,'Saradomin godsword'],[12006,'Zamorak godsword'],[12008,'Dragon warhammer'],
    [13000,'Barrows gloves'],[13002,'Dragon defender'],[13004,'Avernic defender'],[13006,'Rune defender'],[13008,'Adamant defender'],
    [14000,'Dragon fire shield'],[14002,'Book of law'],[14004,'Unholy book'],[14006,'Book of balance'],[14008,'Holy book']
  ];
  var PER = 24;
  var state = { q: '', page: 1 };

  function $(s) { return document.querySelector(s); }

  function render() {
    var items = ITEMS;
    if (state.q) {
      var q = state.q.toLowerCase();
      items = ITEMS.filter(function (it) {
        return it[1].toLowerCase().indexOf(q) !== -1 || String(it[0]).indexOf(q) !== -1;
      });
    }
    var pages = Math.max(1, Math.ceil(items.length / PER));
    if (state.page > pages) { state.page = 1; }
    var slice = items.slice((state.page - 1) * PER, state.page * PER);

    $('#item-count').textContent = items.length.toLocaleString('en-US') + ' ITEMS';
    $('#item-grid').innerHTML = slice.map(function (it) {
      return '<div class="item-chip"><span class="id">ID ' + it[0] + '</span><b>' + it[1] + '</b></div>';
    }).join('') || '<p class="muted text-center" style="grid-column:1/-1;padding:30px 0">No items match that search.</p>';

    var pager = $('#item-pager');
    var html = '';
    if (pages > 1) {
      html += '<button data-pg="prev">PREV</button>';
      for (var pg = 1; pg <= pages; pg++) {
        html += '<button data-pg="' + pg + '"' + (pg === state.page ? ' class="on"' : '') + '>' + pg + '</button>';
      }
      html += '<button data-pg="next">NEXT</button>';
    }
    pager.innerHTML = html;
    Array.prototype.slice.call(pager.querySelectorAll('button')).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-pg');
        if (v === 'prev') { state.page = Math.max(1, state.page - 1); }
        else if (v === 'next') { state.page = Math.min(pages, state.page + 1); }
        else { state.page = parseInt(v, 10); }
        render();
      });
    });
  }

  $('#item-search').addEventListener('submit', function (e) {
    e.preventDefault();
    state.q = $('#item-query').value.trim();
    state.page = 1;
    render();
  });

  render();
})();
