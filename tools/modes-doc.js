#!/usr/bin/env node
/* Writes docs/modes.md, the gallery of every mode in the pack, and a still
   of each one as an SVG in docs/modes/ (plus docs/modes/sheet.svg, all of
   them on one sheet), from pack/omi.json through the reference player.

     node tools/modes-doc.js

   Run it after tools/build-pack.js whenever a mode changes, and commit
   docs/ with it. The "Use it for" column is written here, by hand: it is
   what a mode means to an app, which the pack can't say. */
const fs = require("fs"),
  path = require("path"),
  vm = require("vm");

const root = path.join(__dirname, ".."),
  pack = JSON.parse(fs.readFileSync(path.join(root, "pack/omi.json"), "utf8")),
  outDir = path.join(root, "docs/modes");

// the reference player, without a browser
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "pack/omi.js"), "utf8") + ";this.Omi = Omi;", ctx);
const omi = new ctx.Omi(null, pack, { color: "#000" });

// What each mode is for, in an app. Reactions say "then back".
const USE = {
  mark: "The plain logo: a brand mark, and the entrance (set idle from it)",
  idle: "Nothing going on",
  thinking: "Checking, loading, waiting on the network",
  "thinking-drift": "A variation of thinking for a long wait",
  "thinking-sideeye": "A variation of thinking, with a glance aside",
  "thinking-hmm": "A variation of thinking: weighing something",
  "thinking-stack": "A variation of thinking: something building up",
  "thinking-snake": "A variation of thinking that fits a terminal (an easter egg of sorts)",
  updating: "Downloading or installing",
  uploading: "Sending something away",
  working: "Busy doing it for the user",
  success: "Done, then back",
  warning: "Something needs a look, but nothing is broken",
  error: "Failed: as a reaction, or the mode while it stays failed",
  "offline-standby": "Offline and not trying",
  "offline-searching": "Offline, looking for a network",
  "low-battery": "The battery is low",
  sleeping: "Paused, put off until later, or the night light",
  typing: "The user is typing, or something is being written for them",
  listening: "Waiting for the user to press a key",
  happy: "Pleased, then back",
  laughing: "A joke landed, then back",
  excited: "Something good is about to happen (a theme picker, a download that's nearly done)",
  love: "A favourite, a thank-you, then back",
  wink: "A small aside, then back",
  shy: "A compliment received, then back",
  surprised: "Something unexpected, then back",
  confused: "Not sure what happened; a stall",
  skeptical: "Doubt: an odd input, an unusual request",
  bored: "Nothing has happened for a long while",
  sad: "Something was lost; never for a cancel or a skip",
  crying: "Something went badly; never to guilt the user",
  scared: "A risky action is about to run, then back",
  angry: "Blocked by something outside the user's control",
  sudo: "About to ask for a password",
  peek: "Looking in from the edge: a hint, a quick check-in",
  party: "A real milestone, like finishing setup",
  glitch: "An easter egg: something went strange",
  "code-rain": "An easter egg for the terminal",
  vim: "An easter egg: can't quit vim",
  tiling: "Windows being arranged (the Omarchy tiling tutorial)",
  "mind-blown": "Something impressive just happened, then back",
  hello: "A greeting: first boot, a first open, then back",
  goodbye: "Logout, shutdown, reboot: a tilt and the eyes close, then the host shows the plain logo",
  asking: "Waiting for the user to decide: an agent wants approval, a dialog needs an answer",
  attention: "A ping: a notification arrived, a background job finished, then back",
  recording: "The screen is being shared or recorded, as long as it lasts",
  nod: "Yes: a small agreement, lighter than success, then back",
  shake: "No: the gentle no that error is too strong for, then back",
};

// --- stills
const [vx, vy, vw, vh] = pack.view,
  COLOR = "#33a1ff",
  STILL = 88; // 4 device pixels per logo cell: even, so every bar is alike
// A rect cut to the view, or null: props can reach past it, and a renderer
// that ignores clip paths would spill them into the next cell of the sheet.
function inView(r) {
  const x = Math.max(r.x, vx),
    y = Math.max(r.y, vy),
    x2 = Math.min(r.x + r.w, vx + vw),
    y2 = Math.min(r.y + r.h, vy + vh);
  return x2 - x > 0.01 && y2 - y > 0.01 ? Object.assign({}, r, { x, y, w: x2 - x, h: y2 - y }) : null;
}
function rectsSvg(mode, ox = 0, oy = 0) {
  return omi
    .modeRects(mode, 0)
    .filter((r) => r.o > 0.001)
    .map(inView)
    .filter(Boolean)
    .map(
      (r) =>
        `<rect x="${+(r.x - vx + ox).toFixed(2)}" y="${+(r.y - vy + oy).toFixed(2)}" width="${+r.w.toFixed(2)}" height="${+r.h.toFixed(2)}"` +
        (r.o < 1 ? ` opacity="${+r.o.toFixed(3)}"` : "") +
        "/>",
    )
    .join("");
}
function still(mode) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${STILL}" height="${STILL}" ` +
    `fill="${COLOR}" shape-rendering="crispEdges" role="img" aria-label="Omi: ${mode.name}">` +
    rectsSvg(mode) +
    "</svg>\n"
  );
}
// every mode on one sheet, labelled
function sheet() {
  const cols = 7,
    cell = vw,
    label = 70,
    rows = Math.ceil(pack.modes.length / cols),
    W = cols * cell,
    H = rows * (cell + label);
  const parts = pack.modes.map((m, i) => {
    const ox = (i % cols) * cell,
      oy = Math.floor(i / cols) * (cell + label);
    return (
      `<g fill="${COLOR}">${rectsSvg(m, ox, oy)}</g>` +
      `<text x="${ox + cell / 2}" y="${oy + cell + 44}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="34" fill="#8a8f9e">${m.name.replace(/&/g, "&amp;")}</text>`
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W / 4}" height="${H / 4}" shape-rendering="crispEdges" role="img" aria-label="Every Omi mode">` +
    parts.join("") +
    "</svg>\n"
  );
}

fs.mkdirSync(outDir, { recursive: true });
for (const m of pack.modes) fs.writeFileSync(path.join(outDir, `${m.id}.svg`), still(m));
fs.writeFileSync(path.join(outDir, "sheet.svg"), sheet());

// --- the gallery
const secs = (s) => (s % 1 ? s.toFixed(1) : String(s)) + " s";
const rows = pack.modes.map((m) => {
  const what = m.kind === "reaction" ? `reaction, ${secs(omi.hold(m.id))}` : "state";
  const tags = [m.family ? `family: ${m.family}` : "", m.easter ? "easter egg" : ""].filter(Boolean).join(", ");
  const loop = omi.loopSeconds(m.id);
  return `| ![${m.name}](modes/${m.id}.svg) | \`${m.id}\` | ${m.name} | ${what} | ${loop ? secs(loop) : "still"} | ${USE[m.id] || ""}${tags ? ` (${tags})` : ""} |`;
});
const unknown = Object.keys(USE).filter((id) => !pack.modes.some((m) => m.id === id));
if (unknown.length) throw new Error("USE names modes not in the pack: " + unknown.join(", "));

const md = `# Every Omi mode

Omi has ${pack.modes.length} modes, each a set of rectangles with a looping
animation, and it morphs from any one to any other. This page is made by
\`node tools/modes-doc.js\` from the pack, so it always matches
\`pack/omi.json\`; the stills are each mode at rest (time 0 of its loops),
drawn by the reference player.

![Every mode](modes/sheet.svg)

- **state or reaction** is what the mode is for (\`kind\` in the pack). A
  state stays as long as what it stands for lasts. A reaction is shown for
  its hold after its morph lands, then Omi goes back: \`react("success")\`
  in Omi.qml, or \`omi.hold(mode)\` in your own host.
- **loop** is how long the mode takes to play every piece's loop once
  (\`loopSeconds\`): show a mode at least that long in a tour.
- A **family** groups modes that mean the same thing: pick one per
  situation and treat the rest as variations. **Easter eggs** are jokes;
  leave them out of anything generic.
- "Use it for" is advice for app authors; [docs/omarchy.md](omarchy.md)
  has the rules of thumb behind it (react to what the user did, never
  guilt the user, keep reactions short while they concentrate).

| | id | Name | Kind | Loop | Use it for |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`;
fs.writeFileSync(path.join(root, "docs/modes.md"), md);
console.log(`docs/modes.md: ${pack.modes.length} modes; docs/modes/: ${pack.modes.length} stills and sheet.svg`);
