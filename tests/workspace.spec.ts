import { test, expect, type Page } from '@playwright/test';

const settings = { provider: 'openai', model: '', theme: 'dark', targetScope: '', runtime: { maxIterations: 40, minActions: 0, thinkingBudget: 0, temperature: null, reflectEvery: 0 } };
const summary = { id: 'fixture', title: 'Saved review', pinned: false, favorited: false, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [], messageCount: 2, findingCount: 0, exploitCount: 0 };
const transcript = [{ id: 'user-1', role: 'user', content: 'Review my example', metadata: { kind: 'text' } }, { id: 'assistant-1', role: 'assistant', content: 'Example review response', metadata: { kind: 'text' } }];
async function workspace(page: Page, conversations = [summary]) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === '/api/settings') body = settings;
    if (path === '/api/conversations') body = conversations;
    if (path === '/api/conversations/fixture') body = { messages: transcript, findings: [], exploits: [], toolCalls: [] };
    if (path.endsWith('/tags')) body = { tags: [] };
    if (path.endsWith('/duplicates')) body = { groups: [] };
    await route.fulfill({ json: body });
  });
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
}

test('API failure leaves the shell usable and the connection can recover', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Database unavailable.' } }));
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: 'Workspace unavailable' })).toContainText('Workspace unavailable');
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(page.getByRole('button', { name: 'New conversation', exact: true }).first()).toBeVisible();
  await page.unroute('**/api/**');
  await workspace(page, []);
  await expect(page.getByRole('alert').filter({ hasText: 'Workspace unavailable' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('sidebar and command palette open the actual settings panel', async ({ page }) => {
  await workspace(page);
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search actions and conversations…').fill('Go to Settings');
  await page.getByRole('option', { name: 'Go to Settings' }).click();
  await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeVisible();
  const panel = page.getByRole('button', { name: 'Save settings', exact: true }).locator('xpath=ancestor::aside');
  await expect(panel).toHaveCSS('display', 'flex');
  if (test.info().project.name === 'mobile') {
    await expect(panel).toHaveCSS('position', 'fixed');
    const box = await panel.boundingBox();
    expect(box!.width).toBeCloseTo(page.viewportSize()!.width, 1);
    await expect.poll(async () => (await panel.boundingBox())!.x).toBeCloseTo(0, 1);
  }
  await page.screenshot({ path: `/tmp/zythos-${test.info().project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed saves display an error rather than a success notification', async ({ page }) => {
  await workspace(page);
  await page.route('**/api/settings', async route => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, json: { error: 'Save unavailable' } });
    else await route.fulfill({ json: settings });
  });
  await page.locator('footer').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await expect(page.getByText('Settings saved', { exact: true })).toHaveCount(0);
});

test('failed conversation creation preserves the draft and prevents double sends', async ({ page }) => {
  await workspace(page, []);
  let requests = 0;
  await page.route('**/api/conversations', async route => {
    requests++;
    await new Promise(resolve => setTimeout(resolve, 100));
    await route.fulfill({ status: 503, json: { error: 'Create unavailable' } });
  });
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('Keep this draft');
  await composer.press('Enter');
  await page.keyboard.press('Enter');
  await expect(composer).toBeEnabled();
  await expect(composer).toHaveValue('Keep this draft');
  expect(requests).toBe(1);
});

test('clear failure retains the transcript; retry deletes by persisted message ID', async ({ page }) => {
  await workspace(page);
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.getByText('Saved review', { exact: true }).click();
  await expect(page.getByText('Example review response', { exact: true })).toBeVisible();
  const requests: unknown[] = [];
  await page.route('**/api/conversations/fixture/messages', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, json: { error: 'Delete unavailable' } });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByText('Example review response', { exact: true })).toBeVisible();
  await expect(page.getByText('Clear failed: Delete unavailable')).toBeVisible();
  await page.getByTitle('Regenerate last response').click();
  await expect(page.getByText('Could not edit message: Delete unavailable')).toBeVisible();
  expect(requests).toEqual([{ all: true }, { fromMessageId: 'user-1' }]);
});

test('settings route rejects invalid input before touching the database', async ({ request }) => {
  for (const payload of [null, { runtime: { maxIterations: -1 } }, { theme: 'invalid' }]) {
    const response = await request.put('/api/settings', { data: payload });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  }
});
