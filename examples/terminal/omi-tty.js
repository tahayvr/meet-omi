#!/usr/bin/env node
/* Omi in a terminal: the reference player, drawn with half-block characters
   in 24-bit color. Each character is two square pixels (top and bottom).

     node examples/terminal/omi-tty.js                 tour every mode
     node examples/terminal/omi-tty.js idle thinking   cycle these modes
     node examples/terminal/omi-tty.js --once error    print one still and exit
     node examples/terminal/omi-tty.js --follow        follow the shared Omi
                         (start service/omi-service.js, change it with
                         service/omictl.js; every follower moves together)

   Options: --size 40 (pixels across), --fg #9ece6a, --bg #1a1b26,
            --every 2.5 (seconds per mode) */
const fs = require("fs"),
  path = require("path"),
  Omi = require("../../pack/omi.js");

const pack = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../pack/omi.json"), "utf8"),
);

// options
const args = process.argv.slice(2),
  opt = (name, def) => {
    const i = args.indexOf("--" + name);
    if (i < 0) return def;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
const flag = (name) => args.includes(name) && args.splice(args.indexOf(name), 1),
  once = flag("--once"),
  following = flag("--follow"),
  size = +opt("size", Math.min(48, (process.stdout.columns || 80) - 2)),
  every = +opt("every", 2.5),
  rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  fg = rgb(opt("fg", "#9ece6a")),
  bg = rgb(opt("bg", "#1a1b26")),
  ids = pack.modes.map((m) => m.id),
  modes = args.length ? args : ids;
for (const m of modes)
  if (!ids.includes(m)) {
    console.error(`No mode "${m}". Modes: ${ids.join(", ")}`);
    process.exit(1);
  }

/* Rects to pixels: each pixel's color is the background blended toward the
   foreground by how much of it the rects cover (times their opacity). */
function render(rects) {
  const [vx, vy, vw, vh] = pack.view,
    W = size,
    H = size % 2 ? size + 1 : size, // whole characters: two pixels each
    s = Math.min(W / vw, H / vh),
    ox = (W - vw * s) / 2 - vx * s,
    oy = (H - vh * s) / 2 - vy * s,
    alpha = new Float32Array(W * H);
  for (const r of rects) {
    if (r.o <= 0.001) continue;
    const x0 = r.x * s + ox,
      y0 = r.y * s + oy,
      x1 = (r.x + r.w) * s + ox,
      y1 = (r.y + r.h) * s + oy;
    for (let py = Math.max(0, Math.floor(y0)); py < Math.min(H, Math.ceil(y1)); py++)
      for (let px = Math.max(0, Math.floor(x0)); px < Math.min(W, Math.ceil(x1)); px++) {
        const cover =
          (Math.min(px + 1, x1) - Math.max(px, x0)) *
          (Math.min(py + 1, y1) - Math.max(py, y0));
        const i = py * W + px;
        alpha[i] = Math.min(1, alpha[i] + cover * Math.min(1, r.o));
      }
  }
  const mix = (a) => fg.map((c, k) => Math.round(bg[k] + (c - bg[k]) * a)).join(";");
  let out = "";
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++)
      out += `\x1b[38;2;${mix(alpha[y * W + x])}m\x1b[48;2;${mix(alpha[(y + 1) * W + x])}m▀`;
    out += "\x1b[0m\n";
  }
  return out;
}

const omi = new Omi(null, pack, { color: "#fff" });

if (once) {
  omi.set(modes[0], { instant: true });
  process.stdout.write(render(omi.rects()));
  process.exit(0);
}

// full screen: alternate buffer, no cursor; put the terminal back on exit
const restore = () => process.stdout.write("\x1b[?25h\x1b[?1049l");
process.stdout.write("\x1b[?1049h\x1b[?25l");
process.on("exit", restore);
process.on("SIGINT", () => process.exit(0));

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

let next = 0,
  changed = 0;
const tick = () => {
  const now = Date.now();
  if (!following && now - changed >= every * 1000) {
    omi.set(modes[next++ % modes.length]);
    changed = now;
  }
  omi.frame(now);
  const name = pack.modes.find((m) => m.id === omi.mode).name;
  process.stdout.write(`\x1b[H${render(omi.rects())}\x1b[2K  ${name}  (Ctrl+C to quit)\n`);
};
setInterval(tick, 1000 / 30);
tick();
