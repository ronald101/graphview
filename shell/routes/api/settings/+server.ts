// The viewer's settings files (specification 5.10 and 8.17), one per browser, kept under data/settings
// through the module's handler, as a host keeps one per person in its own store. A cookie tells the
// browsers apart. The static build has no server and leaves this route out.
import type { RequestEvent } from '@sveltejs/kit';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createSettingsHandler } from '../../../../module/index.ts';

const DIR = 'data/settings';
const COOKIE = 'graphview-who';

/** The browser's own name, given at its first visit. */
function who(event: RequestEvent): string {
  const known = event.cookies.get(COOKIE);
  if (known && /^[\w-]{8,64}$/.test(known)) return known;
  const id = crypto.randomUUID();
  event.cookies.set(COOKIE, id, { path: '/graphview', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export const prerender = false;

export const { GET, PUT } = createSettingsHandler<RequestEvent>({
  read: (event) => readFile(`${DIR}/${who(event)}.json`, 'utf8').catch(() => null),
  write: async (text, event) => {
    await mkdir(DIR, { recursive: true });
    await writeFile(`${DIR}/${who(event)}.json`, text);
  },
});
