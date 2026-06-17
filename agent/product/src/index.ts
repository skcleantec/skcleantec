import 'dotenv/config';
import { ALL_PAGES } from './pages.js';
import { captureAll, type Credentials } from './capture.js';
import { buildHelpSite } from './build-site.js';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'output');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ 환경 변수 ${name} 가 설정되지 않았습니다. .env 파일을 확인하세요.`);
    process.exit(1);
  }
  return v;
}

const args = process.argv.slice(2);
const MODE = args[0];
const ROLE_FILTER = args.find((a) => a.startsWith('--role='))?.split('=')[1];

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

  const ok = captures.filter((c) => !c.error).length;
  console.log(`\n\n   ✅ ${ok}/${captures.length}개 캡처 완료`);

  // captures.json 저장 — build 단계에서 읽음
  const manifest = captures.map((c) => ({
    role: c.page.role,
    module: c.page.module,
    moduleOrder: c.page.moduleOrder,
    title: c.page.title,
    path: c.page.path,
    screenshotFile: path.basename(c.screenshotPath), // 파일명만 저장
    error: c.error,
  }));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'captures.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  console.log(`\n🗂  captures.json 저장: ${path.join(OUTPUT_DIR, 'captures.json')}`);
  console.log('\n👉 다음 단계: 이 채팅에서 스크린샷 설명 생성을 요청하세요.\n');
}

async function runBuild() {
  console.log('\n🏗  도움말 데이터 생성 중...');
  await buildHelpSite();
  console.log('✅ 완료\n');
}

async function main() {
  if (MODE === 'capture') {
    await runCapture();
  } else if (MODE === 'build') {
    await runBuild();
  } else {
    console.error('사용법:');
    console.error('  npm run capture  — 스크린샷 캡처');
    console.error('  npm run build    — 도움말 데이터 생성');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n❌ 오류:', e.message ?? e);
  process.exit(1);
});
