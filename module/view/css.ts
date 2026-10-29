// The CSS custom properties of the view (specification 5.9): the colour tokens of the theme in use, and
// the text, panel and focus settings. GraphView sets them on its root; a host that lays out the panels
// itself sets them on its own.
import { cssVariables } from '../core/index.ts';
import type { GraphModel } from '../model/model.ts';

export function viewCss(m: GraphModel): string {
  const s = m.settings;
  const vars: Record<string, string | number> = {
    font: s.get('typography.family'),
    text: `${s.get('typography.size')}px`,
    leading: s.get('typography.lineHeight'),
    'h2-size': `${s.get('typography.sectionHeading.size')}px`,
    'h2-weight': s.get('typography.sectionHeading.weight'),
    'h3-size': `${s.get('typography.panelHeading.size')}px`,
    'h3-weight': s.get('typography.panelHeading.weight'),
    'h4-size': `${s.get('typography.minorHeading.size')}px`,
    'h4-weight': s.get('typography.minorHeading.weight'),
    note: `${s.get('typography.note')}px`,
    table: `${s.get('typography.table')}px`,
    figures: s.get('typography.numbers'),
    radius: `${s.get('panels.style.radius')}px`,
    'control-pad': s.get('panels.style.controlPadding'),
    'section-pad': s.get('panels.style.sectionPadding'),
    'swatch-w': `${s.get('panels.style.swatch.width')}px`,
    'swatch-h': `${s.get('panels.style.swatch.height')}px`,
    thumb: `${s.get('panels.style.sliderThumb')}px`,
    track: `${s.get('panels.style.sliderTrack')}px`,
    disabled: s.get('panels.style.disabledOpacity'),
    'focus-w': `${s.get('accessibility.focusOutline.width')}px`,
    'focus-off': `${s.get('accessibility.focusOutline.offset')}px`,
    focus: m.colour(s.get('accessibility.focusOutline.colour')),
    turn: `${s.get('motion.sectionToggle')}s`,
    'issue-icon': `${s.get('issues.iconSize')}px`,
    'panels-width': `${s.get('panels.width')}px`,
  };
  const own = Object.entries(vars)
    .map(([k, v]) => `--gv-${k}: ${v};`)
    .join(' ');
  return `${cssVariables(m.theme, m.colours())} ${own}`;
}
