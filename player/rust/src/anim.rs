//! Animations: easing curves and a piece's look at time t, as the README's
//! "Animations" section describes. Values come in two channels, move (tx, ty,
//! sx, sy) and opacity (op), each worked out on its own.

use crate::pack::{Animation, Ease, Key, Value};
use std::collections::BTreeMap;

/// What an animation does to a piece at one moment, on top of its rest
/// position.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Motion {
    pub tx: f64,
    pub ty: f64,
    pub sx: f64,
    pub sy: f64,
    pub op: f64,
}

/// At rest: no move, no scale, full opacity.
pub const REST: Motion = Motion {
    tx: 0.0,
    ty: 0.0,
    sx: 1.0,
    sy: 1.0,
    op: 1.0,
};

const MOVE: [&str; 4] = ["tx", "ty", "sx", "sy"];
const OPACITY: [&str; 1] = ["op"];

/// The eased value of progress `p` (0..1).
pub fn ease(e: &Ease, p: f64) -> f64 {
    match e {
        // "steps" holds the first value until the next key.
        Ease::Steps => {
            if p >= 1.0 {
                1.0
            } else {
                0.0
            }
        }
        Ease::Bezier(c) => bezier(c, p),
    }
}

/// CSS cubic-bezier(x1, y1, x2, y2): find the curve parameter whose x is p by
/// bisection (x is monotonic for x1, x2 in 0..1), and return its y.
pub fn bezier(c: &[f64; 4], p: f64) -> f64 {
    if p <= 0.0 || p >= 1.0 {
        return p;
    }
    let [x1, y1, x2, y2] = *c;
    let at = |a: f64, b: f64, t: f64| {
        3.0 * a * t * (1.0 - t) * (1.0 - t) + 3.0 * b * t * t * (1.0 - t) + t * t * t
    };
    let (mut lo, mut hi) = (0.0, 1.0);
    let mut t = p;
    for _ in 0..32 {
        t = (lo + hi) / 2.0;
        if at(x1, x2, t) < p {
            lo = t;
        } else {
            hi = t;
        }
    }
    at(y1, y2, t)
}

/// A rest value for a channel property.
fn rest(prop: &str) -> f64 {
    match prop {
        "sx" | "sy" | "op" => 1.0,
        _ => 0.0,
    }
}

/// A piece's look `t` seconds into an animation. `delay` and `duration` are
/// the piece's own (the duration overriding the animation's when set), and
/// `var` gives the piece's numbers for [name, factor] values.
pub fn motion(
    anim: &Animation,
    t: f64,
    delay: f64,
    duration: Option<f64>,
    var: &dyn Fn(&str) -> f64,
) -> Motion {
    let dur = duration.unwrap_or(anim.duration);
    // Progress wraps: a piece that lags behind shows the end of its loop
    // before its first frame.
    let p = ((t - delay) / dur).rem_euclid(1.0);
    let value = |v: Option<&Value>, prop: &str| match v {
        None => rest(prop),
        Some(Value::Number(n)) => *n,
        Some(Value::Var(name, factor)) => var(name) * factor,
    };
    let mut out = REST;
    for props in [&MOVE[..], &OPACITY[..]] {
        let keys = channel(&anim.keys, props);
        if keys.is_empty() {
            continue;
        }
        // The two keys around p.
        let mut i = 1;
        while i < keys.len() - 1 && p > keys[i].0 {
            i += 1;
        }
        let (p0, v0) = &keys[i - 1];
        let (p1, v1) = &keys[i];
        let k = if p1 == p0 {
            1.0
        } else {
            ease(&anim.ease, (p - p0) / (p1 - p0))
        };
        for prop in props {
            let a = value(v0.get(*prop), prop);
            let b = value(v1.get(*prop), prop);
            let v = a + (b - a) * k;
            match *prop {
                "tx" => out.tx = v,
                "ty" => out.ty = v,
                "sx" => out.sx = v,
                "sy" => out.sy = v,
                _ => out.op = v,
            }
        }
    }
    out
}

/// The keys that set any of a channel's values, with a rest key added at 0
/// and at 1 when the channel has none there. Empty if no key sets them.
fn channel<'a>(keys: &'a [Key], props: &[&str]) -> Vec<(f64, &'a BTreeMap<String, Value>)> {
    static EMPTY: BTreeMap<String, Value> = BTreeMap::new();
    let mut out: Vec<(f64, &BTreeMap<String, Value>)> = keys
        .iter()
        .filter(|(_, v)| props.iter().any(|q| v.contains_key(*q)))
        .map(|(p, v)| (*p, v))
        .collect();
    if out.is_empty() {
        return out;
    }
    if out[0].0 > 0.0 {
        out.insert(0, (0.0, &EMPTY));
    }
    if out[out.len() - 1].0 < 1.0 {
        out.push((1.0, &EMPTY));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linear_bezier_is_identity() {
        let c = [0.0, 0.0, 1.0, 1.0];
        for i in 0..=10 {
            let p = i as f64 / 10.0;
            assert!((bezier(&c, p) - p).abs() < 1e-6);
        }
    }

    #[test]
    fn ease_in_out_is_symmetric() {
        let c = [0.42, 0.0, 0.58, 1.0];
        assert!((bezier(&c, 0.5) - 0.5).abs() < 1e-6);
        assert!(bezier(&c, 0.25) < 0.25);
        assert!(bezier(&c, 0.75) > 0.75);
    }
}
