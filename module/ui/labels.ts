// Label placement (specification V19): labels show where they fit, never closer than 2 pixels.

export interface LabelCandidate {
  index: number;
  x: number;
  y: number;
  r: number;
  text: string;
  forced: boolean;
}

export interface PlacedLabel {
  index: number;
  box: { x: number; y: number; w: number; h: number };
}

export const LABEL_GAP = 2;
export const LABEL_HEIGHT = 16;
const CELL = 64;

/** Greedy placement in candidate order: forced labels first, then the rest where they fit. */
export function placeLabels(
  candidates: LabelCandidate[],
  measure: (text: string) => number,
  width: number,
  height: number,
  limit = 400,
  obstacles: { x: number; y: number; w: number; h: number; owner?: number }[] = [],
): PlacedLabel[] {
  const grid = new Map<string, { x: number; y: number; w: number; h: number }[]>();
  const placed: PlacedLabel[] = [];
  const cells = (b: { x: number; y: number; w: number; h: number }) => {
    const out: string[] = [];
    for (let i = Math.floor((b.x - LABEL_GAP) / CELL); i <= Math.floor((b.x + b.w + LABEL_GAP) / CELL); i++) {
      for (let j = Math.floor((b.y - LABEL_GAP) / CELL); j <= Math.floor((b.y + b.h + LABEL_GAP) / CELL); j++)
        out.push(`${i},${j}`);
    }
    return out;
  };
  const clashes = (b: { x: number; y: number; w: number; h: number }, self = -1) => {
    for (const c of cells(b)) {
      for (const o of grid.get(c) ?? []) {
        if ((o as { owner?: number }).owner === self) continue;
        if (
          b.x < o.x + o.w + LABEL_GAP &&
          o.x < b.x + b.w + LABEL_GAP &&
          b.y < o.y + o.h + LABEL_GAP &&
          o.y < b.y + b.h + LABEL_GAP
        )
          return true;
      }
    }
    return false;
  };
  const add = (index: number, b: { x: number; y: number; w: number; h: number }) => {
    for (const c of cells(b)) {
      if (!grid.has(c)) grid.set(c, []);
      grid.get(c)!.push(b);
    }
    placed.push({ index, box: b });
  };
  // Units and controls are obstacles too: a label never covers another unit's circle.
  for (const o of obstacles) {
    for (const c of cells(o)) {
      if (!grid.has(c)) grid.set(c, []);
      grid.get(c)!.push(o);
    }
  }
  const ordered = [...candidates.filter((c) => c.forced), ...candidates.filter((c) => !c.forced)];
  for (const c of ordered) {
    if (!c.forced && placed.length >= limit) break;
    const w = Math.ceil(measure(c.text));
    // Right of the unit first, then left.
    const options = [
      { x: c.x + c.r + 4, y: c.y - LABEL_HEIGHT / 2, w, h: LABEL_HEIGHT },
      { x: c.x - c.r - 4 - w, y: c.y - LABEL_HEIGHT / 2, w, h: LABEL_HEIGHT },
      { x: c.x - w / 2, y: c.y + c.r + 3, w, h: LABEL_HEIGHT },
      { x: c.x - w / 2, y: c.y - c.r - 3 - LABEL_HEIGHT, w, h: LABEL_HEIGHT },
    ];
    let done = false;
    for (const b of options) {
      if (!c.forced && (b.x < 0 || b.y < 0 || b.x + b.w > width || b.y + b.h > height)) continue;
      if (clashes(b, c.index)) continue;
      add(c.index, b);
      done = true;
      break;
    }
    // A forced label that cannot fit still shows; the others give way to it (they come later).
    if (!done && c.forced) add(c.index, options[0]);
  }
  return placed;
}
