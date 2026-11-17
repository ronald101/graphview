// The settings handler (specification 5.10): the GET and PUT functions of a host's route, so that the
// file's rules stay in the module. The host says where the text lives. It uses only Request and Response,
// so the module's entry point can offer it to the browser's code and the server's alike (D89).
import { emptySettingsFile, parseSettingsFile, readSettingsFile, type SettingsFile } from './file.ts';

/** The part of a route's request event the handler passes on: enough to tell whose file it is. */
export interface SettingsRequest {
  request: Request;
}

export interface SettingsHandlerOptions<E extends SettingsRequest = SettingsRequest> {
  /** The stored text, or null when nothing is stored yet; the event says whose, as a host may keep one per person. */
  read: (event: E) => Promise<string | null>;
  write: (text: string, event: E) => Promise<void>;
}

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function createSettingsHandler<E extends SettingsRequest>({ read, write }: SettingsHandlerOptions<E>) {
  const stored = async (event: E): Promise<SettingsFile> => {
    const text = await read(event);
    if (text === null) return emptySettingsFile();
    const r = parseSettingsFile(text);
    return r.ok ? r.file : emptySettingsFile();
  };
  // One PUT at a time, so that two saves never both pass the revision check.
  let queue: Promise<unknown> = Promise.resolve();

  /** The stored file, or an empty file of revision 0. */
  const GET = async (event: E) => answer(await stored(event));

  /** Stores a file of the stored revision, raised by one; another revision gets 409 and the stored file. */
  const PUT = (event: E): Promise<Response> => {
    const run = queue.then(async () => {
      const body = await event.request.json().catch(() => undefined);
      const r = readSettingsFile(body);
      if (!r.ok) return answer({ error: r.reason }, 400);
      const held = await stored(event);
      if (r.file.revision !== held.revision) return answer(held, 409);
      const next = { ...r.file, revision: held.revision + 1 };
      await write(`${JSON.stringify(next, null, 2)}\n`, event);
      return answer(next);
    });
    queue = run.catch(() => undefined);
    return run;
  };

  return { GET, PUT };
}
