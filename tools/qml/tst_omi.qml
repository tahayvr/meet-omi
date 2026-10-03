// Checks examples/qml/Omi.qml, the Omi item Qt Quick apps copy, in a real
// Qt Quick window: loading, morphing, reactions, gaze, even drawing.
//
//     QML_XHR_ALLOW_FILE_READ=1 /usr/lib/qt6/bin/qmltestrunner -input tools/qml
import QtQuick
import QtTest
import "../../examples/qml"

TestCase {
    id: test
    name: "Omi"
    when: windowShown
    // A TestCase is invisible by default, which Omi takes as hidden.
    visible: true
    width: 400
    height: 400

    Omi {
        id: omi
        width: 330
        height: 330
        color: "#33a1ff"
        mode: "idle"
    }
    SignalSpy { id: loaded; target: omi; signalName: "loaded" }
    SignalSpy { id: settled; target: omi; signalName: "settled" }

    function initTestCase() {
        if (!omi.player) loaded.wait(5000);
        verify(omi.player !== null, "the pack loads");
        compare(omi.modes.length, 42);
    }

    function test_1_draws() {
        tryVerify(function () { return omi.rects.length > 0; }, 2000, "rects to draw");
        // Every rect drawn as a child Rectangle, inside the item.
        verify(omi.rects.every(function (r) { return r.w > 0 && r.h > 0; }));
    }

    function test_2_morphs() {
        settled.clear();
        omi.mode = "thinking";
        verify(omi.moving, "a morph runs");
        settled.wait(3000);
        verify(!omi.moving, "and lands");
        compare(omi.player.mode, "thinking");
    }

    function test_3_reacts() {
        omi.mode = "idle";
        settled.wait(3000);
        omi.react("happy", 0.6);
        compare(omi.showing, "happy", "the reaction plays over the mode");
        compare(omi.mode, "idle", "the mode stays");
        tryCompare(omi, "showing", "idle", 3000, "then goes back");
    }

    function test_4_looks() {
        omi.look = [0, -1];
        verify(omi.gazing, "the eyes are on their way");
        tryVerify(function () { return !omi.gazing; }, 2000, "and get there");
        const g = omi.player.gaze();
        compare(g[0], 0);
        compare(g[1], -1);
        omi.look = [0, 0];
        tryVerify(function () { return !omi.gazing; }, 2000);
    }

    function test_5_even() {
        // Whole device pixels per logo cell (20 units): every bar the same.
        const cell = omi.unit * omi.grid * omi.dpr;
        fuzzyCompare(cell, Math.round(cell), 1e-6, "a cell is whole device pixels");
        verify(omi.unit <= omi.fit, "never bigger than the item");
        omi.even = false;
        compare(omi.unit, omi.fit, "even off: fills the item");
        omi.even = true;
    }

    function test_6_rests_when_hidden() {
        omi.visible = false;
        verify(!omi.onScreen, "hidden: no frames");
        omi.visible = true;
        verify(omi.onScreen);
    }
}
