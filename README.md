# Meet Omi - The Omarchy logo, brought to life.

> [!IMPORTANT]  
> **Concept!** Not final designs.

Omi is the Omarchy mascot: the Omarchy logo with a face, in 42 modes, from
idle and thinking to updating, success and party. It morphs from any mode to
any other, and it's drawn as plain rectangles, so any app can show it.

- **[index.html](index.html):** the design jig, where Omi's modes and
  animations are made. Serve the repo (`python3 -m http.server`) and open it.
- **[pack/](pack/):** what apps use: `omi.json` (every mode), `omi.js` (the
  player) and the spec.
- **[examples/](examples/):** Omi in an Omarchy shell plugin, a web page, a Qt
  Quick app and a terminal.
- **[docs/omarchy.md](docs/omarchy.md):** building Omi into Omarchy, and which
  mode to show when.
- **[protocol/](protocol/) and [service/](service/):** one Omi shared by
  every app on the machine.
- **[docs/ideas.md](docs/ideas.md):** modes and reactions still to make.

Checks: `node tools/check-player.js`, `node tools/check-quickshell.js` (in a
Wayland session), `node tools/check-service.js`, and the Qt Quick item:
`QML_XHR_ALLOW_FILE_READ=1 /usr/lib/qt6/bin/qmltestrunner -input tools/qml`.
