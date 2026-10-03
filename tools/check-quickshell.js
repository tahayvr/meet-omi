#!/usr/bin/env node
/* Runs the conformance check inside Quickshell, the Qt Quick runtime behind
   the Omarchy shell, so the player is proven in the engine Omarchy apps use,
   not just in Node.

     node tools/check-quickshell.js

   Needs quickshell and a Wayland session (it opens no window). Skipped, not
   failed, without them. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");

const root = path.join(__dirname, ".."),
  has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;

if (!has("quickshell") || !process.env.WAYLAND_DISPLAY) {
  console.log("skipped: needs quickshell and a Wayland session");
  process.exit(0);
}

// A throwaway Quickshell config: the player, the check and the pack side by side.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omi-qs-"));
for (const [from, to] of [
  ["player/omi.js", "omi.js"],
  ["tools/conformance.js", "conformance.js"],
  ["pack/omi.json", "omi.json"],
  ["pack/conformance.json", "conformance.json"],
])
  fs.copyFileSync(path.join(root, from), path.join(dir, to));
fs.writeFileSync(
  path.join(dir, "shell.qml"),
  `import QtQuick
import Quickshell
import Quickshell.Io
import "omi.js" as OmiJs
import "conformance.js" as Check

ShellRoot {
    FileView { id: pack; path: "${dir}/omi.json"; blockLoading: true }
    FileView { id: conf; path: "${dir}/conformance.json"; blockLoading: true }
    Timer {
        interval: 1
        running: true
        onTriggered: {
            let out;
            try {
                out = Check.checkConformance(OmiJs.Omi, JSON.parse(pack.text()), JSON.parse(conf.text()));
            } catch (e) {
                out = { checks: 0, fails: [String(e)] };
            }
            console.log("OMI-CHECK " + JSON.stringify(out));
            Qt.quit();
        }
    }
}
`,
);

const run = spawnSync("quickshell", ["-p", path.join(dir, "shell.qml")], {
  encoding: "utf8",
  timeout: 60000,
});
fs.rmSync(dir, { recursive: true, force: true });
const log = `${run.stdout}${run.stderr}`.replace(/\x1b\[[0-9;]*m/g, ""),
  line = log.split("\n").find((l) => l.includes("OMI-CHECK "));

if (!line) {
  // The player didn't load: show why (a syntax error names the line).
  console.log(`FAIL quickshell: the check didn't run\n${log.split("\n").filter((l) => /ERROR|WARN/.test(l)).join("\n")}`);
  process.exit(1);
}
const { checks, fails } = JSON.parse(line.slice(line.indexOf("OMI-CHECK ") + 10));
if (fails.length) {
  console.log(`FAIL quickshell: ${fails.length} of ${checks}:\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log(`ok: quickshell: ${checks} checks`);
