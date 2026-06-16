import 'dotenv/config';
import { ALL_PAGES } from './pages.js';
import { captureAll, type Credentials } from './capture.js';
import { buildHtmlSite } from './build-site.js';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'output');

// ────────────────────────────────────────
// 환경 변수
// ────────────────────────────────────────
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ 환경 변수 ${name} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
    process.exit(1);
  }
  return v;
}

// ────────────────────────────────────────
// CLI 모드 판별
// ────────────────────────────────────────
const args = process.argv.slice(2);
const MODE = args[0]; // 'capture' | 'build' | (없으면 full)
const ROLE_FILTER = args.find((a) => a.startsWith('--role='))?.split('=')[1];

// ────────────────────────────────────────
// capture 모드: 스크린샷만 찍고 manifest 저장
// ────────────────────────────────────────
async function runCapture() {
  const creds: Credentials = {
    baseUrl: requireEnv('STAGING_BASE_URL').replace(/\/$/, ''),
    tenantSlug: requireEnv('STAGING_TENANT_SLUG'),
    adminId: requireEnv('STAGING_ADMIN_ID'),
    adminPassword: requireEnv('STAGING_ADMIN_PASSWORD'),
    teamLoginId: requireEnv('STAGING_TEAM_LOGIN_ID'),
    teamPassword: requireEnv('STAGING_TEAM_PASSWORD'),
  };

  const pages = ALL_PAGES.filter((p) => !ROLE_FILTER || p.role === ROLE_FILTER);

  console.log('\n📸 화면 캡처 시작');
  console.log(`   대상: ${creds.baseUrl}`);
  console.log(`   페이지: ${pages.length}개\n`);

  const captures = await captureAll(pages, creds, (done, total, title) => {
    process.stdout.write(`\r   [${done}/${total}] ${title.padEnd(35)}`);
  });

  console.log(`\n\n   ✅ ${captures.filter((c) => !c.error).length}/${captures.length}개 캡처 완료`);

  // manifest 저장 (build 단계에서 읽음)
  const manifest = captures.map((c) => ({
    role: c.page.role,
    module: c.page.module,
    moduleOrder: c.page.moduleOrder,
    title: c.page.title,
    path: c.page.path,
    hint: c.page.hint,
    screenshotPath: c.screenshotPath,
    error: c.error,
  }));
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'captures.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  console.log(`\n🗂  captures.json 저장 완료: ${path.join(OUTPUT_DIR, 'captures.json')}`);
  console.log('\n👉 다음 단계:');
  console.log('   Claude Code에게 스크린샷 설명을 요청하고 descriptions.json을 생성하세요.');
  console.log('   (agent/product/README.md 의 "Claude Code로 설명 생성" 섹션 참고)\n');
}

// ────────────────────────────────────────
// build 모드: captures.json + descriptions.json → HTML
// ────────────────────────────────────────
async function runBuild() {
  const capturesPath = path.join(OUTPUT_DIR, 'captures.json');
  const descriptionsPath = path.join(OUTPUT_DIR, 'descriptions.json');

  if (!fs.existsSync(capturesPath)) {
    console.error('❌ captures.json 이 없습니다. 먼저 npm run capture 를 실행하세요.');
    process.exit(1);
  }

  type ManifestItem = {
    role: 'admin' | 'team';
    module: string;
    moduleOrder: number;
    title: string;
    path: string;
    hint?: string;
    screenshotPath: string;
    error?: string;
  };

  const manifest: ManifestItem[] = JSON.parse(fs.readFileSync(capturesPath, 'utf-8'));

  // descriptions.json은 없어도 됨 (없으면 빈 설명으로 HTML 생성)
  let rawDescs: Record<string, { summary: string; markdown: string }> = {};
  if (fs.existsSync(descriptionsPath)) {
    rawDescs = JSON.parse(fs.readFileSync(descriptionsPath, 'utf-8'));
    console.log(`📄 descriptions.json 로드: ${Object.keys(rawDescs).length}개 설명`);
  } else {
    console.log('ℹ  descriptions.json 없음 → 스크린샷만으로 HTML 생성 (설명 없음)');
  }

  const descriptions = new Map(Object.entries(rawDescs));

  // captures.json → CaptureResult 형태로 변환
  const captures = manifest.map((m) => ({
    page: {
      role: m.role,
      module: m.module,
      moduleOrder: m.moduleOrder,
      title: m.title,
      path: m.path,
      hint: m.hint,
    } as import('./pages.js').PageDef,
    screenshotPath: m.screenshotPath,
    extraScreenshots: [] as { title: string; path: string }[],
    error: m.error,
  }));

  console.log('\n🏗  HTML 사이트 생성 중...');
  buildHtmlSite(captures, descriptions, new Date());
}

// ────────────────────────────────────────
// 메인
// ────────────────────────────────────────
async function main() {
  if (MODE === 'capture') {
    await runCapture();
  } else if (MODE === 'build') {
    await runBuild();
  } else {
    console.error('사용법: node src/index.ts capture | build');
    console.error('  npm run capture  — 스크린샷 캡처');
    console.error('  npm run build    — HTML 사이트 생성');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n❌ 오류:', e);
  process.exit(1);
});
