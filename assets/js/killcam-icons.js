/* Item inventory icons, out of the sprite sheets the client exported.

   An inventory icon is not a picture in the cache - it is the item's own model,
   lit, rotated and zoomed by its own placement fields, rasterised to 32x32 and
   outlined. `./gradlew -p client dumpItemIcons` renders all thirty thousand of
   them with the client's own ItemDefinition#getSprite and writes them 512 to a
   sheet, sharded on `id >> 9` - the same shard the kill cam's item definitions
   already use, so a replay naming eight items reads the same one or two shards
   for its icons as for its names.

   Nothing here fetches: a sheet is a background image, so the browser loads it
   once, caches it, and every icon out of it is a background-position. That is
   also why an icon is a span and not an <img>: thirty icons on a scoreboard are
   thirty offsets into one decoded bitmap rather than thirty requests.

   The one thing this module needs from the page is the export's version, which
   names the URL so a re-export is a different URL and the same export is the
   same one. It is read off the viewer's own data-items attribute. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamIcons = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Mirrors website/assets/items/manifest.json, which the exporter writes.
  var CELL = 32;
  var COLS = 16;
  var ROWS = 32;
  var SHARD_BITS = 9;
  var PER_SHEET = 1 << SHARD_BITS;
  var BASE = '/assets/items/';

  var version = '';

  /** The version the page carries, so a sheet URL is per-export. */
  function setVersion(v) { version = v || ''; }

  function sheetUrl(id) {
    var shard = id >> SHARD_BITS;
    return BASE + shard + '.png' + (version ? '?v=' + version : '');
  }

  /**
   * The CSS an element needs to show item `id` and nothing else.
   *
   * Returned as a string rather than applied, because every caller here builds
   * its markup as a string - one innerHTML assignment per panel rather than a
   * node per icon.
   */
  function style(id) {
    if (!(id >= 0)) { return ''; }
    var slot = id % PER_SHEET;
    var x = (slot % COLS) * CELL;
    var y = Math.floor(slot / COLS) * CELL;
    return 'background-image:url(' + sheetUrl(id) + ');' +
           'background-position:-' + x + 'px -' + y + 'px;' +
           'background-size:' + (COLS * CELL) + 'px ' + (ROWS * CELL) + 'px';
  }

  /**
   * One icon, as markup. `cls` is appended to the icon class so a caller can
   * size or frame it; `title` is the tooltip, which is the item's real name.
   */
  function icon(id, cls, title) {
    if (!(id >= 0)) { return ''; }
    return '<i class="kc-icon' + (cls ? ' ' + cls : '') + '" style="' + style(id) + '"' +
           (title ? ' title="' + escapeAttr(title) + '"' : '') +
           ' role="img" aria-label="' + escapeAttr(title || ('Item ' + id)) + '"></i>';
  }

  function escapeAttr(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch];
    });
  }

  /* Warm the sheets a scoreboard is about to draw from. Without this the first
     paint of a viewer shows empty squares that fill in one sheet at a time; the
     sheets are a hundred kilobytes each and there are never more than three. */
  var warmed = {};
  function warm(ids) {
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!(id >= 0)) { continue; }
      var url = sheetUrl(id);
      if (warmed[url]) { continue; }
      warmed[url] = new Image();
      warmed[url].src = url;
    }
  }

  return {
    setVersion: setVersion,
    style: style,
    icon: icon,
    warm: warm,
    sheetUrl: sheetUrl,
    CELL: CELL
  };
}));
