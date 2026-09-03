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

  // ---- board --------------------------------------------------------------

  var state = { sort: 'top', page: 1, cams: [], live: false };
  var player = null;

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
    return '' +
      '<div class="kc-rank">' + (state.sort === 'top' ? '#' + rank : ago(c.killedAt)) + '</div>' +
      '<div class="kc-body">' +
      '  <div class="kc-names"><b>' + c.killer + '</b> <i class="bi bi-caret-right-fill"></i> ' +
      '    <span>' + c.victim + '</span></div>' +
      '  <div class="kc-meta">' +
      '    <span>' + c.weaponName + '</span>' +
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
  }

  function sampleCards() {
    var demo = [
      ['Sudden Death', 'Ags Rushed', 'Armadyl godsword', 47, 62, 34, 128],
      ['Void Pray', 'Tank Btw', 'Dragon claws', 41, 18, 51, 96],
      ['Zerk Andy', 'Pure Rage', 'Granite maul', 33, 44, 29, 71]
    ];
    return demo.map(function (d, i) {
      return {
        id: 'sample-' + i, killer: d[0], victim: d[1], weaponName: d[2],
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

  /* What each fighter was wearing. The names come from the item definitions the
     export ships, keyed by the ids in the appearance block - the same lookup
     the replay does to find their models, so the list and the figure can never
     disagree about what someone had on. */
  function renderGear(cam) {
    var host = $('#kc-gear');
    if (!host || !window.KillcamAssets) { return; }
    var sides = [
      { key: 'killer', title: cam.killer.name || 'Killer', look: camApi.parseAppearance(cam.killer.appearanceBytes) },
      { key: 'victim', title: cam.victim.name || 'Victim', look: camApi.parseAppearance(cam.victim.appearanceBytes) }
    ];
    var ids = [];
    sides.forEach(function (side) {
      if (!side.look) { return; }
      Object.keys(side.look.items).forEach(function (slot) { ids.push(side.look.items[slot]); });
    });
    if (!ids.length) { host.innerHTML = ''; return; }

    window.KillcamAssets.defs('items', ids).then(function (defs) {
      host.innerHTML = sides.map(function (side) {
        if (!side.look) { return ''; }
        var rows = camApi.SLOTS.map(function (slot) {
          var id = side.look.items[slot];
          var def = id === undefined ? null : defs[id];
          if (!def || !def[0]) { return ''; }
          return '<li>' + escapeHtml(def[0]) + '<span>' + slot + '</span></li>';
        }).join('');
        var skull = side.look.skullIcon >= 0 ? '<li class="skull">Skulled<span>risk</span></li>' : '';
        return '<div class="' + side.key + '"><h4>' + escapeHtml(side.title) +
               ' &middot; lvl ' + side.look.combat + '</h4><ul>' + rows + skull + '</ul></div>';
      }).join('');
    }).catch(function () { host.innerHTML = ''; });
  }

  function openViewer(id) {
    var card = state.cams.filter(function (c) { return c.id === id; })[0];
    if (!card) { return; }
    var modal = $('#kc-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('#kc-modal-title').innerHTML = '<b>' + escapeHtml(card.killer) + '</b> vs ' + escapeHtml(card.victim);
    $('#kc-modal-stats').innerHTML =
      '<span>' + escapeHtml(card.weaponName) + '</span><span>' + card.killingBlow + ' dmg killing blow</span>' +
      '<span>' + card.hitpointsLeft + '% hp left</span>' +
      '<span>Lvl ' + card.killerCombat + ' vs ' + card.victimCombat + '</span>' +
      '<span>Wilderness ' + card.wildernessLevel + '</span>';
    var vb = $('#kc-modal-vote');
    vb.setAttribute('data-vote', card.id);
    vb.classList.toggle('on', !!card.voted);
    vb.innerHTML = '<i class="bi bi-caret-up-fill"></i><b>' + card.votes + '</b>';
    $('#kc-gear').innerHTML = '';

    if (!player) {
      player = new Player($('#kc-canvas'));
      window.__killcamPlayer = player;
    }
    var scrub = $('#kc-scrub');
    var tick = function (t) { scrub.value = String(Math.round(t * 100)); };
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
      renderGear(cam);

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

    document.addEventListener('click', function (e) {
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

    fetchBoard();
  });
})();
