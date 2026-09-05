/* The kill cam format, and the appearance block a cam carries.

   Two decoders live here and nowhere else on the site:

   KCP1 - what the world wrote. This mirrors KillcamCodec.java field for field;
   the pack form is only ever read by tests and tooling, since the API hands the
   page one cam at a time, but it is the same grammar and reading it here keeps
   there being one.

   The appearance block - the bytes PlayerUpdating#appearanceBlock wrote, which
   the game client reads with Player#updateAppearance. A cam stores it verbatim
   precisely so nothing has to describe a fighter's gear a second time, and this
   is the site's read of it: twelve slots, five colours, seven weapon
   animations, the name, the level, the skull.

   Nothing here draws. The tile board reads frames, the 3D player reads the
   appearance, and both read fields rather than bytes. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamCam = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* On the pack only, and it carries the version. V2 appends the ladder's four
     numbers to every cam, and four numbers at the end of a cam inside a pack of
     twenty are only unambiguous if every cam has them - so the magic says
     which, exactly as KillcamCodec does. A V1 pack still reads, with its cams
     carrying no rating. */
  var PACK_MAGIC_V1 = 0x4B435031; // 'KCP1'
  var PACK_MAGIC = 0x4B435032;    // 'KCP2'

  function Reader(bytes) { this.b = bytes; this.p = 0; }

  /* A typed array reads past its end as undefined rather than throwing, which
     would turn a truncated cam into a cam full of NaN and draw it. Every read
     goes through this so that a short buffer fails at the byte it runs out on. */
  Reader.prototype.need = function (n) {
    if (this.p + n > this.b.length) { throw new Error('killcam: buffer ended early'); }
  };
  Reader.prototype.u8 = function () { this.need(1); return this.b[this.p++]; };
  Reader.prototype.left = function () { return this.b.length - this.p; };
  Reader.prototype.s8 = function () { var v = this.u8(); return v > 127 ? v - 256 : v; };
  Reader.prototype.u16 = function () {
    this.need(2);
    var v = (this.b[this.p] << 8) | this.b[this.p + 1];
    this.p += 2;
    return v;
  };
  Reader.prototype.u32 = function () {
    this.need(4);
    var v = this.b[this.p] * 16777216 + (this.b[this.p + 1] << 16) + (this.b[this.p + 2] << 8) + this.b[this.p + 3];
    this.p += 4;
    return v;
  };

  var BASE37 = '_abcdefghijklmnopqrstuvwxyz0123456789';

  /* A username as the appearance block already carries it: base-37, most
     significant character first. Split across two 32-bit halves because a
     JavaScript number cannot hold a long. */
  function nameFromLong(hi, lo) {
    var out = '';
    var h = hi, l = lo;
    while (h > 0 || l > 0) {
      var rem = (h % 37) * 4294967296 + l;
      out = BASE37.charAt(rem % 37) + out;
      l = Math.floor(rem / 37);
      h = Math.floor(h / 37);
    }
    out = out.replace(/_/g, ' ').trim();
    return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
  }

  function readFrame(r) {
    var f = r.u8();
    // Absent fields read back as -1, which is what the Java decoder produces.
    // Facing is the exception: -1,-1 is a real tile once the window is rebased
    // - one step south west of the base - so whether a fighter was facing
    // anywhere is carried by the flag that wrote the field, not by its value.
    // Reading the pair as the sentinel turned a fighter standing there back to
    // whatever they last faced.
    var out = { dx: 0, dy: 0, anim: -1, attack: false, gfx: -1, gfxHeight: -1, damage: -1, hitType: -1, hp: -1, faceDx: -1, faceDy: -1, facing: false };
    if (f & 0x01) { out.dx = r.s8(); out.dy = r.s8(); }
    if (f & 0x02) {
      // 65535 is the game's "stop animating" id rather than an animation, the
      // same sentinel the appearance block uses. Read as absent here, so
      // nothing downstream goes looking for a sequence that cannot exist.
      var animation = r.u16();
      out.anim = animation === 65535 ? -1 : animation;
    }
    if (f & 0x04) { out.gfx = r.u16(); out.gfxHeight = r.u8(); }
    if (f & 0x08) { out.damage = r.u8(); out.hitType = r.u8(); }
    if (f & 0x10) { out.hp = r.u8(); }
    if (f & 0x20) { out.faceDx = r.s8(); out.faceDy = r.s8(); out.facing = true; }
	// 0x40 was added without changing the shape of the optional fields, so old
	// recordings decode as before and simply have no explicit attack marker.
	out.attack = (f & 0x40) !== 0;
    return out;
  }

  function readActor(r, frames) {
    var hi = r.u32(), lo = r.u32();
    var length = r.u8();
    r.need(length);
    var appearance = r.b.subarray(r.p, r.p + length);
    r.p += length;
    var list = [];
    for (var i = 0; i < frames; i++) { list.push(readFrame(r)); }
    return { name: nameFromLong(hi, lo), appearanceBytes: appearance, frames: list };
  }

  function readCam(r, rated) {
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
    cam.rating = rated ? readRating(r) : null;
    return cam;
  }

  /* What the ladder did about the kill: both ratings as they stood after it,
     and the signed move each rating made. Last in the cam, so a reader that
     does not want them simply stops - and a cam that ends before them was
     written by a server from before the ladder rode along, which reads as no
     rating rather than as a broken replay.

     `rated` is read off the moves and not the ratings: two rated players can
     hold any pair of ratings, but only an unrated kill moves neither of them.
     The ratings before the fight are the difference, which is why they are not
     on the wire. */
  function readRating(r) {
    // Exactly six, not at least six. A cam is followed by its rating and by
    // nothing else, so anything longer is not a cam with a rating on it - it
    // is a pack body, whose next cam's id would otherwise be read as a rating
    // and drawn as a tier nobody holds. A cam whose tail is missing was
    // written by a server from before the ladder rode along: the fight is
    // unharmed, there is simply no score.
    if (r.left() !== 6) { return null; }
    var killer = r.u16();
    var victim = r.u16();
    var killerMove = r.s8();
    var victimMove = r.s8();
    return {
      killerRating: killer, victimRating: victim,
      killerMove: killerMove, victimMove: victimMove,
      killerBefore: killer - killerMove, victimBefore: victim - victimMove,
      rated: killerMove !== 0 || victimMove !== 0
    };
  }

  /** One cam, as the API serves it. Null rather than a throw: a cam that will
      not decode costs a replay, and must not cost the page. */
  function decodeCam(bytes) {
    try {
      // The wire form has no magic and is always the current version: the
      // page is deployed against the server that writes it. A cam with no
      // tail still decodes, and reads as carrying no rating.
      return readCam(new Reader(bytes), true);
    } catch (e) {
      return null;
    }
  }

  /**
   * How many bytes the first cam in a buffer occupies, ignoring any rating.
   *
   * The decoder measuring itself. A cam's length is not a field - it is the sum
   * of a fixed header, two length-prefixed appearance blocks and however much
   * each frame's presence byte says is there - so anything that needs one cam's
   * bytes out of a pack has to walk the format, and a second walk written
   * beside this one would be a second decoder free to drift. Used by tests and
   * tooling; the page is handed one cam at a time.
   *
   * Returns 0 for a buffer that is not a cam.
   */
  function camLength(bytes) {
    try {
      var r = new Reader(bytes);
      readCam(r, false);
      return r.p;
    } catch (e) {
      return 0;
    }
  }

  /** A whole pack, already un-gzipped. Used by tests and tooling, not the page. */
  function decodePack(bytes) {
    var out = [];
    try {
      var r = new Reader(bytes);
      var magic = r.u32();
      if (magic !== PACK_MAGIC && magic !== PACK_MAGIC_V1) { return []; }
      var rated = magic === PACK_MAGIC;
      var count = r.u8();
      for (var i = 0; i < count; i++) {
        out.push(readCam(r, rated));
      }
    } catch (e) {
      // As in KillcamCodec: a pack that stops early yields the cams that were
      // whole, because a corrupt file must cost replays and not a session.
      return out;
    }
    return out;
  }

  // ---- the appearance block ----------------------------------------------

  /* The twelve slots, in the order the block writes them. Named because the
     renderer needs to know which one is the weapon (its animations drive the
     fight) and which is the shield (an animation can replace either). */
  var SLOTS = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'arms',
               'legs', 'hair', 'hands', 'feet', 'beard'];

  /* The five recolourable parts, in block order. */
  var COLOURS = ['hair', 'torso', 'legs', 'feet', 'skin'];

  /* The seven animations a figure carries: standing, turning on the spot,
     walking, and the four directional turns. Their ids are the weapon's, which
     is why a cam of someone holding a whip walks like a whip. */
  var ANIMS = ['stand', 'standTurn', 'walk', 'turn180', 'turn90cw', 'turn90ccw', 'run'];

  /* Both icons are written as a byte and mean -1 when nothing is set, which
     arrives as 255 rather than as a negative number. */
  function none(v) { return v === 255 ? -1 : v; }

  /**
   * Parse the block a cam stored, the way Player#updateAppearance reads it.
   *
   * Slot values: a single 0 byte is an empty slot, a short of 512 + n is item
   * n worn, and a short of 256 + n is identity kit n showing through. The
   * server suppresses the kit itself where gear hides it - arms under a
   * platebody, hair under a full helm - so a reader that honours those three
   * cases needs no rules of its own about what covers what.
   */
  function parseAppearance(bytes) {
    if (!bytes || bytes.length < 20) { return null; }
    var r = new Reader(bytes);
    var out = {
      gender: r.u8(), build: r.u8(), prayerIcon: none(r.u8()), skullIcon: none(r.u8()),
      headHint: r.u8(),
      slots: {}, items: {}, kits: {}, colours: {}, anims: {},
      npc: -1, name: '', combat: 0, rights: 0
    };
    var i;
    for (i = 0; i < SLOTS.length; i++) {
      var hi = r.u8();
      if (hi === 0) {
        out.slots[SLOTS[i]] = { kind: 'none', id: -1 };
        continue;
      }
      var value = (hi << 8) + r.u8();
      if (i === 0 && value === 65535) {
        // The whole figure is an npc; nothing after this describes a player.
        out.npc = r.u16();
        out.slots[SLOTS[i]] = { kind: 'npc', id: out.npc };
        return out;
      }
      if (value >= 512) {
        out.slots[SLOTS[i]] = { kind: 'item', id: value - 512 };
        out.items[SLOTS[i]] = value - 512;
      } else {
        out.slots[SLOTS[i]] = { kind: 'kit', id: value - 256 };
        out.kits[SLOTS[i]] = value - 256;
      }
    }
    for (i = 0; i < COLOURS.length; i++) { out.colours[COLOURS[i]] = r.u8(); }
    for (i = 0; i < ANIMS.length; i++) {
      var anim = r.u16();
      out.anims[ANIMS[i]] = anim === 65535 ? -1 : anim;
    }
    out.name = nameFromLong(r.u32(), r.u32());
    out.combat = r.u8();
    out.rights = r.u8();
    // A loyalty title follows, newline terminated. The game client stops
    // reading here and so does this: the title is on the card already, from
    // the API, and a block that ends early must not cost the gear above it.
    return out;
  }

  return {
    decodeCam: decodeCam,
    decodePack: decodePack,
    camLength: camLength,
    parseAppearance: parseAppearance,
    nameFromLong: nameFromLong,
    SLOTS: SLOTS,
    COLOURS: COLOURS,
    ANIMS: ANIMS
  };
}));
