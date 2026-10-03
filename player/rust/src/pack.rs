//! The Omi pack (omi.json) as Rust types, read with serde. Field names and
//! defaults follow pack/README.md: a piece's `opacity` defaults to 1, `delay`
//! to 0, `clip` to false; a mode's `kind` to "state".

use serde::{Deserialize, Deserializer};
use std::collections::BTreeMap;
use std::fmt;

/// Why a pack could not be used.
#[derive(Debug)]
pub enum Error {
    /// The JSON could not be read into the pack types.
    Json(serde_json::Error),
    /// The file is not an Omi pack of format version 1.
    Format(String),
    /// A mode id the pack doesn't have.
    UnknownMode(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Json(e) => write!(f, "omi pack: {e}"),
            Error::Format(s) => write!(f, "omi pack: {s}"),
            Error::UnknownMode(id) => write!(f, "omi: no mode {id:?}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Json(e)
    }
}

/// Everything in omi.json.
#[derive(Debug, Clone, Deserialize)]
pub struct Pack {
    pub format: String,
    pub version: u32,
    /// The size of one logo cell, in grid units.
    pub grid: f64,
    /// A square [x, y, w, h] around the logo with room for the props.
    pub view: [f64; 4],
    #[serde(default)]
    pub roles: Vec<String>,
    pub morph: MorphSettings,
    /// Optional: a player without it ignores `look()`.
    #[serde(default)]
    pub gaze: Option<GazeSettings>,
    pub animations: BTreeMap<String, Animation>,
    pub modes: Vec<Mode>,
}

impl Pack {
    /// Reads a pack from its JSON text and checks that it is an Omi pack of
    /// format version 1.
    pub fn parse(json: &str) -> Result<Pack, Error> {
        let pack: Pack = serde_json::from_str(json)?;
        if pack.format != "omi-pack" || pack.version != 1 {
            return Err(Error::Format(format!(
                "expected an Omi pack, format version 1, got {:?} version {}",
                pack.format, pack.version
            )));
        }
        Ok(pack)
    }

    /// The mode with this id.
    pub fn mode(&self, id: &str) -> Option<&Mode> {
        self.modes.iter().find(|m| m.id == id)
    }
}

/// How a morph runs, from `pack.morph`.
#[derive(Debug, Clone, Deserialize)]
pub struct MorphSettings {
    /// Seconds each pair takes to move.
    pub duration: f64,
    /// The latest a pair may start, in seconds.
    pub stagger: f64,
    pub ease: Ease,
    /// The point the change ripples out from.
    pub center: [f64; 2],
    /// How far a new piece looks for a piece to split off, in grid units.
    #[serde(rename = "splitReach")]
    pub split_reach: f64,
    /// Extra distance a pair of different roles counts as.
    #[serde(rename = "rolePenalty")]
    pub role_penalty: f64,
}

/// Where the eyes may look, from `pack.gaze`.
#[derive(Debug, Clone, Deserialize)]
pub struct GazeSettings {
    /// How far a full look moves the eyes, on each axis, in grid units.
    pub reach: [f64; 2],
    /// Seconds a new look takes.
    pub duration: f64,
    pub ease: Ease,
    /// The roles that move with the gaze.
    pub roles: Vec<String>,
    /// A box [x, y, w, h] the gazing rects stay in.
    #[serde(default)]
    pub inside: Option<[f64; 4]>,
}

/// An easing: a CSS-style cubic-bezier, or "steps" (hold until the next key).
#[derive(Debug, Clone, PartialEq)]
pub enum Ease {
    Bezier([f64; 4]),
    Steps,
}

impl<'de> Deserialize<'de> for Ease {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            Name(String),
            Curve([f64; 4]),
        }
        match Raw::deserialize(d)? {
            Raw::Curve(c) => Ok(Ease::Bezier(c)),
            Raw::Name(n) if n == "steps" => Ok(Ease::Steps),
            Raw::Name(n) => Err(serde::de::Error::custom(format!("unknown ease {n:?}"))),
        }
    }
}

/// A looping animation: `keys` are [progress 0..1, values].
#[derive(Debug, Clone, Deserialize)]
pub struct Animation {
    /// Seconds for one loop.
    pub duration: f64,
    pub ease: Ease,
    /// True for an animation that moves the whole of Omi.
    #[serde(default)]
    pub body: bool,
    /// Names of the piece numbers its values read (`mx`, `my`, ...).
    #[serde(default)]
    pub vars: Vec<String>,
    pub keys: Vec<Key>,
}

/// One keyframe: its progress and the values it sets.
pub type Key = (f64, BTreeMap<String, Value>);

/// A keyframe value: a number, or [name, factor], the piece's own number
/// `name` times `factor`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Number(f64),
    Var(String, f64),
}

/// One of Omi's looks.
#[derive(Debug, Clone, Deserialize)]
pub struct Mode {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    /// "state" or "reaction"; missing means "state".
    #[serde(default)]
    pub kind: Option<String>,
    /// On a reaction: seconds to show it after its morph lands.
    #[serde(default)]
    pub hold: Option<f64>,
    #[serde(default)]
    pub family: Option<String>,
    #[serde(default)]
    pub easter: bool,
    #[serde(default)]
    pub group: Option<String>,
    /// The tightest box around the mode, [x, y, w, h].
    pub bounds: [f64; 4],
    /// An animation that moves the whole of Omi, about the center of `bounds`.
    #[serde(default)]
    pub anim: Option<String>,
    /// A window that pieces with `clip: true` are drawn through.
    #[serde(default)]
    pub clip: Option<Clip>,
    pub pieces: Vec<Piece>,
}

/// A clip window: pieces marked `clip` are only visible inside it, and move
/// together with its `anim`.
#[derive(Debug, Clone, Deserialize)]
pub struct Clip {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    #[serde(default)]
    pub anim: Option<String>,
}

/// A filled rectangle, at rest.
#[derive(Debug, Clone, Deserialize)]
pub struct Piece {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub role: String,
    /// 0..1, default 1.
    #[serde(default)]
    pub opacity: Option<f64>,
    /// The animation this piece plays.
    #[serde(default)]
    pub anim: Option<String>,
    /// Seconds this piece lags behind its animation.
    #[serde(default)]
    pub delay: f64,
    /// Overrides the animation's duration.
    #[serde(default)]
    pub duration: Option<f64>,
    /// Only visible inside the mode's clip window.
    #[serde(default)]
    pub clip: bool,
    /// Extra numbers some animations read (`mx`, `my`, `dx`, `dy`).
    #[serde(flatten)]
    pub vars: BTreeMap<String, serde_json::Value>,
}

impl Piece {
    /// The piece's own number `name`, or 0 if it has none.
    pub fn var(&self, name: &str) -> f64 {
        self.vars.get(name).and_then(|v| v.as_f64()).unwrap_or(0.0)
    }

    /// The piece's opacity, 1 unless set.
    pub fn opacity(&self) -> f64 {
        self.opacity.unwrap_or(1.0)
    }
}
