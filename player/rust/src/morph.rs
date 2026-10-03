//! Morph planning: pairing what is on screen with the new mode's pieces, as
//! the README's "Morphing from one mode to another" describes. The player
//! then moves each pair over time (see `Player::step_morph`).

use crate::pack::Pack;
use crate::Rect;
use std::collections::HashMap;

/// Pairs of different roles that never move into each other.
const FACE: [&str; 4] = ["eye", "brow", "mouth", "tear"];
/// A cost that rules a pair out.
const BAN: f64 = 1e9;
/// Distances from `morph.center` are measured against this many grid units
/// when spreading the stagger: a piece this far out (or further) starts last.
const RIPPLE: f64 = 260.0;

/// One piece's journey through a morph.
#[derive(Debug, Clone)]
pub struct Step {
    /// Where it starts (opacity included).
    pub from: Rect,
    /// Where it ends.
    pub to: Rect,
    /// The role it is drawn with: the new piece's, or the old one's when it
    /// only shrinks away.
    pub role: String,
    /// Seconds after the morph starts that this step starts.
    pub delay: f64,
    /// True for a new piece growing from its own center (with an overshoot)
    /// rather than moving from a start rect.
    pub pop: bool,
    /// Where it is now.
    pub now: Rect,
}

/// Plans a morph from `from` (what is on screen) to `to` (the new mode at
/// rest). Both are cut into grid cells first.
pub fn plan(pack: &Pack, from: &[Rect], to: &[Rect]) -> Vec<Step> {
    let planner = Planner::new(pack);
    let src: Vec<Rect> = from.iter().flat_map(|r| planner.cells(r)).collect();
    let dst: Vec<Rect> = to.iter().flat_map(|r| planner.cells(r)).collect();
    let (stagger, [cx, cy]) = (pack.morph.stagger, pack.morph.center);
    planner
        .pair(&src, &dst)
        .into_iter()
        .map(|p| {
            // The ripple: the further the piece lands from the center, the
            // later it starts. A group that moved as one body starts early.
            let target = if p.to.w > 0.0 || p.to.h > 0.0 {
                &p.to
            } else {
                &p.from
            };
            let (tx, ty) = center(target);
            let delay = if p.rigid {
                stagger * 0.25
            } else {
                (((tx - cx).powi(2) + (ty - cy).powi(2)).sqrt() / RIPPLE).min(1.0) * stagger
            };
            Step {
                now: p.from.clone(),
                from: p.from,
                to: p.to,
                role: p.role,
                delay,
                pop: p.pop,
            }
        })
        .collect()
}

/// A pairing before its timing is set.
struct Pair {
    from: Rect,
    to: Rect,
    role: String,
    pop: bool,
    /// Part of a group that moved by one shared offset.
    rigid: bool,
}

/// Same-place keys at half-unit precision: x, y, w, h and role.
type PlaceKey<'a> = (i64, i64, i64, i64, &'a str);

struct Planner {
    grid: f64,
    reach2: f64,
    penalty2: f64,
    /// The logo itself (the "mark" mode): pieces touching it get cut.
    logo: Vec<Rect>,
}

fn center(r: &Rect) -> (f64, f64) {
    (r.x + r.w / 2.0, r.y + r.h / 2.0)
}

fn dist2(a: &Rect, b: &Rect) -> f64 {
    let (ax, ay) = center(a);
    let (bx, by) = center(b);
    (ax - bx).powi(2) + (ay - by).powi(2)
}

fn is_face(role: &str) -> bool {
    FACE.contains(&role)
}

impl Planner {
    fn new(pack: &Pack) -> Self {
        let logo = pack
            .mode("mark")
            .map(|m| {
                m.pieces
                    .iter()
                    .map(|p| Rect {
                        x: p.x,
                        y: p.y,
                        w: p.w,
                        h: p.h,
                        opacity: 1.0,
                        role: p.role.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        Planner {
            grid: pack.grid,
            reach2: pack.morph.split_reach.powi(2),
            penalty2: pack.morph.role_penalty.powi(2),
            logo,
        }
    }

    /// The extra cost of pairing two roles: nothing for the same role, the
    /// ban for frame with face, the role penalty otherwise.
    fn role_cost(&self, a: &str, b: &str) -> f64 {
        if a == b {
            0.0
        } else if (a == "frame" && is_face(b)) || (b == "frame" && is_face(a)) {
            BAN
        } else {
            self.penalty2
        }
    }

    /// A piece on the grid or touching the logo, cut along the grid lines.
    /// Anything else (a prop off the grid) stays whole.
    fn cells(&self, r: &Rect) -> Vec<Rect> {
        let g = self.grid;
        let on = |v: f64| (v / g - (v / g).round()).abs() < 1e-6;
        let aligned = [r.x, r.y, r.x + r.w, r.y + r.h].iter().all(|v| on(*v));
        let touches = self
            .logo
            .iter()
            .any(|l| r.x < l.x + l.w && r.x + r.w > l.x && r.y < l.y + l.h && r.y + r.h > l.y);
        if !aligned && !touches {
            return vec![r.clone()];
        }
        let cuts = |a: f64, b: f64| {
            let mut out = vec![a];
            let mut v = (a / g).floor() * g + g;
            while v < b - 1e-6 {
                out.push(v);
                v += g;
            }
            out.push(b);
            out
        };
        let xs = cuts(r.x, r.x + r.w);
        let ys = cuts(r.y, r.y + r.h);
        let mut out = Vec::with_capacity((xs.len() - 1) * (ys.len() - 1));
        for i in 0..xs.len() - 1 {
            for j in 0..ys.len() - 1 {
                out.push(Rect {
                    x: xs[i],
                    y: ys[j],
                    w: xs[i + 1] - xs[i],
                    h: ys[j + 1] - ys[j],
                    ..r.clone()
                });
            }
        }
        out
    }

    /// A key that is equal for two rects in the same place, of the same size
    /// and role, after moving the rect by (dx, dy).
    fn key<'r>(&self, r: &'r Rect, dx: f64, dy: f64) -> PlaceKey<'r> {
        let q = |v: f64| (v * 2.0).round() as i64;
        (q(r.x + dx), q(r.y + dy), q(r.w), q(r.h), &r.role)
    }

    /// The piece in `list` nearest to `r` that may pair with it, preferring
    /// the same role, with its plain squared distance.
    fn nearest<'r>(&self, r: &Rect, list: &'r [Rect]) -> Option<(&'r Rect, f64)> {
        let mut best = None;
        let mut score = f64::INFINITY;
        for c in list {
            let pen = self.role_cost(&r.role, &c.role);
            if pen >= BAN {
                continue;
            }
            let d = dist2(r, c);
            if d + pen < score {
                score = d + pen;
                best = Some((c, d));
            }
        }
        best
    }

    fn pair(&self, src: &[Rect], dst: &[Rect]) -> Vec<Pair> {
        let mut pairs = Vec::new();
        let mut s: Vec<Rect> = src.to_vec();
        let mut d: Vec<Rect> = dst.to_vec();

        // 1. Pieces that share one offset move together. Most often the
        //    offset is zero (already in place, only the opacity changes). The
        //    biggest group goes first, so a body that moved as a whole moves
        //    as one; up to four groups are taken.
        for _ in 0..4 {
            if s.is_empty() || d.is_empty() {
                break;
            }
            let mut have: HashMap<PlaceKey, usize> = HashMap::new();
            for r in &d {
                *have.entry(self.key(r, 0.0, 0.0)).or_insert(0) += 1;
            }
            // How many old pieces land on a new one when moved by (dx, dy).
            let fits = |dx: f64, dy: f64| {
                let mut left = have.clone();
                let mut n = 0;
                for r in &s {
                    if let Some(c) = left.get_mut(&self.key(r, dx, dy)) {
                        if *c > 0 {
                            *c -= 1;
                            n += 1;
                        }
                    }
                }
                n
            };
            // Offsets proposed by same-size, same-role pairs, in the order
            // they first come up.
            let mut votes: Vec<Vote> = Vec::new();
            let mut index: HashMap<(i64, i64), usize> = HashMap::new();
            for a in &s {
                for b in &d {
                    if a.role != b.role || (a.w - b.w).abs() > 0.5 || (a.h - b.h).abs() > 0.5 {
                        continue;
                    }
                    let (ex, ey) = (b.x - a.x, b.y - a.y);
                    let k = (ex.round() as i64, ey.round() as i64);
                    let i = *index.entry(k).or_insert_with(|| {
                        votes.push(Vote {
                            n: 0,
                            x: 0.0,
                            y: 0.0,
                        });
                        votes.len() - 1
                    });
                    votes[i].n += 1;
                    votes[i].x += ex;
                    votes[i].y += ey;
                }
            }
            let still = index.get(&(0, 0)).copied();
            let still_fit = still.map_or(0, |i| {
                fits(
                    votes[i].x / votes[i].n as f64,
                    votes[i].y / votes[i].n as f64,
                )
            });
            let enough = (0.3 * s.len().min(d.len()) as f64).max(12.0);
            let mut group = still;
            let mut group_fit = still_fit;
            for (i, v) in votes.iter().enumerate() {
                if Some(i) == still || (v.n as f64) < enough {
                    continue;
                }
                let f = fits(v.x / v.n as f64, v.y / v.n as f64);
                if f as f64 >= enough && f as f64 > group_fit as f64 * 1.2 {
                    group = Some(i);
                    group_fit = f;
                }
            }
            let Some(g) = group.filter(|_| group_fit > 0) else {
                break;
            };
            let shared = Some(g) != still;
            let (dx, dy) = (
                votes[g].x / votes[g].n as f64,
                votes[g].y / votes[g].n as f64,
            );
            // New pieces by place, in the order their places first appear.
            let mut left: Vec<(PlaceKey, Vec<Rect>)> = Vec::new();
            let mut at: HashMap<PlaceKey, usize> = HashMap::new();
            for r in &d {
                let k = self.key(r, 0.0, 0.0);
                match at.get(&k) {
                    Some(&i) => left[i].1.push(r.clone()),
                    None => {
                        at.insert(k, left.len());
                        left.push((k, vec![r.clone()]));
                    }
                }
            }
            let mut rest = Vec::new();
            for a in s.drain(..) {
                let k = self.key(&a, dx, dy);
                let taken = at.get(&k).and_then(|&i| left[i].1.pop());
                match taken {
                    Some(b) => pairs.push(Pair {
                        role: b.role.clone(),
                        from: a,
                        to: b,
                        pop: false,
                        rigid: shared,
                    }),
                    None => rest.push(a),
                }
            }
            s = rest;
            d = left.into_iter().flat_map(|(_, l)| l).collect();
            if !shared {
                break;
            }
        }

        // 2. The rest travel to their cheapest partner, by distance, size and
        //    role, as a minimum-cost assignment. Frame and face never pair.
        let cost = |a: &Rect, b: &Rect| {
            dist2(a, b)
                + 0.5 * ((a.w - b.w).powi(2) + (a.h - b.h).powi(2))
                + self.role_cost(&a.role, &b.role)
        };
        let rows_are_src = s.len() <= d.len();
        let (rows, cols) = if rows_are_src { (&s, &d) } else { (&d, &s) };
        let mut used_s = vec![false; s.len()];
        let mut used_d = vec![false; d.len()];
        if !rows.is_empty() && !cols.is_empty() {
            let matrix: Vec<Vec<f64>> = rows
                .iter()
                .map(|r| cols.iter().map(|c| cost(r, c)).collect())
                .collect();
            for (i, j) in assign(&matrix).into_iter().enumerate() {
                let Some(j) = j else { continue };
                if self.role_cost(&rows[i].role, &cols[j].role) >= BAN {
                    continue;
                }
                let (si, di) = if rows_are_src { (i, j) } else { (j, i) };
                used_s[si] = true;
                used_d[di] = true;
                pairs.push(Pair {
                    from: s[si].clone(),
                    to: d[di].clone(),
                    role: d[di].role.clone(),
                    pop: false,
                    rigid: false,
                });
            }
        }

        // 3. New pieces with no partner split off their nearest piece within
        //    reach, or grow from their own center. Old ones with no partner
        //    slide into their nearest new piece and fade, or shrink away.
        for (i, b) in d.iter().enumerate() {
            if used_d[i] {
                continue;
            }
            match self.nearest(b, &s) {
                Some((c, k)) if k < self.reach2 => pairs.push(Pair {
                    from: Rect {
                        role: b.role.clone(),
                        ..c.clone()
                    },
                    to: b.clone(),
                    role: b.role.clone(),
                    pop: false,
                    rigid: false,
                }),
                _ => {
                    let (cx, cy) = center(b);
                    pairs.push(Pair {
                        from: Rect {
                            x: cx,
                            y: cy,
                            w: 0.0,
                            h: 0.0,
                            opacity: 0.0,
                            role: b.role.clone(),
                        },
                        to: b.clone(),
                        role: b.role.clone(),
                        pop: true,
                        rigid: false,
                    });
                }
            }
        }
        for (i, a) in s.iter().enumerate() {
            if used_s[i] {
                continue;
            }
            let (to, role) = match self.nearest(a, &d) {
                Some((c, k)) if k < self.reach2 => (
                    Rect {
                        opacity: 0.0,
                        ..c.clone()
                    },
                    c.role.clone(),
                ),
                _ => {
                    let (cx, cy) = center(a);
                    (
                        Rect {
                            x: cx,
                            y: cy,
                            w: 0.0,
                            h: 0.0,
                            opacity: 0.0,
                            role: a.role.clone(),
                        },
                        a.role.clone(),
                    )
                }
            };
            pairs.push(Pair {
                from: a.clone(),
                to,
                role,
                pop: false,
                rigid: false,
            });
        }
        pairs
    }
}

/// An offset proposed by same-size, same-role pairs: how many, and the sum of
/// their exact offsets (the average is the offset used).
struct Vote {
    n: usize,
    x: f64,
    y: f64,
}

/// Minimum-cost assignment of rows to columns (the Hungarian method, for a
/// matrix with no more rows than columns). `result[i]` is row i's column.
fn assign(cost: &[Vec<f64>]) -> Vec<Option<usize>> {
    let n = cost.len();
    let m = cost.first().map_or(0, |r| r.len());
    debug_assert!(n <= m);
    // Potentials of rows and columns, the row matched to each column (0 for
    // none; rows and columns are 1-based here, 0 is the spare), and the
    // column each column's augmenting path came through.
    let mut u = vec![0.0; n + 1];
    let mut v = vec![0.0; m + 1];
    let mut matched = vec![0usize; m + 1];
    let mut way = vec![0usize; m + 1];
    for i in 1..=n {
        matched[0] = i;
        let mut j0 = 0;
        let mut minv = vec![f64::INFINITY; m + 1];
        let mut used = vec![false; m + 1];
        loop {
            used[j0] = true;
            let i0 = matched[j0];
            let row = &cost[i0 - 1];
            let mut delta = f64::INFINITY;
            let mut j1 = 0;
            for j in 1..=m {
                if used[j] {
                    continue;
                }
                let cur = row[j - 1] - u[i0] - v[j];
                if cur < minv[j] {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if minv[j] < delta {
                    delta = minv[j];
                    j1 = j;
                }
            }
            for j in 0..=m {
                if used[j] {
                    u[matched[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
            if matched[j0] == 0 {
                break;
            }
        }
        // Walk the path back, shifting the matches along it.
        loop {
            let j1 = way[j0];
            matched[j0] = matched[j1];
            j0 = j1;
            if j0 == 0 {
                break;
            }
        }
    }
    let mut out = vec![None; n];
    for j in 1..=m {
        if matched[j] != 0 {
            out[matched[j] - 1] = Some(j - 1);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assignment_picks_the_cheapest() {
        let cost = vec![
            vec![4.0, 1.0, 3.0],
            vec![2.0, 0.0, 5.0],
            vec![3.0, 2.0, 2.0],
        ];
        assert_eq!(assign(&cost), vec![Some(1), Some(0), Some(2)]);
    }

    #[test]
    fn assignment_with_more_columns() {
        let cost = vec![vec![10.0, 1.0, 10.0, 10.0], vec![1.0, 10.0, 10.0, 10.0]];
        assert_eq!(assign(&cost), vec![Some(1), Some(0)]);
    }
}
