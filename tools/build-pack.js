#!/usr/bin/env node
/* Builds the Omi pack into pack/ from the jig's own sources, without a
   browser: the same files "Export Omi pack" downloads.

     node tools/build-pack.js

   Run it after changing a mode or an animation, and commit pack/ with it. */
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
fs.mkdirSync(out, { recursive: true });
for (const [name, text] of Object.entries(files))
  fs.writeFileSync(path.join(out, name), text);
console.log(
  `pack/: ${Object.keys(files)
    .map((n) => `${n} (${(Buffer.byteLength(files[n]) / 1024).toFixed(0)} KB)`)
    .join(", ")}`,
);
