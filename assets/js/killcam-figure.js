/* A fighter, assembled the way the game assembles one.

   Given a parsed appearance block and something that can fetch meshes and
   definitions, this produces the single skinned mesh a replay animates: the
   worn item models and the identity kits showing through, merged, translated,
   recoloured item by item, then recoloured again by the five player colours,
   reshaped for the figure's build, and finally grouped by label so a frame can
   move it.

   The order is the client's, and it matters at every step. Recolouring after
   the merge would repaint a colour two pieces happen to share. Reshaping after
   the labels are grouped would move vertices out from under their groups. And
   the build deform has to run on the merged figure or a seam opens at the neck.

   No fetching lives here - the caller passes a loader - so the whole assembly
   runs in a test with files off disk. */
(function (root, factory) {
  var api = factory(root.KillcamMesh || (typeof require === 'function' ? require('./killcam-mesh.js') : null));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamFigure = api;
}(typeof self !== 'undefined' ? self : this, function (mesh) {
  'use strict';

  /* Client.PLAYER_BODY_RECOLOURS: hair, torso, legs, feet, skin. Index 0 of
     each row is the colour the meshes are authored in, so a choice of n means
     "replace row[0] with row[n]". */
  var BODY_RECOLOURS = [
    [6798, 107, 10283, 16, 4797, 7744, 5799, 4634, 33697, 22433, 2983, 54193],
    [8741, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621, 4783, 1341,
     16578, 35003, 25239],
    [25238, 8742, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621,
     4783, 1341, 16578, 35003],
    [4626, 11146, 6439, 12, 4758, 10270],
    [4550, 4537, 5681, 5673, 5790, 6806, 8076, 4574,
     6076, 49084, 20407, 11206, 60245]
  ];

  /* The torso carries a second palette: Client.anIntArray1204, applied on the
     same choice as the torso colour. Without it a dyed top keeps half its
     original colour on the trim. */
  var TORSO_TRIM = [9104, 10275, 7595, 3610, 7975, 8526, 918, 38802,
                    24466, 10145, 58654, 5027, 1457, 16565, 34991, 25486];

  var COLOUR_ORDER = ['hair', 'torso', 'legs', 'feet', 'skin'];

  // ---- build --------------------------------------------------------------

  /* BodyBuild.java, vertex for vertex: the profiles are keyframes of a gain
     applied to width and depth at each height up the figure, smoothstepped
     between. The crown is the most negative Y, since a model grows upward into
     negative Y, so the height of a vertex is its Y over the crown's. */
  var BUILD_T = [0.00, 0.12, 0.30, 0.47, 0.58, 0.72, 0.80, 0.88, 1.00];
  var MALE_X = [0.00, 0.10, 0.18, 0.14, 0.08, 0.30, 0.42, 0.10, 0.00];
  var MALE_Z = [0.00, 0.08, 0.14, 0.12, 0.08, 0.26, 0.30, 0.08, 0.00];
  var FEMALE_X = [0.00, 0.10, 0.32, 0.52, -0.06, 0.26, 0.10, 0.02, 0.00];
  var FEMALE_Z = [0.00, 0.08, 0.26, 0.50, -0.04, 0.70, 0.16, 0.02, 0.00];

  function gain(profile, t) {
    if (t <= BUILD_T[0]) { return profile[0]; }
    var last = BUILD_T.length - 1;
    if (t >= BUILD_T[last]) { return profile[last]; }
    var i = 0;
    while (t > BUILD_T[i + 1]) { i++; }
    var span = BUILD_T[i + 1] - BUILD_T[i];
    var f = span <= 0 ? 0 : (t - BUILD_T[i]) / span;
    f = f * f * (3 - 2 * f);
    return profile[i] + (profile[i + 1] - profile[i]) * f;
  }

  function applyBuild(m, male, build) {
    build = build < 0 ? 0 : (build > 2 ? 2 : build);
    if (build === 0 || m.nv <= 0) { return m; }
    var amount = build * 0.5;
    var crown = 0, i;
    for (i = 0; i < m.nv; i++) { if (m.vy[i] < crown) { crown = m.vy[i]; } }
    if (crown === 0) { return m; }
    var gx = male ? MALE_X : FEMALE_X;
    var gz = male ? MALE_Z : FEMALE_Z;
    for (i = 0; i < m.nv; i++) {
      var t = m.vy[i] / crown;
      m.vx[i] = Math.round(m.vx[i] * (1 + amount * gain(gx, t)));
      m.vz[i] = Math.round(m.vz[i] * (1 + amount * gain(gz, t)));
    }
    return m;
  }

  function translateY(m, dy) {
    if (!dy) { return m; }
    for (var i = 0; i < m.nv; i++) { m.vy[i] += dy; }
    return m;
  }

  // ---- pieces -------------------------------------------------------------

  /* One worn item: up to three meshes merged, shifted by the item's own Y
     offset, then recoloured. The recolour is applied in the direction the
     client applies it - the second colour of each pair replaced by the first -
     which is the reverse of what the field names suggest and is why a rune
     item comes out blue rather than untouched if it is taken the other way. */
  function itemModel(def, gender, meshes) {
    var ids = gender === 1 ? [def[4], def[5], def[6]] : [def[1], def[2], def[3]];
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] >= 0 && meshes[ids[i]]) { parts.push(meshes[ids[i]]); }
    }
    if (!parts.length) { return null; }
    var model = parts.length === 1 ? mesh.copy(parts[0]) : mesh.merge(parts);
    translateY(model, gender === 1 ? def[8] : def[7]);
    var oc = def[9], nc = def[10];
    for (i = 0; i < oc.length; i++) { mesh.recolour(model, nc[i], oc[i]); }
    return model;
  }

  /** One identity kit: its meshes merged and recoloured by its own pairs. */
  function kitModel(def, meshes) {
    var parts = [];
    for (var i = 0; i < def[0].length; i++) {
      if (meshes[def[0][i]]) { parts.push(meshes[def[0][i]]); }
    }
    if (!parts.length) { return null; }
    var model = parts.length === 1 ? mesh.copy(parts[0]) : mesh.merge(parts);
    var oc = def[1], nc = def[2];
    for (i = 0; i < oc.length; i++) {
      if (!oc[i]) { break; }
      mesh.recolour(model, oc[i], nc[i]);
    }
    return model;
  }

  /**
   * Which model ids a fighter needs, before any of them are fetched.
   *
   * The page asks this first and fetches the answer: it is the per-cam
   * manifest, derived from the cam itself rather than published alongside it.
   */
  function modelIds(look, items, kits) {
    var ids = [];
    var slot, def, i;
    for (var s = 0; s < SLOT_ORDER.length; s++) {
      slot = look.slots[SLOT_ORDER[s]];
      if (!slot) { continue; }
      if (slot.kind === 'item') {
        def = items[slot.id];
        if (!def) { continue; }
        var wear = look.gender === 1 ? [def[4], def[5], def[6]] : [def[1], def[2], def[3]];
        for (i = 0; i < wear.length; i++) { if (wear[i] >= 0) { ids.push(wear[i]); } }
      } else if (slot.kind === 'kit') {
        def = kits[slot.id];
        if (!def) { continue; }
        for (i = 0; i < def[0].length; i++) { ids.push(def[0][i]); }
      }
    }
    return ids;
  }

  var SLOT_ORDER = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'arms',
                    'legs', 'hair', 'hands', 'feet', 'beard'];

  /**
   * The whole figure: one skinned mesh, ready to be posed.
   *
   * @param look    a parsed appearance block
   * @param items   item definitions by id, as the export writes them
   * @param kits    identity kit definitions by id
   * @param meshes  decoded meshes by model id
   */
  function build(look, items, kits, meshes) {
    var parts = [];
    for (var s = 0; s < SLOT_ORDER.length; s++) {
      var slot = look.slots[SLOT_ORDER[s]];
      if (!slot) { continue; }
      var piece = null;
      if (slot.kind === 'item' && items[slot.id]) {
        piece = itemModel(items[slot.id], look.gender, meshes);
      } else if (slot.kind === 'kit' && kits[slot.id]) {
        piece = kitModel(kits[slot.id], meshes);
      }
      if (piece) { parts.push(piece); }
    }
    if (!parts.length) { return null; }

    var figure = mesh.merge(parts);
    for (var c = 0; c < COLOUR_ORDER.length; c++) {
      var choice = look.colours[COLOUR_ORDER[c]] || 0;
      if (!choice) { continue; }
      var row = BODY_RECOLOURS[c];
      if (choice < row.length) { mesh.recolour(figure, row[0], row[choice]); }
      if (c === 1 && choice < TORSO_TRIM.length) {
        mesh.recolour(figure, TORSO_TRIM[0], TORSO_TRIM[choice]);
      }
    }

    applyBuild(figure, look.gender === 0, look.build);
    return mesh.skin(figure);
  }

  return {
    build: build,
    modelIds: modelIds,
    applyBuild: applyBuild,
    SLOT_ORDER: SLOT_ORDER,
    BODY_RECOLOURS: BODY_RECOLOURS
  };
}));
