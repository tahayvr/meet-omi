"""A player for the Omi pack.

Omi is the Omarchy mascot, drawn as filled rectangles. This package reads
omi.json and works out, for any moment, which rects to fill: every mode
with its loops, the morph from one mode to another, and the gaze. It draws
nothing itself.

    from omi import Pack, Player

    omi = Player(Pack.load("omi.json"))
    omi.set("thinking")
    omi.frame(now_ms)
    for r in omi.rects():
        fill(r.x, r.y, r.w, r.h, r.opacity)
"""

from .pack import (
    Animation,
    Clip,
    GazeSettings,
    Mode,
    MorphSettings,
    Pack,
    PackError,
    Piece,
    Rect,
    UnknownMode,
)
from .player import Player

__version__ = "0.1.0"

__all__ = [
    "Animation",
    "Clip",
    "GazeSettings",
    "Mode",
    "MorphSettings",
    "Pack",
    "PackError",
    "Piece",
    "Player",
    "Rect",
    "UnknownMode",
    "__version__",
]
