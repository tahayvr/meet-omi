"""The player against pack/conformance.json.

This follows "Checking your own player" in the pack README: every mode at
every listed time, every morph's start and landing, every gaze case. The
reference player's frames in between a morph's start and landing are not
required by the pack; how many of them match is counted and reported.

Run it from player/python:

    python3 -m unittest discover -s tests -v
"""

import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from omi import Pack, Player  # noqa: E402

PACK = os.path.join(HERE, "..", "..", "..", "pack")

# What the summary line reports, filled in as the tests run.
COUNTS = {
    "checks": 0,
    "failed": 0,
    "modes": 0,
    "morphs": 0,
    "gazes": 0,
    "frames": 0,
    "frames_matched": 0,
    "frames_in_order": 0,
}


def setUpModule():
    global pack, conformance
    pack = Pack.load(os.path.join(PACK, "omi.json"))
    with open(os.path.join(PACK, "conformance.json"), "r", encoding="utf-8") as file:
        conformance = json.load(file)


def tearDownModule():
    line = (
        "python: %(checks)d checks (%(modes)d modes, %(morphs)d morphs, "
        "%(gazes)d gazes), in-between morph frames matched: "
        "%(frames_matched)d/%(frames)d (%(frames_in_order)d in the same "
        "drawing order)" % COUNTS
    )
    if COUNTS["failed"]:
        line = "FAILED: %d of the checks, %s" % (COUNTS["failed"], line)
    else:
        line = "ok: " + line
    print(line)
    sys.stdout.flush()


def close(got, want, tolerance):
    """One rect against one [x, y, w, h, opacity, role] of the data."""
    return (
        got.role == want[5]
        and abs(got.x - want[0]) <= tolerance["position"]
        and abs(got.y - want[1]) <= tolerance["position"]
        and abs(got.w - want[2]) <= tolerance["position"]
        and abs(got.h - want[3]) <= tolerance["position"]
        and abs(got.opacity - want[4]) <= tolerance["opacity"]
    )


def same_in_order(got, want, tolerance):
    return len(got) == len(want) and all(
        close(g, w, tolerance) for g, w in zip(got, want)
    )


def same_in_any_order(got, want, tolerance):
    if len(got) != len(want):
        return False
    left = list(want)
    for g in got:
        for index, w in enumerate(left):
            if close(g, w, tolerance):
                del left[index]
                break
        else:
            return False
    return True


def run_to(player, clock, target):
    """Give the player frames up to `target` ms, at most 100 ms apart.

    A player keeps dt between 0 and 0.1 s, so the time has to be walked.
    Returns the new clock.
    """
    while clock < target:
        clock = min(clock + 100.0, target)
        player.frame(clock)
    return clock


class Conformance(unittest.TestCase):
    def check(self, ok, message):
        COUNTS["checks"] += 1
        if not ok:
            COUNTS["failed"] += 1
        self.assertTrue(ok, message)

    def test_data(self):
        self.assertEqual(conformance["format"], "omi-conformance")
        self.assertEqual(conformance["pack_version"], pack.version)
        self.assertEqual(
            conformance["rect"], ["x", "y", "w", "h", "opacity", "role"]
        )
        # Every mode of the pack is in the data, and the other way round.
        self.assertEqual(sorted(conformance["modes"]), sorted(pack.mode_ids))

    def test_modes(self):
        """Every mode at every listed time, with body motion on."""
        tolerance = conformance["tolerance"]
        player = Player(pack)
        for mode, times in conformance["modes"].items():
            COUNTS["modes"] += 1
            for seconds, want in times.items():
                with self.subTest(mode=mode, seconds=seconds):
                    got = player.mode_rects(mode, float(seconds))
                    self.check(
                        same_in_order(got, want, tolerance),
                        "%s at %s s is not what the pack draws" % (mode, seconds),
                    )

    def test_modes_played(self):
        """The same, reached by playing frames instead of asking for a still."""
        tolerance = conformance["tolerance"]
        for mode, times in conformance["modes"].items():
            player = Player(pack, mode=mode)
            player.frame(0.0)
            clock = 0.0
            for seconds, want in sorted(times.items(), key=lambda item: float(item[0])):
                with self.subTest(mode=mode, seconds=seconds):
                    clock = run_to(player, clock, float(seconds) * 1000.0)
                    self.assertTrue(
                        same_in_order(player.rects(), want, tolerance),
                        "%s played to %s s is not what the pack draws" % (mode, seconds),
                    )

    def test_morphs(self):
        """Every morph's start and landing; the frames in between are counted."""
        tolerance = conformance["tolerance"]
        landing = conformance["morph_seconds"] * 1000.0
        for morph in conformance["morphs"]:
            COUNTS["morphs"] += 1
            name = "%s to %s" % (morph["from"], morph["to"])
            with self.subTest(morph=name):
                player = Player(pack, mode=morph["from"])
                player.frame(0.0)
                self.check(
                    same_in_any_order(player.rects(), morph["start"], tolerance),
                    "%s: the start is not the old mode at rest" % name,
                )
                player.set(morph["to"])
                clock = 0.0
                frames = sorted(morph["frames"].items(), key=lambda item: float(item[0]))
                for seconds, want in frames:
                    clock = run_to(player, clock, float(seconds) * 1000.0)
                    got = player.rects()
                    COUNTS["frames"] += 1
                    if same_in_any_order(got, want, tolerance):
                        COUNTS["frames_matched"] += 1
                    if same_in_order(got, want, tolerance):
                        COUNTS["frames_in_order"] += 1
                # Frames until it has landed: the frame it lands on shows
                # the new mode at rest.
                while player.morphing and clock < landing + 1000.0:
                    clock += 10.0
                    player.frame(clock)
                self.assertTrue(player.settled, "%s: still morphing a second after the landing" % name)
                self.assertLessEqual(clock, landing + 10.0, "%s: landed late" % name)
                self.check(
                    same_in_any_order(player.rects(), morph["end"], tolerance),
                    "%s: the landing is not the new mode at rest" % name,
                )

    def test_gazes(self):
        """Every gaze case: half way there, and once it has landed."""
        tolerance = conformance["tolerance"]
        for gaze in conformance["gazes"]:
            COUNTS["gazes"] += 1
            name = "%s looking %s" % (gaze["mode"], gaze["look"])
            with self.subTest(gaze=name):
                # A mode at rest with no loops, looking ahead.
                player = Player(pack, animate=False, mode=gaze["mode"])
                player.frame(0.0)
                player.look(gaze["look"][0], gaze["look"][1])
                clock = run_to(player, 0.0, gaze["half"]["at"] * 1000.0)
                self.check(
                    same_in_order(player.rects(), gaze["half"]["rects"], tolerance),
                    "%s: wrong %s s in" % (name, gaze["half"]["at"]),
                )
                run_to(player, clock, clock + 2000.0)
                self.assertFalse(player.gazing, "%s: never landed" % name)
                self.check(
                    same_in_order(player.rects(), gaze["end"], tolerance),
                    "%s: wrong once landed" % name,
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
