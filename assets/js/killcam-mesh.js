/* Meshes, animation frames and the deform that plays one on the other.

   This is the client's model pipeline, in the part of it a replay needs: merge
   the pieces a fighter is wearing into one mesh, recolour it, group its
   vertices by label, and move those groups by a frame. It is a port of
   Model.java rather than an interpretation of it - the transform arithmetic is
   integer and fixed point here for the same reason it is there, because the
   frames on disk were authored against those exact roundings and a float
   version drifts a limb over nine ticks.

   Nothing here fetches, draws, or knows what a kill cam is. The renderer calls
   it; a test in node calls it too, and asserts the result against digests dumped
   by the Java client itself (`./gradlew -p client cacheDigest`). Two decoders of
   one format is how a format drifts; the digests are what stops it. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamMesh = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MESH_MAGIC = 0x4B434D31;  // 'KCM1'
  var FRAME_MAGIC = 0x4B434631; // 'KCF1'
  var NO_LABEL = 255;

  // ---- reading ------------------------------------------------------------

  function magic(view) {
    return (view.getUint8(0) << 24 | view.getUint8(1) << 16 |
            view.getUint8(2) << 8 | view.getUint8(3)) >>> 0;
  }

  /* One exported mesh. The layout is written by tools/cache/killcam_assets.py
     and is fixed-width throughout, so this reads runs rather than fields. */
  function decodeMesh(buffer) {
    var view = new DataView(buffer);
    if (magic(view) !== MESH_MAGIC) { throw new Error('not a KCM1 mesh'); }
    var nv = view.getUint16(4);
    var nf = view.getUint16(6);
    var p = 8;
    var m = {
      nv: nv, nf: nf,
      vx: new Int32Array(nv), vy: new Int32Array(nv), vz: new Int32Array(nv),
      fa: new Int32Array(nf), fb: new Int32Array(nf), fc: new Int32Array(nf),
      colour: new Int32Array(nf), alpha: new Int32Array(nf),
      priority: new Int32Array(nf), textured: new Uint8Array(nf),
      vlabel: new Int32Array(nv), flabel: new Int32Array(nf)
    };
    var i;
    for (i = 0; i < nv; i++) {
      m.vx[i] = view.getInt16(p); m.vy[i] = view.getInt16(p + 2); m.vz[i] = view.getInt16(p + 4);
      p += 6;
    }
    for (i = 0; i < nf; i++) {
      m.fa[i] = view.getUint16(p); m.fb[i] = view.getUint16(p + 2); m.fc[i] = view.getUint16(p + 4);
      p += 6;
    }
    for (i = 0; i < nf; i++) { m.colour[i] = view.getUint16(p); p += 2; }
    for (i = 0; i < nf; i++) { m.textured[i] = view.getUint8(p++); }
    for (i = 0; i < nf; i++) { m.alpha[i] = view.getUint8(p++); }
    for (i = 0; i < nf; i++) { m.priority[i] = view.getUint8(p++); }
    for (i = 0; i < nv; i++) { var vl = view.getUint8(p++); m.vlabel[i] = vl === NO_LABEL ? -1 : vl; }
    for (i = 0; i < nf; i++) { var fl = view.getUint8(p++); m.flabel[i] = fl === NO_LABEL ? -1 : fl; }
    return m;
  }

  /* One frame group: the framemap (which labels each transform moves, and how)
     and the frames that drive it, keyed by the id the game addresses them with. */
  function decodeFrames(buffer) {
    var view = new DataView(buffer);
    if (magic(view) !== FRAME_MAGIC) { throw new Error('not a KCF1 frame group'); }
    var count = view.getUint16(4);
    var p = 6;
    var types = new Int32Array(count);
    var i, j;
    for (i = 0; i < count; i++) { types[i] = view.getUint8(p++); }
    var labels = [];
    for (i = 0; i < count; i++) {
      var n = view.getUint8(p++);
      var list = new Int32Array(n);
      for (j = 0; j < n; j++) { list[j] = view.getUint8(p++); }
      labels.push(list);
    }
    var frameCount = view.getUint16(p); p += 2;
    var frames = {};
    for (i = 0; i < frameCount; i++) {
      var id = view.getUint16(p); p += 2;
      var ops = view.getUint16(p); p += 2;
      var f = { idx: new Int32Array(ops), x: new Int32Array(ops), y: new Int32Array(ops), z: new Int32Array(ops) };
      for (j = 0; j < ops; j++) {
        f.idx[j] = view.getUint8(p);
        f.x[j] = view.getInt16(p + 1);
        f.y[j] = view.getInt16(p + 3);
        f.z[j] = view.getInt16(p + 5);
        p += 7;
      }
      frames[id] = f;
    }
    return { types: types, labels: labels, frames: frames };
  }

  // ---- assembling ---------------------------------------------------------

  function empty(nv, nf) {
    return {
      nv: 0, nf: 0,
      vx: new Int32Array(nv), vy: new Int32Array(nv), vz: new Int32Array(nv),
      fa: new Int32Array(nf), fb: new Int32Array(nf), fc: new Int32Array(nf),
      colour: new Int32Array(nf), alpha: new Int32Array(nf),
      priority: new Int32Array(nf), textured: new Uint8Array(nf),
      vlabel: new Int32Array(nv), flabel: new Int32Array(nf)
    };
  }

  /* A working copy: the deform writes vertices in place, so a mesh that is
     played must never be the one the cache handed over. */
  function copy(m) {
    var out = empty(m.nv, m.nf);
    out.nv = m.nv; out.nf = m.nf;
    // A merged mesh's arrays are allocated for the worst case and then only
    // partly filled, so every copy is taken over the used length rather than
    // the array length.
    out.vx.set(m.vx.subarray(0, m.nv));
    out.vy.set(m.vy.subarray(0, m.nv));
    out.vz.set(m.vz.subarray(0, m.nv));
    out.vlabel.set(m.vlabel.subarray(0, m.nv));
    out.fa.set(m.fa.subarray(0, m.nf));
    out.fb.set(m.fb.subarray(0, m.nf));
    out.fc.set(m.fc.subarray(0, m.nf));
    out.colour.set(m.colour.subarray(0, m.nf));
    out.alpha.set(m.alpha.subarray(0, m.nf));
    out.priority.set(m.priority.subarray(0, m.nf));
    out.textured.set(m.textured.subarray(0, m.nf));
    out.flabel.set(m.flabel.subarray(0, m.nf));
    return out;
  }

  /* Merge the pieces of an outfit into one mesh.

     Vertices are matched by coordinate rather than concatenated, exactly as
     Model's merging constructor does: a helm and a body that share the seam at
     the neck must share those vertices, or the two halves move apart the first
     time the neck rotates. */
  function merge(parts) {
    var nv = 0, nf = 0, i, j;
    for (i = 0; i < parts.length; i++) {
      if (!parts[i]) { continue; }
      nv += parts[i].nv;
      nf += parts[i].nf;
    }
    var out = empty(nv, nf);
    for (i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) { continue; }
      for (j = 0; j < part.nf; j++) {
        out.colour[out.nf] = part.colour[j];
        out.alpha[out.nf] = part.alpha[j];
        out.priority[out.nf] = part.priority[j];
        out.textured[out.nf] = part.textured[j];
        out.flabel[out.nf] = part.flabel[j];
        out.fa[out.nf] = vertexOf(out, part, part.fa[j]);
        out.fb[out.nf] = vertexOf(out, part, part.fb[j]);
        out.fc[out.nf] = vertexOf(out, part, part.fc[j]);
        out.nf++;
      }
    }
    return out;
  }

  function vertexOf(out, part, index) {
    var x = part.vx[index], y = part.vy[index], z = part.vz[index];
    for (var i = 0; i < out.nv; i++) {
      if (out.vx[i] === x && out.vy[i] === y && out.vz[i] === z) { return i; }
    }
    out.vx[out.nv] = x; out.vy[out.nv] = y; out.vz[out.nv] = z;
    out.vlabel[out.nv] = part.vlabel[index];
    return out.nv++;
  }

  /** Swap one 16-bit HSL colour for another, over every face that carries it. */
  function recolour(m, from, to) {
    for (var i = 0; i < m.nf; i++) {
      if (m.colour[i] === (from & 0xFFFF)) { m.colour[i] = to & 0xFFFF; }
    }
  }

  /* Invert the per-vertex and per-face labels into lists per label. A frame
     names labels, not vertices, so this is what makes a frame applicable. */
  function skin(m) {
    m.vertexGroups = group(m.vlabel, m.nv);
    m.faceGroups = group(m.flabel, m.nf);
    return m;
  }

  function group(labels, count) {
    var max = -1, i;
    for (i = 0; i < count; i++) { if (labels[i] > max) { max = labels[i]; } }
    if (max < 0) { return null; }
    var sizes = new Int32Array(max + 1);
    for (i = 0; i < count; i++) { if (labels[i] >= 0) { sizes[labels[i]]++; } }
    var groups = [];
    for (i = 0; i <= max; i++) { groups.push(new Int32Array(sizes[i])); sizes[i] = 0; }
    for (i = 0; i < count; i++) {
      var label = labels[i];
      if (label >= 0) { groups[label][sizes[label]++] = i; }
    }
    return groups;
  }

  // ---- the deform ---------------------------------------------------------

  var SINE = new Int32Array(2048);
  var COSINE = new Int32Array(2048);
  (function () {
    for (var i = 0; i < 2048; i++) {
      SINE[i] = Math.round(65536 * Math.sin(i * 0.0030679615));
      COSINE[i] = Math.round(65536 * Math.cos(i * 0.0030679615));
    }
  }());

  /* Model#transformSkin. The pivot is state that carries between calls inside
     one frame: a rotate or a scale turns about the origin the type-0 op before
     it established, which is why applyFrame resets it once and not per op. */
  function transform(m, state, type, labels, x, y, z) {
    var groups = m.vertexGroups;
    var i, j, list, v;
    if (type === 0) {
      var count = 0;
      state.x = 0; state.y = 0; state.z = 0;
      for (i = 0; i < labels.length; i++) {
        if (!groups || labels[i] >= groups.length) { continue; }
        list = groups[labels[i]];
        for (j = 0; j < list.length; j++) {
          v = list[j];
          state.x += m.vx[v]; state.y += m.vy[v]; state.z += m.vz[v];
          count++;
        }
      }
      if (count > 0) {
        state.x = (state.x / count | 0) + x;
        state.y = (state.y / count | 0) + y;
        state.z = (state.z / count | 0) + z;
      } else {
        state.x = x; state.y = y; state.z = z;
      }
      return;
    }
    if (type === 1) {
      for (i = 0; i < labels.length; i++) {
        if (!groups || labels[i] >= groups.length) { continue; }
        list = groups[labels[i]];
        for (j = 0; j < list.length; j++) {
          v = list[j];
          m.vx[v] += x; m.vy[v] += y; m.vz[v] += z;
        }
      }
      return;
    }
    if (type === 2) {
      for (i = 0; i < labels.length; i++) {
        if (!groups || labels[i] >= groups.length) { continue; }
        list = groups[labels[i]];
        for (j = 0; j < list.length; j++) {
          v = list[j];
          m.vx[v] -= state.x; m.vy[v] -= state.y; m.vz[v] -= state.z;
          var rx = (x & 0xFF) * 8, ry = (y & 0xFF) * 8, rz = (z & 0xFF) * 8;
          var s, c, t;
          if (rz !== 0) {
            s = SINE[rz]; c = COSINE[rz];
            t = shift16(m.vy[v] * s + m.vx[v] * c);
            m.vy[v] = shift16(m.vy[v] * c - m.vx[v] * s);
            m.vx[v] = t;
          }
          if (rx !== 0) {
            s = SINE[rx]; c = COSINE[rx];
            t = shift16(m.vy[v] * c - m.vz[v] * s);
            m.vz[v] = shift16(m.vy[v] * s + m.vz[v] * c);
            m.vy[v] = t;
          }
          if (ry !== 0) {
            s = SINE[ry]; c = COSINE[ry];
            t = shift16(m.vz[v] * s + m.vx[v] * c);
            m.vz[v] = shift16(m.vz[v] * c - m.vx[v] * s);
            m.vx[v] = t;
          }
          m.vx[v] += state.x; m.vy[v] += state.y; m.vz[v] += state.z;
        }
      }
      return;
    }
    if (type === 3) {
      for (i = 0; i < labels.length; i++) {
        if (!groups || labels[i] >= groups.length) { continue; }
        list = groups[labels[i]];
        for (j = 0; j < list.length; j++) {
          v = list[j];
          m.vx[v] = (((m.vx[v] - state.x) * x) / 128 | 0) + state.x;
          m.vy[v] = (((m.vy[v] - state.y) * y) / 128 | 0) + state.y;
          m.vz[v] = (((m.vz[v] - state.z) * z) / 128 | 0) + state.z;
        }
      }
      return;
    }
    if (type === 5 && m.faceGroups) {
      for (i = 0; i < labels.length; i++) {
        if (labels[i] >= m.faceGroups.length) { continue; }
        list = m.faceGroups[labels[i]];
        for (j = 0; j < list.length; j++) {
          var f = list[j];
          var a = m.alpha[f] + x * 8;
          m.alpha[f] = a < 0 ? 0 : (a > 255 ? 255 : a);
        }
      }
    }
  }

  /* Java's `>> 16` on a value that can exceed 32 bits. JavaScript's own `>>`
     truncates to 32 bits first, which turns a large product into a wrong
     coordinate rather than a rounded one. */
  function shift16(v) {
    return Math.floor(v / 65536);
  }

  /** Model#applyTransform: pose a skinned mesh on one frame of a group. */
  function applyFrame(m, group, frameId) {
    if (!m.vertexGroups) { return m; }
    var frame = group && group.frames[frameId];
    if (!frame) { return m; }
    var state = { x: 0, y: 0, z: 0 };
    for (var i = 0; i < frame.idx.length; i++) {
      var index = frame.idx[i];
      transform(m, state, group.types[index], group.labels[index],
                frame.x[i], frame.y[i], frame.z[i]);
    }
    return m;
  }

  // ---- colour -------------------------------------------------------------

  /* The client's HSL table: 512 hue/saturation pairs by 128 lightnesses, which
     is exactly the 16-bit colour a face carries. Built here rather than shipped
     because it is 64k entries of arithmetic and about a millisecond. */
  var palette = null;

  function paletteRgb(brightness) {
    if (palette) { return palette; }
    palette = new Int32Array(65536);
    var index = 0;
    for (var hs = 0; hs < 512; hs++) {
      var hue = ((hs / 8 | 0) / 64) + 0.0078125;
      var sat = ((hs & 7) / 8) + 0.0625;
      for (var l = 0; l < 128; l++) {
        var light = l / 128;
        var r = light, g = light, b = light;
        if (sat !== 0) {
          var q = light < 0.5 ? light * (1 + sat) : (light + sat) - light * sat;
          var p = 2 * light - q;
          var tr = hue + 1 / 3; if (tr > 1) { tr--; }
          var tg = hue;
          var tb = hue - 1 / 3; if (tb < 0) { tb++; }
          r = channel(p, q, tr);
          g = channel(p, q, tg);
          b = channel(p, q, tb);
        }
        var rgb = (Math.pow(r, brightness) * 256 | 0) << 16 |
                  (Math.pow(g, brightness) * 256 | 0) << 8 |
                  (Math.pow(b, brightness) * 256 | 0);
        palette[index++] = rgb === 0 ? 1 : rgb;
      }
    }
    return palette;
  }

  function channel(p, q, t) {
    if (6 * t < 1) { return p + (q - p) * 6 * t; }
    if (2 * t < 1) { return q; }
    if (3 * t < 2) { return p + (q - p) * (2 / 3 - t) * 6; }
    return p;
  }

  // ---- digest -------------------------------------------------------------

  /* The same rolling hash CacheDigest.java prints, so a mesh decoded here can
     be compared with the one the game decodes without shipping either.
     BigInt because the multiply overflows a double long before 2^63. */
  function digest(m) {
    var vertices = BigInt(1), faces = BigInt(1), colours = BigInt(1), i;
    for (i = 0; i < m.nv; i++) {
      vertices = mix(vertices, m.vx[i]);
      vertices = mix(vertices, m.vy[i]);
      vertices = mix(vertices, m.vz[i]);
    }
    for (i = 0; i < m.nf; i++) {
      faces = mix(faces, m.fa[i]);
      faces = mix(faces, m.fb[i]);
      faces = mix(faces, m.fc[i]);
      colours = mix(colours, m.colour[i] & 0xFFFF);
    }
    return {
      vertices: m.nv, faces: m.nf,
      vertexSum: vertices.toString(),
      faceSum: faces.toString(),
      colourSum: colours.toString()
    };
  }

  var MASK = (BigInt(1) << BigInt(63)) - BigInt(1);

  function mix(hash, value) {
    return (hash * BigInt(1000003) + BigInt(value)) & MASK;
  }

  return {
    decodeMesh: decodeMesh,
    decodeFrames: decodeFrames,
    merge: merge,
    copy: copy,
    recolour: recolour,
    skin: skin,
    applyFrame: applyFrame,
    palette: paletteRgb,
    digest: digest
  };
}));
