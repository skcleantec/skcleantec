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
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, '..');
const MAX_P3018_RETRIES = 20;

/** UTF-8 BOM(EF BB BF)이면 Postgres가 첫 식별자를 깨뜨려 마이그레이션이 실패한다. */
function assertMigrationSqlNoBom() {
  const migrationsDir = join(serverRoot, 'prisma', 'migrations');
  const bad = [];
  for (const d of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!d.isDirectory() || !/^\d{14}_/.test(d.name)) continue;
    const sqlPath = join(migrationsDir, d.name, 'migration.sql');
    let buf;
    try {
      buf = readFileSync(sqlPath);
    } catch {
      continue;
    }
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      bad.push(`${d.name}/migration.sql`);
    }
  }
  if (bad.length > 0) {
    console.error(
      '[railway-predeploy-migrate] migration SQL has UTF-8 BOM (must be UTF-8 without BOM):\n' +
        bad.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }
}

function runCapture(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: serverRoot,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const stdout = r.stdout?.toString() ?? '';
  const stderr = r.stderr?.toString() ?? '';
  const out = [stdout, stderr].filter(Boolean).join('\n');
  return { ok: r.status === 0, status: r.status ?? 1, out, stdout, stderr };
}

/**
 * migrate deploy(및 resolve --applied 복구) 후 DB ↔ schema.prisma 드리프트 검사.
 * Prisma: empty=0, error=1, not empty=2 (`--exit-code`).
 *
 * 인덱스 rename·timestamp 기본값 등 레거시 잡음은 경고만 하고 통과.
 * resolve --applied 로 컬럼이 빠진 사고(ADD/DROP COLUMN·CREATE/DROP TABLE)만 exit 1.
 */
const CRITICAL_DRIFT_RE =
  /\b(?:ADD|DROP)\s+COLUMN\b|\b(?:CREATE|DROP)\s+TABLE\b|\bCREATE\s+TYPE\b|\bDROP\s+TYPE\b/i;

function assertNoSchemaDriftAfterMigrate() {
  const r = runCapture('npx', [
    'prisma',
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
    '--exit-code',
  ]);
  if (r.status === 0) {
    console.log('prisma migrate diff: ok (no drift)');
    return;
  }
  if (r.status === 2) {
    const sql = (r.stdout || '').trim() || (r.out || '').trim();
    if (CRITICAL_DRIFT_RE.test(sql)) {
      console.error(
        '[railway-predeploy-migrate] critical schema drift after migrate deploy — refusing deploy (previous release stays live)',
      );
      if (sql) console.error(sql);
      process.exit(1);
    }
    console.warn(
      '[railway-predeploy-migrate] non-critical schema drift (indexes/defaults/renames) — deploy continues; diff follows',
    );
    if (sql) console.warn(sql);
    return;
  }
  console.error('[railway-predeploy-migrate] prisma migrate diff failed');
  console.error(r.out);
  process.exit(1);
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
      assertNoSchemaDriftAfterMigrate();
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
  assertMigrationSqlNoBom();

  const first = migrateDeploy();
  if (first.ok) {
    console.log('prisma migrate deploy: ok');
    assertNoSchemaDriftAfterMigrate();
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
