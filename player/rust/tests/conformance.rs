//! Checks the player against pack/conformance.json the way tools/conformance.js
//! checks the reference player (see "Checking your own player" in
//! pack/README.md): every mode at every listed time in drawing order, every
//! morph's start and end as sets, every gaze halfway and landed in drawing
//! order. The morph frames at 0.2 and 0.4 s are the reference player's and
//! are reported, not required.

use omi::{Options, Pack, Player, Rect};
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Deserialize)]
struct Conformance {
    tolerance: Tolerance,
    modes: BTreeMap<String, BTreeMap<String, Vec<Row>>>,
    morph_seconds: f64,
    morphs: Vec<MorphCase>,
    #[serde(default)]
    gazes: Vec<GazeCase>,
}

#[derive(Deserialize)]
struct Tolerance {
    position: f64,
    opacity: f64,
}

#[derive(Deserialize)]
struct MorphCase {
    from: String,
    to: String,
    start: Vec<Row>,
    #[serde(default)]
    frames: BTreeMap<String, Vec<Row>>,
    end: Vec<Row>,
}

#[derive(Deserialize)]
struct GazeCase {
    mode: String,
    look: [f64; 2],
    half: Half,
    end: Vec<Row>,
}

#[derive(Deserialize)]
struct Half {
    at: f64,
    rects: Vec<Row>,
}

/// [x, y, w, h, opacity, role]
#[derive(Deserialize)]
struct Row(f64, f64, f64, f64, f64, String);

fn same(t: &Tolerance, r: &Rect, e: &Row) -> bool {
    (r.x - e.0).abs() <= t.position
        && (r.y - e.1).abs() <= t.position
        && (r.w - e.2).abs() <= t.position
        && (r.h - e.3).abs() <= t.position
        && (r.opacity - e.4).abs() <= t.opacity
        && r.role == e.5
}

/// Only what a player draws: rects with an opacity above 0.001.
fn shown(list: Vec<Rect>) -> Vec<Rect> {
    list.into_iter().filter(|r| r.opacity > 0.001).collect()
}

fn same_list(t: &Tolerance, got: &[Rect], want: &[Row]) -> bool {
    got.len() == want.len() && got.iter().zip(want).all(|(r, e)| same(t, r, e))
}

/// Every expected rect is matched by a different drawn one.
fn same_set(t: &Tolerance, got: &[Rect], want: &[Row]) -> bool {
    if got.len() != want.len() {
        return false;
    }
    let mut left: Vec<&Rect> = got.iter().collect();
    want.iter()
        .all(|e| match left.iter().position(|r| same(t, r, e)) {
            Some(i) => {
                left.remove(i);
                true
            }
            None => false,
        })
}

fn load() -> (Pack, Conformance) {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../pack/");
    let read = |f: &str| {
        std::fs::read_to_string(format!("{dir}{f}")).unwrap_or_else(|e| panic!("{dir}{f}: {e}"))
    };
    let pack = Pack::parse(&read("omi.json")).expect("pack");
    let conf: Conformance = serde_json::from_str(&read("conformance.json")).expect("conformance");
    (pack, conf)
}

#[test]
fn conformance() {
    let (pack, conf) = load();
    let tol = &conf.tolerance;
    let mut omi = Player::new(&pack);
    let mut checks = 0;
    let mut fails: Vec<String> = Vec::new();

    // Modes: every listed time, in drawing order.
    for m in &pack.modes {
        let Some(times) = conf.modes.get(&m.id) else {
            continue;
        };
        for (t, want) in times {
            checks += 1;
            let got = shown(omi.mode_rects(&m.id, t.parse().unwrap()).unwrap());
            if !same_list(tol, &got, want) {
                fails.push(format!("{} at {t}s", m.id));
            }
        }
    }

    // Morphs: start and end as sets; the frames in between are reported.
    let mut frames_total = 0;
    let mut frames_set = 0;
    let mut frames_ordered = 0;
    for c in &conf.morphs {
        omi.set_instant(&c.from).unwrap();
        checks += 1;
        if !same_set(tol, &shown(omi.rects()), &c.start) {
            fails.push(format!("{} > {}: start", c.from, c.to));
        }
        omi.set(&c.to).unwrap();
        let mut ms = 1000.0;
        omi.frame(ms);
        let mut frames: Vec<(f64, &Vec<Row>)> = c
            .frames
            .iter()
            .map(|(t, r)| (t.parse().unwrap(), r))
            .collect();
        frames.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        let mut next = frames.into_iter().peekable();
        while omi.is_morphing() && ms < 1000.0 + conf.morph_seconds * 1000.0 + 1000.0 {
            ms += 10.0;
            omi.frame(ms);
            if let Some((at, want)) = next.peek() {
                if ms + 0.5 >= 1000.0 + at * 1000.0 {
                    frames_total += 1;
                    let got = shown(omi.rects());
                    if same_set(tol, &got, want) {
                        frames_set += 1;
                    }
                    if same_list(tol, &got, want) {
                        frames_ordered += 1;
                    }
                    next.next();
                }
            }
        }
        checks += 1;
        if !same_set(tol, &shown(omi.rects()), &c.end) {
            fails.push(format!("{} > {}: end", c.from, c.to));
        }
    }

    // Gazes: a mode at rest with no loops, turned to a direction; halfway and
    // landed, in drawing order.
    for g in &conf.gazes {
        omi.set_instant(&g.mode).unwrap();
        omi.set_animate(false);
        omi.look(0.0, 0.0);
        let mut ms = 5000.0;
        omi.frame(ms);
        omi.look(g.look[0], g.look[1]);
        while ms < 5000.0 + g.half.at * 1000.0 - 0.5 {
            ms += 5.0;
            omi.frame(ms);
        }
        checks += 1;
        if !same_list(tol, &shown(omi.rects()), &g.half.rects) {
            fails.push(format!("gaze {} {:?}: halfway", g.mode, g.look));
        }
        while omi.gazing() && ms < 20000.0 {
            ms += 10.0;
            omi.frame(ms);
        }
        checks += 1;
        if !same_list(tol, &shown(omi.rects()), &g.end) {
            fails.push(format!("gaze {} {:?}: landed", g.mode, g.look));
        }
        omi.set_animate(true);
        omi.look(0.0, 0.0);
        while omi.gazing() && ms < 30000.0 {
            ms += 10.0;
            omi.frame(ms);
        }
    }

    println!(
        "morph frames (reference player's, not required): {frames_set} of {frames_total} match as sets, {frames_ordered} in order"
    );
    if fails.is_empty() {
        println!(
            "ok: rust: {checks} checks ({} modes, {} morphs, {} gazes)",
            pack.modes.len(),
            conf.morphs.len(),
            conf.gazes.len()
        );
    } else {
        panic!(
            "FAIL rust: {} of {checks}:\n  {}",
            fails.len(),
            fails.join("\n  ")
        );
    }
}

#[test]
fn options_and_lookups() {
    let (pack, _) = load();
    let omi = Player::with_options(
        &pack,
        Options {
            mode: Some("idle".into()),
            animate: false,
            ..Options::default()
        },
    );
    assert_eq!(omi.mode(), "idle");
    assert_eq!(omi.kind("success"), omi::Kind::Reaction);
    assert_eq!(omi.kind("idle"), omi::Kind::State);
    assert!((omi.hold("success") - 1.2).abs() < 1e-9);
    let h = omi.hold("idle");
    assert!((1.2..=2.5).contains(&h));
    assert!(omi.loop_seconds("mark") == 0.0);
    assert!(omi.loop_seconds("idle") > 0.0);
    assert!(omi.mode_rects("no-such-mode", 0.0).is_err());
}

#[test]
fn body_motion_off_keeps_omi_still() {
    let (pack, _) = load();
    let omi = Player::with_options(
        &pack,
        Options {
            body_motion: false,
            ..Options::default()
        },
    );
    // idle bobs as a whole; without body motion its frame never moves.
    let a = omi.mode_rects("idle", 0.0).unwrap();
    let b = omi.mode_rects("idle", 1.4).unwrap();
    assert_eq!(a[0], b[0]);
}
