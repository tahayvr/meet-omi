#!/usr/bin/env node
/* Puts the site together as it is published, in a folder of its own:

     node tools/publish-site.js          into _site/
     node tools/publish-site.js out      into out/

   The site is the repo as it stands (everything git tracks or would), so
   every address that works in a checkout works when published: the jig, the
   pack, the web example. Two things are added to index.html:

   - which commit this is, as <meta name="omi-build">, so a published page
     can say what it was made from (index.html?check shows it);
   - that same id on the address of every stylesheet and script the page
     loads. A browser keeps those files for a while; with the id in their
     addresses, a page never runs some files of one build with some of
     another.

   .github/workflows/publish.yml runs this and publishes the folder.
   tools/check-site.js --dir checks one in Chrome, by hand. */
const fs = require("fs"),
  path = require("path"),
  { execFileSync } = require("child_process");

const root = path.join(__dirname, ".."),
  out = path.resolve(process.argv[2] || path.join(root, "_site")),
  git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(),
  build = (process.env.GITHUB_SHA || git("rev-parse", "HEAD")).slice(0, 7);

if (out === root || root.startsWith(out + path.sep)) {
  console.error(`${out} holds the repo: pick a folder inside it, or beside it`);
  process.exit(2);
}
const inside = path.relative(root, out).split(path.sep)[0];
fs.rmSync(out, { recursive: true, force: true });

// what git tracks, and what it would if it were added: not what it ignores
const files = git("ls-files", "--cached", "--others", "--exclude-standard")
  .split("\n")
  .filter(
    (f) =>
      f &&
      f.split("/")[0] !== inside &&
      !f.startsWith(".github/") &&
      fs.existsSync(path.join(root, f)),
  );
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}

// index.html: the build, and the build on every file of ours it loads
const page = path.join(out, "index.html");
let html = fs.readFileSync(page, "utf8"),
  stamped = 0;
html = html.replace(
  /(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^":?#]+\.(?:js|css))(")/g,
  (all, before, file, after) => {
    stamped++;
    return `${before}${file}?v=${build}${after}`;
  },
);
if (!/<meta charset[^>]*>/i.test(html) || !stamped) {
  console.error("index.html isn't laid out as expected: nothing was stamped");
  process.exit(1);
}
html = html.replace(
  /(<meta charset[^>]*>)/i,
  `$1\n    <meta name="omi-build" content="${build}" />`,
);
fs.writeFileSync(page, html);

console.log(
  `${path.relative(process.cwd(), out) || "."}/: ${files.length} files, build ${build} (on ${stamped} addresses in index.html)`,
);
