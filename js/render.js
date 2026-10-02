function shapes(d, body) {
  const face = body && d.bodyFace ? d.bodyFace : d.face;
  const rects = [
    ...(d.logo || LOGO),
    ...face,
    ...(body && !d.noBody ? d.body || BODY : []),
  ];
  const box = {
    x: Infinity,
    y: Infinity,
    x2: -Infinity,
    y2: -Infinity,
  };
  rects.forEach((r) => {
    // a clipped piece only counts as far as its window shows it
    if (r.clip) r = clipTo(r, d.clip);
    if (!r) return;
    box.x = Math.min(box.x, r.x);
    box.y = Math.min(box.y, r.y);
    box.x2 = Math.max(box.x2, r.x + r.w);
    box.y2 = Math.max(box.y2, r.y + r.h);
  });
  return { rects, box };
}
// The part of r inside box, or null.
function clipTo(r, b) {
  const x = Math.max(r.x, b.x),
    y = Math.max(r.y, b.y),
    x2 = Math.min(r.x + r.w, b.x + b.w),
    y2 = Math.min(r.y + r.h, b.y + b.h);
  return x2 - x > 0.01 && y2 - y > 0.01
    ? { ...r, x, y, w: x2 - x, h: y2 - y }
    : null;
}
const rectTag = (r) => {
  const s = pieceStyle(r);
  return `<rect${r.c ? ` class="${r.c}"` : ""}${s ? ` style="${s}"` : ""}${r.o != null ? ` fill-opacity="${r.o}"` : ""} x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
};

/* All keyframes come from ANIM (motion.js); only the plumbing lives here. */
const MOTION_CSS = `.omi-a g,.omi-a rect{transform-box:fill-box;transform-origin:center}
${Object.entries(ANIM)
  .map(([name, a]) => animCSS(name, a))
  .join("\n")}
@media (prefers-reduced-motion:reduce){.omi-a:not(.force) *{animation:none!important}}`;
{
  const st = document.createElement("style");
  st.textContent = MOTION_CSS;
  document.head.appendChild(st);
}

const RATIOS = {
  "1:1": 1,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "21:9": 21 / 9,
};
function frameBox(box, pad, ratio) {
  const w = box.x2 - box.x,
    h = box.y2 - box.y,
    p = Math.max(w, h) * pad;
  let fw = w + p * 2,
    fh = h + p * 2;
  if (fw / fh < ratio) fw = fh * ratio;
  else fh = fw / ratio;
  return {
    x: box.x + w / 2 - fw / 2,
    y: box.y + h / 2 - fh / 2,
    w: fw,
    h: fh,
  };
}
function outSize() {
  const r = RATIOS[X.ratio] || 1,
    L = +X.size,
    even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return r >= 1
    ? { w: even(L), h: even(L / r) }
    : { w: even(L * r), h: even(L) };
}
function squareBox(box, pad) {
  const w = box.x2 - box.x,
    h = box.y2 - box.y,
    side = Math.max(w, h),
    p = side * pad;
  const s = side + p * 2;
  return {
    x: box.x - (side - w) / 2 - p,
    y: box.y - (side - h) / 2 - p,
    w: s,
    h: s,
  };
}

/* opts: {color,bg|null,body,animated,style,vb,size,label} */
function svgFor(d, o) {
  const sh = shapes(d, o.body);
  const vb = o.vb;
  // a still is frame 0 of the loops, so it matches where the animation starts
  const rects = o.animated ? sh.rects : sh.rects.map(restOf),
    tags = (list) => list.map(rectTag).join("");
  let inner = tags(rects.filter((r) => !r.clip));
  if (d.clip) {
    // pieces seen through a window (peek): an inner <svg> clips them, and the
    // window's own layer can move (d.clip.mood)
    const c = d.clip,
      held = rects.filter((r) => r.clip);
    inner =
      `<svg x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}" overflow="hidden"><g${c.mood ? ` class="${c.mood}"` : ""}>${tags(held)}</g></svg>` +
      inner;
  }
  const content = `<g fill="${o.color}"${d.mood ? ` class="${d.mood}"` : ""}>${inner}</g>`;
  const bg = o.bg
    ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${o.bg}"/>`
    : "";
  const size = o.size
    ? ` width="${o.size}" height="${Math.round((o.size * vb.h) / vb.w)}"`
    : "";
  const style = o.style ? `<style>${MOTION_CSS}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"${size}${o.animated ? ` class="omi-a${o.force ? " force" : ""}"` : ""} shape-rendering="crispEdges"${o.label ? ` role="img" aria-label="${o.label}"` : ""}>${style}${bg}${content}</svg>`;
}
