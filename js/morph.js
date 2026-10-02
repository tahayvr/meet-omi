/* ---------- morph section: the reference player, fed the Omi pack ----------
   This section uses exactly what an app gets: the pack built by pack.js, as
   JSON, played by player/omi.js. If it looks right here, it looks right in
   any app that uses the pack. */
// a margin around the pack's view, so z's and arrows can spill past the art
const MORPH_BLEED = 90;
const morphDesign = (id) =>
  id === MORPH_MARK.id ? MORPH_MARK : DESIGNS.find((d) => d.id === id);
const morphOrder = () => [MORPH_MARK.id, ...DESIGNS.map((d) => d.id)];
let omi = null,
  morphTour = 0;

// what the player should do under the current settings
function morphPlayerOpts() {
  const still = RM.matches && !S.force;
  return { speed: S.speed || 1, animate: S.anim && !still, instant: still };
}
function morphTo(id) {
  omi.set(id, { instant: morphPlayerOpts().instant });
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
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
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
            `<div class="mgroup"><h3>${g}</h3><div class="mbtns">${DESIGNS.filter((d) => d.group === g).map(btn).join("")}</div></div>`,
        )
        .join("");
    pick.addEventListener("click", (e) => {
      const b = e.target.closest(".mbtn");
      if (!b) return;
      if (b.id === "mtour") return toggleTour();
      if (morphTour) stopTour();
      morphTo(b.dataset.id);
    });
    // round-trip through JSON: the player gets exactly what omi.json holds
    const pack = JSON.parse(JSON.stringify(buildPack())),
      [x, y, w, h] = pack.view,
      B = MORPH_BLEED,
      canvas = $("mcanvas");
    canvas.style.setProperty("--bleed", `${(B / w) * 100}%`);
    omi = new Omi(canvas, pack, {
      view: [x - B, y - B, w + 2 * B, h + 2 * B],
      // the body stays put here, so every morph starts and ends at the same
      // spot
      bodyMotion: false,
      ...morphPlayerOpts(),
    });
    syncMorphUI();
    return;
  }
  // settings changed (speed, animate, reduce motion)
  const o = morphPlayerOpts();
  omi.speed = o.speed;
  if (omi.animate !== o.animate) omi.animate = o.animate;
  omi.draw(); // picks up a new theme color
}
