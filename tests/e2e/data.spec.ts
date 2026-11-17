// The Data section (specification 8.3, 8.11 to 8.13): File (Browse, Save with a question before it
// overwrites, the view travels in the file), Picture (as on screen, with or without background)
// and Web (Fetch, share links). The browser's file dialogs are replaced by stand-ins that keep
// files in memory, as a person picking and saving files would.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fingerprint, loadGraph, tokens } from '../../module/core/index.ts';
import { call, expected, graphFile, open, read, settled, snap, unit } from './helpers.ts';

/** Stand-ins for showOpenFilePicker and showSaveFilePicker; files live in window.__files. */
async function filePickers(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__files = {} as Record<string, Blob>;
    w.__pick = '';
    w.__saveAs = null;
    const handle = (name: string) => ({
      name,
      async getFile() {
        return new File([w.__files[name]], name, { type: w.__files[name].type });
      },
      async createWritable() {
        const parts: (Blob | string)[] = [];
        return {
          async write(d: Blob | string) {
            parts.push(d);
          },
          async close() {
            w.__files[name] = new Blob(parts, { type: parts[0] instanceof Blob ? parts[0].type : 'text/plain' });
          },
        };
      },
    });
    w.showOpenFilePicker = async () => [handle(w.__pick)];
    w.showSaveFilePicker = async (o: { suggestedName: string }) => handle(w.__saveAs ?? o.suggestedName);
  });
}

const putFile = (page: Page, name: string, text: string) =>
  page.evaluate(([n, t]) => ((window as any).__files[n] = new Blob([t], { type: 'application/json' })), [name, text]);
const fileText = (page: Page, name: string) =>
  page.evaluate((n) => (window as any).__files[n]?.text() ?? null, name) as Promise<string | null>;

async function browse(page: Page, name: string) {
  await page.evaluate((n) => ((window as any).__pick = n), name);
  const ready = page.evaluate(() => (window as any).graphview.nextReady());
  await page.getByRole('button', { name: 'Browse…' }).click();
  await ready;
  await expect(page.getByTestId('file-name')).toHaveText(name);
  await settled(page);
}

test('§8.11 Opening files: Browse opens the picked file; its name shows, and the headline and panels follow', async ({
  page,
}) => {
  await filePickers(page);
  await open(page);
  await expect(page.getByTestId('file-name')).toHaveText('No file selected');
  await call(page, 'setRoot', 79);
  await putFile(
    page,
    'petersen.json',
    readFileSync(new URL('../../fixtures/graphs/petersen.json', import.meta.url), 'utf8'),
  );
  await browse(page, 'petersen.json');
  await expect(page.getByTestId('headline')).toHaveText('Petersen graph, 10 units, 15 relations, no issues');
  // A new graph starts without a root, and the panels say so.
  expect((await snap(page)).root).toBe(null);
  await expect(page.getByLabel('Root', { exact: true })).toHaveValue('');
  await expect(page.getByTestId('plane-first')).toHaveText('none');
});

test('§3.7 Rows with id, source and target: the file input opens them through the importer', async ({ page }) => {
  await open(page);
  const rows = {
    vertices: [
      { id: 'a', name: 'Alpha', type: 'person' },
      { id: 'b', type: 'place' },
      { id: 'c', type: 'place' },
    ],
    edges: [
      { source: 'a', target: 'b', type: 'visits', weight: 2 },
      { source: 'b', target: 'a', type: 'hosts', weight: 1 },
      { source: 'b', target: 'c', type: 'near', weight: 1 },
      { source: 'c', target: 'b', type: 'near', weight: 3 },
      { source: 'c', target: 'z', type: 'near' },
    ],
  };
  await page.getByTestId('file-input').setInputFiles({
    name: 'rows.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)),
  });
  await expect(page.getByTestId('message')).toContainText('read as rows with id, source and target');
  await expect(page.getByTestId('file-name')).toHaveText('rows.json');
  await expect.poll(async () => (await snap(page)).units.length).toBe(3);
  await settled(page);
  expect((await snap(page)).lines).toHaveLength(2);
  const types = await read<{ unit: { id: string; count: number }[]; keypair: { id: string }[] }>(page, 'types');
  expect(types.unit.map((t) => [t.id, t.count])).toEqual([
    ['place', 2],
    ['person', 1],
  ]);
  expect(types.keypair.map((t) => t.id).sort()).toEqual(['hosts', 'near', 'visits']);
  await expect(page.getByTestId('issues-panel').locator('[data-code=unknown-unit]')).toHaveCount(1);
});

test('§8.11 Opening files: a file that is not JSON says so, and the graph stays', async ({ page }) => {
  await filePickers(page);
  await open(page);
  await putFile(page, 'broken.json', '{ "format": ');
  await page.evaluate((n) => ((window as any).__pick = n), 'broken.json');
  await page.getByRole('button', { name: 'Browse…' }).click();
  await expect(page.getByTestId('message')).toHaveText('The file broken.json is not valid JSON.');
  await expect(page.getByTestId('headline')).toContainText('Sample graph, 81 units');
});

test('§8.12 Saving files: Save writes the graph with its view; Save again asks before it overwrites; opening the file restores the view', async ({
  page,
}) => {
  await filePickers(page);
  await open(page);
  const original = readFileSync(new URL('../../fixtures/graphs/petersen.json', import.meta.url), 'utf8');
  await putFile(page, 'petersen.json', original);
  await browse(page, 'petersen.json');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await call(page, 'setRoot', 1);
  await call(page, 'setTarget', 3);
  const paths = await read<{ lengths: { length: number; paths: unknown[] }[] }>(page, 'paths');
  const chosen = { length: paths.lengths[1].length, index: paths.lengths[1].paths.length - 1 };
  await call(page, 'choosePath', chosen);
  await call(page, 'setFilters', { threshold: null });
  await call(page, 'setOverrides', { size: 1.5 });
  await call(page, 'setHulls', false);
  const camera = await page.evaluate(() => (window as any).graphview.canvas().getCamera());

  // The open file has a name: Save asks before it overwrites it.
  const asked: string[] = [];
  page.once('dialog', (d) => {
    asked.push(d.message());
    void d.accept();
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('message')).toHaveText('Overwrote petersen.json.');
  expect(asked).toEqual(['The file petersen.json exists. Overwrite it?']);
  const saved = JSON.parse((await fileText(page, 'petersen.json'))!);
  const raw = JSON.parse(original);
  expect(saved.vertices).toEqual(raw.vertices);
  expect(saved.edges).toEqual(raw.edges);
  const r = loadGraph(raw);
  if (!r.ok) throw new Error('refused');
  expect(saved.meta.fingerprint).toBe(fingerprint(r.graph));
  expect(saved.meta.view).toMatchObject({
    mode: '3d',
    root: 1,
    target: 3,
    path: chosen,
    overrides: { size: 1.5 },
    hulls: false,
  });

  // Declining the question saves under a new name instead.
  page.once('dialog', (d) => void d.dismiss());
  await page.evaluate(() => ((window as any).__saveAs = 'copy.json'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('message')).toHaveText('Saved copy.json.');
  await expect(page.getByTestId('file-name')).toHaveText('copy.json');

  // Another graph, then the saved file again: the view comes back.
  await page.evaluate(() => (window as any).graphview.loadExample('path-4'));
  await settled(page);
  await browse(page, 'copy.json');
  const s = await snap(page);
  expect([s.mode, s.root, s.target, s.hasPath]).toEqual(['3d', 1, 3, true]);
  expect(await read(page, 'choice')).toEqual(chosen);
  expect((await read<{ size: number }>(page, 'overrides')).size).toBe(1.5);
  await expect(page.getByRole('toolbar', { name: 'View' }).getByLabel('Hulls')).not.toBeChecked();
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Root', { exact: true })).toHaveValue(
    await page.evaluate(() => (window as any).graphview.model.label(1)),
  );
  const after = await page.evaluate(() => (window as any).graphview.canvas().getCamera());
  after.position.forEach((v: number, i: number) => expect(v).toBeCloseTo(camera.position[i], 3));
});

test('§8.11 Opening files: a file saved in 3D opens in 3D from a 2D canvas; a drag turns the view, and the display factors are drawn', async ({
  page,
}) => {
  await filePickers(page);
  await open(page, 'petersen');
  await call(page, 'setMode', '3d');
  await call(page, 'setRoot', 1);
  await call(page, 'setOverrides', { size: 1.5, opacity: 0.8 });
  const before = unit(await snap(page), 1);
  await page.evaluate(() => ((window as any).__saveAs = 'view.json'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('message')).toHaveText('Saved view.json.');

  // A plain 2D view of another graph, then the file.
  await call(page, 'setOverrides', { size: 1, opacity: 1 });
  await call(page, 'setMode', '2d');
  await page.evaluate(() => (window as any).graphview.loadExample('path-4'));
  await settled(page);
  await browse(page, 'view.json');
  const s = await snap(page);
  expect([s.mode, s.root]).toEqual(['3d', 1]);
  const after = unit(s, 1);
  expect(after.scale).toBeCloseTo(before.scale, 5);
  expect(after.opacity).toBeCloseTo(before.opacity, 5);
  await expect(page.getByRole('button', { name: '3D', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // A drag turns the camera around its target, as in 3D; in 2D it would move both.
  const cam = () => page.evaluate(() => (window as any).graphview.canvas().getCamera());
  const c0 = await cam();
  const b = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 160, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await settled(page);
  const c1 = await cam();
  c1.target.forEach((v: number, i: number) => expect(v).toBeCloseTo(c0.target[i], 3));
  expect(Math.abs(c1.position[0] - c0.position[0])).toBeGreaterThan(1);
});

test('§8.12 Saving files: where the browser cannot pick files, Save downloads the graph with its stored fingerprint', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
  });
  await open(page, 'broken-mixed');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
  const original = graphFile('broken-mixed');
  expect(saved.vertices).toEqual(original.vertices);
  expect(saved.edges).toEqual(original.edges);
  expect(saved.meta.fingerprint).toBe(expected('broken-mixed').fingerprint.stored);
  await expect(page.getByTestId('message')).toHaveText(/^Downloaded .+\.json\.$/);
});

test('§6.15 Picture: Save picture writes the picture as on screen, with its background or without', async ({
  page,
}) => {
  await filePickers(page);
  await open(page);
  const size = await page.evaluate(() => {
    const c = document.querySelector('.gv-gl canvas') as HTMLCanvasElement;
    return [c.width, c.height];
  });
  const look = (name: string) =>
    page.evaluate(async (n) => {
      const b = await createImageBitmap((window as any).__files[n]);
      const c = new OffscreenCanvas(b.width, b.height);
      const g = c.getContext('2d')!;
      g.drawImage(b, 0, 0);
      return {
        type: (window as any).__files[n].type,
        size: [b.width, b.height],
        corner: [...g.getImageData(2, 2, 1, 1).data],
      };
    }, name);
  // Save picture ends the viewer's Display section, which hands the picture to the shell to save.
  await page.getByTestId('section-display').locator('h2 button').click();
  await page.evaluate(() => ((window as any).__saveAs = 'with.png'));
  await page.getByRole('button', { name: 'Save picture' }).click();
  await expect(page.getByTestId('message')).toHaveText('Saved with.png.');
  const withBg = await look('with.png');
  expect(withBg.type).toBe('image/png');
  expect(withBg.size).toEqual(size);
  const surface = [1, 3, 5].map((i) => parseInt(tokens.light.surface.slice(i, i + 2), 16));
  expect(withBg.corner.slice(0, 3).every((v, i) => Math.abs(v - surface[i]) <= 3)).toBe(true);
  expect(withBg.corner[3]).toBe(255);

  await page.getByLabel('Background').uncheck();
  await page.evaluate(() => ((window as any).__saveAs = 'without.png'));
  await page.getByRole('button', { name: 'Save picture' }).click();
  await expect(page.getByTestId('message')).toHaveText('Saved without.png.');
  const without = await look('without.png');
  expect(without.size).toEqual(size);
  expect(without.corner[3]).toBe(0);
});

test('§8.3 Data: Fetch loads an address that answers; a refused address is named', async ({ page }) => {
  await open(page);
  const url = 'http://localhost:4173/graphview/data/triangle.json';
  await page.route(url, (route) =>
    route.fulfill({
      body: readFileSync(new URL('../../fixtures/graphs/triangle.json', import.meta.url)),
      contentType: 'application/json',
    }),
  );
  await page.getByLabel('Web address').fill(url);
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(page.getByTestId('headline')).toContainText('3 units, 3 relations, no issues');
  const refused = 'http://localhost:9/nothing.json';
  await page.getByLabel('Web address').fill(refused);
  await page.getByRole('button', { name: 'Fetch' }).click();
  await expect(page.getByTestId('message')).toContainText(refused);
});

test('§8.13 Share links: a link restores the example, the mode, the root and the path', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, 'petersen');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await call(page, 'setRoot', 1);
  await call(page, 'setTarget', 3);
  const paths = await read<{ lengths: { length: number; paths: unknown[] }[] }>(page, 'paths');
  const chosen = { length: paths.lengths.at(-1)!.length, index: paths.lengths.at(-1)!.paths.length - 1 };
  await call(page, 'choosePath', chosen);
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  const fresh = await context.newPage();
  await fresh.goto(link);
  await fresh.waitForFunction(() => (window as any).graphview?.ready() > 0 && (window as any).graphview.model.paths);
  const s = await snap(fresh);
  expect([s.mode, s.root, s.target]).toEqual(['3d', 1, 3]);
  expect(await read(fresh, 'choice')).toEqual(chosen);
  await expect(fresh.getByTestId('headline')).toContainText('Petersen graph');
});

test("§8.13 Share links: a link that cannot be read says so, and the sample graph shows without the link's view", async ({
  page,
}) => {
  for (const query of [
    `?gen=${encodeURIComponent('{}')}&mode=3d`,
    `?gen=${encodeURIComponent(JSON.stringify({ family: 'moon', params: {}, seed: 1 }))}&mode=3d`,
    `?example=nothing&mode=3d&view=${encodeURIComponent(JSON.stringify({ mode: '3d', root: 5, target: null, path: null }))}`,
  ]) {
    await page.goto(`./${query}`);
    await page.waitForFunction(() => (window as any).graphview?.ready() > 0, null, { timeout: 30000 });
    await expect(page.getByTestId('message')).toHaveText('The graph in the link could not be read.');
    await expect(page.getByTestId('headline')).toContainText('Sample graph');
    const s = await snap(page);
    expect([s.mode, s.root, s.units.length]).toEqual(['3d', null, 81]);
  }
  await page.goto(`./?example=petersen&view=${encodeURIComponent('{not json')}`);
  await page.waitForFunction(() => (window as any).graphview?.ready() > 0, null, { timeout: 30000 });
  await expect(page.getByTestId('message')).toHaveText('The view in the link could not be read.');
  await expect(page.getByTestId('headline')).toContainText('Petersen graph');
});

test('§8.13 Share links: Share link on a graph from a file says it cannot travel in a link', async ({ page }) => {
  await filePickers(page);
  await open(page);
  await putFile(page, 'petersen.json', JSON.stringify(graphFile('petersen')));
  await browse(page, 'petersen.json');
  await page.getByRole('button', { name: 'Share link' }).click();
  await expect(page.getByTestId('message')).toHaveText(
    'A graph opened from a file cannot travel in a link; save the file instead.',
  );
  await expect(page.getByRole('textbox', { name: 'Share link' })).toHaveCount(0);
});

test('§8.13 Share links: a link of a generated graph carries its family, parameters, seed and types', async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(() => (window as any).graphview.generate('tree', { n: 12, b: 3 }, 9, undefined, true));
  await settled(page);
  await page.getByRole('button', { name: 'Share link' }).click();
  const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(decodeURIComponent(link)).toContain('"family":"tree"');
  const doc = await read(page, 'doc');
  const fresh = await context.newPage();
  await fresh.goto(link);
  await fresh.waitForFunction(() => (window as any).graphview?.ready() > 0);
  expect(await read(fresh, 'doc')).toEqual(doc);
  await expect(fresh.getByRole('checkbox', { name: 'Add types, weights and times' })).toBeChecked();
});
