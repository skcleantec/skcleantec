/**
 * One-off: verify Kakao JS SDK init + Channel.chat on www.cbiseo.com
 * Usage: node scripts/verify-kakao-channel-sdk.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadJsKey() {
  const envPath = resolve(__dirname, '../server/.env');
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^KAKAO_JAVASCRIPT_KEY=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

const jsKey = loadJsKey();
if (!jsKey) {
  console.error('FAIL: KAKAO_JAVASCRIPT_KEY not found in server/.env');
  process.exit(1);
}

const productDir = resolve(__dirname, '../agent/product');
const { chromium } = require(resolve(productDir, 'node_modules/playwright'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleLines = [];
page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.message}`));

try {
  await page.goto('https://www.cbiseo.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({
    url: 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js',
  });
  await page.waitForFunction(() => typeof window.Kakao !== 'undefined', { timeout: 15000 });

  const result = await page.evaluate((key) => {
    const out = { origin: location.origin, initialized: false, chatCallable: false, errors: [] };
    try {
      window.Kakao.init(key);
      out.initialized = window.Kakao.isInitialized();
      if (!out.initialized) {
        out.errors.push('Kakao.isInitialized() returned false');
        return out;
      }
      if (!window.Kakao.Channel || typeof window.Kakao.Channel.chat !== 'function') {
        out.errors.push('Kakao.Channel.chat is not available');
        return out;
      }
      out.chatCallable = true;
      window.Kakao.Channel.chat({ channelPublicId: '_vnxjSX' });
      return out;
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
      return out;
    }
  }, jsKey);

  const ok = result.initialized && result.chatCallable && result.errors.length === 0;
  console.log(JSON.stringify({ ok, result, consoleLines: consoleLines.slice(0, 20) }, null, 2));
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  if (consoleLines.length) console.error('console:', consoleLines.slice(0, 20).join('\n'));
  process.exit(1);
} finally {
  await browser.close();
}
