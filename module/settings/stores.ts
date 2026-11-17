// Where the settings file lives (specification 5.9): a host's route, browser storage, memory, or the
// first of two that can be reached. Every store raises the revision at each save and refuses a file of
// another revision than its own, as the handler does (5.10).
import { emptySettingsFile, parseSettingsFile, readSettingsFile, type SettingsFile } from './file.ts';

export interface SettingsStore {
  /** The stored file, or null when there is none yet. Rejects when the store cannot be reached. */
  load(): Promise<SettingsFile | null>;
  /** Stores the file and resolves to it as stored, its revision raised. Rejects with a SettingsConflict when the stored revision differs. */
  save(file: SettingsFile): Promise<SettingsFile>;
}

/** Another revision was stored meanwhile; it comes with the refusal. */
export class SettingsConflict extends Error {
  readonly stored: SettingsFile;
  constructor(stored: SettingsFile) {
    super('The settings changed elsewhere.');
    this.stored = stored;
  }
}

/** The revision rule of 5.10 over a file held somewhere. */
function storeOver(current: SettingsFile | null, file: SettingsFile): SettingsFile {
  const held = current ?? emptySettingsFile();
  if (file.revision !== held.revision) throw new SettingsConflict(held);
  return { ...file, revision: held.revision + 1 };
}

/** Holds the file in memory, for tests and hosts that keep it themselves. */
export class MemorySettingsStore implements SettingsStore {
  file: SettingsFile | null;
  constructor(file: SettingsFile | null = null) {
    this.file = file;
  }
  async load() {
    return this.file && structuredClone(this.file);
  }
  async save(file: SettingsFile) {
    this.file = storeOver(this.file, structuredClone(file));
    return structuredClone(this.file);
  }
}

/** Keeps the file in browser storage under a key; the storage may be handed in, as tests do. */
export class BrowserSettingsStore implements SettingsStore {
  private key: string;
  private storage: () => Storage;
  constructor(key = 'graphview-settings', storage?: Storage) {
    this.key = key;
    this.storage = () => storage ?? globalThis.localStorage;
  }
  async load() {
    const text = this.storage().getItem(this.key);
    if (text === null) return null;
    const r = parseSettingsFile(text);
    if (!r.ok) throw new Error(r.reason);
    return r.file;
  }
  async save(file: SettingsFile) {
    let current: SettingsFile | null = null;
    try {
      current = await this.load();
    } catch {
      // A stored text that is not a settings file is replaced.
    }
    const next = storeOver(current, file);
    this.storage().setItem(this.key, JSON.stringify(next));
    return next;
  }
}

/** Reads and writes the file through a host's route, with GET and PUT (5.10). */
export class HttpSettingsStore implements SettingsStore {
  private address: string;
  private fetcher: typeof fetch;
  constructor(address: string, fetcher: typeof fetch = (...a) => fetch(...a)) {
    this.address = address;
    this.fetcher = fetcher;
  }
  async load() {
    const res = await this.fetcher(this.address, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`The settings route answered ${res.status}.`);
    return this.read(await res.json().catch(() => null));
  }
  async save(file: SettingsFile) {
    const res = await this.fetcher(this.address, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(file),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 409) throw new SettingsConflict(this.read(body));
    if (!res.ok) throw new Error(`The settings route answered ${res.status}.`);
    return this.read(body);
  }
  private read(body: unknown): SettingsFile {
    const r = readSettingsFile(body);
    if (!r.ok) throw new Error(r.reason);
    return r.file;
  }
}

/** Uses the first store, and the second from the first time the first cannot be reached. */
export class FallbackSettingsStore implements SettingsStore {
  private first: SettingsStore;
  private second: SettingsStore;
  /** Whether the second store took over, and why. */
  fellBack: string | null = null;
  constructor(first: SettingsStore, second: SettingsStore) {
    this.first = first;
    this.second = second;
  }
  async load() {
    if (this.fellBack === null) {
      try {
        return await this.first.load();
      } catch (e) {
        this.fellBack = String((e as Error)?.message ?? e);
      }
    }
    return this.second.load();
  }
  async save(file: SettingsFile) {
    if (this.fellBack === null) {
      try {
        return await this.first.save(file);
      } catch (e) {
        if (e instanceof SettingsConflict) throw e;
        this.fellBack = String((e as Error)?.message ?? e);
        // The second store counts its own revisions.
        const held = await this.second.load().catch(() => null);
        return this.second.save({ ...file, revision: held?.revision ?? 0 });
      }
    }
    return this.second.save(file);
  }
}
