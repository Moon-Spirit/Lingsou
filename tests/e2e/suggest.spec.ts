import { test, expect } from './fixtures/seed.js';

test('autocomplete suggestions appear', async ({ page }) => {
  await page.goto('/');

  // 输入触发联想
  await page.fill('#sb-input', '灵搜');
  // 等待防抖 + API
  await page.waitForTimeout(600);

  // 联想应该可见
  const suggest = page.locator('#sb-suggest');
  await expect(suggest).toBeVisible();
  const items = page.locator('#sb-suggest li');
  expect(await items.count()).toBeGreaterThanOrEqual(1);

  await page.screenshot({ path: 'test-results/task-23-suggest.png', fullPage: true });
});
