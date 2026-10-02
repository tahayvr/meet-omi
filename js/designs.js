/* ---------- easter eggs ---------- */
// a piece with its own place in its loop (dl) and anything else it needs
const withD = (r, dur, dl, extra = {}) => ({ ...r, dl, dur, ...extra });
// A 50x40 pixel heart. Each rect carries its offset from the heart's center
// (dx, dy), so the beat spreads the pixels and the whole heart scales about
// its middle.
const heart = (x, y) => {
  const hx = x + 25,
    hy = y + 20;
  return [
    R(x + 10, y, 10, 10),
    R(x + 30, y, 10, 10),
    R(x, y + 10, 50, 10),
    R(x + 10, y + 20, 30, 10),
    R(x + 20, y + 30, 10, 10),
  ].map((r) => ({
    ...r,
    c: "hb",
    dx: r.x + r.w / 2 - hx,
    dy: r.y + r.h / 2 - hy,
  }));
};
const outline = (x, y, w, h, t, c) => [
  R(x, y, w, t, c),
  R(x, y + h - t, w, t, c),
  R(x, y + t, t, h - 2 * t, c),
  R(x + w - t, y + t, t, h - 2 * t, c),
];
const CONF = Array.from({ length: 22 }, (_, i) => {
  const a = -Math.PI / 2 + (((i * 0.6180339887) % 1) - 0.5) * 2.6,
    dist = 90 + ((i * 37) % 90),
    sz = [6, 8, 10][i % 3];
  const mx = Math.round(Math.cos(a) * dist * 1.25),
    my = Math.round(Math.sin(a) * dist);
  return withD(
    R(190 - sz / 2 + ((i * 7) % 30) - 15, 45 - sz / 2, sz, sz, "conf"),
    1.6,
    (i * 0.073) % 1.6,
    { mx, my },
  );
});
const EGG = {
  party: {
    face: [...F.success, ...as("extra", CONF)],
    logo: [
      ...tint(MISC, "pop"),
      ...INNER_RECTS,
      ...tint(OUTER_RECTS, "pop"),
    ],
    mood: "m-happy",
  },
  love: {
    face: [...heart(85, 110), ...heart(165, 110)],
    mood: "",
  },
  glitch: {
    face: [R(100, 110, 20, 40, "gl"), R(180, 110, 20, 40, "gl")].map(
      (r, i) => withD(r, 2.4, 1.1 + i * 0.05),
    ),
    logo: LOGO.map((r, i) =>
      withD({ ...r, c: "gl" }, 2.4, [0, 0.9, 1.6][i % 3]),
    ),
  },
  rain: {
    face: [
      R(100, 110, 20, 40, "eye"),
      R(180, 110, 20, 40, "eye"),
      ...[
        [70, 0],
        [140, 0.5],
        [156, 0.9],
        [218, 0.3],
        [86, 1.0],
        [204, 0.7],
        [132, 0.2],
      ].map(([x, dl]) => ({
        ...withD(R(x, 60, 8, 16, "rain"), 1.4, dl),
        role: "extra",
      })),
    ],
  },
  vim: {
    face: [
      R(100, 100, 20, 20),
      R(100, 140, 20, 20),
      R(170, 100, 40, 10),
      R(170, 110, 10, 30),
      R(200, 110, 10, 60),
      R(180, 140, 20, 10),
    ],
    mood: "m-error",
  },
  tiling: {
    face: as("extra", [
      ...outline(72, 72, 70, 156, 6, "tile").map((r) => withD(r, 3, 0)),
      ...outline(152, 72, 76, 73, 6, "tile").map((r) =>
        withD(r, 3, 0.35),
      ),
      ...outline(152, 155, 76, 73, 6, "tile").map((r) =>
        withD(r, 3, 0.7),
      ),
    ]),
  },
  mindblown: {
    face: [R(80, 100, 40, 40), R(160, 100, 40, 40)],
    logo: LOGO.map((r) =>
      r.y === 0 || (r.x === 140 && r.y === 20) ? { ...r, c: "lid" } : r,
    ),
  },
};
const DESIGNS_OLD = [
  { id: "logo", name: "Logo", face: [], mood: "" },
  {
    id: "idle",
    name: "Idle",
    face: F.idle,
    mood: "m-bob",
  },
  { id: "thinking", name: "Thinking", face: F.thinking, mood: "m-bob" },
  { id: "success", name: "Success", face: F.success, mood: "m-happy" },
  { id: "error", name: "Error", face: F.error, mood: "m-error" },
  { id: "sleeping", name: "Sleeping", face: F.sleeping, mood: "m-bob" },
  { id: "wink", name: "Wink", face: F.wink, mood: "m-bob" },
  { id: "sudo", name: "Sudo", face: F.sudo, mood: "m-bob" },
  { id: "typing", name: "Typing", face: F.typing, mood: "m-bob" },
  {
    // the logo peers over a ledge: the logo and eyes sit 160 lower, seen
    // through a window that ends at the ledge, and rise into it (clip.mood)
    id: "peek",
    name: "Peek",
    clip: { x: -60, y: -130, w: 440, h: 450, mood: "peek" },
    logo: [
      ...LOGO.map((r) => ({ ...r, y: r.y + 160, clip: true })),
      { ...R(-20, 320, 340, 20), o: 1 },
      { ...R(-20, 340, 340, 20), o: 0.55 },
      { ...R(-20, 360, 340, 20), o: 0.2 },
    ],
    face: [
      { ...R(110, 250, 20, 40, "eye"), clip: true },
      { ...R(190, 250, 20, 40, "eye"), clip: true },
    ],
    mood: "",
  },
];
const G_ = (g, list) => list.map((d) => ({ ...d, group: g }));
const byId = (id) => DESIGNS_OLD.find((d) => d.id === id);
const DESIGNS = [
  ...G_("Core", [byId("idle")]),
  ...G_("Thinking", [
    byId("thinking"),
    {
      id: "thinking-drift",
      name: "Thinking, drift",
      face: F.drift,
      mood: "m-bob",
    },
    {
      id: "thinking-sideeye",
      name: "Thinking, side-eye",
      face: F.sideeye,
      mood: "m-bob",
    },
    {
      id: "thinking-hmm",
      name: "Thinking, hmm",
      face: F.hmm,
      mood: "m-bob",
    },
    {
      id: "thinking-stack",
      name: "Thinking, rising",
      face: F.stack,
      mood: "m-bob",
    },
    {
      id: "thinking-snake",
      name: "Thinking, snake",
      logo: [...LOGO_OUT, ...SNAKE],
      face: F.sideeye,
      mood: "",
    },
  ]),
  ...G_("System states", [
    {
      id: "updating",
      name: "Updating / downloading",
      face: F.updating,
      mood: "m-bob",
    },
    {
      id: "uploading",
      name: "Uploading",
      face: F.uploading,
      mood: "m-bob",
    },
    { id: "working", name: "Working", face: F.working, mood: "" },
    byId("success"),
    { id: "warning", name: "Warning", face: F.warning, mood: "m-bob" },
    byId("error"),
    {
      id: "offline-standby",
      name: "Offline, standby",
      face: F.standby,
      mood: "",
    },
    {
      id: "offline-searching",
      name: "Offline, searching",
      face: F.offline,
      mood: "",
    },
    {
      id: "low-battery",
      name: "Low battery",
      face: F.lowbat,
      mood: "m-slow",
    },
    byId("sleeping"),
  ]),
  ...G_("Omi reactions", [
    byId("typing"),
    { id: "listening", name: "Listening", face: F.listening, mood: "" },
  ]),
  ...G_("Emotions", [
    { id: "happy", name: "Happy", face: F.happy, mood: "" },
    { id: "laughing", name: "Laughing", face: F.laughing, mood: "" },
    { id: "excited", name: "Excited", face: F.excited, mood: "" },
    { id: "love", name: "Love", ...EGG.love },
    byId("wink"),
    { id: "shy", name: "Shy", face: F.shy, mood: "" },
    {
      id: "surprised",
      name: "Surprised",
      face: F.surprised,
      mood: "m-happy",
    },
    {
      id: "confused",
      name: "Confused",
      face: F.confused,
      mood: "m-bob",
    },
    { id: "skeptical", name: "Skeptical", face: F.skeptical, mood: "" },
    { id: "bored", name: "Bored", face: F.bored, mood: "" },
    { id: "sad", name: "Sad", face: F.sad, mood: "" },
    { id: "crying", name: "Crying", face: F.crying, mood: "" },
    { id: "scared", name: "Scared", face: F.scared, mood: "" },
    { id: "angry", name: "Angry", face: F.angry, mood: "" },
  ]),
  ...G_("Easter eggs", [
    byId("sudo"),
    byId("peek"),
    { id: "party", name: "Party", ...EGG.party },
    { id: "glitch", name: "Glitch", ...EGG.glitch, mood: "" },
    { id: "code-rain", name: "Code rain", ...EGG.rain, mood: "m-bob" },
    { id: "vim", name: "Can\u2019t quit vim", ...EGG.vim },
    { id: "tiling", name: "Tiling", ...EGG.tiling, mood: "" },
    {
      id: "mind-blown",
      name: "Mind blown",
      ...EGG.mindblown,
      mood: "",
    },
  ]),
];
DESIGNS.forEach((d) => {
  if (FRAMES[d.id]) d.logo = FRAMES[d.id];
});
/* Roles nobody set: what belongs to the logo is frame (anything outside the
   logo's square, like the update arrows or peek's ledge, is extra), and the
   face is eyes. See as() in geometry.js. */
const inLogo = (r) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= 300 && r.y + r.h <= 300;
const withRole = (list, role) =>
  list && list.map((r) => (r.role ? r : { ...r, role: role(r) }));
DESIGNS.forEach((d) => {
  d.logo = withRole(d.logo, (r) => (inLogo(r) ? "frame" : "extra"));
  d.face = withRole(d.face, () => "eye");
});

