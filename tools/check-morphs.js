#!/usr/bin/env node
/* Holds the other players to the reference player on every morph there is.

   The conformance data has a handful of morphs and only requires where they
   start and land. The pack README says more: that two players which follow
   its steps draw the same morph, between any two modes and from any moment.
   This checks that, rect for rect, for every pair of modes, three ways:

     rest    from the old mode at rest
     loop    from the old mode 0.9 s into its loops
     morph   from 0.3 s into a morph to the old mode (from the mode before
             it in the pack)

   and in each, the frame 0.3 s into the morph. The reference player's
   frames are written to a file, one line each as JSON,
   [how, before, from, to, rects], with every rect [x, y, w, h, opacity,
   role], and each player replays them and compares:

     node tools/check-morphs.js            the Python and the Rust player
     node tools/check-morphs.js python     one of them
     node tools/check-morphs.js --keep     and say where the file is

   A player plays a line like this, giving frames 10 ms apart: start its
   clock at 1000 ms; jump to `from` and give a frame (for "morph", jump to
   `before`, frame, change to `from`, frame, then 0.3 s of frames); for
   "loop", 0.9 s of frames; change to `to`, give a frame at the same time,
   then 0.3 s of frames; compare its rects with the line's, in order. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");

const root = path.join(__dirname, ".."),
  Omi = require(path.join(root, "player/omi.js")),
  pack = JSON.parse(fs.readFileSync(path.join(root, "pack/omi.json"), "utf8"));

const PLAYERS = {
  python: { cwd: "player/python", run: ["python3", "tests/morphs.py"] },
  rust: {
    cwd: "player/rust",
    run: [
      "cargo",
      "run",
      "--release",
      "--quiet",
      "--locked",
      "--example",
      "morphs",
      "--",
    ],
  },
};
const args = process.argv.slice(2),
  keep = args.includes("--keep"),
  asked = args.filter((a) => a !== "--keep"),
  unknown = asked.filter((a) => !PLAYERS[a]);
if (unknown.length) {
  console.error(
    `no player "${unknown[0]}": ${Object.keys(PLAYERS).join(", ")}`,
  );
  process.exit(2);
}

// --- the reference player's frames
const ids = pack.modes.map((m) => m.id),
  num = (v) => +v.toFixed(4),
  lines = [];
for (const how of ["rest", "loop", "morph"])
  for (let i = 0; i < ids.length; i++)
    for (const to of ids) {
      const from = ids[i],
        before =
          how === "morph" ? ids[(i + ids.length - 1) % ids.length] : null;
      if (from === to) continue;
      const omi = new Omi(null, pack, { color: "#000" });
      let ms = 1000;
      const run = (seconds) => {
        for (const stop = ms + seconds * 1000; ms < stop - 1e-6;)
          omi.frame((ms += 10));
      };
      if (how === "morph") {
        omi.set(before, { instant: true });
        omi.frame(ms);
        omi.set(from);
        omi.frame(ms);
        run(0.3);
      } else {
        omi.set(from, { instant: true });
        omi.frame(ms);
        if (how === "loop") run(0.9);
      }
      omi.set(to);
      omi.frame(ms);
      run(0.3);
      const rects = omi
        .rects()
        .filter((r) => r.o > 0.001)
        .map((r) => [num(r.x), num(r.y), num(r.w), num(r.h), num(r.o), r.role]);
      lines.push(JSON.stringify([how, before, from, to, rects]));
    }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omi-morphs-")),
  file = path.join(dir, "morphs.jsonl");
fs.writeFileSync(file, lines.join("\n") + "\n");
console.log(
  `the reference player: ${lines.length} morphs (${ids.length} modes, every pair, from rest, mid-loop and mid-morph)`,
);

// --- each player against them
let failed = 0;
for (const name of asked.length ? asked : Object.keys(PLAYERS)) {
  const p = PLAYERS[name],
    out = spawnSync(p.run[0], [...p.run.slice(1), file], {
      cwd: path.join(root, p.cwd),
      encoding: "utf8",
      maxBuffer: 1 << 26,
    });
  if (out.error) {
    console.log(
      `FAIL ${name}: could not run ${p.run[0]} (${out.error.code || out.error.message})`,
    );
    failed++;
    continue;
  }
  process.stdout.write(out.stdout);
  if (out.status !== 0) {
    if (out.stderr)
      process.stdout.write(
        out.stderr.trim().split("\n").slice(-12).join("\n") + "\n",
      );
    failed++;
  }
}
if (keep) console.log(`kept: ${file}`);
else fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
