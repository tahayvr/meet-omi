// A small Omarchy shell plugin that shows Omi in the theme's accent, to try
// every mode and to see how a plugin drives Omi. From a terminal:
//
//     omarchy-shell shell summon omi.example                  # open it
//     omarchy-shell shell summon omi.example '{"mode":"party"}'
//     omarchy-shell shell call omi.example set thinking       # morph there
//     omarchy-shell shell call omi.example react success      # then back
//     omarchy-shell shell hide omi.example
//
// With it open, ← and → step through the modes, Space plays a success
// reaction, and Esc closes it.
import QtQuick
import Quickshell
import Quickshell.Wayland
import qs.Commons

Item {
    id: root

    // Injected by the shell after load.
    property string omarchyPath: ""
    property var shell: null
    property var manifest: null

    readonly property string pluginId: manifest && manifest.id ? manifest.id : "omi.example"
    property bool opened: false

    // ---------------------------------------------------- the shell's calls

    // summon: optional payload {"mode": "<id>"}.
    function open(payloadJson) {
        let payload = {};
        try { payload = payloadJson ? JSON.parse(payloadJson) : {}; } catch (e) {}
        if (payload.mode) set(String(payload.mode));
        opened = true;
        return "ok";
    }

    // hide. Idempotent: dismiss() calls it and then shell.hide(), which calls it again.
    function close() {
        opened = false;
    }

    function dismiss() {
        close();
        if (shell && typeof shell.hide === "function") shell.hide(pluginId);
    }

    // `shell call omi.example set <mode>`
    function set(mode) {
        if (!omi.modes.some(function (m) { return m.id === mode; })) return "no mode \"" + mode + "\"";
        omi.mode = mode;
        return "ok";
    }

    // `shell call omi.example react <mode>`: plays it, then back.
    function react(mode) {
        if (!omi.modes.some(function (m) { return m.id === mode; })) return "no mode \"" + mode + "\"";
        omi.react(mode);
        return "ok";
    }

    function info() {
        return JSON.stringify({ opened: opened, mode: omi.mode, showing: omi.showing });
    }

    function stepMode(by) {
        const ids = omi.modes.map(function (m) { return m.id; });
        const i = ids.indexOf(omi.mode);
        omi.mode = ids[(i + by + ids.length) % ids.length];
    }

    // ---------------------------------------------------- the view

    PanelWindow {
        visible: root.opened
        color: "transparent"
        anchors { top: true; bottom: true; left: true; right: true }
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.namespace: "omi-example"
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

        Rectangle {
            anchors.fill: parent
            color: Qt.rgba(Color.background.r, Color.background.g, Color.background.b, 0.78)
            MouseArea { anchors.fill: parent; onClicked: root.dismiss() }
        }

        Rectangle {
            id: card
            anchors.centerIn: parent
            width: column.implicitWidth + Style.space(48)
            height: column.implicitHeight + Style.space(40)
            radius: Style.cornerRadius
            color: Color.background
            border.width: 1
            border.color: Color.accent

            focus: true
            Keys.onEscapePressed: root.dismiss()
            Keys.onLeftPressed: root.stepMode(-1)
            Keys.onRightPressed: root.stepMode(1)
            Keys.onSpacePressed: omi.react("success")

            // Swallow clicks so they don't reach the scrim.
            MouseArea { anchors.fill: parent }

            Column {
                id: column
                anchors.centerIn: parent
                spacing: Style.space(12)

                Omi {
                    id: omi
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: Style.space(220)
                    height: width
                    color: Color.accent
                    mode: "idle"
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: {
                        const m = omi.modes.filter(function (x) { return x.id === omi.showing; })[0];
                        return m ? m.name : omi.showing;
                    }
                    color: Color.foreground
                    font.family: Style.font.family
                    font.pixelSize: Style.font.title
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "← →  modes      Space  react      Esc  close"
                    color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.62)
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                }
            }
        }
    }
}
