#!/usr/bin/env node
/* Checks player/omi.js against pack/conformance.json, the same way a player
   in any other language should check itself (see "Checking your own player"
   in pack/README.md).

     node tools/check-player.js */
const fs = require("fs"),
  path = require("path"),
  Omi = require("../player/omi.js");

const dir = path.join(__dirname, "..", "pack"),
  read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
  pack = read("omi.json"),
  conf = read("conformance.json"),
  { position: tp, opacity: to } = conf.tolerance;

const canvas = {
    width: 1,
    height: 1,
    getContext: () => ({ setTransform() {}, clearRect() {}, fillRect() {} }),
  },
  omi = new Omi(canvas, pack, { color: "#000" }),
  row = (r) => [r.x, r.y, r.w, r.h, r.o, r.role],
  shown = (list) => list.filter((r) => r.o > 0.001).map(row);

const same = (a, b) =>
  a.length === 6 &&
  [0, 1, 2, 3].every((i) => Math.abs(a[i] - b[i]) <= tp) &&
  Math.abs(a[4] - b[4]) <= to &&
  a[5] === b[5];
// in drawing order
const sameList = (a, b) => a.length === b.length && a.every((r, i) => same(r, b[i]));
// in any order: every expected rect is matched by a different drawn one
const sameSet = (a, b) => {
  const left = [...a];
  return (
    a.length === b.length &&
    b.every((r) => {
      const i = left.findIndex((q) => same(q, r));
      return i >= 0 && left.splice(i, 1);
    })
  );
};

const fails = [];
let checks = 0;
for (const m of pack.modes)
  for (const [t, want] of Object.entries(conf.modes[m.id] || {})) {
    checks++;
    if (!sameList(shown(omi.modeRects(m, +t)), want))
      fails.push(`${m.id} at ${t}s`);
  }
for (const c of conf.morphs) {
  omi.set(c.from, { instant: true });
  checks++;
  if (!sameSet(shown(omi.rects()), c.start)) fails.push(`${c.from} > ${c.to}: start`);
  omi.set(c.to);
  let ms = 1000;
  omi.frame(ms);
  while (omi.morph && ms < 1000 + conf.morph_seconds * 1000 + 1000)
    omi.frame((ms += 10));
  checks++;
  if (!sameSet(shown(omi.rects()), c.end)) fails.push(`${c.from} > ${c.to}: end`);
}
omi.destroy();

if (fails.length) {
  console.log(`FAIL ${fails.length} of ${checks}:\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log(`ok: ${checks} checks (${pack.modes.length} modes, ${conf.morphs.length} morphs)`);
