# Meet Omi - The Omarchy logo, brought to life.

> [!IMPORTANT]  
> **Concept!** Not final designs.

Omi is the Omarchy mascot: the Omarchy logo with a face. It has 49 modes,
from idle and thinking to updating, success and party, morphs from any one
to any other, and is drawn as plain rectangles in one color, so any app can
show it: a shell plugin, a web page, a Qt app, a terminal, a Rust or a
Python program.

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
  animations are made, and where any mode is exported as a picture or a
  video. `npm run dev` serves it at http://localhost:8000; the site,
  https://tahayvr.github.io/meet-omi/, is the same page, published from
  `master` once its checks pass
  ([.github/workflows/publish.yml](.github/workflows/publish.yml)). What it
  shows is the pack, played by the player: add `?check` to either address
  and the page checks that itself.
- **[pack/](pack/):** what apps use: `omi.json` (every mode), `omi.js` (the
  player) and the spec.
- **[player/rust/](player/rust/) and [player/python/](player/python/):**
  two more players, a Rust crate and a Python package, written from the
  spec and checked against the same conformance data. They draw every morph
  as the reference player does, rect for rect.
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

Checks: `npm run check` runs the ones that only need Node: that pack/ and
docs/modes are built from what's committed (`tools/build-pack.js --check`,
`tools/modes-doc.js --check`), the reference player (`tools/check-player.js`)
and the service (`tools/check-service.js`). Then `npm run check:site` (the
site, in Chrome: it shows the pack in pack/, and its CSS draws what the
player draws), `npm run check:rust` and `npm run check:python` (the Rust
and the Python player, on the conformance data), `npm run check:morphs`
(both of them against the reference player on every morph there is),
`npm run check:qt` (the Qt Quick item) and, in a Wayland session,
`npm run check:quickshell`.
`npm run build` rebuilds pack/ and docs/modes. All but the Quickshell one
run on every push ([.github/workflows/check.yml](.github/workflows/check.yml)).
