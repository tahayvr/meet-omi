/* ---------- Omi pack: everything an app needs to draw, animate and morph Omi ----------
   omi.json holds every mode as plain rects (with roles), every animation as
   keyframes, and the numbers the morph uses. README.md (PACK_README) explains
   the format to whoever writes a player for it, in any language, and
   conformance.json lets that player check itself. Bump PACK_VERSION whenever
   the format changes in a way an existing player would misread.
   tools/build-pack.js writes the same files into pack/. */
const PACK_VERSION = 1;
// "mark": the plain logo, with nothing in the middle
const MORPH_MARK = { id: "mark", name: "The mark", face: [], mood: "" };
// a square around the logo with room for the props
const MORPH_VB = { x: -70, y: -70, w: 440, h: 440 };
// morph timing, in seconds at 1x; each pair starts up to `stagger` late, the
// further from the face (MORPH_C) the later
const MORPH_TIME = { duration: 0.62, stagger: 0.22 },
  MORPH_EASE = [0.65, 0, 0.35, 1],
  MORPH_C = { x: 150, y: 140 },
  SPLIT_REACH = 140; // a new piece splits off a piece at most this far away
// Where the eyes may go when they look around: the logo's inner square. The
// player limits a look so no gazing piece leaves it (wide eyes get less reach).
const GAZE_INSIDE = [60, 60, 180, 180];

// What each mode is for. A reaction is something that just happened: apps
// show it for `hold` seconds after its morph lands, then go back. Everything
// else is a state and stays as long as what it stands for. `family` groups
// modes that mean the same thing (pick one per family); `easter` marks the
// jokes, left out of generic pickers.
const REACTIONS = {
  success: 1.2,
  happy: 1.8,
  laughing: 1.6,
  excited: 1.8,
  love: 2,
  wink: 1.2,
  shy: 2,
  surprised: 1.4,
  scared: 1.6,
  "mind-blown": 2.4,
  glitch: 1.8,
};
const FAMILIES = {
  thinking: [
    "thinking",
    "thinking-drift",
    "thinking-sideeye",
    "thinking-hmm",
    "thinking-stack",
    "thinking-snake",
  ],
  offline: ["offline-standby", "offline-searching"],
  transfer: ["updating", "uploading"],
};
const EASTER = ["glitch", "code-rain", "vim"];
function modeMeta(id) {
  const meta = { kind: id in REACTIONS ? "reaction" : "state" };
  if (id in REACTIONS) meta.hold = REACTIONS[id];
  const family = Object.keys(FAMILIES).find((f) => FAMILIES[f].includes(id));
  if (family) meta.family = family;
  if (EASTER.includes(id)) meta.easter = true;
  return meta;
}

function packAnim(a) {
  return {
    duration: a.dur,
    // easing is always a cubic-bezier, or "steps" (hold until the next key)
    ease:
      a.ease === "steps"
        ? "steps"
        : Array.isArray(a.ease)
          ? a.ease
          : EASES[a.ease],
    ...(a.body ? { body: true } : {}),
    ...(a.vars ? { vars: a.vars } : {}),
    keys: a.keys,
  };
}
function packPiece(r) {
  const a = r.c && ANIM[r.c],
    p = { x: r.x, y: r.y, w: r.w, h: r.h, role: r.role };
  if (r.o != null && r.o !== 1) p.opacity = r.o;
  if (r.clip) p.clip = true;
  if (a) {
    p.anim = r.c;
    if (r.dur && r.dur !== a.dur) p.duration = r.dur;
    if (r.dl) p.delay = r.dl;
    (a.vars || []).forEach((v) => (p[v] = r[v]));
  }
  return p;
}
function packMode(d) {
  const sh = shapes(d, false),
    m = {
      id: d.id,
      name: d.name,
      ...(d.group ? { group: d.group } : {}),
      ...modeMeta(d.id),
      bounds: [sh.box.x, sh.box.y, sh.box.x2 - sh.box.x, sh.box.y2 - sh.box.y],
    };
  if (d.mood && ANIM[d.mood]) m.anim = d.mood;
  if (d.clip) {
    const { x, y, w, h, mood } = d.clip;
    m.clip = { x, y, w, h, ...(mood ? { anim: mood } : {}) };
  }
  m.pieces = sh.rects.map(packPiece);
  return m;
}
function buildPack() {
  const used = new Set();
  const modes = [MORPH_MARK, ...DESIGNS].map((d) => {
    const m = packMode(d);
    if (m.anim) used.add(m.anim);
    if (m.clip && m.clip.anim) used.add(m.clip.anim);
    m.pieces.forEach((p) => p.anim && used.add(p.anim));
    return m;
  });
  return {
    format: "omi-pack",
    version: PACK_VERSION,
    grid: 20,
    // a square around the logo with room for the props; keeps Omi still
    // while it changes mode
    view: [MORPH_VB.x, MORPH_VB.y, MORPH_VB.w, MORPH_VB.h],
    roles: ["frame", "eye", "brow", "mouth", "tear", "extra"],
    morph: {
      ...MORPH_TIME,
      ease: MORPH_EASE,
      center: [MORPH_C.x, MORPH_C.y],
      splitReach: SPLIT_REACH,
      rolePenalty: 100,
    },
    // where the eyes can look, on top of any mode (player look())
    gaze: {
      reach: [30, 30],
      duration: 0.35,
      ease: [0.3, 0, 0.2, 1],
      roles: ["eye"],
      inside: GAZE_INSIDE,
    },
    animations: Object.fromEntries(
      Object.keys(ANIM)
        .filter((k) => used.has(k))
        .map((k) => [k, packAnim(ANIM[k])]),
    ),
    modes,
  };
}

/* What a correct player draws, made by the reference player (player/omi.js).
   modes: every mode's rects at a few times. morphs: a few morphs, from the
   first frame to the landing; frames in between depend on how a player
   pairs pieces, so they are a reference, not a requirement. */
const CONFORMANCE_TIMES = [0, 0.9, 3.3],
  CONFORMANCE_MORPHS = [
    ["mark", "idle"],
    ["idle", "error"],
    ["idle", "thinking"],
    ["working", "happy"],
    ["sleeping", "party"],
    ["idle", "peek"],
    ["peek", "sudo"],
    ["thinking-snake", "love"],
  ],
  // [mode, direction]: the eyes turned there, from looking ahead
  CONFORMANCE_GAZES = [
    ["idle", [0, -1]],
    ["idle", [-1, 0.5]],
    ["tiling", [1, 0]],
    // wide eyes: the look is limited so they stay inside gaze.inside
    ["success", [1, 1]],
    ["error", [-1, 1]],
  ];
function buildConformance(pack) {
  const canvas = {
      width: 1,
      height: 1,
      getContext: () => ({
        setTransform() {},
        clearRect() {},
        fillRect() {},
      }),
    },
    omi = new Omi(canvas, pack, { color: "#000" }),
    num = (v) => +v.toFixed(4),
    rect = (r) => [num(r.x), num(r.y), num(r.w), num(r.h), num(r.o), r.role],
    shown = (list) => list.filter((r) => r.o > 0.001).map(rect);
  const modes = {};
  for (const m of pack.modes)
    modes[m.id] = Object.fromEntries(
      CONFORMANCE_TIMES.map((t) => [t, shown(omi.modeRects(m, t))]),
    );
  const { duration, stagger } = pack.morph,
    total = duration + stagger,
    morphs = CONFORMANCE_MORPHS.map(([from, to]) => {
      omi.set(from, { instant: true });
      const start = shown(omi.rects());
      omi.set(to);
      // drive the player by hand at 100 fps
      const frames = {};
      let ms = 1000;
      omi.frame(ms);
      for (const at of [0.2, 0.4]) {
        while (ms < 1000 + at * 1000) omi.frame((ms += 10));
        frames[at] = shown(omi.rects());
      }
      while (omi.morph) omi.frame((ms += 10));
      return { from, to, start, frames, end: shown(omi.rects()) };
    });
  // The gaze: from straight ahead, halfway (eased) and landed.
  const gazes = CONFORMANCE_GAZES.map(([mode, look]) => {
    omi.set(mode, { instant: true });
    omi.animate = false;
    omi.look(0, 0);
    let ms = 5000;
    omi.frame(ms);
    omi.look(look[0], look[1]);
    while (ms < 5000 + (pack.gaze.duration / 2) * 1000) omi.frame((ms += 5));
    const half = { at: (ms - 5000) / 1000, rects: shown(omi.rects()) };
    while (omi.gazing) omi.frame((ms += 10));
    const end = shown(omi.rects());
    omi.animate = true;
    omi.look(0, 0);
    while (omi.gazing) omi.frame((ms += 10));
    return { mode, look, half, end };
  });
  omi.destroy();
  return {
    format: "omi-conformance",
    version: 1,
    pack_version: pack.version,
    tolerance: { position: 0.01, opacity: 0.001 },
    rect: ["x", "y", "w", "h", "opacity", "role"],
    modes,
    morph_seconds: total,
    morphs,
    gazes,
  };
}
// The pack's files, as { name: text }.
function packFiles() {
  const pack = JSON.parse(JSON.stringify(buildPack()));
  return {
    "omi.json": JSON.stringify(pack, null, 2) + "\n",
    "README.md": PACK_README,
    "conformance.json": JSON.stringify(buildConformance(pack)) + "\n",
  };
}

const PACK_README = `# Omi pack

Everything an app needs to draw Omi, animate every mode, and morph between
modes. Made by the Meet Omi design jig. This file describes format version
${PACK_VERSION}.

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
runs fn when a morph lands. omi.loopSeconds(mode) is how long a mode takes
to play every piece's loop once: show it at least that long in a tour.
omi.hold(mode) is how long to show a reaction after its morph lands, and
omi.kind(mode) whether the pack calls it one.
omi.set(mode, { since }) plays a change that
happened at \`since\` (Unix ms), for apps sharing one Omi through the Omi
state protocol: every app then shows the same frame at the same moment. Outside a browser (QML, GJS, Node, tests), pass
null for the canvas and a color, call omi.frame(milliseconds) on every
display frame, and fill the rects in omi.rects() yourself.

omi.js runs in Qt Quick's JavaScript (Qt 6), the engine behind the Omarchy
shell, so Omarchy shell plugins use it as is: see examples/omarchy in the
Meet Omi repo for a ready Omi.qml.

## Units

All sizes are in grid units. The Omarchy logo is a 300 × 300 square starting
at (0, 0), and \`grid\` (20) is the size of one logo cell. \`view\` is a square
[x, y, w, h] around the logo with room for the props: use it as the viewBox to
keep Omi steady while it changes mode. Each mode's \`bounds\` is the tightest
box around it, for stills.

## Modes

Each mode is a list of \`pieces\`. Every piece is a filled rectangle:

    { "x": 100, "y": 110, "w": 20, "h": 40, "role": "eye", "anim": "eye" }

- \`role\`: what the piece is. frame (the logo, including the mouths it makes),
  eye, brow, mouth, tear or extra (props: dots, z's, confetti, arrows).
- \`opacity\`: 0..1, default 1.
- \`anim\`: the animation this piece plays, from \`animations\`.
- \`delay\`: how many seconds this piece lags behind its animation (staggers
  a row of pieces). \`duration\`: overrides the animation's duration.
- Extra numbers some animations read (\`mx\`, \`my\`, \`dx\`, \`dy\`), see vars.
- \`clip\`: true if the piece is only visible inside the mode's \`clip\` window.

A mode can also have:

- \`anim\`: an animation that moves the whole of Omi (a bob, a hop, a shake),
  applied about the center of \`bounds\`.
- \`clip\`: { x, y, w, h, anim? }: a window. Pieces with \`clip: true\` are
  drawn clipped to it, on their own layer, moved by the window's \`anim\`:
  only its tx and ty move them (sx, sy and op are ignored), and the window
  itself stays put. Cut each such piece to the window; drop it when less
  than 0.01 unit of it is left in either direction. The body motion is
  applied after that.

Drawing order is the order of \`pieces\`, except that in a mode with a
window the pieces seen through it come first, then the rest.

"mark" is the plain logo, with nothing in the middle.

What a mode is for:

- \`kind\`: "state" or "reaction". A state stands for something going on
  (thinking, updating, listening) and stays as long as it does. A reaction
  is something that just happened (success, surprised, a wink): show it,
  then go back to the state Omi was in.
- \`hold\`: on a reaction, how many seconds to show it after its morph lands
  before going back. For a mode without one, hold it for its loop time
  (\`loopSeconds\` in the reference player), kept between 1.2 and 2.5 s. The
  reference player's \`omi.hold(mode)\` gives either.
- \`family\`: modes that mean the same thing ("thinking", "offline",
  "transfer"). Pick one per family for a situation; the rest are variations.
- \`easter\`: true on the jokes (vim, glitch, code-rain). Leave them out of a
  generic picker.
- \`group\`: where the jig files it. For people, not for apps.

## Animations

An animation loops forever. Each one has a \`duration\` (seconds), an \`ease\`
and \`keys\`: [progress 0..1, values].

Values on top of the piece's rest position:

- \`tx\`, \`ty\`: move, in grid units
- \`sx\`, \`sy\`: scale, about the piece's own center
- \`op\`: opacity, multiplied with the piece's own opacity

To find a piece's look at time t (seconds):

1. progress p = ((t - delay) / duration) mod 1, kept in 0..1.
2. Values come in two channels: move (tx, ty, sx, sy) and opacity (op).
   Work out each channel on its own.
3. A channel's keys are the keys that set any of its values. If the channel
   has no key at 0 or at 1, add one there with rest values (tx = ty = 0,
   sx = sy = 1, op = 1). Inside a move key, values it doesn't set are at rest.
4. Find the two keys around p, k0 at p0 and k1 at p1, and blend:
   value = v0 + (v1 - v0) × ease((p - p0) / (p1 - p0)).
5. A value can be [name, factor]: the piece's own number \`name\` times
   \`factor\` (confetti flies to its own mx, my).

\`ease\` is a cubic-bezier [x1, y1, x2, y2], exactly like CSS
cubic-bezier(), applied to every segment between two keys. "steps" holds v0
until the next key.

To draw: scale the piece about its center by sx, sy, move it by tx, ty, then
fill it with opacity × op. With a body \`anim\` (\`body: true\`), move and scale
the whole of Omi about the center of the mode's \`bounds\`.

A mode at rest is time 0. Start a mode's animations at t = 0 when you show
it, and a still and its animation always match. Note that a piece with a
\`delay\` is then (−delay mod duration) into its loop (progress wraps), so
at rest it shows the end of its loop, not the start.

A mode's loop time (\`loopSeconds\` in the reference player) is the longest
of (duration + delay) over its pieces, its body \`anim\` and its window's,
where duration is the piece's own if it sets one. 0 for a still mode.

## Time

A player keeps one clock for a mode's loops and one for a morph. On every
display frame it is given the time in milliseconds and advances both by
dt = (now − last) / 1000, kept between 0 and 0.1 s (a host's clock may
restart, or pause), times \`speed\`; the first frame advances nothing. A
mode change made between two frames starts its morph at 0 and moves from
the next frame on. Only rects with opacity above 0.001 are on screen: drop
the rest before drawing, and before taking them as a morph's source.
Changing to the mode Omi is already in, with no morph running, does
nothing.

## Morphing from one mode to another

Every step here is exact: two players that follow them draw the same
morph. (The conformance data only requires the start and the landing, so a
player may pair differently, but then its morphs look different.)

1. Take the rects on screen now, before the gaze is applied (in the middle
   of an animation, or in the middle of a morph: whatever is drawn), with
   opacity above 0.001, and the new mode's rects at rest (t = 0).
2. Cut rects into grid cells, along the grid lines, so a cell that is in
   both modes can stay where it is: a rect whose four edges all sit on
   multiples of \`grid\` (within 1e-6), or that overlaps any piece of
   \`mark\` (the logo), is cut at every grid line it crosses; the end cells
   keep their partial size. Other rects stay whole.
3. Pair the old cells (S) with the new ones (D):
   - *Rigid groups.* Cells that moved together as a whole, or didn't move
     at all, pair first. Two cells are "the same" when x, y, w, h match to
     half a unit and the role is equal. Each pair of an old and a new cell
     with the same role and size (w and h within 0.5) votes for the offset
     (new − old), rounded to whole units, averaging the exact offsets of its
     voters. The zero offset is always a candidate. An offset fits as many
     old cells as find a distinct new cell that is the same once shifted by
     it. It needs at least max(12, 0.3 × min(|S|, |D|)) fits; a non-zero
     offset is chosen over the zero one only if it fits more than 1.2× as
     many. The chosen offset pairs every old cell that fits (each new cell
     once). If it was non-zero the pairs are *rigid* and the search runs
     again on what is left, up to 4 times; the zero offset, or no fit, ends
     it.
   - *The rest* pair by a minimum-cost one-to-one assignment (the smaller
     side is matched in full), cost = squared distance between centers +
     0.5 × ((Δw)² + (Δh)²) + \`rolePenalty\`² when the roles differ. A frame
     cell and a face cell (eye, brow, mouth, tear) never pair: their cost
     is infinite, and an assignment that lands on one is dropped.
   - *New cells with no partner* split off their nearest old cell (paired
     ones too, but never a banned role), nearest by squared distance +
     \`rolePenalty\`² for a different role: they start as a copy of it, with
     the new cell's role, when its plain squared distance is under
     \`splitReach\`². Otherwise they grow from their own center: from size 0
     with the "back" ease on size (1 + 2.70158 (p − 1)³ + 1.70158 (p − 1)²),
     and opacity = target × min(1, 3p), p being the raw progress.
   - *Old cells with no partner* slide into their nearest new cell (found
     the same way) with opacity going to 0, taking its role, when it is
     within \`splitReach\`; otherwise they shrink to a zero-size rect at
     their own center with opacity 0.
4. Each pair starts late by its delay: the distance from the center of its
   new rect (its old one if the new has no size) to \`center\`, divided by
   260 and capped at 1, times \`stagger\`; a rigid pair's delay is
   stagger / 4. Its progress is (t − delay) / \`duration\`, kept in 0..1 and
   put through \`ease\`, blending x, y, w, h and opacity from old to new.
   The whole morph lands at t = duration + stagger. While it runs, a pair's
   rect has the role of its new cell.
5. When it lands, start the new mode's animations at t = 0.

## Drawing Omi crisp

Omi is pixel art: the logo is a grid of square cells (\`grid\` units each).
These hold for every host, a canvas, Qt, a terminal or a GPU:

- Snap each rect's edges to device pixels (round the edges, not the size),
  so edges are sharp and neighbouring pieces meet exactly.
- Draw at a scale where one cell is a whole number of device pixels. The
  view is view[2] / grid = 22 cells across, so a view 44, 66, 88… device
  pixels wide keeps every bar the same thickness; anything in between makes
  some cells a pixel wider than others. Fit the largest such size into the
  space you have (the reference player's \`even\` option does).
- 44 device pixels across (two per cell) is the smallest size where the
  props stay readable; 22 still shows the logo and the eyes.
- At small sizes whole-body motion (bobs, hops) moves a pixel at a time and
  reads as a stutter: turn it off, or apply it to the whole of Omi as one
  sub-pixel transform instead of per rect.
- Omi is one color: use the host's accent (an Omarchy theme's \`accent\`).
  Where you can't draw a rect's opacity, blend into the background, or treat
  an opacity of 0.5 or more as on.

## Gaze: where the eyes look

\`gaze\` (optional; a player without it ignores it) lets an app turn Omi's
eyes toward something on screen, on top of any mode:

    "gaze": { "reach": [30, 30], "duration": 0.35, "ease": [0.3, 0, 0.2, 1],
              "roles": ["eye"], "inside": [60, 60, 180, 180] }

- A look is a direction, each axis -1..1: x to the right, y down. (0, 0) is
  straight ahead, where every mode is drawn.
- At a look (gx, gy), every rect whose role is in \`roles\` moves by
  gx × reach[0], gy × reach[1] grid units. Everything else stays.
- \`inside\` (optional) is a box [x, y, w, h] the gazing rects stay in, so wide
  eyes don't run into the frame. Limit the move on each axis before applying
  it: over the gazing rects that fit inside the box on that axis (left edge
  at or past the box's, right edge at or before it), dx may be at most the
  smallest (box right − rect right) and at least the largest (box left −
  rect left); the same for dy with top and bottom. Rects that don't fit are
  ignored, and if the two limits cross there is no room: no move on that
  axis. Work it out from the rects as they are at that moment, loops and
  morphs included, so an app can always ask for a full look.
- It applies to whatever is on screen: a mode at any time in its loops, or a
  morph in progress, after the body motion. It is the last thing done: a
  morph takes its source rects before the gaze, so a look is never applied
  twice.
- A new look eases from wherever the eyes are at that moment (the last
  frame's direction) to the new one over \`duration\` seconds with \`ease\`
  (the same cubic-bezier as animations), on its own clock, advanced like
  the others (see Time): a mode change doesn't interrupt it. Each axis is
  kept in −1..1, and asking for the direction already set does nothing.
- The look is the app's own, not part of the shared state protocol.

The reference player has \`omi.look(dx, dy)\`, \`omi.gaze()\` (the
direction now) and \`omi.gazing\` (still on the way).

## Checking your own player

conformance.json lists what a correct player draws. Every rect is
[x, y, w, h, opacity, role], and only rects with opacity above 0.001 are
listed, in drawing order.

- \`modes\`: for every mode, the rects at a few times (in seconds), with body
  motion on. Yours must match within \`tolerance\`.
- \`morphs\`: a few morphs. \`start\` is the old mode at rest, \`end\` is what
  the morph lands on (\`morph_seconds\` in): yours must match both, in any
  order. \`frames\` (0.2 s and 0.4 s in) are the reference player's frames in
  between; a player that pairs pieces exactly as described above matches
  them too, but other pairings are allowed.
- \`gazes\`: a mode at rest with no loops (animate off), looking ahead, then
  turned to \`look\`: \`half\` is \`half.at\` seconds in, \`end\` is
  once it has landed. Yours must match both, in drawing order.
`;

// on the page only (tools/build-pack.js loads this file without one)
if (typeof $ === "function" && $("savePack"))
  $("savePack").addEventListener("click", async () => {
    const enc = new TextEncoder(),
      files = Object.entries(packFiles()).map(([name, text]) => ({
        name: "omi-pack/" + name,
        data: enc.encode(text),
      }));
    try {
      const res = await fetch("player/omi.js");
      if (res.ok)
        files.push({ name: "omi-pack/omi.js", data: enc.encode(await res.text()) });
    } catch (e) {}
    if (files.length < 4) toast("Couldn\u2019t include the player (omi.js).");
    await save("omi-pack.zip", zip(files));
  });
