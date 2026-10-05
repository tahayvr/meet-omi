#!/usr/bin/env node
/* Serves the repo for the design jig (index.html) and the web example,
   which fetch the pack and so can't be opened as files.

     npm run dev              http://localhost:8000, or the next free port
     npm run dev -- 3000      that port, or fail

   It answers on this machine only (localhost, 127.0.0.1), so the page is
   one the browser trusts and nothing else on the network can reach it.
   Nothing is cached: a reload always shows the files as they are. */
const fs = require("fs"),
  http = require("http"),
  path = require("path");

const root = path.join(__dirname, ".."),
  asked = Number(process.argv[2] || process.env.PORT) || 0,
  FIRST = 8000,
  TRIES = 20;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".md": "text/plain; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".qml": "text/plain; charset=utf-8",
};

function send(res, status, text, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, headers));
  res.end(text);
}

function answer(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "GET only\n");
  let url, file;
  try {
    url = new URL(req.url, "http://localhost");
    file = path.join(root, decodeURIComponent(url.pathname));
  } catch (e) {
    return send(res, 400, "Bad request\n");
  }
  if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, "Outside the repo\n");

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) {
      // a folder's page loads its files by relative paths, which need the slash
      if (!url.pathname.endsWith("/")) return send(res, 301, "", { Location: url.pathname + "/" + url.search });
      file = path.join(file, "index.html");
      return fs.stat(file, (e, s) => serve(e, s));
    }
    serve(err, stat);
  });

  function serve(err, stat) {
    if (err || !stat.isFile()) return send(res, 404, `Nothing at ${url.pathname}\n`);
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  }
}

/* Listens on both of the machine's own addresses, so localhost answers
   whichever one the browser tries, and 127.0.0.1 does too. */
function listen(port, done) {
  const v4 = http.createServer(answer),
    v6 = http.createServer(answer);
  v4.once("error", done);
  v4.listen(port, "127.0.0.1", () => {
    v6.once("error", (err) => {
      if (err.code !== "EADDRINUSE") return done(null); // no IPv6 here: v4 will do
      v4.close();
      done(err);
    });
    v6.listen(port, "::1", () => done(null));
  });
}

(function start(port) {
  listen(port, (err) => {
    if (!err) {
      console.log(`Omi's design jig:  http://localhost:${port}/`);
      console.log(`The web example:   http://localhost:${port}/examples/web/`);
      return;
    }
    if (err.code === "EADDRINUSE" && !asked && port < FIRST + TRIES) return start(port + 1);
    console.error(err.code === "EADDRINUSE" ? `Port ${port} is in use` : err.message);
    process.exit(1);
  });
})(asked || FIRST);
