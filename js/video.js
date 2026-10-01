/* ---------- motion engine (mirrors the CSS keyframes, for video) ---------- */
const HAS_ENCODER = typeof VideoEncoder !== "undefined";
const MP4 =
  HAS_ENCODER ||
  !!(
    window.MediaRecorder &&
    ["video/mp4;codecs=avc1", "video/mp4"].some((t) =>
      MediaRecorder.isTypeSupported(t),
    )
  );
const WEBM =
  HAS_ENCODER ||
  !!(
    window.MediaRecorder &&
    ["video/webm;codecs=vp9", "video/webm"].some((t) =>
      MediaRecorder.isTypeSupported(t),
    )
  );
const ease = (p) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
function kf(frames, p, fn = ease) {
  for (let i = 1; i < frames.length; i++) {
    const [p1, v1] = frames[i];
    if (p <= p1) {
      const [p0, v0] = frames[i - 1],
        k = p1 === p0 ? 1 : fn((p - p0) / (p1 - p0)),
        out = {};
      for (const key in v1)
        out[key] = v0[key] + (v1[key] - v0[key]) * k;
      return out;
    }
  }
  return frames[frames.length - 1][1];
}
const ph = (t, dur, delay = 0) => ((((t - delay) / dur) % 1) + 1) % 1;
const MOODS = {
  "m-bob": (t, W, H) => ({
    ty:
      kf(
        [
          [0, { v: 0 }],
          [0.5, { v: -0.04 }],
          [1, { v: 0 }],
        ],
        ph(t, 2.8),
      ).v * H,
  }),
  "m-happy": (t, W, H) => ({
    ty:
      kf(
        [
          [0, { v: 0 }],
          [0.2, { v: -0.1 }],
          [0.4, { v: 0 }],
          [0.5, { v: -0.04 }],
          [0.6, { v: 0 }],
          [1, { v: 0 }],
        ],
        ph(t, 1.6),
      ).v * H,
  }),
  "m-slow": (t, W, H) => ({
    ty:
      kf(
        [
          [0, { v: 0 }],
          [0.5, { v: -0.04 }],
          [1, { v: 0 }],
        ],
        ph(t, 5),
      ).v * H,
  }),
  "m-beat": (t, W, H) => ({
    s: kf(
      [
        [0, { v: 1 }],
        [0.1, { v: 1.06 }],
        [0.2, { v: 1 }],
        [0.3, { v: 1.04 }],
        [0.4, { v: 1 }],
        [1, { v: 1 }],
      ],
      ph(t, 1.2),
    ).v,
  }),
  "m-error": (t, W, H) => ({
    tx:
      kf(
        [
          [0, { v: 0 }],
          [0.7, { v: 0 }],
          [0.74, { v: -0.03 }],
          [0.8, { v: 0.03 }],
          [0.86, { v: -0.02 }],
          [0.92, { v: 0.02 }],
          [1, { v: 0 }],
        ],
        ph(t, 2.2),
      ).v * W,
  }),
};
function partAnim(c, t, r) {
  const o = { tx: 0, ty: 0, sx: 1, sy: 1, op: 1 };
  if (!c) return o;
  const has = (k) => c.split(" ").includes(k);
  if (has("eye"))
    o.sy = kf(
      [
        [0, { v: 1 }],
        [0.9, { v: 1 }],
        [0.94, { v: 0.1 }],
        [1, { v: 1 }],
      ],
      ph(t, 4),
    ).v;
  if (has("cur")) o.op = ph(t, 1.05) < 0.5 ? 1 : 0;
  if (has("dot"))
    o.op = kf(
      [
        [0, { v: 0.25 }],
        [0.3, { v: 1 }],
        [1, { v: 0.25 }],
      ],
      ph(t, 1.2, has("dot2") ? 0.2 : has("dot3") ? 0.4 : 0),
    ).v;
  if (has("z")) {
    const p = ph(t, 2.6, has("z2") ? 0.87 : has("z3") ? 1.73 : 0),
      e = easeOut(p);
    o.tx = 10 * e;
    o.ty = -24 * e;
    o.op = p < 0.3 ? easeOut(p / 0.3) : 1 - (p - 0.3) / 0.7;
  }
  if (r && r.chase) {
    const p = ph(t, r.dur, r.dl),
      f = r.floor != null ? r.floor : 0.2;
    o.op = p < r.tail ? 1 - (p / r.tail) * (1 - f) : f;
  }
  if (has("ripple"))
    o.op = kf(
      [
        [0, { v: 0.3 }],
        [0.2, { v: 1 }],
        [0.6, { v: 0.3 }],
        [1, { v: 0.3 }],
      ],
      ph(t, 0.8, (r && r.dl) || 0),
    ).v;
  if (has("breathe"))
    o.op = kf(
      [
        [0, { v: 0.35 }],
        [0.5, { v: 1 }],
        [1, { v: 0.35 }],
      ],
      ph(t, 4),
    ).v;
  if (has("pop"))
    o.op = kf(
      [
        [0, { v: 0.35 }],
        [0.2, { v: 1 }],
        [0.6, { v: 0.35 }],
        [1, { v: 0.35 }],
      ],
      ph(t, 1.6),
    ).v;
  if (has("flash"))
    o.op = kf(
      [
        [0, { v: 1 }],
        [0.7, { v: 1 }],
        [0.74, { v: 0.2 }],
        [0.8, { v: 1 }],
        [0.86, { v: 0.2 }],
        [0.92, { v: 1 }],
        [1, { v: 1 }],
      ],
      ph(t, 2.2),
    ).v;
  if (has("sn")) {
    const p = ph(t, SNAKE_DUR, (r.i / SNAKE_N) * SNAKE_DUR);
    o.op = p < 0.216 ? 1 - (p / 0.216) * 0.85 : 0.15;
  }
  if (has("drop")) {
    const v = kf(
      [
        [0, { y: -10, o: 0 }],
        [0.3, { y: 0, o: 1 }],
        [0.75, { y: 10, o: 1 }],
        [1, { y: 20, o: 0 }],
      ],
      ph(t, 1.2),
    );
    o.ty = v.y;
    o.op = v.o;
  }
  if (has("unplug"))
    o.ty = kf(
      [
        [0, { v: 0 }],
        [0.62, { v: 0 }],
        [0.68, { v: -10 }],
        [0.72, { v: -10 }],
        [0.78, { v: 0 }],
        [1, { v: 0 }],
      ],
      ph(t, 3.2),
    ).v;
  if (has("led"))
    o.op = kf(
      [
        [0, { v: 0.15 }],
        [0.5, { v: 1 }],
        [1, { v: 0.15 }],
      ],
      ph(t, 3),
    ).v;
  if (r && r.hole) {
    const p = ph(t, r.dur, r.dl);
    o.op = p < 0.05 ? p / 0.05 : 1;
  }
  if (has("rise")) {
    const v = kf(
      [
        [0, { y: 10, o: 0 }],
        [0.3, { y: 0, o: 1 }],
        [0.75, { y: -10, o: 1 }],
        [1, { y: -20, o: 0 }],
      ],
      ph(t, 1.2),
    );
    o.ty = v.y;
    o.op = v.o;
  }
  if (has("conf")) {
    const p = ph(t, 1.6, r.dl),
      e = easeOut(p);
    o.tx = r.mx * e;
    o.ty = r.my * e;
    o.op = 1 - p;
  }
  if (has("gl"))
    o.tx = kf(
      [
        [0, { v: 0 }],
        [0.86, { v: 0 }],
        [0.88, { v: -8 }],
        [0.9, { v: 6 }],
        [0.92, { v: -3 }],
        [0.94, { v: 0 }],
        [1, { v: 0 }],
      ],
      ph(t, 2.4, r.dl),
      (p) => p,
    ).v;
  if (has("rain")) {
    const p = ph(t, 1.4, r.dl);
    o.ty = 160 * p;
    o.op = p < 0.1 ? p / 0.1 : 1 - p;
  }
  if (has("tile"))
    o.op = kf(
      [
        [0, { v: 0 }],
        [0.05, { v: 0 }],
        [0.12, { v: 1 }],
        [0.85, { v: 1 }],
        [0.95, { v: 0 }],
        [1, { v: 0 }],
      ],
      ph(t, 3, r.dl),
    ).v;
  if (has("lid"))
    o.ty = kf(
      [
        [0, { v: 0 }],
        [0.2, { v: 0 }],
        [0.35, { v: -60 }],
        [0.7, { v: -60 }],
        [0.85, { v: 0 }],
        [1, { v: 0 }],
      ],
      ph(t, 2.4),
    ).v;
  if (has("trav"))
    o.tx = kf(
      [
        [0, { v: 0 }],
        [0.5, { v: 40 }],
        [1, { v: 0 }],
      ],
      ph(t, 1.6),
    ).v;
  if (has("look"))
    o.tx = kf(
      [
        [0, { v: -10 }],
        [0.5, { v: 10 }],
        [1, { v: -10 }],
      ],
      ph(t, 3),
    ).v;
  if (has("scan"))
    o.tx = kf(
      [
        [0, { v: -30 }],
        [0.5, { v: 30 }],
        [1, { v: -30 }],
      ],
      ph(t, 1.6),
    ).v;
  if (has("arrow")) {
    const v = kf(
      [
        [0, { y: -4, o: 0.4 }],
        [0.5, { y: 4, o: 1 }],
        [1, { y: -4, o: 0.4 }],
      ],
      ph(t, 1.2),
    );
    o.ty = v.y;
    o.op = v.o;
  }
  if (has("pulse")) {
    o.sx = kf(
      [
        [0, { v: 1 }],
        [0.5, { v: 1.5 }],
        [1, { v: 1 }],
      ],
      ph(t, 0.8),
    ).v;
  }
  if (has("hb")) {
    // scale about the heart's center, not each rect's own center
    const s = kf(
      [
        [0, { v: 1 }],
        [0.1, { v: 1.35 }],
        [0.2, { v: 1 }],
        [0.3, { v: 1.2 }],
        [0.4, { v: 1 }],
        [1, { v: 1 }],
      ],
      ph(t, 1.2),
    ).v;
    o.sx = o.sy = s;
    o.tx = (r.x + r.w / 2 - r.hx) * (s - 1);
    o.ty = (r.y + r.h / 2 - r.hy) * (s - 1);
  }
  if (has("pulseop"))
    o.op = kf(
      [
        [0, { v: 1 }],
        [0.5, { v: 0.35 }],
        [1, { v: 1 }],
      ],
      ph(t, 1.2),
    ).v;
  if (has("arm"))
    o.ty = kf(
      [
        [0, { v: 0 }],
        [0.5, { v: -12 }],
        [1, { v: 0 }],
      ],
      ph(t, 1.4),
    ).v;
  if (has("shades")) {
    const v = kf(
      [
        [0, { y: -140, o: 0 }],
        [0.18, { y: 0, o: 1 }],
        [0.88, { y: 0, o: 1 }],
        [1, { y: 0, o: 0 }],
      ],
      ph(t, 3.6),
    );
    o.ty = v.y;
    o.op = v.o;
  }
  if (has("ch")) {
    const n = +(c.match(/ch(\d)/) || [0, 1])[1],
      p = ph(t, 3.2, (n - 1) * 0.25);
    o.op = p < 0.1 ? 0 : p < 0.86 ? 1 : 0;
  }
  return o;
}
function drawRects(ctx, rects, t) {
  for (const r of rects) {
    const a = partAnim(r.c, t, r);
    if (a.op <= 0.001) continue;
    ctx.globalAlpha = Math.min(1, a.op) * (r.o != null ? r.o : 1);
    const cx = r.x + r.w / 2,
      cy = r.y + r.h / 2,
      w = r.w * a.sx,
      h = r.h * a.sy;
    ctx.fillRect(cx - w / 2 + a.tx, cy - h / 2 + a.ty, w, h);
  }
  ctx.globalAlpha = 1;
}
function drawFrame(ctx, d, t, vb, size, color, bg, hgt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, hgt || size);
  const s = size / vb.w;
  ctx.setTransform(s, 0, 0, s, -vb.x * s, -vb.y * s);
  ctx.fillStyle = color;
  const sh = shapes(d, X.body);
  if (sh.inner) {
    const p = ph(t, 4.5),
      ty = kf(
        [
          [0, { v: 180 }],
          [0.25, { v: 0 }],
          [0.75, { v: 0 }],
          [1, { v: 180 }],
        ],
        p,
      ).v;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-60, -130, 440, 450);
    ctx.clip();
    ctx.translate(0, ty);
    drawRects(ctx, sh.inner, t);
    ctx.restore();
    drawRects(ctx, sh.outer, t);
    return;
  }
  const m = d.mood && X.anim !== null ? MOODS[d.mood] : null;
  ctx.save();
  if (m) {
    const g = m(t, sh.box.x2 - sh.box.x, sh.box.y2 - sh.box.y);
    ctx.translate(g.tx || 0, g.ty || 0);
    if (g.s) {
      const cx = (sh.box.x + sh.box.x2) / 2,
        cy = (sh.box.y + sh.box.y2) / 2;
      ctx.translate(cx, cy);
      ctx.scale(g.s, g.s);
      ctx.translate(-cx, -cy);
    }
  }
  drawRects(ctx, sh.rects, t);
  ctx.restore();
}
/* ---------- video encoding ---------- */
// Preferred path: WebCodecs renders every frame at its exact time (no dropped
// frames) and encodes H.264 High / VP9 at a high bitrate. The muxers are only
// loaded when someone actually exports a video.
const VIDEO_FPS = 60;
const MUXERS = {
  mp4: { src: "js/vendor/mp4-muxer.js", global: "Mp4Muxer", codec: "avc" },
  webm: { src: "js/vendor/webm-muxer.js", global: "WebMMuxer", codec: "V_VP9" },
};
const ENCODER_CODECS = {
  // H.264 High profile, levels 5.2 → 4.0, then Main / Baseline as fallbacks
  mp4: ["avc1.640034", "avc1.640033", "avc1.640028", "avc1.4d0034", "avc1.42003e"],
  // VP9 profile 0, levels 5.1 → 4.1 → 1.0
  webm: ["vp09.00.51.08", "vp09.00.41.08", "vp09.00.10.08"],
};
const scriptCache = {};
const loadScript = (src) =>
  (scriptCache[src] ||= new Promise((res, rej) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = res;
    el.onerror = () => {
      delete scriptCache[src];
      rej(new Error("Couldn\u2019t load the video muxer."));
    };
    document.head.appendChild(el);
  }));

async function pickEncoderConfig(kind, width, height) {
  const bitrate = Math.min(
    Math.round(width * height * VIDEO_FPS * 0.3),
    80_000_000,
  );
  for (const codec of ENCODER_CODECS[kind]) {
    const config = {
      codec,
      width,
      height,
      bitrate,
      framerate: VIDEO_FPS,
      latencyMode: "quality",
      ...(kind === "mp4" ? { avc: { format: "avc" } } : {}),
    };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported)
        return config;
    } catch (e) {}
  }
  return null;
}

async function encodeVideo(d, kind) {
  const o = outSize(),
    even = (n) => Math.max(2, Math.round(n / 2) * 2),
    secs = +X.vlen,
    frames = Math.round(secs * VIDEO_FPS);
  // H.264 caps the frame area (square 4K is too big), so step down until
  // the encoder accepts it rather than dropping to the real-time recorder.
  let width = o.w,
    height = o.h,
    config = null;
  for (let k = 1; k > 0.3 && !config; k -= 0.1) {
    width = even(o.w * k);
    height = even(o.h * k);
    config = await pickEncoderConfig(kind, width, height);
  }
  if (!config) return null;
  if (width !== o.w)
    toast(`${width}\u00d7${height} is the largest ${kind.toUpperCase()} size here.`);
  const M = MUXERS[kind];
  await loadScript(M.src);
  const lib = window[M.global];
  const muxer = new lib.Muxer({
    target: new lib.ArrayBufferTarget(),
    video: { codec: M.codec, width, height, frameRate: VIDEO_FPS },
    ...(kind === "mp4" ? { fastStart: "in-memory" } : {}),
  });
  let failed = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failed = e),
  });
  encoder.configure(config);

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { alpha: false });
  const vb = frameBox(
    shapes(d, X.body).box,
    Math.max(+X.pad, 0.1),
    width / height,
  );
  const bg = exportBg(),
    color = X.fg,
    us = 1e6 / VIDEO_FPS;
  toast(`Encoding ${d.name}\u2026`);
  for (let i = 0; i < frames; i++) {
    if (failed) throw failed;
    drawFrame(ctx, d, (i / VIDEO_FPS) * X.speed, vb, width, color, bg, height);
    const frame = new VideoFrame(c, { timestamp: Math.round(i * us), duration: Math.round(us) });
    encoder.encode(frame, { keyFrame: i % (VIDEO_FPS * 2) === 0 });
    frame.close();
    // keep the encoder queue short so memory stays flat on long 4K exports
    while (encoder.encodeQueueSize > 8)
      await new Promise((r) => setTimeout(r, 0));
    if (i % VIDEO_FPS === 0)
      toast(`Encoding ${d.name}, ${Math.round((i / frames) * 100)}%\u2026`);
  }
  await encoder.flush();
  encoder.close();
  if (failed) throw failed;
  muxer.finalize();
  return new Blob([muxer.target.buffer], {
    type: kind === "mp4" ? "video/mp4" : "video/webm",
  });
}

async function recordVideo(d, kind) {
  if (HAS_ENCODER) {
    const blob = await encodeVideo(d, kind);
    if (blob) return blob;
  }
  return recordRealtime(d, kind);
}

// Fallback for browsers without WebCodecs: capture the canvas in real time.
async function recordRealtime(d, kind) {
  if (!window.MediaRecorder)
    throw new Error(
      (kind === "mp4" ? "MP4" : "WebM") +
        " recording isn\u2019t supported in this browser.",
    );
  const o = outSize(),
    size = o.w,
    hgt = o.h,
    secs = +X.vlen,
    fps = 30;
  const types =
    kind === "mp4"
      ? ["video/mp4;codecs=avc1", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm"];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime)
    throw new Error(
      (kind === "mp4" ? "MP4" : "WebM") +
        " recording isn\u2019t supported in this browser.",
    );
  const c = document.createElement("canvas");
  c.width = size;
  c.height = hgt;
  const ctx = c.getContext("2d", { alpha: false });
  const vb = frameBox(
    shapes(d, X.body).box,
    Math.max(+X.pad, 0.1),
    size / hgt,
  );
  const bg = exportBg(),
    color = X.fg;
  drawFrame(ctx, d, 0, vb, size, color, bg, hgt);
  const stream = c.captureStream(fps);
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: Math.round(size * hgt * fps * 0.3),
  });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise((res) => (rec.onstop = res));
  toast(`Recording ${d.name}, ${secs}s\u2026`);
  rec.start(250);
  const t0 = performance.now();
  await new Promise((res) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      drawFrame(
        ctx,
        d,
        Math.min(t, secs) * X.speed,
        vb,
        size,
        color,
        bg,
        hgt,
      );
      if (t >= secs) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  return new Blob(chunks, { type: mime.split(";")[0] });
}
