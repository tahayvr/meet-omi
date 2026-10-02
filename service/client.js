/* A Node client for the Omi state protocol (../protocol/README.md).

     const { connect, follow } = require("./client.js");

     // change Omi from a script
     const omi = connect({ name: "my-script" });
     await omi.set("success", { for: 3, then: "idle" });
     omi.close();

     // keep a player in sync with the shared state
     follow(player, { name: "my-app" });
*/
const net = require("net"),
  os = require("os"),
  path = require("path");

const PROTOCOL = 1;

// Where the service listens: $OMI_SOCKET, $XDG_RUNTIME_DIR/omi.sock, or a
// per-user file in the temporary directory.
function socketPath() {
  if (process.env.OMI_SOCKET) return process.env.OMI_SOCKET;
  if (process.env.XDG_RUNTIME_DIR)
    return path.join(process.env.XDG_RUNTIME_DIR, "omi.sock");
  const uid = typeof process.getuid === "function" ? process.getuid() : "user";
  return path.join(os.tmpdir(), `omi-${uid}.sock`);
}

// Read a stream as one JSON object per line.
function lines(stream, onMessage) {
  let buf = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        continue; // not JSON: skip it, as the protocol says
      }
      if (msg && typeof msg === "object") onMessage(msg);
    }
  });
}

/* Connect to the service. onState(state) runs for every state it sends:
   on connect, after every change, and in answer to get and set. set() and
   get() resolve with the answer (or reject with the service's error). */
function connect({ socket = socketPath(), name, onState, onError, onClose } = {}) {
  const conn = net.createConnection(socket),
    waiting = [];
  let closed = false,
    greeted = false; // the first state is the service's greeting, not an answer
  // say hello first: writes made before the socket opens go out in order
  if (name) conn.write(JSON.stringify({ type: "hello", name }) + "\n");
  lines(conn, (msg) => {
    if (msg.type === "state") {
      onState && onState(msg);
      if (!greeted) greeted = true;
      else if (waiting.length) waiting.shift().resolve(msg);
    } else if (msg.type === "error") {
      if (waiting.length) waiting.shift().reject(new Error(msg.message));
      else onError && onError(new Error(msg.message));
    }
  });
  conn.on("error", (e) => {
    while (waiting.length) waiting.shift().reject(e);
    if (onError) onError(e);
  });
  conn.on("close", () => {
    closed = true;
    while (waiting.length) waiting.shift().reject(new Error("closed"));
    onClose && onClose();
  });
  const ask = (msg) =>
    new Promise((resolve, reject) => {
      if (closed) return reject(new Error("closed"));
      waiting.push({ resolve, reject });
      conn.write(JSON.stringify(msg) + "\n");
    });
  return {
    socket,
    set: (mode, opts = {}) => ask({ type: "set", mode, ...opts }),
    get: () => ask({ type: "get" }),
    close: () => conn.end(),
  };
}

/* Keep an Omi player (../player/omi.js) in sync with the shared state:
   every app following it shows the same frame at the same moment. */
function follow(player, opts = {}) {
  const known = (id) => !!player.modes[id],
    { duration, stagger } = player.pack.morph;
  let first = true;
  return connect({
    ...opts,
    onState(st) {
      if (!known(st.mode)) return; // a mode this pack doesn't have
      const midMorph =
        !st.instant && Date.now() - st.since < (duration + stagger) * 1000;
      if (first && midMorph && st.from && known(st.from))
        // joined mid-morph: start from where everyone started
        player.set(st.from, { instant: true });
      first = false;
      player.set(st.mode, { instant: st.instant, since: st.since });
      opts.onState && opts.onState(st);
    },
  });
}

module.exports = { PROTOCOL, socketPath, connect, follow, lines };
