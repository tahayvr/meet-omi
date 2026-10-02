// An Omi item for QML (Qt 6.4+), running the reference player in QML's own
// JavaScript engine. No native code.
//
//     Omi {
//         width: 240; height: 240
//         color: "#9ece6a"
//         mode: "thinking"        // change it and Omi morphs there
//     }
//
// In your app, copy omi.js and omi.json from the pack next to this file and
// change the two paths below.
import QtQuick
import "../../pack/omi.js" as OmiJs

Item {
    id: root

    property string mode: "mark"
    property color color: "#9ece6a"
    property real speed: 1
    property bool animate: true
    // where the pack is; reading a local file over XMLHttpRequest needs
    // QML_XHR_ALLOW_FILE_READ=1 (or put the pack in your app's resources)
    property url pack: Qt.resolvedUrl("../../pack/omi.json")

    signal settled()

    property var player: null

    onModeChanged: if (player) player.set(mode)
    onSpeedChanged: if (player) player.speed = speed
    onAnimateChanged: if (player) player.animate = animate

    Component.onCompleted: {
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE) return
            // no canvas: QML paints the player's rects itself, below
            const p = new OmiJs.Omi(null, JSON.parse(xhr.responseText), {
                color: root.color.toString(),
                speed: root.speed,
                animate: root.animate,
            })
            p.on("settled", function () { root.settled() })
            root.player = p
            if (root.mode !== p.mode) p.set(root.mode, { instant: true })
            canvas.requestPaint()
        }
        xhr.open("GET", root.pack)
        xhr.send()
    }

    // one tick per display frame: advance the player, then repaint
    FrameAnimation {
        running: root.player !== null
        onTriggered: {
            root.player.frame(Date.now())
            canvas.requestPaint()
        }
    }

    Canvas {
        id: canvas
        anchors.fill: parent
        onPaint: {
            const ctx = getContext("2d")
            ctx.reset()
            const p = root.player
            if (!p) return
            // fit the pack's view square into the item, centered
            const v = p.view,
                s = Math.min(width / v[2], height / v[3]),
                ox = (width - v[2] * s) / 2 - v[0] * s,
                oy = (height - v[3] * s) / 2 - v[1] * s
            ctx.fillStyle = root.color
            for (const r of p.rects()) {
                if (r.o <= 0.001) continue
                // snap edges to pixels: crisp, and neighbours meet exactly
                const x0 = Math.round(r.x * s + ox), y0 = Math.round(r.y * s + oy),
                      x1 = Math.round((r.x + r.w) * s + ox), y1 = Math.round((r.y + r.h) * s + oy)
                if (x1 <= x0 || y1 <= y0) continue
                ctx.globalAlpha = Math.min(1, r.o)
                ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
            }
            ctx.globalAlpha = 1
        }
    }
}
