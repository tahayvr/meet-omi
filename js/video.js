/* ---------- video: draws each frame from the motion table (motion.js) ---------- */
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
function drawRects(ctx, rects, t) {
  for (const r of rects) {
    const a = motionAt(r.c, t, r);
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
  const sh = shapes(d);
  ctx.save();
  if (d.mood && ANIM[d.mood]) {
    // body moods move and scale the whole of Omi about its center
    const m = motionAt(d.mood, t),
      cx = (sh.box.x + sh.box.x2) / 2,
      cy = (sh.box.y + sh.box.y2) / 2;
    ctx.translate(cx + m.tx, cy + m.ty);
    ctx.scale(m.sx, m.sy);
    ctx.translate(-cx, -cy);
  }
  if (d.clip) {
    // pieces seen through a window, on a layer of their own that can move
    const c = d.clip;
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x, c.y, c.w, c.h);
    ctx.clip();
    if (c.mood) {
      const m = motionAt(c.mood, t);
      ctx.translate(m.tx, m.ty);
    }
    drawRects(ctx, sh.rects.filter((r) => r.clip), t);
    ctx.restore();
  }
  drawRects(ctx, sh.rects.filter((r) => !r.clip), t);
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
    shapes(d).box,
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
    shapes(d).box,
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
