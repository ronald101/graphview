// The Generate section (specification 8.4, 8.7 to 8.9): types, weights and times added at random
// within chosen ranges, the Types section in complementary pairs, and the explanation that follows
// every change.
import { expect, test, type Page } from '@playwright/test';
import { open, read, settled, slide } from './helpers.ts';

type Doc = {
  vertices: { key: number; attrs?: Record<string, unknown> }[];
  edges: { from: number; to: number; attrs?: Record<string, unknown> }[];
};

const addTypes = (page: Page) => page.getByRole('checkbox', { name: 'Add types, weights and times' });

test('§8.4 Generate: "Add types, weights and times" opens Types and turns on the sliders and the numbers', async ({
  page,
}) => {
  await open(page);
  await expect(page.getByTestId('section-types')).toHaveAttribute('data-open', 'false');
  for (const l of ['Weights, lowest', 'Weights, highest', 'Times, lowest', 'Times, highest'])
    await expect(page.getByLabel(l, { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Unit types to add')).toBeDisabled();
  await addTypes(page).check();
  await expect(page.getByTestId('section-types')).toHaveAttribute('data-open', 'true');
  for (const l of ['Weights, lowest', 'Weights, highest', 'Times, lowest', 'Times, highest'])
    await expect(page.getByLabel(l, { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Unit types to add')).toHaveValue('5');
  await expect(page.getByLabel('Relation types to add')).toHaveValue('4');
});

test('§8.7 Types, weights and times: a family gets unit types, complementary relation types, and weights and times within the ranges', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('graph-choice').selectOption('family:communities');
  await addTypes(page).check();
  await page.getByLabel('Unit types to add').fill('3');
  await page.getByLabel('Relation types to add').fill('2');
  await slide(page, 'Weights, lowest', 0.2);
  await slide(page, 'Weights, highest', 0.4);
  await expect(page.getByTestId('weights')).toContainText('0.2 to 0.4');
  const times = await page.getByLabel('Times, lowest', { exact: true }).evaluate((el: HTMLInputElement) => {
    const lo = Number(el.min) + 400 * 86400000;
    return [lo, lo + 60 * 86400000];
  });
  await slide(page, 'Times, lowest', times[0]);
  await slide(page, 'Times, highest', times[1]);
  await page.getByTestId('generate').click();
  await page.waitForFunction(() => (window as any).graphview.model.doc?.meta?.decorated);
  await settled(page);
  const doc = await read<Doc>(page, 'doc');
  const born = new Map(doc.vertices.map((v) => [v.key, Date.parse(String(v.attrs!.created))]));
  for (const v of doc.vertices) {
    expect(['type_1', 'type_2', 'type_3']).toContain(v.attrs!.type);
    expect(born.get(v.key)!).toBeGreaterThanOrEqual(times[0]);
    expect(born.get(v.key)!).toBeLessThanOrEqual(times[1]);
  }
  const typeOf = new Map(doc.edges.map((e) => [`${e.from} ${e.to}`, e.attrs!.type]));
  const complement: Record<string, string> = { rel_ab: 'rel_ba', rel_ba: 'rel_ab', rel_cd: 'rel_dc', rel_dc: 'rel_cd' };
  for (const e of doc.edges) {
    const w = e.attrs!.weight as number;
    expect(w).toBeGreaterThanOrEqual(0.2);
    expect(w).toBeLessThanOrEqual(0.4);
    expect(typeOf.get(`${e.to} ${e.from}`)).toBe(complement[e.attrs!.type as string]);
    const t = Date.parse(String(e.attrs!.created));
    expect(t).toBeGreaterThanOrEqual(Math.max(born.get(e.from)!, born.get(e.to)!));
    expect(t).toBeLessThanOrEqual(times[1]);
  }
  // The Types section shows the unit types, and the keypair types side by side with their complements.
  const types = page.getByTestId('types-panel');
  await expect(types.getByTestId('unit-types').locator('li')).toHaveCount(3);
  const rows = types.getByTestId('keypair-types').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  const pairs = await rows.evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('input.gv-type-name')].map((i) => (i as HTMLInputElement).value)),
  );
  expect(pairs.map((p) => [...p].sort())).toEqual([
    ['rel_ab', 'rel_ba'],
    ['rel_cd', 'rel_dc'],
  ]);
  // The Filters section offers the new times and weights.
  await expect(page.getByTestId('time-window')).toBeVisible({ visible: false });
  await page.getByTestId('section-filters').locator('h2 button').click();
  await expect(page.getByTestId('time-window')).toBeVisible();
  await expect(page.getByLabel('Weight threshold')).toBeVisible();
});

test('§8.7 Types, weights and times: an example with types keeps what it brings and gains what it lacks', async ({
  page,
}) => {
  await open(page);
  const before = await read<Doc>(page, 'doc');
  await addTypes(page).check();
  await page.getByTestId('generate').click();
  await page.waitForFunction(() => (window as any).graphview.model.doc?.meta?.decorated);
  const after = await read<Doc>(page, 'doc');
  expect(after.vertices.map((v) => v.attrs!.type)).toEqual(before.vertices.map((v) => v.attrs!.type));
  expect(after.edges.map((e) => [e.attrs!.type, e.attrs!.weight])).toEqual(
    before.edges.map((e) => [e.attrs!.type, e.attrs!.weight]),
  );
  expect(after.vertices.every((v) => typeof v.attrs!.created === 'string')).toBe(true);
});

test('§8.8 Explanation: it names the family or example, explains each setting with its value, and follows every change', async ({
  page,
}) => {
  await open(page);
  const explanation = page.getByTestId('explanation');
  await explanation.locator('summary').click();
  await expect(explanation.locator('h4').first()).toHaveText('Example: Sample graph');
  await page.getByTestId('graph-choice').selectOption('family:tree');
  await expect(explanation.locator('h4')).toHaveText([
    'Family: Tree',
    'Parameters',
    'Types, weights and times',
    'Relations through interfaces',
  ]);
  const item = (name: string) =>
    explanation.locator('dt', { has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
  await expect(item('n')).toContainText('15');
  await expect(explanation).toContainText('n − 1 relations');
  // The fields and the explanation use readable names.
  await expect(page.getByLabel('branching b', { exact: true })).toHaveValue('2');
  await expect(item('branching b')).toContainText('2');
  await page.getByLabel('n', { exact: true }).fill('20');
  await expect(item('n')).toContainText('20');
  await page.getByLabel('Seed').fill('4');
  await expect(item('seed')).toContainText('4');
  await addTypes(page).check();
  await expect(explanation).toContainText('On: what the graph lacks is added at random');
  await expect(item('unit types')).toContainText('5');
  await page.getByLabel('Relation types to add').fill('3');
  await expect(item('relation types')).toContainText('3');
  await expect(explanation).toContainText('rel_ef');
  await page.getByTestId('interfaces').fill('0.5');
  await expect(item('share')).toContainText('0.5');
  await page.locator('details.breaks summary').click();
  await page.getByLabel('Lone units').fill('2');
  await expect(explanation.locator('h4').last()).toHaveText('Break the rules');
  await expect(item('lone units')).toContainText('2');
  await page.getByTestId('graph-choice').selectOption('example:petersen');
  await expect(explanation.locator('h4').first()).toHaveText('Example: Petersen graph');
});
