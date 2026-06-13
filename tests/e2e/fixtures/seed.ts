import { test as base } from '@playwright/test';
import { setupE2EFixture, teardownE2EFixture } from '../utils/meili.js';

/**
 * Playwright test fixture that bootstraps a clean Meilisearch E2E fixture
 * before each test and cleans up afterwards.
 *
 * Usage in a spec file:
 *   import { test, expect } from './fixtures/seed.js';
 *   test('search works', async ({ page, e2eFixture }) => { ... });
 */
export const test = base.extend<{ e2eFixture: undefined }>({
  e2eFixture: [
    async ({}, use) => {
      await setupE2EFixture();
      await use(undefined);
      await teardownE2EFixture();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
