/* ---------- state ---------- */
// Omarchy's built-in themes (github.com/omacom/omarchy, quattro):
// background + accent from each theme's colors.toml.
const THEMES = [
  { name: "Tokyo Night", bg: "#1a1b26", fg: "#9ece6a" },
  { name: "Catppuccin", bg: "#1e1e2e", fg: "#89b4fa" },
  { name: "Ethereal", bg: "#060b1e", fg: "#7d82d9" },
  { name: "Everforest", bg: "#2d353b", fg: "#7fbbb3" },
  { name: "Gruvbox", bg: "#282828", fg: "#7daea3" },
  { name: "Hackerman", bg: "#0b0c16", fg: "#82fb9c" },
  { name: "Kanagawa", bg: "#1f1f28", fg: "#dcd7ba" },
  { name: "Last Horizon", bg: "#0c0b0c", fg: "#b59790" },
  { name: "Lumon", bg: "#16242d", fg: "#8bc9eb" },
  { name: "Matte Black", bg: "#121212", fg: "#e68e0d" },
  { name: "Miasma", bg: "#222222", fg: "#78824b" },
  { name: "Nord", bg: "#2e3440", fg: "#81a1c1" },
  { name: "Osaka Jade", bg: "#111c18", fg: "#509475" },
  { name: "Retro 82", bg: "#05182e", fg: "#faa968" },
  { name: "Ristretto", bg: "#2c2525", fg: "#f38d70" },
  { name: "Solitude", bg: "#101315", fg: "#798186" },
  { name: "Vantablack", bg: "#000000", fg: "#8d8d8d" },
  { name: "Catppuccin Latte", bg: "#eff1f5", fg: "#1e66f5", light: true },
  { name: "Flexoki Light", bg: "#fffcf0", fg: "#205ea6", light: true },
  { name: "Lupine", bg: "#fafafa", fg: "#3264eb", light: true },
  { name: "Rosé Pine", bg: "#faf4ed", fg: "#56949f", light: true },
  { name: "White", bg: "#ffffff", fg: "#6e6e6e", light: true },
];
const BG_SW = [
  "#1a1b26",
  "#000000",
  "#ffffff",
  "#f5f5f0",
  "#9ece6a",
  "#7aa2f7",
  null,
];
const FG_SW = [
  "#9ece6a",
  "#7aa2f7",
  "#bb9af7",
  "#f7768e",
  "#e0af68",
  "#c0caf5",
  "#ffffff",
  "#1a1b26",
];
const DEF0 = 0;
const DEF = {
  bg: "#1a1b26",
  fg: "#9ece6a",
  anim: true,
  body: false,
  names: true,
  tile: 220,
  fmt: "svg",
  size: "1024",
  pad: "0.08",
  clear: false,
  side: false,
  vlen: "8",
  filter: "all",
  speed: 1,
  ratio: "1:1",
  force: false,
  over: {},
};
let S = { ...DEF };
try {
  const saved = JSON.parse(localStorage.getItem("omi-jig") || "null");
  if (saved) S = { ...DEF, ...saved };
} catch (e) {}
if (window.matchMedia("(max-width:720px)").matches) S.side = false;
S.body = false;
S.side = false;
const persist = () => {
  try {
    localStorage.setItem("omi-jig", JSON.stringify(S));
  } catch (e) {}
};

const $ = (id) => document.getElementById(id);
const grid = $("grid"),
  stage = $("stage");

function lum(hex) {
  const n = parseInt(hex.slice(1), 16),
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928
        ? v / 12.92
        : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function uniformBox() {
  const b = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  DESIGNS.forEach((d) => {
    const s = shapes(d, S.body).box;
    b.x = Math.min(b.x, s.x);
    b.y = Math.min(b.y, s.y);
    b.x2 = Math.max(b.x2, s.x2);
    b.y2 = Math.max(b.y2, s.y2);
  });
  // Center on the logo so extras that stick out on one side (z's, confetti)
  // grow the frame evenly instead of pushing every Omi off-center.
  const ref = shapes(DESIGNS.find((d) => d.id === "idle") || DESIGNS[0], S.body).box,
    cx = (ref.x + ref.x2) / 2,
    cy = (ref.y + ref.y2) / 2,
    p = 30,
    hw = Math.max(cx - b.x, b.x2 - cx) + p,
    hh = Math.max(cy - b.y, b.y2 - cy) + p;
  return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
}

const VI = {
  accept:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>',
  deny: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>',
};
const VLABEL = {
  accept: "Accepted",
  deny: "Denied",
  edit: "Needs edits",
};
const reviews = {},
  rdb = null;
const RESET_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path></svg>';
const hasOver = (id) =>
  !!(S.over || {})[id] && Object.keys(S.over[id]).length > 0;
function clearOver(id) {
  const o = { ...(S.over || {}) };
  delete o[id];
  S = { ...S, over: o };
  persist();
  render();
}
const DL_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"></path><path d="M7 10l5 5 5-5"></path><path d="M5 20h14"></path></svg>';

function render() {
  const vb = uniformBox();
  const dark = S.bg ? lum(S.bg) < 0.35 : false;
  stage.classList.toggle("checker", !S.bg);
  stage.style.background = S.bg || "";
  stage.style.setProperty(
    "--label",
    S.bg ? (dark ? "#e6e9f5" : "#1f2335") : "#1f2335",
  );
  stage.style.setProperty("--accent", S.fg);
  stage.style.setProperty("--accent-ink", S.bg || "#ffffff");
  stage.style.setProperty(
    "--rule",
    dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)",
  );
  stage.style.setProperty(
    "--label-hover",
    dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)",
  );
  grid.style.setProperty("--tile", S.tile + "px");
  const groups = [...new Set(DESIGNS.map((d) => d.group))];
  const E = (d) => eff(d.id);
  const tile = (d) => `
    <figure class="tile" role="listitem">
      <button class="open" data-id="${d.id}" aria-label="Open ${d.name}"><div class="art${E(d).bg !== S.bg ? " own" : ""}" data-sid="${d.id}"${E(d).bg !== S.bg ? ` style="background:${E(d).bg || "transparent"}"` : ""}>${svgFor(d, { color: E(d).fg, body: S.body, animated: E(d).anim, force: S.force, vb, label: "Omi, " + d.name })}</div></button>
      <figcaption class="meta">
${S.names ? `<span class="name">${d.name}</span>` : ""}${hasOver(d.id) ? `<button class="reset" data-id="${d.id}" aria-label="Reset ${d.name} to global settings" title="Has its own settings. Reset to global">${RESET_ICON}</button>` : ""}
<button class="save" data-id="${d.id}" aria-label="Export ${d.name}" title="Export ${d.name}">${DL_ICON}</button>
      </figcaption>
    </figure>`;
  const shown = DESIGNS;
  const gridHTML =
    (shown.length
      ? ""
      : `<p style="padding:40px 0;color:var(--label)">Nothing here yet.</p>`) +
    groups
      .filter((g) => shown.some((d) => d.group === g))
      .map(
        (g) =>
          `<section class="group" aria-label="${g}">${g === "Core" ? "" : `<h2>${g}</h2>`}<div class="tiles" role="list">${shown
            .filter((d) => d.group === g)
            .map(tile)
            .join("")}</div></section>`,
      )
      .join("");
  if (gridHTML !== grid._html) {
    grid.innerHTML = gridHTML;
    grid._html = gridHTML;
  }
  $("modeCount").textContent = DESIGNS.length;
  renderSite();
  syncControls();
  if (typeof rmSync === "function") rmSync();
  applySpeed();
}

function syncControls() {
  const S = ctx();
  $("bgPick").value = S.bg || "#ffffff";
  $("bgHex").value = S.bg || "none";
  $("fgPick").value = S.fg;
  $("fgHex").value = S.fg;
  const ti = THEMES.findIndex(
    (t) =>
      t.bg === (S.bg || "").toLowerCase() &&
      t.fg === S.fg.toLowerCase(),
  );
  $("themeSel").value = ti < 0 ? "custom" : String(ti);
  $("anim").checked = S.anim;
  $("names").checked = S.names;
  $("tile").value = S.tile;
  $("fmt").value = S.fmt;
  $("vlen").value = S.vlen;
  $("ratio").value = S.ratio;
  $("ratio").disabled = fmtRules(S.fmt).noRatio;
  $("speed").value = S.speed;
  $("speedOut").textContent = S.speed + "\u00d7";
  $("size").value = S.size;
  $("pad").value = S.pad;
  $("clear").checked = S.clear;
  const fr = fmtRules(S.fmt);
  $("size").disabled = !fr.raster;
  $("clear").disabled = fr.noClear;
  $("lenField").hidden = !fr.video;
  $("fmt").querySelector("[value=mp4]").disabled = !MP4;
  $("pad").disabled = fr.noPad;
  $("side").hidden = !S.side;
  $("toggleSide").setAttribute("aria-expanded", String(S.side));
  document
    .querySelectorAll("#bgSw .sw")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          (b.dataset.c || null) ===
            (S.bg ? S.bg.toLowerCase() : null) ||
            (!b.dataset.c && !S.bg),
        ),
      ),
    );
  document
    .querySelectorAll("#fgSw .sw")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.c === S.fg.toLowerCase()),
      ),
    );
}
function applySpeed() {
  requestAnimationFrame(() => {
    if (!document.getAnimations) return;
    document.getAnimations().forEach((a) => {
      if (
        window.CSSAnimation &&
        a instanceof CSSAnimation &&
        /^omi-/.test(a.animationName)
      ) {
        const t = a.effect && a.effect.target,
          host = t && t.closest && t.closest("[data-sid]");
        a.playbackRate = host ? eff(host.dataset.sid).speed : S.speed;
      }
    });
  });
}
const OVK = [
  "bg",
  "fg",
  "anim",
  "speed",
  "fmt",
  "size",
  "pad",
  "clear",
  "vlen",
  "ratio",
];
// Which export options apply to a format.
const fmtRules = (fmt) => ({
  raster: ["png", "jpg", "webp", "webm", "mp4"].includes(fmt),
  video: ["webm", "mp4"].includes(fmt),
  noClear: ["jpg", "txt", "json", "webm", "mp4"].includes(fmt),
  noRatio: ["txt"].includes(fmt),
  noPad: ["json"].includes(fmt),
});
const eff = (id) => ({ ...S, ...((S.over || {})[id] || {}) });
const inView = () => typeof view !== "undefined" && view.open;
const ctx = () => (inView() ? eff(DESIGNS[vi].id) : S);
let X = S; // settings for the export in progress
function set(patch) {
  if (inView()) {
    const id = DESIGNS[vi].id,
      o = {},
      g = {};
    for (const k in patch) (OVK.includes(k) ? o : g)[k] = patch[k];
    S = {
      ...S,
      ...g,
      over: {
        ...(S.over || {}),
        ...(Object.keys(o).length
          ? { [id]: { ...((S.over || {})[id] || {}), ...o } }
          : {}),
      },
    };
  } else S = { ...S, ...patch };
  persist();
  render();
  if (inView()) showView();
}

/* swatches + themes */
$("bgSw").innerHTML = BG_SW.map((c) =>
  c
    ? `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Background ${c}"></button>`
    : `<button class="sw clear" data-c="" aria-label="Transparent background"></button>`,
).join("");
$("fgSw").innerHTML = FG_SW.map(
  (c) =>
    `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Omi color ${c}"></button>`,
).join("");
$("themeSel").innerHTML =
  '<option value="custom">Custom</option>' +
  [
    ["Dark", false],
    ["Light", true],
  ]
    .map(
      ([g, l]) =>
        `<optgroup label="${g}">${THEMES.map((t, i) => [t, i])
          .filter(([t]) => !!t.light === l)
          .map(([t, i]) => `<option value="${i}">${t.name}</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
$("bgSw").addEventListener("click", (e) => {
  const b = e.target.closest(".sw");
  if (b) set({ bg: b.dataset.c || null });
});
$("fgSw").addEventListener("click", (e) => {
  const b = e.target.closest(".sw");
  if (b) set({ fg: b.dataset.c });
});
$("themeSel").addEventListener("change", (e) => {
  const t = THEMES[e.target.value];
  if (t) set({ bg: t.bg, fg: t.fg });
});
const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(v);
$("bgPick").addEventListener("input", (e) =>
  set({ bg: e.target.value }),
);
$("fgPick").addEventListener("input", (e) =>
  set({ fg: e.target.value }),
);
$("bgHex").addEventListener("change", (e) => {
  let v = e.target.value.trim();
  if (v && v[0] !== "#") v = "#" + v;
  if (hexOk(v)) set({ bg: v.toLowerCase() });
  else if (v === "#none" || v === "#") set({ bg: null });
  else syncControls();
});
$("fgHex").addEventListener("change", (e) => {
  let v = e.target.value.trim();
  if (v[0] !== "#") v = "#" + v;
  if (hexOk(v)) set({ fg: v.toLowerCase() });
  else syncControls();
});
["anim", "names", "clear"].forEach((k) =>
  $(k).addEventListener("change", (e) =>
    set({ [k]: e.target.checked }),
  ),
);
$("tile").addEventListener("input", (e) =>
  set({ tile: +e.target.value }),
);
$("speed").addEventListener("input", (e) =>
  set({ speed: +e.target.value }),
);
["fmt", "size", "pad", "vlen", "ratio"].forEach((k) =>
  $(k).addEventListener("change", (e) => set({ [k]: e.target.value })),
);
const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
$("rmPlay").addEventListener("click", () => set({ force: !S.force }));
const rmSync = () => {
  const S = ctx();
  $("rmHint").hidden = !RM.matches || !S.anim;
  $("rmPlay").textContent = S.force
    ? "Respect reduce motion"
    : "Play animations anyway";
};
RM.addEventListener && RM.addEventListener("change", () => rmSync());
$("toggleSide").addEventListener("click", () => set({ side: !S.side }));
