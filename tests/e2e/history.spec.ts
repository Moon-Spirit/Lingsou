import { test, expect } from './fixtures/seed.js';

test('search history persists and can be cleared', async ({ page }) => {
  await page.goto('/');

  // 提交两个查询
  await page.fill('#sb-input', '灵搜');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);
  await page.fill('#sb-input', '测试');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);

  // localStorage 中有 history
  const hist = await page.evaluate(() => localStorage.getItem('lingsou_history'));
  expect(hist).toBeTruthy();
  const arr = JSON.parse(hist!);
  expect(Array.isArray(arr)).toBe(true);
  expect(arr.length).toBeGreaterThanOrEqual(1);

  // 刷新后历史仍显示
  await page.reload();
  await expect(page.locator('.hp-item').first()).toBeVisible({ timeout: 5_000 });

  // 点击清除
  await page.click('#hp-clear');
  await page.waitForTimeout(300);
  const histAfter = await page.evaluate(() => localStorage.getItem('lingsou_history'));
  expect(histAfter).toBeNull();

  await page.screenshot({ path: 'test-results/task-23-history.png', fullPage: true });
});
