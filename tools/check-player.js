#!/usr/bin/env node
/* Checks player/omi.js against pack/conformance.json, the same way a player
   in any other language should check itself (see "Checking your own player"
   in pack/README.md).

     node tools/check-player.js

   The player has to run in Qt Quick's JavaScript too (the Omarchy shell's),
   so it is also loaded where the built-ins that engine lacks are removed, and
   its source is checked for object spread, which that engine can't parse.
   tools/check-quickshell.js runs the same check inside Quickshell itself. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  checkConformance = require("./conformance.js");

const root = path.join(__dirname, ".."),
  dir = path.join(root, "pack"),
  read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
  pack = read("omi.json"),
  conf = read("conformance.json"),
  source = fs.readFileSync(path.join(root, "player/omi.js"), "utf8");

// What Qt 6's JavaScript doesn't have, as of Qt 6.11.
const QT_LACKS = [
  "Object.fromEntries",
  "Array.prototype.flat",
  "Array.prototype.flatMap",
  "Array.prototype.at",
  "String.prototype.replaceAll",
];

let failed = false;
const report = (name, { checks, fails }) => {
  if (fails.length) {
    failed = true;
    console.log(`FAIL ${name}: ${fails.length} of ${checks}:\n  ${fails.join("\n  ")}`);
  } else console.log(`ok: ${name}: ${checks} checks (${pack.modes.length} modes, ${conf.morphs.length} morphs)`);
};

// 1. As written, in Node.
report("node", checkConformance(require("../player/omi.js"), pack, conf));

// 2. Without what Qt's JavaScript lacks. The conformance data crosses into
// the context as JSON, so it is built from that context's own arrays.
const ctx = vm.createContext({});
vm.runInContext(QT_LACKS.map((p) => `delete ${p};`).join("\n"), ctx);
vm.runInContext(source, ctx, { filename: "player/omi.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "conformance.js"), "utf8"), ctx, {
  filename: "tools/conformance.js",
});
ctx.packJson = JSON.stringify(pack);
ctx.confJson = JSON.stringify(conf);
try {
  report(
    "Qt's built-ins only",
    vm.runInContext("checkConformance(Omi, JSON.parse(packJson), JSON.parse(confJson))", ctx),
  );
} catch (e) {
  failed = true;
  console.log(`FAIL Qt's built-ins only: ${e.message} (one of ${QT_LACKS.join(", ")}?)`);
}

// 3. Object spread: Qt's parser rejects { ...o } and { a, ...o }. Comments
// and strings are blanked first; this catches a spread that opens an object
// or follows a key, which is how it appears in practice.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/.*$/gm, "")
  .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
const spread = /\{\s*\.\.\.|[\w$\])]\s*,\s*\.\.\.[\w$.]+\s*\}/g;
const lines = [];
for (let m; (m = spread.exec(code)); ) lines.push(code.slice(0, m.index).split("\n").length);
if (lines.length) {
  failed = true;
  console.log(`FAIL object spread at player/omi.js line ${lines.join(", ")}: use Object.assign`);
} else console.log("ok: no object spread");

if (failed) process.exit(1);
