// The relation drawings (specification 6.18): by keypairs, or by perspectives, with the shapes and
// labels the perspective drawing gives class units and interfaces.
import { CheckboxSetting, SelectSetting, TextSetting } from '../setting.svelte.ts';

const SHAPE = /^[\w-]+$/;

export const drawingSettings = () =>
  [
    new SelectSetting({
      key: 'drawing.relations',
      group: 'Drawing',
      label: 'Relations',
      description:
        'Draw each keypair as a chevron, or each relation through an interface as its two perspectives, each chevron pointing at the unit whose perspective it is.',
      default: 'keypairs',
      options: [
        ['keypairs', 'Keypairs'],
        ['perspectives', 'Perspectives'],
      ],
    }),
    new TextSetting({
      key: 'drawing.classShape',
      group: 'Drawing',
      label: 'Class unit shape',
      description: 'The shape of a class unit in the perspective drawing: a shape the unit shader holds.',
      default: 'box',
      pattern: SHAPE,
      asks: 'The name of a shape, such as box',
    }),
    new TextSetting({
      key: 'drawing.interfaceShape',
      group: 'Drawing',
      label: 'Interface shape',
      description: 'The shape of an interface in the perspective drawing: a shape the unit shader holds.',
      default: 'oval',
      pattern: SHAPE,
      asks: 'The name of a shape, such as oval',
    }),
    new CheckboxSetting({
      key: 'drawing.classLabels',
      group: 'Drawing',
      label: 'Interfaces named by class',
      description: 'In the perspective drawing, an interface’s label is its class when it has one.',
      default: true,
    }),
  ] as const;
