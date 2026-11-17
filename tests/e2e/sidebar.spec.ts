// The viewer's side bar (specification 7.9): it starts as it was left, its edge changes its width, what
// is inspected comes into view, a section's heading says how much it holds, the rule banner shows the
// issues, and a search opens it for its results.
import { expect, test, type Page } from '@playwright/test';
import { call, click, open, read, snap, unit } from './helpers.ts';

const panels = (page: Page) => page.locator('#gv-view-panels');
const section = (page: Page, id: string) => page.getByTestId(`section-${id}`);
const toggle = (page: Page, id: string) => section(page, id).locator('h2 button');
const stored = async (page: Page) =>
  ((await (await page.request.get('./api/settings')).json()) as { values: Record<string, unknown> }).values;
const reopen = async (page: Page) => {
  await page.reload();
  await page.waitForFunction(() => (window as any).graphview?.ready() > 0, null, { timeout: 30000 });
};

test('§7.9 GraphView: the side bar starts as it was left: its open sections, its width by its edge, and whether it shows', async ({
  page,
}) => {
  await open(page);
  // Types opens and Paths closes; the setting "Open sections" follows.
  await toggle(page, 'types').click();
  await toggle(page, 'paths').click();
  await expect
    .poll(() => stored(page))
    .toMatchObject({ 'panels.open': ['search', 'root', 'inspector', 'types', 'issues', 'pinned'] });
  // The edge: the arrow keys move it by the setting's step, a drag by the pointer's way.
  const edge = page.getByTestId('panels-edge');
  await expect(edge).toHaveAttribute('aria-valuenow', '360');
  await edge.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(panels(page)).toHaveCSS('width', '380px');
  await expect(edge).toHaveAttribute('aria-valuenow', '380');
  const canvas = (await page.getByTestId('canvas').boundingBox())!.width;
  const at = (await edge.boundingBox())!;
  await page.mouse.move(at.x + 3, at.y + 200);
  await page.mouse.down();
  await page.mouse.move(at.x + 3 - 43, at.y + 200, { steps: 4 });
  await expect(panels(page)).toHaveCSS('width', '423px');
  await page.mouse.up();
  // The setting moves in steps of ten; the canvas gives the room.
  await expect(panels(page)).toHaveCSS('width', '420px');
  expect((await page.getByTestId('canvas').boundingBox())!.width).toBe(canvas - 40);
  await expect.poll(() => stored(page)).toMatchObject({ 'panels.width': 420 });
  await reopen(page);
  await expect(panels(page)).toHaveCSS('width', '420px');
  await expect(section(page, 'types')).toHaveAttribute('data-open', 'true');
  await expect(section(page, 'paths')).toHaveAttribute('data-open', 'false');
  await expect(section(page, 'search')).toHaveAttribute('data-open', 'true');
  // Panels hides the side bar, and it stays away; the button says so by its state.
  const button = page.getByRole('button', { name: 'Panels', exact: true });
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await button.click();
  await expect(panels(page)).toBeHidden();
  await expect(page.getByTestId('panels-edge')).toHaveCount(0);
  await expect.poll(() => stored(page)).toMatchObject({ 'panels.shown': false });
  await reopen(page);
  await expect(panels(page)).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('§7.9 and §6.11 GraphView: what is clicked shows in the inspector, which opens and comes into view; the setting leaves the side bar as it is', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await open(page);
  // The Inspector closed, and the side bar at its foot, where the Inspector is out of view.
  await toggle(page, 'inspector').click();
  await toggle(page, 'types').click();
  const foot = () => panels(page).evaluate((el) => (el.scrollTo(0, el.scrollHeight), el.scrollTop));
  expect(await foot()).toBeGreaterThan(300);
  await expect(section(page, 'inspector').locator('h2')).not.toBeInViewport();
  const s = await snap(page);
  await click(page, unit(s, 5).sx, unit(s, 5).sy);
  await expect(section(page, 'inspector')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('inspector')).toContainText('unit_5');
  await expect(section(page, 'inspector').locator('h2')).toBeInViewport();
  await expect(page.getByTestId('inspector')).toBeInViewport({ ratio: 1 });
  // Clearing the inspector moves nothing.
  const top = await panels(page).evaluate((el) => el.scrollTop);
  await call(page, 'inspect', null);
  expect(await panels(page).evaluate((el) => el.scrollTop)).toBe(top);
  // Without "Show what is inspected", the side bar stays where it is and the Inspector stays closed.
  await call(page, 'setSetting', 'panels.reveal', false);
  await toggle(page, 'inspector').click();
  const at = await foot();
  await call(page, 'inspect', { kind: 'unit', key: 7 });
  await expect(section(page, 'inspector')).toHaveAttribute('data-open', 'false');
  expect(await panels(page).evaluate((el) => el.scrollTop)).toBe(at);
});

test('§7.9 GraphView: a section says in its heading how much it holds; the rule banner shows the issues', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await open(page, 'broken-mixed');
  const count = (id: string) => section(page, id).getByTestId('section-count');
  await expect(count('issues')).toHaveText('7');
  for (const id of ['search', 'scope', 'highlights', 'filters', 'pinned', 'root', 'paths', 'inspector', 'types'])
    await expect(count(id)).toHaveCount(0);
  // The heading's button keeps its plain name.
  await expect(toggle(page, 'issues')).toHaveAccessibleName('Data issues');
  // Rules and the weight threshold count as filters; the selection, the scope and the search count their units.
  await call(page, 'setRule', { field: 'kind', value: 'plain', range: null, mode: 'fade' });
  await expect(count('filters')).toHaveText('1');
  await call(page, 'clearRules');
  await expect(count('filters')).toHaveCount(0);
  await call(page, 'select', [1, 2], 'replace');
  await expect(count('highlights')).toHaveText('2');
  await call(page, 'showNeighbourhood', [1]);
  await expect(count('scope')).toHaveText(String((await read<{ units: unknown[] }>(page, 'scope')).units.length));
  await page.getByRole('searchbox', { name: 'Search' }).fill('4');
  await expect(count('search')).toHaveText(String((await read<{ results: unknown[] }>(page, 'search')).results.length));
  // The banner's button opens the side bar and the Data issues section, and brings its list into view.
  await toggle(page, 'issues').click();
  await page.getByRole('button', { name: 'Panels', exact: true }).click();
  await expect(panels(page)).toBeHidden();
  await page.getByTestId('rules-banner').getByRole('button', { name: 'Show 7 issues' }).click();
  await expect(panels(page)).toBeVisible();
  await expect(section(page, 'issues')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('issues-panel').locator('li').first()).toBeInViewport();
});

test('§6.19 Search: typing opens the side bar for the results; Escape empties the field, then gives the keys back to the canvas', async ({
  page,
}) => {
  await open(page);
  const field = page.getByRole('searchbox', { name: 'Search' });
  await page.getByRole('button', { name: 'Panels', exact: true }).click();
  await toggle(page, 'search').evaluate((b: HTMLElement) => b.click());
  await expect(panels(page)).toBeHidden();
  await field.fill('unit_7');
  await expect(panels(page)).toBeVisible();
  await expect(page.getByTestId('search-panel').locator('li').first()).toBeVisible();
  await field.press('Escape');
  await expect(field).toHaveValue('');
  await expect(page.getByTestId('search-panel')).toContainText('Type in the search field above the canvas.');
  expect((await read<{ text: string }>(page, 'search')).text).toBe('');
  await field.press('Escape');
  await expect(page.getByTestId('canvas')).toBeFocused();
});
