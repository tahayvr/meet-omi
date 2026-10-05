"""The player: the clocks, the modes, morphs and the gaze.

It draws nothing. A host calls `frame(ms)` on every display frame and
fills the rects in `rects()` itself.
"""

from .anim import Scene, make_ease
from .morph import plan as plan_morph

__all__ = ["Player"]

# `speed` is never less than this.
_SLOWEST = 0.05


def _unit(value):
    # Each axis of a look is kept in -1..1.
    value = float(value)
    return -1.0 if value < -1.0 else 1.0 if value > 1.0 else value


class Player:
    """Plays an Omi pack.

    `speed` scales time (never less than 0.05), `animate=False` shows
    every mode at rest (morphs and the gaze still play), `body_motion=False`
    leaves out the whole-body bobs, and `mode` is where Omi starts.
    `on_settled`, if given, is called with the mode's id when a morph
    lands, and after a jump. All four can also be set later, as attributes;
    turning `animate` on or off puts the loop clock back to 0.

    Raises `UnknownMode` (a `KeyError`) if the pack has no such `mode`.
    """

    def __init__(self, pack, speed=1.0, animate=True, body_motion=True,
                 mode="mark", on_settled=None):
        self.pack = pack
        self.speed = speed
        self._animate = bool(animate)
        self.body_motion = body_motion
        self.on_settled = on_settled

        self._scenes = {}
        # The logo: a rect that overlaps any piece of "mark" is cut into
        # cells for a morph.
        mark = pack.modes.get("mark")
        self._logo = [(p.x, p.y, p.w, p.h) for p in mark.pieces] if mark else []

        self._scene = self._scene_of(mode)
        self._time = 0.0          # the mode's loops, seconds
        self._plan = None         # the morph that is running, if any
        self._morph_time = 0.0    # the morph, seconds
        self._last = None         # the last frame's clock, milliseconds
        # A change shared between apps: (when it happened in Unix
        # milliseconds, how long after that the loops start).
        self._sync = None

        gaze = pack.gaze
        self._gaze_ease = make_ease(gaze.ease) if gaze else None
        self._gaze_roles = frozenset(gaze.roles) if gaze else frozenset()
        self._look_from = (0.0, 0.0)
        self._look_to = (0.0, 0.0)
        self._look_now = (0.0, 0.0)
        self._look_progress = 1.0  # 0..1 along the way to the new look

        self._base = None         # this frame's rects, before the gaze
        self._drawn = None        # this frame's rects

    # Modes

    def _scene_of(self, mode):
        scene = self._scenes.get(mode)
        if scene is None:
            scene = Scene(self.pack, self.pack.mode(mode))
            self._scenes[mode] = scene
        return scene

    @property
    def mode(self):
        """The id of the mode Omi is in, or morphing to."""
        return self._scene.mode.id

    @property
    def animate(self):
        """Whether modes play their loops. Off, every mode is at rest."""
        return self._animate

    @animate.setter
    def animate(self, on):
        self._animate = bool(on)
        self._time = 0.0  # a mode at rest is time 0
        self._base = None
        self._drawn = None

    @property
    def morphing(self):
        """True while a morph is running."""
        return self._plan is not None

    @property
    def settled(self):
        """True when no morph is running."""
        return self._plan is None

    def set(self, mode, instant=False, since=None):
        """Change mode: morph there from whatever is on screen.

        This works in the middle of a morph too. `instant=True` jumps
        instead, and so does a change made when nothing is on screen.
        Changing to the mode Omi is already in, with no morph running,
        does nothing.

        `since` is for apps following the Omi state protocol: the change
        happened at that Unix time, in milliseconds, and is played as if
        it had started then, so it may be part of the way along, or have
        landed already. From then on the player works out where it is
        from the clock on every frame, so apps showing the same change
        stay in step. For that it takes the clock given to `frame` as the
        time now: give `frame` Unix time in milliseconds too
        (`time.time() * 1000`).

        Raises `UnknownMode` (a `KeyError`) if the pack has no such mode.
        """
        scene = self._scene_of(mode)
        seconds = self.pack.morph.duration + self.pack.morph.stagger
        # A shared change runs on the clock; a change of the player's own
        # runs on its frames.
        self._sync = None if since is None else (float(since), 0.0 if instant else seconds)
        if scene is self._scene and self._plan is None:
            return
        source = self._base_rects()
        self._scene = scene
        self._time = 0.0
        self._morph_time = 0.0
        self._base = None
        self._drawn = None
        if instant or not source:
            # A jump: the new mode at rest, its loops at 0.
            self._plan = None
            if self.on_settled is not None:
                self.on_settled(scene.mode.id)
            return
        # The morph's source is what is drawn now, before the gaze. A
        # change made between two frames starts its morph at 0 and moves
        # from the next frame on.
        self._plan = plan_morph(
            source, scene.rects(0.0, self.body_motion),
            self.pack.morph, self.pack.grid, self._logo,
        )

    # Time

    def frame(self, ms):
        """Advance to the display frame at clock `ms`, in milliseconds.

        Call it on every display frame, then draw `rects()`. Any clock
        that counts milliseconds will do, unless `set` is used with
        `since`: then it must be Unix time.
        """
        # dt = (now - last) / 1000, kept between 0 and 0.1 s, times speed.
        # The first frame advances nothing.
        speed = max(_SLOWEST, self.speed)
        if self._last is None:
            dt = 0.0
        else:
            dt = (ms - self._last) / 1000.0
            dt = (0.0 if dt < 0.0 else 0.1 if dt > 0.1 else dt) * speed
        self._last = ms

        # A change that happened at `since` is now - since along, on every
        # frame: a morph may even have landed, and then the loops are that
        # much past the landing.
        along = None
        if self._sync is not None:
            along = max(0.0, (ms - self._sync[0]) / 1000.0) * speed

        landed = False
        if self._plan is not None:
            if along is None:
                self._morph_time += dt
            elif along > self._morph_time:
                self._morph_time = along
            if self._morph_time >= self._plan.seconds:
                # The morph lands on the first frame that takes its clock
                # to duration + stagger: that frame shows the new mode at
                # rest, and what it overshot by is dropped.
                self._plan = None
                self._morph_time = 0.0
                self._time = 0.0
                landed = True
        elif self._animate and along is None:
            self._time += dt
        if along is not None and self._plan is None and self._animate:
            self._time = max(0.0, along - self._sync[1])

        if self._look_progress < 1.0:
            # The gaze has its own clock, advanced like the others.
            gaze = self.pack.gaze
            p = min(1.0, self._look_progress + dt / gaze.duration)
            self._look_progress = p
            if p >= 1.0:
                self._look_now = self._look_to
            else:
                # "steps" holds the old direction until the look lands.
                e = self._gaze_ease(p) if self._gaze_ease is not None else 0.0
                self._look_now = (
                    self._look_from[0] + (self._look_to[0] - self._look_from[0]) * e,
                    self._look_from[1] + (self._look_to[1] - self._look_from[1]) * e,
                )

        self._base = None
        self._drawn = None

        if landed and self.on_settled is not None:
            self.on_settled(self._scene.mode.id)

    # Drawing

    def _base_rects(self):
        # What is on screen, before the gaze: the morph if one is running,
        # else the mode at its loop time.
        if self._base is None:
            if self._plan is not None:
                self._base = self._plan.rects(self._morph_time)
            else:
                self._base = self._scene.rects(self._time, self.body_motion)
        return self._base

    def rects(self):
        """The rects to fill now, in drawing order.

        Each is a `Rect`: x, y, w, h in grid units, opacity (always above
        0.001) and role. Map the pack's `view` onto the drawing area.
        """
        if self._drawn is None:
            self._drawn = self._with_gaze(self._base_rects())
        return list(self._drawn)

    def mode_rects(self, mode, seconds=0.0):
        """A mode's rects `seconds` into its loops, for stills.

        Looking straight ahead, with the body motion unless the player
        was made with `body_motion=False`.
        """
        return self._scene_of(mode).rects(float(seconds), self.body_motion)

    # Gaze

    def look(self, dx, dy):
        """Turn the eyes: x to the right, y down, each -1..1.

        (0, 0) is straight ahead. The eyes ease there from wherever they
        are. Asking for the direction already set does nothing, and so
        does a pack without gaze.
        """
        if self.pack.gaze is None:
            return
        target = (_unit(dx), _unit(dy))
        if target == self._look_to:
            return
        # A new look eases from the last frame's direction.
        self._look_from = self._look_now
        self._look_to = target
        self._look_progress = 0.0

    def gaze(self):
        """The direction the eyes look in now, as (x, y)."""
        return self._look_now

    @property
    def gazing(self):
        """True while the eyes are still on their way to a new look."""
        return self._look_progress < 1.0

    def _with_gaze(self, rects):
        # The gaze is the last thing done: every rect whose role is in
        # the gaze's roles moves by gx × reach[0], gy × reach[1].
        gx, gy = self._look_now
        if gx == 0.0 and gy == 0.0:
            return rects
        gaze = self.pack.gaze
        roles = self._gaze_roles
        eyes = [r for r in rects if r[5] in roles]
        if not eyes:
            return rects
        dx = gx * gaze.reach[0]
        dy = gy * gaze.reach[1]
        if gaze.inside is not None:
            # Limit the move on each axis so the gazing rects stay in the
            # box: over the rects that fit inside it on that axis, the
            # move may be at most the smallest room on the far side and
            # at least the largest (negative) room on the near side. If
            # the two limits cross there is no room: no move.
            left, top, width, height = gaze.inside
            right = left + width
            bottom = top + height
            low = float("-inf")
            high = float("inf")
            for r in eyes:
                if r[0] >= left and r[0] + r[2] <= right:
                    low = max(low, left - r[0])
                    high = min(high, right - (r[0] + r[2]))
            dx = 0.0 if low > high else min(max(dx, low), high)
            low = float("-inf")
            high = float("inf")
            for r in eyes:
                if r[1] >= top and r[1] + r[3] <= bottom:
                    low = max(low, top - r[1])
                    high = min(high, bottom - (r[1] + r[3]))
            dy = 0.0 if low > high else min(max(dy, low), high)
        if dx == 0.0 and dy == 0.0:
            return rects
        return [
            r._replace(x=r[0] + dx, y=r[1] + dy) if r[5] in roles else r
            for r in rects
        ]

    # What a mode is for

    def loop_seconds(self, mode):
        """How long a mode takes to play every piece's loop once.

        The longest of (duration + delay) over its pieces, its body
        animation and its window's. 0 for a still mode.
        """
        return self._scene_of(mode).loop_seconds

    def hold(self, mode):
        """How many seconds to show a reaction after its morph lands.

        The mode's own `hold`, or else its loop time kept between 1.2 and
        2.5 s.
        """
        scene = self._scene_of(mode)
        if scene.mode.hold is not None:
            return scene.mode.hold
        return min(max(scene.loop_seconds, 1.2), 2.5)

    def kind(self, mode):
        """What the pack calls a mode: "state" or "reaction"."""
        return self.pack.mode(mode).kind
