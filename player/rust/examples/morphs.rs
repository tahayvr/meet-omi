//! Holds this player to the reference player on every morph there is.
//!
//! `tools/check-morphs.js` writes the reference player's frames, one line
//! each as JSON, and runs this with the file: it plays every line the same
//! way and compares the rects, in drawing order. See that tool for what a
//! line holds and how it is played.
//!
//!     cargo run --release --example morphs -- morphs.jsonl

use omi::{Pack, Player, Rect};
use std::io::{BufRead, BufReader};

/// [x, y, w, h, opacity, role]
type Row = (f64, f64, f64, f64, f64, String);
/// [how, before, from, to, rects]
type Line = (String, Option<String>, String, String, Vec<Row>);

// The pack's tolerance, and the half a digit the file's numbers are rounded by.
const POSITION: f64 = 0.01 + 0.00005;
const OPACITY: f64 = 0.001 + 0.00005;

fn play(pack: &Pack, how: &str, before: Option<&str>, old: &str, new: &str) -> Result<Vec<Rect>, omi::Error> {
    let mut omi = Player::new(pack);
    let mut ms = 1000.0;
    let run = |omi: &mut Player, ms: &mut f64, seconds: f64| {
        let stop = *ms + seconds * 1000.0;
        while *ms < stop - 1e-6 {
            *ms += 10.0;
            omi.frame(*ms);
        }
    };
    if how == "morph" {
        omi.set_instant(before.unwrap_or(old))?;
        omi.frame(ms);
        omi.set(old)?;
        omi.frame(ms);
        run(&mut omi, &mut ms, 0.3);
    } else {
        omi.set_instant(old)?;
        omi.frame(ms);
        if how == "loop" {
            run(&mut omi, &mut ms, 0.9);
        }
    }
    omi.set(new)?;
    omi.frame(ms);
    run(&mut omi, &mut ms, 0.3);
    Ok(omi.rects())
}

fn same(rects: &[Rect], wanted: &[Row]) -> bool {
    rects.len() == wanted.len()
        && rects.iter().zip(wanted).all(|(r, w)| {
            r.role == w.5
                && (r.opacity - w.4).abs() <= OPACITY
                && (r.x - w.0).abs() <= POSITION
                && (r.y - w.1).abs() <= POSITION
                && (r.w - w.2).abs() <= POSITION
                && (r.h - w.3).abs() <= POSITION
        })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let file = std::env::args().nth(1).ok_or("give the file tools/check-morphs.js wrote")?;
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../pack/omi.json");
    let pack = Pack::parse(&std::fs::read_to_string(path)?)?;
    let (mut total, mut off) = (0, Vec::new());
    for line in BufReader::new(std::fs::File::open(file)?).lines() {
        let (how, before, old, new, wanted): Line = serde_json::from_str(&line?)?;
        total += 1;
        if !same(&play(&pack, &how, before.as_deref(), &old, &new)?, &wanted) {
            off.push(format!("{old} to {new} ({how})"));
        }
    }
    if off.is_empty() {
        println!("ok: rust: every morph is the reference player's, rect for rect ({total})");
        return Ok(());
    }
    println!(
        "FAIL rust: {} of {total} morphs are not the reference player's: {}{}",
        off.len(),
        off[..off.len().min(8)].join(", "),
        if off.len() > 8 { ", ..." } else { "" }
    );
    std::process::exit(1);
}
