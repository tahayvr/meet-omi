# Omi player in Rust

A second, independent player for the Omi pack, as a Rust crate (`omi`),
written from `pack/README.md` alone and checked against
`pack/conformance.json`. It exists to show that the pack is a
language-neutral contract: the reference player, `player/omi.js`, was only
consulted where the README left something open, and those gaps are being
fixed in the README itself.

The crate draws nothing. A host calls `frame(ms)` on every display frame and
fills the rects itself, in its accent colour. Dependencies: `serde` and
`serde_json`.

## Using it

    use omi::{Pack, Player};

    let pack = Pack::parse(&std::fs::read_to_string("omi.json")?)?;
    let mut omi = Player::new(&pack);   // starts at "mark", the plain logo
    omi.set("thinking")?;               // morphs there from wherever Omi is
    loop {
        omi.frame(now_ms());            // wall clock, milliseconds
        for r in omi.rects() {          // grid units, in drawing order
            fill(r.x, r.y, r.w, r.h, r.opacity); // r.role says what it is
        }
    }

`Player::with_options` takes `speed`, `animate`, `body_motion` and the start
`mode`. Also there: `set_instant`, `mode_rects(mode, seconds)` for stills,
`look(dx, dy)`, `gaze()`, `gazing()`, `loop_seconds`, `hold`, `kind`,
`settled()` and `is_morphing()`. See "Drawing Omi crisp" in the pack README
for how to snap the rects to device pixels.

## Checking it

    cargo test                          # conformance against ../../pack
    cargo run --example print -- idle   # prints a few frames of rects

The test prints the counts, like `tools/check-player.js` does for the
reference player, and how many of the reference player's in-between morph
frames it matches (those are not required by the pack).
