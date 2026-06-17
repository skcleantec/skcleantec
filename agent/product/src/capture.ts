import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { PageDef, Role } from './pages.js';

const SCREENSHOT_DIR = path.resolve(import.meta.dirname, '..', 'output', 'assets', 'screenshots');

export interface CaptureResult {
  page: PageDef;
  /** 메인 스크린샷 파일 경로 */
  screenshotPath: string;
  /** 추가 캡처 (모달, 패널 등) */
  extraScreenshots: Array<{ title: string; path: string; hint?: string }>;
  /** 에러가 있으면 채워짐 */
  error?: string;
}

export interface Credentials {
  baseUrl: string;
  tenantSlug: string;
  adminId: string;
  adminPassword: string;
  teamLoginId: string;
  teamPassword: string;
}

function screenshotFilename(role: Role, module: string, title: string, suffix = ''): string {
  const safe = (s: string) =>
    s.replace(/[\/\\:*?"<>|·\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${safe(role)}_${safe(module)}_${safe(title)}${suffix}.png`;
}

async function loginAdmin(page: Page, creds: Credentials): Promise<void> {
  await page.goto(`${creds.baseUrl}/admin/login`, { waitUntil: 'networkidle' });

  // 업체 코드 필드 (#login-tenant)
  const tenantField = await page.$('#login-tenant');
  if (tenantField) await tenantField.fill(creds.tenantSlug);

  // 아이디 필드 (#login-id)
  const idField =
    (await page.$('#login-id')) ??
    (await page.$('input[name="userId"]')) ??
    (await page.$('input[type="text"]:not(#login-tenant)'));
  const pwField = await page.$('input[type="password"]');
  if (!idField || !pwField) throw new Error('관리자 로그인 입력 필드를 찾을 수 없습니다.');

  await idField.fill(creds.adminId);
  await pwField.fill(creds.adminPassword);
  await pwField.press('Enter');
  await page.waitForURL(/\/admin\//, { timeout: 10_000 });
}

async function loginTeam(page: Page, creds: Credentials): Promise<void> {
  const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'output');
  const DEBUG_SHOT = path.join(OUTPUT_DIR, 'debug_team_login.png');

  async function fillAndSubmit(crewMode: boolean): Promise<void> {
    // /team/login 은 /login 으로 리다이렉트됨 (App.tsx 참조)
    await page.goto(`${creds.baseUrl}/login`, { waitUntil: 'networkidle' });

    if (crewMode) {
      const toggle = await page.$('button[role="switch"]');
      if (toggle) {
        const checked = await toggle.getAttribute('aria-checked');
        if (checked !== 'true') {
          await toggle.click();
          await page.waitForTimeout(400);
        }
      }
    }

    const tenantField = await page.$('#login-tenant');
    if (tenantField) await tenantField.fill(creds.tenantSlug);

    const loginIdField =
      (await page.$('#login-id')) ??
      (await page.$('input[type="text"]:not([id="login-tenant"])'));
    const pwField = await page.$('input[type="password"]');
    if (!loginIdField || !pwField) throw new Error('로그인 폼 필드를 찾을 수 없습니다.');

    await loginIdField.fill(creds.teamLoginId);
    await pwField.fill(creds.teamPassword);

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else await pwField.press('Enter');
  }

  // 1차: 일반 팀장 모드 (크루 모드 OFF) — /team/* 으로 이동하면 성공
  await fillAndSubmit(false);
  try {
    await page.waitForURL((url) => url.includes('/team/') || url.includes('/crew'), { timeout: 15_000 });
    return;
  } catch { /* 실패 → 크루 모드 시도 */ }

  // 2차: 크루 모드 (토글 ON) — /crew 로 이동하면 성공
  await fillAndSubmit(true);
  try {
    await page.waitForURL((url) => url.includes('/team/') || url.includes('/crew'), { timeout: 15_000 });
    return;
  } catch { /* 최종 실패 */ }

  // 디버그 스크린샷 저장
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await page.screenshot({ path: DEBUG_SHOT, fullPage: false });
  const currentUrl = page.url();
  throw new Error(
    `팀 로그인 실패 — 현재 URL: ${currentUrl}\n` +
    `디버그 스크린샷: ${DEBUG_SHOT}\n` +
    `.env 의 STAGING_TEAM_LOGIN_ID(${creds.teamLoginId}) / STAGING_TEAM_PASSWORD 를 확인하세요.`,
  );
}

async function capturePage(
  page: Page,
  pageDef: PageDef,
  creds: Credentials,
): Promise<CaptureResult> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const mainFilename = screenshotFilename(pageDef.role, pageDef.module, pageDef.title);
  const mainPath = path.join(SCREENSHOT_DIR, mainFilename);

  try {
    await page.goto(`${creds.baseUrl}${pageDef.path}`, { waitUntil: 'networkidle', timeout: 30_000 });

    if (pageDef.waitSelector) {
      await page.waitForSelector(pageDef.waitSelector, { timeout: 10_000 }).catch(() => {});
    }

    // 렌더링 안정화 대기 (SPA API 응답 후 렌더링까지 여유)
    await page.waitForTimeout(2_500);

    await page.screenshot({ path: mainPath, fullPage: true });

    const extraScreenshots: CaptureResult['extraScreenshots'] = [];

    if (pageDef.extraCaptures) {
      for (const extra of pageDef.extraCaptures) {
        const extraFilename = screenshotFilename(
          pageDef.role,
          pageDef.module,
          pageDef.title,
          `_${extra.title.replace(/\s+/g, '_')}`,
        );
        const extraPath = path.join(SCREENSHOT_DIR, extraFilename);
        try {
          if (extra.clickSelector) {
            const btn = await page.$(extra.clickSelector);
            if (btn) {
              await btn.click();
              if (extra.waitSelector) {
                await page.waitForSelector(extra.waitSelector, { timeout: 8_000 }).catch(() => {});
              }
              await page.waitForTimeout(800);
            }
          }
          await page.screenshot({ path: extraPath, fullPage: false });
          extraScreenshots.push({ title: extra.title, path: extraPath, hint: extra.hint });
        } catch {
          // 추가 캡처 실패는 무시하고 계속
        }
      }
    }

    return { page: pageDef, screenshotPath: mainPath, extraScreenshots };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // 에러 스크린샷 시도
    await page.screenshot({ path: mainPath, fullPage: false }).catch(() => {});
    return { page: pageDef, screenshotPath: mainPath, extraScreenshots: [], error: errMsg };
  }
}

export async function captureAll(
  pages: PageDef[],
  creds: Credentials,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<CaptureResult[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const results: CaptureResult[] = [];

  const adminPages = pages.filter((p) => p.role === 'admin');
  const teamPages = pages.filter((p) => p.role === 'team');

  // ── 관리자 세션 ──
  if (adminPages.length > 0) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ko-KR',
    });
    const page = await ctx.newPage();
    try {
      await loginAdmin(page, creds);
      for (let i = 0; i < adminPages.length; i++) {
        const pd = adminPages[i];
        onProgress?.(results.length, pages.length, `[관리자] ${pd.title}`);
        const result = await capturePage(page, pd, creds);
        results.push(result);
        if (result.error) {
          console.warn(`  ⚠ ${pd.title}: ${result.error}`);
        } else {
          console.log(`  ✓ ${pd.title}`);
        }
      }
    } finally {
      await ctx.close();
    }
  }

  // ── 팀장 세션 ──
  if (teamPages.length > 0) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },  // 모바일 뷰 (팀장 앱은 모바일 우선)
      locale: 'ko-KR',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    try {
      await loginTeam(page, creds);
      for (const pd of teamPages) {
        onProgress?.(results.length, pages.length, `[팀장] ${pd.title}`);
        const result = await capturePage(page, pd, creds);
        results.push(result);
        if (result.error) {
          console.warn(`  ⚠ ${pd.title}: ${result.error}`);
        } else {
          console.log(`  ✓ ${pd.title}`);
        }
      }
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  return results;
}
