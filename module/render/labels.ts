// Label placement (specification 6.12): labels show where they fit, never closer than the gap.
import { LABEL_CELL, LABEL_GAP, LABEL_HEIGHT, LABEL_MOST, LABEL_SIDE, LABEL_VERTICAL } from '../settings/defaults.ts';

export { LABEL_GAP, LABEL_HEIGHT };

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

export type LabelPosition = 'right' | 'left' | 'below' | 'above';

/** How labels are placed: the settings of the group "Labels", and the grid of the group "Speed". */
export interface LabelPlacement {
  gap: number;
  height: number;
  /** Space beside a unit, and above or below it. */
  side: number;
  vertical: number;
  positions: readonly LabelPosition[];
  cell: number;
}

export const LABEL_PLACEMENT: LabelPlacement = {
  gap: LABEL_GAP,
  height: LABEL_HEIGHT,
  side: LABEL_SIDE,
  vertical: LABEL_VERTICAL,
  positions: ['right', 'left', 'below', 'above'],
  cell: LABEL_CELL,
};

/** Greedy placement in candidate order: forced labels first, then the rest where they fit. */
export function placeLabels(
  candidates: LabelCandidate[],
  measure: (text: string) => number,
  width: number,
  height: number,
  limit = LABEL_MOST,
  obstacles: { x: number; y: number; w: number; h: number; owner?: number }[] = [],
  place: LabelPlacement = LABEL_PLACEMENT,
): PlacedLabel[] {
  const { gap, height: tall, cell } = place;
  const grid = new Map<string, { x: number; y: number; w: number; h: number }[]>();
  const placed: PlacedLabel[] = [];
  const cells = (b: { x: number; y: number; w: number; h: number }) => {
    const out: string[] = [];
    for (let i = Math.floor((b.x - gap) / cell); i <= Math.floor((b.x + b.w + gap) / cell); i++) {
      for (let j = Math.floor((b.y - gap) / cell); j <= Math.floor((b.y + b.h + gap) / cell); j++)
        out.push(`${i},${j}`);
    }
    return out;
  };
  const clashes = (b: { x: number; y: number; w: number; h: number }, self = -1) => {
    for (const c of cells(b)) {
      for (const o of grid.get(c) ?? []) {
        if ((o as { owner?: number }).owner === self) continue;
        if (b.x < o.x + o.w + gap && o.x < b.x + b.w + gap && b.y < o.y + o.h + gap && o.y < b.y + b.h + gap)
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
    // In the order of the places: right of the unit first, then left, below and above.
    const box: Record<LabelPosition, { x: number; y: number; w: number; h: number }> = {
      right: { x: c.x + c.r + place.side, y: c.y - tall / 2, w, h: tall },
      left: { x: c.x - c.r - place.side - w, y: c.y - tall / 2, w, h: tall },
      below: { x: c.x - w / 2, y: c.y + c.r + place.vertical, w, h: tall },
      above: { x: c.x - w / 2, y: c.y - c.r - place.vertical - tall, w, h: tall },
    };
    const options = place.positions.map((p) => box[p]);
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
