/* ---------- geometry (20-unit grid of the Omarchy logo) ---------- */
const R = (x, y, w, h, c) => ({ x, y, w, h, c });
/* Every piece has a role, so a morph knows what may become what and an app
   knows what it is drawing:
     frame  the logo, including the mouths it makes and the lights that run
            around it
     eye    whatever sits where the eyes are (eyes, X's, hearts, shades)
     brow, mouth, tear
     extra  props around the face: thinking dots, z's, confetti, arrows
   Logo pieces default to frame and face pieces to eye (see the end of
   designs.js); as() labels the rest. */
const as = (role, rects) => rects.map((r) => ({ ...r, role }));
const LOGO = [
  [0, 0, 300, 20],
  [0, 20, 20, 260],
  [280, 20, 20, 260],
  [0, 280, 160, 20],
  [180, 280, 120, 20],
  [140, 20, 20, 20],
  [40, 40, 120, 20],
  [220, 40, 40, 20],
  [40, 60, 20, 180],
  [240, 60, 20, 180],
  [40, 240, 220, 20],
  [20, 140, 20, 20],
  [140, 260, 20, 20],
].map((a) => ({ ...R(...a), role: "frame" }));
const blk = (cx, cy, pts, c) =>
  pts.map(([dx, dy]) => R(cx + dx * 20, cy + dy * 20, 20, 20, c));
const cellsOf = (path, extra = () => ({})) =>
  path.map(([x, y], i) => ({ ...R(x, y, 20, 20), ...extra(i, x, y) }));
// a light running along a path: each cell lags the one before it
function chase(path, dur, tail, offset = 0) {
  const N = path.length,
    c = "t" + Math.round(tail * 100);
  return cellsOf(path, (i) => ({
    c,
    dur,
    dl: ((i / N) * dur + offset) % dur,
  }));
}
const Z = (x, y, s, dl = 0) => {
  const t = s / 4;
  return [
    R(x, y, s, t, "z"),
    R(x + s - 2 * t, y + t, t, t, "z"),
    R(x + t, y + s - 2 * t, t, t, "z"),
    R(x, y + s - t, s, t, "z"),
  ].map((r) => ({ ...r, role: "extra", ...(dl ? { dl } : {}) }));
};
const F = {
  idle: [R(100, 110, 20, 40, "eye"), R(180, 110, 20, 40, "eye")],
  thinking: [
    R(120, 90, 20, 40, "eye"),
    R(200, 90, 20, 40, "eye"),
    ...as("extra", [
      R(160, 40, 20, 20, "dot"),
      { ...R(180, 40, 20, 20, "dot"), dl: 0.2 },
      { ...R(200, 40, 20, 20, "dot"), dl: 0.4 },
    ]),
  ],
  success: [
    ...blk(80, 130, [
      [0, 0],
      [1, -1],
      [2, 0],
    ]),
    ...blk(160, 130, [
      [0, 0],
      [1, -1],
      [2, 0],
    ]),
  ],
  error: [
    ...blk(80, 100, [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ]),
    ...blk(160, 100, [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ]),
  ],
  sleeping: [
    R(80, 144, 40, 12, "breathe"),
    R(160, 144, 40, 12, "breathe"),
    ...Z(318, -20, 16),
    ...Z(340, -62, 24, 0.87),
    ...Z(370, -114, 32, 1.73),
  ],
  wink: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    R(160, 140, 40, 20, "cur"),
  ],
  sudo: [
    R(80, 110, 60, 40, "shades"),
    R(140, 110, 20, 20, "shades"),
    R(160, 110, 60, 40, "shades"),
  ],
  typing: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    R(180, 100, 20, 60, "cur"),
  ],
};
const ARROW = [
  R(185, 20, 10, 22, "arrow"),
  R(171, 36, 38, 8, "arrow"),
  R(179, 44, 22, 8, "arrow"),
  R(187, 52, 6, 6, "arrow"),
];
const BANG = [
  R(185, 22, 10, 22, "pulseop"),
  R(185, 48, 10, 10, "pulseop"),
];
const QMARK = [
  R(178, 22, 26, 7, "pulseop"),
  R(197, 22, 7, 18, "pulseop"),
  R(186, 33, 18, 7, "pulseop"),
  R(186, 33, 7, 12, "pulseop"),
  R(186, 51, 7, 7, "pulseop"),
];
Object.assign(F, {
  drift: [
    R(120, 90, 20, 40, "eye"),
    R(200, 90, 20, 40, "eye"),
    { ...R(160, 40, 20, 20, "trav"), role: "extra" },
  ],
  sideeye: [R(100, 90, 20, 40, "look"), R(180, 90, 20, 40, "look")],
  hmm: [R(80, 90, 20, 40, "eye"), R(160, 90, 20, 40, "eye")],
  stack: [R(120, 90, 20, 40, "eye"), R(200, 90, 20, 40, "eye")],
  updating: [R(100, 160, 20, 40, "eye"), R(180, 160, 20, 40, "eye")],
  uploading: [R(100, 80, 20, 40, "eye"), R(180, 80, 20, 40, "eye")],
  working: [R(100, 110, 20, 40, "scan"), R(180, 110, 20, 40, "scan")],
  warning: [
    R(100, 80, 20, 40),
    R(100, 140, 20, 20),
    R(180, 80, 20, 40),
    R(180, 140, 20, 20),
  ],
  offline: [R(80, 140, 40, 10), R(160, 140, 40, 10)],
  standby: [R(140, 140, 20, 20, "led")],
  hollow: [
    R(100, 110, 20, 5),
    R(100, 145, 20, 5),
    R(100, 115, 5, 30),
    R(115, 115, 5, 30),
    R(180, 110, 20, 5),
    R(180, 145, 20, 5),
    R(180, 115, 5, 30),
    R(195, 115, 5, 30),
  ],
  lowbat: [R(100, 200, 20, 20), R(180, 200, 20, 20)],
  listening: [
    R(100, 110, 20, 40, "pulse"),
    R(180, 110, 20, 40, "pulse"),
  ],
  // a question mark where the eyes were
  confused: as("extra", [
    ...chase(
      [
        [100, 100],
        [120, 80],
        [140, 80],
        [160, 80],
        [180, 100],
        [180, 120],
        [160, 140],
        [140, 140],
        [140, 160],
      ],
      1.8,
      0.6,
    ),
    R(140, 200, 20, 20, "pulseop"),
  ]),
  surprised: [R(80, 100, 40, 40), R(160, 100, 40, 40)],
  wink: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    R(160, 140, 40, 20, "cur"),
  ],
});
/* snake: inner frame split into 20-unit cells, in path order from the top gap clockwise */
const INNER = new Set([
  "40,40,120,20",
  "220,40,40,20",
  "40,60,20,180",
  "240,60,20,180",
  "40,240,220,20",
]);
const LOGO_OUT = LOGO.filter(
  (r) => !INNER.has([r.x, r.y, r.w, r.h].join()),
);
const SNAKE_PATH = [
  [220, 40],
  [240, 40],
  ...[60, 80, 100, 120, 140, 160, 180, 200, 220].map((y) => [240, y]),
  [240, 240],
  ...[220, 200, 180, 160, 140, 120, 100, 80, 60, 40].map((x) => [
    x,
    240,
  ]),
  ...[220, 200, 180, 160, 140, 120, 100, 80, 60].map((y) => [40, y]),
  ...[40, 60, 80, 100, 120, 140].map((x) => [x, 40]),
];
const SNAKE_N = SNAKE_PATH.length,
  SNAKE_DUR = 2.4;
const SNAKE = SNAKE_PATH.map(([x, y], i) => ({
  ...R(x, y, 20, 20, "sn"),
  dl: (i / SNAKE_N) * SNAKE_DUR,
}));

/* emotions: eyes only (plus brows and tears). The mouth, when there is one,
   is the inner frame's bottom; see mouth() in frames.js. Animated faces rest
   on the full expression, so stills and PNG exports read correctly. */
Object.assign(F, {
  happy: F.idle,
  laughing: [
    ...blk(90, 100, [
      [0, 0],
      [1, 1],
      [0, 2],
    ]),
    ...blk(170, 100, [
      [1, 0],
      [0, 1],
      [1, 2],
    ]),
  ],
  excited: [
    R(100, 110, 20, 40, "twinkle"),
    R(90, 120, 40, 20, "twinkle"),
    R(180, 110, 20, 40, "twinkle"),
    R(170, 120, 40, 20, "twinkle"),
  ],
  shy: [R(100, 110, 20, 40, "shy"), R(180, 110, 20, 40, "shy")],
  skeptical: [
    R(90, 125, 40, 10, "skq"),
    { ...R(170, 90, 40, 10, "skb"), role: "brow" },
    R(180, 110, 20, 40, "eye"),
  ],
  bored: [
    R(90, 130, 40, 10),
    R(100, 140, 20, 10, "doze"),
    R(170, 130, 40, 10),
    R(180, 140, 20, 10, "doze"),
  ],
  // worried brows, inner ends raised
  sad: [
    ...as("brow", [
      R(90, 110, 20, 10),
      R(110, 100, 20, 10),
      R(170, 100, 20, 10),
      R(190, 110, 20, 10),
    ]),
    R(100, 130, 20, 30, "eye"),
    R(180, 130, 20, 30, "eye"),
    { ...R(100, 170, 10, 10, "drop"), role: "tear" },
  ],
  // closed eyes tilted inward: outer ends low, inner ends high
  crying: [
    R(90, 140, 20, 10),
    R(110, 130, 20, 10),
    R(170, 130, 20, 10),
    R(190, 140, 20, 10),
    ...as("tear", [R(95, 160, 10, 10, "drop"), R(195, 160, 10, 10, "drop")]),
  ],
  scared: [R(100, 110, 20, 20, "tremble"), R(180, 110, 20, 20, "tremble")],
  angry: [
    ...as("brow", [
      R(80, 100, 20, 10, "furrow"),
      R(100, 110, 20, 10, "furrow"),
      R(200, 100, 20, 10, "furrow"),
      R(180, 110, 20, 10, "furrow"),
    ]),
    R(100, 130, 20, 30),
    R(180, 130, 20, 30),
  ],
});
