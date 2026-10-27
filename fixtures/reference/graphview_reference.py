"""Reference computation for graphview's shared test graphs.

Pure Python 3 standard library. It reads files in the graph format
"graphview-graph/1" and computes what the graphview module must also compute:
the data issues, the fingerprint, components, rings, degrees and path sets.
The module (TypeScript) must match its results.

The rules it applies are written out in docs/specifications.md, sections 2 to 4.
"""
from __future__ import annotations

import hashlib
import json
from collections import deque

FORMAT = "graphview-graph/1"
FP_HEADER = "graphview-fp/1"
MAX_SAFE = 2**53 - 1


# ---------------------------------------------------------------- keys

def key_ok(k) -> bool:
    """A key is a non-empty string without lone surrogates, or a safe integer."""
    if isinstance(k, bool):
        return False
    if isinstance(k, int):
        return -MAX_SAFE <= k <= MAX_SAFE
    if isinstance(k, float):
        return k.is_integer() and -MAX_SAFE <= k <= MAX_SAFE
    if isinstance(k, str):
        if k == "":
            return False
        return not any(0xD800 <= ord(c) <= 0xDFFF for c in k)
    return False


def norm_key(k):
    """JSON parsers may not tell 1.0 from 1, so an integral number is that integer."""
    if isinstance(k, float):
        return int(k)
    return k


def key_id(k) -> str:
    """Exact identity of a key: 1 and "1" are different keys."""
    return json.dumps(norm_key(k), ensure_ascii=False)


def key_json(k) -> str:
    return json.dumps(norm_key(k), ensure_ascii=False)


def codepoint_sorted(lines):
    """Sort by Unicode code points, as Python compares str (not UTF-16 units)."""
    return sorted(lines)


# ---------------------------------------------------------------- loading

class LoadError(Exception):
    """The whole file is refused. code is one of: not-object, format, vertices, edges."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def load(doc):
    """Return the stored graph with its issues, or raise LoadError.

    The result holds:
      units      list of keys, in file order (first valid occurrence)
      keypairs   list of (from, to), in file order (accepted rows only)
      labels     {key_id: label}
      superseded_units / superseded_keypairs  sets of key_ids / (id, id)
      issues     list of dicts, in the order of the checks below
    """
    if not isinstance(doc, dict):
        raise LoadError("not-object", "the file is not a JSON object")
    if doc.get("format") != FORMAT:
        raise LoadError("format", '"format" is not "%s"' % FORMAT)
    if not isinstance(doc.get("vertices"), list):
        raise LoadError("vertices", '"vertices" is not a list')
    if not isinstance(doc.get("edges"), list):
        raise LoadError("edges", '"edges" is not a list')

    issues = []
    units, unit_ids, labels, sup_units = [], set(), {}, set()
    for i, row in enumerate(doc["vertices"]):
        if not isinstance(row, dict) or "key" not in row:
            issues.append({"code": "bad-row", "list": "vertices", "row": i})
            continue
        k = row["key"]
        if not key_ok(k):
            issues.append({"code": "bad-key", "list": "vertices", "row": i})
            continue
        k = norm_key(k)
        kid = key_id(k)
        if kid in unit_ids:
            issues.append({"code": "repeated-key", "list": "vertices", "row": i, "key": k})
            continue
        unit_ids.add(kid)
        units.append(k)
        if isinstance(row.get("label"), str):
            labels[kid] = row["label"]
        if row.get("superseded") is True:
            sup_units.add(kid)

    keypairs, pair_ids, sup_pairs = [], set(), set()
    for j, row in enumerate(doc["edges"]):
        if not isinstance(row, dict) or "from" not in row or "to" not in row:
            issues.append({"code": "bad-row", "list": "edges", "row": j})
            continue
        a, b = row["from"], row["to"]
        if not (key_ok(a) and key_ok(b)):
            issues.append({"code": "bad-key", "list": "edges", "row": j})
            continue
        a, b = norm_key(a), norm_key(b)
        ia, ib = key_id(a), key_id(b)
        if ia == ib:
            issues.append({"code": "loop", "list": "edges", "row": j, "keypair": [a, b]})
            continue
        if ia not in unit_ids or ib not in unit_ids:
            issues.append({"code": "unknown-unit", "list": "edges", "row": j, "keypair": [a, b]})
            continue
        if (ia, ib) in pair_ids:
            issues.append({"code": "repeated-keypair", "list": "edges", "row": j, "keypair": [a, b]})
            continue
        pair_ids.add((ia, ib))
        keypairs.append((a, b))
        if row.get("superseded") is True:
            sup_pairs.add((ia, ib))

    for a, b in keypairs:
        if (key_id(b), key_id(a)) not in pair_ids:
            issues.append({"code": "missing-reverse", "keypair": [a, b]})

    touched = set()
    for a, b in keypairs:
        touched.add(key_id(a))
        touched.add(key_id(b))
    for k in units:
        if key_id(k) not in touched:
            issues.append({"code": "orphan", "key": k})

    meta = doc.get("meta") if isinstance(doc.get("meta"), dict) else {}
    g = {"units": units, "keypairs": keypairs, "labels": labels,
         "superseded_units": sup_units, "superseded_keypairs": sup_pairs}
    stated = meta.get("fingerprint")
    if isinstance(stated, str) and stated != fingerprint(g):
        issues.append({"code": "fingerprint-mismatch", "stated": stated})
    g["issues"] = issues
    return g


def current(g):
    """The current graph: the stored graph without superseded units and keypairs.

    A keypair goes too when either of its units is superseded."""
    su, sp = g["superseded_units"], g["superseded_keypairs"]
    units = [k for k in g["units"] if key_id(k) not in su]
    keypairs = [(a, b) for a, b in g["keypairs"]
                if (key_id(a), key_id(b)) not in sp
                and key_id(a) not in su and key_id(b) not in su]
    return {"units": units, "keypairs": keypairs, "labels": g["labels"],
            "superseded_units": set(), "superseded_keypairs": set(), "issues": []}


# ---------------------------------------------------------------- fingerprint

def fingerprint(g) -> str:
    lines = [FP_HEADER, "U %d" % len(g["units"])]
    lines += codepoint_sorted(key_json(k) for k in g["units"])
    lines.append("K %d" % len(g["keypairs"]))
    lines += codepoint_sorted(key_json(a) + "\t" + key_json(b) for a, b in g["keypairs"])
    text = "\n".join(lines) + "\n"
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------- aids

def out_neighbours(g):
    """Outgoing keypairs per unit, in file order of the keypairs."""
    nb = {key_id(k): [] for k in g["units"]}
    for a, b in g["keypairs"]:
        nb[key_id(a)].append(b)
    return nb


def degrees(g):
    """Per unit: relations (distinct neighbours either way), outgoing, incoming."""
    rel = {key_id(k): set() for k in g["units"]}
    out = {key_id(k): 0 for k in g["units"]}
    inc = {key_id(k): 0 for k in g["units"]}
    for a, b in g["keypairs"]:
        ia, ib = key_id(a), key_id(b)
        rel[ia].add(ib)
        rel[ib].add(ia)
        out[ia] += 1
        inc[ib] += 1
    return {k: {"relations": len(rel[k]), "outgoing": out[k], "incoming": inc[k]} for k in rel}


def relation_count(g):
    """Complete relations: unordered pairs whose two keypairs both exist."""
    ids = {(key_id(a), key_id(b)) for a, b in g["keypairs"]}
    return sum(1 for (x, y) in ids if (y, x) in ids) // 2


def components(g):
    """Parts of the graph, ignoring direction. Sizes, largest first."""
    parent = {key_id(k): key_id(k) for k in g["units"]}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in g["keypairs"]:
        ra, rb = find(key_id(a)), find(key_id(b))
        if ra != rb:
            parent[ra] = rb
    sizes = {}
    for k in g["units"]:
        r = find(key_id(k))
        sizes[r] = sizes.get(r, 0) + 1
    return sorted(sizes.values(), reverse=True)


def rings(g, focus):
    """Units by steps from the focus, following keypairs in their direction."""
    nb = out_neighbours(g)
    dist = {key_id(focus): 0}
    order = [focus]
    q = deque([focus])
    while q:
        u = q.popleft()
        for v in nb[key_id(u)]:
            if key_id(v) not in dist:
                dist[key_id(v)] = dist[key_id(u)] + 1
                order.append(v)
                q.append(v)
    depth = max(dist.values())
    result = [[] for _ in range(depth + 1)]
    for k in order:
        result[dist[key_id(k)]].append(k)
    beyond = [k for k in g["units"] if key_id(k) not in dist]
    return result, beyond


def distances_to(g, target):
    """Steps from every unit to the target, following keypairs in direction."""
    rev = {key_id(k): [] for k in g["units"]}
    for a, b in g["keypairs"]:
        rev[key_id(b)].append(a)
    dist = {key_id(target): 0}
    q = deque([target])
    while q:
        u = q.popleft()
        for v in rev[key_id(u)]:
            if key_id(v) not in dist:
                dist[key_id(v)] = dist[key_id(u)] + 1
                q.append(v)
    return dist


def path_set(g, s, t, extra, count_limit=10000, list_limit=200):
    """Simple paths from s to t, following keypairs in their direction.

    Lengths run from the shortest, d, up to d + extra. Lengths are finished in
    increasing order. Counting stops when the total reaches count_limit; the
    length being counted then is reported as "at least". Within a length, paths
    are found depth first, taking each unit's outgoing keypairs in file order.
    """
    if key_id(s) == key_id(t):
        return {"shortest": None, "reason": "same-unit", "lengths": [], "stopped": False}
    to_t = distances_to(g, t)
    if key_id(s) not in to_t:
        return {"shortest": None, "reason": "unreachable", "lengths": [], "stopped": False}
    d = to_t[key_id(s)]
    nb = out_neighbours(g)
    total = 0
    lengths = []
    stopped = False
    for L in range(d, d + extra + 1):
        found = []
        count = 0
        path = [s]
        on_path = {key_id(s)}

        def dfs(u, steps_left):
            nonlocal count, total, stopped
            if stopped:
                return
            if steps_left == 0:
                if key_id(u) == key_id(t):
                    count += 1
                    total += 1
                    if len(found) < list_limit:
                        found.append(list(path))
                    if total >= count_limit:
                        stopped = True
                return
            if key_id(u) == key_id(t):
                return
            for v in nb[key_id(u)]:
                iv = key_id(v)
                if iv in on_path:
                    continue
                dv = to_t.get(iv)
                if dv is None or dv > steps_left - 1:
                    continue
                on_path.add(iv)
                path.append(v)
                dfs(v, steps_left - 1)
                path.pop()
                on_path.discard(iv)
                if stopped:
                    return

        dfs(s, L)
        lengths.append({"length": L, "count": count, "exact": not stopped, "listed": found})
        if stopped:
            break
    return {"shortest": d, "reason": None, "lengths": lengths, "stopped": stopped, "total": total}


def brute_path_counts(g, s, t, max_len):
    """Slow cross-check: every simple path from s, no pruning."""
    nb = out_neighbours(g)
    counts = {}
    path = [s]
    seen = {key_id(s)}

    def go(u):
        if key_id(u) == key_id(t) and len(path) > 1:
            L = len(path) - 1
            counts[L] = counts.get(L, 0) + 1
            return
        if len(path) - 1 >= max_len:
            return
        for v in nb[key_id(u)]:
            if key_id(v) in seen:
                continue
            seen.add(key_id(v))
            path.append(v)
            go(v)
            path.pop()
            seen.discard(key_id(v))

    go(s)
    return counts
