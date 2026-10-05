/* ---------- export ---------- */
const toast = (msg) => {
  const t = $("toast"),
    v = $("view");
  const host = v && v.open ? v : document.body;
  if (t.parentNode !== host) host.appendChild(t);
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove("on"), 2600);
};
const EXT = {
  svg: "svg",
  svga: "svg",
  png: "png",
  jpg: "jpg",
  webp: "webp",
  txt: "txt",
  json: "json",
  webm: "webm",
  mp4: "mp4",
};
const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function exportBg() {
  if (["jpg", "webm", "mp4"].includes(X.fmt)) return X.bg || "#ffffff";
  return X.clear ? null : X.bg;
}
function fileName(d) {
  return `omi-${d.id}.${EXT[X.fmt]}`;
}

const scaleTimes = (s, k) =>
  k === 1
    ? s
    : s.replace(
        /(-?\d*\.?\d+)s(?=[\s;,)"}])/g,
        (m, n) => +(parseFloat(n) / k).toFixed(6) + "s",
      );
function svgString(d, animated) {
  const sh = shapes(d),
    vb = frameBox(sh.box, +X.pad, RATIOS[X.ratio] || 1);
  const out = svgFor(d, {
    color: X.fg,
    bg: exportBg(),
    animated,
    style: animated,
    vb,
    size: animated || X.fmt === "svg" ? null : outSize().w,
  });
  return animated ? scaleTimes(out, X.speed) : out;
}
function rasterize(svg, w, h) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      res(c);
    };
    img.onerror = () => rej(new Error("Could not render the SVG."));
    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svg)));
  });
}
async function ascii(d) {
  const sh = shapes(d),
    b = sh.box,
    padU = Math.round(((b.x2 - b.x) * +X.pad) / 20) * 20;
  const vb = {
    x: b.x - padU,
    y: b.y - padU,
    w: b.x2 - b.x + padU * 2,
    h: b.y2 - b.y + padU * 2,
  };
  const svg = svgFor(d, {
    color: "#000",
    bg: null,
    vb,
    size: vb.w,
  });
  const c = await rasterize(svg, vb.w, vb.h),
    data = c.getContext("2d").getImageData(0, 0, vb.w, vb.h).data;
  // Each character is a 10x20 cell split into two 10x10 halves, so
  // half blocks double the vertical resolution. Dimmed shapes and
  // partly covered cells fall back to the shade blocks.
  const cw = 10,
    ch = 20,
    lines = [];
  const cover = (x, y, h) => {
    let sum = 0,
      n = 0;
    for (let yy = y; yy < Math.min(y + h, vb.h); yy++)
      for (let xx = x; xx < Math.min(x + cw, vb.w); xx++) {
        sum += data[(yy * vb.w + xx) * 4 + 3];
        n++;
      }
    return n ? sum / n / 255 : 0;
  };
  const shade = (v) =>
    v < 0.12
      ? " "
      : v < 0.4
        ? "\u2591"
        : v < 0.65
          ? "\u2592"
          : v < 0.88
            ? "\u2593"
            : "\u2588";
  for (let y = 0; y < vb.h; y += ch) {
    let line = "";
    for (let x = 0; x < vb.w; x += cw) {
      const t = cover(x, y, ch / 2),
        u = cover(x, y + ch / 2, ch / 2);
      const on = (v) => v >= 0.88,
        off = (v) => v < 0.12;
      if (on(t) && off(u)) line += "\u2580";
      else if (off(t) && on(u)) line += "\u2584";
      else line += shade((t + u) / 2);
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  return lines.join("\n") + "\n";
}
function geometry(d) {
  const sh = shapes(d),
    vb = frameBox(sh.box, +X.pad, RATIOS[X.ratio] || 1),
    role = (r) => r.role;
  const out = {
    name: "Omi — " + d.name,
    id: d.id,
    color: X.fg,
    unit: 20,
    viewBox: [vb.x, vb.y, vb.w, vb.h].map((n) => +n.toFixed(2)),
  };
  const map = (r) => ({
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    role: role(r),
    ...(r.o != null ? { opacity: r.o } : {}),
  });
  if (d.clip) {
    const c = d.clip;
    out.clip = { x: c.x, y: c.y, width: c.w, height: c.h };
    out.clipped = sh.rects.filter((r) => r.clip).map(map);
    out.rects = sh.rects.filter((r) => !r.clip).map(map);
  } else out.rects = sh.rects.map(map);
  return JSON.stringify(out, null, 2) + "\n";
}
async function build(d, fmt) {
  X = { ...eff(d.id), ...(fmt ? { fmt } : {}) };
  switch (X.fmt) {
    case "svg":
      return new Blob([svgString(d, false)], { type: "image/svg+xml" });
    case "svga":
      return new Blob([svgString(d, true)], { type: "image/svg+xml" });
    case "txt":
      return new Blob([await ascii(d)], {
        type: "text/plain;charset=utf-8",
      });
    case "json":
      return new Blob([geometry(d)], { type: "application/json" });
    case "webm":
    case "mp4":
      return await recordVideo(d, X.fmt);
    default: {
      const o = outSize(),
        c = await rasterize(svgString(d, false), o.w, o.h);
      return await new Promise((res, rej) =>
        c.toBlob(
          (b) => (b ? res(b) : rej(new Error("Encoding failed."))),
          MIME[X.fmt],
          0.92,
        ),
      );
    }
  }
}
