// The extension points that can live in JSON (specification 5.7): a profile and the kinds' looks. They
// take effect with the next graph; the host's own code profile and looks serve when they are empty.
import { isProfileJson, type ProfileJson } from '../profileJson.ts';
import { JsonSetting } from '../setting.svelte.ts';

/** How a kind of unit draws: its shape's name, and whether its units join hulls. */
export interface KindLook {
  shape: string;
  hulls: boolean;
}

const plain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const looks = (v: unknown) =>
  v === null ||
  (plain(v) && Object.values(v).every((l) => plain(l) && typeof l.shape === 'string' && typeof l.hulls === 'boolean'));

export const extensionSettings = () =>
  [
    new JsonSetting<'extensions.profile', ProfileJson | null>({
      key: 'extensions.profile',
      group: 'Extension points',
      label: 'Profile',
      description:
        'A profile as JSON: kinds by an attribute, classes, member pairs and pair types, superseding, and whether self-relations and direct relations are issues. Empty uses the host’s own profile.',
      default: null,
      test: (v) => v === null || isProfileJson(v),
      asks: 'A profile as JSON, such as {"directRelations": "issue"}, or null',
      applies: 'load',
    }),
    new JsonSetting<'extensions.looks', Record<string, KindLook> | null>({
      key: 'extensions.looks',
      group: 'Extension points',
      label: 'Looks of kinds',
      description:
        'How each kind of unit draws, by kind: its shape and whether it joins hulls, over the host’s own looks.',
      default: null,
      test: looks,
      asks: 'Kinds, each with a shape and hulls, such as {"interface": {"shape": "oval", "hulls": false}}, or null',
      applies: 'load',
    }),
  ] as const;
