// The look: the theme and its colour tokens (4.6), the types' palette (6.6), and the panels' text (9.2).
import { tokens, type TokenName } from '../../core/index.ts';
import { BACKWARD_TINT, MAX_TYPES, TYPE_PALETTE } from '../defaults.ts';
import {
  ColourSetting,
  NumberSetting,
  PaletteSetting,
  SelectSetting,
  SliderSetting,
  TextSetting,
  ThemeColourSetting,
} from '../setting.svelte.ts';

const WEIGHTS = [
  ['400', 'Regular'],
  ['600', 'Semibold'],
  ['700', 'Bold'],
] as const;

/** One theme colour setting for a token, with the words of 4.6. */
const token = <K extends string>(key: K, name: TokenName, description: string) =>
  new ThemeColourSetting({
    key,
    group: 'Theme',
    label: `Colour ${name}`,
    description,
    default: { light: tokens.light[name], dark: tokens.dark[name] },
  });

export const themeSettings = () =>
  [
    new SelectSetting({
      key: 'theme.scheme',
      group: 'Theme',
      label: 'Colours',
      description: 'Light or dark colours, or those the system asks for.',
      default: 'system',
      options: [
        ['system', 'As the system'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ],
    }),
    token(
      'theme.colours.surface',
      'surface',
      'The canvas, label halos, the ring around units and the cut of interfaces.',
    ),
    token('theme.colours.plane', 'plane', 'The page behind the panels.'),
    token('theme.colours.panel', 'panel', 'Side panels, the bar and form controls.'),
    token('theme.colours.ink-1', 'ink-1', 'Main text, focus outlines, forced labels and the outline of marked units.'),
    token('theme.colours.ink-2', 'ink-2', 'Secondary text, and labels that are not forced.'),
    token('theme.colours.muted', 'muted', 'Notes, hints and disabled buttons.'),
    token('theme.colours.hairline', 'hairline', 'Borders, dividers and slider tracks; never a mark.'),
    token('theme.colours.ring', 'ring', 'Lines below the weight threshold.'),
    token('theme.colours.context', 'context', 'Lines, and units and keypairs without a type.'),
    token('theme.colours.outgoing', 'outgoing', 'The CSS property --gv-outgoing, for hosts and their panels.'),
    token('theme.colours.incoming', 'incoming', 'The CSS property --gv-incoming, for hosts and their panels.'),
    token('theme.colours.path', 'path', 'The active path’s lines, and the glow of its units.'),
    token('theme.colours.issue', 'issue', 'Dashes of missing keypairs, the issue icon and the rule banner.'),
  ] as const;

export const typeSettings = () =>
  [
    new PaletteSetting({
      key: 'types.palette',
      group: 'Types',
      label: 'Palette',
      description:
        'Colours of unit types by frequency, and of keypair types by pair. Every type is named, as some colours fall below 3 to 1.',
      default: { light: [...TYPE_PALETTE.light], dark: [...TYPE_PALETTE.dark] },
      most: MAX_TYPES - 1,
    }),
    new ColourSetting({
      key: 'types.otherColour',
      group: 'Types',
      label: 'Colour past the palette',
      description: 'Colour of types past the palette, and of units and keypairs without a type.',
      default: 'context',
    }),
    new SliderSetting({
      key: 'types.backwardTint',
      group: 'Types',
      label: 'Complement tint',
      description: 'How far a complement’s colour moves from its forward type’s colour toward the surface.',
      default: BACKWARD_TINT,
      min: 0,
      max: 1,
      step: 0.01,
    }),
    new NumberSetting({
      key: 'types.slots',
      group: 'Types',
      label: 'Palette slots',
      description: 'Colour slots per kind in the shaders; the last slot serves every further type.',
      default: MAX_TYPES,
      min: 8,
      max: 128,
      whole: true,
      applies: 'load',
    }),
  ] as const;

export const textSettings = () =>
  [
    new TextSetting({
      key: 'typography.family',
      group: 'Text',
      label: 'Typeface',
      description: 'The fonts of panels and graph labels, as a CSS font list.',
      default: "'Atkinson Hyperlegible Next', system-ui, sans-serif",
      pattern: /\S/,
      asks: 'A CSS font list',
    }),
    new SliderSetting({
      key: 'typography.size',
      group: 'Text',
      label: 'Text size',
      description: 'Text of panels and controls.',
      default: 14,
      min: 11,
      max: 22,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'typography.lineHeight',
      group: 'Text',
      label: 'Line height',
      description: 'Line height of panel text, as a share of its size.',
      default: 1.4,
      min: 1,
      max: 2,
      step: 0.05,
    }),
    new SliderSetting({
      key: 'typography.sectionHeading.size',
      group: 'Text',
      label: 'Section headings',
      description: 'Size of the headings of sections that open and close.',
      default: 15,
      min: 11,
      max: 24,
      step: 1,
      unit: 'px',
    }),
    new SelectSetting({
      key: 'typography.sectionHeading.weight',
      group: 'Text',
      label: 'Section headings, weight',
      description: 'Weight of the headings of sections.',
      default: '600',
      options: WEIGHTS,
    }),
    new SliderSetting({
      key: 'typography.panelHeading.size',
      group: 'Text',
      label: 'Panel subheadings',
      description: 'Size of subheadings inside panels.',
      default: 13,
      min: 11,
      max: 22,
      step: 1,
      unit: 'px',
    }),
    new SelectSetting({
      key: 'typography.panelHeading.weight',
      group: 'Text',
      label: 'Panel subheadings, weight',
      description: 'Weight of subheadings inside panels.',
      default: '600',
      options: WEIGHTS,
    }),
    new SliderSetting({
      key: 'typography.minorHeading.size',
      group: 'Text',
      label: 'Minor headings',
      description: 'Size of column headings in the inspector.',
      default: 13,
      min: 11,
      max: 22,
      step: 1,
      unit: 'px',
    }),
    new SelectSetting({
      key: 'typography.minorHeading.weight',
      group: 'Text',
      label: 'Minor headings, weight',
      description: 'Weight of column headings in the inspector.',
      default: '600',
      options: WEIGHTS,
    }),
    new SliderSetting({
      key: 'typography.note',
      group: 'Text',
      label: 'Notes',
      description: 'Size of notes, counts and the canvas hint.',
      default: 12,
      min: 11,
      max: 20,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'typography.table',
      group: 'Text',
      label: 'Tables',
      description: 'Size of the path table and the keypair types table.',
      default: 13,
      min: 11,
      max: 20,
      step: 1,
      unit: 'px',
    }),
    new SelectSetting({
      key: 'typography.numbers',
      group: 'Text',
      label: 'Figures',
      description: 'Figures in counts and keys keep one width when tabular.',
      default: 'tabular-nums',
      options: [
        ['tabular-nums', 'Tabular'],
        ['normal', 'Proportional'],
      ],
    }),
  ] as const;
