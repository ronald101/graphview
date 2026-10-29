// The drawing rules: every number the shaders and the CPU's copy of their sums share, read from the
// settings once per change (specification 5.9), so that one value feeds every copy.
import type { Theme } from '../core/index.ts';
import type { DepthRules } from '../model/depth.ts';
import type { GraphModel } from '../model/model.ts';
import { CHEVRON_ROOM, SUPERSEDED } from '../settings/defaults.ts';

export { CHEVRON_ROOM, SUPERSEDED };

export type Easing = (t: number) => number;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const EASINGS: Record<string, Easing> = {
  linear: (t) => clamp01(t),
  'quad-out': (t) => 1 - Math.pow(1 - clamp01(t), 2),
  'cubic-out': (t) => 1 - Math.pow(1 - clamp01(t), 3),
  'quart-out': (t) => 1 - Math.pow(1 - clamp01(t), 4),
};

export interface DrawRules {
  depth: DepthRules;
  /** How a transition eases, and how long it lasts in milliseconds. */
  ease: Easing;
  duration: number;
  units: { radius: number; ring: [number, number]; outlineFrom: number; glow: [number, number]; cut: [number, number] };
  lines: {
    width: number;
    feather: number;
    /** Width gain by strength, width below the threshold, extra width on the path, opacity below the threshold. */
    gain: [number, number, number, number];
    brighten: number;
  };
  chevrons: {
    size: number;
    at: { forward: number; backward: number };
    /** Growth along the travel direction; opacity of the opposing chevron. */
    path: [number, number];
    room: number;
    fadeIn: number;
    /** Chevrons stay on lines below the weight threshold. */
    below: boolean;
    glyph: [number, number, number];
    glow: [number, number, number, number];
  };
  superseded: number;
  dash: [number, number];
  cull: number;
  discard: number;
  pointer: {
    reach: number[];
    drawnExtra: number;
    padding: { unit: number; chevron: number; line: number };
    lineExtra: number;
    capsule: { halfLength: number; radius: number };
    minOpacity: number;
    minFilter: number;
    priority: ('unit' | 'chevron' | 'line')[];
    boxMargin: number;
  };
}

/** The colours the shaders draw with, resolved for the theme. */
export interface DrawColours {
  surface: string;
  ring: string;
  outline: string;
  glow: string;
  cut: string;
  line: string;
  lineBelow: string;
  linePath: string;
  strength: string;
  issue: string;
}

export function drawRules(m: GraphModel): DrawRules {
  const s = m.settings;
  return {
    depth: m.depth,
    ease: EASINGS[s.get('motion.easing')] ?? EASINGS['cubic-out'],
    duration: s.get('motion.duration'),
    units: {
      radius: s.get('units.radius'),
      ring: [s.get('units.ring.at'), s.get('units.ring.strength')],
      outlineFrom: s.get('units.outline.from'),
      glow: [s.get('units.glow.extent'), s.get('units.glow.alpha')],
      cut: [s.get('units.divided.cutWidth'), s.get('units.divided.cutStrength')],
    },
    lines: {
      width: s.get('lines.width'),
      feather: s.get('lines.feather'),
      gain: [
        s.get('lines.strength.widthGain'),
        s.get('lines.below.width'),
        s.get('lines.path.widthGain'),
        s.get('lines.below.opacity'),
      ],
      brighten: s.get('lines.strength.brighten'),
    },
    chevrons: {
      size: s.get('chevrons.size'),
      at: { forward: s.get('chevrons.at.forward'), backward: s.get('chevrons.at.backward') },
      path: [s.get('chevrons.path.scaleGain'), s.get('chevrons.path.opposingOpacity')],
      room: s.get('chevrons.room'),
      fadeIn: s.get('chevrons.fadeIn'),
      below: s.get('lines.below.chevrons'),
      glyph: [s.get('chevrons.glyph.halfLength'), s.get('chevrons.glyph.halfSpread'), s.get('chevrons.glyph.stroke')],
      glow: [
        s.get('chevrons.glow.stroke'),
        s.get('chevrons.glow.whiten'),
        s.get('chevrons.glow.alpha'),
        s.get('chevrons.glow.extent'),
      ],
    },
    superseded: s.get('issues.supersededOpacity'),
    dash: [s.get('issues.missing.dash'), s.get('issues.missing.drawn')],
    cull: s.get('renderer.cullBelow'),
    discard: s.get('renderer.discardBelow'),
    pointer: {
      reach: s.get('pointer.unitReach'),
      drawnExtra: s.get('pointer.drawnExtra'),
      padding: {
        unit: s.get('pointer.padding.unit'),
        chevron: s.get('pointer.padding.chevron'),
        line: s.get('pointer.padding.line'),
      },
      lineExtra: s.get('pointer.lineExtra'),
      capsule: {
        halfLength: s.get('pointer.chevronCapsule.halfLength'),
        radius: s.get('pointer.chevronCapsule.radius'),
      },
      minOpacity: s.get('pointer.minOpacity'),
      minFilter: s.get('pointer.minFilter'),
      priority: s.get('pointer.priority'),
      boxMargin: s.get('performance.pickBoxMargin'),
    },
  };
}

export function drawColours(m: GraphModel, theme: Theme = m.theme): DrawColours {
  const s = m.settings;
  const c = (v: string) => m.colour(v, theme);
  return {
    surface: c('surface'),
    ring: c(s.get('units.ring.colour')),
    outline: c(s.get('units.outline.colour')),
    glow: c(s.get('units.glow.colour')),
    cut: c(s.get('units.divided.cutColour')),
    line: c(s.get('lines.colour')),
    lineBelow: c(s.get('lines.below.colour')),
    linePath: c(s.get('lines.path.colour')),
    strength: c(s.get('lines.strength.towards')),
    issue: c(s.get('issues.missing.colour')),
  };
}
