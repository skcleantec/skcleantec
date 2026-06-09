import { config } from '../../config/index.js';

/** 운영(소스) DB URL에 sslmode 보강 — 값만 반환, 로깅 금지 */
export function ensureDatabaseUrlSslMode(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/[?&]sslmode=/i.test(u)) return u;
  return u.includes('?') ? `${u}&sslmode=require` : `${u}?sslmode=require`;
}

/** host:port/dbname — 비밀번호·쿼리 제외, 소스=대상 동일 여부 판별용 */
export function databaseUrlIdentity(url: string): string {
  const u = url.trim();
  const m = u.match(/^postgres(?:ql)?:\/\/[^@]*@([^/?]+)\/([^?]+)/i);
  if (m) {
    const hostPort = m[1]!.toLowerCase();
    const db = m[2]!.replace(/\/$/, '').toLowerCase();
    return `${hostPort}/${db}`;
  }
  return u.replace(/[?&]sslmode=[^&]*/gi, '').toLowerCase();
}

export function assertDistinctSourceAndTarget(sourceUrl: string, targetUrl: string): string | null {
  const a = databaseUrlIdentity(sourceUrl);
  const b = databaseUrlIdentity(targetUrl);
  if (a && b && a === b) {
    return (
      '소스 DB와 대상 DB가 동일합니다. Railway 스테이징 서비스에 ' +
      'STAGING_DB_IMPORT_SOURCE_DATABASE_URL 을 **운영(메인) Postgres 공개 Proxy URL**로 설정했는지 확인하세요. ' +
      '대상은 이 서비스의 DATABASE_URL(스테이징)입니다.'
    );
  }
  return null;
}

const VERIFY_TABLES = ['tenants', 'users', 'inquiries'] as const;

export type TableCountLine = { table: (typeof VERIFY_TABLES)[number]; source: number; target: number };

/** pg_restore stderr에 치명 오류 패턴이 많으면 실패로 본다 */
export function pgRestoreLooksFailed(exitCode: number, stderr: string, stdout: string): string | null {
  const combined = `${stderr}\n${stdout}`;
  const errorLines = combined
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^ERROR:/i.test(l) || /\bFATAL:/i.test(l));

  if (exitCode >= 2) {
    return `pg_restore 종료 코드 ${exitCode}`;
  }
  if (exitCode === 1 && errorLines.length >= 3) {
    const sample = errorLines.slice(0, 5).join('\n');
    return `pg_restore 경고가 과다합니다(${errorLines.length}건). 데이터가 들어가지 않았을 수 있습니다.\n${sample}`;
  }
  const hardFail = errorLines.find(
    (l) =>
      /could not connect/i.test(l) ||
      /connection refused/i.test(l) ||
      /password authentication failed/i.test(l) ||
      /no such file or directory/i.test(l) ||
      /server version mismatch/i.test(l),
  );
  if (hardFail) return hardFail;
  return null;
}

export function formatTableCountSummary(lines: TableCountLine[]): string {
  return lines.map((l) => `${l.table}: 소스 ${l.source} → 대상 ${l.target}`).join('\n');
}

export function verifyTableCounts(lines: TableCountLine[]): string | null {
  const byTable = Object.fromEntries(lines.map((l) => [l.table, l])) as Partial<
    Record<TableCountLine['table'], TableCountLine>
  >;
  const inquiries = byTable.inquiries;

  if (inquiries && inquiries.source > 0 && inquiries.target === 0) {
    return (
      '복원 검증 실패 — inquiries(접수)가 비어 있습니다. ' +
      'pg_restore가 데이터를 넣지 못했거나 소스 URL이 잘못되었을 수 있습니다.'
    );
  }
  if (inquiries && inquiries.source > 0 && inquiries.target !== inquiries.source) {
    return (
      `복원 검증 실패 — inquiries 건수 불일치(소스 ${inquiries.source}, 대상 ${inquiries.target}). ` +
      '운영 데이터가 스테이징에 반영되지 않았습니다.'
    );
  }

  for (const { table, source, target } of lines) {
    if (table === 'inquiries') continue;
    if (source > 0 && target === 0) {
      return (
        `복원 검증 실패 — ${table} 테이블이 비어 있습니다(소스 ${source}건). ` +
        'pg_restore가 메타 테이블을 넣지 못했을 수 있습니다.'
      );
    }
    if (source > 0 && target !== source) {
      const hint =
        inquiries && inquiries.source > 0 && inquiries.target === inquiries.source
          ? ' 접수(inquiries)는 일치하지만 스테이징에 이전 검증·테스트 데이터(tenant/user)가 남아 있을 수 있습니다. public 스키마 초기화 후 복원하도록 수정되었으니 다시 시도해 주세요.'
          : ' 운영·스테이징 DB URL 설정과 pg_restore 로그를 확인하세요.';
      return `복원 검증 실패 — ${table} 건수 불일치(소스 ${source}, 대상 ${target}).${hint}`;
    }
  }
  return null;
}

/** 스테이징 public 스키마 전체 삭제 — --clean 만으로는 남는 검증용 tenant/user 제거 */
export const WIPE_TARGET_PUBLIC_SCHEMA_SQL = `
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
`.trim();

export async function queryPgCount(
  runPsql: (dbUrl: string, sql: string) => Promise<{ code: number; stdout: string; stderr: string }>,
  dbUrl: string,
  table: string,
): Promise<number> {
  const res = await runPsql(
    dbUrl,
    `SELECT COUNT(*)::bigint AS c FROM "${table}"`,
  );
  if (res.code !== 0) {
    throw new Error(`psql COUNT(${table}) 실패: ${res.stderr.trim() || res.stdout.trim() || `exit ${res.code}`}`);
  }
  const n = Number.parseInt(res.stdout.trim(), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`psql COUNT(${table}) 결과 파싱 실패`);
  }
  return n;
}

export async function collectVerifyTableCounts(
  runPsql: (dbUrl: string, sql: string) => Promise<{ code: number; stdout: string; stderr: string }>,
  sourceUrl: string,
  targetUrl: string,
): Promise<TableCountLine[]> {
  const lines: TableCountLine[] = [];
  for (const table of VERIFY_TABLES) {
    const [source, target] = await Promise.all([
      queryPgCount(runPsql, sourceUrl, table),
      queryPgCount(runPsql, targetUrl, table),
    ]);
    lines.push({ table, source, target });
  }
  return lines;
}

export function userMayUseStagingDbImport(role: string | undefined, email: string | undefined): boolean {
  if (!config.stagingDbImport.enabled) return false;
  if (role !== 'ADMIN') return false;
  const em = (email ?? '').toLowerCase();
  const sub = config.stagingDbImport.operatorEmailSubstring.toLowerCase();
  return sub.length > 0 && em.includes(sub);
}

/**
 * 플랫폼 운영자(소유자) 판별 — 스테이징 import 활성화 여부와 무관(운영에서도 true).
 * 인프라 진단(볼륨 상태 등) 노출 게이트로 사용. ADMIN + 운영자 이메일 substring.
 */
export function userIsPlatformOperator(role: string | undefined, email: string | undefined): boolean {
  if (role !== 'ADMIN') return false;
  const em = (email ?? '').toLowerCase();
  const sub = config.stagingDbImport.operatorEmailSubstring.toLowerCase();
  return sub.length > 0 && em.includes(sub);
}
