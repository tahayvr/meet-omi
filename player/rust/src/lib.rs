//! A player for Omi, the Omarchy mascot, written from the Omi pack's README
//! (pack/README.md) and checked against pack/conformance.json. It draws
//! nothing itself: a host calls [`Player::frame`] on every display frame and
//! fills the rects from [`Player::rects`] in its accent colour.
//!
//! ```no_run
//! use omi::{Pack, Player};
//!
//! let pack = Pack::parse(&std::fs::read_to_string("omi.json")?)?;
//! let mut omi = Player::new(&pack);
//! omi.set("thinking")?;          // morphs there from wherever Omi is
//! omi.frame(16.0);               // milliseconds, on every display frame
//! for r in omi.rects() {
//!     // fill r.x, r.y, r.w, r.h (grid units) with r.opacity
//! }
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```

mod anim;
mod morph;
mod pack;

pub use pack::{
    Animation, Clip, Ease, Error, GazeSettings, Key, Mode, MorphSettings, Pack, Piece, Value,
};

use anim::{Motion, REST};
use morph::Step;

/// A filled rectangle in grid units, in drawing order.
#[derive(Debug, Clone, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// 0..1.
    pub opacity: f64,
    /// frame, eye, brow, mouth, tear or extra.
    pub role: String,
}

/// What a mode is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// Something going on; stays as long as it does.
    State,
    /// Something that just happened; show it, then go back.
    Reaction,
}

/// How the player starts.
#[derive(Debug, Clone)]
pub struct Options {
    /// Animation and morph speed, 1 = normal.
    pub speed: f64,
    /// False shows each mode at rest, with no loops.
    pub animate: bool,
    /// False leaves out whole-body moves (bob, hop, shake).
    pub body_motion: bool,
    /// The mode to start in; "mark", the plain logo, when missing or unknown.
    pub mode: Option<String>,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            speed: 1.0,
            animate: true,
            body_motion: true,
            mode: None,
        }
    }
}

/// Rects drawn fainter than this are left out.
const VISIBLE: f64 = 0.001;
/// The longest step one frame may take, in seconds: a host's clock that
/// pauses or restarts must not make Omi jump.
const MAX_FRAME: f64 = 0.1;

/// A morph in progress: its steps and how far in it is.
struct Morph {
    steps: Vec<Step>,
    t: f64,
}

/// Where the eyes look: from one direction to another, `p` of the way.
struct Gaze {
    from: [f64; 2],
    to: [f64; 2],
    p: f64,
}

/// Plays one Omi: its mode, its loops, morphs between modes, and the gaze.
pub struct Player {
    pack: Pack,
    speed: f64,
    animate: bool,
    body_motion: bool,
    /// Index into `pack.modes`.
    mode: usize,
    /// Seconds into the current mode's loops.
    t: f64,
    morph: Option<Morph>,
    gaze: Gaze,
    /// The last frame's clock, in milliseconds.
    last: Option<f64>,
}

impl Player {
    /// A player on this pack with default options, starting at "mark".
    pub fn new(pack: &Pack) -> Player {
        Player::with_options(pack, Options::default())
    }

    pub fn with_options(pack: &Pack, opts: Options) -> Player {
        let pack = pack.clone();
        let start = opts.mode.as_deref().unwrap_or("mark");
        let mode = pack
            .modes
            .iter()
            .position(|m| m.id == start)
            .or_else(|| pack.modes.iter().position(|m| m.id == "mark"))
            .unwrap_or(0);
        Player {
            pack,
            speed: opts.speed,
            animate: opts.animate,
            body_motion: opts.body_motion,
            mode,
            t: 0.0,
            morph: None,
            gaze: Gaze {
                from: [0.0, 0.0],
                to: [0.0, 0.0],
                p: 1.0,
            },
            last: None,
        }
    }

    /// The pack this player plays.
    pub fn pack(&self) -> &Pack {
        &self.pack
    }

    /// The id of the mode Omi is in, or morphing to.
    pub fn mode(&self) -> &str {
        &self.pack.modes[self.mode].id
    }

    pub fn speed(&self) -> f64 {
        self.speed
    }

    pub fn set_speed(&mut self, speed: f64) {
        self.speed = speed;
    }

    pub fn animate(&self) -> bool {
        self.animate
    }

    /// Turning the loops on or off shows the mode at rest again: a mode at
    /// rest is time 0.
    pub fn set_animate(&mut self, on: bool) {
        self.animate = on;
        self.t = 0.0;
    }

    pub fn body_motion(&self) -> bool {
        self.body_motion
    }

    pub fn set_body_motion(&mut self, on: bool) {
        self.body_motion = on;
    }

    /// True when no morph is running.
    pub fn settled(&self) -> bool {
        self.morph.is_none()
    }

    pub fn is_morphing(&self) -> bool {
        self.morph.is_some()
    }

    fn index(&self, id: &str) -> Result<usize, Error> {
        self.pack
            .modes
            .iter()
            .position(|m| m.id == id)
            .ok_or_else(|| Error::UnknownMode(id.to_string()))
    }

    /// Morphs to a mode from exactly what is on screen now, mid-loop or
    /// mid-morph. Setting the mode Omi is already in does nothing.
    pub fn set(&mut self, id: &str) -> Result<(), Error> {
        self.change(id, false)
    }

    /// Jumps to a mode, with no morph.
    pub fn set_instant(&mut self, id: &str) -> Result<(), Error> {
        self.change(id, true)
    }

    fn change(&mut self, id: &str, instant: bool) -> Result<(), Error> {
        let next = self.index(id)?;
        if next == self.mode && self.morph.is_none() {
            return Ok(());
        }
        // The pieces as they are on screen now, before the gaze is laid on
        // top, and the new mode's pieces at rest.
        let from = self.screen_rects();
        let to = self.rest_rects(&self.pack.modes[next]);
        self.mode = next;
        self.t = 0.0;
        if instant || from.is_empty() {
            self.morph = None;
            return Ok(());
        }
        let steps = morph::plan(&self.pack, &from, &to);
        self.morph = Some(Morph { steps, t: 0.0 });
        Ok(())
    }

    /// Advances the player to a wall-clock time in milliseconds. Time never
    /// runs backwards and never jumps more than a tenth of a second per frame.
    pub fn frame(&mut self, ms: f64) {
        let dt = match self.last {
            Some(last) => ((ms - last) / 1000.0).clamp(0.0, MAX_FRAME),
            None => 0.0,
        };
        self.last = Some(ms);
        let dt = dt * self.speed.max(0.05);
        if self.morph.is_some() {
            self.step_morph(dt);
        } else if self.animate {
            self.t += dt;
        }
        // The gaze eases on its own clock, whatever the mode is doing.
        if let Some(g) = &self.pack.gaze {
            if self.gaze.p < 1.0 {
                self.gaze.p = (self.gaze.p + dt / g.duration).min(1.0);
            }
        }
    }

    /// Moves every step of the morph on by `dt` seconds; lands when the last
    /// step is done, starting the new mode's loops at t = 0.
    fn step_morph(&mut self, dt: f64) {
        let Some(m) = &mut self.morph else { return };
        let settings = &self.pack.morph;
        m.t += dt;
        for s in &mut m.steps {
            let p = ((m.t - s.delay) / settings.duration).clamp(0.0, 1.0);
            if s.pop {
                // Grow from the center with a little overshoot; fade in over
                // the first third.
                let k = ease_back(p);
                let (cx, cy) = (s.to.x + s.to.w / 2.0, s.to.y + s.to.h / 2.0);
                s.now.x = cx - s.to.w * k / 2.0;
                s.now.y = cy - s.to.h * k / 2.0;
                s.now.w = s.to.w * k;
                s.now.h = s.to.h * k;
                s.now.opacity = s.to.opacity * (p * 3.0).min(1.0);
            } else {
                let e = anim::ease(&settings.ease, p);
                s.now.x = lerp(s.from.x, s.to.x, e);
                s.now.y = lerp(s.from.y, s.to.y, e);
                s.now.w = lerp(s.from.w, s.to.w, e);
                s.now.h = lerp(s.from.h, s.to.h, e);
                s.now.opacity = lerp(s.from.opacity, s.to.opacity, e);
            }
        }
        if m.t >= settings.duration + settings.stagger {
            self.morph = None;
            self.t = 0.0;
        }
    }

    /// What is on screen right now, in drawing order, gaze included. Only
    /// rects with an opacity above 0.001 are returned.
    pub fn rects(&self) -> Vec<Rect> {
        self.with_gaze(self.screen_rects())
    }

    /// The mode or morph as drawn, before the gaze.
    fn screen_rects(&self) -> Vec<Rect> {
        match &self.morph {
            Some(m) => m
                .steps
                .iter()
                .filter(|s| s.now.opacity > VISIBLE)
                .map(|s| Rect {
                    role: s.role.clone(),
                    ..s.now.clone()
                })
                .collect(),
            None => {
                let t = if self.animate { self.t } else { 0.0 };
                self.rest_or_at(&self.pack.modes[self.mode], t)
            }
        }
    }

    fn rest_rects(&self, mode: &Mode) -> Vec<Rect> {
        self.rest_or_at(mode, 0.0)
    }

    fn rest_or_at(&self, mode: &Mode, t: f64) -> Vec<Rect> {
        let mut out = self.rects_of(mode, t);
        out.retain(|r| r.opacity > VISIBLE);
        out
    }

    /// A mode's rects `t` seconds into its loops (0 is at rest), in drawing
    /// order, with body motion as the player is set. Rects with an opacity
    /// of 0.001 or less are left out.
    pub fn mode_rects(&self, id: &str, t: f64) -> Result<Vec<Rect>, Error> {
        let mode = &self.pack.modes[self.index(id)?];
        Ok(self.rest_or_at(mode, t))
    }

    fn motion_of(
        &self,
        anim: Option<&String>,
        t: f64,
        delay: f64,
        duration: Option<f64>,
        piece: Option<&Piece>,
    ) -> Motion {
        let Some(a) = anim.and_then(|n| self.pack.animations.get(n)) else {
            return REST;
        };
        let var = |name: &str| piece.map_or(0.0, |p| p.var(name));
        anim::motion(a, t, delay, duration, &var)
    }

    fn rects_of(&self, mode: &Mode, t: f64) -> Vec<Rect> {
        let body = if self.body_motion {
            mode.anim
                .as_ref()
                .map(|_| self.motion_of(mode.anim.as_ref(), t, 0.0, None, None))
        } else {
            None
        };
        let window = mode.clip.as_ref();
        let layer = window
            .and_then(|w| w.anim.as_ref())
            .map(|_| self.motion_of(window.and_then(|w| w.anim.as_ref()), t, 0.0, None, None));
        let [bx, by, bw, bh] = mode.bounds;
        let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
        // Pieces seen through the window are drawn first, then the rest.
        let order: Vec<&Piece> = if window.is_some() {
            mode.pieces
                .iter()
                .filter(|p| p.clip)
                .chain(mode.pieces.iter().filter(|p| !p.clip))
                .collect()
        } else {
            mode.pieces.iter().collect()
        };
        let mut out = Vec::with_capacity(order.len());
        for p in order {
            let m = self.motion_of(p.anim.as_ref(), t, p.delay, p.duration, Some(p));
            // Scale about the piece's own center, then move.
            let (w, h) = (p.w * m.sx, p.h * m.sy);
            let mut r = Rect {
                x: p.x + p.w / 2.0 - w / 2.0 + m.tx,
                y: p.y + p.h / 2.0 - h / 2.0 + m.ty,
                w,
                h,
                opacity: p.opacity() * m.op,
                role: p.role.clone(),
            };
            if let (true, Some(win)) = (p.clip, window) {
                if let Some(l) = &layer {
                    r.x += l.tx;
                    r.y += l.ty;
                }
                match clip_to(&r, win) {
                    Some(c) => r = c,
                    None => continue,
                }
            }
            if let Some(b) = &body {
                // The whole of Omi scales about the center of its bounds.
                r.x = cx + (r.x - cx) * b.sx + b.tx;
                r.y = cy + (r.y - cy) * b.sy + b.ty;
                r.w *= b.sx;
                r.h *= b.sy;
            }
            out.push(r);
        }
        out
    }

    /// Turns the eyes toward a direction, each axis -1..1 (x right, y down),
    /// eased from wherever they are. (0, 0) looks straight ahead. Does
    /// nothing without `gaze` in the pack.
    pub fn look(&mut self, dx: f64, dy: f64) {
        if self.pack.gaze.is_none() {
            return;
        }
        let clamp = |v: f64| if v.is_nan() { 0.0 } else { v.clamp(-1.0, 1.0) };
        let to = [clamp(dx), clamp(dy)];
        if to == self.gaze.to {
            return;
        }
        self.gaze = Gaze {
            from: self.gaze(),
            to,
            p: 0.0,
        };
    }

    /// Where the eyes look now, each axis -1..1.
    pub fn gaze(&self) -> [f64; 2] {
        let g = &self.gaze;
        if g.p >= 1.0 {
            return g.to;
        }
        let e = match &self.pack.gaze {
            Some(spec) => anim::ease(&spec.ease, g.p),
            None => 1.0,
        };
        [lerp(g.from[0], g.to[0], e), lerp(g.from[1], g.to[1], e)]
    }

    /// True while the eyes are still on their way.
    pub fn gazing(&self) -> bool {
        self.gaze.p < 1.0
    }

    /// Moves the gazing roles' rects by the current gaze, kept inside the
    /// pack's `inside` box: on each axis the move is limited over the gazing
    /// rects that fit in the box, to the smallest room on the far side and
    /// the largest on the near side. Limits that cross mean no room.
    fn with_gaze(&self, list: Vec<Rect>) -> Vec<Rect> {
        let Some(spec) = &self.pack.gaze else {
            return list;
        };
        let [gx, gy] = self.gaze();
        if gx == 0.0 && gy == 0.0 {
            return list;
        }
        let gazes = |r: &Rect| spec.roles.contains(&r.role);
        let eyes: Vec<&Rect> = list.iter().filter(|r| gazes(r)).collect();
        if eyes.is_empty() {
            return list;
        }
        let room = |d: f64, lo: f64, hi: f64, at: &dyn Fn(&Rect) -> (f64, f64)| {
            let Some(_) = spec.inside else { return d };
            let (mut min, mut max) = (f64::NEG_INFINITY, f64::INFINITY);
            for r in &eyes {
                let (start, size) = at(r);
                if start < lo || start + size > hi {
                    continue;
                }
                min = min.max(lo - start);
                max = max.min(hi - (start + size));
            }
            if min > max {
                0.0
            } else {
                d.clamp(min, max)
            }
        };
        let [bx, by, bw, bh] = spec.inside.unwrap_or([0.0; 4]);
        let dx = room(gx * spec.reach[0], bx, bx + bw, &|r| (r.x, r.w));
        let dy = room(gy * spec.reach[1], by, by + bh, &|r| (r.y, r.h));
        if dx == 0.0 && dy == 0.0 {
            return list;
        }
        list.into_iter()
            .map(|mut r| {
                if gazes(&r) {
                    r.x += dx;
                    r.y += dy;
                }
                r
            })
            .collect()
    }

    /// How long a mode takes to play every piece's loop once: the longest
    /// animation duration (a piece's own when it sets one) plus the piece's
    /// delay, the body and clip animations included. 0 for a still mode or
    /// an unknown one.
    pub fn loop_seconds(&self, id: &str) -> f64 {
        let Some(mode) = self.pack.mode(id) else {
            return 0.0;
        };
        let mut t: f64 = 0.0;
        let mut use_anim = |name: Option<&String>, delay: f64, duration: Option<f64>| {
            if let Some(a) = name.and_then(|n| self.pack.animations.get(n)) {
                t = t.max(duration.unwrap_or(a.duration) + delay);
            }
        };
        use_anim(mode.anim.as_ref(), 0.0, None);
        if let Some(c) = &mode.clip {
            use_anim(c.anim.as_ref(), 0.0, None);
        }
        for p in &mode.pieces {
            use_anim(p.anim.as_ref(), p.delay, p.duration);
        }
        t
    }

    /// How long to show a mode as a reaction after its morph lands, in
    /// seconds: its `hold`, or its loop time kept between 1.2 and 2.5 s.
    pub fn hold(&self, id: &str) -> f64 {
        match self.pack.mode(id).and_then(|m| m.hold) {
            Some(h) => h,
            None => self.loop_seconds(id).clamp(1.2, 2.5),
        }
    }

    /// What a screen reader says for a mode ("Omi is thinking"): its label,
    /// or its name in a pack without labels. Give it to your toolkit as the
    /// picture's accessible name. Empty for a mode the pack doesn't have.
    pub fn label(&self, id: &str) -> &str {
        match self.pack.mode(id) {
            Some(m) => m.label.as_deref().or(m.name.as_deref()).unwrap_or(&m.id),
            None => "",
        }
    }

    /// A mode's kind; "state" unless the pack says "reaction".
    pub fn kind(&self, id: &str) -> Kind {
        match self.pack.mode(id).and_then(|m| m.kind.as_deref()) {
            Some("reaction") => Kind::Reaction,
            _ => Kind::State,
        }
    }

    /// How long a morph takes from start to landing, in seconds.
    pub fn morph_seconds(&self) -> f64 {
        self.pack.morph.duration + self.pack.morph.stagger
    }
}

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

/// Ease-out with a little overshoot (CSS easeOutBack), for pieces growing
/// from nothing.
fn ease_back(p: f64) -> f64 {
    let q = p - 1.0;
    1.0 + 2.70158 * q * q * q + 1.70158 * q * q
}

/// The part of `r` inside the window, or None if nothing is.
fn clip_to(r: &Rect, win: &Clip) -> Option<Rect> {
    let x = r.x.max(win.x);
    let y = r.y.max(win.y);
    let x2 = (r.x + r.w).min(win.x + win.w);
    let y2 = (r.y + r.h).min(win.y + win.h);
    if x2 - x > 0.01 && y2 - y > 0.01 {
        Some(Rect {
            x,
            y,
            w: x2 - x,
            h: y2 - y,
            ..r.clone()
        })
    } else {
        None
    }
}
