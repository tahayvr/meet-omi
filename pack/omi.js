/* Omi player: draws Omi from an Omi pack (omi.json), plays every mode's
   animations and morphs from any mode into any other. No dependencies.

     const omi = new Omi(canvas, pack);   // pack = the parsed omi.json
     omi.set("thinking");                 // morph there from wherever Omi is
     omi.set("idle", { instant: true });  // or jump
     omi.addEventListener("settled", () => …);   // a morph landed

   Options (also settable later as properties):
     color        fill color; null follows the canvas's CSS `color`
     speed        animation and morph speed, 1 = normal
     animate      false shows each mode at rest, with no loops
     bodyMotion   false leaves out whole-body moves (bob, hop, shake)
     mode         the mode to start in (default "mark", the plain logo)
     view         [x, y, w, h] to show, instead of the pack's view

   Everything Omi shows is a list of axis-aligned rects with an opacity, so
   each frame is: work out the rects, fill them. README.md in the pack
   describes the format and the morph step by step; this file follows it. */
(function (root) {
  "use strict";

  /* ---------- animations ---------- */
  const REST = { tx: 0, ty: 0, sx: 1, sy: 1, op: 1 },
    CHANNELS = [["tx", "ty", "sx", "sy"], ["op"]];
  function bezier([x1, y1, x2, y2]) {
    const at = (a, b, t) =>
      3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return (p) => {
      if (p <= 0 || p >= 1) return p;
      let lo = 0,
        hi = 1,
        t = p;
      for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (at(x1, x2, t) < p) lo = t;
        else hi = t;
      }
      return at(y1, y2, t);
    };
  }
  // Ready an animation: its easing and the keys of each channel.
  function prepare(a) {
    a.fn = a.ease === "steps" ? (p) => (p >= 1 ? 1 : 0) : bezier(a.ease);
    a.channels = CHANNELS.map((props) => {
      const ks = a.keys.filter(([, v]) => props.some((q) => q in v));
      if (!ks.length) return null;
      if (ks[0][0] > 0) ks.unshift([0, {}]);
      if (ks[ks.length - 1][0] < 1) ks.push([1, {}]);
      return { props, ks };
    });
    return a;
  }
  // How an animated piece looks t seconds in, on top of its rest position.
  function look(a, t, piece) {
    const out = { ...REST };
    if (!a) return out;
    const dur = piece.duration || a.duration,
      p = ((((t - (piece.delay || 0)) / dur) % 1) + 1) % 1,
      val = (v, q) =>
        v == null ? REST[q] : Array.isArray(v) ? (piece[v[0]] || 0) * v[1] : v;
    for (const ch of a.channels) {
      if (!ch) continue;
      const { props, ks } = ch;
      let i = 1;
      while (i < ks.length - 1 && p > ks[i][0]) i++;
      const [p0, v0] = ks[i - 1],
        [p1, v1] = ks[i],
        k = p1 === p0 ? 1 : a.fn((p - p0) / (p1 - p0));
      for (const q of props) {
        const A = val(v0[q], q),
          B = val(v1[q], q);
        out[q] = A + (B - A) * k;
      }
    }
    return out;
  }

  /* ---------- rects ---------- */
  function clipTo(r, b) {
    const x = Math.max(r.x, b.x),
      y = Math.max(r.y, b.y),
      x2 = Math.min(r.x + r.w, b.x + b.w),
      y2 = Math.min(r.y + r.h, b.y + b.h);
    return x2 - x > 0.01 && y2 - y > 0.01
      ? { ...r, x, y, w: x2 - x, h: y2 - y }
      : null;
  }
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const dist2 = (a, b) => {
    const p = center(a),
      q = center(b);
    return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  };

  /* ---------- morph planning ---------- */
  const FACE = new Set(["eye", "brow", "mouth", "tear"]),
    BAN = 1e9;

  // Minimum-cost assignment (Hungarian, rows <= cols): row -> col.
  function assign(cost) {
    const n = cost.length,
      m = n ? cost[0].length : 0,
      u = new Float64Array(n + 1),
      v = new Float64Array(m + 1),
      p = new Int32Array(m + 1),
      way = new Int32Array(m + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(m + 1).fill(Infinity),
        used = new Uint8Array(m + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0],
          row = cost[i0 - 1];
        let delta = Infinity,
          j1 = 0;
        for (let j = 1; j <= m; j++)
          if (!used[j]) {
            const cur = row[j - 1] - u[i0] - v[j];
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

  class Planner {
    constructor(pack) {
      const m = pack.morph;
      this.reach2 = m.splitReach ** 2;
      this.penalty = m.rolePenalty ** 2;
      this.roleIx = Object.fromEntries(pack.roles.map((r, i) => [r, i]));
      // the logo itself: the plain "mark" mode
      const mark = pack.modes.find((d) => d.id === "mark");
      this.logo = mark ? mark.pieces : [];
    }
    rolePenalty(a, b) {
      if (a.role === b.role) return 0;
      if (
        (a.role === "frame" && FACE.has(b.role)) ||
        (b.role === "frame" && FACE.has(a.role))
      )
        return BAN;
      return this.penalty;
    }
    // A piece on the grid or touching the logo, cut along the grid lines.
    cells(r) {
      const on = (v) => Math.abs(v / 20 - Math.round(v / 20)) < 1e-6,
        aligned = [r.x, r.y, r.x + r.w, r.y + r.h].every(on),
        touches = this.logo.some(
          (L) =>
            r.x < L.x + L.w && r.x + r.w > L.x && r.y < L.y + L.h && r.y + r.h > L.y,
        );
      if (!aligned && !touches) return [r];
      const cuts = (a, b) => {
        const o = [a];
        for (let v = Math.floor(a / 20) * 20 + 20; v < b - 1e-6; v += 20) o.push(v);
        o.push(b);
        return o;
      };
      const xs = cuts(r.x, r.x + r.w),
        ys = cuts(r.y, r.y + r.h),
        out = [];
      for (let i = 0; i < xs.length - 1; i++)
        for (let j = 0; j < ys.length - 1; j++)
          out.push({
            ...r,
            x: xs[i],
            y: ys[j],
            w: xs[i + 1] - xs[i],
            h: ys[j + 1] - ys[j],
          });
      return out;
    }
    // A number that is equal for two rects in the same place, of the same
    // size and role (half-unit precision).
    key(r, dx = 0, dy = 0) {
      const q = (v) => Math.round(v * 2) + 4096;
      return (
        (((q(r.x + dx) * 8192 + q(r.y + dy)) * 4096 + q(r.w)) * 4096 + q(r.h)) *
          8 +
        (this.roleIx[r.role] || 0)
      );
    }
    nearest(r, list) {
      let best = null,
        k = Infinity,
        score = Infinity;
      for (const c of list) {
        const pen = this.rolePenalty(r, c);
        if (pen >= BAN) continue;
        const d = dist2(r, c);
        if (d + pen < score) (score = d + pen), (k = d), (best = c);
      }
      return { c: best, k };
    }
    // Pair what's on screen with the target. Each step: {a: from, b: to, pop}.
    plan(src, dst) {
      const steps = [];
      let S = src,
        D = dst;
      // 1. Pieces that share one offset move together; most often the offset
      //    is zero (already in place). The biggest group goes first, so a body
      //    that moved as a whole moves as one.
      for (let pass = 0; pass < 4 && S.length && D.length; pass++) {
        const have = new Map();
        for (const d of D) {
          const k = this.key(d);
          have.set(k, (have.get(k) || 0) + 1);
        }
        const fits = (dx, dy) => {
          const left = new Map(have);
          let n = 0;
          for (const s of S) {
            const k = this.key(s, dx, dy),
              c = left.get(k);
            if (c) left.set(k, c - 1), n++;
          }
          return n;
        };
        // offsets proposed by same-size, same-role pairs
        const votes = new Map();
        for (const s of S)
          for (const d of D) {
            if (s.role !== d.role || Math.abs(s.w - d.w) > 0.5 || Math.abs(s.h - d.h) > 0.5)
              continue;
            const ex = d.x - s.x,
              ey = d.y - s.y,
              k = (Math.round(ex) + 4096) * 8192 + Math.round(ey) + 4096,
              v = votes.get(k);
            if (v) v.n++, (v.x += ex), (v.y += ey);
            else votes.set(k, { n: 1, x: ex, y: ey });
          }
        const stillV = votes.get(4096 * 8192 + 4096),
          stillFit = stillV ? fits(stillV.x / stillV.n, stillV.y / stillV.n) : 0,
          enough = Math.max(12, 0.3 * Math.min(S.length, D.length));
        let g = stillV,
          gFit = stillFit;
        for (const v of votes.values()) {
          if (v === stillV || v.n < enough) continue;
          const f = fits(v.x / v.n, v.y / v.n);
          if (f >= enough && f > gFit * 1.2) (g = v), (gFit = f);
        }
        if (!gFit) break;
        const shared = g !== stillV,
          dx = g.x / g.n,
          dy = g.y / g.n,
          left = new Map();
        for (const d of D) {
          const k = this.key(d);
          if (!left.has(k)) left.set(k, []);
          left.get(k).push(d);
        }
        S = S.filter((s) => {
          const l = left.get(this.key(s, dx, dy));
          if (!l || !l.length) return true;
          steps.push({ a: s, b: l.pop(), rigid: shared });
          return false;
        });
        D = [...left.values()].flat();
        if (!shared) break;
      }
      // 2. The rest travel to their cheapest partner, by distance, size and
      //    role. Frame and face never pair.
      const cost = (a, b) =>
        dist2(a, b) + 0.5 * ((a.w - b.w) ** 2 + (a.h - b.h) ** 2) + this.rolePenalty(a, b);
      const rowsSrc = S.length <= D.length,
        R = rowsSrc ? S : D,
        C = rowsSrc ? D : S,
        usedS = new Set(),
        usedD = new Set();
      if (R.length && C.length) {
        const match = assign(R.map((r) => C.map((c) => cost(r, c))));
        match.forEach((j, i) => {
          if (j < 0 || this.rolePenalty(R[i], C[j]) >= BAN) return;
          const a = rowsSrc ? R[i] : C[j],
            b = rowsSrc ? C[j] : R[i];
          steps.push({ a, b });
          usedS.add(a);
          usedD.add(b);
        });
      }
      // 3. New pieces split off their nearest piece (or grow from their own
      //    center); old ones slide into their nearest new piece and fade (or
      //    shrink away).
      for (const d of D) {
        if (usedD.has(d)) continue;
        const n = this.nearest(d, S);
        steps.push(
          n.k < this.reach2
            ? { a: { ...n.c, role: d.role }, b: d }
            : { a: { ...center(d), w: 0, h: 0, o: 0, role: d.role }, b: d, pop: true },
        );
      }
      for (const s of S) {
        if (usedS.has(s)) continue;
        const n = this.nearest(s, D);
        steps.push({
          a: s,
          b: n.k < this.reach2 ? { ...n.c, o: 0 } : { ...center(s), w: 0, h: 0, o: 0 },
        });
      }
      return steps;
    }
  }

  /* ---------- the player ---------- */
  // without a browser frame loop (tests, other hosts), call omi.frame(ms)
  const raf =
      typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : null,
    noRaf = typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame : () => {};
  const lerp = (a, b, t) => a + (b - a) * t,
    easeBack = (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;

  class Omi extends EventTarget {
    constructor(canvas, pack, opts = {}) {
      super();
      if (!pack || pack.format !== "omi-pack" || pack.version !== 1)
        throw new Error("Omi: expected an Omi pack, format version 1");
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.pack = pack;
      this.anims = {};
      for (const [k, a] of Object.entries(pack.animations))
        this.anims[k] = prepare({ ...a });
      this.modes = Object.fromEntries(pack.modes.map((m) => [m.id, m]));
      this.planner = new Planner(pack);
      this.morphEase = bezier(pack.morph.ease);
      this.color = opts.color ?? null;
      this.speed = opts.speed ?? 1;
      this.view = opts.view || pack.view;
      this._animate = opts.animate ?? true;
      this._bodyMotion = opts.bodyMotion ?? true;
      this.mode = this.modes[opts.mode] ? opts.mode : "mark";
      this.t = 0; // seconds into the current mode's loops
      this.morph = null;
      this._raf = 0;
      this._last = 0;
      this._tick = (ts) => this.frame(ts);
      // redraw when a real canvas on a page changes size
      if (
        typeof ResizeObserver !== "undefined" &&
        typeof Element !== "undefined" &&
        canvas instanceof Element
      ) {
        this._ro = new ResizeObserver(() => this.draw());
        this._ro.observe(canvas);
      }
      this.wake();
    }

    get animate() {
      return this._animate;
    }
    set animate(on) {
      this._animate = !!on;
      this.t = 0; // a mode at rest is time 0
      this.wake();
    }
    get bodyMotion() {
      return this._bodyMotion;
    }
    set bodyMotion(on) {
      this._bodyMotion = !!on;
      this.wake();
    }

    /* Change mode. Morphs from exactly what is on screen now, mid-loop or
       mid-morph; { instant: true } jumps. */
    set(id, { instant = false } = {}) {
      const mode = this.modes[id];
      if (!mode) throw new Error(`Omi: no mode "${id}"`);
      if (id === this.mode && !this.morph) return;
      const from = this.rects(),
        to = this.restRects(mode);
      this.mode = id;
      this.t = 0;
      if (instant || !from.length) {
        this.morph = null;
        this.wake();
        this.dispatchEvent(new Event("settled"));
        return;
      }
      const P = this.planner,
        cut = (list) => list.flatMap((r) => P.cells(r)),
        steps = P.plan(cut(from), cut(to)),
        { stagger, center: [cx, cy] } = this.pack.morph;
      for (const s of steps) {
        const c = center(s.b.w || s.b.h ? s.b : s.a);
        s.delay = s.rigid
          ? stagger * 0.25
          : Math.min(1, Math.hypot(c.x - cx, c.y - cy) / 260) * stagger;
        s.now = { ...s.a };
      }
      this.morph = { steps, t: 0 };
      this.wake();
    }

    // The rects of a mode t seconds into its loops (t = 0: at rest).
    modeRects(mode, t) {
      const A = this.anims,
        body = this._bodyMotion && mode.anim ? look(A[mode.anim], t, {}) : null,
        win = mode.clip,
        layer = win && win.anim ? look(A[win.anim], t, {}) : null,
        [bx, by, bw, bh] = mode.bounds,
        cx = bx + bw / 2,
        cy = by + bh / 2,
        out = [];
      // pieces seen through the window first, then the rest
      const order = win
        ? [...mode.pieces.filter((p) => p.clip), ...mode.pieces.filter((p) => !p.clip)]
        : mode.pieces;
      for (const p of order) {
        const m = look(A[p.anim], t, p),
          w = p.w * m.sx,
          h = p.h * m.sy;
        let r = {
          x: p.x + p.w / 2 - w / 2 + m.tx,
          y: p.y + p.h / 2 - h / 2 + m.ty,
          w,
          h,
          o: (p.opacity ?? 1) * m.op,
          role: p.role,
        };
        if (p.clip && win) {
          if (layer) (r.x += layer.tx), (r.y += layer.ty);
          r = clipTo(r, win);
          if (!r) continue;
        }
        if (body)
          r = {
            ...r,
            x: cx + (r.x - cx) * body.sx + body.tx,
            y: cy + (r.y - cy) * body.sy + body.ty,
            w: r.w * body.sx,
            h: r.h * body.sy,
          };
        out.push(r);
      }
      return out;
    }
    restRects(mode) {
      return this.modeRects(mode, 0).filter((r) => r.o > 0.001);
    }
    // What is on screen right now.
    rects() {
      if (this.morph) return this.morph.steps.map((s) => ({ ...s.now, role: s.b.role || s.a.role }));
      return this.modeRects(this.modes[this.mode], this._animate ? this.t : 0).filter(
        (r) => r.o > 0.001,
      );
    }

    // Keep drawing while something moves; sleep otherwise.
    wake() {
      if (!this._raf && raf) {
        this._last = 0;
        this._raf = raf(this._tick);
      }
      this.draw();
    }
    frame(ts) {
      // never backwards (a host's clock may restart), never a big jump
      const dt = this._last ? Math.min(0.1, Math.max(0, (ts - this._last) / 1000)) : 0;
      this._last = ts;
      const sp = Math.max(0.05, this.speed);
      if (this.morph) this.stepMorph(dt * sp);
      else if (this._animate) this.t += dt * sp;
      this.draw();
      this._raf = raf && (this.morph || this._animate) ? raf(this._tick) : 0;
    }
    stepMorph(dt) {
      const M = this.morph,
        { duration, stagger } = this.pack.morph;
      M.t += dt;
      for (const s of M.steps) {
        const p = Math.min(1, Math.max(0, (M.t - s.delay) / duration)),
          { a, b } = s;
        if (s.pop) {
          // grow from the center with a little overshoot
          const k = easeBack(p),
            c = center(b);
          s.now = {
            x: c.x - (b.w * k) / 2,
            y: c.y - (b.h * k) / 2,
            w: b.w * k,
            h: b.h * k,
            o: b.o * Math.min(1, p * 3),
          };
        } else {
          const e = this.morphEase(p);
          s.now = {
            x: lerp(a.x, b.x, e),
            y: lerp(a.y, b.y, e),
            w: lerp(a.w, b.w, e),
            h: lerp(a.h, b.h, e),
            o: lerp(a.o, b.o, e),
          };
        }
      }
      if (M.t >= duration + stagger) {
        // landed on the rest pose: the mode's loops start at t = 0
        this.morph = null;
        this.t = 0;
        this.dispatchEvent(new Event("settled"));
      }
    }

    draw() {
      const cv = this.canvas,
        dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1,
        W = Math.round((cv.clientWidth || cv.width) * dpr),
        H = Math.round((cv.clientHeight || cv.height) * dpr);
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) (cv.width = W), (cv.height = H);
      const ctx = this.ctx,
        [vx, vy, vw, vh] = this.view,
        s = Math.min(W / vw, H / vh),
        ox = (W - vw * s) / 2 - vx * s,
        oy = (H - vh * s) / 2 - vy * s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = this.color || getComputedStyle(cv).color;
      for (const r of this.rects()) {
        if (r.o <= 0.001 || r.w <= 0 || r.h <= 0) continue;
        // snap edges to device pixels: crisp, and neighbours meet exactly
        const x0 = Math.round(r.x * s + ox),
          y0 = Math.round(r.y * s + oy),
          x1 = Math.round((r.x + r.w) * s + ox),
          y1 = Math.round((r.y + r.h) * s + oy);
        if (x1 <= x0 || y1 <= y0) continue;
        ctx.globalAlpha = Math.min(1, r.o);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      ctx.globalAlpha = 1;
    }

    destroy() {
      noRaf(this._raf);
      this._raf = 0;
      this._ro && this._ro.disconnect();
    }
  }

  Omi.look = look;
  Omi.prepare = prepare;
  if (typeof module !== "undefined" && module.exports) module.exports = Omi;
  else root.Omi = Omi;
})(typeof window !== "undefined" ? window : globalThis);
