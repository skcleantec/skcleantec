import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 루트 `.env` 후 `server/.env`(override) — 동일 키는 server 쪽이 우선, 루트에만 둔 키는 그대로 유지 */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

/**
 * 팀 로컬 기본: Railway staging Postgres 공개(Proxy) URL.
 * `server/.env.staging`(gitignore)이 있으면 DATABASE_URL 등을 덮어쓴다.
 * 절차: STAGING_SETUP.md · server/env.staging.template
 */
const stagingEnvPath = path.resolve(__dirname, '../.env.staging');
if (fs.existsSync(stagingEnvPath)) {
  dotenv.config({ path: stagingEnvPath, override: true });
}

/** 가이드 데모 시드를 운영 DB(cbiseo 테넌트)에 넣을 때 — server/.env 의 SKCT_TARGET_DATABASE_URL 사용 */
if (process.env.GUIDE_DEMO_TARGET_DB === 'production') {
  const prod = process.env.SKCT_TARGET_DATABASE_URL?.trim();
  if (prod) process.env.DATABASE_URL = prod;
}

const databaseUrl = (process.env.DATABASE_URL ?? '').trim();

/** `env.staging.template` 그대로 두면 Prisma가 "invalid port number" 로만 실패해 원인 파악이 어렵다 */
const stagingUrlLooksLikeTemplate =
  databaseUrl.includes('HOST.proxy.rlwy.net') ||
  databaseUrl.includes('@HOST.') ||
  /:PORT[/?]/.test(databaseUrl) ||
  databaseUrl.includes('USER:PASSWORD@');
if (fs.existsSync(stagingEnvPath) && stagingUrlLooksLikeTemplate) {
  console.error(
    '[env] server/.env.staging 의 DATABASE_URL이 아직 템플릿(USER/HOST/PORT)입니다.',
  );
  console.error(
    '[env] Railway staging → Postgres → Connect 에서 *.proxy.rlwy.net URL을 복사해 넣고 API를 재시작하세요. (STAGING_SETUP.md)',
  );
}

if (process.env.NODE_ENV !== 'production' && databaseUrl.includes('@localhost:5432')) {
  if (!fs.existsSync(stagingEnvPath)) {
    console.warn(
      '[env] DATABASE_URL이 localhost입니다. 팀 기본은 Railway staging Proxy DB입니다.',
    );
    console.warn(
      '[env] server/env.staging.template → server/.env.staging 복사 후 스테이징 URL을 넣고 API를 재시작하세요. (STAGING_SETUP.md)',
    );
  }
}

const telecrmAiLimitRaw = (process.env.TELECRM_AI_MONTHLY_LIMIT ?? '0').trim();
const telecrmAiLimitN = Number(telecrmAiLimitRaw);

function describeOpenAiKeySource(
  dedicatedEnv: string,
  dedicatedSet: boolean,
  fallbackSet: boolean,
): string {
  if (dedicatedSet) return `${dedicatedEnv} (전용)`;
  if (fallbackSet) return 'OPENAI_API_KEY (폴백 — 운영에서는 전용 키 권장)';
  return '미설정';
}

if (process.env.NODE_ENV !== 'production') {
  const quickPasteDedicated = Boolean((process.env.QUICK_PASTE_OPENAI_API_KEY || '').trim());
  const telecrmDedicated = Boolean((process.env.TELECRM_AI_OPENAI_API_KEY || '').trim());
  const openAiFallback = Boolean((process.env.OPENAI_API_KEY || '').trim());
  console.log(
    `[env] QUICK_PASTE OpenAI → ${describeOpenAiKeySource(
      'QUICK_PASTE_OPENAI_API_KEY',
      quickPasteDedicated,
      openAiFallback,
    )}`,
  );
  console.log(
    `[env] TELECRM_AI OpenAI → ${describeOpenAiKeySource(
      'TELECRM_AI_OPENAI_API_KEY',
      telecrmDedicated,
      openAiFallback,
    )}`,
  );
  console.log(
    `[env] TELECRM_AI_MONTHLY_LIMIT=${telecrmAiLimitRaw} → ${
      Number.isFinite(telecrmAiLimitN) && telecrmAiLimitN > 0 ? `${Math.floor(telecrmAiLimitN)}회/월` : '무제한'
    } (변경 후 API 재시작 필요 · 테넌트 meta aiMonthlyLimit 가 있으면 env보다 우선)`,
  );
}
