"""The parts of the player that conformance.json has no data for.

These hold the player to rules of the pack README and the Omi state
protocol that the conformance data doesn't exercise: the clocks, mode
changes, the gaze meeting a morph, and changes with `since`.
"""

import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from omi import Pack, PackError, Player, Rect, UnknownMode  # noqa: E402

PACK = os.path.join(HERE, "..", "..", "..", "pack", "omi.json")


def setUpModule():
    global pack
    pack = Pack.load(PACK)


def run_to(player, clock, target):
    while clock < target:
        clock = min(clock + 100.0, target)
        player.frame(clock)
    return clock


def ink(rects):
    # How much is drawn: cutting rects into cells doesn't change it, and
    # rounding them to 1/1024 for a morph changes it by less than INK.
    return sum(r.w * r.h * r.opacity for r in rects)


INK = 1.0


class Loading(unittest.TestCase):
    def test_pack(self):
        self.assertEqual(pack.version, 1)
        self.assertEqual(pack.grid, 20)
        self.assertEqual(pack.view, (-70, -70, 440, 440))
        self.assertIn("idle", pack.mode_ids)
        self.assertTrue(pack.has("mark"))
        self.assertFalse(pack.has("thinkng"))

    def test_not_a_pack(self):
        for text in ("", "[]", '{"format": "something-else"}',
                     '{"format": "omi-pack", "version": 2}'):
            with self.assertRaises(PackError):
                Pack.parse(text)
        self.assertTrue(issubclass(PackError, ValueError))

    def test_unknown_mode(self):
        with self.assertRaises(UnknownMode) as raised:
            Player(pack, mode="thinkng")
        self.assertEqual(str(raised.exception), 'no mode "thinkng"')
        player = Player(pack)
        with self.assertRaises(KeyError):
            player.set("thinkng")
        with self.assertRaises(UnknownMode):
            player.mode_rects("thinkng", 0)
        # The failed change left the player as it was.
        self.assertEqual(player.mode, "mark")
        self.assertTrue(player.settled)

    def test_rects(self):
        rects = Player(pack, mode="idle").rects()
        self.assertEqual(len(rects), 15)
        self.assertIsInstance(rects[0], Rect)
        self.assertEqual(rects[13], Rect(100, 110, 20, 40, 1, "eye"))
        with self.assertRaises(AttributeError):
            rects[0].x = 1


class WhatAModeIsFor(unittest.TestCase):
    def test_loop_seconds(self):
        player = Player(pack)
        self.assertEqual(player.loop_seconds("mark"), 0)
        # idle: the eyes blink every 4 s, the body bobs every 2.8 s.
        self.assertEqual(player.loop_seconds("idle"), 4)
        # updating: a piece's own duration (2.8 s) and its delay (1.92 s).
        self.assertAlmostEqual(player.loop_seconds("updating"), 2.8 + 1.92)
        # peek: only its window moves.
        self.assertEqual(player.loop_seconds("peek"), 4.5)

    def test_hold_and_kind(self):
        player = Player(pack)
        self.assertEqual(player.kind("success"), "reaction")
        self.assertEqual(player.kind("idle"), "state")
        self.assertEqual(player.hold("success"), 1.2)
        # No hold of its own: its loop time, kept between 1.2 and 2.5 s.
        self.assertEqual(player.hold("idle"), 2.5)
        self.assertEqual(player.hold("mark"), 1.2)
        self.assertEqual(player.hold("typing"), min(max(player.loop_seconds("typing"), 1.2), 2.5))


class Time(unittest.TestCase):
    def test_first_frame_advances_nothing(self):
        player = Player(pack, mode="idle")
        player.frame(123456.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))

    def test_dt_is_kept_between_0_and_a_tenth(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.frame(5000.0)   # a pause: counts as 0.1 s
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1))
        player.frame(1000.0)   # the clock restarted: counts as nothing
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1))
        player.frame(1050.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1 + 0.05))

    def test_speed(self):
        player = Player(pack, mode="idle", speed=2.0)
        player.frame(0.0)
        player.frame(100.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.2))

    def test_speed_is_never_less_than_a_twentieth(self):
        player = Player(pack, mode="idle", speed=0.0)
        player.frame(0.0)
        player.frame(100.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.1 * 0.05))

    def test_turning_animate_off_goes_back_to_rest(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        self.assertNotEqual(player.rects(), player.mode_rects("idle", 0))
        player.animate = False
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))
        # and back on, the loops start over
        player.animate = True
        player.frame(950.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0.05))

    def test_animate_off(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        self.assertEqual(player.rects(), player.mode_rects("idle", 0))
        # A morph still plays, and lands on the new mode at rest.
        player.set("thinking")
        run_to(player, 900.0, 1300.0)
        self.assertTrue(player.morphing)
        run_to(player, 1300.0, 3000.0)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))

    def test_body_motion_off(self):
        player = Player(pack, mode="idle", body_motion=False)
        player.frame(0.0)
        run_to(player, 0.0, 1400.0)
        # The frame stays put; half way through its bob it is 12 units up.
        self.assertEqual(player.rects()[0], Rect(0, 0, 300, 20, 1, "frame"))
        bobbing = Player(pack, mode="idle")
        bobbing.frame(0.0)
        run_to(bobbing, 0.0, 1400.0)
        self.assertAlmostEqual(bobbing.rects()[0].y, -12, places=6)


class Changes(unittest.TestCase):
    def test_same_mode_does_nothing(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 500.0)
        before = player.rects()
        player.set("idle")
        player.set("idle", instant=True)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), before)

    def test_instant(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 500.0)
        player.set("error", instant=True)
        self.assertTrue(player.settled)
        self.assertEqual(player.mode, "error")
        self.assertEqual(player.rects(), player.mode_rects("error", 0))

    def test_morph_starts_from_what_is_on_screen(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        run_to(player, 0.0, 900.0)
        before = player.rects()
        player.set("thinking")
        self.assertTrue(player.morphing)
        self.assertEqual(player.mode, "thinking")
        # At 0 the morph is the old picture, cut into cells.
        self.assertAlmostEqual(ink(player.rects()), ink(before), delta=INK)
        self.assertGreater(len(player.rects()), len(before))

    def test_change_in_the_middle_of_a_morph(self):
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.set("error")
        run_to(player, 0.0, 300.0)
        middle = player.rects()
        player.set("sleeping")
        self.assertAlmostEqual(ink(player.rects()), ink(middle), delta=INK)
        run_to(player, 300.0, 300.0 + 840.0)
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("sleeping", 0))

    def test_landing_and_on_settled(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(0.0)
        player.set("thinking")
        run_to(player, 0.0, 800.0)
        self.assertEqual(landed, [])
        self.assertTrue(player.morphing)
        self.assertFalse(player.settled)
        # The morph lands at duration + stagger = 0.84 s, on the first
        # frame that gets there. That frame shows the new mode at rest:
        # the 0.06 s it overshot by are dropped.
        player.frame(900.0)
        self.assertEqual(landed, ["thinking"])
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))
        player.frame(950.0)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0.05))
        run_to(player, 950.0, 2000.0)
        self.assertEqual(landed, ["thinking"])

    def test_a_jump_settles_too(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(0.0)
        player.set("error", instant=True)
        self.assertEqual(landed, ["error"])

    def test_nothing_on_screen_is_a_jump(self):
        # With nothing drawn there is nothing to morph from.
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player._base = []
        player.set("thinking")
        self.assertTrue(player.settled)
        self.assertEqual(player.rects(), player.mode_rects("thinking", 0))

    def test_the_mode_a_morph_is_heading_for(self):
        # In the middle of a morph, a change to its own mode is a change
        # like any other: a new morph, from what is on screen.
        player = Player(pack, mode="idle")
        player.frame(0.0)
        player.set("error")
        run_to(player, 0.0, 300.0)
        player.set("error")
        run_to(player, 300.0, 300.0 + 800.0)
        self.assertTrue(player.morphing)
        run_to(player, 1100.0, 1200.0)
        self.assertTrue(player.settled)


class Gaze(unittest.TestCase):
    def test_look(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        self.assertEqual(player.gaze(), (0.0, 0.0))
        self.assertFalse(player.gazing)
        player.look(5, -0.5)   # each axis is kept in -1..1
        self.assertTrue(player.gazing)
        self.assertEqual(player.gaze(), (0.0, 0.0))
        run_to(player, 0.0, 100.0)
        x, y = player.gaze()
        self.assertTrue(0 < x < 1 and -0.5 < y < 0)
        run_to(player, 100.0, 400.0)
        self.assertFalse(player.gazing)
        self.assertEqual(player.gaze(), (1.0, -0.5))
        eye = player.rects()[13]
        self.assertEqual((eye.x, eye.y), (100 + 30, 110 - 15))
        # Asking for the direction already set does nothing.
        player.look(1, -0.5)
        self.assertFalse(player.gazing)

    def test_a_new_look_starts_from_where_the_eyes_are(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        player.look(1, 0)
        run_to(player, 0.0, 175.0)
        half = player.gaze()
        player.look(0, 0)
        player.frame(175.0)
        self.assertEqual(player.gaze(), half)
        run_to(player, 175.0, 600.0)
        self.assertEqual(player.gaze(), (0.0, 0.0))

    def test_a_morph_takes_its_source_before_the_gaze(self):
        player = Player(pack, mode="idle", animate=False)
        player.frame(0.0)
        player.look(1, 0)
        run_to(player, 0.0, 500.0)
        before = [r for r in player.rects() if r.role == "eye"]
        # A mode change doesn't interrupt the look, and the look is not
        # applied twice: the eyes start the morph where they are.
        player.set("sleeping")
        after = [r for r in player.rects() if r.role == "eye"]
        self.assertEqual(after, before)
        self.assertEqual(player.gaze(), (1.0, 0.0))

    def test_wide_eyes_stay_inside(self):
        player = Player(pack, mode="success", animate=False)
        player.frame(0.0)
        player.look(1, 0)
        run_to(player, 0.0, 500.0)
        eyes = [r for r in player.rects() if r.role == "eye"]
        inside = pack.gaze.inside
        self.assertEqual(max(r.x + r.w for r in eyes), inside[0] + inside[2])


class Since(unittest.TestCase):
    """Changes that happened at a Unix time: the Omi state protocol."""

    NOW = 1767225600000.0

    def assertSameRects(self, got, want):
        self.assertEqual(len(got), len(want))
        for a, b in zip(got, want):
            self.assertEqual(a.role, b.role)
            for x, y in zip(a[:5], b[:5]):
                self.assertAlmostEqual(x, y, places=6)

    def test_a_morph_part_of_the_way_along(self):
        # One app watched the change happen.
        watching = Player(pack, mode="idle", animate=False)
        watching.frame(self.NOW)
        watching.set("thinking", since=self.NOW)
        run_to(watching, self.NOW, self.NOW + 300.0)
        # Another hears of it 0.29 s late.
        late = Player(pack, mode="idle", animate=False)
        late.frame(self.NOW + 290.0)
        late.set("thinking", since=self.NOW)
        late.frame(self.NOW + 300.0)
        self.assertTrue(late.morphing)
        self.assertSameRects(late.rects(), watching.rects())
        # From then on they stay together, and land together.
        run_to(watching, self.NOW + 300.0, self.NOW + 840.0)
        run_to(late, self.NOW + 300.0, self.NOW + 840.0)
        self.assertTrue(watching.settled and late.settled)
        self.assertSameRects(late.rects(), watching.rects())

    def test_a_morph_that_has_landed(self):
        landed = []
        player = Player(pack, mode="idle", on_settled=landed.append)
        player.frame(self.NOW)
        player.set("thinking", since=self.NOW - 5000.0)
        self.assertEqual(landed, [])
        player.frame(self.NOW + 16.0)
        # Its loops are that much past the landing.
        self.assertTrue(player.settled)
        self.assertEqual(landed, ["thinking"])
        self.assertSameRects(
            player.rects(), player.mode_rects("thinking", 5.016 - 0.84)
        )

    def test_before_the_first_frame(self):
        player = Player(pack, mode="mark")
        player.set("idle", since=self.NOW - 400.0)
        player.frame(self.NOW)
        other = Player(pack, mode="mark")
        other.frame(self.NOW - 400.0)
        other.set("idle")
        run_to(other, self.NOW - 400.0, self.NOW)
        self.assertSameRects(player.rects(), other.rects())

    def test_instant(self):
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", instant=True, since=self.NOW - 2500.0)
        player.frame(self.NOW + 100.0)
        # Its loops have been running for now - since.
        self.assertSameRects(player.rects(), player.mode_rects("idle", 2.6))

    def test_it_follows_the_clock_on_every_frame(self):
        # An app that stalls is back in step on its next frame: a frame
        # counts for 0.1 s at most, but a shared change is worked out from
        # the clock.
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", instant=True, since=self.NOW)
        player.frame(self.NOW + 100.0)
        player.frame(self.NOW + 3100.0)
        self.assertSameRects(player.rects(), player.mode_rects("idle", 3.1))
        # A change of the player's own runs on its frames again.
        player.set("thinking", instant=True)
        player.frame(self.NOW + 9100.0)
        self.assertSameRects(player.rects(), player.mode_rects("thinking", 0.1))

    def test_a_time_still_to_come(self):
        # A clock a little behind the service's: the change starts now.
        player = Player(pack, mode="mark")
        player.frame(self.NOW)
        player.set("idle", since=self.NOW + 50.0)
        player.frame(self.NOW + 16.0)
        other = Player(pack, mode="mark")
        other.frame(self.NOW)
        other.set("idle")
        self.assertSameRects(player.rects(), other.rects())


if __name__ == "__main__":
    unittest.main(verbosity=2)
