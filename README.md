# Meet Omi - The Omarchy logo, brought to life.

> [!IMPORTANT]  
> **Concept!** Not final designs.

Omi is the Omarchy mascot: the Omarchy logo with a face. It has 42 modes,
from idle and thinking to updating, success and party, morphs from any one
to any other, and is drawn as plain rectangles in one color, so any app can
show it: a shell plugin, a web page, a Qt app, a terminal, a Rust program.

![Every Omi mode](docs/modes/sheet.svg)

## What Omi is for

Omarchy is a system that talks to its user: notices at first boot, updates,
agents that work on their behalf. Omi gives those moments one face. An app
sets what Omi is doing (`thinking` while it checks, `updating` while it
installs, `listening` while it waits for a key) and reacts to what just
happened (`success`, `surprised`), and because every app uses the same
modes for the same situations, Omi means the same thing everywhere.

The rules it's drawn by, in short (the long form is in
[docs/designing.md](docs/designing.md)):

- **It is the logo.** Every mode is the Omarchy logo's own rectangles, with
  a face inside, props around, or the frame itself bending.
- **One color.** Omi takes the host's accent. Meaning comes from shape and
  motion, never from a second color.
- **Pixel art.** Everything sits on the logo's 20-unit grid, so Omi stays
  crisp at any size and morphs cleanly between modes.
- **Eyes, not mouths.** Omi reads through its eyes, brows and props.
- **Never guilt the user.** Modes are for what the system is doing and
  what just happened, not for scolding.
- **Calm by default.** States are something the eye can rest on;
  reactions are quick and go back by themselves.

[docs/modes.md](docs/modes.md) shows every mode with what it's for.

- **[index.html](index.html):** the design jig, where Omi's modes and
  animations are made. Serve the repo (`python3 -m http.server`) and open it.
- **[pack/](pack/):** what apps use: `omi.json` (every mode), `omi.js` (the
  player) and the spec.
- **[player/rust/](player/rust/):** a second player, a Rust crate written
  from the spec alone and checked against the same conformance data.
- **[examples/](examples/):** Omi in an Omarchy shell plugin, a web page, a Qt
  Quick app and a terminal.
- **[docs/omarchy.md](docs/omarchy.md):** building Omi into Omarchy, and which
  mode to show when.
- **[docs/modes.md](docs/modes.md):** every mode, with a still and what it's
  for. **[docs/designing.md](docs/designing.md):** the rules Omi is drawn
  by, and how a mode goes from the jig to the pack.
- **[protocol/](protocol/) and [service/](service/):** one Omi shared by
  every app on the machine.
- **[docs/ideas.md](docs/ideas.md):** modes and reactions still to make, each
  with a sketch.

Checks: `node tools/build-pack.js --check` (pack/ is up to date, including
its copy of the player), `node tools/check-player.js`,
`node tools/check-quickshell.js` (in a
Wayland session), `node tools/check-service.js`, the Qt Quick item:
`QML_XHR_ALLOW_FILE_READ=1 /usr/lib/qt6/bin/qmltestrunner -input tools/qml`,
and the Rust player: `cargo test` in `player/rust`.
