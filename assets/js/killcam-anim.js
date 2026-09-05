/* Turning a recorded tick into a pose.

   A cam samples once every 600ms. Animations run on the client's own 20ms
   cycle, thirty of them to a tick, and a sequence's frames each last a number
   of those cycles. So "what is this fighter doing right now" is two questions:
   which animation, and how far into it - and neither is stored in the cam
   directly.

   Which animation is the cam's answer where it has one. The capture stream also
   marks accepted attack starts separately, so a defender's block stays a block
   instead of being misclassified as a simultaneous counterattack. Where the cam
   has no answer the fighter's own animations decide: they
   walked if their tile changed, and stood if it did not, and both of those ids
   come out of the appearance block rather than out of the recording.

   Kept apart from the renderer so it can be tested without a canvas, and so the
   tile board could use it too. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.KillcamAnim = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CYCLES_PER_TICK = 30; // 600ms tick over the client's 20ms cycle

  /* Killcam.MAX_RADIUS: the window is trimmed to eight tiles around the kill,
     so a delta wider than that is not a place the cam recorded. It can still
     appear in one - a tile is a signed byte on the wire, and the recorder
     clamps rather than fails - and drawing it puts a fighter a hundred tiles
     off the board. */
  var MAX_RADIUS = 8;

  function onBoard(frame) {
    return Math.abs(frame.dx) <= MAX_RADIUS && Math.abs(frame.dy) <= MAX_RADIUS;
  }

  /**
   * Where a fighter is at a fractional tick.
   *
   * Movement is interpolated because a cam samples once a tick and a fighter
   * crosses a whole tile in one: drawn discretely, a fight jumps a tile at a
   * time, which reads as lag rather than as movement.
   *
   * A frame off the board holds the last tile that was on it, and a fighter
   * who was never on it is reported as absent rather than drawn somewhere they
   * were not.
   */
  function positionAt(frames, t) {
    var index = Math.min(frames.length - 1, Math.max(0, Math.floor(t)));
    var a = anchor(frames, index);
    if (!a) { return null; }
    var b = anchor(frames, Math.min(index + 1, frames.length - 1)) || a;
    var k = t - index;
    return {
      x: a.dx + (b.dx - a.dx) * k,
      y: a.dy + (b.dy - a.dy) * k,
      frame: frames[index]
    };
  }

  /* The most recent frame at or before this one that named a tile on the board. */
  function anchor(frames, index) {
    for (var i = index; i >= 0; i--) {
      if (onBoard(frames[i])) { return frames[i]; }
    }
    for (i = index + 1; i < frames.length; i++) {
      if (onBoard(frames[i])) { return frames[i]; }
    }
    return null;
  }

  /**
   * The frame of a sequence showing after so many cycles.
   *
   * A sequence with a loop offset returns to that frame rather than to its
   * first, which is what makes a walk cycle and lets a one-shot swing hold on
   * its last frame instead of snapping back.
   *
   * @param seq    [frames, durations, loop, mainhand, offhand] as exported
   * @param cycles how long the animation has been running, in client cycles
   */
  function frameAt(seq, cycles) {
    var frames = seq[0], durations = seq[1], loop = seq[2];
    if (!frames || !frames.length) { return -1; }
    var total = 0, i;
    for (i = 0; i < frames.length; i++) { total += duration(durations, i); }
    if (total <= 0) { return frames[0]; }

    if (cycles >= total) {
      if (loop < 0 || loop >= frames.length) { return frames[frames.length - 1]; }
      var head = 0;
      for (i = 0; i < loop; i++) { head += duration(durations, i); }
      var tail = total - head;
      cycles = tail <= 0 ? head : head + ((cycles - head) % tail);
    }
    var elapsed = 0;
    for (i = 0; i < frames.length; i++) {
      elapsed += duration(durations, i);
      if (cycles < elapsed) { return frames[i]; }
    }
    return frames[frames.length - 1];
  }

  /* A duration of zero means "however long the frame itself says", which is a
     field the export does not carry. One cycle is the floor either way, and a
     sequence of zeroes must not divide by nothing. */
  function duration(durations, i) {
    var d = durations && durations[i];
    return d > 0 ? d : 1;
  }

  /**
   * Which animation a fighter is playing at a fractional tick, and how far in.
   *
   * @param fighter {frames, seqs, look} - the cam's frames for this side, the
   *                sequence definitions fetched for it, and its appearance
   * @param t       position in the cam, in ticks, fractional between frames
   */
  function poseFor(fighter, t) {
    var frames = fighter.frames;
    var index = Math.min(frames.length - 1, Math.max(0, Math.floor(t)));
    var frame = frames[index];
    var next = frames[Math.min(index + 1, frames.length - 1)];
    var within = t - index;

    if (frame.anim >= 0 && fighter.seqs[frame.anim]) {
      return { id: frame.anim, seq: fighter.seqs[frame.anim], cycles: within * CYCLES_PER_TICK };
    }
    var moving = next.dx !== frame.dx || next.dy !== frame.dy;
    var id = moving ? fighter.look.anims.walk : fighter.look.anims.stand;
    var seq = fighter.seqs[id];
    if (!seq) { return null; }
    // Standing and walking run continuously rather than restarting each tick,
    // or a fighter twitches back to the first frame every 600ms.
    return { id: id, seq: seq, cycles: t * CYCLES_PER_TICK };
  }

  return {
    frameAt: frameAt,
    poseFor: poseFor,
    positionAt: positionAt,
    onBoard: onBoard,
    CYCLES_PER_TICK: CYCLES_PER_TICK,
    MAX_RADIUS: MAX_RADIUS
  };
}));
