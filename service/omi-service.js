#!/usr/bin/env node
/* The reference Omi state service (../protocol/README.md): holds what Omi is
   doing and shares it with every app on the machine.

     node service/omi-service.js [--pack pack/omi.json] [--socket path]

   With --pack it only accepts modes the pack has. One per user: it refuses
   to start if another is already answering on the socket. */
const fs = require("fs"),
  net = require("net"),
  { PROTOCOL, socketPath, lines } = require("./client.js");

const args = process.argv.slice(2),
  opt = (name) => {
    const i = args.indexOf("--" + name);
    return i >= 0 ? args[i + 1] : undefined;
  },
  socket = opt("socket") || socketPath(),
  packPath = opt("pack"),
  modes = packPath
    ? new Set(
        JSON.parse(fs.readFileSync(packPath, "utf8")).modes.map((m) => m.id),
      )
    : null;

let state = { mode: "mark", from: null, since: Date.now(), instant: true },
  timer = null;
const apps = new Set(),
  log = (...a) => console.log(new Date().toISOString(), ...a),
  send = (app, msg) => app.writable && app.write(JSON.stringify(msg) + "\n"),
  stateMsg = () => ({ type: "state", protocol: PROTOCOL, ...state });

function checkMode(id) {
  if (typeof id !== "string" || !id) return "mode must be a mode id";
  if (modes && !modes.has(id)) return `no mode "${id}"`;
  return null;
}

// Change the state and tell every app. Returns false if nothing changed.
function change(mode, instant) {
  if (mode === state.mode) return false;
  state = { mode, from: state.mode, since: Date.now(), instant: !!instant };
  for (const app of apps) send(app, stateMsg());
  return true;
}

function onSet(app, msg) {
  const bad =
    checkMode(msg.mode) ||
    (msg.for != null || msg.then != null
      ? !(typeof msg.for === "number" && msg.for > 0)
        ? "for must be a number of seconds above 0"
        : checkMode(msg.then)
      : null);
  if (bad) return send(app, { type: "error", message: bad });
  // a timer belongs to the change that started it: anything later cancels it
  clearTimeout(timer);
  timer = null;
  const changed = change(msg.mode, msg.instant);
  if (msg.for != null)
    timer = setTimeout(() => {
      timer = null;
      if (change(msg.then, false)) log(`${msg.then} (after ${msg.mode})`);
    }, msg.for * 1000);
  if (changed)
    log(`${msg.mode}${msg.instant ? " (instant)" : ""} from ${app.name}`);
  // the app that sent it gets an answer either way
  else send(app, stateMsg());
}

const server = net.createServer((app) => {
  app.name = "an app";
  apps.add(app);
  send(app, stateMsg());
  lines(app, (msg) => {
    if (msg.type === "hello" && typeof msg.name === "string")
      app.name = msg.name;
    else if (msg.type === "set") onSet(app, msg);
    else if (msg.type === "get") send(app, stateMsg());
  });
  app.on("error", () => {});
  app.on("close", () => apps.delete(app));
});

function listen() {
  server.listen(socket, () => {
    fs.chmodSync(socket, 0o600); // the user's own
    log(`listening on ${socket}${modes ? ` (${modes.size} modes)` : ""}`);
  });
}
const stop = () => {
  server.close();
  try {
    fs.unlinkSync(socket);
  } catch (e) {}
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// a socket file nobody answers on is left over from a service that stopped
if (fs.existsSync(socket)) {
  const probe = net.createConnection(socket);
  probe.on("connect", () => {
    console.error(`An Omi service is already running on ${socket}`);
    process.exit(1);
  });
  probe.on("error", () => {
    fs.unlinkSync(socket);
    listen();
  });
} else listen();
