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

const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
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
