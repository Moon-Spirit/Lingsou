import { test, expect } from './fixtures/seed.js';

test('search flow: input -> results -> highlight', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/灵搜/);

  // 输入并提交
  await page.fill('#sb-input', '灵搜');
  await page.click('button[type="submit"]');

  // 等待结果
  await expect(page.locator('.result-list article').first()).toBeVisible({ timeout: 10_000 });

  // 至少 1 个结果
  const count = await page.locator('.result-list article').count();
  expect(count).toBeGreaterThanOrEqual(1);

  // 高亮验证
  const html = await page.locator('.result-list article').first().innerHTML();
  expect(html).toContain('<mark>');

  // 截图
  await page.screenshot({ path: 'test-results/task-22-search-flow.png', fullPage: true });
});
