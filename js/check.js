/* ---------- the page checks itself: index.html?check ----------
   Everything this page shows comes from the pack it builds (pack.js) and
   the reference player, and the pack kept in pack/ is what apps copy. This
   holds the three together, in a real browser:

   1. The pack this page builds is the one in pack/, file for file, and the
      player it runs is the one in the pack.
   2. A mode looping as CSS (the tiles, the single view, the animated SVG
      export) is, at any moment, what the player draws.

   Stills, video frames, the hero and the Morph section are the player's own
   rects (playerRects, morph.js), so they have nothing to drift from.

   tools/check-site.js opens this in Chrome without a window, and anyone can
   open it by hand, here or on the live site. */
async function checkSite() {
  // a published page says which commit it was made from (tools/publish-site.js)
  const build = document.querySelector('meta[name="omi-build"]'),
    lines = build ? [`      build ${build.content}`] : [];
  let failed = 0;
  const say = (ok, text) => {
    lines.push((ok ? "ok    " : "FAIL  ") + text);
    if (!ok) failed++;
  };

  // 1. the same build as pack/
  const read = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.text();
  };
  try {
    const built = packFiles();
    for (const name of Object.keys(built))
      say((await read("pack/" + name)) === built[name], `pack/${name} is the one this page builds`);
    say((await read("pack/omi.js")) === (await read("player/omi.js")), "pack/omi.js is the player this page runs");
    if (failed) lines.push("      run node tools/build-pack.js and commit pack/");
  } catch (err) {
    say(false, `the pack could not be read (${err.message})`);
  }

  // 2. the CSS against the player
  const TIMES = [0, 0.9, 3.3, 7.77],
    NEAR = { position: 0.01, opacity: 0.001 }, // the pack's own tolerance
    vb = { ...MORPH_VB },
    host = document.createElement("div");
  host.style.cssText = `position:absolute;left:-10000px;top:0;width:${vb.w}px;height:${vb.h}px`;
  document.body.appendChild(host);
  let rectsSeen = 0,
    wrong = 0;
  for (const d of DESIGNS) {
    host.innerHTML = svgFor(d, { color: "#000", animated: true, force: true, vb, size: vb.w });
    const svg = host.firstElementChild,
      body = svg.querySelector("g"),
      anims = svg.getAnimations({ subtree: true }),
      rects = [...svg.querySelectorAll("rect")];
    anims.forEach((a) => a.pause());
    const off = [];
    for (const t of TIMES) {
      anims.forEach((a) => (a.currentTime = t * 1000));
      // where an element's own x, y, w, h land in the picture, CSS and all
      const toView = svg.getScreenCTM().inverse(),
        placed = (el, r) => {
          const m = toView.multiply(el.getScreenCTM());
          return { x: m.a * r.x + m.e, y: m.d * r.y + m.f, w: m.a * r.w, h: m.d * r.h };
        };
      // the window stays put while its layer moves; only the body moves it
      const win = d.clip ? placed(body, d.clip) : null;
      const css = [];
      for (const el of rects) {
        const o = parseFloat(getComputedStyle(el).opacity) * (el.hasAttribute("fill-opacity") ? +el.getAttribute("fill-opacity") : 1);
        if (!(o > 0.001)) continue;
        let r = placed(el, { x: +el.getAttribute("x"), y: +el.getAttribute("y"), w: +el.getAttribute("width"), h: +el.getAttribute("height") });
        if (el.ownerSVGElement !== svg) r = clipTo(r, { x: win.x, y: win.y, w: win.w, h: win.h });
        if (r) css.push({ ...r, o });
      }
      const player = playerRects(d, t);
      rectsSeen += player.length;
      if (css.length !== player.length) {
        off.push(`at ${t} s the CSS shows ${css.length} rects, the player ${player.length}`);
        continue;
      }
      css.forEach((r, i) => {
        for (const k of ["x", "y", "w", "h", "o"])
          if (Math.abs(r[k] - player[i][k]) > (k === "o" ? NEAR.opacity : NEAR.position))
            off.push(`at ${t} s rect ${i} has ${k} ${+r[k].toFixed(4)} as CSS, ${+player[i][k].toFixed(4)} in the player`);
      });
    }
    if (off.length) {
      wrong++;
      say(false, `${d.id}: ${off.slice(0, 3).join("; ")}${off.length > 3 ? `; and ${off.length - 3} more` : ""}`);
    }
  }
  host.remove();
  if (!wrong) say(true, `as CSS, every mode is what the player draws (${DESIGNS.length} modes at ${TIMES.length} times, ${rectsSeen} rects)`);

  lines.push(failed ? `FAIL: ${failed} of the checks above` : "ok: this page shows what the pack and the player say");
  // for a person, and for tools/check-site.js
  const out = document.createElement("pre");
  out.id = "sitecheck";
  out.textContent = lines.join("\n");
  out.style.cssText =
    "position:fixed;z-index:1000;left:16px;top:16px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;margin:0;padding:14px 16px;" +
    "font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;background:#101218;color:#e6e9f5;border:1px solid " +
    (failed ? "#f7768e" : "#9ece6a");
  document.body.appendChild(out);
  document.documentElement.dataset.check = failed ? "fail" : "ok";
  console[failed ? "error" : "log"](out.textContent);
}
if (new URLSearchParams(location.search).has("check")) checkSite();
