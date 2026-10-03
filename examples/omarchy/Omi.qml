// Omi for Omarchy shell plugins (Quickshell, Qt 6). Copy this file with
// omi.js and omi.json from the pack into your plugin:
//
//     Omi {
//         width: 96; height: 96
//         color: Color.accent      // qs.Commons: follows the theme, live
//         mode: "idle"             // change it and Omi morphs there
//     }
//
//     omi.react("success")         // a short reaction, then back to `mode`
//     look: [0, -1]                // the eyes look up, on top of any mode
//
// Omi is drawn as Rectangles snapped to device pixels, so it stays crisp at
// any scale, fractional ones included. The pack is read with FileView
// (Quickshell.Io), which needs nothing from the environment.
import QtQuick
import Quickshell.Io
import "omi.js" as OmiJs

Item {
    id: omi

    // What Omi is doing. Changing it morphs there from wherever Omi is.
    property string mode: "mark"
    // One color: Omi is the Omarchy logo. Bind it to Color.accent.
    property color color: "white"
    // A new color fades in over this many milliseconds (0: at once), so a
    // theme change doesn't snap.
    property int colorFade: 350
    Behavior on color { ColorAnimation { duration: omi.colorFade } }
    property real speed: 1
    // false: each mode at rest, no loops (morphs still play).
    property bool animate: true
    // false: no whole-body bobs, hops and shakes. Calmer in small places.
    property bool bodyMotion: true
    // Where the eyes look, [x, y], each -1..1 (x right, y down): toward
    // something on screen, on top of any mode. [0, 0] is straight ahead.
    property var look: [0, 0]
    // true: each logo cell is a whole number of device pixels, so every bar
    // has the same thickness ("Drawing Omi crisp" in the pack README). Omi
    // may then draw a little smaller than this item.
    property bool even: true
    // The pack's omi.json; by default the one next to this file.
    property string packPath: decodeURIComponent(Qt.resolvedUrl("omi.json").toString().replace(/^file:\/\//, ""))

    // Every mode in the pack: [{ id, name, ... }].
    readonly property var modes: player ? player.pack.modes : []
    // The mode on screen: `mode`, or a reaction playing over it.
    readonly property string showing: reaction !== "" ? reaction : mode

    signal settled()

    property var player: null
    property string reaction: ""
    property bool moving: false
    // The eyes are on their way to a new look.
    property bool gazing: false
    property var rects: []

    // Plays `reactionMode`, then morphs back to `omi.mode`: for `seconds`
    // after its morph lands, or the pack's hold for that mode (omi.hold(),
    // 1.2 to 2.5 s) so every app reacts alike. A new reaction replaces one
    // still playing.
    function react(reactionMode, seconds) {
        reaction = reactionMode;
        const hold = seconds || (player ? player.hold(reactionMode) : 1.4),
              morph = player ? player.pack.morph.duration + player.pack.morph.stagger : 0.84;
        reactionTimer.interval = Math.round(1000 * (hold + morph));
        reactionTimer.restart();
    }

    Timer {
        id: reactionTimer
        onTriggered: omi.reaction = ""
    }

    FileView {
        id: packFile
        path: omi.packPath
        blockLoading: true
    }

    Component.onCompleted: {
        const p = new OmiJs.Omi(null, JSON.parse(packFile.text()), {
            color: String(omi.color),
            speed: omi.speed,
            animate: omi.animate,
            bodyMotion: omi.bodyMotion,
            mode: omi.showing
        });
        p.on("settled", function () {
            omi.moving = false;
            omi.settled();
        });
        player = p;
        p.look(look[0] || 0, look[1] || 0);
        step();
    }
    Component.onDestruction: if (player) player.destroy()

    onShowingChanged: if (player) {
        moving = true;
        player.set(showing);
    }
    onSpeedChanged: if (player) player.speed = speed
    onAnimateChanged: if (player) player.animate = animate
    onBodyMotionChanged: if (player) player.bodyMotion = bodyMotion
    onLookChanged: if (player) {
        player.look(look[0] || 0, look[1] || 0);
        gazing = player.gazing;
    }

    // Advance the player and take its rects.
    function step() {
        player.frame(Date.now());
        if (gazing && !player.gazing) gazing = false;
        rects = player.rects().filter(function (r) { return r.o > 0.001; });
    }

    // Only while something moves on screen: loops, or a morph landing. A
    // hidden layer window keeps its items "visible", so it is checked too.
    readonly property bool onScreen: visible && !!Window.window && Window.window.visible
    FrameAnimation {
        running: omi.onScreen && omi.player !== null && (omi.animate || omi.moving || omi.gazing)
        onTriggered: omi.step()
    }

    // The pack's `view` square, fitted into this item and centered.
    readonly property var view: player ? player.view : [0, 0, 1, 1]
    readonly property real fit: Math.min(width / view[2], height / view[3])
    readonly property real grid: player ? player.pack.grid : 20
    // (+ 1e-6: a width meant to be exact, like 88 device pixels, can come out
    // 87.99999 after the scale.)
    readonly property real unit: even && fit * dpr * grid >= 1
        ? Math.floor(fit * dpr * grid + 1e-6) / (dpr * grid) : fit
    // The size Omi is drawn at, in this item's units: the view square's side.
    // With `even` it can be a little under the item; lay out around this.
    readonly property real drawn: view[2] * unit
    readonly property real ox: (width - view[2] * unit) / 2 - view[0] * unit
    readonly property real oy: (height - view[3] * unit) / 2 - view[1] * unit
    readonly property real dpr: Window.window ? Window.window.devicePixelRatio : 1

    // Edges snapped to device pixels: crisp, and neighbours meet exactly.
    function snap(v) { return Math.round(v * dpr) / dpr; }

    Repeater {
        model: omi.rects.length
        delegate: Rectangle {
            required property int index
            readonly property var r: omi.rects[index] || { x: 0, y: 0, w: 0, h: 0, o: 0 }
            readonly property real x0: omi.snap(r.x * omi.unit + omi.ox)
            readonly property real y0: omi.snap(r.y * omi.unit + omi.oy)
            x: x0
            y: y0
            width: Math.max(0, omi.snap((r.x + r.w) * omi.unit + omi.ox) - x0)
            height: Math.max(0, omi.snap((r.y + r.h) * omi.unit + omi.oy) - y0)
            color: omi.color
            opacity: Math.min(1, r.o)
            antialiasing: false
        }
    }
}
