// Saves the settings file half a second after the last change (D85). When another viewer stored a newer
// revision meanwhile, this viewer's changes go on top of that file, and the merged file comes back to it.
import type { SettingsFile } from './file.ts';
import type { SettingsRegistry } from './registry.ts';
import { SettingsConflict, type SettingsStore } from './stores.ts';

export type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'failed'; reason: string };

/** The stored file with the changed keys' values and pins taken from ours: set, reset, pinned or not. */
export function mergeFiles(stored: SettingsFile, ours: SettingsFile, changed: Iterable<string>): SettingsFile {
  const values = { ...stored.values };
  const pins = new Set(stored.pinned);
  for (const k of changed) {
    if (Object.hasOwn(ours.values, k)) values[k] = ours.values[k];
    else delete values[k];
    if (ours.pinned.includes(k)) pins.add(k);
    else pins.delete(k);
  }
  return { ...stored, values, pinned: [...pins] };
}

export class SettingsSaver {
  state: SaveState = $state({ kind: 'saved' });
  readonly delay: number;
  private registry: SettingsRegistry;
  private store: SettingsStore;
  private apply: (file: SettingsFile) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  /** `apply` hands a file that came back from the store to the model, the registry's only writer. */
  constructor(registry: SettingsRegistry, store: SettingsStore, apply: (file: SettingsFile) => void, delay = 500) {
    this.registry = registry;
    this.store = store;
    this.apply = apply;
    this.delay = delay;
  }

  /** Saves after each change of the person's values or pins; returns a function that stops. */
  start(): () => void {
    const off = this.registry.subscribe(() => this.schedule());
    return () => {
      off();
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    };
  }

  schedule() {
    this.state = { kind: 'saving' };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delay);
  }

  /** Saves now; resolves when every change so far is stored, or the store refused. */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.save().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.flush();
      }
    });
    return this.running;
  }

  private async save() {
    const changed = this.registry.takeDirty();
    const file = this.registry.file();
    try {
      let stored: SettingsFile;
      try {
        stored = await this.store.save(file);
      } catch (e) {
        if (!(e instanceof SettingsConflict)) throw e;
        stored = await this.store.save(mergeFiles(e.stored, file, changed));
        this.apply(stored);
      }
      this.registry.revision = stored.revision;
      this.state = { kind: 'saved' };
    } catch (e) {
      this.registry.giveDirty(changed);
      this.state = {
        kind: 'failed',
        reason: e instanceof SettingsConflict ? e.message : String((e as Error)?.message ?? e),
      };
    }
  }
}
