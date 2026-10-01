/* ---------- single view ---------- */
const view = $("view");
let vi = 0;
function showView() {
  const d = DESIGNS[vi],
    vb = squareBox(shapes(d, S.body).box, 0.14),
    C = eff(d.id);
  const dark = C.bg ? lum(C.bg) < 0.35 : false;
  view.classList.toggle("checker", !C.bg);
  view.style.setProperty("--vbg", C.bg || "#ffffff");
  view.style.setProperty(
    "--label",
    C.bg ? (dark ? "#e6e9f5" : "#1f2335") : "#1f2335",
  );
  view.style.setProperty(
    "--label-hover",
    dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)",
  );
  $("vname").textContent = d.name;
  $("vpos").textContent = `${vi + 1} / ${DESIGNS.length}`;
  const vHTML = svgFor(d, {
    color: C.fg,
    body: S.body,
    animated: C.anim,
    force: S.force,
    vb,
    label: "Omi, " + d.name,
  });
  $("vart").dataset.sid = d.id;
  if (vHTML !== $("vart")._html) {
    $("vart").innerHTML = vHTML;
    $("vart")._html = vHTML;
  }
  $("editName").textContent = d.name;
  $("vside").setAttribute("aria-expanded", String(S.side));
  syncControls();
  rmSync();
  syncReviewUI();
  applySpeed();
}
function resetNote() {}
const sideEl = $("side"),
  mainEl = document.querySelector(".main");
function openView(id) {
  vi = DESIGNS.findIndex((x) => x.id === id);
  if (!view.open) {
    view.appendChild(sideEl);
    sideEl.classList.add("in-view");
    view.showModal();
  }
  resetNote();
  showView();
}
view.addEventListener("close", () => {
  sideEl.classList.remove("in-view");
  mainEl.appendChild(sideEl);
  render();
});
$("saveOne").addEventListener("click", async () => {
  const d = DESIGNS[vi],
    btn = $("saveOne");
  btn.disabled = true;
  try {
    const blob = await build(d);
    await save(fileName(d), blob);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
});
$("vside").addEventListener("click", () => set({ side: !S.side }));
$("resetOver").addEventListener("click", () => {
  clearOver(DESIGNS[vi].id);
  showView();
  toast("Back to global settings");
});
const step = (n) => {
  vi = (vi + n + DESIGNS.length) % DESIGNS.length;
  resetNote();
  showView();
};
$("vprev").addEventListener("click", () => step(-1));
$("vnext").addEventListener("click", () => step(1));
$("vclose").addEventListener("click", () => view.close());
view.addEventListener("keydown", (e) => {
  if (e.target.closest("textarea, input, select")) return;
  if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "ArrowRight") step(1);
});

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
function syncReviewUI() {}
