/* ---------- site sections ---------- */
const FEATURED = [
  "idle",
  "wink",
  "thinking-snake",
  "typing",
  "listening",
  "party",
  "sleeping",
  "sudo",
  "code-rain",
  "mind-blown",
];
let heroId = "idle",
  heroAuto = true,
  heroTimer = null;
const byIdD = (id) => DESIGNS.find((d) => d.id === id);
const fig = (svg, title, sub) =>
  `<figure class="fig">${svg}<figcaption><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</figcaption></figure>`;
let asciiKey = "";
function renderSite() {
  const box = (d) => squareBox(shapes(d, false).box, 0.12);
  const art = (d, label, anim = S.anim) =>
    svgFor(d, {
      color: S.fg,
      body: false,
      animated: anim,
      force: S.force,
      vb: box(d),
      label,
    });
  // hero
  const hd = byIdD(heroId) || DESIGNS[0];
  const heroHTML = `<div data-sid="${hd.id}">${svgFor(hd, { color: eff(hd.id).fg, body: false, animated: eff(hd.id).anim, force: S.force, vb: box(hd), label: "Omi, " + hd.name })}</div>`;
  const ha = $("heroArt");
  if (ha._html !== heroHTML) {
    ha.innerHTML = heroHTML;
    ha._html = heroHTML;
  }
  $("heroName").textContent = hd.name;
  // anatomy
  const logo = { id: "logo", name: "Logo", face: [], mood: "" };
  const anat =
    fig(art(logo, "The Omarchy logo", false), "The logo", "unchanged") +
    fig(
      art(byIdD("idle"), "Omi icon", false),
      "The face",
      "eyes in the inner square",
    ) +
    fig(
      art(byIdD("working"), "Omi working"),
      "The frames",
      "parts of the logo animate with the eyes",
    );
  if ($("anat")._html !== anat) {
    $("anat").innerHTML = anat;
    $("anat")._html = anat;
  }
  // ascii (async, only when the inputs change)
  const key = S.fg + "|" + S.pad;
  if (key !== asciiKey) {
    asciiKey = key;
    (async () => {
      const out = [];
      for (const [id, cap] of [
        ["idle", "Idle"],
        ["wink", "Wink"],
        ["confused", "Confused"],
        ["success", "Success"],
        ["error", "Error"],
        ["surprised", "Surprised"],
        ["warning", "Warning"],
        ["sudo", "Sudo"],
        ["love", "Love"],
      ]) {
        const d = byIdD(id);
        if (!d) continue;
        X = { ...S, pad: "0.04" };
        try {
          out.push(
            `<figure><div class="scroll"><pre>${esc(await ascii(d))}</pre></div><figcaption>${cap}</figcaption></figure>`,
          );
        } catch (e) {}
      }
      $("asciis").innerHTML = out.join("");
    })();
  }
}
function setHero(id, manual) {
  heroId = id;
  if (manual) {
    heroAuto = false;
    clearInterval(heroTimer);
  }
  renderSite();
  applySpeed();
}
const RM2 = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!RM2.matches)
  heroTimer = setInterval(() => {
    if (!heroAuto || (typeof view !== "undefined" && view.open)) return;
    const i = FEATURED.indexOf(heroId);
    setHero(FEATURED[(i + 1) % FEATURED.length], false);
  }, 3600);

grid.addEventListener("click", async (e) => {
  const o = e.target.closest(".open");
  if (o) {
    openView(o.dataset.id);
    return;
  }
  const r = e.target.closest(".reset");
  if (r) {
    clearOver(r.dataset.id);
    toast("Back to global settings");
    return;
  }
  const b = e.target.closest(".save");
  if (!b) return;
  openExport(DESIGNS.find((x) => x.id === b.dataset.id));
});
$("saveAll").addEventListener("click", async () => {
  const btn = $("saveAll");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Building ZIP\u2026";
  try {
    const files = [];
    for (const [i, d] of DESIGNS.entries()) {
      if (["webm", "mp4"].includes(S.fmt))
        btn.textContent = `Recording ${i + 1} of ${DESIGNS.length}\u2026`;
      const blob = await build(d);
      files.push({
        name: fileName(d),
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }
    await save(
      `omi-${S.fmt === "svga" ? "svg-animated" : S.fmt}${S.body ? "-body" : ""}.zip`,
      zip(files),
    );
  } catch (err) {
    toast(err.message);
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
});
$("copyAll").addEventListener("click", async () => {
  const sprite =
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n' +
    DESIGNS.map((d) => {
      const sh = shapes(d, S.body),
        vb = squareBox(sh.box, +S.pad);
      const inner = svgFor(d, {
        color: S.fg,
        bg: null,
        body: S.body,
        vb,
      })
        .replace(/^<svg[^>]*>/, "")
        .replace(/<\/svg>$/, "");
      return `  <symbol id="omi-${d.id}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">${inner}</symbol>`;
    }).join("\n") +
    "\n</svg>\n";
  try {
    await navigator.clipboard.writeText(sprite);
    toast('SVG sprite copied. Use <svg><use href="#omi-idle"/></svg>.');
  } catch (e) {
    toast("Clipboard access was blocked. Export as SVG instead.");
  }
});
