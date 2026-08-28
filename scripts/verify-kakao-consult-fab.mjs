/**
 * Verify marketing Kakao consult FAB on PC viewport.
 * Usage: node scripts/verify-kakao-consult-fab.mjs [baseUrl]
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const baseUrl = process.argv[2]?.trim() || 'http://127.0.0.1:3000';
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(resolve(__dirname, '../agent/product/node_modules/playwright'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  const initRes = await page.goto(`${baseUrl}/marketing/kakao-init.js`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  if (!initRes?.ok()) throw new Error(`kakao-init.js HTTP ${initRes?.status()}`);

  const pagePath = process.argv[3]?.trim() || '/';
  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#cbiseo-kakao-consult-fab', { timeout: 10000 });

  const fab = await page.evaluate(() => {
    const el = document.getElementById('cbiseo-kakao-consult-fab');
    if (!el) return { ok: false, error: 'missing fab' };
    const style = window.getComputedStyle(el);
    return {
      ok: style.display !== 'none' && style.visibility !== 'hidden',
      display: style.display,
      label: el.getAttribute('aria-label'),
      hasIcon: !!el.querySelector('img'),
    };
  });

  console.log(JSON.stringify({ ok: fab.ok, baseUrl, pagePath, fab }, null, 2));
  process.exit(fab.ok ? 0 : 1);
} catch (e) {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await browser.close();
}
