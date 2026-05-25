/**
 * Railway preDeploy: `prisma migrate deploy` + 복구 경로.
 *
 * - P3005: 예전 `db push`만 쓴 DB — diff 후 필요 시 push + baseline.
 * - P3018 / P3009: 부분 적용·실패 기록된 마이그레이션 — 이름을 파싱해 `resolve --applied` 후 재시도
 *   (직후 idempotent recovery 마이그레이션이 있으면 deploy가 이어서 적용).
 *
 * Node 전용(.mjs): Railway production에서 devDependency(tsx) 없이 동작.
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const MAX_P3018_RETRIES = 20;

function runCapture(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: serverRoot,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const stdout = r.stdout?.toString() ?? '';
  const stderr = r.stderr?.toString() ?? '';
  const out = [stdout, stderr].filter(Boolean).join('\n');
  return { ok: r.status === 0, out, stdout, stderr };
}

function migrateDeploy() {
  return runCapture('npx', ['prisma', 'migrate', 'deploy']);
}

function isP3005(text) {
  return /P3005|database schema is not empty|schema is not empty/i.test(text);
}

function isAlreadyResolved(text) {
  return /P3008|already recorded|already applied|already been applied/i.test(text);
}

function isP3018(text) {
  return isFailedMigrationBlock(text);
}

function isFailedMigrationBlock(text) {
  return /P3018|P3009|migration failed to apply|failed migrations in the target database|New migrations cannot be applied before the error is recovered/i.test(
    text
  );
}

/** deploy stderr/stdout에서 실패한 마이그레이션 폴더명 추출 */
function parseFailedMigrationName(text) {
  const patterns = [
    /Migration name:\s*(\d{14}_[^\s\r\n]+)/i,
    /Applying migration [`'](\d{14}_[^`']+)[`']/i,
    /The [`'](\d{14}_[^`']+)[`'] migration/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/** DB(데이터소스) → schema.prisma: stdout만 SQL로 사용 */
function schemaDriftSql() {
  const r = runCapture('npx', [
    'prisma',
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ]);
  return {
    ok: r.ok,
    sql: r.ok ? r.stdout.trim() : '',
    diag: r.ok ? r.stderr.trim() : r.out,
  };
}

function meaningfulSql(sql) {
  const nonComment = sql
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('--'));
  return nonComment.length > 0;
}

function listMigrationNames() {
  const migrationsDir = join(serverRoot, 'prisma', 'migrations');
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function resolveApplied(name) {
  const r = runCapture('npx', ['prisma', 'migrate', 'resolve', '--applied', name]);
  if (r.ok) return;
  if (isAlreadyResolved(r.out)) return;
  console.error(r.out);
  throw new Error(`migrate resolve --applied ${name} failed`);
}

function baselineAllMigrations() {
  const names = listMigrationNames();
  for (const name of names) {
    resolveApplied(name);
  }
  console.warn(`[railway-predeploy-migrate] marked ${names.length} migrations as applied (baseline).`);
}

function dbPushAcceptLoss() {
  console.warn('[railway-predeploy-migrate] schema drift → prisma db push --accept-data-loss');
  const r = runCapture('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
  if (!r.ok) {
    console.error(r.out);
    process.exit(1);
  }
}

/** P3018/P3009 — 실패·부분 적용 마이그레이션을 applied로 기록하고 deploy 재시도 */
function recoverFromFailedMigration(text) {
  const name = parseFailedMigrationName(text);
  if (!name) {
    console.error('[railway-predeploy-migrate] failed migration detected but could not parse migration name');
    return false;
  }
  console.warn(
    `[railway-predeploy-migrate] failed migration ${name} — mark applied, retry deploy (recovery migration may follow)`
  );
  resolveApplied(name);
  return true;
}

function runMigrateDeployWithP3018Recovery() {
  for (let attempt = 0; attempt <= MAX_P3018_RETRIES; attempt++) {
    const r = migrateDeploy();
    if (r.ok) {
      if (attempt === 0) {
        console.log('prisma migrate deploy: ok');
      } else {
        console.log(`prisma migrate deploy: ok (after ${attempt} P3018 recovery step(s))`);
      }
      return true;
    }

    console.error(r.out);

    if (isFailedMigrationBlock(r.out) && attempt < MAX_P3018_RETRIES && recoverFromFailedMigration(r.out)) {
      continue;
    }

    return false;
  }

  console.error(`[railway-predeploy-migrate] exceeded ${MAX_P3018_RETRIES} P3018 recovery attempts`);
  return false;
}

function handleP3005Baseline() {
  console.warn('[railway-predeploy-migrate] P3005 — attempting baseline for DB without migrate history');

  const drift = schemaDriftSql();
  if (!drift.ok) {
    console.error(drift.diag);
    process.exit(1);
  }
  if (drift.diag) console.warn(drift.diag);

  if (meaningfulSql(drift.sql)) {
    dbPushAcceptLoss();
  } else {
    console.warn('[railway-predeploy-migrate] no drift vs schema.prisma; recording migrations only.');
  }

  baselineAllMigrations();

  if (runMigrateDeployWithP3018Recovery()) {
    console.log('prisma migrate deploy: ok (after baseline)');
  } else {
    process.exit(1);
  }
}

function main() {
  const first = migrateDeploy();
  if (first.ok) {
    console.log('prisma migrate deploy: ok');
    return;
  }

  console.error(first.out);

  if (isFailedMigrationBlock(first.out)) {
    if (!recoverFromFailedMigration(first.out)) {
      process.exit(1);
    }
    if (runMigrateDeployWithP3018Recovery()) {
      return;
    }
    process.exit(1);
  }

  if (!isP3005(first.out)) {
    process.exit(1);
  }

  handleP3005Baseline();
}

main();
