#!/usr/bin/env node
/* Omi in a terminal: the reference player, drawn with half-block characters.
   Each character is two square pixels, top and bottom.

     node examples/terminal/omi-tty.js                 tour every mode
     node examples/terminal/omi-tty.js idle thinking   cycle these modes
     node examples/terminal/omi-tty.js --once error    print one still and exit
     node examples/terminal/omi-tty.js --follow        follow the shared Omi
                         (start service/omi-service.js, change it with
                         service/omictl.js; every follower moves together)

   Options:
     --size 44      pixels across, rounded down to a multiple of 22 (see
                    "Drawing Omi crisp" in the pack's README); default: as
                    big as fits the terminal, up to 66
     --fg #9ece6a   Omi's color; default: the Omarchy theme's accent, or the
                    terminal's own foreground outside Omarchy
     --bg #1a1b26   the color faded pixels blend into; default: the Omarchy
                    theme's background. Empty pixels always show the
                    terminal's own background, so there's no box around Omi
     --look 0,-1    where the eyes look, each -1..1 (x right, y down)
     --bounce       whole-body motion (bobs, hops, shakes); off by default:
                    at terminal sizes it moves a pixel at a time and stutters
     --every 2.5    the least time per mode on a tour; each mode stays until
                    its morph has landed and its whole loop has played once */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  Omi = require("../../pack/omi.js");

const pack = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../pack/omi.json"), "utf8"),
);

// ---------------------------------------------------------------- options
const args = process.argv.slice(2),
  opt = (name, def) => {
    const i = args.indexOf("--" + name);
    if (i < 0) return def;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  },
  flag = (name) =>
    args.includes(name) && args.splice(args.indexOf(name), 1).length > 0;
const once = flag("--once"),
  following = flag("--follow"),
  bounce = flag("--bounce"),
  askedSize = opt("size", null),
  every = +opt("every", 2.5),
  look = String(opt("look", "0,0")).split(",").map(Number),
  rgb = (hex) =>
    /^#[0-9a-f]{6}$/i.test(hex || "")
      ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      : null,
  theme = omarchyTheme(),
  fg = rgb(opt("fg", null)) || theme.accent, // null: the terminal's foreground
  bg = rgb(opt("bg", null)) || theme.background, // null: no blending
  ids = pack.modes.map((m) => m.id),
  modes = args.length ? args : ids;
for (const m of modes)
  if (!ids.includes(m)) {
    console.error(`No mode "${m}". Modes: ${ids.join(", ")}`);
    process.exit(1);
  }

// The Omarchy theme's accent and background, if this is Omarchy.
function omarchyTheme() {
  try {
    const toml = fs.readFileSync(
      path.join(os.homedir(), ".local/state/omarchy/current/theme/colors.toml"),
      "utf8",
    );
    const get = (key) => {
      const m = toml.match(
        new RegExp("^\\s*" + key + '\\s*=\\s*"(#[0-9a-fA-F]{6})"', "m"),
      );
      return m ? rgb(m[1]) : null;
    };
    return { accent: get("accent"), background: get("background") };
  } catch (e) {
    return { accent: null, background: null };
  }
}

// ---------------------------------------------------------------- size
// Crisp when one logo cell (pack.grid units) is a whole number of pixels: the
// view is 22 cells across, so the width is a multiple of 22.
const cells = pack.view[2] / pack.grid;
function fitSize() {
  if (askedSize) return Math.max(cells, Math.floor(+askedSize / cells) * cells);
  const cols = (process.stdout.columns || 80) - 2,
    rows = ((process.stdout.rows || 40) - 2) * 2; // two pixels a row, one row for the name
  return Math.max(cells, Math.floor(Math.min(66, cols, rows) / cells) * cells);
}
let size = fitSize();

// ---------------------------------------------------------------- drawing
/* Rects to pixels. Edges snap to whole pixels, so Omi stays crisp; a pixel
   is as opaque as the rect over it. */
function pixels(rects) {
  const [vx, vy, vw] = pack.view,
    s = size / vw,
    on = new Float32Array(size * size);
  for (const r of rects) {
    if (r.o <= 0.001) continue;
    const x0 = Math.max(0, Math.round((r.x - vx) * s)),
      y0 = Math.max(0, Math.round((r.y - vy) * s)),
      x1 = Math.min(size, Math.round((r.x + r.w - vx) * s)),
      y1 = Math.min(size, Math.round((r.y + r.h - vy) * s)),
      o = Math.min(1, r.o);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        on[y * size + x] = Math.max(on[y * size + x], o);
  }
  return on;
}

// A pixel's color: null for empty (the terminal's background), "fg" for Omi,
// or [r, g, b] for a faded pixel blended into the background.
function color(a) {
  if (a < 0.02) return null;
  if (a > 0.98 || !bg || !fg) return a >= 0.5 ? "fg" : null; // no blending: round
  return fg.map((c, k) => Math.round(bg[k] + (c - bg[k]) * a));
}
const sgr = (c, layer) =>
  c === null
    ? layer === 38
      ? "39"
      : "49"
    : c === "fg"
      ? fg
        ? `${layer};2;${fg.join(";")}`
        : layer === 38
          ? "39"
          : "7"
      : `${layer};2;${c.join(";")}`;

/* One row of characters: ▀ with the top pixel's color as foreground and the
   bottom's as background. Escape codes only when a color changes. */
function row(on, y) {
  let out = "",
    last = "";
  for (let x = 0; x < size; x++) {
    const top = color(on[y * size + x]),
      bottom = color(on[(y + 1) * size + x]);
    let ch, code;
    if (top === null && bottom === null) ((ch = " "), (code = "\x1b[39;49m"));
    else if (bottom === null) ((ch = "▀"), (code = `\x1b[${sgr(top, 38)};49m`));
    else if (top === null) ((ch = "▄"), (code = `\x1b[${sgr(bottom, 38)};49m`));
    else if (top === "fg" && bottom === "fg")
      ((ch = "█"), (code = `\x1b[${sgr("fg", 38)};49m`));
    else ((ch = "▀"), (code = `\x1b[${sgr(top, 38)};${sgr(bottom, 48)}m`));
    if (code !== last) ((out += code), (last = code));
    out += ch;
  }
  return out + "\x1b[0m";
}

const omi = new Omi(null, pack, { color: "#fff", bodyMotion: bounce });
if (look[0] || look[1]) omi.look(look[0] || 0, look[1] || 0);

if (once) {
  omi.set(modes[0], { instant: true });
  const on = pixels(omi.rects());
  let out = "";
  for (let y = 0; y < size; y += 2) out += row(on, y) + "\n";
  process.stdout.write(out);
  process.exit(0);
}

// ---------------------------------------------------------------- live
// Full screen: alternate buffer, no cursor; the terminal is put back on exit.
const restore = () => process.stdout.write("\x1b[0m\x1b[?25h\x1b[?1049l");
process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J");
process.on("exit", restore);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

// Only rows that changed are redrawn.
let shown = [];
process.stdout.on("resize", () => {
  size = fitSize();
  shown = [];
  process.stdout.write("\x1b[2J");
});

if (following)
  require("../../service/client.js").follow(omi, {
    name: "omi-tty",
    onError: (e) => {
      restore();
      console.error(`Can't reach the Omi service (${e.code || e.message}).`);
      process.exit(1);
    },
    onClose: () => process.exit(0),
  });

// A tour: each mode from its landing, for its whole loop (or --every).
let next = 0,
  landed = 0,
  hold = 0;
omi.on("settled", () => (landed = Date.now()));
const advance = () => {
  const id = modes[next++ % modes.length];
  omi.set(id);
  landed = omi.morph ? 0 : Date.now(); // set when the morph lands, if there is one
  hold = Math.max(every, omi.loopSeconds(id)) * 1000;
};
const tick = () => {
  const now = Date.now();
  if (!following && (next === 0 || (landed && now - landed >= hold))) advance();
  omi.frame(now);
  const on = pixels(omi.rects()),
    lines = [];
  for (let y = 0; y < size; y += 2) lines.push(row(on, y));
  lines.push(
    `\x1b[2K  ${pack.modes.find((m) => m.id === omi.mode).name}  (Ctrl+C to quit)`,
  );
  let out = "";
  lines.forEach((l, i) => {
    if (shown[i] !== l) out += `\x1b[${i + 1};1H${l}`;
  });
  shown = lines;
  if (out) process.stdout.write(out);
};
setInterval(tick, 1000 / 30);
tick();
