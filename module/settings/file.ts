// The settings file (specification 5.9): the values that differ from the layers below them, and the
// pins. A host stores it as it likes; the shell keeps it at data/graphview-settings.json.

export const SETTINGS_FORMAT = 'graphview-settings/1';

export interface SettingsFile {
  format: typeof SETTINGS_FORMAT;
  /** Raised by one at each store; a store refuses a file of another revision than its own. */
  revision: number;
  /** Values by the settings' dotted keys. */
  values: Record<string, unknown>;
  /** Keys of the settings shown in the side bar. */
  pinned: string[];
}

export const emptySettingsFile = (revision = 0): SettingsFile => ({
  format: SETTINGS_FORMAT,
  revision,
  values: {},
  pinned: [],
});

const plain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads a settings file from parsed JSON. A missing revision, values or pins read as empty. */
export function readSettingsFile(v: unknown): { ok: true; file: SettingsFile } | { ok: false; reason: string } {
  if (!plain(v)) return { ok: false, reason: 'The settings file is not a JSON object.' };
  if (v.format !== SETTINGS_FORMAT)
    return { ok: false, reason: `The settings file is not in the format ${SETTINGS_FORMAT}.` };
  const revision = v.revision ?? 0;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)
    return { ok: false, reason: 'The settings file’s revision is not a whole number from 0.' };
  const values = v.values ?? {};
  if (!plain(values)) return { ok: false, reason: 'The settings file’s values are not an object.' };
  const pinned = v.pinned ?? [];
  if (!Array.isArray(pinned) || !pinned.every((k) => typeof k === 'string'))
    return { ok: false, reason: 'The settings file’s pins are not a list of keys.' };
  return { ok: true, file: { format: SETTINGS_FORMAT, revision, values: { ...values }, pinned: [...new Set(pinned)] } };
}

/** Reads a settings file from its text; text that is not JSON gives a reason. */
export function parseSettingsFile(text: string): { ok: true; file: SettingsFile } | { ok: false; reason: string } {
  try {
    return readSettingsFile(JSON.parse(text));
  } catch {
    return { ok: false, reason: 'The settings file is not JSON.' };
  }
}
