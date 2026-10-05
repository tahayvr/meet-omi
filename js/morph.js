/* ---------- Omi on the page: the reference player, fed the Omi pack ----------
   The page shows exactly what an app gets: the pack built by pack.js, as
   JSON, played by player/omi.js. The hero and the Morph section are players
   on a canvas; stills and video frames (and so every export of them) are the
   player's rects, from playerRects(). If it looks right here, it looks right
   in any app that uses the pack.

   The one thing the player doesn't draw is a mode looping as CSS: the
   tiles, the single view and the animated SVG export, which have to run
   without a script. index.html?check (check.js) holds those to the player. */
let pagePackCache = null,
  pageSampler = null;
// round-trip through JSON: the players get exactly what omi.json holds
const pagePack = () =>
  pagePackCache || (pagePackCache = JSON.parse(JSON.stringify(buildPack())));
// What a screen reader says for a design: the pack's label for it.
const labelOf = (d) =>
  (pagePack().modes.find((m) => m.id === d.id) || {}).label || "Omi, " + d.name;
/* What the player draws of a design, t seconds into its loops (0: at rest),
   body motion and all. A design the pack doesn't have (the anatomy's bare
   logo) is packed on the spot. */
function playerRects(d, t) {
  if (!pageSampler) pageSampler = new Omi(null, pagePack(), { animate: false });
  return pageSampler
    .modeRects(pageSampler.modes[d.id] || packMode(d), t)
    .filter((r) => r.o > 0.001);
}
// what the players should do under the current settings
function pagePlayerOpts() {
  const still = RM.matches && !S.force;
  return { speed: S.speed || 1, animate: S.anim && !still, instant: still };
}
/* A player on a canvas inside an .omi-stage. `margin` is the room around the
   logo inside the stage, in pack units; the canvas bleeds `bleed` units
   further on every side, so props like the z's can drift outside the stage.
   The body stays put (no bob, hop or shake), so every morph starts and ends
   at the same spot. */
function mountOmi(canvas, { margin = 70, bleed = 90, mode } = {}) {
  const side = 300 + 2 * margin;
  canvas.style.setProperty("--bleed", `${(bleed / side) * 100}%`);
  return new Omi(canvas, pagePack(), {
    view: [
      -margin - bleed,
      -margin - bleed,
      side + 2 * bleed,
      side + 2 * bleed,
    ],
    bodyMotion: false,
    mode,
    ...pagePlayerOpts(),
  });
}
// settings changed (speed, animate, reduce motion, theme)
function syncOmi(player) {
  const o = pagePlayerOpts();
  player.speed = o.speed;
  if (player.animate !== o.animate) player.animate = o.animate;
  player.draw(); // picks up a new theme color
}

/* ---------- the Morph section ---------- */
const morphDesign = (id) =>
  id === MORPH_MARK.id ? MORPH_MARK : DESIGNS.find((d) => d.id === id);
const morphOrder = () => [MORPH_MARK.id, ...DESIGNS.map((d) => d.id)];
let omi = null,
  morphTour = 0;

function morphTo(id) {
  omi.set(id, { instant: pagePlayerOpts().instant });
  syncMorphUI();
}

function stopTour() {
  clearInterval(morphTour);
  morphTour = 0;
  syncMorphUI();
}
function toggleTour() {
  if (morphTour) return stopTour();
  const step = () => {
    const ids = morphOrder();
    morphTo(ids[(ids.indexOf(omi.mode) + 1) % ids.length]);
  };
  step();
  morphTour = setInterval(step, 2400 / Math.max(0.25, S.speed || 1));
  syncMorphUI();
}

function syncMorphUI() {
  const id = omi ? omi.mode : MORPH_MARK.id;
  document
    .querySelectorAll("#mpick .mbtn")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.id === id)),
    );
  const d = morphDesign(id);
  $("mname").textContent = d ? d.name : "";
  const t = $("mtour");
  t.setAttribute("aria-pressed", String(!!morphTour));
  t.textContent = morphTour ? "Stop tour" : "Play tour";
}

function renderMorph() {
  const pick = $("mpick");
  if (!pick._built) {
    pick._built = true;
    const btn = (d) =>
      `<button class="mbtn" data-id="${d.id}" aria-pressed="false">${d.name}</button>`;
    const groups = [...new Set(DESIGNS.map((d) => d.group))];
    pick.innerHTML =
      `<div class="mgroup"><h3>Start</h3><div class="mbtns">${btn(MORPH_MARK)}<button class="mbtn tour" id="mtour" aria-pressed="false">Play tour</button></div></div>` +
      groups
        .map(
          (g) =>
            `<div class="mgroup"><h3>${g}</h3><div class="mbtns">${DESIGNS.filter(
              (d) => d.group === g,
            )
              .map(btn)
              .join("")}</div></div>`,
        )
        .join("");
    pick.addEventListener("click", (e) => {
      const b = e.target.closest(".mbtn");
      if (!b) return;
      if (b.id === "mtour") return toggleTour();
      if (morphTour) stopTour();
      morphTo(b.dataset.id);
    });
    omi = mountOmi($("mcanvas"));
    syncMorphUI();
    return;
  }
  syncOmi(omi);
}
