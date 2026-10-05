/* Checks an Omi player against pack/conformance.json (see "Checking your own
   player" in pack/README.md). Plain JavaScript that runs in Node and in Qt
   Quick's engine alike, so the same check runs in both:

     checkConformance(Omi, pack, conformance)
       -> { checks: number, fails: [string] }

   tools/check-player.js runs it in Node, tools/check-quickshell.js inside the
   Omarchy shell's Quickshell. */
var checkConformance = function (Omi, pack, conf) {
  "use strict";
  const tp = conf.tolerance.position,
    to = conf.tolerance.opacity;

  const canvas = {
      width: 1,
      height: 1,
      getContext: () => ({ setTransform() {}, clearRect() {}, fillRect() {} }),
    },
    omi = new Omi(canvas, pack, { color: "#000" }),
    row = (r) => [r.x, r.y, r.w, r.h, r.o, r.role],
    shown = (list) => list.filter((r) => r.o > 0.001).map(row);

  const same = (a, b) =>
    a.length === 6 &&
    [0, 1, 2, 3].every((i) => Math.abs(a[i] - b[i]) <= tp) &&
    Math.abs(a[4] - b[4]) <= to &&
    a[5] === b[5];
  // in drawing order
  const sameList = (a, b) =>
    a.length === b.length && a.every((r, i) => same(r, b[i]));
  // in any order: every expected rect is matched by a different drawn one
  const sameSet = (a, b) => {
    const left = a.slice();
    return (
      a.length === b.length &&
      b.every((r) => {
        const i = left.findIndex((q) => same(q, r));
        return i >= 0 && left.splice(i, 1);
      })
    );
  };

  const fails = [];
  let checks = 0;
  for (const m of pack.modes) {
    const times = conf.modes[m.id] || {};
    for (const t of Object.keys(times)) {
      checks++;
      if (!sameList(shown(omi.modeRects(m, +t)), times[t]))
        fails.push(`${m.id} at ${t}s`);
    }
  }
  for (const c of conf.morphs) {
    omi.set(c.from, { instant: true });
    checks++;
    if (!sameSet(shown(omi.rects()), c.start))
      fails.push(`${c.from} > ${c.to}: start`);
    omi.set(c.to);
    let ms = 1000;
    omi.frame(ms);
    while (omi.morph && ms < 1000 + conf.morph_seconds * 1000 + 1000)
      omi.frame((ms += 10));
    checks++;
    if (!sameSet(shown(omi.rects()), c.end))
      fails.push(`${c.from} > ${c.to}: end`);
  }
  // The gaze (optional in the pack): a mode at rest, looking ahead, turned to
  // a direction; checked halfway and landed.
  for (const g of conf.gazes || []) {
    omi.set(g.mode, { instant: true });
    omi.animate = false;
    omi.look(0, 0);
    let ms = 5000;
    omi.frame(ms);
    omi.look(g.look[0], g.look[1]);
    while (ms < 5000 + g.half.at * 1000 - 0.5) omi.frame((ms += 5));
    checks++;
    if (!sameList(shown(omi.rects()), g.half.rects))
      fails.push(`gaze ${g.mode} ${g.look}: halfway`);
    while (omi.gazing && ms < 20000) omi.frame((ms += 10));
    checks++;
    if (!sameList(shown(omi.rects()), g.end))
      fails.push(`gaze ${g.mode} ${g.look}: landed`);
    omi.animate = true;
    omi.look(0, 0);
    while (omi.gazing && ms < 30000) omi.frame((ms += 10));
  }
  omi.destroy();
  return { checks, fails };
};

if (typeof module !== "undefined" && module.exports)
  module.exports = checkConformance;
