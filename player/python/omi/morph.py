"""Morphing from one mode to another: planning the pairs, playing them.

`plan` follows "Morphing from one mode to another" in the pack README step
by step. It runs once per mode change; `Plan.rects` then gives the morph's
rects at any time.

A cell here is a tuple (x, y, w, h, opacity, role). Lists keep their
order, which starts as drawing order: the pairing goes through the cells
in order, and a morph is drawn in the order its pairs were made.
"""

import math

from .anim import VISIBLE, make_ease
from .pack import FACE_ROLES, Rect

__all__ = ["Plan", "assign", "cut", "plan"]

# A frame cell and a face cell never pair: this is added to their cost in
# the assignment, and an assignment that lands on one is dropped.
_BANNED = 1e9


def _on_grid(value, grid):
    return abs(value - round(value / grid) * grid) <= 1e-6


def _stops(low, high, grid):
    # A side's two ends and every grid line more than 1e-6 inside it: the
    # stretches between two stops are the cells. The end cells keep their
    # partial size.
    stops = [low]
    line = math.floor(low / grid) * grid + grid
    while line < high - 1e-6:
        if line > low + 1e-6:
            stops.append(line)
        line += grid
    stops.append(high)
    return stops


def cut(rects, grid, logo):
    """Cut rects into grid cells, along the grid lines.

    A rect whose four edges all sit on multiples of `grid` (within 1e-6),
    or that overlaps any rect of `logo`, is cut at every grid line it
    crosses. Other rects stay whole. `logo` is a list of (x, y, w, h).

    Returns cells in the order of the rects, a rect's cells column by
    column, each column top to bottom. The order matters: pairing goes
    through the cells in order, and it is the morph's drawing order.
    """
    cells = []
    for x, y, w, h, opacity, role in rects:
        right = x + w
        bottom = y + h
        whole = not (
            _on_grid(x, grid) and _on_grid(y, grid)
            and _on_grid(right, grid) and _on_grid(bottom, grid)
        )
        if whole:
            # Sharing an edge is not overlapping.
            for lx, ly, lw, lh in logo:
                if x < lx + lw and lx < right and y < ly + lh and ly < bottom:
                    whole = False
                    break
        if whole:
            cells.append((x, y, w, h, opacity, role))
            continue
        xs = _stops(x, right, grid)
        ys = _stops(y, bottom, grid)
        for i in range(len(xs) - 1):
            for j in range(len(ys) - 1):
                cells.append((
                    xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j],
                    opacity, role,
                ))
    return cells


def assign(cost):
    """A minimum-cost one-to-one assignment.

    `cost` is a list of rows, with no more rows than columns. Returns, for
    every row, the column it is given.

    This is the Hungarian method with row and column potentials, as the
    pack README writes it out, taking the rows in order: O(rows² ×
    columns). Several assignments can cost the same, and which one comes
    out depends on the method: here every "less than" is strict, so a
    column is reached from the first column that gets there cheapest, and
    of the columns as cheap to add, the first is added.
    """
    n = len(cost)
    if n == 0:
        return []
    m = len(cost[0])
    inf = float("inf")
    # Rows and columns count from 1 in here; column 0 is where a new row
    # waits for its column.
    u = [0.0] * (n + 1)      # the rows' potentials
    v = [0.0] * (m + 1)      # the columns' potentials
    owner = [0] * (m + 1)    # the row each column is given to, 0 for none
    way = [0] * (m + 1)      # the column each column was reached from
    rows = [None] + [[0.0] + list(row) for row in cost]
    for i in range(1, n + 1):
        # Add row i: grow a tree of columns from it, the cheapest column
        # first, until that is a free one. Then every row on the path
        # back moves over by one column.
        owner[0] = i
        j0 = 0
        tree = [0]
        outside = list(range(1, m + 1))
        least = [inf] * (m + 1)  # the least each column can be reached for
        last = 0.0
        while True:
            i0 = owner[j0]
            row = rows[i0]
            ui = u[i0]
            delta = inf
            j1 = 0
            for j in outside:
                # What the last step took off every column outside the
                # tree comes off here, to save a pass.
                low = least[j] - last
                reach = row[j] - ui - v[j]
                if reach < low:
                    low = reach
                    way[j] = j0
                least[j] = low
                if low < delta:
                    delta = low
                    j1 = j
            for j in tree:
                u[owner[j]] += delta
                v[j] -= delta
            last = delta
            j0 = j1
            if owner[j0] == 0:
                break
            tree.append(j0)
            outside.remove(j0)
        while True:
            j1 = way[j0]
            owner[j0] = owner[j1]
            j0 = j1
            if j0 == 0:
                break
    given = [0] * n
    for j in range(1, m + 1):
        if owner[j]:
            given[owner[j] - 1] = j - 1
    return given


def _round(value):
    # To the nearest whole number, halves up.
    return math.floor(value + 0.5)


def _fine(rect):
    # A rect with x, y, w and h rounded to the nearest 1/1024.
    x, y, w, h, opacity, role = rect
    return (
        _round(x * 1024) / 1024, _round(y * 1024) / 1024,
        _round(w * 1024) / 1024, _round(h * 1024) / 1024,
        opacity, role,
    )


def _same(x, y, w, h, role):
    # Two cells are "the same" when the role is equal and so are x, y, w
    # and h, each rounded to half a unit: when this is equal for both.
    return (role, _round(x * 2), _round(y * 2), _round(w * 2), _round(h * 2))


def _fits(old, new, s_left, d_left, dx, dy):
    # An offset fits as many old cells as, taken in order and shifted by
    # it, find a new cell that is the same and that none before took: each
    # takes the first one left. Returns the pairs (old index, new index).
    spots = {}
    for di in d_left:
        b = new[di]
        spots.setdefault(_same(b[0], b[1], b[2], b[3], b[5]), []).append(di)
    taken = {}
    pairs = []
    for si in s_left:
        a = old[si]
        key = _same(a[0] + dx, a[1] + dy, a[2], a[3], a[5])
        there = spots.get(key)
        if there is None:
            continue
        at = taken.get(key, 0)
        if at < len(there):
            pairs.append((si, there[at]))
            taken[key] = at + 1
    return pairs


def _votes(old, new, s_left, d_left):
    # Each pair of an old and a new cell with the same role and size (w
    # and h each within 0.5) votes for the offset (new - old), rounded to
    # whole units. Returns {rounded offset: [sum of dx, sum of dy, voters]},
    # to average the exact offsets of an offset's voters. The offsets are
    # in the order they were first voted for, going through the old cells
    # in order and, for each, the new cells in order.
    floor = math.floor
    # New cells by role and rounded size: sizes within half a unit round
    # to the same whole number or to one next to it.
    sized = {}
    for di in d_left:
        bx, by, bw, bh, _, role = new[di]
        sized.setdefault((role, floor(bw + 0.5), floor(bh + 0.5)), []).append(
            (di, bx, by, bw, bh)
        )
    votes = {}
    like = {}
    for si in s_left:
        ax, ay, aw, ah, _, role = old[si]
        key = (role, aw, ah)
        others = like.get(key)
        if others is None:
            rw = floor(aw + 0.5)
            rh = floor(ah + 0.5)
            others = []
            for iw in (rw - 1, rw, rw + 1):
                for ih in (rh - 1, rh, rh + 1):
                    for other in sized.get((role, iw, ih), ()):
                        if -0.5 <= aw - other[3] <= 0.5 and -0.5 <= ah - other[4] <= 0.5:
                            others.append(other)
            others.sort()
            like[key] = others
        for _, bx, by, _, _ in others:
            dx = bx - ax
            dy = by - ay
            key = (floor(dx + 0.5), floor(dy + 0.5))
            vote = votes.get(key)
            if vote is None:
                votes[key] = [dx, dy, 1]
            else:
                vote[0] += dx
                vote[1] += dy
                vote[2] += 1
    return votes


def _still_vote(old, new, s_left, d_left):
    # The vote for the offset that rounds to (0, 0), without counting the
    # others: [sum of dx, sum of dy, voters], summed in the same order as
    # `_votes` does, or None if nothing votes for it.
    floor = math.floor
    # New cells by role and rounded place: one that is less than half a
    # unit away rounds to the same whole numbers or to ones next to them.
    spots = {}
    for di in d_left:
        bx, by, bw, bh, _, role = new[di]
        spots.setdefault((role, floor(bx + 0.5), floor(by + 0.5)), []).append(
            (di, bx, by, bw, bh)
        )
    sum_x = 0.0
    sum_y = 0.0
    count = 0
    for si in s_left:
        ax, ay, aw, ah, _, role = old[si]
        rx = floor(ax + 0.5)
        ry = floor(ay + 0.5)
        near = []
        for ix in (rx - 1, rx, rx + 1):
            for iy in (ry - 1, ry, ry + 1):
                for other in spots.get((role, ix, iy), ()):
                    if (floor(other[1] - ax + 0.5) == 0 and floor(other[2] - ay + 0.5) == 0
                            and -0.5 <= aw - other[3] <= 0.5 and -0.5 <= ah - other[4] <= 0.5):
                        near.append(other)
        near.sort()
        for _, bx, by, _, _ in near:
            sum_x += bx - ax
            sum_y += by - ay
            count += 1
    return [sum_x, sum_y, count] if count else None


def _rigid_groups(old, new):
    # Cells that moved together as a whole, or didn't move at all, pair
    # first. Returns the pairs (old index, new index, rigid) and the
    # indexes left on both sides, in order.
    s_left = list(range(len(old)))
    d_left = list(range(len(new)))
    pairs = []
    # Up to 4 rounds, each on the cells not paired yet, for as long as
    # both sides have some.
    for _ in range(4):
        if not s_left or not d_left:
            break
        smaller = min(len(s_left), len(d_left))
        enough = max(12, 0.3 * smaller)
        # The offset that rounds to (0, 0) is the one to beat, with the
        # fits it has: none, if nothing voted for it.
        still = _still_vote(old, new, s_left, d_left)
        best = _fits(old, new, s_left, d_left, still[0] / still[2], still[1] / still[2]) if still else []
        rigid = False
        # Another offset takes its place when it has at least `enough`
        # votes, fits at least that many cells, and fits more than 1.2
        # times as many as the best so far. They are tried in the order
        # they were first voted for. No offset fits more cells than the
        # smaller side has, so when the best is already within 1.2 times
        # of that none can, and the votes need not be counted.
        if len(best) * 1.2 < smaller:
            for key, (sum_x, sum_y, count) in _votes(old, new, s_left, d_left).items():
                if key == (0, 0) or count < enough:
                    continue
                found = _fits(old, new, s_left, d_left, sum_x / count, sum_y / count)
                if len(found) >= enough and len(found) > len(best) * 1.2:
                    best = found
                    rigid = True
        if not best:
            break
        used_s = set()
        used_d = set()
        for si, di in best:
            pairs.append((si, di, rigid))
            used_s.add(si)
            used_d.add(di)
        s_left = [si for si in s_left if si not in used_s]
        d_left = [di for di in d_left if di not in used_d]
        # The offset that rounds to (0, 0) ends the rounds. Any other
        # makes its pairs rigid, and the next round runs on what is left.
        if not rigid:
            break
    return pairs, s_left, d_left


def _centers(cells, indexes):
    return [
        (cells[i][0] + cells[i][2] / 2.0, cells[i][1] + cells[i][3] / 2.0,
         cells[i][2], cells[i][3], cells[i][5], i)
        for i in indexes
    ]


def _costs(rows, columns, penalty2):
    # cost = squared distance between centers + 0.5 × ((Δw)² + (Δh)²)
    # + rolePenalty² when the roles differ. A frame cell and a face cell
    # (eye, brow, mouth, tear) never pair: 1e9 is added to their cost
    # instead.
    table = []
    for ax, ay, aw, ah, role, _ in rows:
        frame = role == "frame"
        face = role in FACE_ROLES
        line = []
        for bx, by, bw, bh, other, _ in columns:
            dx = ax - bx
            dy = ay - by
            dw = aw - bw
            dh = ah - bh
            cost = dx * dx + dy * dy + 0.5 * (dw * dw + dh * dh)
            if other != role:
                if (frame and other in FACE_ROLES) or (face and other == "frame"):
                    cost += _BANNED
                else:
                    cost += penalty2
            line.append(cost)
        table.append(line)
    return table


def _nearest(cell, others, penalty2):
    # The nearest of `others` by squared distance between centers
    # + rolePenalty² for a different role, never one of a banned role;
    # of two as near, the first. Returns (index, plain distance²), or
    # (None, 0) if there is none.
    cx = cell[0] + cell[2] / 2.0
    cy = cell[1] + cell[3] / 2.0
    role = cell[5]
    face = role in FACE_ROLES
    best = None
    best_score = float("inf")
    best_d2 = 0.0
    for ox, oy, _, _, other, index in others:
        d2 = (cx - ox) * (cx - ox) + (cy - oy) * (cy - oy)
        score = d2
        if other != role:
            if (other == "frame" and face) or (role == "frame" and other in FACE_ROLES):
                continue
            score += penalty2
        if score < best_score:
            best = index
            best_score = score
            best_d2 = d2
    return best, best_d2


def _back(p):
    # The "back" ease: overshoots a little, then settles.
    q = p - 1.0
    return 1.0 + 2.70158 * q * q * q + 1.70158 * q * q


class Plan:
    """A planned morph: every pair with its delay.

    `seconds` is when the whole morph lands (duration + stagger).
    """

    def __init__(self, moves, settings):
        # A move is (start, end, role, delay, grow): start and end are
        # (x, y, w, h, opacity), and grow marks a new cell that grows from
        # its own center instead of blending from an old one. The moves
        # are in drawing order.
        self.duration = settings.duration
        self.seconds = settings.duration + settings.stagger
        self.ease = make_ease(settings.ease)
        self.moves = []
        for start, end, role, delay, grow in moves:
            still = None
            if not grow and start == end:
                # It stays where it is: one rect for the whole morph.
                still = Rect(end[0], end[1], end[2], end[3], end[4], role)
            self.moves.append((start, end, role, delay, grow, still))

    def rects(self, t):
        """The morph's rects on screen, t seconds in, in drawing order."""
        out = []
        ease = self.ease
        duration = self.duration
        for start, end, role, delay, grow, still in self.moves:
            if still is not None:
                if still[4] > VISIBLE:
                    out.append(still)
                continue
            # A pair's progress is (t - delay) / duration, kept in 0..1.
            p = (t - delay) / duration
            if p <= 0.0:
                p = 0.0
            elif p > 1.0:
                p = 1.0
            if grow:
                # Grown from its own center: from size 0 with the "back"
                # ease on size, and opacity = target × min(1, 3p), p being
                # the raw progress in both.
                opacity = end[4] * min(1.0, 3.0 * p)
                if opacity > VISIBLE:
                    size = _back(p)
                    w = end[2] * size
                    h = end[3] * size
                    out.append(Rect(
                        end[0] + (end[2] - w) / 2.0, end[1] + (end[3] - h) / 2.0,
                        w, h, opacity, role,
                    ))
                continue
            if p == 0.0:
                x, y, w, h, opacity = start
            elif p == 1.0:
                x, y, w, h, opacity = end
            else:
                # The progress is put through the ease, blending x, y, w,
                # h and opacity from old to new.
                e = p if ease is None else ease(p)
                x = start[0] + (end[0] - start[0]) * e
                y = start[1] + (end[1] - start[1]) * e
                w = start[2] + (end[2] - start[2]) * e
                h = start[3] + (end[3] - start[3]) * e
                opacity = start[4] + (end[4] - start[4]) * e
            if opacity > VISIBLE:
                out.append(Rect(x, y, w, h, opacity, role))
        return out


def plan(source, target, settings, grid, logo):
    """Plan the morph from the rects on screen to a mode's rects at rest.

    `source` and `target` are rects (x, y, w, h, opacity, role), `source`
    before the gaze is applied. `settings` is the pack's `morph`, `grid`
    its `grid`, and `logo` the (x, y, w, h) of every piece of "mark".
    Returns a `Plan`.
    """
    # 1. The rects on screen now and the new mode's rects at rest: of
    #    both, only those with opacity above 0.001, with x, y, w and h
    #    each rounded to the nearest 1/1024. Everything from here on only
    #    adds, subtracts and multiplies those, which is exact, so the
    #    pairs are the same as in any other player.
    # 2. Cut into grid cells, so a cell that is in both can stay put.
    old = cut([_fine(r) for r in source if r[4] > VISIBLE], grid, logo)
    new = cut([_fine(r) for r in target if r[4] > VISIBLE], grid, logo)

    # 3. Pair the old cells with the new ones. Rigid groups first.
    pairs, s_left, d_left = _rigid_groups(old, new)

    # Only the cells the rigid groups left over take part from here on:
    # a cell splits off, or slides into, one of these and no other.
    rest_old = _centers(old, s_left)
    rest_new = _centers(new, d_left)

    # The rest pair by a minimum-cost one-to-one assignment: the smaller
    # side is matched in full. The smaller side's cells are the rows (the
    # old cells, when both sides have as many), and the pairs are made in
    # the order of the rows.
    penalty2 = settings.role_penalty * settings.role_penalty
    if rest_old and rest_new:
        flip = len(rest_old) > len(rest_new)
        rows, columns = (rest_new, rest_old) if flip else (rest_old, rest_new)
        cost = _costs(rows, columns, penalty2)
        used_s = set()
        used_d = set()
        for r, c in enumerate(assign(cost)):
            # An assignment that lands on a banned pair is dropped.
            if cost[r][c] >= _BANNED:
                continue
            si, di = (columns[c][5], rows[r][5]) if flip else (rows[r][5], columns[c][5])
            pairs.append((si, di, False))
            used_s.add(si)
            used_d.add(di)
        s_left = [si for si in s_left if si not in used_s]
        d_left = [di for di in d_left if di not in used_d]

    center_x, center_y = settings.center
    stagger = settings.stagger
    reach2 = settings.split_reach * settings.split_reach

    def delay_of(cell):
        # 4. A pair starts late by its delay: the distance from the center
        #    of its new rect to the morph's center, divided by 260 and
        #    capped at 1, times stagger.
        dx = cell[0] + cell[2] / 2.0 - center_x
        dy = cell[1] + cell[3] / 2.0 - center_y
        return min(1.0, math.sqrt(dx * dx + dy * dy) / 260.0) * stagger

    # A rigid pair's delay is stagger / 4. While the morph runs, a pair's
    # rect has the role of its new cell.
    moves = []
    for si, di, rigid in pairs:
        b = new[di]
        moves.append((
            old[si][:5], b[:5], b[5],
            stagger / 4.0 if rigid else delay_of(b), False,
        ))

    # New cells with no partner split off their nearest old cell (they
    # start as a copy of it, with the new cell's role) when it is within
    # splitReach, and otherwise grow from their own center.
    for di in d_left:
        b = new[di]
        index, d2 = _nearest(b, rest_old, penalty2)
        if index is not None and d2 < reach2:
            moves.append((old[index][:5], b[:5], b[5], delay_of(b), False))
        else:
            moves.append((None, b[:5], b[5], delay_of(b), True))

    # Old cells with no partner slide into their nearest new cell with
    # opacity going to 0, taking its role, when it is within splitReach.
    # Otherwise they shrink to nothing at their own center, and since
    # their new rect has no size, their delay is their old rect's.
    for si in s_left:
        a = old[si]
        index, d2 = _nearest(a, rest_new, penalty2)
        if index is not None and d2 < reach2:
            b = new[index]
            moves.append((a[:5], (b[0], b[1], b[2], b[3], 0.0), b[5], delay_of(b), False))
        else:
            cx = a[0] + a[2] / 2.0
            cy = a[1] + a[3] / 2.0
            moves.append((a[:5], (cx, cy, 0.0, 0.0, 0.0), a[5], delay_of(a), False))

    return Plan(moves, settings)
