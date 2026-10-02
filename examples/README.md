# Using Omi in your app

Each example uses only the published pack in [`../pack`](../pack): `omi.json`
(the data) and `omi.js` (the reference player). Copy those two files into your
project and start from the example closest to your environment.

| Example | Environment | How it draws |
|---|---|---|
| [web](web/index.html) | Web pages, Electron | The player draws on a `<canvas>` by itself |
| [qml](qml/Omi.qml) | Qt Quick (Qt 6.4+) | The player runs in QML's JavaScript engine; a QML `Canvas` fills its rects |
| [terminal](terminal/omi-tty.js) | Any terminal with 24-bit color (Node) | Rects become half-block characters |

## The pattern

Every example does the same three things, and so would a player in another
language:

1. **Load the pack** and create a player: `new Omi(canvas, pack, options)`.
   Without a browser canvas, pass `null` and a `color`.
2. **Tell it what Omi is doing**: `omi.set("thinking")`. It morphs there from
   wherever Omi is, even mid-morph. `{ instant: true }` jumps instead.
3. **Draw every frame.** In a browser the player does this itself. Anywhere
   else, call `omi.frame(Date.now())` once per display frame, then fill the
   rectangles in `omi.rects()`: each has `x, y, w, h` in pack units and an
   opacity `o`. Map the pack's `view` square to your drawing area.

`omi.on("settled", fn)` tells you when a morph has landed.

## Running them

- **Web:** serve the repo (for example `python3 -m http.server`) and open
  `/examples/web/`.
- **QML:** `QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml`. The
  environment variable lets QML read the pack from disk; in an app, ship the
  pack in your resources instead.
- **Terminal:** `node examples/terminal/omi-tty.js` tours every mode;
  `node examples/terminal/omi-tty.js idle thinking` cycles the modes you name;
  `--once error` prints one still.

## Another language

A player is small: work out a mode's rects at time t, plan and play morphs,
fill rects. [`../pack/README.md`](../pack/README.md) describes every rule, and
[`../pack/conformance.json`](../pack/conformance.json) lists what a correct
player draws; [`../tools/check-player.js`](../tools/check-player.js) shows how
to check yours against it.
