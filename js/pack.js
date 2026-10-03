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
runs fn when a morph lands. omi.set(mode, { since }) plays a change that
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
  drawn clipped to it, on their own layer, moved by the window's \`anim\`.

"mark" is the plain logo, with nothing in the middle.

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
     \`rolePenalty\` units of distance for a different role). Frame pieces and
     face pieces (eye, brow, mouth, tear) never pair with each other.
   - A new piece with no partner starts on top of its nearest piece within
     \`splitReach\` units (it splits off it), or else grows from its own
     center. An old piece with no partner slides into its nearest new piece
     and fades out, or else shrinks away.
4. Move each pair from old to new over \`duration\` seconds with \`ease\`,
   blending x, y, w, h and opacity. Start each pair up to \`stagger\` seconds
   late, the further from \`center\` the later, so the change ripples out from
   the face.
5. When it lands, start the new mode's animations at t = 0.

## Gaze: where the eyes look

\`gaze\` (optional; a player without it ignores it) lets an app turn Omi's
eyes toward something on screen, on top of any mode:

    "gaze": { "reach": [30, 30], "duration": 0.35, "ease": [0.3, 0, 0.2, 1],
              "roles": ["eye"] }

- A look is a direction, each axis -1..1: x to the right, y down. (0, 0) is
  straight ahead, where every mode is drawn.
- At a look (gx, gy), every rect whose role is in \`roles\` moves by
  gx × reach[0], gy × reach[1] grid units. Everything else stays.
- It applies to whatever is on screen: a mode at any time in its loops, or a
  morph in progress, after the body motion.
- A new look eases from wherever the eyes are to the new direction over
  \`duration\` seconds with \`ease\` (the same cubic-bezier as
  animations), on its own clock: a mode change doesn't interrupt it.
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
