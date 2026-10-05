# Omi player in Python

A third player for the Omi pack, as a Python package (`omi`). Like the Rust
crate, it is there to show that the pack is a language-neutral contract, and
it was written to find out how complete the pack's README is:

1. First from `pack/README.md` alone, without opening the reference player
   (`player/omi.js`) or the Rust crate: where the README left something
   open, the readings it allows were tried against `pack/conformance.json`.
   That version passed every conformance check.
2. It was then compared with the reference player on every morph in the
   pack (`tools/check-morphs.js`), and drew about one in ten differently.
   The README's steps for pairing pieces were not as exact as it said, a
   few were not what the reference player did, and some pairings turned on
   the last digits of an ease.
3. The README was made to say exactly what happens, the reference player
   changed in the four places where a simpler rule was the better one, and
   this player was brought in line with the README. It now draws every one
   of those morphs as the reference player does, rect for rect.

What the README gained from it is listed at the end.

The package draws nothing. A host calls `frame(ms)` on every display frame
and fills the rects itself, in its accent colour. It needs Python 3.9 or
later and only the standard library.

## Using it

    import time
    from omi import Pack, Player

    pack = Pack.load("omi.json")
    omi = Player(pack)                  # starts at "mark", the plain logo
    omi.set("thinking")                 # morphs there from wherever Omi is
    while True:
        omi.frame(time.time() * 1000)   # wall clock, milliseconds
        for r in omi.rects():           # grid units, in drawing order
            fill(r.x, r.y, r.w, r.h, r.opacity)   # r.role says what it is

`Player(pack, speed=1.0, animate=True, body_motion=True, mode="mark",
on_settled=None)` takes its options by name; `on_settled(mode)` is called
when a morph lands, and after a jump. Also there: `set(mode, instant=True)` to jump,
`mode_rects(mode, seconds)` for stills, `look(dx, dy)`, `gaze()`, `gazing`,
`loop_seconds(mode)`, `hold(mode)`, `kind(mode)`, `label(mode)` (what a
screen reader says for a mode: your toolkit's accessible name), `mode`,
`morphing` and `settled`. A mode the pack doesn't have raises `omi.UnknownMode`, a
`KeyError`; a file that isn't a version 1 pack raises `omi.PackError`, a
`ValueError`. See "Drawing Omi crisp" in the pack README for how to snap
the rects to device pixels.

To show the shared Omi of the [state protocol](../../protocol/README.md),
hand each `state` to the player with its `since`:

    omi.set(state["mode"], instant=state["instant"], since=state["since"])

The change is played as if it had started at `since`: part of the way
along, or landed, with its loops that much further on. For this the player
takes the clock given to `frame` as the time now, so give `frame` Unix time
in milliseconds, as above, and play at speed 1. A service that doesn't know
the pack may name a mode it doesn't have: check `pack.has(mode)` first.

## Checking it

    python3 -m unittest discover -s tests -v   # conformance against ../../pack
    node ../../tools/check-morphs.js python    # every morph, against the reference player
    python3 examples/print.py idle             # prints a few frames of rects

`tests/test_conformance.py` follows "Checking your own player" in the pack
README and ends with one line of counts, with how many of the reference
player's in-between morph frames it matches. `tests/test_api.py` holds the
player to rules the conformance data has no cases for: the clocks, jumps, a
change in the middle of a morph, the gaze meeting a morph, `since`.
`tests/morphs.py` is the player's half of `tools/check-morphs.js`: every
pair of modes, from rest, from the middle of a loop and from the middle of
another morph, 7056 morphs in all.

## What the pack README gained

Rules it left open, now written down:

- **Pairing.** What makes two cells "the same" (x, y, w and h each rounded
  to half a unit), which way halves round, the order a cut rect's cells
  come in, how the offset that rounds to (0, 0) is treated and what the
  others have to beat, and where the rounds end.
- **The assignment.** Several assignments can cost the same, so the method
  is written out, with its ties. A banned pair costs 1e9 more, not
  "infinity".
- **Leftover cells.** Which cells a new cell may split off or an old one
  slide into (the ones the rigid groups left over), that the first of two
  as near wins, and that a cell grown from its center uses the raw
  progress for its size too.
- **Order.** The order a morph is drawn in.
- **Around a morph.** The new mode's hidden rects are left out like the old
  one's; the frame a morph lands on shows the new mode at rest and drops
  what it overshot by; a change to the mode a morph is heading for is a
  new morph; a change with nothing on screen is a jump.
- **Small things.** `speed` is never less than 0.05, a body animation's
  `op` is ignored, a piece without a number an animation reads has 0, what
  `animate: false` and `instant` do.

Rules that had to change for two players to agree to the last rect:

- **An ease is solved one way**, 24 halvings: any way lands within the
  tolerance, but not on the same last digits.
- **Rects are rounded to 1/1024 before pairing.** Costs are then sums of
  exact numbers, so a tie is a tie in every language, instead of a coin
  tossed by rounding.

One thing is this player's own. For a change with `since`, the Omi state
protocol says what to draw but not where "now" comes from: here it is the
clock given to `frame`, read on every frame, so give `frame` Unix time.
