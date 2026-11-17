// Sources (specification 5.8): where the viewer reads its graph, so that a host can change how graphs
// arrive without changing the viewer.

export interface GraphSource {
  /** A name for messages and file names. */
  readonly name: string;
  /** A graphview-graph/1 document, or rows that the host's importer converts (3.7). Rejects when it cannot be read. */
  load(): Promise<unknown>;
}

/** Fetches an address, or reads a file, and parses its JSON. */
export class JsonFileSource implements GraphSource {
  readonly name: string;
  private from: string | URL | Blob;
  private fetcher: typeof fetch;

  constructor(from: string | URL | File | Blob, fetcher: typeof fetch = (...a) => fetch(...a)) {
    this.from = from;
    this.fetcher = fetcher;
    this.name =
      typeof File !== 'undefined' && from instanceof File
        ? from.name
        : typeof from === 'string' || from instanceof URL
          ? decodeURIComponent(String(from).split(/[?#]/)[0].split('/').pop() || String(from))
          : 'graph.json';
  }

  async load(): Promise<unknown> {
    if (typeof this.from === 'string' || this.from instanceof URL) {
      const res = await this.fetcher(String(this.from), { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`the address answered ${res.status}`);
      return parse(await res.text());
    }
    return parse(await this.from.text());
  }
}

/** Hands over a document already in memory. */
export class DocumentSource implements GraphSource {
  readonly name: string;
  private doc: unknown;

  constructor(doc: unknown, name = 'graph') {
    this.doc = doc;
    this.name = name;
  }

  async load(): Promise<unknown> {
    return this.doc;
  }
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('it is not JSON');
  }
}
