// Unit shapes. A shape says how far a point of the unit's quad lies from its centre, 1 at its edge,
// and may change the fill colour there. The unit shader draws the edge, the separating ring, the
// outline and the glow along that measure, so every shape gets them. Each unit carries the slot
// of its shape; the shader holds every shape registered here. A shape may read the unit's two
// colours, vColor and vColor2, the direction vSplit between its two ends, the surface colour, and
// the cut's width and strength (uCut) and colour (uCutColour) of the settings.

export interface UnitShape {
  name: string;
  /** GLSL statements over `vec2 uv` and `inout vec3 col` that return the measure. */
  glsl: string;
}

export const UNIT_SHAPES: UnitShape[] = [
  { name: 'disc', glsl: 'return length(uv);' },
  {
    // A disc cut across the line between its two ends: each half in the colour of the end on its
    // side, with a thin line between them.
    name: 'divided',
    glsl: `float s = dot(uv, vSplit);
    float w = max(fwidth(s), 1e-4);
    col = mix(vColor, vColor2, smoothstep(-w, w, s));
    col = mix(col, uCutColour, (1.0 - smoothstep(uCut.x - w, uCut.x + w, abs(s))) * uCut.y);
    return length(uv);`,
  },
  // A square with rounded corners, for class units in the perspective drawing (6.18).
  { name: 'box', glsl: 'vec2 q = abs(uv); return pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25);' },
  // A disc twice as wide as high, for interfaces in the perspective drawing (6.18).
  { name: 'oval', glsl: 'return length(vec2(uv.x, 2.0 * uv.y));' },
];

/** The value of a unit's shape attribute: the slot of its shape, or the first shape's for an unknown one. */
export function shapeSlot(name: string, shapes: readonly UnitShape[] = UNIT_SHAPES): number {
  return Math.max(
    0,
    shapes.findIndex((s) => s.name === name),
  );
}

/** The GLSL function unitShape(shape, uv, col), with one branch for each shape. */
export function shapesGlsl(shapes: readonly UnitShape[] = UNIT_SHAPES): string {
  const branches = shapes.map((s, i) => `  if (shape < ${i}.5) {\n    ${s.glsl}\n  }`).join('\n');
  return `float unitShape(float shape, vec2 uv, inout vec3 col) {\n${branches}\n  return length(uv);\n}`;
}
