"""Holds this player to the reference player on every morph there is.

`tools/check-morphs.js` writes the reference player's frames, one line
each as JSON, and runs this with the file: it plays every line the same
way and compares the rects, in drawing order. See that tool for what a
line holds and how it is played.

    python3 tests/morphs.py morphs.jsonl
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from omi import Pack, Player  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
# The pack's tolerance, and the half a digit the file's numbers are
# rounded by.
POSITION = 0.01 + 0.00005
OPACITY = 0.001 + 0.00005


def play(pack, how, before, old, new):
    omi = Player(pack)
    clock = [1000]

    def run(seconds):
        stop = clock[0] + seconds * 1000
        while clock[0] < stop - 1e-6:
            clock[0] += 10
            omi.frame(clock[0])

    if how == "morph":
        omi.set(before, instant=True)
        omi.frame(clock[0])
        omi.set(old)
        omi.frame(clock[0])
        run(0.3)
    else:
        omi.set(old, instant=True)
        omi.frame(clock[0])
        if how == "loop":
            run(0.9)
    omi.set(new)
    omi.frame(clock[0])
    run(0.3)
    return omi.rects()


def same(rects, wanted):
    if len(rects) != len(wanted):
        return False
    for r, w in zip(rects, wanted):
        if r.role != w[5] or abs(r.opacity - w[4]) > OPACITY:
            return False
        if (abs(r.x - w[0]) > POSITION or abs(r.y - w[1]) > POSITION
                or abs(r.w - w[2]) > POSITION or abs(r.h - w[3]) > POSITION):
            return False
    return True


def main(path):
    pack = Pack.load(os.path.join(HERE, "..", "..", "..", "pack", "omi.json"))
    total = 0
    off = []
    with open(path) as lines:
        for line in lines:
            how, before, old, new, wanted = json.loads(line)
            total += 1
            if not same(play(pack, how, before, old, new), wanted):
                off.append("%s to %s (%s)" % (old, new, how))
    if off:
        print("FAIL python: %d of %d morphs are not the reference player's: %s%s" % (
            len(off), total, ", ".join(off[:8]), ", ..." if len(off) > 8 else ""))
        return 1
    print("ok: python: every morph is the reference player's, rect for rect (%d)" % total)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
