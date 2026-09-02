/* Fetching the slice of the cache a cam needs, and only that slice.

   Everything under /assets/killcam is written by tools/cache/killcam_assets.py:
   definitions in shards of 512 ids, one file per mesh, one file per frame group,
   all gzipped. A cam names its own dependencies - the gear in two appearance
   blocks and the animations its frames carry - so a replay is a handful of
   small fetches rather than a cache download, and the second viewer of a
   popular cam is served from the edge.

   Everything is memoised, including requests in flight: two fighters in the
   same set fetch that set once, and the page never holds two copies of a mesh.
   Nothing here decides what to draw. */
(function (root, factory) {
  var api = factory(root.KillcamMesh, root.KillcamFigure);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamAssets = api;
}(typeof self !== 'undefined' ? self : this, function (mesh, figure) {
  'use strict';

  var BASE = '/assets/killcam';
  var SHARD_BITS = 9;

  /* The export's version, written into the page by the generator. Assets are
     named by id and served with a year-long immutable cache, so this is what
     makes a re-export a new URL rather than a stale file in someone's browser.
     Absent - a page built before an export existed - is simply no query. */
  function version() {
    var modal = typeof document !== 'undefined' && document.getElementById('kc-modal');
    var value = modal && modal.getAttribute('data-assets');
    return value ? '?v=' + encodeURIComponent(value) : '';
  }

  var meshes = {};       // model id -> decoded mesh
  var groups = {};       // frame group id -> decoded framemap and frames
  var shards = {};       // 'items:3' -> definitions in that shard
  var pending = {};      // path -> promise, so one file is fetched once
  var kits = null;
  var index = null;      // which shards the export actually wrote

  /* Gzip is undone here rather than by the host, because a static host will
     not set Content-Encoding for a file it did not compress and these are
     served byte for byte as they were written. */
  function fetchBytes(path) {
    if (pending[path]) { return pending[path]; }
    var promise = fetch(BASE + path + version()).then(function (res) {
      if (!res.ok) { throw new Error('killcam asset ' + path + ': ' + res.status); }
      if (typeof DecompressionStream === 'function') {
        return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      throw new Error('this browser cannot ungzip a stream');
    });
    pending[path] = promise;
    return promise;
  }

  function fetchJson(path) {
    return fetchBytes(path).then(function (buffer) {
      return JSON.parse(new TextDecoder().decode(buffer));
    });
  }

  function loadKits() {
    if (kits) { return Promise.resolve(kits); }
    return fetchJson('/defs/kits.json.gz').then(function (body) {
      kits = body;
      return kits;
    });
  }

  /* The shard index. A shard with nothing in it is never written, so this is
     what keeps an id nothing claims - 65535 among them - from being a request
     for a file that does not exist. */
  function loadIndex() {
    if (index) { return Promise.resolve(index); }
    return fetchJson('/defs/index.json.gz').then(function (body) {
      index = body;
      return index;
    }).catch(function () {
      // An export that predates the index: ask for shards and let a miss be a
      // miss, which is how this worked before the index existed.
      index = { items: null, seqs: null };
      return index;
    });
  }

  function exists(kind, shard) {
    return !index || !index[kind] || index[kind].indexOf(shard) >= 0;
  }

  /** Definitions for a set of ids, fetched a shard at a time. */
  function defs(kind, ids) {
    return loadIndex().then(function () { return fetchDefs(kind, ids); });
  }

  function fetchDefs(kind, ids) {
    var wanted = {};
    var paths = [];
    ids.forEach(function (id) {
      var shard = id >> SHARD_BITS;
      var key = kind + ':' + shard;
      if (!shards[key] && paths.indexOf(shard) < 0 && exists(kind, shard)) { paths.push(shard); }
    });
    return Promise.all(paths.map(function (shard) {
      return fetchJson('/defs/' + kind + '/' + shard + '.json.gz')
        .then(function (body) { shards[kind + ':' + shard] = body; })
        // A shard with nothing in it is not written at all, so a miss here is
        // an id nothing wears rather than a broken deploy.
        .catch(function () { shards[kind + ':' + shard] = {}; });
    })).then(function () {
      ids.forEach(function (id) {
        var body = shards[kind + ':' + (id >> SHARD_BITS)];
        if (body && body[id]) { wanted[id] = body[id]; }
      });
      return wanted;
    });
  }

  function loadMeshes(ids) {
    return Promise.all(ids.map(function (id) {
      if (meshes[id]) { return null; }
      return fetchBytes('/models/' + id + '.kcm.gz')
        .then(function (buffer) { meshes[id] = mesh.decodeMesh(buffer); })
        // A missing mesh costs a piece of gear, not a replay: the figure is
        // assembled from whatever did arrive.
        .catch(function () { meshes[id] = null; });
    })).then(function () {
      var out = {};
      ids.forEach(function (id) { if (meshes[id]) { out[id] = meshes[id]; } });
      return out;
    });
  }

  function loadFrameGroups(ids) {
    return Promise.all(ids.map(function (id) {
      if (groups[id] !== undefined) { return null; }
      return fetchBytes('/frames/' + id + '.kcf.gz')
        .then(function (buffer) { groups[id] = mesh.decodeFrames(buffer); })
        .catch(function () { groups[id] = null; });
    })).then(function () {
      var out = {};
      ids.forEach(function (id) { if (groups[id]) { out[id] = groups[id]; } });
      return out;
    });
  }

  /**
   * Everything one fighter needs: the assembled figure and the animations the
   * cam will ask it to play.
   *
   * @param look     a parsed appearance block
   * @param animIds  the animation ids this fighter's frames carry
   */
  function loadFighter(look, animIds) {
    if (!look) { return Promise.resolve(null); }
    var itemIds = [];
    figure.SLOT_ORDER.forEach(function (slot) {
      var entry = look.slots[slot];
      if (entry && entry.kind === 'item') { itemIds.push(entry.id); }
    });

    // The seven animations the block carries are as much a part of a fighter
    // as their gear: standing and walking are what a cam does not record.
    var wanted = animIds.slice();
    Object.keys(look.anims).forEach(function (name) {
      if (look.anims[name] >= 0) { wanted.push(look.anims[name]); }
    });

    return Promise.all([loadKits(), defs('items', itemIds), defs('seqs', unique(wanted))])
      .then(function (loaded) {
        var kitDefs = loaded[0], itemDefs = loaded[1], seqDefs = loaded[2];
        var modelIds = unique(figure.modelIds(look, itemDefs, kitDefs));
        var groupIds = unique(framesOf(seqDefs));
        return Promise.all([loadMeshes(modelIds), loadFrameGroups(groupIds)])
          .then(function (fetched) {
            return {
              look: look,
              figure: figure.build(look, itemDefs, kitDefs, fetched[0]),
              items: itemDefs,
              seqs: seqDefs,
              groups: fetched[1]
            };
          });
      });
  }

  /** Which frame groups a set of sequences reaches into. */
  function framesOf(seqDefs) {
    var out = [];
    Object.keys(seqDefs).forEach(function (id) {
      seqDefs[id][0].forEach(function (frame) {
        if (frame >= 0) { out.push(frame >>> 16); }
      });
    });
    return out;
  }

  function unique(list) {
    var seen = {};
    var out = [];
    list.forEach(function (v) {
      if (v >= 0 && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  return {
    base: BASE,
    loadKits: loadKits,
    defs: defs,
    loadMeshes: loadMeshes,
    loadFrameGroups: loadFrameGroups,
    loadFighter: loadFighter
  };
}));
