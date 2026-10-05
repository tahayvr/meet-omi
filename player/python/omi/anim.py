"""A mode at time t: easing, a piece's look, the window, the body motion.

`Scene` is a mode made ready to draw: everything that can be worked out
once is worked out when it is built, so asking for a frame only blends.
"""

from .pack import Rect

__all__ = ["Scene", "Track", "cubic_bezier", "make_ease", "VISIBLE"]

# Only rects with opacity above this are on screen.
VISIBLE = 0.001


def cubic_bezier(x1, y1, x2, y2):
    """The CSS cubic-bezier(x1, y1, x2, y2) timing function.

    Returns a function from input progress to output progress. The curve
    is solved the way the pack README spells out, 24 halvings and no
    shortcuts: any other way lands within the tolerance, but a morph's
    pairing is only the same in every player when their numbers agree far
    closer than that.
    """

    def ease(p):
        if p <= 0.0 or p >= 1.0:
            return p
        low = 0.0
        high = 1.0
        t = p
        for _ in range(24):
            t = (low + high) / 2.0
            u = 1.0 - t
            if 3.0 * x1 * t * (u * u) + 3.0 * x2 * t * t * u + t * t * t < p:
                low = t
            else:
                high = t
        u = 1.0 - t
        return 3.0 * y1 * t * (u * u) + 3.0 * y2 * t * t * u + t * t * t

    return ease


def make_ease(spec):
    """An ease from the pack: a cubic-bezier, or None for "steps"."""
    if spec is None:
        return None
    return cubic_bezier(spec[0], spec[1], spec[2], spec[3])


_MOVE = ("tx", "ty", "sx", "sy")
_MOVE_REST = (0.0, 0.0, 1.0, 1.0)


def _resolve(value, numbers):
    # A value can be [name, factor]: the piece's own number `name` times
    # `factor`. A piece without that number has 0.
    if isinstance(value, tuple):
        return numbers.get(value[0], 0.0) * value[1]
    return value


def _channel(keys, rest):
    # If the channel has no key at 0 or at 1, add one there with rest
    # values. A channel no key sets is left out.
    if not keys:
        return None
    if keys[0][0] > 0.0:
        keys.insert(0, (0.0, rest))
    if keys[-1][0] < 1.0:
        keys.append((1.0, rest))
    if all(key[1] == keys[0][1] for key in keys):
        # It never changes: remember the value alone.
        return keys[0][1]
    return tuple(keys)


class Track:
    """An animation as one piece plays it.

    The animation's keys are split into the two channels, move (tx, ty,
    sx, sy) and opacity (op), with the piece's own numbers filled in.
    """

    __slots__ = ("duration", "delay", "ease", "move", "op", "_at", "_look")

    def __init__(self, animation, numbers=None, delay=0.0, duration=None):
        numbers = numbers or {}
        self.duration = animation.duration if duration is None else duration
        self.delay = delay
        self.ease = make_ease(animation.ease)
        move = []
        op = []
        for progress, values in animation.keys:
            # A channel's keys are the keys that set any of its values.
            # Inside a move key, values it doesn't set are at rest.
            if any(name in values for name in _MOVE):
                move.append((
                    progress,
                    tuple(
                        _resolve(values[name], numbers) if name in values else rest
                        for name, rest in zip(_MOVE, _MOVE_REST)
                    ),
                ))
            if "op" in values:
                op.append((progress, _resolve(values["op"], numbers)))
        self.move = _channel(move, _MOVE_REST)
        self.op = _channel(op, 1.0)
        self._at = None
        self._look = None

    @property
    def still(self):
        """True if the piece never moves or fades."""
        return (
            (self.move is None or self.move == _MOVE_REST)
            and (self.op is None or self.op == 1.0)
        )

    def _blend(self, keys, p):
        # Find the two keys around p, k0 at p0 and k1 at p1, and how far
        # between them p is, eased. "steps" holds k0 until the next key.
        index = len(keys) - 2
        for i in range(1, len(keys)):
            if p < keys[i][0]:
                index = i - 1
                break
        p0, v0 = keys[index]
        p1, v1 = keys[index + 1]
        if v0 == v1 or self.ease is None or p1 <= p0:
            return v0, v1, 0.0
        return v0, v1, self.ease((p - p0) / (p1 - p0))

    def look(self, t):
        """The piece's (tx, ty, sx, sy, op) at time t, in seconds."""
        if t == self._at:
            return self._look
        # progress p = ((t - delay) / duration) mod 1, kept in 0..1.
        p = ((t - self.delay) / self.duration) % 1.0
        move = self.move
        if move is None:
            tx, ty, sx, sy = _MOVE_REST
        elif type(move[0]) is float:
            tx, ty, sx, sy = move
        else:
            v0, v1, e = self._blend(move, p)
            if e == 0.0:
                tx, ty, sx, sy = v0
            else:
                tx = v0[0] + (v1[0] - v0[0]) * e
                ty = v0[1] + (v1[1] - v0[1]) * e
                sx = v0[2] + (v1[2] - v0[2]) * e
                sy = v0[3] + (v1[3] - v0[3]) * e
        op = self.op
        if op is None:
            op = 1.0
        elif type(op) is not float:
            v0, v1, e = self._blend(op, p)
            op = v0 + (v1 - v0) * e
        self._at = t
        self._look = (tx, ty, sx, sy, op)
        return self._look


class Scene:
    """A mode, ready to give its rects at any time."""

    def __init__(self, pack, mode):
        self.mode = mode
        animations = pack.animations
        # Tracks are shared between pieces that play the same animation
        # the same way, so a row of pieces in step is worked out once.
        shared = {}

        def track(name, numbers, delay, duration):
            animation = animations[name]
            # The piece's numbers this animation reads by name.
            names = sorted(set(
                value[0]
                for _, values in animation.keys
                for value in values.values()
                if isinstance(value, tuple)
            ))
            key = (name, delay, duration, tuple(numbers.get(n) for n in names))
            if key not in shared:
                shared[key] = Track(animation, numbers, delay, duration)
            return shared[key]

        # Drawing order is the order of `pieces`, except that in a mode
        # with a window the pieces seen through it come first.
        self.windowed = []
        self.plain = []
        loop = 0.0
        for piece in mode.pieces:
            piece_track = None
            if piece.anim is not None:
                piece_track = track(piece.anim, piece.numbers, piece.delay, piece.duration)
                loop = max(loop, piece_track.duration + piece.delay)
                if piece_track.still:
                    piece_track = None
            entry = (
                piece.x, piece.y, piece.w, piece.h, piece.opacity, piece.role,
                piece_track,
            )
            if piece.clip and mode.clip is not None:
                self.windowed.append(entry)
            else:
                self.plain.append(entry)

        self.window = None
        self.window_track = None
        if mode.clip is not None:
            clip = mode.clip
            self.window = (clip.x, clip.y, clip.x + clip.w, clip.y + clip.h)
            if clip.anim is not None:
                self.window_track = track(clip.anim, {}, 0.0, None)
                loop = max(loop, self.window_track.duration)

        self.body = None
        if mode.anim is not None:
            self.body = track(mode.anim, {}, 0.0, None)
            loop = max(loop, self.body.duration)
        bounds = mode.bounds
        self.center = (bounds[0] + bounds[2] / 2.0, bounds[1] + bounds[3] / 2.0)

        # A mode's loop time: the longest of (duration + delay) over its
        # pieces, its body animation and its window's. 0 for a still mode.
        self.loop_seconds = loop

    def rects(self, t, body_motion=True):
        """The rects on screen at time t (seconds), in drawing order."""
        out = []
        if self.windowed:
            # Pieces seen through the window are moved by the window's
            # animation (its tx and ty only), then cut to the window,
            # which stays put.
            wx = wy = 0.0
            if self.window_track is not None:
                look = self.window_track.look(t)
                wx, wy = look[0], look[1]
            left, top, right, bottom = self.window
            for x, y, w, h, opacity, role, track in self.windowed:
                if track is not None:
                    tx, ty, sx, sy, op = track.look(t)
                    opacity *= op
                    if sx != 1.0:
                        x += w * (1.0 - sx) / 2.0
                        w *= sx
                    if sy != 1.0:
                        y += h * (1.0 - sy) / 2.0
                        h *= sy
                    x += tx
                    y += ty
                x += wx
                y += wy
                x1 = min(x + w, right)
                y1 = min(y + h, bottom)
                if x < left:
                    x = left
                if y < top:
                    y = top
                # Drop it when less than 0.01 unit of it is left in
                # either direction.
                if x1 - x < 0.01 or y1 - y < 0.01:
                    continue
                if opacity > VISIBLE:
                    out.append(Rect(x, y, x1 - x, y1 - y, opacity, role))
        for x, y, w, h, opacity, role, track in self.plain:
            if track is not None:
                # Scale the piece about its center by sx, sy, move it by
                # tx, ty, and multiply its opacity by op.
                tx, ty, sx, sy, op = track.look(t)
                opacity *= op
                if sx != 1.0:
                    x += w * (1.0 - sx) / 2.0
                    w *= sx
                if sy != 1.0:
                    y += h * (1.0 - sy) / 2.0
                    h *= sy
                x += tx
                y += ty
            if opacity > VISIBLE:
                out.append(Rect(x, y, w, h, opacity, role))

        if body_motion and self.body is not None:
            # The body motion moves and scales the whole of Omi about the
            # center of the mode's bounds, after everything else.
            tx, ty, sx, sy, _ = self.body.look(t)
            if sx != 1.0 or sy != 1.0:
                cx, cy = self.center
                out = [
                    Rect(cx + (r[0] - cx) * sx + tx, cy + (r[1] - cy) * sy + ty,
                         r[2] * sx, r[3] * sy, r[4], r[5])
                    for r in out
                ]
            elif tx != 0.0 or ty != 0.0:
                out = [Rect(r[0] + tx, r[1] + ty, r[2], r[3], r[4], r[5]) for r in out]
        return out
