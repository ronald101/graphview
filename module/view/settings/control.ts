// What every control of a setting is given (D79): the setting, the model for words and colours, an id for
// its label, and `set`, which hands a value to the model and shows a refusal.
import type { GraphModel } from '../../model/model.ts';
import type { Setting } from '../../settings/setting.svelte.ts';

export interface ControlProps<S extends Setting = Setting> {
  setting: S;
  model: GraphModel;
  /** The id of the control's first field, for the row's label. */
  id: string;
  /** The setting's label, for fields the row's label does not name. */
  label: string;
  set: (value: unknown) => void;
}

/** A colour as a colour field holds it: #rrggbb in lower case. */
export function sixDigits(c: string): string {
  const s = c.toLowerCase();
  return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
}
