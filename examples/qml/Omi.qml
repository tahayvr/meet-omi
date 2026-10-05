// Omi for Qt Quick apps (Qt 6.4+): the reference player in QML's own
// JavaScript engine, no native code. The same item as the Omarchy example
// (examples/omarchy/Omi.qml), but it reads the pack with XMLHttpRequest
// instead of Quickshell's FileView.
//
//     Omi {
//         width: 240; height: 240
//         color: palette.highlight     // one color: your accent
//         mode: "thinking"             // change it and Omi morphs there
//         look: [0, -1]                // the eyes look up, on top of any mode
//     }
//
//     omi.react("happy")               // a short reaction, then back to `mode`
//
// Omi is drawn as Rectangles snapped to device pixels, so it stays crisp at
// any scale, fractional ones included. In your app, ship omi.js and
// omi.json in your resources and point `pack` and the import at them;
// reading a local file over XMLHttpRequest needs QML_XHR_ALLOW_FILE_READ=1.
import QtQuick
import "../../pack/omi.js" as OmiJs

Item {
    id: omi

    // What Omi is doing. Changing it morphs there from wherever Omi is.
    property string mode: "mark"
    // One color: Omi is the Omarchy logo.
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
    // Where the eyes look, [x, y], each -1..1 (x right, y down).
    property var look: [0, 0]
    // true: each logo cell is a whole number of device pixels, so every bar
    // has the same thickness. Omi may then draw a little smaller than the item.
    property bool even: true
    // The pack's omi.json.
    property url pack: Qt.resolvedUrl("../../pack/omi.json")

    // Every mode in the pack: [{ id, name, ... }].
    readonly property var modes: player ? player.pack.modes : []
    // The mode on screen: `mode`, or a reaction playing over it.
    readonly property string showing: reaction !== "" ? reaction : mode
    // What a screen reader says for it, from the pack ("Omi is thinking").
    // The item is a picture by that name; bind Accessible.name to something
    // else if your app has better words for the moment.
    readonly property string label: player ? player.label(showing) : ""
    Accessible.role: Accessible.Graphic
    Accessible.name: label

    signal settled()
    signal loaded()

    property var player: null
    property string reaction: ""
    property bool moving: false
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

    Component.onCompleted: {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE) return;
            if (!xhr.responseText) {
                console.warn("Omi: couldn't read " + omi.pack + " (local files need QML_XHR_ALLOW_FILE_READ=1)");
                return;
            }
            const p = new OmiJs.Omi(null, JSON.parse(xhr.responseText), {
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
            p.look(omi.look[0] || 0, omi.look[1] || 0);
            omi.player = p;
            omi.step();
            omi.loaded();
        };
        xhr.open("GET", omi.pack);
        xhr.send();
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

    // Only while something moves on screen: loops, a morph or the eyes.
    readonly property bool onScreen: visible && !!Window.window && Window.window.visible
    FrameAnimation {
        running: omi.onScreen && omi.player !== null && (omi.animate || omi.moving || omi.gazing)
        onTriggered: omi.step()
    }

    // The pack's `view` square, fitted into this item and centered.
    readonly property var view: player ? player.view : [0, 0, 1, 1]
    readonly property real dpr: Window.window ? Window.window.devicePixelRatio : 1
    readonly property real fit: Math.min(width / view[2], height / view[3])
    readonly property real grid: player ? player.pack.grid : 20
    readonly property real unit: even && fit * dpr * grid >= 1
        ? Math.floor(fit * dpr * grid + 1e-6) / (dpr * grid) : fit
    // The size Omi is drawn at, in this item's units: the view square's side.
    // With `even` it can be a little under the item; lay out around this.
    readonly property real drawn: view[2] * unit
    readonly property real ox: (width - view[2] * unit) / 2 - view[0] * unit
    readonly property real oy: (height - view[3] * unit) / 2 - view[1] * unit

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
