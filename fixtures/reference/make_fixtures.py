"""Write graphview's shared test graphs and their expected results.

Run from the repository root:  python3 fixtures/reference/make_fixtures.py
It rewrites fixtures/graphs/, fixtures/expected/ and fixtures/MANIFEST.sha256.
Only the design side runs this script. Claude Code never runs it to change
expected results; it reads the files and matches them.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
import graphview_reference as R  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GRAPHS = os.path.join(ROOT, "fixtures", "graphs")
EXPECTED = os.path.join(ROOT, "fixtures", "expected")
SHOW_PATHS_UP_TO = 20   # list the paths themselves when a length has at most this many


def relation_rows(pairs, attrs=None):
    rows = []
    for a, b in pairs:
        rows.append({"from": a, "to": b})
        rows.append({"from": b, "to": a})
    return rows


def graph_doc(name, keys, pairs, description, labels=None, pos=None, extra_meta=None):
    vertices = []
    for k in keys:
        v = {"key": k}
        if labels and k in labels:
            v["label"] = labels[k]
        if pos and k in pos:
            v["pos"] = {"x": pos[k][0], "y": pos[k][1]}
        vertices.append(v)
    meta = {"name": name, "description": description}
    if extra_meta:
        meta.update(extra_meta)
    return {"format": R.FORMAT, "meta": meta, "vertices": vertices, "edges": relation_rows(pairs)}


# ------------------------------------------------------------- the graphs

def fixtures():
    F = {}

    F["pair"] = graph_doc("Pair", [1, 2], [(1, 2)],
        "The smallest valid graph: two units, one relation.",
        pos={1: (0, 0), 2: (400, 0)})

    F["path-4"] = graph_doc("Path of four", [1, 2, 3, 4], [(1, 2), (2, 3), (3, 4)],
        "Four units in a row.", labels={1: "A", 2: "B", 3: "C", 4: "D"},
        pos={1: (0, 0), 2: (100, 0), 3: (200, 0), 4: (300, 0)})

    F["triangle"] = graph_doc("Triangle", [1, 2, 3], [(1, 2), (2, 3), (3, 1)],
        "The smallest odd cycle.",
        pos={1: (0, 0), 2: (200, 0), 3: (100, 173.2)})

    F["cycle-5"] = graph_doc("Cycle of five", [1, 2, 3, 4, 5],
        [(1, 2), (2, 3), (3, 4), (4, 5), (5, 1)], "An odd cycle: paths of both parities.")

    F["cycle-6"] = graph_doc("Cycle of six", [1, 2, 3, 4, 5, 6],
        [(1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 1)],
        "An even cycle: every path between two units has the parity of the shortest.")

    F["star-6"] = graph_doc("Star of six", [1, 2, 3, 4, 5, 6],
        [(1, k) for k in range(2, 7)], "One centre with five leaves.")

    F["complete-4"] = graph_doc("Complete graph of four", [1, 2, 3, 4],
        [(a, b) for a in range(1, 5) for b in range(a + 1, 5)], "Every unit related to every other.")

    F["two-pairs"] = graph_doc("Two separate pairs", [1, 2, 3, 4], [(1, 2), (3, 4)],
        "Obeys every rule, yet unit 1 cannot reach unit 3: two components.")

    grid = [(r * 3 + c + 1, r * 3 + c + 2) for r in range(3) for c in range(2)]
    grid += [(r * 3 + c + 1, (r + 1) * 3 + c + 1) for r in range(2) for c in range(3)]
    F["grid-3x3"] = graph_doc("Grid of three by three", list(range(1, 10)), grid,
        "A bipartite grid: several shortest paths, never one step longer.",
        pos={r * 3 + c + 1: (c * 100, r * 100) for r in range(3) for c in range(3)})

    pet = [(i, (i + 1) % 5) for i in range(5)] + [(i, i + 5) for i in range(5)] \
        + [(5 + i, 5 + (i + 2) % 5) for i in range(5)]
    F["petersen"] = graph_doc("Petersen graph", list(range(10)), pet,
        "Ten units, fifteen relations, three relations per unit, shortest cycle of five.")

    F["complete-9"] = graph_doc("Complete graph of nine", list(range(1, 10)),
        [(a, b) for a in range(1, 10) for b in range(a + 1, 10)],
        "Its 13,700 paths between two units exceed the default counting limit.")

    tk = [1, "1", "I", "l", "O", "0", "é", "ﬀ", "\U0001F600"]
    F["text-keys"] = graph_doc("Keys that look alike", tk,
        [(tk[i], tk[(i + 1) % len(tk)]) for i in range(len(tk))],
        "Number 1 and text \"1\" are different units. Code-point order matters "
        "for the fingerprint: U+1F600 sorts after U+FB00.",
        labels={1: "one (number)", "1": "one (text)"})

    # superseded: rule 5 keeps everything; the current graph hides the superseded part
    sup = graph_doc("Superseded parts", [1, 2, 3, 4, 5, 6],
        [(1, 2), (2, 3), (3, 4), (2, 5), (5, 4), (1, 4), (6, 1)],
        "Units 3 and 6 and the relation between 1 and 4 are superseded.")
    for v in sup["vertices"]:
        if v["key"] in (3, 6):
            v["superseded"] = True
    for e in sup["edges"]:
        if {e["from"], e["to"]} == {1, 4}:
            e["superseded"] = True
    F["superseded"] = sup

    # the database graph of 24 July 2026
    F["database-2026-07-24"] = database_graph()

    # a random graph for speed: 10,000 units, 25,000 relations, connected
    F["random-10k"] = random_graph(10000, 25000, seed=20261014)

    # ------------------------------------------------------- broken graphs
    def broken(name, desc, vertices, edges, meta_extra=None):
        meta = {"name": name, "description": desc}
        if meta_extra:
            meta.update(meta_extra)
        return {"format": R.FORMAT, "meta": meta, "vertices": vertices, "edges": edges}

    V = lambda *ks: [{"key": k} for k in ks]  # noqa: E731
    E = lambda *ps: [{"from": a, "to": b} for a, b in ps]  # noqa: E731

    F["broken-missing-reverse"] = broken("Missing reverse",
        "The keypair from 2 to 3 has no reverse.", V(1, 2, 3), E((1, 2), (2, 1), (2, 3)))
    F["broken-loop"] = broken("Loop", "A keypair from a unit to itself.",
        V(1, 2), E((1, 2), (2, 1), (1, 1)))
    F["broken-repeated-keypair"] = broken("Repeated keypair", "The keypair from 1 to 2 occurs twice.",
        V(1, 2), E((1, 2), (2, 1), (1, 2)))
    F["broken-unknown-unit"] = broken("Unknown unit", "Two keypairs name unit 9, which does not exist.",
        V(1, 2), E((1, 2), (2, 1), (2, 9), (9, 2)))
    F["broken-repeated-key"] = broken("Repeated key", "Key 2 occurs twice.",
        V(1, 2, 2), E((1, 2), (2, 1)))
    F["broken-orphan"] = broken("Orphan unit", "Unit 3 takes part in no relation.",
        V(1, 2, 3), E((1, 2), (2, 1)))
    F["broken-bad-rows"] = broken("Bad rows", "Rows that cannot be read.",
        [{"key": 1}, {"key": 2}, {"label": "no key"}, {"key": True}, {"key": 1.5}, {"key": ""},
         "not an object", {"key": [3]}],
        [{"from": 1, "to": 2}, {"from": 2, "to": 1}, {"from": 1}, {"from": 1, "to": [2]},
         {"from": None, "to": 2}])
    F["broken-mixed"] = broken("Mixed issues", "Several issues at once, and a wrong fingerprint.",
        V(1, 2, 3, 4, 5, 4),
        E((1, 2), (2, 1), (2, 3), (3, 3), (3, 4), (4, 3), (4, 8), (3, 4)),
        meta_extra={"fingerprint": "sha256:" + "0" * 64})

    # files the module must refuse as a whole
    F["load-error-not-object"] = [{"format": R.FORMAT}]
    F["load-error-format"] = {"format": "graphview-graph/2", "vertices": [], "edges": []}
    F["load-error-vertices"] = {"format": R.FORMAT, "vertices": {"key": 1}, "edges": []}
    F["load-error-edges"] = {"format": R.FORMAT, "vertices": [{"key": 1}]}
    return F


def database_graph():
    """The sample graph, as given: 81 units and 168 keypairs, with neutral labels, unit
    types type_<n>, complementary keypair types rel_ab and rel_ba and so on, and weights."""
    here = os.path.dirname(__file__)
    src = json.load(open(os.path.join(here, "database-2026-07-24.source.json"), encoding="utf-8"))
    return src


def random_graph(n, m, seed):
    rnd = random.Random(seed)
    keys = list(range(n))
    pairs = set()
    order = keys[:]
    rnd.shuffle(order)
    for i in range(1, n):                      # random spanning tree: connected, no orphans
        a, b = order[i], order[rnd.randrange(i)]
        pairs.add((min(a, b), max(a, b)))
    while len(pairs) < m:
        a, b = rnd.randrange(n), rnd.randrange(n)
        if a != b:
            pairs.add((min(a, b), max(a, b)))
    pairs = sorted(pairs)
    rnd.shuffle(pairs)
    pos = {k: (round(rnd.uniform(0, 1000), 1), round(rnd.uniform(0, 1000), 1)) for k in keys}
    return graph_doc("Random graph of 10,000 units", keys, pairs,
        "Connected: a random spanning tree plus random relations, seed %d. "
        "Positions are random and serve speed tests only." % seed,
        pos=pos, extra_meta={"seed": seed})


# ------------------------------------------------------------- expected results

def summarise_paths(g, s, t, extra, count_limit=10000, list_limit=200, graph="stored"):
    ps = R.path_set(g, s, t, extra, count_limit, list_limit)
    out = {"from": s, "to": t, "extra": extra, "countLimit": count_limit, "listLimit": list_limit,
           "graph": graph, "shortest": ps["shortest"], "reason": ps["reason"],
           "stopped": ps["stopped"], "total": ps.get("total", 0), "lengths": []}
    for item in ps["lengths"]:
        entry = {"length": item["length"], "count": item["count"], "exact": item["exact"]}
        if item["exact"] and item["count"] <= SHOW_PATHS_UP_TO:
            entry["paths"] = item["listed"]
        out["lengths"].append(entry)
    return out


def ring_entry(g, focus, graph="stored", sizes_only=False):
    rs, beyond = R.rings(g, focus)
    if sizes_only:
        return {"focus": focus, "graph": graph, "ringSizes": [len(r) for r in rs], "beyond": len(beyond)}
    return {"focus": focus, "graph": graph, "rings": rs, "beyond": beyond}


def degree_list(g):
    d = R.degrees(g)
    return [dict({"key": k}, **d[R.key_id(k)]) for k in g["units"]]


PLAN = {
    "pair": {"rings": [1], "paths": [(1, 2, 3)]},
    "path-4": {"rings": [1, 2], "paths": [(1, 4, 2), (4, 1, 0)]},
    "triangle": {"rings": [1], "paths": [(1, 2, 2)]},
    "cycle-5": {"rings": [1], "paths": [(1, 3, 3), (1, 2, 4)]},
    "cycle-6": {"rings": [1], "paths": [(1, 4, 2), (1, 2, 5)]},
    "star-6": {"rings": [1, 2], "paths": [(2, 3, 2)]},
    "complete-4": {"rings": [1], "paths": [(1, 2, 2)]},
    "two-pairs": {"rings": [1, 3], "paths": [(1, 3, 2), (1, 2, 1)]},
    "grid-3x3": {"rings": [1, 5], "paths": [(1, 9, 2), (1, 5, 1)]},
    "petersen": {"rings": [0], "paths": [(0, 2, 2), (0, 7, 3)]},
    "complete-9": {"rings": [1], "paths": [(1, 2, 7), (1, 2, 7, 20000)]},
    "text-keys": {"rings": [1, "😀"], "paths": [(1, "1", 8), ("l", "ﬀ", 5)]},
    "database-2026-07-24": {"rings": [1, 79, 100000], "paths": [(79, 77, 4), (1, 100000, 2), (76, 80, 2)]},
    "broken-missing-reverse": {"rings": [1, 3], "paths": [(1, 3, 1), (3, 1, 1)]},
}


def expected_for(name, doc):
    try:
        g = R.load(doc)
    except R.LoadError as exc:
        return {"fixture": name, "load": "refused", "code": exc.code, "reason": str(exc)}
    cur = R.current(g)
    exp = {
        "fixture": name,
        "load": "ok",
        "counts": {"units": len(g["units"]), "keypairs": len(g["keypairs"]),
                   "relations": R.relation_count(g)},
        "fingerprint": {"stored": R.fingerprint(g), "current": R.fingerprint(cur)},
        "issues": g["issues"],
        "components": {"stored": R.components(g), "current": R.components(cur)},
    }
    if name == "random-10k":
        exp["rings"] = [ring_entry(g, 0, sizes_only=True)]
        exp["paths"] = [summarise_paths(g, a, b, 2) for a, b in ((0, 1), (17, 4242))]
        return exp
    exp["degrees"] = degree_list(g)
    plan = PLAN.get(name)
    if plan:
        exp["rings"] = [ring_entry(g, f) for f in plan["rings"]]
        exp["paths"] = []
        for item in plan["paths"]:
            s, t, extra = item[:3]
            limit = item[3] if len(item) > 3 else 10000
            exp["paths"].append(summarise_paths(g, s, t, extra, count_limit=limit))
    if name == "superseded":
        exp["rings"] = [ring_entry(g, 1), ring_entry(cur, 1, graph="current")]
        exp["paths"] = [summarise_paths(g, 1, 4, 2), summarise_paths(cur, 1, 4, 2, graph="current")]
        exp["counts"]["current"] = {"units": len(cur["units"]), "keypairs": len(cur["keypairs"]),
                                    "relations": R.relation_count(cur)}
    if name == "database-2026-07-24":
        units = g["units"]
        pairs = one = 0
        for i in range(len(units)):
            for j in range(i + 1, len(units)):
                pairs += 1
                ps = R.path_set(g, units[i], units[j], 2)
                if ps["total"] == 1:
                    one += 1
        exp["summary"] = {"unorderedPairs": pairs, "pairsWithExactlyOnePathWithinTwoExtraSteps": one}
    return exp


def write_json(path, obj, compact=False):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")


def main():
    os.makedirs(GRAPHS, exist_ok=True)
    os.makedirs(EXPECTED, exist_ok=True)
    index = []
    for name, doc in fixtures().items():
        compact = name == "random-10k"
        write_json(os.path.join(GRAPHS, name + ".json"), doc, compact=compact)
        exp = expected_for(name, doc)
        write_json(os.path.join(EXPECTED, name + ".json"), exp)
        index.append({"fixture": name, "load": exp["load"],
                      "units": exp.get("counts", {}).get("units"),
                      "issues": len(exp.get("issues", [])),
                      "fingerprint": exp.get("fingerprint", {}).get("stored")})
    write_json(os.path.join(ROOT, "fixtures", "index.json"), index)
    lines = []
    for base, _dirs, files in os.walk(os.path.join(ROOT, "fixtures")):
        for f in files:
            p = os.path.join(base, f)
            rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
            if rel == "fixtures/MANIFEST.sha256" or "__pycache__" in rel:
                continue
            lines.append("%s  %s" % (hashlib.sha256(open(p, "rb").read()).hexdigest(), rel))
    with open(os.path.join(ROOT, "fixtures", "MANIFEST.sha256"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(sorted(lines, key=lambda s: s.split("  ", 1)[1])) + "\n")
    print("wrote", len(index), "fixtures")


if __name__ == "__main__":
    main()
