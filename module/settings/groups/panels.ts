// Panels, words and output (7, 6.14, 6.15) and the engine (6.2, 6.16): what the viewer shows beside the
// picture, in which words, and how it draws and saves the picture.
import { PATH_CLOCK } from '../../core/index.ts';
import { LABEL_CELL } from '../defaults.ts';
import { CANVAS_NAME, HINT_TEXTS, ISSUE_TEMPLATES, LIVE_TEMPLATES, REFUSAL_TEXTS } from '../words.ts';
import {
  CheckboxSetting,
  JsonSetting,
  NumberSetting,
  OrderSetting,
  SelectSetting,
  SetSetting,
  SliderSetting,
  TextSetting,
} from '../setting.svelte.ts';

/** The side bar's sections (7.9), in their order. */
export const SECTIONS = [
  ['search', 'Search'],
  ['scope', 'Scope'],
  ['root', 'Root and depth'],
  ['paths', 'Paths'],
  ['inspector', 'Inspector'],
  ['highlights', 'Highlights'],
  ['filters', 'Filters'],
  ['types', 'Types'],
  ['display', 'Display'],
  ['issues', 'Data issues'],
  ['pinned', 'Pinned settings'],
] as const;
export type SectionId = (typeof SECTIONS)[number][0];

/** The bar's controls (7.9). */
export const BAR = [
  ['modes', '2D and 3D'],
  ['hulls', 'Hulls'],
  ['fit', 'Fit'],
  ['drawing', 'Drawing'],
  ['search', 'Search field'],
  ['select', 'Box selection'],
  ['panels', 'Panels'],
  ['settings', 'Settings'],
] as const;

const texts = (v: unknown) =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');
const MAP = 'Names, each with its text, such as {"orphan": "…"}; {braces} stand for values';
const css = /^[\d.\s]+(px|em|rem)?(\s+[\d.]+(px|em|rem)?){0,3}$/;

export const panelSettings = () =>
  [
    new OrderSetting({
      key: 'panels.sections',
      group: 'Panels',
      label: 'Sections',
      description: 'The side bar’s sections, in their order.',
      default: SECTIONS.map(([s]) => s),
      items: SECTIONS,
    }),
    new SetSetting({
      key: 'panels.open',
      group: 'Panels',
      label: 'Open at the start',
      description: 'The sections that start open.',
      default: SECTIONS.map(([s]) => s).filter((s) => s !== 'display'),
      items: SECTIONS,
    }),
    new SliderSetting({
      key: 'panels.width',
      group: 'Panels',
      label: 'Side bar width',
      description: 'Width of the side bar.',
      default: 340,
      min: 200,
      max: 800,
      step: 10,
      unit: 'px',
    }),
    new SetSetting({
      key: 'panels.bar',
      group: 'Panels',
      label: 'Bar',
      description: 'The controls the bar above the canvas shows.',
      default: BAR.map(([b]) => b),
      items: BAR,
    }),
    new CheckboxSetting({
      key: 'panels.inspector.hideTypeField',
      group: 'Panels',
      label: 'Type field among the type',
      description: 'The inspector shows the type field once, as the type, and not again among the other fields.',
      default: true,
    }),
    new SelectSetting({
      key: 'panels.inspector.typeValue',
      group: 'Panels',
      label: 'Type’s own value',
      description: 'When the inspector shows a type’s value beside its name.',
      default: 'when-renamed',
      options: [
        ['when-renamed', 'When renamed'],
        ['always', 'Always'],
        ['never', 'Never'],
      ],
    }),
    new SliderSetting({
      key: 'panels.style.radius',
      group: 'Panels',
      label: 'Corner radius',
      description: 'Corner radius of buttons, fields and menus.',
      default: 4,
      min: 0,
      max: 16,
      step: 1,
      unit: 'px',
    }),
    new TextSetting({
      key: 'panels.style.controlPadding',
      group: 'Panels',
      label: 'Button padding',
      description: 'Padding inside buttons, as CSS writes it.',
      default: '3px 10px',
      pattern: css,
      asks: 'One to four lengths, such as 3px 10px',
    }),
    new TextSetting({
      key: 'panels.style.sectionPadding',
      group: 'Panels',
      label: 'Section heading padding',
      description: 'Padding of section headings, as CSS writes it.',
      default: '10px 16px',
      pattern: css,
      asks: 'One to four lengths, such as 10px 16px',
    }),
    new SliderSetting({
      key: 'panels.style.swatch.width',
      group: 'Panels',
      label: 'Swatch width',
      description: 'Width of a type’s colour swatch.',
      default: 26,
      min: 12,
      max: 60,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'panels.style.swatch.height',
      group: 'Panels',
      label: 'Swatch height',
      description: 'Height of a type’s colour swatch.',
      default: 22,
      min: 12,
      max: 60,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'panels.style.sliderThumb',
      group: 'Panels',
      label: 'Slider knob',
      description: 'Size of the knobs of two-knob sliders.',
      default: 16,
      min: 10,
      max: 32,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'panels.style.sliderTrack',
      group: 'Panels',
      label: 'Slider track',
      description: 'Height of the track of two-knob sliders.',
      default: 4,
      min: 1,
      max: 12,
      step: 1,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'panels.style.disabledOpacity',
      group: 'Panels',
      label: 'Disabled opacity',
      description: 'Opacity of a slider that cannot be used.',
      default: 0.45,
      min: 0.1,
      max: 1,
      step: 0.05,
    }),
  ] as const;

export const wordSettings = () =>
  [
    new TextSetting({
      key: 'words.locale',
      group: 'Words',
      label: 'Number language',
      description: 'The language whose way of writing numbers counts use, as a tag such as en or nl.',
      default: 'en',
      pattern: /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
      asks: 'A language tag, such as en or nl-NL',
    }),
    new JsonSetting<'words.issues', Record<string, string>>({
      key: 'words.issues',
      group: 'Words',
      label: 'Issues',
      description:
        'The words of each issue; {row}, {list}, {key}, {from}, {to}, {unit}, {ends}, {a} and {b} stand for its parts.',
      default: ISSUE_TEMPLATES,
      test: texts,
      asks: MAP,
    }),
    new JsonSetting<'words.live', Record<string, string>>({
      key: 'words.live',
      group: 'Words',
      label: 'Live region',
      description: 'What the live region says after each change.',
      default: LIVE_TEMPLATES,
      test: texts,
      asks: MAP,
    }),
    new JsonSetting<'words.refusals', Record<string, string>>({
      key: 'words.refusals',
      group: 'Words',
      label: 'Refusals',
      description: 'What the canvas says about a file it refuses, by the refusal’s code.',
      default: REFUSAL_TEXTS,
      test: texts,
      asks: MAP,
    }),
    new TextSetting({
      key: 'words.canvasName',
      group: 'Words',
      label: 'Canvas name',
      description: 'The canvas’s accessible name; {mode}, {units} and {relations} stand for its state.',
      default: CANVAS_NAME,
    }),
    new JsonSetting<'words.hint', Record<string, string>>({
      key: 'words.hint',
      group: 'Words',
      label: 'Canvas hint',
      description: 'The line of help at the foot of the canvas, in 2D and in 3D, and what follows in both.',
      default: HINT_TEXTS,
      test: texts,
      asks: MAP,
    }),
    new JsonSetting<'words.panels', Record<string, string>>({
      key: 'words.panels',
      group: 'Words',
      label: 'Panel texts',
      description: 'Other words for the panels’ texts: each text as the viewer writes it, with its replacement.',
      default: {},
      test: texts,
      asks: 'Texts, each with its replacement, such as {"Reset": "Herstel"}',
    }),
  ] as const;

export const pictureSettings = () =>
  [
    new CheckboxSetting({
      key: 'picture.background',
      group: 'Picture',
      label: 'Background',
      description: 'Save picture keeps the canvas’s background; without it the picture is transparent.',
      default: true,
    }),
    new CheckboxSetting({
      key: 'picture.labels',
      group: 'Picture',
      label: 'Labels',
      description: 'Save picture keeps the labels.',
      default: true,
    }),
    new SelectSetting({
      key: 'picture.format',
      group: 'Picture',
      label: 'Format',
      description: 'The image format Save picture writes.',
      default: 'image/png',
      options: [
        ['image/png', 'PNG'],
        ['image/jpeg', 'JPEG'],
        ['image/webp', 'WebP'],
      ],
    }),
    new SliderSetting({
      key: 'picture.scale',
      group: 'Picture',
      label: 'Scale',
      description: 'Save picture draws at this factor of the canvas’s pixels.',
      default: 1,
      min: 0.25,
      max: 4,
      step: 0.25,
    }),
  ] as const;

export const rendererSettings = () =>
  [
    new NumberSetting<'renderer.pixelRatio', number | null>({
      key: 'renderer.pixelRatio',
      group: 'Renderer',
      label: 'Pixel ratio',
      description: 'Pixels drawn per CSS pixel.',
      default: null,
      min: 0.25,
      max: 4,
      step: 0.25,
      none: 'the device’s own',
    }),
    new CheckboxSetting({
      key: 'renderer.antialias',
      group: 'Renderer',
      label: 'Smooth edges',
      description: 'The renderer smooths the edges of what it draws.',
      default: true,
    }),
    new CheckboxSetting({
      key: 'renderer.alpha',
      group: 'Renderer',
      label: 'Transparent canvas',
      description: 'The canvas can be transparent, for pictures without background.',
      default: true,
    }),
    new CheckboxSetting({
      key: 'renderer.preserveDrawingBuffer',
      group: 'Renderer',
      label: 'Keep the frame',
      description: 'The renderer keeps each frame, so that the picture can be read at any time.',
      default: true,
    }),
    new SliderSetting({
      key: 'renderer.cullBelow',
      group: 'Renderer',
      label: 'Skip below',
      description: 'Marks fainter than this are not drawn at all.',
      default: 0.002,
      min: 0,
      max: 0.1,
      step: 0.001,
    }),
    new SliderSetting({
      key: 'renderer.discardBelow',
      group: 'Renderer',
      label: 'Drop pixels below',
      description: 'Pixels fainter than this are dropped.',
      default: 0.004,
      min: 0,
      max: 0.1,
      step: 0.001,
    }),
    new OrderSetting({
      key: 'renderer.drawOrder',
      group: 'Renderer',
      label: 'Draw order',
      description: 'The order in which the layers draw, the last on top.',
      default: ['hulls', 'lines', 'chevrons', 'units'],
      items: [
        ['hulls', 'Hulls'],
        ['lines', 'Lines'],
        ['chevrons', 'Chevrons'],
        ['units', 'Units'],
      ],
      all: true,
    }),
  ] as const;

export const speedSettings = () =>
  [
    new SelectSetting({
      key: 'performance.workers',
      group: 'Speed',
      label: 'Workers',
      description: 'Layout, distances and paths run in background workers, or on the page.',
      default: 'auto',
      options: [
        ['auto', 'In workers where possible'],
        ['off', 'On the page'],
      ],
      applies: 'load',
    }),
    new NumberSetting({
      key: 'performance.pathClockEvery',
      group: 'Speed',
      label: 'Path clock',
      description: 'The path search looks at the clock every this many steps.',
      default: PATH_CLOCK,
      min: 1,
      max: 1048576,
      whole: true,
    }),
    new SliderSetting({
      key: 'performance.labelGridCell',
      group: 'Speed',
      label: 'Label grid',
      description: 'Cell size of the grid that finds clashing labels.',
      default: LABEL_CELL,
      min: 8,
      max: 512,
      step: 8,
      unit: 'px',
    }),
    new SliderSetting({
      key: 'performance.pickBoxMargin',
      group: 'Speed',
      label: 'Pick box margin',
      description: 'A line is only tested for a click within its box on screen widened by this.',
      default: 40,
      min: 0,
      max: 400,
      step: 5,
      unit: 'px',
    }),
  ] as const;
