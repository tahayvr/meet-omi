/* ---------- frame effects: whole frame parts animate with the eyes ---------- */
const OUTER_RECTS = LOGO.slice(0, 5),
  INNER_RECTS = LOGO.filter((r) =>
    INNER.has([r.x, r.y, r.w, r.h].join()),
  );
const MISC = LOGO.filter(
  (r) => !OUTER_RECTS.includes(r) && !INNER_RECTS.includes(r),
);
const range = (a, b, s = 20) => {
  const o = [];
  for (let v = a; s > 0 ? v <= b : v >= b; v += s) o.push(v);
  return o;
};
const OUT_PATH = [
  ...range(0, 280).map((x) => [x, 0]),
  ...range(20, 280).map((y) => [280, y]),
  ...range(260, 180, -20).map((x) => [x, 280]),
  ...range(140, 20, -20).map((x) => [x, 280]),
  ...range(280, 20, -20).map((y) => [0, y]),
];
const tint = (rects, c, s) =>
  rects.map((r) => ({ ...r, c, ...(s ? { s } : {}) }));
/* growth: frame streams flow into a growing arrow, one continuous motion */
function grow(paths, arrow, dt = 0.06, D = 2.8, tail = 0.4) {
  const mk = (x, y, w, hh, k, floor) => {
    const dl = k * dt;
    return {
      ...R(x, y, w, hh, floor ? "t40" : "a40"),
      chase: true,
      dur: D,
      dl,
      tail,
      floor,
      s: `--dur:${D}s;--d:${(dl - D).toFixed(3)}s`,
    };
  };
  const out = [];
  paths.forEach((p) =>
    p.forEach(([x, y], k) => out.push(mk(x, y, 20, 20, k, 0.2))),
  );
  const start = Math.max(...paths.map((p) => p.length));
  arrow.forEach(([x, y, w, hh], k) =>
    out.push(mk(x, y, w, hh, start + k, 0)),
  );
  return out;
}
const UP_L = [
  ...range(140, 20, -20).map((x) => [x, 280]),
  [0, 280],
  ...range(260, 20, -20).map((y) => [0, y]),
  [0, 0],
  ...range(20, 140).map((x) => [x, 0]),
];
const UP_R = [
  ...range(180, 260).map((x) => [x, 280]),
  [280, 280],
  ...range(260, 20, -20).map((y) => [280, y]),
  [280, 0],
  ...range(260, 160, -20).map((x) => [x, 0]),
];
const DN_L = UP_L.slice().reverse(),
  DN_R = UP_R.slice().reverse();
const FRAMES = {
  updating: [
    ...MISC.map((r) => (r.y >= 260 ? r : { ...r, o: 0.2 })),
    ...INNER_RECTS,
    ...grow(
      [DN_L, DN_R],
      [
        [140, 300, 20, 20],
        [100, 320, 100, 20],
        [120, 340, 60, 20],
        [140, 360, 20, 20],
      ],
    ),
  ],
  uploading: [
    ...MISC.map((r) => (r.y <= 20 ? r : { ...r, o: 0.2 })),
    ...INNER_RECTS,
    ...grow(
      [UP_L, UP_R],
      [
        [140, -20, 20, 20],
        [100, -40, 100, 20],
        [120, -60, 60, 20],
        [140, -80, 20, 20],
      ],
    ),
  ],
  working: [...MISC, ...INNER_RECTS, ...chase(OUT_PATH, 1.6, 0.25)],
  success: [
    ...tint(MISC, "pop"),
    ...INNER_RECTS,
    ...tint(OUTER_RECTS, "pop"),
  ],
  warning: [
    ...tint(MISC, "pulseop"),
    ...INNER_RECTS,
    ...tint(OUTER_RECTS, "pulseop"),
  ],
  "offline-searching": [
    ...MISC,
    ...INNER_RECTS,
    ...cellsOf(OUT_PATH, (i) => ({
      hole: true,
      dur: 4,
      dl: (i / OUT_PATH.length) * 4,
      c: "hole",
      s: `--d:${((i / OUT_PATH.length) * 4 - 4).toFixed(3)}s`,
    })),
  ],
  "thinking-stack": [
    MISC[0],
    MISC[2],
    { ...MISC[1], o: 0.2 },
    ...cellsOf(range(20, 260).map((x) => [x, 0])),
    ...cellsOf(
      [...range(20, 140), ...range(180, 260)].map((x) => [x, 280]),
    ),
    ...chase(
      range(280, 0, -20).map((y) => [0, y]),
      1.6,
      0.4,
    ),
    ...chase(
      range(280, 0, -20).map((y) => [280, y]),
      1.6,
      0.4,
    ),
    ...cellsOf([
      ...range(40, 140).map((x) => [x, 40]),
      [220, 40],
      [240, 40],
      ...range(40, 240).map((x) => [x, 240]),
    ]),
    ...chase(
      range(220, 60, -20).map((y) => [40, y]),
      1.6,
      0.4,
      0.5,
    ),
    ...chase(
      range(220, 60, -20).map((y) => [240, y]),
      1.6,
      0.4,
      0.5,
    ),
  ],
  "thinking-hmm": [
    ...MISC,
    ...INNER_RECTS,
    ...cellsOf([
      ...range(100, 280).map((x) => [x, 0]),
      ...range(20, 280).map((y) => [280, y]),
      ...range(260, 180, -20).map((x) => [x, 280]),
      ...range(140, 0, -20).map((x) => [x, 280]),
      ...range(260, 100, -20).map((y) => [0, y]),
    ]),
    ...chase(
      [
        [0, 80],
        [0, 60],
        [0, 40],
        [0, 20],
        [0, 0],
        [20, 0],
        [40, 0],
        [60, 0],
        [80, 0],
      ],
      1.6,
      0.4,
    ),
  ],
  "low-battery": [
    ...MISC.map((r) => (r.y >= 260 ? r : { ...r, o: 0.2 })),
    ...INNER_RECTS,
    ...cellsOf(OUT_PATH, (i, x, y) =>
      y >= 260 ? (y === 260 ? { c: "pulseop" } : {}) : { o: 0.2 },
    ),
  ],
  sleeping: [
    ...tint(MISC, "breathe"),
    ...tint(INNER_RECTS, "breathe"),
    ...tint(OUTER_RECTS, "breathe"),
  ],
  listening: [
    MISC[0],
    MISC[2],
    ...tint([MISC[1]], "ripple", "--d:.1s").map((r) => ({
      ...r,
      dl: 0.1,
    })),
    ...INNER_RECTS.filter((r) => r.w !== 20),
    ...tint(
      INNER_RECTS.filter((r) => r.w === 20),
      "ripple",
      "--d:0s",
    ),
    ...OUTER_RECTS.filter((r) => r.w !== 20),
    ...tint(
      OUTER_RECTS.filter((r) => r.w === 20),
      "ripple",
      "--d:.2s",
    ).map((r) => ({ ...r, dl: 0.2 })),
  ],
  typing: [
    ...MISC,
    ...INNER_RECTS,
    ...cellsOf([
      ...range(0, 280).map((x) => [x, 0]),
      ...range(20, 260).map((y) => [280, y]),
      ...range(20, 260).map((y) => [0, y]),
    ]),
    ...chase(
      [...range(0, 140), ...range(180, 280)].map((x) => [x, 280]),
      1.6,
      0.3,
    ),
  ],
  surprised: [
    ...tint(MISC, "pop"),
    ...INNER_RECTS,
    ...tint(OUTER_RECTS, "pop"),
  ],
};
