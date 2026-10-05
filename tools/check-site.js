#!/usr/bin/env node
/* Has the site check itself in a real browser: it opens index.html?check
   (js/check.js) in Chrome without a window and reports what the page found.
   The page holds what it shows to the pack in pack/ and to the player: see
   js/check.js for what that covers.

     node tools/check-site.js                    this checkout
     node tools/check-site.js --dir _site        the site as it is published
                                                 (tools/publish-site.js)
     node tools/check-site.js https://tahayvr.github.io/meet-omi/
                                                 the live site
     … --build 2f09c9a                           and it must be that build:
                                                 a live site is given three
                                                 minutes to turn into it

   It needs Chrome or Chromium: the one it finds, or the one CHROME names. */
const fs = require("fs"),
  net = require("net"),
  os = require("os"),
  path = require("path"),
  { spawn, spawnSync } = require("child_process");

const args = process.argv.slice(2),
  named = (flag) => (args.includes(flag) ? args.splice(args.indexOf(flag), 2)[1] : null),
  dir = named("--dir"),
  wanted = named("--build"),
  remote = args[0];

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const apps = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter((p) => fs.existsSync(p));
  if (apps.length) return apps[0];
  for (const name of ["chromium", "google-chrome", "google-chrome-stable", "chromium-browser"]) {
    const found = spawnSync("which", [name], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}
// a port nothing is listening on
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
// the repo, served by tools/dev.js; resolves once it answers
function serve(port) {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [path.join(__dirname, "dev.js"), String(port), ...(dir ? [dir] : [])], { stdio: ["ignore", "pipe", "inherit"] });
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`the server stopped (${code})`)));
    server.stdout.once("data", () => resolve(server));
  });
}

/* The page as Chrome has it once it has loaded: the check runs as part of
   loading, so its report is in there. Chrome prints the page and then
   doesn't always leave, so this takes the page as soon as it is whole and
   stops Chrome itself. */
function dump(chrome, profile, url) {
  return new Promise((resolve) => {
    const browser = spawn(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        `--user-data-dir=${profile}`,
        // a CI runner has no sandbox to offer, and little shared memory
        ...(process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : []),
        // only the site itself is asked for anything: the page must not wait
        // on a font from somewhere else to count as loaded
        `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(url).hostname}`,
        // what the page logs goes to Chrome's own log, for when this fails
        "--enable-logging=stderr",
        "--dump-dom",
        url,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let dom = "",
      said = "",
      late = false;
    browser.stderr.setEncoding("utf8");
    browser.stderr.on("data", (text) => (said = (said + text).slice(-20000)));
    const stop = () => browser.kill("SIGKILL"),
      timer = setTimeout(() => ((late = true), stop()), 120000);
    browser.stdout.setEncoding("utf8");
    browser.stdout.on("data", (text) => {
      dom += text;
      if (/<\/html>\s*$/.test(dom)) stop();
    });
    const done = () => (clearTimeout(timer), resolve({ dom, late, said }));
    browser.on("error", done);
    browser.on("exit", done);
  });
}

// The page, asked for again if Chrome falls over on its way up (it can,
// started right after another one was stopped).
async function load(chrome, url) {
  for (let tries = 3; ; tries--) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "omi-check-site-")),
      page = await dump(chrome, profile, url);
    // Chrome's helpers may still be letting go of it: try a few times, and
    // a folder left in the temporary directory is no reason to fail
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (e) {}
    if (page.dom.includes("</html>") || page.late || tries === 1) return page;
    await new Promise((later) => setTimeout(later, 1000));
  }
}

(async () => {
  const chrome = findChrome();
  if (!chrome) {
    console.log("FAIL no Chrome or Chromium found: install one, or set CHROME to its path");
    process.exit(1);
  }
  let server = null,
    url = remote;
  if (!url) {
    const port = await freePort();
    server = await serve(port);
    url = `http://localhost:${port}/`;
  }
  // a site just published may still be the one before for a moment
  let page, built;
  for (let tries = wanted && remote ? 18 : 1; tries > 0; tries--) {
    page = await load(chrome, url + (url.includes("?") ? "&" : "?") + "check");
    built = (/<meta name="omi-build" content="([^"]*)"/.exec(page.dom) || [])[1];
    if (!wanted || built === wanted || tries === 1) break;
    console.log(`      ${url} is ${built ? `build ${built}` : "an unstamped build"}, waiting for ${wanted}`);
    await new Promise((later) => setTimeout(later, 10000));
  }
  if (server) server.removeAllListeners("exit"), server.kill();

  const dom = page.dom,
    report = /<pre id="sitecheck"[^>]*>([\s\S]*?)<\/pre>/.exec(dom),
    result = /<html[^>]*\sdata-check="(\w+)"/.exec(dom);
  if (!dom.includes("</html>")) {
    console.log(`FAIL Chrome printed no page for ${url}` + (page.late ? " in two minutes" : ""));
    // what the page logged, and what Chrome said last, less its own chatter
    const said = page.said.split("\n").filter((l) => l.trim() && !/updater|VERBOSE|dbus|gcm/.test(l));
    console.log([...said.filter((l) => /CONSOLE/.test(l)).slice(-12), ...said.filter((l) => !/CONSOLE/.test(l)).slice(-8)].join("\n"));
    process.exit(1);
  }
  if (wanted && built !== wanted) {
    console.log(`FAIL the page at ${url} is ${built ? `build ${built}` : "an unstamped build"}, not ${wanted}`);
    process.exit(1);
  }
  if (!report || !result) {
    console.log(
      !dom.includes("js/check.js") && dom.includes("</html>")
        ? `FAIL the page at ${url} has no check in it: it was published before js/check.js was`
        : `FAIL the page at ${url} never finished its check`,
    );
    process.exit(1);
  }
  console.log(report[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  process.exit(result[1] === "ok" ? 0 : 1);
})().catch((err) => {
  console.log(`FAIL ${err.message}`);
  process.exit(1);
});
