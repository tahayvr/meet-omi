#!/usr/bin/env node
/* Checks the reference service (service/) against the Omi state protocol
   (protocol/README.md), with real sockets and real players.

     node tools/check-service.js */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawn, spawnSync } = require("child_process"),
  Omi = require("../player/omi.js"),
  { connect, follow } = require("../service/client.js");

const root = path.join(__dirname, ".."),
  socket = path.join(os.tmpdir(), `omi-check-${process.pid}.sock`),
  pack = JSON.parse(fs.readFileSync(path.join(root, "pack/omi.json"), "utf8")),
  env = { ...process.env, OMI_SOCKET: socket },
  wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  results = [];
process.env.OMI_SOCKET = socket; // for the apps in this process too
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const ctl = (...args) =>
  spawnSync("node", [path.join(root, "service/omictl.js"), ...args], {
    env,
    encoding: "utf8",
  });
const start = () => {
  const proc = spawn(
    "node",
    [path.join(root, "service/omi-service.js"), "--pack", "pack/omi.json"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  // a service that crashes should say why
  proc.stderr.on("data", (d) => process.stderr.write(`service: ${d}`));
  return proc;
};
const listening = (proc) =>
  new Promise((resolve) =>
    proc.stdout.on("data", (d) => /listening/.test(d) && resolve()),
  );
const player = () => new Omi(null, pack, { color: "#000" });
// the largest difference between two players' rects, drawn at one moment
function gap(a, b) {
  const now = Date.now() + 1000;
  a.frame(now);
  b.frame(now);
  const ra = a.rects(),
    rb = b.rects();
  if (ra.length !== rb.length) return Infinity;
  return Math.max(
    0,
    ...ra.map((r, i) =>
      Math.max(
        ...["x", "y", "w", "h"].map((k) => Math.abs(r[k] - rb[i][k])),
        Math.abs(r.o - rb[i].o) * 100,
      ),
    ),
  );
}

(async () => {
  try {
    fs.unlinkSync(socket);
  } catch (e) {}
  const svc = start();
  await listening(svc);

  // 1. the command line
  let r = ctl("get");
  check(
    "omictl get",
    r.status === 0 && r.stdout.startsWith("mark"),
    r.stdout.trim(),
  );
  r = ctl("set", "thinkng");
  check(
    "unknown mode is refused",
    r.status === 1 && /no mode/.test(r.stderr),
    r.stderr.trim(),
  );
  r = ctl("set", "idle");
  check(
    "omictl set",
    r.status === 0 && r.stdout.startsWith("idle from mark"),
    r.stdout.trim(),
  );

  // 2. two apps follow along, frame for frame, however their frames are timed
  const A = player(),
    B = player(),
    fa = follow(A, { name: "A" }),
    fb = follow(B, { name: "B" });
  await wait(300);
  const tickA = setInterval(() => A.frame(Date.now()), 16),
    tickB = setInterval(() => B.frame(Date.now()), 23);
  await ctl("set", "error");
  await wait(150);
  check(
    "two apps mid-morph show the same frame",
    A.morph && B.morph && A.mode === "error" && gap(A, B) < 0.5,
    `${A.morph ? "mid-morph" : "not morphing"}, gap ${gap(A, B).toFixed(3)}`,
  );
  // 3. a third app joins mid-morph
  const C = player(),
    fc = follow(C, { name: "C" });
  const tickC = setInterval(() => C.frame(Date.now()), 31);
  await wait(1200);
  check(
    "all land on the same frame",
    A.mode === "error" && gap(A, B) < 0.01 && gap(A, C) < 0.01,
    `${A.mode}/${B.mode}/${C.mode}, A-B ${gap(A, B).toFixed(4)}, A-C ${gap(A, C).toFixed(4)}`,
  );
  await wait(900);
  check("their loops stay together", gap(A, B) < 0.01 && gap(A, C) < 0.01);

  // 4. a short reaction: success for 0.4 s, then idle
  const watcher = connect({ name: "watch" }),
    seen = [];
  const w2 = connect({ name: "seen", onState: (s) => seen.push(s.mode) });
  await wait(100);
  await watcher.set("success", { for: 0.4, then: "idle" });
  await wait(700);
  check(
    "for/then changes back",
    A.mode === "idle" && seen.join() === "error,success,idle",
    seen.join(" > "),
  );
  // ...and a later change cancels the timer
  await watcher.set("wink", { for: 0.3, then: "idle" });
  await watcher.set("sudo");
  await wait(500);
  check(
    "a later change cancels the timer",
    (await watcher.get()).mode === "sudo",
  );

  // 5. setting the current mode changes nothing
  const before = (await watcher.get()).since;
  const again = await watcher.set("sudo");
  check("setting the current mode keeps since", again.since === before);

  // 6. one service per socket
  const second = start();
  const code = await new Promise((r) => second.on("exit", r));
  check("a second service refuses to start", code === 1);

  [fa, fb, fc, watcher, w2].forEach((c) => c.close());
  [tickA, tickB, tickC].forEach(clearInterval);
  svc.kill("SIGTERM");
  await new Promise((r) => svc.on("exit", r));
  check("the socket is removed on exit", !fs.existsSync(socket));

  // 7. a socket left over from a crash is cleaned up
  const crashed = start();
  await listening(crashed);
  crashed.kill("SIGKILL");
  await new Promise((r) => crashed.on("exit", r));
  const fresh = start();
  await listening(fresh);
  check("a leftover socket is replaced", ctl("get").status === 0);
  fresh.kill("SIGTERM");
  await new Promise((r) => fresh.on("exit", r));

  const failed = results.filter((ok) => !ok).length;
  console.log(
    failed
      ? `${failed} of ${results.length} failed`
      : `ok: ${results.length} checks`,
  );
  process.exit(failed ? 1 : 0);
})();
