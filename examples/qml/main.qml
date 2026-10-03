// Try it:  QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml
//
// Omi watches the mouse, a click (or Space) makes it happy, ← → step
// through the modes, and the swatches show it takes any one color.
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 760
    height: 820
    visible: true
    title: "Omi in Qt Quick"

    // Light or dark with the system.
    readonly property bool dark: Application.styleHints.colorScheme !== Qt.ColorScheme.Light
    readonly property color ink: dark ? "#e6e7ef" : "#1a1b26"
    readonly property color muted: dark ? "#9095a8" : "#5a5f73"
    readonly property color line: dark ? "#2c2f40" : "#d5d7e0"
    readonly property var accents: [dark ? "#33a1ff" : "#2f7ae5", "#9ece6a", "#f7768e", "#e0af68", "#bb9af7"]
    color: dark ? "#11121a" : "#f5f5f7"

    function stepMode(by) {
        const ids = omi.modes.map(function (m) { return m.id; });
        omi.mode = ids[(ids.indexOf(omi.mode) + by + ids.length) % ids.length];
    }

    // The eyes follow the mouse anywhere in the window, and look ahead again
    // when it rests.
    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.NoButton
        onPositionChanged: function (mouse) {
            const c = omi.mapToItem(window.contentItem, omi.width / 2, omi.height / 2),
                  reach = omi.width * 1.5;
            omi.look = [Math.max(-1, Math.min(1, (mouse.x - c.x) / reach)),
                        Math.max(-1, Math.min(1, (mouse.y - c.y) / reach))];
            rest.restart();
        }
        onExited: omi.look = [0, 0]
    }
    Timer { id: rest; interval: 2500; onTriggered: omi.look = [0, 0] }

    Item {
        anchors.fill: parent
        focus: true
        Keys.onSpacePressed: omi.react("happy")
        Keys.onLeftPressed: window.stepMode(-1)
        Keys.onRightPressed: window.stepMode(1)
    }

    ColumnLayout {
        anchors { fill: parent; margins: 24 }
        spacing: 0

        Label {
            Layout.alignment: Qt.AlignHCenter
            text: "Omi"
            color: window.ink
            font { pixelSize: 22; bold: true }
        }
        Label {
            Layout.alignment: Qt.AlignHCenter
            text: "The Omarchy logo, brought to life."
            color: window.muted
        }

        // Omi in the middle of the free space, with room above it.
        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            Column {
                anchors.centerIn: parent
                spacing: 16

                Omi {
                    id: omi
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: 330
                    height: 330
                    color: window.accents[0]
                    // Starts as the plain logo and comes to life.
                    onLoaded: entrance.start()
                    Timer { id: entrance; interval: 600; onTriggered: omi.mode = "idle" }
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: omi.react("happy")
                    }
                }
                Label {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: { const m = omi.modes.filter(function (x) { return x.id === omi.mode; })[0]; return m ? m.name : ""; }
                    color: window.ink
                    font.pixelSize: 18
                }
                Label {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Omi watches the mouse. Click it or press Space to make it happy; ← → step through the modes."
                    color: window.muted
                    font.pixelSize: 12
                }
                // One color, any color.
                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 10
                    Repeater {
                        model: window.accents
                        delegate: Rectangle {
                            required property string modelData
                            width: 26; height: 26
                            color: modelData
                            border.width: Qt.colorEqual(omi.color, modelData) ? 2 : 0
                            border.color: window.ink
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: omi.color = parent.modelData }
                        }
                    }
                }
            }
        }

        // Every mode, one button each, square like Omi.
        Flow {
            Layout.fillWidth: true
            spacing: 6
            Repeater {
                model: omi.modes
                delegate: Rectangle {
                    required property var modelData
                    readonly property bool current: omi.mode === modelData.id
                    width: label.implicitWidth + 20
                    height: 32
                    color: current ? omi.color : "transparent"
                    border.width: current ? 0 : 1
                    border.color: window.line
                    Label {
                        id: label
                        anchors.centerIn: parent
                        text: parent.modelData.name
                        color: parent.current ? window.color : window.ink
                        font.pixelSize: 12
                    }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: omi.mode = parent.modelData.id }
                }
            }
        }
    }
}
