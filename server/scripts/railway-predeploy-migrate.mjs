/**
 * Railway preDeploy: `prisma migrate deploy` + P3005(기존 DB에 마이그레이션 이력 없음) 복구.
 *
 * - 예전에는 `db push`만 쓴 운영 DB는 `_prisma_migrations`가 비어 있어 `migrate deploy`가 P3005로 중단될 수 있음.
 * - deploy 실패가 P3005면 스키마 차이를 diff로 보고 필요 시 `db push` 후
 *   모든 마이그레이션을 `migrate resolve --applied`로 기록한 뒤 다시 `migrate deploy` 한다.
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

function isP3018(text) {
  return /P3018|migration failed to apply|New migrations cannot be applied before the error is recovered/i.test(
    text
  );
}

function failedFieldDefinitionsMigration(text) {
  return /20260524180000_e_contract_field_definitions/.test(text);
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

function resolveRolledBack(name) {
  const r = runCapture('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', name]);
  if (r.ok) return;
  console.error(r.out);
  throw new Error(`migrate resolve --rolled-back ${name} failed`);
}

/** P3018 — ENUM 등 부분 적용 후 재시도 시 실패한 마이그레이션을 applied로 기록하고 recovery 마이그레이션으로 이어감 */
function recoverFailedFieldDefinitionsMigration() {
  const name = '20260524180000_e_contract_field_definitions';
  console.warn(
    `[railway-predeploy-migrate] P3018 on ${name} — mark applied, continue with recovery migration`
  );
  resolveApplied(name);
}

function main() {
  const first = migrateDeploy();
  if (first.ok) {
    console.log('prisma migrate deploy: ok');
    return;
  }

  console.error(first.out);

  if (isP3018(first.out) && failedFieldDefinitionsMigration(first.out)) {
    recoverFailedFieldDefinitionsMigration();
    const retry = migrateDeploy();
    if (!retry.ok) {
      console.error(retry.out);
      process.exit(1);
    }
    console.log('prisma migrate deploy: ok (after field-definitions P3018 recovery)');
    return;
  }

  if (!isP3005(first.out)) {
    process.exit(1);
  }

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

  const second = migrateDeploy();
  if (!second.ok) {
    console.error(second.out);
    process.exit(1);
  }
  console.log('prisma migrate deploy: ok (after baseline)');
}

main();
