//! Loads the pack, morphs to a mode and prints the rects a host would fill.
//!
//!     cargo run --example print -- thinking

use omi::{Pack, Player};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mode = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "idle".to_string());
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../pack/omi.json");
    let pack = Pack::parse(&std::fs::read_to_string(path)?)?;
    let mut omi = Player::new(&pack);

    println!(
        "{mode}: {:?}, hold {:.1} s, loop {:.1} s",
        omi.kind(&mode),
        omi.hold(&mode),
        omi.loop_seconds(&mode)
    );
    omi.set(&mode)?;

    // 60 Hz frames for a second and a half: through the morph from the mark
    // (0.84 s), then into the mode's own loops. Every 30th frame is printed.
    for k in 0..=90 {
        let ms = k as f64 * 1000.0 / 60.0;
        omi.frame(ms);
        if k % 30 != 0 {
            continue;
        }
        let rects = omi.rects();
        let state = if omi.is_morphing() {
            "morphing"
        } else {
            "settled"
        };
        println!("\n{ms:.0} ms, {state}, {} rects:", rects.len());
        for r in &rects {
            println!(
                "  {:>8.2} {:>8.2} {:>7.2} {:>7.2}  {:.3}  {}",
                r.x, r.y, r.w, r.h, r.opacity, r.role
            );
        }
    }
    Ok(())
}
