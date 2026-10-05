# Designing a mode

How a mode goes from an idea to the pack that every app draws. The jig
(`index.html`) is where Omi is designed, and the pack is what comes out of
it: apps never read the jig's code. Ideas waiting to be designed are in
[ideas.md](ideas.md), each with a sketch of the pieces and the motion.

## The rules Omi is drawn by

- **Omi is the Omarchy logo.** The frame is the logo's own rectangles
  (`LOGO` in `js/geometry.js`), and a mode adds a face inside it, props
  around it, or bends the frame itself. Nothing is ever drawn that isn't a
  filled, axis-aligned rectangle.
- **One color.** Omi takes the host's accent, whatever it is. Meaning comes
  from shape and motion, never from a second color. Opacity is allowed
  (dim z's, fading dots), and a host that can't blend treats 0.5 or more as
  on.
- **The grid.** The logo is a 300 × 300 square of 20-unit cells. Eyes are
  one cell wide and two tall at rest, at (100, 110) and (180, 110). Keep
  pieces on the grid where you can: cells that sit on the grid are what
  the morph pairs between modes, so a mode drawn on it morphs cleanly.
- **No mouths.** Omi reads through its eyes, brows and props. The one
  mouth that existed (sudo's) was removed; happy and laughing shape the
  frame instead. A new mode with a mouth is a design decision to argue
  for, not a default.
- **Stays inside the view.** The pack's `view` is the logo with 70 units of
  room on every side; props live there. The eyes stay inside the inner
  square when they look around (`gaze.inside`).
- **Never guilt the user.** Modes exist for what the system is doing and
  for what just happened, not for scolding. Sad and crying are for things
  that were lost, never for a cancel, a skip or a wrong key.
- **Calm by default.** A loop is something the eye can rest on: a slow
  bob, a blink every few seconds, dots in sequence. Reactions can be quick,
  states must not be. Whole-body motion (bobs, hops, shakes) is a
  separate layer that small hosts turn off, so a mode must still read with
  it off.
- **At rest is frame 0.** A mode's still, its morph landing pose and the
  first frame of its loops are one and the same, so a loop whose natural
  start isn't a good still is rotated to one that is (`START` in
  `js/motion.js`).

## Where things are

| What | Where |
| --- | --- |
| The modes: faces, props, which loop each piece plays | `js/designs.js` (`DESIGNS`, grouped; faces in `F`, props and eggs beside it) |
| The pieces' building blocks and the logo | `js/geometry.js` (`R`, `LOGO`, `F`, `ARROW`, `QMARK`…) |
| Frame effects: bars that flow, grow or tile | `js/frames.js` |
| Every animation, as keyframes | `js/motion.js` (`ANIM`) |
| What a mode is for: kind, hold, family, easter | `js/pack.js` (`REACTIONS`, `FAMILIES`, `EASTER`) |
| The pack and its spec | `js/pack.js` (`buildPack`, `PACK_README`), written to `pack/` by `tools/build-pack.js` |
| The gallery | `docs/modes.md` and `docs/modes/`, written by `tools/modes-doc.js` |

## Making one

1. **Start from an idea with a sketch.** Say what the mode is for (a state
   or a reaction, and when an app would show it), which pieces it adds or
   changes, and how they move. The ideas table has this shape; add yours
   there first if it isn't.
2. **Draw the pieces.** In `js/designs.js`, add an entry to `DESIGNS` in
   the right group: `{ id, name, face, mood }`, where `face` is a list of
   rects (`R(x, y, w, h, anim)`, role set with `as("extra", …)` or the
   `role` field; eyes are `"eye"`, brows `"brow"`, props `"extra"`), and
   `mood` a whole-body animation or `""`. Replace the frame with `logo`
   only when the frame itself is part of the expression. Reuse the faces
   in `F` and the shapes in `js/geometry.js` where you can: Omi's
   consistency comes from the same eye in every mode.
3. **Give it motion.** Pick an existing animation by name, or add one to
   `ANIM` in `js/motion.js`: a duration, an ease and keyframes of `tx`,
   `ty`, `sx`, `sy`, `op`. A piece can lag its loop with `dl` to stagger a
   row. Check it at rest: if frame 0 isn't the pose you want to morph into,
   add the loop to `START` with how far in to begin.
4. **Say what it's for.** In `js/pack.js`, add a reaction's hold to
   `REACTIONS`, or leave it a state; put it in a family in `FAMILIES` if it
   means the same thing as another mode; mark a joke in `EASTER`.
5. **Look at it in the jig.** `npm run dev` and open
   http://localhost:8000: the Modes section shows every design looping, Morph
   plays any pair, and the Terminal section shows it at half-block size.
   Check it at the small end too: 44 device pixels across is where props
   must still read.
6. **Build the pack.** `node tools/build-pack.js` writes `pack/omi.json`,
   `pack/README.md`, `pack/conformance.json` and `pack/omi.js` (a copy of
   `player/omi.js`, so the pack ships with its player: edit the source,
   never the copy). Then `node tools/modes-doc.js` for the gallery.
   `npm run build` does both.
7. **Run every check.** `npm run check`: that the pack and the gallery
   are built from what's committed, the reference player and the service.
   `npm run check:rust`: the Rust player. `npm run check:qt`: the Qt item.
   In an Omarchy session, `npm run check:quickshell`: the player inside
   the shell itself. A new mode is only data,
   so all of them should pass unchanged; if a player fails, the mode uses
   something the spec doesn't cover, and the spec needs the rule before
   the pack does.
8. **Commit `pack/` and `docs/` with the source.** Apps copy the pack, so
   a mode that isn't in `pack/` doesn't exist to them. Mark the idea as
   "in pack" in `ideas.md`.

A change to the format itself (a new field a player must understand, a
rule that changes what a correct player draws) is a different thing from
a new mode: it needs the spec in `PACK_README` updated first, both players
brought along, conformance rebuilt, and a `PACK_VERSION` bump when an
older player would misread the new pack.
