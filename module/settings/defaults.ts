// The defaults that have a name of their own (D86): the settings take them as their defaults, and the
// modules that used them first export them still. Every other default is written in its setting.

// ---------------------------------------------------------------- types (6.6)

/** The shaders' palettes have this many slots; the last one serves types past the palette. */
export const MAX_TYPES = 64;
export const OTHER = MAX_TYPES - 1;

/** Categorical type colours: the validated order of the data-visualisation palette, red left out for issues. */
export const TYPE_PALETTE = {
  light: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6'],
  dark: ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9'],
} as const;

/** How far a backward keypair type's colour moves toward the surface: same hue, other direction. */
export const BACKWARD_TINT = 0.42;

// ---------------------------------------------------------------- reading the data (6.6)

/** The fields that may name a type, in the order they are tried. */
export const TYPE_NAMES = ['type', 'kind', 'category', 'archetype', 'group', 'class'];
/** Numeric fields with these names hold times, in any case. */
export const TIME_NAMES = '^(time|timestamp|date|created|updated|at|when|created_at|updated_at)$';
/** Texts that start like this hold dates. */
export const DATE_PATTERN = '^\\d{4}-\\d{2}(-\\d{2})?';

// ---------------------------------------------------------------- layout (6.1)

/** The layout spans this many world units across. */
export const EXTENT = 1000;
/** The distance between neighbouring units at the start of the force layout, in graph coordinates. */
export const STEP = 100;

// ---------------------------------------------------------------- depth (6.4, 6.5)

/** The distance between depth planes, in world units; the layout spans 1000. */
export const SPACING = 300;
/** The global foreground offset: the z of the active path (specification 6.4). */
export const FOREGROUND = 0;

export const DEPTH_RULES = {
  second: { scale: 0.6, opacity: 0.6 },
  far: { scale: 0.25, opacity: 0.15 },
  path: { scale: 1.2, opacity: 1, glow: 1 },
  dimmed: 0.05,
  /** Deepest plane, in steps of the depth spacing. */
  maxPlanes: 6,
} as const;

// ---------------------------------------------------------------- the picture (6.2, 6.9, 6.12, 6.13)

/** The chevrons' places along a relation's line, as a share of its length from its first unit. */
export const CHEVRON_AT = { forward: 1 / 3, backward: 2 / 3 } as const;
/** Chevrons are hidden on lines shorter than this many chevron sizes on screen. */
export const CHEVRON_ROOM = 1.5;
/** Superseded units and relations draw at this share of their opacity. */
export const SUPERSEDED = 0.35;

/** Graphs with more units start without hulls; the switch can still turn them on. */
export const HULL_LIMIT = 3000;
/** Same-type units closer than this many median relation lengths share a hull. */
export const HULL_REACH = 1;
/** Each hull member widens by this on every axis, in world units. */
export const HULL_PAD = 18;

/** Labels show for units at least this opaque, at most this many candidates at a time. */
export const LABEL_OPACITY = 0.35;
export const LABEL_LIMIT = 300;
export const LABEL_GAP = 2;
export const LABEL_HEIGHT = 16;
/** The most labels placed at a time, forced ones aside. */
export const LABEL_MOST = 400;
/** Space between a unit and its label beside it, and above or below it, in pixels. */
export const LABEL_SIDE = 4;
export const LABEL_VERTICAL = 3;
/** Cell size of the grid that finds clashing labels, in pixels. */
export const LABEL_CELL = 64;

// ---------------------------------------------------------------- behaviour (6.5, 6.8, 9.4)

/** Path sets: the shortest paths and those one and two steps longer (specification 6.5). */
export const EXTRA_STEPS = 2;
export const DEFAULT_OVERRIDES = { size: 1, width: 1, opacity: 1 } as const;
/** How long a change moves, in milliseconds. */
export const DURATION = 450;

// ---------------------------------------------------------------- pointer (6.11)

/** Hit padding in pixels around what is drawn. */
export const HIT = { unit: 3, chevron: 4, line: 6 } as const;
/** The least radius a unit answers clicks in, in pixels, by plane: deeper units are smaller, so they get more. */
export const UNIT_REACH = [6, 8, 10, 12] as const;
