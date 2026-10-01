function shapes(d, body) {
  if (d.peek) {
    const inner = [
      ...LOGO.map((r) => R(r.x, r.y + 160, r.w, r.h)),
      R(110, 250, 20, 40, "eye"),
      R(190, 250, 20, 40, "eye"),
    ];
    const outer = [
      { ...R(-20, 320, 340, 20), o: 1 },
      { ...R(-20, 340, 340, 20), o: 0.55 },
      { ...R(-20, 360, 340, 20), o: 0.2 },
    ];
    if (body) outer.push(R(20, 310, 40, 20), R(240, 310, 40, 20));
    return { inner, outer, box: { x: -20, y: 160, x2: 320, y2: 380 } };
  }
  const face = body && d.bodyFace ? d.bodyFace : d.face;
  const rects = [
    ...(d.logo || LOGO),
    ...face,
    ...(body && !d.noBody ? d.body || BODY : []),
  ];
  const box = {
    x: Infinity,
    y: Infinity,
    x2: -Infinity,
    y2: -Infinity,
  };
  rects.forEach((r) => {
    box.x = Math.min(box.x, r.x);
    box.y = Math.min(box.y, r.y);
    box.x2 = Math.max(box.x2, r.x + r.w);
    box.y2 = Math.max(box.y2, r.y + r.h);
  });
  return { rects, box };
}
const rectTag = (r) =>
  `<rect${r.c ? ` class="${r.c}"` : ""}${r.s ? ` style="${r.s}"` : ""}${r.o != null ? ` fill-opacity="${r.o}"` : ""} x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;

const MOTION_CSS = `@keyframes omi-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4%)}}
@keyframes omi-hop{0%,60%,100%{transform:translateY(0)}20%{transform:translateY(-10%)}40%{transform:translateY(0)}50%{transform:translateY(-4%)}}
@keyframes omi-shake{0%,70%,100%{transform:translateX(0)}74%{transform:translateX(-3%)}80%{transform:translateX(3%)}86%{transform:translateX(-2%)}92%{transform:translateX(2%)}}
@keyframes omi-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
@keyframes omi-cursor{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes omi-dot{0%,100%{opacity:.25}30%{opacity:1}}
@keyframes omi-z{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(10px,-24px)}}
@keyframes omi-wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes omi-shades{0%{transform:translateY(-140px);opacity:0}18%,88%{transform:translateY(0);opacity:1}100%{transform:translateY(0);opacity:0}}
@keyframes omi-type{0%,8%{opacity:0}12%,82%{opacity:1}90%,100%{opacity:0}}
@keyframes omi-peek{0%,100%{transform:translateY(180px)}25%,75%{transform:translateY(0)}}
.omi-a g,.omi-a rect{transform-box:fill-box;transform-origin:center}
.omi-a .m-bob{animation:omi-bob 2.8s ease-in-out infinite}
.omi-a .m-happy{animation:omi-hop 1.6s ease-in-out infinite}
.omi-a .m-error{animation:omi-shake 2.2s ease-in-out infinite}
.omi-a .eye{animation:omi-blink 4s infinite}
.omi-a .cur{animation:omi-cursor 1.05s steps(1) infinite}
.omi-a .dot{animation:omi-dot 1.2s infinite}
.omi-a .dot2{animation-delay:.2s}.omi-a .dot3{animation-delay:.4s}
.omi-a .z{animation:omi-z 2.6s ease-out infinite}.omi-a .z2{animation-delay:.87s}.omi-a .z3{animation-delay:1.73s}
.omi-a .arm{animation:omi-wave 1.4s ease-in-out infinite}
.omi-a .shades{animation:omi-shades 3.6s cubic-bezier(.2,.8,.2,1) infinite}
.omi-a .ch{animation:omi-type 3.2s steps(1) infinite}
.omi-a .ch2{animation-delay:.25s}.omi-a .ch3{animation-delay:.5s}.omi-a .ch4{animation-delay:.75s}
.omi-a .peek{animation:omi-peek 4.5s ease-in-out infinite}
@keyframes omi-trav{0%,100%{transform:translateX(0)}50%{transform:translateX(40px)}}
@keyframes omi-look{0%,100%{transform:translateX(-10px)}50%{transform:translateX(10px)}}
@keyframes omi-scan{0%,100%{transform:translateX(-30px)}50%{transform:translateX(30px)}}
@keyframes omi-arrow{0%,100%{transform:translateY(-4px);opacity:.4}50%{transform:translateY(4px);opacity:1}}
@keyframes omi-pulse{0%,100%{transform:scaleX(1)}50%{transform:scaleX(1.5)}}
@keyframes omi-snake{0%{opacity:1}21.6%{opacity:.15}100%{opacity:.15}}
.omi-a .sn{animation:omi-snake 2.4s linear infinite}
@keyframes omi-t25{0%{opacity:1}25%{opacity:.2}100%{opacity:.2}}
@keyframes omi-t30{0%{opacity:1}30%{opacity:.2}100%{opacity:.2}}
@keyframes omi-t40{0%{opacity:1}40%{opacity:.2}100%{opacity:.2}}
.omi-a .t25{animation:omi-t25 var(--dur) linear var(--d) infinite}
.omi-a .t30{animation:omi-t30 var(--dur) linear var(--d) infinite}
.omi-a .t40{animation:omi-t40 var(--dur) linear var(--d) infinite}
@keyframes omi-a40{0%{opacity:1}40%{opacity:0}100%{opacity:0}}
.omi-a .a40{animation:omi-a40 var(--dur) linear var(--d) infinite}
@keyframes omi-t60{0%{opacity:1}60%{opacity:.2}100%{opacity:.2}}
.omi-a .t60{animation:omi-t60 var(--dur) linear var(--d) infinite}
@keyframes omi-ripple{0%,100%{opacity:.3}20%{opacity:1}60%{opacity:.3}}
.omi-a .ripple{animation:omi-ripple .8s ease-in-out var(--d,0s) infinite}
@keyframes omi-breathe{0%,100%{opacity:.35}50%{opacity:1}}
.omi-a .breathe{animation:omi-breathe 4s ease-in-out infinite}
@keyframes omi-pop{0%,100%{opacity:.35}20%{opacity:1}60%{opacity:.35}}
.omi-a .pop{animation:omi-pop 1.6s ease-in-out infinite}
@keyframes omi-flash{0%,70%,80%,92%,100%{opacity:1}74%,86%{opacity:.2}}
.omi-a .flash{animation:omi-flash 2.2s ease-in-out infinite}
@keyframes omi-drop{0%{transform:translateY(-10px);opacity:0}30%{transform:translateY(0);opacity:1}75%{transform:translateY(10px);opacity:1}100%{transform:translateY(20px);opacity:0}}
.omi-a .drop{animation:omi-drop 1.2s ease-in-out infinite}
@keyframes omi-unplug{0%,62%,78%,100%{transform:translateY(0)}68%,72%{transform:translateY(-10px)}}
.omi-a .unplug{animation:omi-unplug 3.2s ease-in-out infinite}
@keyframes omi-led{0%,100%{opacity:.15}50%{opacity:1}}
.omi-a .led{animation:omi-led 3s ease-in-out infinite}
@keyframes omi-hole{0%{opacity:0}5%{opacity:1}100%{opacity:1}}
.omi-a .hole{animation:omi-hole 4s linear var(--d) infinite}
@keyframes omi-rise{0%{transform:translateY(10px);opacity:0}30%{transform:translateY(0);opacity:1}75%{transform:translateY(-10px);opacity:1}100%{transform:translateY(-20px);opacity:0}}
.omi-a .rise{animation:omi-rise 1.2s ease-in-out infinite}
@keyframes omi-conf{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--mx),var(--my));opacity:0}}
.omi-a .conf{animation:omi-conf 1.6s cubic-bezier(.2,.7,.3,1) var(--d,0s) infinite}
@keyframes omi-beat{0%,40%,100%{transform:scale(1)}10%{transform:scale(1.06)}20%{transform:scale(1)}30%{transform:scale(1.04)}}
.omi-a .m-beat{animation:omi-beat 1.2s ease-in-out infinite}
@keyframes omi-heart{0%,20%,40%,100%{transform:none}10%{transform:translate(calc(var(--dx)*.35px),calc(var(--dy)*.35px)) scale(1.35)}30%{transform:translate(calc(var(--dx)*.2px),calc(var(--dy)*.2px)) scale(1.2)}}
.omi-a .hb{transform-box:fill-box;transform-origin:center;animation:omi-heart 1.2s ease-in-out infinite}
@keyframes omi-glitch{0%,86%,94%,100%{transform:translateX(0)}88%{transform:translateX(-8px)}90%{transform:translateX(6px)}92%{transform:translateX(-3px)}}
.omi-a .gl{animation:omi-glitch 2.4s linear var(--d,0s) infinite}
@keyframes omi-rain{0%{transform:translateY(0);opacity:0}10%{opacity:1}100%{transform:translateY(160px);opacity:0}}
.omi-a .rain{animation:omi-rain 1.4s linear var(--d,0s) infinite}
@keyframes omi-tile{0%,5%{opacity:0}12%,85%{opacity:1}95%,100%{opacity:0}}
.omi-a .tile{animation:omi-tile 3s ease-in-out var(--d,0s) infinite}
@keyframes omi-lid{0%,20%,85%,100%{transform:translateY(0)}35%,70%{transform:translateY(-60px)}}
.omi-a .lid{animation:omi-lid 2.4s ease-in-out infinite}
@keyframes omi-pulseop{0%,100%{opacity:1}50%{opacity:.35}}
.omi-a .m-slow{animation:omi-bob 5s ease-in-out infinite}
.omi-a .trav{animation:omi-trav 1.6s ease-in-out infinite}
.omi-a .look{animation:omi-look 3s ease-in-out infinite}
.omi-a .scan{animation:omi-scan 1.6s ease-in-out infinite}
.omi-a .arrow{animation:omi-arrow 1.2s ease-in-out infinite}
.omi-a .pulse{animation:omi-pulse .8s ease-in-out infinite}
.omi-a .pulseop{animation:omi-pulseop 1.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.omi-a:not(.force) *{animation:none!important}}`;
{
  const st = document.createElement("style");
  st.textContent = MOTION_CSS;
  document.head.appendChild(st);
}

const RATIOS = {
  "1:1": 1,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "21:9": 21 / 9,
};
function frameBox(box, pad, ratio) {
  const w = box.x2 - box.x,
    h = box.y2 - box.y,
    p = Math.max(w, h) * pad;
  let fw = w + p * 2,
    fh = h + p * 2;
  if (fw / fh < ratio) fw = fh * ratio;
  else fh = fw / ratio;
  return {
    x: box.x + w / 2 - fw / 2,
    y: box.y + h / 2 - fh / 2,
    w: fw,
    h: fh,
  };
}
function outSize() {
  const r = RATIOS[X.ratio] || 1,
    L = +X.size,
    even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return r >= 1
    ? { w: even(L), h: even(L / r) }
    : { w: even(L * r), h: even(L) };
}
function squareBox(box, pad) {
  const w = box.x2 - box.x,
    h = box.y2 - box.y,
    side = Math.max(w, h),
    p = side * pad;
  const s = side + p * 2;
  return {
    x: box.x - (side - w) / 2 - p,
    y: box.y - (side - h) / 2 - p,
    w: s,
    h: s,
  };
}

/* opts: {color,bg|null,body,animated,style,vb,size,label} */
function svgFor(d, o) {
  const sh = shapes(d, o.body);
  const vb = o.vb;
  let content;
  if (sh.inner) {
    content = `<g fill="${o.color}"><svg x="-60" y="-130" width="440" height="450" overflow="hidden"><g class="peek">${sh.inner.map(rectTag).join("")}</g></svg>${sh.outer.map(rectTag).join("")}</g>`;
  } else {
    content = `<g fill="${o.color}"${d.mood ? ` class="${d.mood}"` : ""}>${sh.rects.map(rectTag).join("")}</g>`;
  }
  const bg = o.bg
    ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${o.bg}"/>`
    : "";
  const size = o.size
    ? ` width="${o.size}" height="${Math.round((o.size * vb.h) / vb.w)}"`
    : "";
  const style = o.style ? `<style>${MOTION_CSS}</style>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"${size}${o.animated ? ` class="omi-a${o.force ? " force" : ""}"` : ""} shape-rendering="crispEdges"${o.label ? ` role="img" aria-label="${o.label}"` : ""}>${style}${bg}${content}</svg>`;
}
