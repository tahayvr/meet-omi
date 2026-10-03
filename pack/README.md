# Omi pack

Everything an app needs to draw Omi, animate every mode, and morph between
modes. Made by the Meet Omi design jig. This file describes format version
1.

## Files

- omi.json: every mode, every animation, and the morph settings.
- omi.js: the reference player, for web pages and anything with a
  JavaScript engine (Electron, QML, GJS).
- conformance.json: what a correct player draws, to test your own.

Nothing here is tied to one language or toolkit. omi.json is plain JSON and
this file describes every rule, so any app can read it and draw Omi itself:
a Rust app with serde, a Swift app with Codable, a C++ or Python app with
any JSON library. All a player has to draw is filled rectangles.

## Using the player

omi.js is a small player for web pages and Electron apps, and the reference
for players in other languages:

    <canvas id="omi" style="width: 240px; height: 240px; color: #9ece6a"></canvas>
    <script src="omi.js"></script>
    <script>
      const pack = await (await fetch("omi.json")).json();
      const omi = new Omi(document.getElementById("omi"), pack);
      omi.set("thinking"); // morphs from wherever Omi is
    </script>

Options: color (null follows the canvas's CSS color), speed, animate,
bodyMotion (false leaves out whole-body bobs), mode (where to start), view
(an [x, y, w, h] to show instead of the pack's view). omi.on("settled", fn)
runs fn when a morph lands. omi.set(mode, { since }) plays a change that
happened at `since` (Unix ms), for apps sharing one Omi through the Omi
state protocol: every app then shows the same frame at the same moment. Outside a browser (QML, GJS, Node, tests), pass
null for the canvas and a color, call omi.frame(milliseconds) on every
display frame, and fill the rects in omi.rects() yourself.

omi.js runs in Qt Quick's JavaScript (Qt 6), the engine behind the Omarchy
shell, so Omarchy shell plugins use it as is: see examples/omarchy in the
Meet Omi repo for a ready Omi.qml.

## Units

All sizes are in grid units. The Omarchy logo is a 300 × 300 square starting
at (0, 0), and `grid` (20) is the size of one logo cell. `view` is a square
[x, y, w, h] around the logo with room for the props: use it as the viewBox to
keep Omi steady while it changes mode. Each mode's `bounds` is the tightest
box around it, for stills.

## Modes

Each mode is a list of `pieces`. Every piece is a filled rectangle:

    { "x": 100, "y": 110, "w": 20, "h": 40, "role": "eye", "anim": "eye" }

- `role`: what the piece is. frame (the logo, including the mouths it makes),
  eye, brow, mouth, tear or extra (props: dots, z's, confetti, arrows).
- `opacity`: 0..1, default 1.
- `anim`: the animation this piece plays, from `animations`.
- `delay`: how many seconds this piece lags behind its animation (staggers
  a row of pieces). `duration`: overrides the animation's duration.
- Extra numbers some animations read (`mx`, `my`, `dx`, `dy`), see vars.
- `clip`: true if the piece is only visible inside the mode's `clip` window.

A mode can also have:

- `anim`: an animation that moves the whole of Omi (a bob, a hop, a shake),
  applied about the center of `bounds`.
- `clip`: { x, y, w, h, anim? }: a window. Pieces with `clip: true` are
  drawn clipped to it, on their own layer, moved by the window's `anim`.

"mark" is the plain logo, with nothing in the middle.

## Animations

An animation loops forever. Each one has a `duration` (seconds), an `ease`
and `keys`: [progress 0..1, values].

Values on top of the piece's rest position:

- `tx`, `ty`: move, in grid units
- `sx`, `sy`: scale, about the piece's own center
- `op`: opacity, multiplied with the piece's own opacity

To find a piece's look at time t (seconds):

1. progress p = ((t - delay) / duration) mod 1, kept in 0..1.
2. Values come in two channels: move (tx, ty, sx, sy) and opacity (op).
   Work out each channel on its own.
3. A channel's keys are the keys that set any of its values. If the channel
   has no key at 0 or at 1, add one there with rest values (tx = ty = 0,
   sx = sy = 1, op = 1). Inside a move key, values it doesn't set are at rest.
4. Find the two keys around p, k0 at p0 and k1 at p1, and blend:
   value = v0 + (v1 - v0) × ease((p - p0) / (p1 - p0)).
5. A value can be [name, factor]: the piece's own number `name` times
   `factor` (confetti flies to its own mx, my).

`ease` is a cubic-bezier [x1, y1, x2, y2], exactly like CSS
cubic-bezier(), applied to every segment between two keys. "steps" holds v0
until the next key.

To draw: scale the piece about its center by sx, sy, move it by tx, ty, then
fill it with opacity × op. With a body `anim` (`body: true`), move and scale
the whole of Omi about the center of the mode's `bounds`.

A mode at rest is time 0: every piece at its animations' first frame. Start a
mode's animations at t = 0 when you show it, and a still and its animation
always match.

## Morphing from one mode to another

1. Take the pieces as they are on screen now (in the middle of an animation,
   or in the middle of a morph), and the new mode's pieces at rest (t = 0).
2. Cut pieces that sit on the grid or touch the logo into grid cells, along
   the grid lines (a frame bar becomes a row of cells), so a cell that is in
   both modes can stay where it is.
3. Pair pieces:
   - Pieces that exist in both, in the same place with the same role, stay
     and only change opacity.
   - Then pair the rest by distance, preferring the same role (an extra
     `rolePenalty` units of distance for a different role). Frame pieces and
     face pieces (eye, brow, mouth, tear) never pair with each other.
   - A new piece with no partner starts on top of its nearest piece within
     `splitReach` units (it splits off it), or else grows from its own
     center. An old piece with no partner slides into its nearest new piece
     and fades out, or else shrinks away.
4. Move each pair from old to new over `duration` seconds with `ease`,
   blending x, y, w, h and opacity. Start each pair up to `stagger` seconds
   late, the further from `center` the later, so the change ripples out from
   the face.
5. When it lands, start the new mode's animations at t = 0.

## Checking your own player

conformance.json lists what a correct player draws. Every rect is
[x, y, w, h, opacity, role], and only rects with opacity above 0.001 are
listed, in drawing order.

- `modes`: for every mode, the rects at a few times (in seconds), with body
  motion on. Yours must match within `tolerance`.
- `morphs`: a few morphs. `start` is the old mode at rest, `end` is what
  the morph lands on (`morph_seconds` in): yours must match both, in any
  order. `frames` (0.2 s and 0.4 s in) are the reference player's frames in
  between; a player that pairs pieces exactly as described above matches
  them too, but other pairings are allowed.
