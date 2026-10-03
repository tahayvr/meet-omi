/* ---------- motion: every animation, as data ----------
   One definition per animation. The page's CSS and the video engine are both
   generated from this table, so the two can never drift apart, and any other
   player (an app, a terminal) only needs this table and motionAt().

   An animation loops every `dur` seconds. `keys` are [progress 0..1, values]:
     tx, ty   move, in grid units
     sx, sy   scale, about the piece's own center
     op       opacity
   As in CSS, moves and scales form one channel and opacity another. A key
   that sets any of tx/ty/sx/sy pins all four (unset ones at rest), and a
   channel with no key at 0 or 1 rests there. So a key that holds still
   mid-loop has to say so, e.g. [0.86, { tx: 0 }].
   A value can be [name, k]: that piece's own number times k (confetti's
   flight, the heart's spread). `ease` applies to every segment: a CSS name,
   a cubic-bezier [x1, y1, x2, y2], or "steps" (hold until the next key).

   Pieces opt in by name (r.c = "eye") and may carry their own `dur` and a
   lag `dl` (seconds behind the loop, to stagger a row of pieces). `body`
   animations move the whole of Omi (d.mood); everything else moves one piece.

   The rule that makes modes morph cleanly: a mode at rest IS frame 0 of its
   loops (restOf). Stills, the morph's landing pose and the loop's first
   frame are one and the same, so handing over from a morph to the loop, or
   from a still to the animation, never jumps. Loops whose natural start
   isn't a good still are started further in (START, below). */
const fade = (tail, floor) => ({
  dur: 1.6,
  ease: "linear",
  keys: [
    [0, { op: 1 }],
    [tail, { op: floor }],
    [1, { op: floor }],
  ],
});
// emotion loops pin every channel at every key
const emo = (dur, keys) => ({
  dur,
  ease: "ease-in-out",
  keys: keys.map(([p, v]) => [p, { tx: 0, ty: 0, sx: 1, sy: 1, op: 1, ...v }]),
});
const ANIM = {
  /* whole body (d.mood) */
  "m-bob": {
    body: true,
    dur: 2.8,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.5, { ty: -12 }],
      [1, { ty: 0 }],
    ],
  },
  "m-slow": {
    body: true,
    dur: 5,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.5, { ty: -12 }],
      [1, { ty: 0 }],
    ],
  },
  "m-happy": {
    body: true,
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.2, { ty: -30 }],
      [0.4, { ty: 0 }],
      [0.5, { ty: -12 }],
      [0.6, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
  "m-error": {
    body: true,
    dur: 2.2,
    ease: "ease-in-out",
    keys: [
      [0, { tx: 0 }],
      [0.7, { tx: 0 }],
      [0.74, { tx: -9 }],
      [0.8, { tx: 9 }],
      [0.86, { tx: -6 }],
      [0.92, { tx: 6 }],
      [1, { tx: 0 }],
    ],
  },
  // the logo rising over its ledge (peek's clipped layer, see d.clip)
  peek: {
    dur: 4.5,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 180 }],
      [0.25, { ty: 0 }],
      [0.75, { ty: 0 }],
      [1, { ty: 180 }],
    ],
  },

  /* eyes and face */
  eye: {
    // blink
    dur: 4,
    ease: "ease",
    keys: [
      [0, { sy: 1 }],
      [0.9, { sy: 1 }],
      [0.94, { sy: 0.1 }],
      [1, { sy: 1 }],
    ],
  },
  cur: {
    // cursor
    dur: 1.05,
    ease: "steps",
    keys: [
      [0, { op: 1 }],
      [0.5, { op: 0 }],
      [1, { op: 0 }],
    ],
  },
  dot: {
    // thinking dots; pieces stagger with dl
    dur: 1.2,
    ease: "ease",
    keys: [
      [0, { op: 0.25 }],
      [0.3, { op: 1 }],
      [1, { op: 0.25 }],
    ],
  },
  trav: {
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { tx: 0 }],
      [0.5, { tx: 40 }],
      [1, { tx: 0 }],
    ],
  },
  look: {
    dur: 3,
    ease: "ease-in-out",
    keys: [
      [0, { tx: -10 }],
      [0.5, { tx: 10 }],
      [1, { tx: -10 }],
    ],
  },
  scan: {
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { tx: -30 }],
      [0.5, { tx: 30 }],
      [1, { tx: -30 }],
    ],
  },
  pulse: {
    dur: 0.8,
    ease: "ease-in-out",
    keys: [
      [0, { sx: 1 }],
      [0.5, { sx: 1.5 }],
      [1, { sx: 1 }],
    ],
  },
  led: {
    dur: 3,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.15 }],
      [0.5, { op: 1 }],
      [1, { op: 0.15 }],
    ],
  },
  z: {
    // sleeping z's drift up; pieces stagger with dl
    dur: 2.6,
    ease: "ease-out",
    keys: [
      [0, { op: 0, tx: 0, ty: 0 }],
      [0.3, { op: 1 }],
      [1, { op: 0, tx: 10, ty: -24 }],
    ],
  },
  drop: {
    // tears
    dur: 1.2,
    ease: "ease-in-out",
    keys: [
      [0, { ty: -10, op: 0 }],
      [0.3, { ty: 0, op: 1 }],
      [0.75, { ty: 10, op: 1 }],
      [1, { ty: 20, op: 0 }],
    ],
  },
  shades: {
    dur: 3.6,
    ease: [0.2, 0.8, 0.2, 1],
    keys: [
      [0, { ty: -140, op: 0 }],
      [0.18, { ty: 0, op: 1 }],
      [0.88, { ty: 0, op: 1 }],
      [1, { ty: 0, op: 0 }],
    ],
  },

  /* emotions */
  // laughing: the mouth opens and closes, ha-ha
  ha: emo(0.7, [
    [0, { op: 1 }],
    [0.5, { op: 0.2 }],
    [1, { op: 1 }],
  ]),
  // excited: star eyes twinkle
  twinkle: emo(0.9, [
    [0, {}],
    [0.5, { sx: 1.3, sy: 1.3 }],
    [1, {}],
  ]),
  // shy: holds your gaze, glances down (lids drop), drifts away, sneaks a
  // quick peek back up, darts off again, then slowly comes back
  shy: emo(6, [
    [0, {}],
    [0.08, {}],
    [0.16, { ty: 40, sy: 0.75 }],
    [0.26, { ty: 40, sy: 0.75 }],
    [0.34, { tx: 20, ty: 50, sy: 0.7 }],
    [0.46, { tx: 20, ty: 50, sy: 0.7 }],
    [0.51, { tx: 10, ty: 20, sy: 0.9 }],
    [0.56, { tx: 10, ty: 20, sy: 0.9 }],
    [0.6, { tx: 20, ty: 50, sy: 0.7 }],
    [0.78, { tx: 20, ty: 50, sy: 0.7 }],
    [0.94, {}],
    [1, {}],
  ]),
  // skeptical: starts neutral, then one eye squints, a brow lifts, a smirk
  skq: emo(5, [
    [0, { sx: 0.5, sy: 4 }],
    [0.2, { sx: 0.5, sy: 4 }],
    [0.35, {}],
    [0.85, {}],
    [1, { sx: 0.5, sy: 4 }],
  ]),
  skb: emo(5, [
    [0, { op: 0, ty: 10 }],
    [0.2, { op: 0, ty: 10 }],
    [0.35, {}],
    [0.85, {}],
    [1, { op: 0, ty: 10 }],
  ]),
  skm: emo(5, [
    [0, { op: 0.2 }],
    [0.25, { op: 0.2 }],
    [0.4, {}],
    [0.85, {}],
    [1, { op: 0.2 }],
  ]),
  // bored: eyes wander slowly under heavy lids, then a long slow blink
  doze: emo(10, [
    [0, {}],
    [0.12, { tx: -10 }],
    [0.3, { tx: -10 }],
    [0.45, { tx: 10 }],
    [0.6, { tx: 10 }],
    [0.7, { tx: 0 }],
    [0.78, {}],
    [0.85, { sy: 0.01 }],
    [0.92, { sy: 0.01 }],
    [1, {}],
  ]),
  // scared: eyes tremble
  tremble: emo(0.25, [
    [0, { tx: -2 }],
    [0.5, { tx: 2 }],
    [1, { tx: -2 }],
  ]),
  // angry: brows press down
  furrow: emo(2, [
    [0, {}],
    [0.4, { ty: 6 }],
    [0.6, { ty: 6 }],
    [1, {}],
  ]),
  // love: each heart pixel spreads from the heart's center (dx, dy) as it
  // beats, so the whole heart scales about its middle
  hb: {
    dur: 1.2,
    ease: "ease-in-out",
    vars: ["dx", "dy"],
    keys: [
      [0, { sx: 1, sy: 1 }],
      [0.1, { tx: ["dx", 0.35], ty: ["dy", 0.35], sx: 1.35, sy: 1.35 }],
      [0.2, { sx: 1, sy: 1 }],
      [0.3, { tx: ["dx", 0.2], ty: ["dy", 0.2], sx: 1.2, sy: 1.2 }],
      [0.4, { sx: 1, sy: 1 }],
      [1, { sx: 1, sy: 1 }],
    ],
  },

  /* frame */
  // chase: a lit cell fading to a floor; pieces carry their own dur and dl
  t25: fade(0.25, 0.2),
  t30: fade(0.3, 0.2),
  t40: fade(0.4, 0.2),
  t60: fade(0.6, 0.2),
  a40: fade(0.4, 0),
  sn: {
    // snake; cells stagger with dl
    dur: 2.4,
    ease: "linear",
    keys: [
      [0, { op: 1 }],
      [0.216, { op: 0.15 }],
      [1, { op: 0.15 }],
    ],
  },
  hole: {
    // offline: frame cells drop out and come back one by one
    dur: 4,
    ease: "linear",
    keys: [
      [0, { op: 0 }],
      [0.05, { op: 1 }],
      [1, { op: 1 }],
    ],
  },
  ripple: {
    dur: 0.8,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.3 }],
      [0.2, { op: 1 }],
      [0.6, { op: 0.3 }],
      [1, { op: 0.3 }],
    ],
  },
  breathe: {
    dur: 4,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.35 }],
      [0.5, { op: 1 }],
      [1, { op: 0.35 }],
    ],
  },
  pop: {
    dur: 1.6,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0.35 }],
      [0.2, { op: 1 }],
      [0.6, { op: 0.35 }],
      [1, { op: 0.35 }],
    ],
  },
  pulseop: {
    dur: 1.2,
    ease: "ease-in-out",
    keys: [
      [0, { op: 1 }],
      [0.5, { op: 0.35 }],
      [1, { op: 1 }],
    ],
  },
  flash: {
    dur: 2.2,
    ease: "ease-in-out",
    keys: [
      [0, { op: 1 }],
      [0.7, { op: 1 }],
      [0.74, { op: 0.2 }],
      [0.8, { op: 1 }],
      [0.86, { op: 0.2 }],
      [0.92, { op: 1 }],
      [1, { op: 1 }],
    ],
  },

  /* easter eggs */
  conf: {
    // confetti flies out to its own (mx, my)
    dur: 1.6,
    ease: [0.2, 0.7, 0.3, 1],
    vars: ["mx", "my"],
    keys: [
      [0, { tx: 0, ty: 0, op: 1 }],
      [1, { tx: ["mx", 1], ty: ["my", 1], op: 0 }],
    ],
  },
  gl: {
    dur: 2.4,
    ease: "linear",
    keys: [
      [0, { tx: 0 }],
      [0.86, { tx: 0 }],
      [0.88, { tx: -8 }],
      [0.9, { tx: 6 }],
      [0.92, { tx: -3 }],
      [0.94, { tx: 0 }],
      [1, { tx: 0 }],
    ],
  },
  rain: {
    dur: 1.4,
    ease: "linear",
    keys: [
      [0, { ty: 0, op: 0 }],
      [0.1, { op: 1 }],
      [1, { ty: 160, op: 0 }],
    ],
  },
  tile: {
    dur: 3,
    ease: "ease-in-out",
    keys: [
      [0, { op: 0 }],
      [0.05, { op: 0 }],
      [0.12, { op: 1 }],
      [0.85, { op: 1 }],
      [0.95, { op: 0 }],
      [1, { op: 0 }],
    ],
  },
  /* hello: a head tilt, the eyes alone: one eye up a cell and the other
     down, swap, level again, then a quick blink. Each eye carries its own
     direction (my: -20 for the left eye, 20 for the right). */
  tilt: {
    dur: 1.6,
    ease: "ease-in-out",
    vars: ["my"],
    keys: [
      [0, { ty: 0 }],
      [0.15, { ty: ["my", 1] }],
      [0.4, { ty: ["my", 1] }],
      [0.55, { ty: ["my", -1] }],
      [0.75, { ty: ["my", -1] }],
      [0.85, { ty: 0 }],
      [0.9, { ty: 0, sy: 0.1 }],
      [0.95, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
  // goodbye: one tilt, level again, then the eyes close and stay closed
  // until the host morphs on (to the plain logo)
  farewell: {
    dur: 1.4,
    ease: "ease-in-out",
    vars: ["my"],
    keys: [
      [0, { ty: 0 }],
      [0.2, { ty: ["my", 1] }],
      [0.4, { ty: ["my", 1] }],
      [0.55, { ty: 0 }],
      [0.7, { ty: 0 }],
      [1, { ty: 0, sy: 0.1 }],
    ],
  },
  // asking: the eyes glance up at the question mark, then back
  glance: emo(3, [
    [0, {}],
    [0.3, {}],
    [0.4, { tx: 20, ty: -20 }],
    [0.7, { tx: 20, ty: -20 }],
    [0.8, {}],
    [1, {}],
  ]),
  // asking: one brow lifts with the glance
  liftb: emo(3, [
    [0, {}],
    [0.3, {}],
    [0.4, { ty: -10 }],
    [0.7, { ty: -10 }],
    [0.8, {}],
    [1, {}],
  ]),
  // attention: the eyes go to the corner where the ping is
  peekup: emo(1.2, [
    [0, {}],
    [0.15, { tx: 20, ty: -20 }],
    [0.85, { tx: 20, ty: -20 }],
    [1, {}],
  ]),
  // attention: a dot pops in at the corner (rest is the dot, popped)
  ping: {
    dur: 1.2,
    ease: "ease-out",
    keys: [
      [0, { sx: 0.2, sy: 0.2, op: 0 }],
      [0.15, { sx: 1.4, sy: 1.4, op: 1 }],
      [0.3, { sx: 1, sy: 1 }],
      [1, { sx: 1, sy: 1, op: 1 }],
    ],
  },
  // attention: four sparks fly out from the ping and fade (mx, my: how far)
  ring: {
    dur: 1.2,
    ease: "ease-out",
    vars: ["mx", "my"],
    keys: [
      [0, { tx: 0, ty: 0, op: 0 }],
      [0.15, { op: 1 }],
      [0.6, { tx: ["mx", 1], ty: ["my", 1], op: 0 }],
      [1, { tx: ["mx", 1], ty: ["my", 1], op: 0 }],
    ],
  },
  // recording: a light that blinks like a camera's
  rec: {
    dur: 1.6,
    ease: "steps",
    keys: [
      [0, { op: 1 }],
      [0.5, { op: 0.15 }],
      [1, { op: 1 }],
    ],
  },
  // nod: yes; shake: no. The eyes alone, a whole cell each way so it reads
  // at any size, the frame still.
  nod: emo(0.7, [
    [0, {}],
    [0.25, { ty: 20 }],
    [0.5, {}],
    [0.75, { ty: 20 }],
    [1, {}],
  ]),
  shake: emo(0.7, [
    [0, {}],
    [0.2, { tx: -20 }],
    [0.5, { tx: 20 }],
    [0.8, { tx: -20 }],
    [1, {}],
  ]),
  lid: {
    // mind blown: the top of the head lifts off
    dur: 2.4,
    ease: "ease-in-out",
    keys: [
      [0, { ty: 0 }],
      [0.2, { ty: 0 }],
      [0.35, { ty: -60 }],
      [0.7, { ty: -60 }],
      [0.85, { ty: 0 }],
      [1, { ty: 0 }],
    ],
  },
};

/* ---------- evaluating an animation at time t ---------- */
const MOVE = ["tx", "ty", "sx", "sy"],
  REST = { tx: 0, ty: 0, sx: 1, sy: 1, op: 1 };
const EASES = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};
function bezier([x1, y1, x2, y2]) {
  const at = (a, b, t) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (p) => {
    if (p <= 0 || p >= 1) return p;
    let lo = 0,
      hi = 1,
      t = p;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (at(x1, x2, t) < p) lo = t;
      else hi = t;
    }
    return at(y1, y2, t);
  };
}
// The keys of one channel, with rest ends where the loop doesn't set them.
function channel(a, props) {
  const ks = a.keys.filter(([, v]) => props.some((q) => q in v));
  if (!ks.length) return null;
  if (ks[0][0] > 0) ks.unshift([0, {}]);
  if (ks[ks.length - 1][0] < 1) ks.push([1, {}]);
  return ks;
}
function prep(a) {
  a.fn =
    a.ease === "steps"
      ? (p) => (p >= 1 ? 1 : 0)
      : bezier(Array.isArray(a.ease) ? a.ease : EASES[a.ease]);
  a.move = channel(a, MOVE);
  a.fade = channel(a, ["op"]);
  return a;
}
const keyVal = (v, q, r) =>
  v == null ? REST[q] : Array.isArray(v) ? (r[v[0]] || 0) * v[1] : v;
const loopPhase = (t, dur, dl = 0) => ((((t - dl) / dur) % 1) + 1) % 1;
// An animation at progress p (0..1).
function sample(a, p, r = {}) {
  const out = { ...REST };
  for (const [ks, props] of [
    [a.move, MOVE],
    [a.fade, ["op"]],
  ]) {
    if (!ks) continue;
    let i = 1;
    while (i < ks.length - 1 && p > ks[i][0]) i++;
    const [p0, v0] = ks[i - 1],
      [p1, v1] = ks[i],
      k = p1 === p0 ? 1 : a.fn((p - p0) / (p1 - p0));
    props.forEach((q) => {
      const A = keyVal(v0[q], q, r),
        B = keyVal(v1[q], q, r);
      out[q] = A + (B - A) * k;
    });
  }
  return out;
}
/* Start a loop `by` of the way in. The keys keep their timing, they just
   begin elsewhere, so pick a point where every channel has a key (or holds
   still) and the curve is unchanged. */
function rotate(a, by) {
  const wrap = (p) => +((((p - by) % 1) + 1) % 1).toFixed(6),
    qs = [...new Set([0, 1, ...a.keys.map(([p]) => wrap(p))])].sort(
      (x, y) => x - y,
    ),
    keyed = (ks, p) =>
      ks && ks.some(([kp]) => Math.abs(kp - p) < 1e-6 || Math.abs(kp - p - 1) < 1e-6);
  return {
    ...a,
    keys: qs.map((q) => {
      const p = q === 1 ? by : (q + by) % 1,
        s = sample(a, p),
        v = {},
        edge = q === 0 || q === 1;
      if (a.move && (edge || keyed(a.move, p))) MOVE.forEach((k) => (v[k] = s[k]));
      if (a.fade && (edge || keyed(a.fade, p))) v.op = s.op;
      return [q, v];
    }),
  };
}
Object.values(ANIM).forEach(prep);
// where each loop starts, so its first frame is the pose it rests in
const START = {
  peek: 0.25, // risen, looking over the ledge
  shades: 0.18, // on
  skq: 0.4, // the full skeptical look (all three move together)
  skb: 0.4,
  skm: 0.4,
  drop: 0.3, // a tear on the cheek
  tile: 0.12, // window drawn
  dot: 0.3, // lit
  pop: 0.2, // bright
  breathe: 0.5,
  led: 0.5,
  ripple: 0.2,
  ping: 0.3, // popped
  ring: 0.15, // the sparks just lit, still at the ping
};
for (const [k, by] of Object.entries(START)) ANIM[k] = prep(rotate(ANIM[k], by));
/* How a piece looks t seconds in: { tx, ty, sx, sy, op } on top of its rest
   pose. r supplies the piece's own dl, dur and vars. */
function motionAt(name, t, r = {}) {
  const a = ANIM[name];
  if (!a) return { ...REST };
  return sample(a, loopPhase(t, r.dur || a.dur, r.dl || 0), r);
}
// A piece at rest: frame 0 of its loop, baked into a plain rect.
function restOf(r) {
  const { c, dl, dur, ...rest } = r;
  if (!c || !ANIM[c]) return rest;
  const m = motionAt(c, 0, r),
    w = r.w * m.sx,
    h = r.h * m.sy,
    o = (r.o ?? 1) * m.op;
  return {
    ...rest,
    x: +(r.x + r.w / 2 - w / 2 + m.tx).toFixed(4),
    y: +(r.y + r.h / 2 - h / 2 + m.ty).toFixed(4),
    w: +w.toFixed(4),
    h: +h.toFixed(4),
    ...(o !== 1 || r.o != null ? { o: +o.toFixed(4) } : {}),
  };
}

/* ---------- the same table, as CSS ---------- */
const easeCSS = (e) =>
  e === "steps"
    ? "steps(1)"
    : Array.isArray(e)
      ? `cubic-bezier(${e.join(",")})`
      : e;
function animCSS(name, a) {
  const num = (v) =>
    Array.isArray(v)
      ? `calc(var(--${v[0]}) * ${v[1]}px)`
      : `${+v.toFixed(4)}px`;
  const frames = a.keys
    .map(([p, v]) => {
      const d = [];
      if (MOVE.some((q) => q in v))
        d.push(
          `transform:translate(${num(v.tx ?? 0)},${num(v.ty ?? 0)}) scale(${v.sx ?? 1},${v.sy ?? 1})`,
        );
      if ("op" in v) d.push(`opacity:${v.op}`);
      return `${+(p * 100).toFixed(2)}%{${d.join(";")}}`;
    })
    .join("");
  return `@keyframes omi-${name}{${frames}}\n.omi-a .${name}{animation:omi-${name} ${a.dur}s ${easeCSS(a.ease)} infinite}`;
}
// A piece's own timing and vars, as an inline style.
function pieceStyle(r) {
  const a = r.c && ANIM[r.c];
  if (!a) return "";
  const dur = r.dur || a.dur,
    s = [];
  if (dur !== a.dur) s.push(`animation-duration:${dur}s`);
  // run dl seconds behind the loop, as motionAt does (a negative delay, so
  // it is already mid-loop on the first frame instead of waiting)
  if (r.dl) s.push(`animation-delay:${((r.dl % dur) - dur).toFixed(3)}s`);
  (a.vars || []).forEach((v) => s.push(`--${v}:${r[v]}`));
  return s.join(";");
}
