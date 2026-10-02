/* ---------- morph: every mode flows into every other ----------
   Every mode is axis-aligned rects on the logo's 20-unit grid, so any two
   modes can be matched piece by piece:
   - Frame rects are cut into grid cells. A cell that exists in both modes
     stays put and only changes brightness, so the logo never "rebuilds".
   - Face rects stay whole and travel, grow or shrink into their partner
     (an optimal assignment, so paths don't cross).
   - Extra pieces split off their nearest neighbour; leftovers merge into
     theirs; with no neighbour nearby they pop in or shrink away in place.
   The morph always starts from what is on screen right now, animations
   included, so a click mid-blink or mid-morph picks up exactly where Omi
   is. Once it lands, the target's own animation takes over. The whole-body
   moods (bob, hop, shake, beat) are left out here, so the body always sits
   at its neutral spot and every morph starts and ends there. */
const MORPH_VB = { x: -70, y: -70, w: 440, h: 440 };
const MORPH_MARK = { id: "mark", name: "The mark", face: [], mood: "" };
const MORPH_C = { x: 150, y: 140 }; // the ripple spreads out from the face
const morphDesign = (id) =>
  id === MORPH_MARK.id ? MORPH_MARK : DESIGNS.find((d) => d.id === id);

const hitsLogo = (r) =>
  LOGO.some(
    (L) =>
      r.x < L.x + L.w && r.x + r.w > L.x && r.y < L.y + L.h && r.y + r.h > L.y,
  );
const on20 = (v) => Math.abs(v / 20 - Math.round(v / 20)) < 1e-6;
const gridCuts = (a, b) => {
  const o = [a];
  for (let v = Math.floor(a / 20) * 20 + 20; v < b - 1e-6; v += 20) o.push(v);
  o.push(b);
  return o;
};
// Frame pieces (anything on the grid or touching the logo) become cells.
function cells(r) {
  const aligned = [r.x, r.y, r.x + r.w, r.y + r.h].every(on20);
  if (!aligned && !hitsLogo(r)) return [r];
  const xs = gridCuts(r.x, r.x + r.w),
    ys = gridCuts(r.y, r.y + r.h),
    out = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++)
      out.push({ x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] });
  return out;
}
// A mode at rest (frame 0 of its loops), as atoms {x, y, w, h, o}.
function atomsOf(d) {
  return shapes(d, false)
    .rects.map(restOf)
    .map((r) => (r.clip ? clipTo(r, d.clip) : r))
    .filter(Boolean)
    .flatMap((r) => cells(r).map((c) => ({ ...c, o: r.o ?? 1 })));
}
// What an animated SVG shows right now, as atoms in its user space.
function snapLayer(svg) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return [];
  const inv = ctm.inverse(),
    pt = (x, y) => new DOMPoint(x, y).matrixTransform(inv),
    out = [];
  svg.querySelectorAll("rect").forEach((el) => {
    const ox = +el.getAttribute("x"),
      oy = +el.getAttribute("y"),
      ow = +el.getAttribute("width"),
      oh = +el.getAttribute("height");
    if (!ow || !oh) return;
    const o =
      +getComputedStyle(el).opacity * +(el.getAttribute("fill-opacity") ?? 1);
    if (o < 0.01) return;
    const b = el.getBoundingClientRect(),
      a = pt(b.left, b.top),
      z = pt(b.right, b.bottom),
      sx = (z.x - a.x) / ow,
      sy = (z.y - a.y) / oh;
    // rects inside a nested <svg> (peek) are clipped by its window
    const win = el.ownerSVGElement !== svg ? el.ownerSVGElement : null,
      box = win && {
        x: +win.getAttribute("x"),
        y: +win.getAttribute("y"),
        w: +win.getAttribute("width"),
        h: +win.getAttribute("height"),
      };
    cells({ x: ox, y: oy, w: ow, h: oh }).forEach((c) => {
      let r = {
        x: a.x + (c.x - ox) * sx,
        y: a.y + (c.y - oy) * sy,
        w: c.w * sx,
        h: c.h * sy,
        o,
      };
      if (box) r = clipTo(r, box);
      if (r) out.push(r);
    });
  });
  return out;
}

/* Minimum-cost assignment (Hungarian, rows <= cols). Returns row -> col. */
function assign(cost) {
  const n = cost.length,
    m = n ? cost[0].length : 0,
    INF = 1e18,
    u = new Float64Array(n + 1),
    v = new Float64Array(m + 1),
    p = new Int32Array(m + 1),
    way = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(INF),
      used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF,
        j1 = 0;
      for (let j = 1; j <= m; j++)
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      for (let j = 0; j <= m; j++)
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const res = new Int32Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

const ctr = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const d2 = (a, b) => {
  const p = ctr(a),
    q = ctr(b);
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
};
const nearest = (r, list) =>
  list.reduce(
    (best, c) => {
      const k = d2(r, c);
      return k < best.k ? { c, k } : best;
    },
    { c: null, k: Infinity },
  );
const dot = (r, o = 0) => {
  const c = ctr(r);
  return { x: c.x, y: c.y, w: 0, h: 0, o };
};
const SPLIT_REACH = 140 ** 2;

// Pair what's on screen with the target. Each step: {a: from, b: to, pop}.
function plan(src, dst) {
  const key = (r) => [r.x, r.y, r.w, r.h].map((v) => Math.round(v * 2)).join();
  const steps = [];
  let S2 = src,
    D2 = dst;
  // Lock pieces that share one offset (most often none: they're already in
  // place and only change brightness). Biggest group first, so a body that
  // moved as a whole (peek) moves as one instead of
  // swarming, then smaller groups, down to single pieces left in place.
  for (let pass = 0; pass < 4 && S2.length && D2.length; pass++) {
    const votes = new Map();
    S2.forEach((s) =>
      D2.forEach((d) => {
        if (Math.abs(s.w - d.w) > 0.5 || Math.abs(s.h - d.h) > 0.5) return;
        const ex = d.x - s.x,
          ey = d.y - s.y,
          k = `${Math.round(ex)},${Math.round(ey)}`,
          v = votes.get(k) || { n: 0, x: 0, y: 0, k };
        votes.set(k, { ...v, n: v.n + 1, x: v.x + ex, y: v.y + ey });
      }),
    );
    // raw votes only nominate offsets; score each by real one-to-one fits
    const have = new Map();
    D2.forEach((d) => have.set(key(d), (have.get(key(d)) || 0) + 1));
    const fits = (v) => {
      const left = new Map(have),
        dx = v.x / v.n,
        dy = v.y / v.n;
      return S2.reduce((n, s) => {
        const k = key({ ...s, x: s.x + dx, y: s.y + dy }),
          c = left.get(k);
        if (!c) return n;
        left.set(k, c - 1);
        return n + 1;
      }, 0);
    };
    const still = votes.get("0,0") || { n: 0, k: "0,0" },
      stillFit = still.n ? fits(still) : 0;
    let g = still,
      gFit = stillFit;
    [...votes.values()]
      .filter((v) => v.k !== "0,0" && v.n >= 12)
      .forEach((v) => {
        const f = fits(v);
        const enough =
          f >= 12 && f >= 0.3 * Math.min(S2.length, D2.length);
        if (enough && f > gFit * 1.2) (g = v), (gFit = f);
      });
    if (!gFit) break;
    const shared = g !== still,
      dx = g.x / g.n,
      dy = g.y / g.n,
      rigid = shared,
      left = new Map();
    D2.forEach((d) => {
      const k = key(d);
      if (!left.has(k)) left.set(k, []);
      left.get(k).push(d);
    });
    S2 = S2.filter((s) => {
      const l = left.get(key({ ...s, x: s.x + dx, y: s.y + dy }));
      if (!l || !l.length) return true;
      steps.push({ a: s, b: l.pop(), rigid });
      return false;
    });
    D2 = [...left.values()].flat();
    if (!shared) break;
  }
  // 2. the rest travel to their cheapest partner
  const cost = (a, b) =>
    d2(a, b) + 0.5 * ((a.w - b.w) ** 2 + (a.h - b.h) ** 2);
  const rowsSrc = S2.length <= D2.length,
    R = rowsSrc ? S2 : D2,
    C = rowsSrc ? D2 : S2,
    paired = new Uint8Array(C.length);
  if (R.length && C.length) {
    let match;
    if (R.length * C.length <= 300 * 300)
      match = assign(R.map((r) => C.map((c) => cost(r, c))));
    else {
      // huge sets: greedy nearest is plenty
      match = R.map((r) => {
        let bi = -1,
          bk = Infinity;
        C.forEach((c, j) => {
          const k = paired[j] ? Infinity : cost(r, c);
          if (k < bk) (bk = k), (bi = j);
        });
        if (bi >= 0) paired[bi] = 1;
        return bi;
      });
      paired.fill(0);
    }
    match.forEach((j, i) => {
      if (j < 0) return;
      paired[j] = 1;
      steps.push(rowsSrc ? { a: R[i], b: C[j] } : { a: C[j], b: R[i] });
    });
  }
  // 3. extras split off a neighbour (or pop in); leftovers merge (or shrink)
  C.forEach((c, j) => {
    if (paired[j]) return;
    if (rowsSrc) {
      const n = nearest(c, S2);
      steps.push(
        n.k < SPLIT_REACH
          ? { a: { ...n.c }, b: c }
          : { a: dot(c), b: c, pop: true },
      );
    } else {
      const n = nearest(c, D2);
      steps.push({
        a: c,
        b: n.k < SPLIT_REACH ? { ...n.c, o: 0 } : dot(c),
      });
    }
  });
  return steps;
}

const easeIO = (p) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeBack = (p) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
const lerp = (a, b, t) => a + (b - a) * t;
const SVGNS = "http://www.w3.org/2000/svg";

const M = {
  id: MORPH_MARK.id,
  steps: null, // the morph in flight, or the last one (its end = rest pose)
  raf: 0,
  layer: null, // tween <svg>
  settled: null, // the target's own animated <svg>
  fade: null,
  key: "",
  tour: 0,
};
const morphOrder = () => [MORPH_MARK.id, ...DESIGNS.map((d) => d.id)];

function liveAtoms() {
  if (M.layer && M.steps)
    return M.steps.map((s) => s.now).filter((r) => r.o > 0.01);
  if (M.settled) return snapLayer(M.settled);
  return [];
}
function dropLayers() {
  cancelAnimationFrame(M.raf);
  if (M.fade) M.fade.forEach((a) => a.cancel());
  M.fade = null;
  M.layer && M.layer.remove();
  M.settled && M.settled.remove();
  M.layer = M.settled = null;
}

function settle(crossfade) {
  const d = morphDesign(M.id),
    art = $("mart");
  const tmp = document.createElement("div");
  // no whole-body mood: the body stays at its neutral spot between morphs
  tmp.innerHTML = svgFor({ ...d, mood: "" }, {
    color: "currentColor",
    body: false,
    animated: S.anim,
    force: S.force,
    vb: MORPH_VB,
    label: "Omi, " + d.name,
  });
  const svg = tmp.firstChild;
  svg.classList.add("mlayer");
  art.appendChild(svg);
  M.settled = svg;
  M.key = `${S.anim}|${S.force}`;
  applySpeed();
  const tween = M.layer;
  if (!crossfade || !tween) {
    tween && tween.remove();
    M.layer = null;
    return;
  }
  // hand over to the live animation: fade it in, then fade the tween out
  const a = svg.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 180,
    easing: "ease-out",
  });
  M.fade = [a];
  a.finished
    .then(() => {
      const b = tween.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 240,
        easing: "ease-in",
        fill: "forwards",
      });
      M.fade = [b];
      return b.finished;
    })
    .then(() => {
      tween.remove();
      if (M.layer === tween) M.layer = null;
      M.fade = null;
    })
    .catch(() => {});
}

function morphTo(id) {
  const d = morphDesign(id);
  if (!d || (id === M.id && !M.layer)) return;
  const src = liveAtoms();
  dropLayers();
  M.id = id;
  syncMorphUI();
  const instant = RM.matches && !S.force;
  if (instant || !src.length) {
    M.steps = null;
    settle(false);
    return;
  }
  const steps = plan(src, atomsOf(d)),
    sp = Math.max(0.25, S.speed || 1),
    DUR = 620 / sp,
    STAGGER = 220 / sp;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute(
    "viewBox",
    `${MORPH_VB.x} ${MORPH_VB.y} ${MORPH_VB.w} ${MORPH_VB.h}`,
  );
  svg.setAttribute("class", "mlayer");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  const g = document.createElementNS(SVGNS, "g");
  g.setAttribute("fill", "currentColor");
  steps.forEach((s) => {
    // ripple out from the face; a body moving as one keeps one clock
    const c = ctr(s.b.w || s.b.h ? s.b : s.a);
    s.dl = s.rigid
      ? STAGGER * 0.25
      : Math.min(1, Math.hypot(c.x - MORPH_C.x, c.y - MORPH_C.y) / 260) *
        STAGGER;
    s.el = document.createElementNS(SVGNS, "rect");
    s.now = { ...s.a };
    g.appendChild(s.el);
  });
  svg.appendChild(g);
  $("mart").appendChild(svg);
  M.layer = svg;
  M.steps = steps;
  const draw = () => {
    steps.forEach(({ el, now: r }) => {
      el.setAttribute("x", r.x.toFixed(2));
      el.setAttribute("y", r.y.toFixed(2));
      el.setAttribute("width", Math.max(0, r.w).toFixed(2));
      el.setAttribute("height", Math.max(0, r.h).toFixed(2));
      el.setAttribute("opacity", Math.min(1, Math.max(0, r.o)).toFixed(3));
    });
  };
  draw();
  const t0 = performance.now();
  const tick = (now) => {
    const t = now - t0;
    steps.forEach((s) => {
      const p = Math.min(1, Math.max(0, (t - s.dl) / DUR)),
        e = easeIO(p),
        { a, b } = s;
      if (s.pop) {
        // pop in from the center with a little overshoot
        const k = easeBack(p),
          c = ctr(b);
        s.now = {
          x: c.x - (b.w * k) / 2,
          y: c.y - (b.h * k) / 2,
          w: b.w * k,
          h: b.h * k,
          o: lerp(0, b.o, Math.min(1, p * 3)),
        };
      } else
        s.now = {
          x: lerp(a.x, b.x, e),
          y: lerp(a.y, b.y, e),
          w: lerp(a.w, b.w, e),
          h: lerp(a.h, b.h, e),
          o: lerp(a.o, b.o, e),
        };
    });
    draw();
    if (t < DUR + STAGGER) M.raf = requestAnimationFrame(tick);
    else {
      // land exactly on the rest pose, then let the mode come alive
      M.steps = steps.filter((s) => s.b.o > 0.01 && s.b.w && s.b.h);
      settle(true);
    }
  };
  M.raf = requestAnimationFrame(tick);
}

function stopTour() {
  clearInterval(M.tour);
  M.tour = 0;
  syncMorphUI();
}
function toggleTour() {
  if (M.tour) return stopTour();
  const step = () => {
    const ids = morphOrder();
    morphTo(ids[(ids.indexOf(M.id) + 1) % ids.length]);
  };
  step();
  M.tour = setInterval(step, 2400 / Math.max(0.25, S.speed || 1));
  syncMorphUI();
}

function syncMorphUI() {
  document
    .querySelectorAll("#mpick .mbtn")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.id === M.id)),
    );
  const d = morphDesign(M.id);
  $("mname").textContent = d ? d.name : "";
  const t = $("mtour");
  t.setAttribute("aria-pressed", String(!!M.tour));
  t.textContent = M.tour ? "Stop tour" : "Play tour";
}

function renderMorph() {
  const pick = $("mpick");
  if (!pick._built) {
    pick._built = true;
    const btn = (d) =>
      `<button class="mbtn" data-id="${d.id}" aria-pressed="false">${d.name}</button>`;
    const groups = [...new Set(DESIGNS.map((d) => d.group))];
    pick.innerHTML =
      `<div class="mgroup"><h3>Start</h3><div class="mbtns">${btn(MORPH_MARK)}<button class="mbtn tour" id="mtour" aria-pressed="false">Play tour</button></div></div>` +
      groups
        .map(
          (g) =>
            `<div class="mgroup"><h3>${g}</h3><div class="mbtns">${DESIGNS.filter((d) => d.group === g).map(btn).join("")}</div></div>`,
        )
        .join("");
    pick.addEventListener("click", (e) => {
      const b = e.target.closest(".mbtn");
      if (!b) return;
      if (b.id === "mtour") return toggleTour();
      if (M.tour) stopTour();
      morphTo(b.dataset.id);
    });
    settle(false);
    syncMorphUI();
    return;
  }
  // animate / reduce-motion settings changed: rebuild the resting layer
  if (!M.layer && M.key !== `${S.anim}|${S.force}`) {
    dropLayers();
    settle(false);
  }
}
