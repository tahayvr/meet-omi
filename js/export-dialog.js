/* ---------- export dialog (per-mode download button) ---------- */
const xdlg = $("xdlg");
const XKEYS = ["fmt", "ratio", "size", "pad", "vlen"];
let xd = null;

// Reuse the Controls panel's option lists so the two never drift apart.
XKEYS.forEach((k) => ($("x" + k).innerHTML = $(k).innerHTML));

function xsync() {
  const fr = fmtRules($("xfmt").value);
  $("xratio").disabled = fr.noRatio;
  $("xsize").disabled = !fr.raster;
  $("xpad").disabled = fr.noPad;
  $("xclear").disabled = fr.noClear;
  $("xlenField").hidden = !fr.video;
}

function openExport(d) {
  xd = d;
  const E = eff(d.id);
  XKEYS.forEach((k) => ($("x" + k).value = E[k]));
  $("xfmt").querySelector("[value=mp4]").disabled = !MP4;
  $("xclear").checked = E.clear;
  $("xname").textContent = d.name;
  const xa = $("xart");
  xa.style.background = E.bg || "transparent";
  xa.innerHTML = svgFor(d, {
    color: E.fg,
    bg: null,
    animated: false,
    vb: squareBox(shapes(d).box, 0.1),
    label: labelOf(d),
  });
  xsync();
  xdlg.returnValue = "";
  xdlg.showModal();
}

$("xfmt").addEventListener("change", xsync);

xdlg.addEventListener("close", async () => {
  if (xdlg.returnValue !== "export" || !xd) return;
  const d = xd;
  xd = null;
  // Remember the choices (also updates the Controls panel).
  const patch = { clear: $("xclear").checked };
  XKEYS.forEach((k) => (patch[k] = $("x" + k).value));
  set(patch);
  // A mode with its own export settings would otherwise ignore the choice.
  if ((S.over || {})[d.id]) {
    S = { ...S, over: { ...S.over, [d.id]: { ...S.over[d.id], ...patch } } };
    persist();
  }
  const video = fmtRules(patch.fmt).video;
  if (video) toast("Recording " + d.name + "…");
  try {
    const blob = await build(d);
    await save(fileName(d), blob);
  } catch (err) {
    toast(err.message);
  }
});
