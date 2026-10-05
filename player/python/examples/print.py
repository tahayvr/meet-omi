"""Prints a few frames of Omi morphing to a mode, as rects.

    python3 examples/print.py            # idle
    python3 examples/print.py thinking
    python3 examples/print.py thinking path/to/omi.json
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from omi import Pack, Player, UnknownMode  # noqa: E402


def main(argv):
    mode = argv[1] if len(argv) > 1 else "idle"
    path = argv[2] if len(argv) > 2 else os.path.join(
        HERE, "..", "..", "..", "pack", "omi.json"
    )
    pack = Pack.load(path)
    omi = Player(pack)  # starts at "mark", the plain logo
    try:
        omi.set(mode)   # morphs there from wherever Omi is
    except UnknownMode as error:
        print("%s. The pack has: %s" % (error, ", ".join(pack.mode_ids)))
        return 1

    print("%s: a %s, loop %g s, hold %g s" % (
        mode, omi.kind(mode), omi.loop_seconds(mode), omi.hold(mode),
    ))
    # A second and a half of 60 Hz frames, printing every 30th.
    for frame in range(91):
        omi.frame(frame * 1000.0 / 60.0)
        if frame % 30:
            continue
        rects = omi.rects()
        print("\n%.2f s, %s, %d rects" % (
            frame / 60.0, "morphing" if omi.morphing else "settled", len(rects),
        ))
        for r in rects:
            print("  %8.2f %8.2f %7.2f %7.2f  %.2f  %s" % r)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
