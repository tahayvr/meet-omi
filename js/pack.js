/* ---------- Omi pack: everything an app needs to draw, animate and morph Omi ----------
   omi.json holds every mode as plain rects (with roles), every animation as
   keyframes, and the numbers the morph uses. README.md (PACK_README) explains
   the format to whoever writes a player for it. Bump PACK_VERSION whenever
   the format changes in a way an existing player would misread. */
const PACK_VERSION = 1;

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
    if (r.dl) p.delay = +r.dl.toFixed(4);
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
    roles: ["frame", "eye", "brow", "mouth", "tear", "extra", "body"],
    morph: {
      ...MORPH_TIME,
      ease: MORPH_EASE,
      center: [MORPH_C.x, MORPH_C.y],
      splitReach: Math.sqrt(SPLIT_REACH),
      rolePenalty: 100,
    },
    animations: Object.fromEntries(
      Object.keys(ANIM)
        .filter((k) => used.has(k))
        .map((k) => [k, packAnim(ANIM[k])]),
    ),
    modes,
  };
}

const PACK_README = `# Omi pack

Everything an app needs to draw Omi, animate every mode, and morph between
modes. Made by the Meet Omi design jig. This file describes format version
${PACK_VERSION}.

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
  eye, brow, mouth, tear, extra (props: dots, z's, confetti, arrows) or body.
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
`;

$("savePack").addEventListener("click", async () => {
  const enc = new TextEncoder(),
    file = (name, text) => ({ name: "omi-pack/" + name, data: enc.encode(text) });
  await save(
    "omi-pack.zip",
    zip([
      file("omi.json", JSON.stringify(buildPack(), null, 2) + "\n"),
      file("README.md", PACK_README),
    ]),
  );
});
