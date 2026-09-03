/* The web client frame: two real fighters, in their real gear, on a black plane.

   A cam records tiles, animations, graphics, hits and hitpoints - and nothing
   about the place it happened. So this draws exactly that and no more: a floor
   that is a grid rather than a scene, two figures assembled from the appearance
   blocks the cam carries, and the animations the fight actually played. The
   camera is the viewer's; the fight is the world's.

   How a tick becomes a pose
   -------------------------
   A cam samples once every 600ms. An animation runs at the client's own 20ms
   cycle, so a tick is thirty cycles, and the frame a figure is on at any moment
   inside a tick is found by walking that animation's own frame durations. That
   is why a replay looks like the game rather than like a slideshow of nine
   poses: the tick is the sampling rate of the recording, not of the animation.

   Which animation is chosen is the cam's own answer where it has one - a frame
   that carries an animation id is a swing, a block, a special - and the
   fighter's own standing and walking animations where it does not. Those come
   out of the appearance block, which is why a cam of someone holding a whip
   walks like someone holding a whip without the cam recording a thing about it.

   Which animation a tick means is decided in killcam-anim.js, which is a plain
   script and has tests; this module is the part that needs a canvas. The
   decoders both stand on are plain scripts too, shared with the tile board. */
import * as THREE from '/assets/vendor/three.module.min.js';

var mesh = self.KillcamMesh;
var assets = self.KillcamAssets;
var camApi = self.KillcamCam;
var anim = self.KillcamAnim;

var TILE = 128;            // a game tile, in model units
var TICK_MS = 600;
var GRID = 17;             // MAX_RADIUS 8 either side of the base tile
var BRIGHTNESS = 0.8;      // Rasterizer3D.setBrightness, as the client boots it

/* Faces at or above this are the ones the client would draw as fully
   transparent; drawing them puts a black card through a figure. */
var CLEAR_ALPHA = 250;

// ---- geometry -------------------------------------------------------------

/* One mesh becomes one non-indexed geometry: a 317 model colours faces, not
   vertices, so two faces meeting at a vertex disagree about its colour and
   sharing it would blend them. */
function geometryOf(m, palette) {
  var drawn = [];
  var i;
  for (i = 0; i < m.nf; i++) {
    if (m.alpha[i] < CLEAR_ALPHA) { drawn.push(i); }
  }
  var positions = new Float32Array(drawn.length * 9);
  var colours = new Float32Array(drawn.length * 9);
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.userData.faces = drawn;
  paintColours(geometry, m, palette);
  writePositions(geometry, m);
  return geometry;
}

function paintColours(geometry, m, palette) {
  var faces = geometry.userData.faces;
  var colours = geometry.getAttribute('color').array;
  for (var i = 0; i < faces.length; i++) {
    var rgb = palette[m.colour[faces[i]] & 0xFFFF] || 0;
    var r = ((rgb >> 16) & 0xFF) / 255, g = ((rgb >> 8) & 0xFF) / 255, b = (rgb & 0xFF) / 255;
    for (var k = 0; k < 3; k++) {
      var at = i * 9 + k * 3;
      colours[at] = r; colours[at + 1] = g; colours[at + 2] = b;
    }
  }
  geometry.getAttribute('color').needsUpdate = true;
}

/* A model grows upward into negative Y, so height is negated on the way into a
   scene where Y is up. X and Z pass through untouched. */
function writePositions(geometry, m) {
  var faces = geometry.userData.faces;
  var positions = geometry.getAttribute('position').array;
  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    var a = m.fa[f], b = m.fb[f], c = m.fc[f];
    var at = i * 9;
    positions[at] = m.vx[a]; positions[at + 1] = -m.vy[a]; positions[at + 2] = m.vz[a];
    positions[at + 3] = m.vx[b]; positions[at + 4] = -m.vy[b]; positions[at + 5] = m.vz[b];
    positions[at + 6] = m.vx[c]; positions[at + 7] = -m.vy[c]; positions[at + 8] = m.vz[c];
  }
  geometry.getAttribute('position').needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

// ---- the stage ------------------------------------------------------------

function Stage(canvas) {
  this.canvas = canvas;
  this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  this.renderer.setPixelRatio(Math.min(2, self.devicePixelRatio || 1));
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x07070a);

  this.camera = new THREE.PerspectiveCamera(45, 1, 10, 20000);
  // Framed on a fight rather than on the floor: a figure is about 220 units
  // tall and the tiles that matter are the few around the kill, so the camera
  // sits close enough to read a swing and high enough to see both fighters.
  this.orbit = { yaw: Math.PI * 0.25, pitch: 0.55, distance: 780, target: new THREE.Vector3(0, 110, 0) };

  this.scene.add(new THREE.AmbientLight(0xffffff, 0.78));
  var key = new THREE.DirectionalLight(0xfff2d0, 0.85);
  key.position.set(-400, 900, 500);
  this.scene.add(key);
  var rim = new THREE.DirectionalLight(0x6f8dff, 0.35);
  rim.position.set(600, 300, -600);
  this.scene.add(rim);

  this.floor();
  this.palette = mesh.palette(BRIGHTNESS);
  this.fighters = [];
  this.cam = null;
  this.t = 0;
  this.playing = false;
  this.onTick = null;
  this.overlay = null;

  var self_ = this;
  this.step = function () { self_.frame(); };
  this.controls();
  this.resize();
}

/* The floor is a grid and a plane, and nothing else. A cam holds no region,
   so any scenery drawn here would be an invention about where the fight was. */
Stage.prototype.floor = function () {
  var size = GRID * TILE;
  var plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color: 0x0c0c10 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1;
  this.scene.add(plane);

  var grid = new THREE.GridHelper(size, GRID, 0x6a5a2a, 0x25252c);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  this.scene.add(grid);

  // The base tile: the killer's tile on the last frame, which every delta in
  // the cam is measured from.
  var base = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE, TILE),
    new THREE.MeshBasicMaterial({ color: 0xc98f14, transparent: true, opacity: 0.12 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.5;
  this.scene.add(base);
};

Stage.prototype.controls = function () {
  var self_ = this;
  var dragging = false, lastX = 0, lastY = 0;
  this.canvas.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    self_.canvas.setPointerCapture(e.pointerId);
  });
  this.canvas.addEventListener('pointermove', function (e) {
    if (!dragging) { return; }
    self_.orbit.yaw -= (e.clientX - lastX) * 0.008;
    self_.orbit.pitch = clamp(self_.orbit.pitch + (e.clientY - lastY) * 0.006, 0.08, 1.45);
    lastX = e.clientX; lastY = e.clientY;
    self_.draw();
  });
  var stop = function (e) {
    dragging = false;
    if (e.pointerId !== undefined && self_.canvas.hasPointerCapture(e.pointerId)) {
      self_.canvas.releasePointerCapture(e.pointerId);
    }
  };
  this.canvas.addEventListener('pointerup', stop);
  this.canvas.addEventListener('pointercancel', stop);
  this.canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    self_.orbit.distance = clamp(self_.orbit.distance * (1 + Math.sign(e.deltaY) * 0.12), 260, 3600);
    self_.draw();
  }, { passive: false });
};

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

Stage.prototype.resize = function () {
  var width = this.canvas.clientWidth || 620;
  var height = this.canvas.clientHeight || width;
  this.renderer.setSize(width, height, false);
  this.camera.aspect = width / height;
  this.camera.updateProjectionMatrix();
  this.draw();
};

/**
 * Load a cam: assemble both fighters, fetch what they wear and what they did.
 *
 * Resolves once the fight can be drawn. A fighter whose gear will not load is
 * still drawn from whatever did - a missing mesh costs a piece of armour, not
 * the replay.
 */
Stage.prototype.load = function (cam) {
  var self_ = this;
  this.clear();
  this.cam = cam;
  this.t = 0;

  var sides = [
    { key: 'killer', actor: cam.killer },
    { key: 'victim', actor: cam.victim }
  ];

  return Promise.all(sides.map(function (side) {
    var look = camApi.parseAppearance(side.actor.appearanceBytes);
    var animIds = side.actor.frames.map(function (f) { return f.anim; })
      .filter(function (id) { return id >= 0; });
    return assets.loadFighter(look, animIds).then(function (loaded) {
      if (!loaded || !loaded.figure) { return null; }
      return {
        key: side.key,
        name: side.actor.name,
        frames: side.actor.frames,
        look: loaded.look,
        base: loaded.figure,
        posed: mesh.copy(loaded.figure),
        seqs: loaded.seqs,
        groups: loaded.groups
      };
    });
  })).then(function (built) {
    built.forEach(function (fighter) {
      if (!fighter) { return; }
      fighter.posed.vertexGroups = fighter.base.vertexGroups;
      fighter.posed.faceGroups = fighter.base.faceGroups;
      fighter.geometry = geometryOf(fighter.base, self_.palette);
      fighter.object = new THREE.Mesh(fighter.geometry, new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide, flatShading: true
      }));
      self_.scene.add(fighter.object);
      self_.fighters.push(fighter);
    });
    self_.frameOnFight();
    self_.draw();
    return self_.fighters.length;
  });
};

/* Point the camera across the fight rather than along it.

   Two fighters standing a tile apart hide each other from half the compass, and
   which half depends on where the kill happened to land. Taking the line
   between them on the last tick and standing at right angles to it means the
   first thing a viewer sees is both of them. */
Stage.prototype.frameOnFight = function () {
  if (this.fighters.length < 2) { return; }
  var a = anim.positionAt(this.fighters[0].frames, this.cam.frames - 1);
  var b = anim.positionAt(this.fighters[1].frames, this.cam.frames - 1);
  if (!a || !b) { return; }
  var dx = (b.x - a.x) * TILE;
  var dz = -(b.y - a.y) * TILE;
  if (!dx && !dz) { return; }
  this.orbit.yaw = Math.atan2(dz, dx) + Math.PI / 2;
  // Far enough back that a couple of tiles of movement stay in shot.
  this.orbit.distance = Math.max(620, Math.sqrt(dx * dx + dz * dz) * 2.6 + 420);
};

Stage.prototype.clear = function () {
  var self_ = this;
  this.fighters.forEach(function (fighter) {
    self_.scene.remove(fighter.object);
    fighter.geometry.dispose();
    fighter.object.material.dispose();
  });
  this.fighters = [];
};

Stage.prototype.play = function () {
  if (!this.cam || this.playing) { return; }
  if (this.t >= this.cam.frames - 1) { this.t = 0; }
  this.playing = true;
  this.last = 0;
  requestAnimationFrame(this.step);
};

Stage.prototype.pause = function () { this.playing = false; };

Stage.prototype.seek = function (t) {
  this.pause();
  this.t = clamp(t, 0, this.cam ? this.cam.frames - 1 : 0);
  this.draw();
};

Stage.prototype.frame = function () {
  if (!this.playing) { return; }
  var now = performance.now();
  if (!this.last) { this.last = now; }
  this.t += (now - this.last) / TICK_MS;
  this.last = now;
  var done = this.t >= this.cam.frames - 1;
  if (done) { this.t = this.cam.frames - 1; this.playing = false; }
  this.draw();
  if (this.onTick) { this.onTick(this.t, done); }
  if (this.playing) { requestAnimationFrame(this.step); }
};

Stage.prototype.draw = function () {
  var self_ = this;
  this.fighters.forEach(function (fighter) { self_.pose(fighter); });

  // The camera looks at the fight, not at the origin: the two fighters drift
  // across the board over nine ticks and a fixed target loses them.
  var mid = this.midpoint();
  var orbit = this.orbit;
  orbit.target.x += (mid.x - orbit.target.x) * 0.25;
  orbit.target.z += (mid.z - orbit.target.z) * 0.25;
  this.camera.position.set(
    orbit.target.x + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
    orbit.target.y + Math.sin(orbit.pitch) * orbit.distance,
    orbit.target.z + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance
  );
  this.camera.lookAt(orbit.target);
  this.renderer.render(this.scene, this.camera);
  if (this.overlay) { this.overlay(this.readout()); }
};

Stage.prototype.pose = function (fighter) {
  var at = anim.positionAt(fighter.frames, this.t);
  if (!at) {
    // Nowhere on the board the cam recorded, so nowhere to draw them.
    fighter.object.visible = false;
    return;
  }
  fighter.object.visible = true;
  // North is -Z, so a cam's northward delta walks away from the camera's home
  // position rather than toward it.
  fighter.object.position.set(at.x * TILE, 0, -at.y * TILE);

  // A frame stores the tile a fighter is turned towards, in the cam's own
  // deltas - so the direction they face is that tile minus the one they are
  // standing on. Reading the delta as a direction points every fighter out of
  // the cam's base tile instead, which stood two men in a fight shoulder to
  // shoulder facing the same way.
  var face = at.frame;
  if (face.facing && (face.faceDx !== face.dx || face.faceDy !== face.dy)) {
    fighter.object.rotation.y = Math.atan2(face.faceDx - face.dx, -(face.faceDy - face.dy));
  }

  var pose = anim.poseFor(fighter, this.t);
  var base = fighter.base;
  var posed = fighter.posed;
  posed.vx.set(base.vx.subarray(0, base.nv));
  posed.vy.set(base.vy.subarray(0, base.nv));
  posed.vz.set(base.vz.subarray(0, base.nv));
  posed.alpha.set(base.alpha.subarray(0, base.nf));
  if (pose) {
    var frameId = anim.frameAt(pose.seq, pose.cycles);
    var group = fighter.groups[frameId >>> 16];
    if (group) { mesh.applyFrame(posed, group, frameId & 0xFFFF); }
  }
  writePositions(fighter.geometry, posed);
};

/* Halfway between the fighters who are on the board, in world units. */
Stage.prototype.midpoint = function () {
  var self_ = this;
  var x = 0, z = 0, n = 0;
  this.fighters.forEach(function (fighter) {
    var at = anim.positionAt(fighter.frames, self_.t);
    if (!at) { return; }
    x += at.x * TILE;
    z += -at.y * TILE;
    n++;
  });
  return n ? { x: x / n, z: z / n } : { x: 0, z: 0 };
};

/** What the overlay draws: each fighter's screen position, hit and hitpoints. */
Stage.prototype.readout = function () {
  var self_ = this;
  return this.fighters.map(function (fighter) {
    var at = anim.positionAt(fighter.frames, self_.t);
    if (!at) { return { key: fighter.key, visible: false }; }
    var head = new THREE.Vector3(at.x * TILE, 250, -at.y * TILE).project(self_.camera);
    return {
      key: fighter.key,
      name: fighter.name,
      hp: at.frame.hp,
      damage: at.frame.damage,
      hitType: at.frame.hitType,
      x: (head.x * 0.5 + 0.5) * 100,
      y: (-head.y * 0.5 + 0.5) * 100,
      visible: head.z < 1
    };
  });
};

/** Whether this browser can draw a replay at all. */
function supported() {
  if (typeof DecompressionStream !== 'function') { return false; }
  try {
    var probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

self.KillcamStage = { Stage: Stage, supported: supported };

export { Stage, supported };
