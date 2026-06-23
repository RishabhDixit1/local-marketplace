import { test, expect } from '@playwright/test';

test.describe('Runtime page load audit', () => {
  const pages = [
    { path: '/', name: 'Landing' },
    { path: '/business', name: 'Business' },
    { path: '/contact', name: 'Contact' },
    { path: '/faq', name: 'FAQ' },
    { path: '/support', name: 'Support' },
    { path: '/terms', name: 'Terms' },
    { path: '/privacy', name: 'Privacy' },
    { path: '/search', name: 'Search' },
    { path: '/referral', name: 'Referral' },
    { path: '/market/crossing-republik', name: 'Market Crossing Republik' },
  ];

  const authPages = [
    { path: '/dashboard', name: 'Dashboard (unauthed)' },
    { path: '/dashboard/admin', name: 'Admin (unauthed)' },
  ];

  for (const { path, name } of pages) {
    test(`load ${name} (${path})`, async ({ page }) => {
      const errors: string[] = [];
      const failedRequests: { url: string; status: number }[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('response', (res) => {
        if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status() });
      });

      const start = Date.now();
      const resp = await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
      const loadTime = Date.now() - start;

      console.log(`\n=== ${name} (${path}) ===`);
      console.log(`  Status: ${resp?.status()}`);
      console.log(`  Load time: ${loadTime}ms`);
      if (errors.length) console.log(`  Console errors: ${errors.join(' | ')}`);
      if (failedRequests.length) console.log(`  Failed requests: ${JSON.stringify(failedRequests)}`);

      expect(resp?.status()).toBeLessThan(500);
    });
  }

  for (const { path, name } of authPages) {
    test(`load ${name} (${path})`, async ({ page }) => {
      const errors: string[] = [];
      const failedRequests: { url: string; status: number }[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('response', (res) => {
        if (res.status() >= 400) failedRequests.push({ url: res.url(), status: res.status() });
      });

      const resp = await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });

      console.log(`\n=== ${name} (${path}) ===`);
      console.log(`  Status: ${resp?.status()}`);
      if (errors.length) console.log(`  Console errors: ${errors.join(' | ')}`);
      if (failedRequests.length) console.log(`  Failed requests: ${JSON.stringify(failedRequests)}`);

      // Auth pages should redirect to login (302/307) or return 401
      expect([200, 302, 307, 401]).toContain(resp?.status());
    });
  }
});
