#!/usr/bin/env node
/* Builds the Omi pack into pack/ from the jig's own sources, without a
   browser: the same files "Export Omi pack" downloads, and the same pack
   the site plays (tools/check-site.js holds the site to it).

     node tools/build-pack.js           write pack/
     node tools/build-pack.js --check   fail if pack/ isn't what it would write

   pack/ is what gets released, so it carries a copy of the player:
   player/omi.js is the source, pack/omi.js is built from it. Edit the
   source, never the copy. Run it after changing a mode, an animation or the
   player, and commit pack/ with it. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");

const root = path.join(__dirname, ".."),
  out = path.join(root, "pack");
// the jig's scripts, in the page's order, minus the ones that need a page
const SOURCES = [
  "js/motion.js",
  "js/geometry.js",
  "js/frames.js",
  "js/designs.js",
  "js/render.js",
  "player/omi.js",
  "js/pack.js",
];

// just enough of a browser for those scripts to load
const ctx = vm.createContext({
  console,
  document: {
    createElement: () => ({}),
    head: { appendChild() {} },
  },
});
for (const f of SOURCES)
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, {
    filename: f,
  });

const files = vm.runInContext("packFiles()", ctx);
files["omi.js"] = fs.readFileSync(path.join(root, "player/omi.js"), "utf8");

if (process.argv.includes("--check")) {
  const stale = Object.keys(files).filter((name) => {
    const file = path.join(out, name);
    return !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== files[name];
  });
  for (const name of stale) console.log(`FAIL pack/${name} is out of date`);
  if (stale.length) {
    console.log("run node tools/build-pack.js and commit pack/");
    process.exit(1);
  }
  console.log(`ok: pack/ is up to date (${Object.keys(files).join(", ")})`);
  process.exit(0);
}

fs.mkdirSync(out, { recursive: true });
for (const [name, text] of Object.entries(files))
  fs.writeFileSync(path.join(out, name), text);
console.log(
  `pack/: ${Object.keys(files)
    .map((n) => `${n} (${(Buffer.byteLength(files[n]) / 1024).toFixed(0)} KB)`)
    .join(", ")}`,
);
