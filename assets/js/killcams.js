/* RSPKL Top Killcams — board, voting, and the replay player.
   The player decodes KCP1 (the game's own cam format) and draws the fight on a
   tile board. Nothing about a cam is re-derived here: every number on screen is
   a field the world recorded at the moment of the kill. */
(function () {
  'use strict';

  var TICK_MS = 600;          // the game's tick, and therefore a frame's length
  var GRID = 17;              // MAX_RADIUS 8 either side of the base tile
  var HIT_COLORS = ['#e02a1e', '#5fbfa4', '#7db2e0', '#f5d97a'];

  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html != null) { n.innerHTML = html; }
    return n;
  }

  // ---- KCP1 ---------------------------------------------------------------
  // The single-cam form: uncompressed, one presence byte a frame. This mirrors
  // KillcamCodec#decodeCam byte for byte, and is the only place on the site
  // that knows the layout — the renderer below reads fields, never bytes.

  function Reader(bytes) { this.b = bytes; this.p = 0; }
  Reader.prototype.u8 = function () { return this.b[this.p++]; };
  Reader.prototype.s8 = function () { var v = this.b[this.p++]; return v > 127 ? v - 256 : v; };
  Reader.prototype.u16 = function () { var v = (this.b[this.p] << 8) | this.b[this.p + 1]; this.p += 2; return v; };
  Reader.prototype.u32 = function () {
    var v = this.b[this.p] * 16777216 + (this.b[this.p + 1] << 16) + (this.b[this.p + 2] << 8) + this.b[this.p + 3];
    this.p += 4;
    return v;
  };

  var BASE37 = '_abcdefghijklmnopqrstuvwxyz0123456789';

  /* A username as the appearance block already carries it: base-37, most
     significant character first. Decoded here so the card and the replay agree
     on a name without the API having to send it twice. */
  function nameFromLong(hi, lo) {
    var out = '';
    // Split across two 32-bit halves because JS numbers cannot hold a long.
    var h = hi, l = lo;
    while (h > 0 || l > 0) {
      var rem = (h % 37) * 4294967296 + l;
      var c = rem % 37;
      out = BASE37.charAt(c) + out;
      l = Math.floor(rem / 37);
      h = Math.floor(h / 37);
    }
    out = out.replace(/_/g, ' ').trim();
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
  }

  function readFrame(r) {
    var f = r.u8();
    // Absent fields read back as -1, which is what the Java decoder produces:
    // the format spends no byte distinguishing "not facing anywhere" from the
    // tile at -1,-1, and the renderer treats the pair as absent.
    var out = { dx: 0, dy: 0, anim: -1, gfx: -1, gfxHeight: -1, damage: -1, hitType: -1, hp: -1, faceDx: -1, faceDy: -1 };
    if (f & 0x01) { out.dx = r.s8(); out.dy = r.s8(); }
    if (f & 0x02) { out.anim = r.u16(); }
    if (f & 0x04) { out.gfx = r.u16(); out.gfxHeight = r.u8(); }
    if (f & 0x08) { out.damage = r.u8(); out.hitType = r.u8(); }
    if (f & 0x10) { out.hp = r.u8(); }
    if (f & 0x20) { out.faceDx = r.s8(); out.faceDy = r.s8(); }
    return out;
  }

  function readActor(r, frames) {
    var hi = r.u32(), lo = r.u32();
    var appearance = r.u8();
    r.p += appearance;   // stage 2 parses this; the tile view has no use for it
    var list = [];
    for (var i = 0; i < frames; i++) { list.push(readFrame(r)); }
    return { name: nameFromLong(hi, lo), frames: list };
  }

  function decodeCam(bytes) {
    try {
      var r = new Reader(bytes);
      var cam = {
        id: r.u32(), epochSeconds: r.u32(), baseX: r.u16(), baseY: r.u16(),
        plane: r.u8(), wildernessLevel: r.u8(),
        killerCombat: r.u8(), victimCombat: r.u8()
      };
      cam.weapon = r.u16() - 1;
      cam.killingBlow = r.u8();
      cam.hitpointsLeft = r.u8();
      var frames = r.u8();
      cam.killer = readActor(r, frames);
      cam.victim = readActor(r, frames);
      cam.frames = frames;
      return cam;
    } catch (e) {
      // A cam that will not decode is a cam the site cannot show. The card
      // stays, the player says so — the same posture the game takes.
      return null;
    }
  }

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

  /* Where a fighter is at a fractional tick.
     Movement is interpolated because a cam samples once a tick and a fighter
     covers a whole tile in that tick: drawn discretely the fight teleports a
     tile at a time, which reads as lag rather than as movement. */
  Player.prototype.at = function (actor, t) {
    var i = Math.floor(t);
    var a = actor.frames[Math.min(i, actor.frames.length - 1)];
    var b = actor.frames[Math.min(i + 1, actor.frames.length - 1)];
    var k = t - i;
    return { x: a.dx + (b.dx - a.dx) * k, y: a.dy + (b.dy - a.dy) * k, frame: a };
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
    this.fighter(k, '#f5d97a', '#c98f14', toPx, cell, cam.killer.name, true);
    this.fighter(v, '#e8776f', '#8f1d17', toPx, cell, cam.victim.name, false);
    this.splats(k, toPx, cell);
    this.splats(v, toPx, cell);
  };

  Player.prototype.trail = function (actor, color, toPx, cell) {
    var ctx = this.ctx;
    var upto = Math.floor(this.t);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    for (var i = 0; i <= upto && i < actor.frames.length; i++) {
      var f = actor.frames[i];
      var x = toPx(f.dx), y = toPx(f.dy);
      if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
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
    if (!(f.faceDx === -1 && f.faceDy === -1) && (f.faceDx || f.faceDy)) {
      var a = Math.atan2(f.faceDy, f.faceDx);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.9);
      ctx.lineTo(x + Math.cos(a + 2.5) * r * 0.9, y + Math.sin(a + 2.5) * r * 0.9);
      ctx.lineTo(x + Math.cos(a - 2.5) * r * 0.9, y + Math.sin(a - 2.5) * r * 0.9);
      ctx.closePath();
      ctx.fill();
    }

    if (f.hp >= 0) {
      var bw = cell * 0.9, bh = Math.max(3, cell * 0.11);
      var bx = x - bw / 2, by = y - r - bh * 2.2;
      ctx.fillStyle = '#3a1512';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = f.hp > 50 ? '#8fd46a' : f.hp > 20 ? '#f5d97a' : '#e02a1e';
      ctx.fillRect(bx, by, bw * (f.hp / 100), bh);
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
    var size = Math.max(11, Math.round(cell * 0.46));
    ctx.font = '700 ' + size + 'px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    var text = f.damage === 0 ? 'block' : String(f.damage);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = f.damage === 0 ? '#7db2e0' : (HIT_COLORS[f.hitType] || '#e02a1e');
    ctx.fillText(text, x, y);
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
            hitType: 0,
            hp: p[2],
            faceDx: p[3], faceDy: p[4]
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

  function openViewer(id) {
    var card = state.cams.filter(function (c) { return c.id === id; })[0];
    if (!card) { return; }
    var modal = $('#kc-modal');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('#kc-modal-title').innerHTML = '<b>' + card.killer + '</b> vs ' + card.victim;
    $('#kc-modal-stats').innerHTML =
      '<span>' + card.weaponName + '</span><span>' + card.killingBlow + ' dmg killing blow</span>' +
      '<span>' + card.hitpointsLeft + '% hp left</span>' +
      '<span>Lvl ' + card.killerCombat + ' vs ' + card.victimCombat + '</span>' +
      '<span>Wilderness ' + card.wildernessLevel + '</span>';
    var vb = $('#kc-modal-vote');
    vb.setAttribute('data-vote', card.id);
    vb.classList.toggle('on', !!card.voted);
    vb.innerHTML = '<i class="bi bi-caret-up-fill"></i><b>' + card.votes + '</b>';

    if (!player) { player = new Player($('#kc-canvas')); }
    var scrub = $('#kc-scrub');
    player.onTick = function (t) { scrub.value = String(Math.round(t * 100)); };

    var show = function (cam) {
      if (!cam) {
        $('#kc-status').textContent = 'This replay could not be read.';
        return;
      }
      $('#kc-status').textContent = cam.frames + ' ticks · ' +
        (cam.frames * TICK_MS / 1000).toFixed(1) + 's';
      scrub.max = String((cam.frames - 1) * 100);
      scrub.value = '0';
      player.load(cam);
      player.play();
    };

    if (card.sample || !state.live) {
      show(sampleCam(card));
      return;
    }
    $('#kc-status').textContent = 'Loading replay…';
    window.rspklApi('/api/killcam/' + encodeURIComponent(card.id))
      .then(function (d) { show(decodeCam(bytesFromBase64(d.data))); })
      .catch(function () { $('#kc-status').textContent = 'That replay could not be loaded.'; });
  }

  function closeViewer() {
    if (player) { player.pause(); }
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
        if (!player || !player.cam) { return; }
        if (player.playing) { player.pause(); play.innerHTML = '<i class="bi bi-play-fill"></i>'; }
        else { player.play(); play.innerHTML = '<i class="bi bi-pause-fill"></i>'; }
      });
    }
    var scrub = $('#kc-scrub');
    if (scrub) {
      scrub.addEventListener('input', function () {
        if (player) { player.seek(Number(scrub.value) / 100); }
        if (play) { play.innerHTML = '<i class="bi bi-play-fill"></i>'; }
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
    });

    fetchBoard();
  });
})();
