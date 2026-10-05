#!/usr/bin/env node
/* Checks the pack itself: that pack/omi.json has the shape
   pack/omi.schema.json gives it, that it hangs together, and that it keeps
   the rules Omi is drawn by (docs/designing.md), as far as a program can
   tell.

     node tools/check-pack.js

   A rule a mode breaks on purpose is argued for here, in ARGUED, with the
   reason: one line, where the next person will look. An argument nothing
   needs any more fails too, so the list stays true. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  { validate } = require("./schema.js");

const dir = path.join(__dirname, "..", "pack"),
  read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
  pack = read("omi.json"),
  schema = read("omi.schema.json");

// mode: why it may
const ARGUED = {
  // The grid: the frame sits on the logo's cells.
  grid: {
    scared:
      "the mouth its frame makes runs from the middle of one eye to the middle of the other",
  },
  // The eyes are inside the inner square at rest, so a look can keep them there.
  eyes: {
    peek: "its eyes are below the logo, looking over the ledge",
  },
  // No mouths.
  mouths: {},
};

let failed = 0,
  passed = 0;
// One rule: `problems` are sentences, each about one thing that breaks it.
function rule(name, problems) {
  if (!problems.length) {
    passed++;
    return console.log(`ok   ${name}`);
  }
  failed++;
  console.log(`FAIL ${name}`);
  for (const p of problems.slice(0, 12)) console.log(`       ${p}`);
  if (problems.length > 12)
    console.log(`       and ${problems.length - 12} more`);
}
/* A rule modes may be argued out of. `breaks(mode)` gives what a mode does
   against it (sentences); a mode in `argued` may, and has to: an argument
   for a mode that keeps the rule is a problem too. */
function argued(name, table, breaks) {
  const problems = [];
  for (const m of pack.modes) {
    const found = breaks(m);
    if (m.id in table) {
      if (!found.length)
        problems.push(
          `${m.id} keeps this rule now: take it out of ARGUED in tools/check-pack.js`,
        );
    } else for (const f of found) problems.push(`${m.id}: ${f}`);
  }
  for (const id of Object.keys(table))
    if (!pack.modes.some((m) => m.id === id))
      problems.push(`ARGUED names "${id}", which the pack doesn't have`);
  const let_off = Object.keys(table).filter((id) =>
    pack.modes.some((m) => m.id === id),
  );
  rule(
    name +
      (let_off.length
        ? ` (but ${let_off.map((id) => `${id}: ${table[id]}`).join("; ")})`
        : ""),
    problems,
  );
}
const piece = (p) => `the ${p.role} piece at ${p.x}, ${p.y} (${p.w} × ${p.h})`;

/* ---------- the shape ---------- */
// modes[3].pieces[2] reads better with the mode's name on it
const named = (at) =>
  at.replace(/^modes\[(\d+)\]/, (all, i) =>
    pack.modes[i] && pack.modes[i].id ? `${all} (${pack.modes[i].id})` : all,
  );
rule(
  "omi.json has the shape omi.schema.json gives it: every mode has a kind and a label, every reaction a hold",
  validate(schema, pack).map((p) => `${named(p.at)} ${p.message}`),
);
if (failed) {
  // the rest reads the pack as if it had its shape
  console.log("FAIL: fix the shape first");
  process.exit(1);
}

/* ---------- it hangs together ---------- */
const A = pack.animations,
  problems = [];
const ids = pack.modes.map((m) => m.id);
ids.forEach(
  (id, i) =>
    ids.indexOf(id) !== i && problems.push(`two modes are called "${id}"`),
);
if (!ids.includes("mark"))
  problems.push(
    `there is no "mark", the plain logo every morph is cut against`,
  );
for (const r of (pack.gaze || {}).roles || [])
  if (!pack.roles.includes(r))
    problems.push(`gaze.roles has "${r}", which isn't one of the roles`);
const played = new Set();
for (const m of pack.modes) {
  const play = (name, what, body) => {
    if (name == null) return;
    played.add(name);
    if (!A[name])
      problems.push(
        `${m.id}: ${what} plays "${name}", which isn't an animation`,
      );
    else if (!!A[name].body !== body)
      problems.push(
        `${m.id}: ${what} plays "${name}", which ${body ? "isn't" : "is"} one that moves the whole of Omi (body)`,
      );
  };
  play(m.anim, "the mode", true);
  if (m.clip) play(m.clip.anim, "its window", false);
  if (!m.clip && m.pieces.some((p) => p.clip))
    problems.push(
      `${m.id}: a piece is seen through a window (clip), and the mode has none`,
    );
  for (const p of m.pieces) {
    if (!pack.roles.includes(p.role))
      problems.push(
        `${m.id}: ${piece(p)} has a role that isn't one of the roles`,
      );
    play(p.anim, piece(p), false);
    // a piece's other numbers are the ones its animation reads, all of them
    const reads = (A[p.anim] && A[p.anim].vars) || [],
      has = Object.keys(p).filter(
        (k) =>
          ![
            "x",
            "y",
            "w",
            "h",
            "role",
            "opacity",
            "anim",
            "delay",
            "duration",
            "clip",
          ].includes(k),
      );
    for (const v of reads)
      if (!(v in p))
        problems.push(
          `${m.id}: ${piece(p)} plays "${p.anim}" without the ${v} it reads`,
        );
    for (const k of has)
      if (!reads.includes(k))
        problems.push(`${m.id}: ${piece(p)} has a ${k} that nothing reads`);
    if ((p.delay != null || p.duration != null) && !p.anim)
      problems.push(
        `${m.id}: ${piece(p)} has a delay or a duration and no animation`,
      );
  }
}
for (const [name, a] of Object.entries(A)) {
  if (!played.has(name)) problems.push(`nothing plays the animation "${name}"`);
  a.keys.forEach(
    ([p], i) =>
      i &&
      p <= a.keys[i - 1][0] &&
      problems.push(
        `the animation "${name}" has its keys out of order at ${p}`,
      ),
  );
  // a value read by name is one the animation says it reads
  for (const [, values] of a.keys)
    for (const v of Object.values(values))
      if (Array.isArray(v) && !(a.vars || []).includes(v[0]))
        problems.push(
          `the animation "${name}" reads ${v[0]}, which isn't in its vars`,
        );
}
const families = {};
for (const m of pack.modes)
  if (m.family) (families[m.family] = families[m.family] || []).push(m.id);
for (const [f, of] of Object.entries(families))
  if (of.length < 2)
    problems.push(
      `the family "${f}" has one mode, ${of[0]}: a family is modes that mean the same thing`,
    );
rule(
  "it hangs together: every animation, role and number a piece names is there, and nothing is left over",
  problems,
);

/* ---------- the rules Omi is drawn by ---------- */
// the reference player, without a browser: what a mode looks like at a time
const ctx = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.join(dir, "omi.js"), "utf8") + ";this.Omi = Omi;",
  ctx,
);
const omi = new ctx.Omi(null, pack, { color: "#000" }),
  shown = (m, t) => omi.modeRects(m, t).filter((r) => r.o > 0.001),
  inside = (r, [x, y, w, h]) =>
    r.x >= x - 1e-6 &&
    r.y >= y - 1e-6 &&
    r.x + r.w <= x + w + 1e-6 &&
    r.y + r.h <= y + h + 1e-6,
  grid = pack.grid,
  on = (v, step) => Math.abs(v / step - Math.round(v / step)) < 1e-9;

const mark = pack.modes.find((m) => m.id === "mark");
rule(
  "Omi is the Omarchy logo: mark is the frame alone, at rest",
  mark.pieces
    .filter((p) => p.role !== "frame" || p.anim)
    .map((p) => `${piece(p)} isn't a still piece of the frame`),
);

rule(
  "the grid: every piece sits on whole units",
  pack.modes.flatMap((m) =>
    m.pieces
      .filter((p) => ![p.x, p.y, p.w, p.h].every(Number.isInteger))
      .map((p) => `${m.id}: ${piece(p)}`),
  ),
);
argued(
  `the grid: the frame sits on the logo's ${grid}-unit cells`,
  ARGUED.grid,
  (m) =>
    m.pieces
      .filter(
        (p) =>
          p.role === "frame" &&
          ![p.x, p.y, p.x + p.w, p.y + p.h].every((v) => on(v, grid)),
      )
      .map((p) => `${piece(p)} is off the grid`),
);
const off = pack.modes
    .flatMap((m) => m.pieces)
    .filter(
      (p) =>
        p.role !== "frame" &&
        ![p.x, p.y, p.x + p.w, p.y + p.h].every((v) => on(v, grid)),
    ).length,
  rest = pack.modes
    .flatMap((m) => m.pieces)
    .filter((p) => p.role !== "frame").length;

argued(
  "no mouths: Omi reads through its eyes, brows and props",
  ARGUED.mouths,
  (m) =>
    m.pieces
      .filter((p) => p.role === "mouth")
      .map((p) => `${piece(p)} is a mouth`),
);

// through every loop, a few hundred moments of it
rule(
  "stays inside the view: the frame and the face never leave it, at rest or in any loop (props may drift off)",
  pack.modes.flatMap((m) => {
    const loop = omi.loopSeconds(m.id),
      out = new Set();
    for (let k = 0; k <= 240; k++)
      for (const r of shown(m, (loop * k) / 240))
        if (r.role !== "extra" && !inside(r, pack.view))
          out.add(
            `${m.id}: a piece of the ${r.role === "frame" ? "frame" : "face"} (${r.role}) leaves the view`,
          );
    return [...out];
  }),
);
if (pack.gaze && pack.gaze.inside)
  argued(
    "the eyes are inside the inner square at rest, so a look keeps them there (gaze.inside)",
    ARGUED.eyes,
    (m) =>
      shown(m, 0)
        .filter(
          (r) =>
            pack.gaze.roles.includes(r.role) && !inside(r, pack.gaze.inside),
        )
        .map(
          (r) =>
            `an eye at ${+r.x.toFixed(2)}, ${+r.y.toFixed(2)} (${+r.w.toFixed(2)} × ${+r.h.toFixed(2)}) is outside it`,
        ),
  );

rule(
  "bounds is the tightest box around each mode",
  pack.modes.flatMap((m) => {
    // a piece seen through the window only counts as far as the window shows it
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of m.pieces) {
      let [x, y, x2, y2] = [p.x, p.y, p.x + p.w, p.y + p.h];
      if (p.clip && m.clip) {
        [x, y, x2, y2] = [
          Math.max(x, m.clip.x),
          Math.max(y, m.clip.y),
          Math.min(x2, m.clip.x + m.clip.w),
          Math.min(y2, m.clip.y + m.clip.h),
        ];
        if (x2 - x <= 0.01 || y2 - y <= 0.01) continue;
      }
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x2);
      box[3] = Math.max(box[3], y2);
    }
    const tight = [box[0], box[1], box[2] - box[0], box[3] - box[1]];
    return tight.every((v, i) => Math.abs(v - m.bounds[i]) < 1e-9)
      ? []
      : [
          `${m.id}: bounds is ${m.bounds.join(", ")}, and its pieces fill ${tight.join(", ")}`,
        ];
  }),
);

console.log(
  `     (${rest - off} of ${rest} face and prop pieces sit on the ${grid}-unit grid too; they don't have to)`,
);
console.log(
  failed
    ? `FAIL: ${failed} of ${failed + passed} rules`
    : `ok: ${passed} rules, ${pack.modes.length} modes`,
);
process.exit(failed ? 1 : 0);
