/* RSPKL Top Killcams — the board, the vote, and the two ways to watch a cam.

   A cam arrives from the API as the game's own KCP1 bytes and is decoded by
   killcam-cam.js. From there it is drawn twice over: killcam-3d.js dresses both
   fighters in the gear their appearance blocks describe and plays the
   animations the fight played, and the tile board in this file draws the same
   nine ticks as positions on a grid. The tile board is what a browser without
   WebGL gets, and what anyone gets who would rather read a fight than watch it.

   Nothing about a cam is re-derived here: every number on screen is a field the
   world recorded at the moment of the kill. */
(function () {
  'use strict';

  var TICK_MS = 600;          // the game's tick, and therefore a frame's length
  var GRID = 17;              // MAX_RADIUS 8 either side of the base tile
  /* The hit mask ids the world writes - HitMask.BLUE, RED, GREEN, YELLOW - are
     the same ids the client indexes its hitsplat sprites by, so the site does
     no mapping of its own: it draws the cache's sprite for the mask the cam
     carries. The sprites are exported by `./gradlew -p client dumpSprites`,
     which runs the client's own Sprite decoder rather than a second one. */
  var SPLAT_BASE = '/assets/killcam/ui/hitmarks-';
  var SPLAT_COUNT = 4;

  function splatSprite(damage, hitType) {
    // A hit with no mask on it is a hit that landed, which is the red splat;
    // a zero always reads as the blue one, as it does in game.
    var mask = damage === 0 ? 0 : (hitType >= 0 && hitType < SPLAT_COUNT ? hitType : 1);
    return SPLAT_BASE + mask + '.png';
  }

  /* Sprites for the tile board, loaded once and drawn straight into the canvas.
     A miss on the first frame must not draw an empty box while the PNG is in
     flight, so a splat with no image yet is simply not drawn - the next frame
     has it. */
  var splatImages = {};

  function splatImage(damage, hitType) {
    var src = splatSprite(damage, hitType);
    if (!splatImages[src]) {
      var img = new Image();
      img.src = src;
      splatImages[src] = img;
    }
    var loaded = splatImages[src];
    return loaded.complete && loaded.naturalWidth ? loaded : null;
  }

  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  // ---- decoding -----------------------------------------------------------
  // The cam format and the appearance block inside it are decoded by
  // killcam-cam.js, which is loaded ahead of this file and is also what the
  // node tests read. One decoder, one grammar, one place a format change lands.

  var camApi = window.KillcamCam;

  function decodeCam(bytes) { return camApi.decodeCam(bytes); }

  function bytesFromBase64(b64) {
    var raw = window.atob(b64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { out[i] = raw.charCodeAt(i); }
    return out;
  }

  // ---- the player ---------------------------------------------------------

  function Player(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = null;
    this.t = 0;             // position in ticks, fractional between frames
    this.playing = false;
    this.raf = null;
    this.last = 0;
    this.onTick = null;
    var self = this;
    this.step = function (now) { self.frame(now); };
  }

  Player.prototype.load = function (cam) {
    this.cam = cam;
    this.t = 0;
    this.resize();
    this.draw();
  };

  Player.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var w = this.canvas.clientWidth || 520;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(w * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = w;
  };

  Player.prototype.play = function () {
    if (!this.cam || this.playing) { return; }
    if (this.t >= this.cam.frames - 1) { this.t = 0; }
    this.playing = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.step);
  };

  Player.prototype.pause = function () {
    this.playing = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  };

  Player.prototype.seek = function (t) {
    this.pause();
    this.t = Math.max(0, Math.min(this.cam ? this.cam.frames - 1 : 0, t));
    this.draw();
  };

  Player.prototype.frame = function (now) {
    if (!this.playing) { return; }
    if (!this.last) { this.last = now; }
    this.t += (now - this.last) / TICK_MS;
    this.last = now;
    if (this.t >= this.cam.frames - 1) {
      this.t = this.cam.frames - 1;
      this.playing = false;
      this.draw();
      if (this.onTick) { this.onTick(this.t, true); }
      return;
    }
    this.draw();
    if (this.onTick) { this.onTick(this.t, false); }
    this.raf = requestAnimationFrame(this.step);
  };

  /* Where a fighter is at a fractional tick. Interpolation and the rule about
     tiles the cam never recorded both live in killcam-anim.js, so the board and
     the 3D stage cannot disagree about where someone stood. */
  Player.prototype.at = function (actor, t) {
    return window.KillcamAnim.positionAt(actor.frames, t);
  };

  Player.prototype.draw = function () {
    var cam = this.cam;
    var ctx = this.ctx;
    var s = this.size;
    if (!cam) { return; }
    var cell = s / GRID;
    var half = (GRID - 1) / 2;

    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(0, 0, s, s);

    // The floor. A grid rather than a texture, because the only spatial facts a
    // cam holds are tiles, and drawing scenery would imply a place it does not
    // record.
    ctx.strokeStyle = 'rgba(120,108,80,.13)';
    ctx.lineWidth = 1;
    for (var g = 0; g <= GRID; g++) {
      var p = Math.round(g * cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
    }
    // The base tile: the killer's tile on the final frame, and the origin every
    // delta in the cam is measured from.
    ctx.strokeStyle = 'rgba(201,143,20,.28)';
    ctx.strokeRect(half * cell, half * cell, cell, cell);

    var toPx = function (d) { return (half + d + 0.5) * cell; };

    this.trail(cam.killer, '#c98f14', toPx, cell);
    this.trail(cam.victim, '#8f1d17', toPx, cell);

    var k = this.at(cam.killer, this.t);
    var v = this.at(cam.victim, this.t);
    if (k) {
      this.fighter(k, '#f5d97a', '#c98f14', toPx, cell, cam.killer.name, true);
      this.splats(k, toPx, cell);
    }
    if (v) {
      this.fighter(v, '#e8776f', '#8f1d17', toPx, cell, cam.victim.name, false);
      this.splats(v, toPx, cell);
    }
  };

  Player.prototype.trail = function (actor, color, toPx, cell) {
    var ctx = this.ctx;
    var upto = Math.floor(this.t);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    var started = false;
    for (var i = 0; i <= upto && i < actor.frames.length; i++) {
      var f = actor.frames[i];
      // A tile the cam did not record is not a step anyone took, so the trail
      // skips it rather than drawing a line off the board and back.
      if (!window.KillcamAnim.onBoard(f)) { continue; }
      var x = toPx(f.dx), y = toPx(f.dy);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  Player.prototype.fighter = function (at, fill, ring, toPx, cell, name, isKiller) {
    var ctx = this.ctx;
    var x = toPx(at.x), y = toPx(at.y);
    var r = cell * 0.32;
    var f = at.frame;

    // An animation is the fighter doing something on this tick — a swing, a
    // block, a special. The cam knows the id, not what it looks like, so it is
    // drawn as a strike ring rather than guessed at.
    if (f.anim >= 0) {
      ctx.strokeStyle = isKiller ? 'rgba(245,217,122,.55)' : 'rgba(232,119,111,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.85, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (f.gfx >= 0) {
      ctx.strokeStyle = 'rgba(125,178,224,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Facing. The wedge is the one thing on screen that shows who was on whom.
    // The frame stores the tile being faced, in the same deltas as a position,
    // so the direction is that tile minus this fighter's own - not the delta
    // itself, which points out of the cam's base tile and turned both fighters
    // the same way.
    if (f.facing && (f.faceDx !== f.dx || f.faceDy !== f.dy)) {
      var a = Math.atan2(f.faceDy - f.dy, f.faceDx - f.dx);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9);
      ctx.lineTo(x + Math.cos(a + 2.5) * r * 0.9, y + Math.sin(a + 2.5) * r * 0.9);
      ctx.lineTo(x + Math.cos(a - 2.5) * r * 0.9, y + Math.sin(a - 2.5) * r * 0.9);
      ctx.closePath();
      ctx.fill();
    }

    if (f.hp >= 0) {
      // Thirty by five, green over red, as the client draws it - the shape is
      // as much a part of recognising a Runescape fight as the hitsplat is.
      var bw = cell * 0.75, bh = Math.max(3, bw / 6);
      var bx = x - bw / 2, by = y - r - bh * 2.2;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(bx, by, bw * (Math.min(100, f.hp) / 100), bh);
    }

    ctx.fillStyle = '#d8ccb4';
    ctx.font = '600 ' + Math.max(9, Math.round(cell * 0.34)) + 'px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name || (isKiller ? 'Killer' : 'Victim'), x, y + r + cell * 0.52);
  };

  /* Hitsplats hold for a tick and rise, so a hit that lands on the tick you
     scrubbed to is still readable when the replay is paused. */
  Player.prototype.splats = function (at, toPx, cell) {
    var f = at.frame;
    if (f.damage < 0) { return; }
    var ctx = this.ctx;
    var rise = (this.t - Math.floor(this.t)) * cell * 0.5;
    var x = toPx(at.x), y = toPx(at.y) - cell * 0.55 - rise;
    var sprite = splatImage(f.damage, f.hitType);
    var size = Math.max(18, Math.round(cell * 0.8));
    if (sprite) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size * (23 / 24));
      ctx.imageSmoothingEnabled = true;
    }
    var text = String(f.damage);
    ctx.font = '700 ' + Math.max(10, Math.round(size * 0.5)) + 'px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(text, x, y + size * 0.17);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y + size * 0.17);
  };

  /* The ladder's tiers, mirroring EloRank
     (server/game/.../game/content/elo/EloRank.java): a floor, a title, and the
     real item whose model the game draws as that tier's emblem. The emblem is
     an item id, so the site can show a tier the same way it shows a weapon -
     the client's own render of a bronze med helm through a dragon chainbody -
     rather than painting eight badges that would have to be redrawn every time
     a tier is added.

     Edited together with EloRank and with the client's MenuRank. */
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

  /* The tier a rating falls in, or null when there is no rating to show. A
     rating at or below zero is a cam from before the ladder rode with cams,
     which is an absence and not a Bronze. */
  function rankOf(rating) {
    if (!(rating > 0)) { return null; }
    var found = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (rating >= RANKS[i].floor) { found = RANKS[i]; }
    }
    return found;
  }

  /* A signed move, as a player reads it. Zero is not "+0": an unrated kill is
     a deliberate statement by the world - a farmed alt, a repeat victim, a
     player still inside the intro - and a zero pretending to be a result reads
     as a bug. */
  function moveText(move) {
    if (!move) { return 'unrated'; }
    return move > 0 ? '+' + move : String(move);
  }

  function moveClass(move) {
    if (!move) { return 'flat'; }
    return move > 0 ? 'up' : 'down';
  }

  /* A fighter's name, as a link to their profile (website/assets/js/player.js).
     The board is where a spectator meets a name they do not recognise, so the
     name itself is the way in - the killer bold, the victim plain, as the row
     already read. */
  function playerLink(name, killer) {
    var inner = killer ? '<b>' + escapeHtml(name) + '</b>' : '<span>' + escapeHtml(name) + '</span>';
    return '<a class="u-link" href="/player/?name=' + encodeURIComponent(name) + '">' + inner + '</a>';
  }

  /* An item's real inventory icon, out of the sheets the client exported. An
     empty string where the loader is not on the page, so a row is a row of
     text rather than a hole. */
  function icon(id, cls, title) {
    return window.KillcamIcons ? window.KillcamIcons.icon(id, cls, title) : '';
  }

  // ---- board --------------------------------------------------------------

  var state = { sort: 'top', page: 1, cams: [], live: false };
  var player = null;
  // A cam id asked for by URL (`/killcams/?cam=<id>`), which is how the kill
  // feed and a player profile hand a single fight over. Held until the board
  // has painted, so the page behind the viewer is a board and not a blank.
  var pendingCam = null;

  function ago(iso) {
    var then = new Date(iso).getTime();
    if (!then) { return ''; }
    var mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 60) { return mins + 'm ago'; }
    if (mins < 1440) { return Math.round(mins / 60) + 'h ago'; }
    return Math.round(mins / 1440) + 'd ago';
  }

  function cardHtml(c, rank) {
    var wild = c.wildernessLevel ? 'Wilderness ' + c.wildernessLevel : 'Wilderness';
    // The card carries the weapon's id as well as its name, so the row shows
    // the item rather than describing it. A card with no id - a sample, or a
    // fighter who killed unarmed - draws the name alone.
    var weapon = c.weapon >= 0
      ? '<span class="kc-weapon-chip">' + icon(c.weapon, '', c.weaponName) +
        '<span>' + escapeHtml(c.weaponName) + '</span></span>'
      : '<span>' + escapeHtml(c.weaponName || 'Unarmed') + '</span>';
    // What the kill was worth, if the world said. The card carries the killer's
    // rating and move as columns of their own - the board prints them, and a
    // query that had to decode a replay to read a rating could not sort by it.
    var tier = rankOf(c.killerRating);
    var ladder = tier
      ? '<span class="kc-rank-chip" title="' + escapeHtml(tier.title + ' tier') + '">' +
        icon(tier.emblem, 'tier', tier.title + ' tier') +
        '<span>' + tier.title + ' ' + c.killerRating + '</span>' +
        '<em class="' + moveClass(c.killerMove) + '">' + moveText(c.killerMove) + '</em></span>'
      : '';
    return '' +
      '<div class="kc-rank">' + (state.sort === 'top' ? '#' + rank : ago(c.killedAt)) + '</div>' +
      '<div class="kc-body">' +
      '  <div class="kc-names">' + playerLink(c.killer, true) +
      '    <i class="bi bi-caret-right-fill"></i> ' + playerLink(c.victim, false) + '</div>' +
      '  <div class="kc-meta">' +
      '    ' + weapon + ladder +
      '    <span>' + c.killingBlow + ' dmg blow</span>' +
      '    <span>' + c.hitpointsLeft + '% hp left</span>' +
      '    <span>' + wild + '</span>' +
      '  </div>' +
      '</div>' +
      '<div class="kc-actions">' +
      '  <button class="kc-vote' + (c.voted ? ' on' : '') + '" data-vote="' + c.id + '"' +
      '    aria-pressed="' + (c.voted ? 'true' : 'false') + '">' +
      '    <i class="bi bi-caret-up-fill"></i><b>' + c.votes + '</b></button>' +
      '  <button class="btn btn-outline btn-sm" data-watch="' + c.id + '">WATCH</button>' +
      '</div>';
  }

  function renderBoard() {
    var list = $('#kc-list');
    if (!list) { return; }
    list.innerHTML = '';
    if (!state.cams.length) {
      list.appendChild(el('p', 'kc-empty', 'No cams on the board yet — the first kill of the season lands here.'));
      return;
    }
    state.cams.forEach(function (c, i) {
      var row = el('div', 'kc-card', cardHtml(c, (state.page - 1) * 12 + i + 1));
      row.setAttribute('data-id', c.id);
      list.appendChild(row);
    });
  }

  function renderPager(pages) {
    var pager = $('#kc-pager');
    if (!pager) { return; }
    pager.innerHTML = '';
    if (pages < 2) { return; }
    for (var i = 1; i <= Math.min(pages, 12); i++) {
      var b = el('button', i === state.page ? 'on' : '', String(i));
      b.setAttribute('data-page', String(i));
      pager.appendChild(b);
    }
  }

  function fetchBoard() {
    var path = '/api/killcams?sort=' + state.sort + '&page=' + state.page;
    var q = $('#kc-player-filter');
    if (q && q.value.trim()) { path += '&player=' + encodeURIComponent(q.value.trim()); }
    if (typeof window.rspklApi !== 'function') { return offline(); }
    window.rspklApi(path).then(function (d) {
      state.live = true;
      state.cams = d.cams || [];
      renderBoard();
      renderPager(d.pages || 1);
      var note = $('#kc-note');
      if (note) { note.style.display = 'none'; }
      openPending();
    }).catch(offline);
  }

  /* With no API the page still has to show what it is. These are built as
     decoded cams rather than as bytes, so the sample exercises the renderer and
     not the decoder — a fake pack would be a second format to keep in step. */
  function offline() {
    state.live = false;
    state.cams = sampleCards();
    renderBoard();
    renderPager(1);
    var note = $('#kc-note');
    if (note) { note.style.display = ''; }
    // No API, so a linked cam cannot be fetched either. Dropped rather than
    // left pending, so the next board paint does not try again.
    pendingCam = null;
  }

  /* Opens the cam a link asked for. It is usually not on the page that was
     painted - a feed post is months of board pages deep - so a cam that the
     board does not hold is fetched on its own and pushed onto the board's list,
     which is what the viewer reads its card from. */
  function openPending() {
    if (!pendingCam) { return; }
    var id = pendingCam;
    pendingCam = null;
    if (state.cams.some(function (c) { return c.id === id; })) { openViewer(id); return; }
    if (typeof window.rspklApi !== 'function') { return; }
    window.rspklApi('/api/killcam/' + encodeURIComponent(id)).then(function (d) {
      if (!d || !d.id) { return; }
      d.bytes = d.data;
      d.data = null;
      state.cams.push(d);
      openViewer(id);
    }).catch(function () {
      rspklToast('That killcam is no longer on the board.');
    });
  }

  function sampleCards() {
    // The weapon ids are real ones, so the sample board draws the same item
    // icons a live board does - the sheets are static assets and do not
    // depend on the API the sample stands in for.
    var demo = [
      ['Sudden Death', 'Ags Rushed', 'Armadyl godsword', 47, 62, 34, 128, 11802, 2043, 14],
      ['Void Pray', 'Tank Btw', 'Dragon claws', 41, 18, 51, 96, 13652, 1662, 21],
      ['Zerk Andy', 'Pure Rage', 'Granite maul', 33, 44, 29, 71, 4153, 1188, 9]
    ];
    return demo.map(function (d, i) {
      return {
        id: 'sample-' + i, killer: d[0], victim: d[1], weaponName: d[2],
        weapon: d[7], killerRating: d[8], killerMove: d[9],
        victimRating: d[8] - 60, victimMove: -d[9],
        killingBlow: d[3], hitpointsLeft: d[4], wildernessLevel: d[5], votes: d[6],
        killerCombat: 126, victimCombat: 118, frames: 9, voted: false,
        killedAt: new Date(Date.now() - (i + 1) * 5400000).toISOString(),
        sample: true
      };
    });
  }

  /* A sample cam's fight, so the player has something to draw with no API.
     Nine ticks of two fighters closing, hitting and one dying. */
  function sampleCam(card) {
    function actor(path, hits, anims) {
      return {
        name: '',
        frames: path.map(function (p, i) {
          return {
            dx: p[0], dy: p[1],
            anim: anims.indexOf(i) >= 0 ? 422 : -1,
            gfx: -1, gfxHeight: -1,
            damage: hits[i] === undefined ? -1 : hits[i],
            // Blue for a zero, red for a hit - the two masks a fight is mostly
            // made of, so the sample draws the splats a real cam would.
            hitType: hits[i] ? 1 : 0,
            hp: p[2],
            faceDx: p[3], faceDy: p[4], facing: true
          };
        })
      };
    }
    var killer = actor(
      [[-3, -3, 100, 1, 1], [-2, -2, 100, 1, 1], [-2, -1, 94, 1, 1], [-1, -1, 94, 1, 1],
       [-1, 0, 88, 1, 0], [0, 0, 82, 1, 0], [0, 0, 76, 1, 0], [0, 0, 70, 1, 0], [0, 0, 62, 1, 0]],
      { 2: 6, 4: 6, 6: 6, 8: 8 }, [1, 3, 5, 7]);
    var victim = actor(
      [[2, 3, 100, -1, -1], [2, 2, 92, -1, -1], [1, 2, 78, -1, -1], [1, 1, 78, -1, -1],
       [1, 1, 61, -1, 0], [1, 0, 44, -1, 0], [1, 0, 44, -1, 0], [1, 0, 22, -1, 0], [1, 0, 0, -1, 0]],
      { 1: 8, 2: 14, 4: 17, 5: 17, 7: 22, 8: 22 }, [2, 4, 6]);
    killer.name = card.killer;
    victim.name = card.victim;
    return {
      id: 0, epochSeconds: 0, baseX: 3200, baseY: 3600, plane: 0,
      wildernessLevel: card.wildernessLevel, killerCombat: card.killerCombat,
      victimCombat: card.victimCombat, weapon: -1, killingBlow: card.killingBlow,
      hitpointsLeft: card.hitpointsLeft, frames: 9, killer: killer, victim: victim
    };
  }

  // ---- voting -------------------------------------------------------------

  function vote(id, button) {
    var card = state.cams.filter(function (c) { return c.id === id; })[0];
    if (!card) { return; }
    var want = !card.voted;
    if (card.sample || !state.live) {
      // Nothing to post to. Move the button so the interaction is honest about
      // being a preview rather than silently doing nothing.
      card.voted = want;
      card.votes += want ? 1 : -1;
      paintVote(button, card);
      if (window.rspklToast) { window.rspklToast('Sample board — votes count when Season 1 opens.'); }
      return;
    }
    button.disabled = true;
    window.rspklApiPost('/api/killcam/' + encodeURIComponent(id) + '/vote', { vote: want })
      .then(function (d) {
        card.votes = d.votes;
        card.voted = d.voted;
        paintVote(button, card);
      })
      .catch(function () {
        if (window.rspklToast) { window.rspklToast('That vote did not go through — try again in a moment.'); }
      })
      .then(function () { button.disabled = false; });
  }

  function paintVote(button, card) {
    button.classList.toggle('on', !!card.voted);
    button.setAttribute('aria-pressed', card.voted ? 'true' : 'false');
    var n = button.querySelector('b');
    if (n) { n.textContent = card.votes; }
    var modal = $('#kc-modal-vote');
    if (modal && modal.getAttribute('data-vote') === card.id) {
      modal.classList.toggle('on', !!card.voted);
      var mn = modal.querySelector('b');
      if (mn) { mn.textContent = card.votes; }
    }
  }

  // ---- viewer -------------------------------------------------------------

  /* Two players over one cam. `stage` is the 3D one and owns the fight when
     the browser can draw it; `player` is the tile board. Only one is on screen
     at a time, and both are driven by the same scrub and the same play button,
     so switching view mid-replay keeps the tick you were on. */
  var stage = null;
  var view = 'tiles';

  function stageAvailable() {
    return !!(window.KillcamStage && window.KillcamStage.supported() && window.KillcamAssets);
  }

  function current() { return view === '3d' && stage ? stage : player; }

  /* Names, hitpoints and hitsplats over the 3D stage. Drawn as elements rather
     than into the canvas because they are text, and because they then scale
     with the page's own type rather than with the model space. */
  function overlay(readout) {
    var host = $('#kc-overlay');
    if (!host) { return; }
    var html = '';
    readout.forEach(function (f) {
      if (!f.visible) { return; }
      var bar = '';
      if (f.hp >= 0) {
        // Green over red, clamped, exactly as the client fills its two boxes.
        bar = '<div class="kc-bar"><span style="width:' + Math.min(100, f.hp) + '%"></span></div>';
      }
      html += '<div class="kc-tag ' + f.key + '" style="left:' + f.x + '%;top:' + f.y + '%">' +
              escapeHtml(f.name) + bar + '</div>';
      if (f.damage >= 0) {
        // The hitsplat is the sprite the client draws for that hit mask, and
        // the number rides on it - a zero is a blue splat with a 0 on it, not
        // the word "block", because that is what a player sees in game.
        html += '<div class="kc-splat" style="left:' + f.x + '%;top:' + (f.y + 6) +
                '%;background-image:url(' + splatSprite(f.damage, f.hitType) + ')">' +
                f.damage + '</div>';
      }
    });
    host.innerHTML = html;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }

  function showView(next) {
    view = next;
    var gl = $('#kc-gl'), tiles = $('#kc-canvas'), tags = $('#kc-overlay');
    if (gl) { gl.hidden = next !== '3d'; }
    if (tiles) { tiles.hidden = next === '3d'; }
    if (tags) { tags.innerHTML = ''; }
    var seg = $('#kc-view');
    if (seg) {
      Array.prototype.forEach.call(seg.children, function (b) {
        b.classList.toggle('on', b.getAttribute('data-view') === next);
      });
    }
    if (next === '3d' && stage) { stage.resize(); }
    if (next === 'tiles' && player && player.cam) { player.resize(); player.draw(); }
  }

  /* The scoreboard under the stage: who fought, in what, and what landed.

     Every number and every picture here is a field the world recorded at the
     moment of the kill. Gear comes out of the appearance block the cam carries,
     which is the same block the replay dresses the figures from, so the board
     and the fight cannot disagree about what someone had on. The icons are the
     client's own inventory renders, the hitsplats are the client's own sprites,
     and the head icons are the cache's - nothing on this panel is a shape drawn
     in CSS to resemble something the game draws. */

  /* The paperdoll, in the shape a player's own equipment tab is in. The
     appearance block carries twelve slots and no ammunition or ring, so the
     grid is the familiar one with the sleeve slot where ammunition sits. A null
     is a gap in the grid rather than an empty slot. */
  var DOLL = [
    [null, 'head', null],
    ['cape', 'amulet', 'arms'],
    ['weapon', 'body', 'shield'],
    [null, 'legs', null],
    ['hands', 'feet', 'beard']
  ];

  /* What a slot is called on the board. The block's own names are the
     renderer's; these are the game's. */
  var SLOT_LABEL = {
    head: 'Head', cape: 'Cape', amulet: 'Neck', arms: 'Sleeves', weapon: 'Weapon',
    body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet',
    beard: 'Jaw', hair: 'Hair'
  };

  /** An item's real name, out of the definitions the export ships. */
  function itemName(defs, id) {
    var def = id === undefined || id < 0 ? null : defs[id];
    return def && def[0] ? def[0] : '';
  }

  /**
   * One fighter's tale of the fight, from their own frames.
   *
   * A frame's damage is the hitsplat that was drawn *on* that fighter, so what
   * a fighter dealt is read off the other one's frames. Only the totals that
   * the recording actually supports are computed: there is no accuracy here,
   * because a cam holds the hits that landed and not the swings that missed.
   */
  function tally(frames) {
    var out = { taken: 0, hits: 0, blocks: 0, max: 0, hp: -1, first: -1 };
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.hp >= 0) { out.hp = f.hp; }
      if (f.damage < 0) { continue; }
      out.taken += f.damage;
      if (f.damage === 0) { out.blocks++; } else { out.hits++; }
      if (f.damage > out.max) { out.max = f.damage; }
      if (out.first < 0) { out.first = i; }
    }
    return out;
  }

  /* A head icon is the cache's own sprite, indexed exactly as the client
     indexes it: headicons_prayer by the overhead prayer, headicons_pk by the
     skull. Both read -1 when nothing is set. */
  function headIcon(kind, index, title) {
    if (!(index >= 0)) { return ''; }
    return '<i class="kc-head" title="' + escapeHtml(title) + '" role="img"' +
           ' aria-label="' + escapeHtml(title) + '"' +
           ' style="background-image:url(/assets/killcam/ui/headicons_' + kind +
           '-' + index + '.png)"></i>';
  }

  /** One fighter's column: identity, what they landed, and the paperdoll. */
  function sideMarkup(side, defs, won, hp) {
    var look = side.look;
    var rows = DOLL.map(function (row) {
      return '<div class="kc-doll-row">' + row.map(function (slot) {
        if (!slot) { return '<span class="kc-slot gap"></span>'; }
        var worn = look ? look.items[slot] : undefined;
        var name = itemName(defs, worn);
        if (!(worn >= 0)) {
          // Empty, or an identity kit showing through - a bare arm is not a
          // piece of equipment, so it draws as an empty slot either way.
          return '<span class="kc-slot" title="' + escapeHtml(SLOT_LABEL[slot] || slot) + '"></span>';
        }
        return '<span class="kc-slot on" title="' + escapeHtml(name || SLOT_LABEL[slot] || slot) + '">' +
               icon(worn, '', name || SLOT_LABEL[slot]) + '</span>';
      }).join('') + '</div>';
    }).join('');

    // What this fighter landed is read off the other one's frames: a frame's
    // damage is the hitsplat that was drawn on the fighter it belongs to.
    var out = side.dealt;
    var bar = Math.max(0, Math.min(100, hp));
    return '<div class="kc-side ' + side.key + '">' +
      '<div class="kc-who-line">' +
        headIcon('pk', look && look.skullIcon >= 0 ? look.skullIcon : -1, 'Skulled') +
        headIcon('prayer', look && look.prayerIcon >= 0 ? look.prayerIcon : -1, 'Overhead prayer') +
        '<b>' + escapeHtml(side.name || (side.key === 'killer' ? 'Killer' : 'Victim')) + '</b>' +
      '</div>' +
      '<div class="kc-who-sub">' +
        '<span class="kc-tagline ' + (won ? 'win' : 'loss') + '">' + (won ? 'Winner' : 'Defeated') + '</span>' +
        '<span>Lvl ' + (look ? look.combat : side.combat || 0) + '</span>' +
      '</div>' +
      '<div class="kc-hp"><div class="kc-hp-bar"><span style="width:' + bar + '%"></span></div>' +
        '<em>' + bar + '%</em></div>' +
      ratingRow(side.rating, side.move) +
      '<div class="kc-mini">' +
        '<div><span>Dealt</span><b>' + out.taken + '</b></div>' +
        '<div><span>Max</span><b>' + out.max + '</b></div>' +
        '<div><span>Hits</span><b>' + out.hits + '</b></div>' +
      '</div>' +
      '<div class="kc-doll">' + rows + '</div>' +
    '</div>';
  }

  /**
   * A fighter's league standing after the kill: the tier's own emblem, the
   * tier, the rating, and what this fight moved it by.
   *
   * The rating before is not printed beside the one after - a card is read at a
   * glance and two four-digit numbers next to each other are two things to
   * compare rather than one thing to read - but it is on the tooltip, because
   * the move and the rating are the same statement seen twice and someone
   * checking a ladder wants both.
   */
  function ratingRow(rating, move) {
    var rank = rankOf(rating);
    if (!rank) {
      // No rating on the cam at all: one written before the ladder rode with
      // them. Nothing true to say, so nothing is said.
      return '';
    }
    var before = rating - move;
    return '<div class="kc-rank-row" title="' + escapeHtml(rank.title + ' \u00b7 ' + before +
             ' to ' + rating) + '">' +
      icon(rank.emblem, 'tier', rank.title + ' tier') +
      '<span class="kc-rank-name">' + escapeHtml(rank.title) + '</span>' +
      '<b>' + rating + '</b>' +
      '<em class="' + moveClass(move) + '">' + moveText(move) + '</em>' +
    '</div>';
  }

  /**
   * The tape: one column per recorded tick, both fighters' hitsplats on it.
   *
   * This is the fight as the recording holds it - nine ticks, the splat the
   * client would have drawn on each, the damage on top of it. The top row is
   * what the killer landed, which is read off the victim's frames, because a
   * frame's damage is the splat that was drawn on the fighter it belongs to. A
   * column with nothing in it is a tick where neither man was hit, which is as
   * much a part of reading a fight as the hits are, so it is drawn empty rather
   * than skipped.
   */
  function tapeMarkup(cam, sides) {
    var cols = '';
    for (var t = 0; t < cam.frames; t++) {
      var k = cam.killer.frames[t] || {}, v = cam.victim.frames[t] || {};
      cols += '<button class="kc-tick" data-tick="' + t + '" type="button"' +
              ' title="Tick ' + (t + 1) + ' &middot; ' + ((t * TICK_MS) / 1000).toFixed(1) + 's">' +
              splatCell(v.damage, v.hitType, 'k') +
              splatCell(k.damage, k.hitType, 'v') +
              '<em>' + (t + 1) + '</em></button>';
    }
    return '<div class="kc-tape" id="kc-tape">' +
      '<div class="kc-tape-key">' +
        '<span class="k">' + escapeHtml(sides[0].name || 'Killer') + ' landed</span>' +
        '<span class="v">' + escapeHtml(sides[1].name || 'Victim') + ' landed</span>' +
      '</div>' +
      '<div class="kc-tape-cols">' + cols + '</div></div>';
  }

  /* One cell of the tape. The splat is the sprite the client draws for that hit
     mask with the number riding on it, which is why a zero is a blue splat with
     a 0 on it and not the word "block". */
  function splatCell(damage, hitType, who) {
    if (!(damage >= 0)) { return '<span class="kc-cell ' + who + ' none"></span>'; }
    return '<span class="kc-cell ' + who + '">' +
           '<span class="kc-splat-s" style="background-image:url(' +
           splatSprite(damage, hitType) + ')">' + damage + '</span></span>';
  }

  /** The tiles: the scalars about the kill rather than about a fighter. */
  function tilesMarkup(cam, card, defs) {
    var weapon = cam.weapon >= 0 ? cam.weapon : -1;
    var weaponName = itemName(defs, weapon) || card.weaponName || 'Unarmed';
    var blow = card.killingBlow != null ? card.killingBlow : cam.killingBlow;
    var tiles = [
      ['Killing blow', blow, 'damage'],
      ['HP left', (cam.hitpointsLeft != null ? cam.hitpointsLeft : 0) + '%', 'on the winner'],
      ['Wilderness', cam.wildernessLevel || card.wildernessLevel || 0, 'level'],
      ['Recorded', ((cam.frames * TICK_MS) / 1000).toFixed(1) + 's', cam.frames + ' ticks']
    ];
    return '<div class="kc-weapon">' +
        icon(weapon, 'big', weaponName) +
        '<div><span>Killing weapon</span><b>' + escapeHtml(weaponName) + '</b></div>' +
      '</div>' +
      '<div class="kc-tiles">' + tiles.map(function (t) {
        return '<div class="kc-tile"><span>' + t[0] + '</span><b>' + t[1] +
               '</b><em>' + t[2] + '</em></div>';
      }).join('') + '</div>';
  }

  /**
   * Draw the whole board for a cam.
   *
   * The item definitions are fetched for exactly the ids the two blocks name -
   * the same lookup the replay does to find their models - so the names on the
   * board and the models on the stage come out of one read of one table.
   */
  function renderScoreboard(cam, card) {
    var host = $('#kc-scoreboard');
    if (!host || !window.KillcamAssets) { return; }
    var sides = [
      { key: 'killer', name: cam.killer.name || card.killer,
        combat: cam.killerCombat, look: camApi.parseAppearance(cam.killer.appearanceBytes) },
      { key: 'victim', name: cam.victim.name || card.victim,
        combat: cam.victimCombat, look: camApi.parseAppearance(cam.victim.appearanceBytes) }
    ];
    cam.killer.stat = tally(cam.killer.frames);
    cam.victim.stat = tally(cam.victim.frames);
    sides[0].stat = cam.killer.stat;
    sides[1].stat = cam.victim.stat;

    var ids = [];
    sides.forEach(function (side) {
      if (!side.look) { return; }
      Object.keys(side.look.items).forEach(function (slot) { ids.push(side.look.items[slot]); });
    });
    if (cam.weapon >= 0) { ids.push(cam.weapon); }
    if (window.KillcamIcons) { window.KillcamIcons.warm(ids); }

    // A fighter's output is the other one's frames, and the hitpoints on the
    // panel are the cam's own statement about the kill rather than the last
    // bar a frame happened to carry: the winner ended on hpLeft, and the
    // loser ended dead, which is the one thing every cam agrees on.
    sides[0].dealt = cam.victim.stat;
    sides[1].dealt = cam.killer.stat;
    // The ladder's own numbers, off the tail of the cam. A cam with no tail -
    // one written before the ladder rode along - leaves these at zero, and
    // ratingRow draws nothing rather than a Bronze nobody was.
    var ladder = cam.rating || { killerRating: 0, victimRating: 0, killerMove: 0, victimMove: 0 };
    sides[0].rating = ladder.killerRating;
    sides[0].move = ladder.killerMove;
    sides[1].rating = ladder.victimRating;
    sides[1].move = ladder.victimMove;
    var left = cam.hitpointsLeft != null ? cam.hitpointsLeft : 100;

    var draw = function (defs) {
      host.innerHTML =
        '<div class="kc-sides">' +
          sideMarkup(sides[0], defs, true, left) +
          sideMarkup(sides[1], defs, false, 0) +
        '</div>' +
        tapeMarkup(cam, sides) +
        tilesMarkup(cam, card, defs);
    };

    if (!ids.length) { draw({}); return; }
    window.KillcamAssets.defs('items', ids)
      .then(draw)
      .catch(function () { draw({}); });
  }

  /* Which column of the tape is the tick on screen. Set by playback as well as
     by a click, so the tape reads as a playhead rather than as a static list. */
  function markTick(at) {
    var tape = $('#kc-tape');
    if (!tape) { return; }
    var index = Math.round(at);
    Array.prototype.forEach.call(tape.querySelectorAll('[data-tick]'), function (b) {
      b.classList.toggle('now', Number(b.getAttribute('data-tick')) === index);
    });
  }

  function openViewer(id) {
    var card = state.cams.filter(function (c) { return c.id === id; })[0];
    if (!card) { return; }
    var modal = $('#kc-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('#kc-modal-title').innerHTML = playerLink(card.killer, true) + ' vs ' + playerLink(card.victim, false);
    var vb = $('#kc-modal-vote');
    vb.setAttribute('data-vote', card.id);
    vb.classList.toggle('on', !!card.voted);
    vb.innerHTML = '<i class="bi bi-caret-up-fill"></i><b>' + card.votes + '</b>';
    // The board is rebuilt from the cam once it decodes; until then it holds
    // nothing rather than the last fight's numbers.
    $('#kc-scoreboard').innerHTML = '';

    if (!player) {
      player = new Player($('#kc-canvas'));
      window.__killcamPlayer = player;
    }
    var scrub = $('#kc-scrub');
    var tick = function (t) { scrub.value = String(Math.round(t * 100)); markTick(t); };
    player.onTick = tick;

    var loading = $('#kc-loading');
    var show = function (cam) {
      if (!cam) {
        $('#kc-status').textContent = 'This replay could not be read.';
        if (loading) { loading.hidden = true; }
        return;
      }
      $('#kc-status').textContent = cam.frames + ' ticks · ' +
        (cam.frames * TICK_MS / 1000).toFixed(1) + 's';
      scrub.max = String((cam.frames - 1) * 100);
      scrub.value = '0';
      player.load(cam);
      renderScoreboard(cam, card);

      if (cam.sample || !stageAvailable()) {
        // No WebGL, or no gzip stream to unpack the meshes with. The tile board
        // is the whole viewer here rather than a placeholder for one.
        showView('tiles');
        if (loading) { loading.hidden = true; }
        var seg = $('#kc-view');
        if (seg) { seg.style.display = 'none'; }
        player.play();
        return;
      }

      showView('3d');
      if (loading) { loading.hidden = false; }
      if (!stage) {
        stage = new window.KillcamStage.Stage($('#kc-gl'));
        stage.overlay = overlay;
        // Exposed so the browser test can look at the fight the page is
        // actually drawing rather than at a screenshot of it.
        window.__killcamStage = stage;
      }
      stage.onTick = tick;
      stage.load(cam).then(function (built) {
        if (loading) { loading.hidden = true; }
        if (!built) {
          // Both fighters failed to assemble - no gear, no meshes, nothing to
          // dress. The cam is still a fight, so the tiles get it.
          showView('tiles');
          player.play();
          return;
        }
        stage.play();
      }).catch(function () {
        if (loading) { loading.hidden = true; }
        showView('tiles');
        player.play();
      });
    };

    if (card.sample || !state.live) {
      var sample = sampleCam(card);
      // A sample cam has no appearance blocks - it is a drawing of a fight, not
      // a recording of one - so there is nobody to dress and the tiles have it.
      sample.sample = true;
      show(sample);
      return;
    }
    $('#kc-status').textContent = 'Loading replay…';
    // A cam opened from a link (`?cam=`) was already fetched to find out who is
    // in it, and those bytes are the replay. Reusing them keeps a deep link to
    // one request, and keeps the view counter honest: one watch, one view.
    if (card.bytes) {
      var carried = card.bytes;
      card.bytes = null;
      show(decodeCam(bytesFromBase64(carried)));
      return;
    }
    window.rspklApi('/api/killcam/' + encodeURIComponent(card.id))
      .then(function (d) { show(decodeCam(bytesFromBase64(d.data))); })
      .catch(function () { $('#kc-status').textContent = 'That replay could not be loaded.'; });
  }

  function closeViewer() {
    if (player) { player.pause(); }
    if (stage) { stage.pause(); }
    $('#kc-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---- wiring -------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('#kc-list')) { return; }

    // The item icon export's version, so a sheet URL is per-export: a
    // re-export is a different URL and the same export is the same one.
    var modalEl = $('#kc-modal');
    if (modalEl && window.KillcamIcons) {
      window.KillcamIcons.setVersion(modalEl.getAttribute('data-items') || '');
    }

    document.addEventListener('click', function (e) {
      // A column of the tape is a tick of the fight, so clicking one seeks
      // there - reading the hits and watching them are the same panel.
      var t = e.target.closest('#kc-tape [data-tick]');
      if (t) {
        var active = current();
        if (active && active.cam) {
          active.pause();
          active.seek(Number(t.getAttribute('data-tick')));
          var scrubBar = $('#kc-scrub');
          if (scrubBar) { scrubBar.value = String(Number(t.getAttribute('data-tick')) * 100); }
          var playBtn = $('#kc-play');
          if (playBtn) { playBtn.innerHTML = '<i class="bi bi-play-fill"></i>'; }
          markTick(Number(t.getAttribute('data-tick')));
        }
        return;
      }
      var v = e.target.closest('[data-vote]');
      if (v) { vote(v.getAttribute('data-vote'), v); return; }
      var w = e.target.closest('[data-watch]');
      if (w) { openViewer(w.getAttribute('data-watch')); return; }
      var p = e.target.closest('#kc-pager [data-page]');
      if (p) { state.page = Number(p.getAttribute('data-page')); fetchBoard(); return; }
      var s = e.target.closest('#kc-sort [data-sort]');
      if (s) {
        state.sort = s.getAttribute('data-sort');
        state.page = 1;
        Array.prototype.forEach.call(s.parentNode.children, function (b) { b.classList.remove('on'); });
        s.classList.add('on');
        fetchBoard();
        return;
      }
      if (e.target.closest('#kc-close') || e.target.id === 'kc-modal') { closeViewer(); }
    });

    var play = $('#kc-play');
    if (play) {
      play.addEventListener('click', function () {
        var active = current();
        if (!active || !active.cam) { return; }
        if (active.playing) { active.pause(); play.innerHTML = '<i class="bi bi-play-fill"></i>'; }
        else { active.play(); play.innerHTML = '<i class="bi bi-pause-fill"></i>'; }
      });
    }
    var scrub = $('#kc-scrub');
    if (scrub) {
      scrub.addEventListener('input', function () {
        var active = current();
        if (active) { active.seek(Number(scrub.value) / 100); }
        if (play) { play.innerHTML = '<i class="bi bi-play-fill"></i>'; }
      });
    }
    var views = $('#kc-view');
    if (views) {
      views.addEventListener('click', function (e) {
        var button = e.target.closest('[data-view]');
        if (!button) { return; }
        var next = button.getAttribute('data-view');
        if (next === view) { return; }
        // Carry the tick across rather than restarting: the two views are two
        // readings of one recording, and the moment you were looking at is the
        // reason you switched.
        var at = current() ? current().t : 0;
        var running = current() && current().playing;
        if (current()) { current().pause(); }
        showView(next);
        var active = current();
        if (active && active.cam) {
          active.seek(at);
          if (running) { active.play(); }
        }
        if (play) {
          play.innerHTML = running ? '<i class="bi bi-pause-fill"></i>' : '<i class="bi bi-play-fill"></i>';
        }
      });
    }
    var form = $('#kc-search');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        state.page = 1;
        fetchBoard();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeViewer(); }
    });
    window.addEventListener('resize', function () {
      if (player && player.cam) { player.resize(); player.draw(); }
      if (stage) { stage.resize(); }
    });

    // Deep links: `?player=` opens the board filtered to one fighter, `?cam=`
    // opens a single fight. Both are how the rest of the site points here -
    // a profile's "all killcams", a feed post's "watch replay".
    var params = new URLSearchParams(window.location.search);
    var who = (params.get('player') || '').trim().slice(0, 24);
    if (who) {
      var filter = $('#kc-player-filter');
      if (filter) { filter.value = who; }
      state.sort = 'new';
      var seg = $('#kc-sort');
      if (seg) {
        Array.prototype.forEach.call(seg.children, function (b) {
          b.classList.toggle('on', b.getAttribute('data-sort') === 'new');
        });
      }
    }
    pendingCam = (params.get('cam') || '').trim().slice(0, 64) || null;

    fetchBoard();
  });
})();
