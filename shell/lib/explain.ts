// Explanations for the Generate section: what the chosen family or example is, what each setting
// does, and its current value. The text follows every change in the section.
import type { BreakOptions } from './breakRules.ts';
import { relationTypeNames, type DecorateOptions } from './decorate.ts';
import { FAMILIES, paramLabel, type Family } from './generate.ts';

export interface Explained {
  heading: string;
  text: string;
  /** Settings with their current values. */
  items?: { name: string; value: string; text: string }[];
}

// What each family is, how many relations it makes, and what each parameter does. The names come from FAMILIES.
const FAMILY: Record<Family, { text: string; params: Record<string, string> }> = {
  path: {
    text: 'Units in a row, each related to the next: n − 1 relations. Exactly one path joins two units, and the ends lie furthest apart.',
    params: { n: 'The number of units, at least 2.' },
  },
  cycle: {
    text: 'Units in a ring, each related to the two beside it: n relations. Two paths join any two units, one each way round.',
    params: { n: 'The number of units, at least 3.' },
  },
  star: {
    text: 'One centre related to every other unit: n − 1 relations. Every path between two leaves runs through the centre.',
    params: { n: 'The number of units, the centre included, at least 2.' },
  },
  complete: {
    text: 'Every unit related to every other: n(n − 1)/2 relations. The number of paths between two units grows very fast with n.',
    params: { n: 'The number of units, from 2 to 200.' },
  },
  grid: {
    text: 'Units in rows and columns, each related to its neighbours left, right, above and below: rows × (columns − 1) + columns × (rows − 1) relations. Shortest paths come in many equal choices.',
    params: { rows: 'The number of rows.', columns: 'The number of columns.' },
  },
  tree: {
    text: 'Unit i joins unit ⌊(i − 2)/b⌋ + 1, so each unit has up to b children: n − 1 relations. Exactly one path joins any two units.',
    params: { n: 'The number of units, at least 2.', b: 'The most children a unit has, at least 1.' },
  },
  components: {
    text: 'c paths of k units with no relation between them: c × (k − 1) relations. Some units cannot reach others.',
    params: { c: 'The number of components.', k: 'The number of units in each component, at least 2.' },
  },
  'random-size': {
    text: 'n units split into c parts. Each part gets a random spanning tree, then random relations inside the parts until there are m relations.',
    params: {
      n: 'The number of units, at least 2c.',
      m: 'The number of relations, from n − c up to every pair inside the parts.',
      c: 'The number of parts, which never connect.',
    },
  },
  'random-degrees': {
    text: 'Each unit asks for a number of relations. Their ends pair at random: at most half the sum of the degrees relations. Loops and repeats are dropped, so a unit can end with fewer; a unit left alone joins a random other unit.',
    params: { degrees: 'The relations each unit asks for, in key order, separated by commas.' },
  },
  'small-world': {
    text: 'The Watts–Strogatz model: a ring where each unit relates to its k nearest neighbours, n × k/2 relations; then each relation moves to a random unit with chance β. Few steps join any two units, and neighbours share neighbours.',
    params: {
      n: 'The number of units, more than k.',
      k: 'The relations each unit starts with: its nearest neighbours on the ring, an even number.',
      beta: 'The chance that a relation moves, from 0 (a regular ring) to 1 (all random).',
    },
  },
  preferential: {
    text: 'The Barabási–Albert model: starts from a complete graph of m₀ + 1 units. Each new unit relates to m₀ existing units, chosen in proportion to the relations they have: m₀(m₀ + 1)/2 + (n − m₀ − 1) × m₀ relations, a few hubs and many leaves.',
    params: { n: 'The number of units, at least m₀ + 1.', m0: 'The relations each new unit makes, at least 1.' },
  },
  communities: {
    text: 'n units in g groups. Two units of one group relate with chance p-in; units of different groups with chance p-out. On average p-in times the pairs inside the groups plus p-out times the pairs between them make relations; a unit left alone joins a unit of its group.',
    params: {
      n: 'The number of units, at least 2g and at most 5,000.',
      g: 'The number of groups, at least 1.',
      pIn: 'The chance of a relation inside a group, from 0 to 1.',
      pOut: 'The chance of a relation between groups, from 0 to 1.',
    },
  },
};

/** The family an example belongs to, where it belongs to one. */
const EXAMPLE_FAMILY: Record<string, string> = {
  pair: 'It is the smallest path, and the smallest complete graph.',
  'path-4': 'It belongs to the family Path.',
  triangle: 'It is the smallest cycle, and a complete graph of three.',
  'cycle-5': 'It belongs to the family Cycle.',
  'cycle-6': 'It belongs to the family Cycle.',
  'star-6': 'It belongs to the family Star.',
  'complete-4': 'It belongs to the family Complete.',
  'complete-9': 'It belongs to the family Complete.',
  'grid-3x3': 'It belongs to the family Grid.',
  'two-pairs': 'It belongs to the family Separate components.',
  'text-keys': 'It belongs to the family Cycle: nine units in a ring, keyed by numbers and texts that look alike.',
  superseded: 'It belongs to no generator family: six units and seven relations, with cycles of four and one leaf.',
  petersen: 'It belongs to no generator family: every unit has three relations, and the shortest cycle has five units.',
  sample:
    'It is close to the family Tree: a hierarchy of parts, with a few relations across it and hubs with many leaves.',
  'random-10k': 'It is close to the family Random by size: a random spanning tree plus random relations.',
  'classes-and-perspectives':
    'It belongs to no generator family: an invented family whose relations all run through interfaces, with classes and pair types.',
};

const familyName = (f: Family) => FAMILIES.find((x) => x.id === f)?.name ?? f;

export function explainFamily(family: Family, params: Record<string, string>, seed: number): Explained[] {
  const f = FAMILY[family];
  return [
    { heading: `Family: ${familyName(family)}`, text: f.text },
    {
      heading: 'Parameters',
      text: 'Each setting with its current value.',
      items: [
        ...Object.entries(params).map(([key, value]) => ({
          name: paramLabel(family, key),
          value,
          text: f.params[key] ?? '',
        })),
        {
          name: 'seed',
          value: String(seed),
          text: 'The seed of the random numbers: the same family, parameters and seed give the same graph.',
        },
      ],
    },
  ];
}

export function explainExample(id: string, name: string, description: string, units: number | null): Explained[] {
  const group = id.startsWith('broken-')
    ? 'It breaks a rule on purpose, so that its issues show.'
    : id.startsWith('load-error-')
      ? 'The viewer refuses this file: it shows what a refused file looks like.'
      : (EXAMPLE_FAMILY[id] ?? '');
  return [
    {
      heading: `Example: ${name}`,
      text: [description, units === null ? '' : `${units.toLocaleString('en')} units.`, group]
        .filter(Boolean)
        .join(' '),
    },
  ];
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export function explainInterfaces(share: number): Explained {
  const heading = 'Relations through interfaces';
  if (!(share > 0)) return { heading, text: 'Off: every relation joins its two units directly.' };
  return {
    heading,
    text: 'A share of the relations, drawn from the seed, gets an interface between its two units: a unit drawn as a disc divided between their colours. Each keypair of the relation becomes two, one to the interface and one from it, with the same attributes. The other relations stay direct.',
    items: [
      {
        name: 'share',
        value: String(share),
        text: '1 puts every relation through an interface, 0.5 about half of them, 0 none.',
      },
    ],
  };
}

export function explainDecoration(on: boolean, o: DecorateOptions): Explained {
  if (!on)
    return {
      heading: 'Types, weights and times',
      text: 'Off: the graph keeps only the types, weights and times it brings.',
    };
  const last = relationTypeNames(Math.max(0, Math.round(o.relationTypes) - 1));
  return {
    heading: 'Types, weights and times',
    text: 'On: what the graph lacks is added at random, from the seed. What it brings stays.',
    items: [
      {
        name: 'unit types',
        value: String(o.unitTypes),
        text: `Units without a type get one of type_1 to type_${o.unitTypes}.`,
      },
      {
        name: 'relation types',
        value: String(o.relationTypes),
        text: `Relations without a type get one of rel_ab … ${last[0]}; the keypair back gets the complement, rel_ba … ${last[1]}.`,
      },
      {
        name: 'weights',
        value: `${o.weights[0]} to ${o.weights[1]}`,
        text: 'Keypairs without a weight get one in this range.',
      },
      {
        name: 'times',
        value: `${day(o.times[0])} to ${day(o.times[1])}`,
        text: "Units without a time get a date in this range; a keypair's date is no earlier than its units'.",
      },
    ],
  };
}

export function explainBreaks(b: BreakOptions): Explained | null {
  const items = [
    {
      name: 'drop reverse',
      value: String(b.dropReverse),
      text: 'The share of relations, 0 to 1, that lose one keypair.',
    },
    {
      name: 'unknown keys',
      value: String(b.unknownKeys),
      text: 'Keypairs added that name a unit that does not exist.',
    },
    { name: 'repeated rows', value: String(b.repeatRows), text: 'Rows repeated, units and keypairs in turn.' },
    { name: 'lone units', value: String(b.loneUnits), text: 'Units added without any relation.' },
  ].filter((i) => Number(i.value) > 0);
  if (!items.length) return null;
  return {
    heading: 'Break the rules',
    text: 'The graph breaks rules on purpose; the issues panel lists each breach.',
    items,
  };
}
