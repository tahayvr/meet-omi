// Try it:  QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    width: 560
    height: 640
    visible: true
    color: "#1a1b26"
    title: "Omi in QML"

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 16

        Omi {
            id: omi
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 320
            Layout.preferredHeight: 320
            color: "#9ece6a"
        }

        // a button per mode, read from the same pack
        Flow {
            Layout.fillWidth: true
            spacing: 6
            Repeater {
                model: omi.player ? omi.player.pack.modes : []
                Button {
                    text: modelData.name
                    checkable: true
                    checked: omi.mode === modelData.id
                    onClicked: omi.mode = modelData.id
                }
            }
        }
    }
}
