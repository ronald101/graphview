// Gates G9 (generators part) and G10: generated graphs are deterministic, obey rules 1 to 4,
// and have the characteristics asked.
import { describe, expect, test } from 'vitest';
import * as core from '../../module/core';
import { FAMILIES, generate, type Family, type Params } from '../../shell/lib/generate.ts';
import { breakRules, NO_BREAKS } from '../../shell/lib/breakRules.ts';
import { mulberry32 } from '../../shell/lib/random.ts';

const SEEDS = 200;

/** Parameters for one seed, and the characteristics they promise (null where random). */
function sample(
  family: Family,
  seed: number,
): { params: Params; units: number; relations: number | null; parts: number | null } {
  const r = mulberry32(seed * 7919 + 13);
  const int = (lo: number, hi: number) => lo + r.below(hi - lo + 1);
  switch (family) {
    case 'path': {
      const n = int(2, 40);
      return { params: { n }, units: n, relations: n - 1, parts: 1 };
    }
    case 'cycle': {
      const n = int(3, 40);
      return { params: { n }, units: n, relations: n, parts: 1 };
    }
    case 'star': {
      const n = int(2, 40);
      return { params: { n }, units: n, relations: n - 1, parts: 1 };
    }
    case 'complete': {
      const n = int(2, 25);
      return { params: { n }, units: n, relations: (n * (n - 1)) / 2, parts: 1 };
    }
    case 'grid': {
      const rows = int(1, 8);
      const columns = int(rows === 1 ? 2 : 1, 8);
      return {
        params: { rows, columns },
        units: rows * columns,
        relations: rows * (columns - 1) + columns * (rows - 1),
        parts: 1,
      };
    }
    case 'tree': {
      const n = int(2, 60);
      return { params: { n, b: int(1, 4) }, units: n, relations: n - 1, parts: 1 };
    }
    case 'components': {
      const c = int(1, 6);
      const k = int(2, 8);
      return { params: { c, k }, units: c * k, relations: c * (k - 1), parts: c };
    }
    case 'random-size': {
      const c = int(1, 5);
      const n = int(2 * c, 60);
      let most = 0;
      for (let p = 0; p < c; p++) {
        const s = Math.floor(n / c) + (p < n % c ? 1 : 0);
        most += (s * (s - 1)) / 2;
      }
      const m = int(n - c, most);
      return { params: { n, m, c }, units: n, relations: m, parts: c };
    }
    case 'random-degrees': {
      const degrees = Array.from({ length: int(2, 30) }, () => int(0, 6));
      return { params: { degrees }, units: degrees.length, relations: null, parts: null };
    }
    case 'small-world': {
      const k = 2 * int(1, 3);
      const n = int(k + 1, 60);
      return { params: { n, k, beta: r.next() }, units: n, relations: (n * k) / 2, parts: null };
    }
    case 'preferential': {
      const m0 = int(1, 4);
      const n = int(m0 + 1, 60);
      return { params: { n, m0 }, units: n, relations: (m0 * (m0 + 1)) / 2 + (n - m0 - 1) * m0, parts: 1 };
    }
    case 'communities': {
      const g = int(1, 5);
      const n = int(2 * g, 60);
      return { params: { n, g, pIn: r.next(), pOut: r.next() * 0.1 }, units: n, relations: null, parts: null };
    }
  }
}

describe('G10 every family gives graphs without issues and with the characteristics asked', () => {
  for (const { id } of FAMILIES) {
    test(`G10 ${id}, ${SEEDS} seeds`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const want = sample(id, seed);
        const { doc } = generate(id, want.params, seed);
        const loaded = core.loadGraph(doc);
        expect(loaded.ok, `${id} seed ${seed}`).toBe(true);
        if (!loaded.ok) return;
        expect(loaded.issues, `${id} seed ${seed} issues`).toEqual([]);
        expect(loaded.graph.units, `${id} seed ${seed} keys`).toEqual(
          Array.from({ length: want.units }, (_, i) => i + 1),
        );
        if (want.relations !== null)
          expect(core.relationCount(loaded.graph), `${id} seed ${seed} relations`).toBe(want.relations);
        if (want.parts !== null)
          expect(core.components(loaded.graph).sizes.length, `${id} seed ${seed} parts`).toBe(want.parts);
        const order = doc.edges.map((e) => e.from * 1e6 + e.to);
        expect(order, `${id} seed ${seed} row order`).toEqual([...order].sort((a, b) => a - b));
        expect(doc.meta).toMatchObject({ generator: 'graphview-gen/1', family: id, seed });
      }
    });
  }

  test('G10 random by degrees reports the degrees reached', () => {
    const { doc, reached } = generate('random-degrees', { degrees: [3, 3, 2, 2, 2, 1, 1] }, 5);
    const loaded = core.loadGraph(doc);
    if (!loaded.ok) throw new Error('refused');
    expect(reached).toEqual(core.degrees(loaded.graph).map((d) => d.relations));
  });

  test('G10 parameters outside their range are refused with a reason', () => {
    expect(() => generate('complete', { n: 201 }, 1)).toThrow('between 2 and 200');
    expect(() => generate('cycle', { n: 2 }, 1)).toThrow('at least 3');
    expect(() => generate('random-size', { n: 10, m: 3, c: 2 }, 1)).toThrow('m must lie between');
    expect(() => generate('small-world', { n: 10, k: 3, beta: 0.1 }, 1)).toThrow('even');
  });
});

describe('G9 generators are deterministic', () => {
  for (const { id } of FAMILIES) {
    test(`G9 ${id}: the same seed gives the same fingerprint`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const { params } = sample(id, seed);
        const a = core.loadGraph(generate(id, params, seed).doc);
        const b = core.loadGraph(generate(id, params, seed).doc);
        if (!a.ok || !b.ok) throw new Error('refused');
        expect(core.fingerprint(a.graph)).toBe(core.fingerprint(b.graph));
      }
    });
  }

  test('G9 the generator output for fixed seeds never changes', () => {
    // Pinned fingerprints: a change here breaks "graphview-gen/1".
    const fp = (family: Family, params: Params, seed: number) => {
      const r = core.loadGraph(generate(family, params, seed).doc);
      if (!r.ok) throw new Error('refused');
      return core.fingerprint(r.graph);
    };
    expect(fp('random-size', { n: 30, m: 40, c: 2 }, 1)).toBe(PINNED.randomSize);
    expect(fp('small-world', { n: 30, k: 4, beta: 0.1 }, 1)).toBe(PINNED.smallWorld);
    expect(fp('communities', { n: 40, g: 4, pIn: 0.3, pOut: 0.02 }, 1)).toBe(PINNED.communities);
  });

  test('G9 another seed gives another random graph', () => {
    const a = core.loadGraph(generate('random-size', { n: 30, m: 40, c: 2 }, 1).doc);
    const b = core.loadGraph(generate('random-size', { n: 30, m: 40, c: 2 }, 2).doc);
    if (!a.ok || !b.ok) throw new Error('refused');
    expect(core.fingerprint(a.graph) === core.fingerprint(b.graph)).toBe(false);
  });
});

describe('breaking the rules on purpose', () => {
  test('each option produces its issue, and the graph is marked "not Rosetta data"', () => {
    const { doc } = generate('path', { n: 10 }, 1);
    for (let seed = 1; seed <= 50; seed++) {
      const broken = breakRules(doc, { dropReverse: 0.5, unknownKeys: 2, repeatRows: 3, loneUnits: 3 }, seed);
      expect(broken.meta.rosetta).toBe(false);
      const r = core.loadGraph(broken);
      if (!r.ok) throw new Error('refused');
      const count = (code: string) => r.issues.filter((i) => i.code === code).length;
      expect(count('missing-reverse'), `seed ${seed}`).toBe(5);
      expect(count('unknown-unit'), `seed ${seed}`).toBe(2);
      expect(count('repeated-key'), `seed ${seed}`).toBe(2);
      expect(count('repeated-keypair'), `seed ${seed}`).toBe(1);
      expect(count('orphan'), `seed ${seed}`).toBe(3);
    }
  });
  test('no options leave the graph as it was', () => {
    const { doc } = generate('path', { n: 4 }, 1);
    expect(breakRules(doc, NO_BREAKS, 1)).toBe(doc);
  });
});

const PINNED = {
  randomSize: 'sha256:e981602ee4fefd9cf650a0ab1345e9f7a410879abd21fc9a078b48a955c53eda',
  smallWorld: 'sha256:a38138e1dfe3b865bacd2d4620298ff51d0310cdb10e02ceb21268cef8fa60a0',
  communities: 'sha256:368eff6dc7964443b2d1cbf5815ebc434103f9240b00b52149c72ea199352e7b',
};
