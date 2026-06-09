import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import {
  assertDistinctSourceAndTarget,
  collectVerifyTableCounts,
  ensureDatabaseUrlSslMode,
  formatTableCountSummary,
  pgRestoreLooksFailed,
  userMayUseStagingDbImport,
  verifyTableCounts,
} from './stagingDbImport.helpers.js';

type JobStatus = 'queued' | 'dumping' | 'restoring' | 'migrating' | 'verifying' | 'done' | 'failed';

function resolveServerRoot(): string {
  const fromModule = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  return fromModule;
}

const SERVER_ROOT = resolveServerRoot();
const MIN_DUMP_BYTES = 8 * 1024;

type ImportJob = {
  status: JobStatus;
  message?: string;
  startedAt: string;
  finishedAt?: string;
};

const jobs = new Map<string, ImportJob>();

function runCmd(
  exe: string,
  args: string[],
  cwd: string = SERVER_ROOT,
): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let stderr = '';
    let stdout = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });
}

async function runPsql(dbUrl: string, sql: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const res = await runCmd('psql', [
    `--dbname=${ensureDatabaseUrlSslMode(dbUrl)}`,
    '-v',
    'ON_ERROR_STOP=1',
    '-t',
    '-A',
    '-c',
    sql,
  ]);
  return { code: res.code, stdout: res.stdout, stderr: res.stderr };
}

/** 사용자에게 보여 줄 오류 요약(비밀번호 등은 보통 stderr에 안 나옴). */
function formatToolFailure(tool: string, code: number, stderr: string, stdout: string): string {
  const combined = `${stderr.trim()}\n${stdout.trim()}`.trim();
  const max = 1600;
  const snippet = combined.length > max ? `…\n${combined.slice(-max)}` : combined || '(출력 없음)';
  return `${tool} 실패 (종료 코드 ${code}).\n${snippet}`;
}

function anyJobRunning(): boolean {
  for (const j of jobs.values()) {
    if (
      j.status === 'queued' ||
      j.status === 'dumping' ||
      j.status === 'restoring' ||
      j.status === 'migrating' ||
      j.status === 'verifying'
    ) {
      return true;
    }
  }
  return false;
}

/** 운영 DB 복원 뒤 스테이징 코드(멀티테넌트)와 스키마를 맞춤 */
async function runPostRestoreSchemaSync(job: ImportJob): Promise<string | null> {
  job.status = 'migrating';
  job.message = '복원 후 스키마 마이그레이션 적용 중…';

  const migrate = await runCmd('node', ['scripts/railway-predeploy-migrate.mjs']);
  if (migrate.code !== 0) {
    return formatToolFailure('migrate deploy', migrate.code, migrate.stderr, migrate.stdout);
  }

  job.message = '접수번호·카운터 보정 중…';
  const backfill = await runCmd('node', ['scripts/run-backfill-inquiry-numbers.mjs']);
  if (backfill.code !== 0) {
    return formatToolFailure('backfill-inquiry-numbers', backfill.code, backfill.stderr, backfill.stdout);
  }

  return null;
}

async function verifyRestoredData(
  job: ImportJob,
  sourceUrl: string,
  targetUrl: string,
): Promise<{ error: string | null; summary: string | null }> {
  job.status = 'verifying';
  job.message = '복원 데이터 검증 중…(tenants·users·inquiries 건수)';

  try {
    const lines = await collectVerifyTableCounts(runPsql, sourceUrl, targetUrl);
    const summary = formatTableCountSummary(lines);
    const err = verifyTableCounts(lines);
    return { error: err, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: `복원 검증 쿼리 실패: ${msg}`,
      summary: null,
    };
  }
}

async function executeImportJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const sourceRaw = config.stagingDbImport.sourceDatabaseUrl;
  const targetRaw = process.env.DATABASE_URL ?? '';
  if (!sourceRaw || !targetRaw) {
    job.status = 'failed';
    job.message = 'DATABASE_URL 또는 STAGING_DB_IMPORT_SOURCE_DATABASE_URL이 설정되어 있지 않습니다.';
    job.finishedAt = new Date().toISOString();
    return;
  }

  const sourceUrl = ensureDatabaseUrlSslMode(sourceRaw);
  const targetUrl = ensureDatabaseUrlSslMode(targetRaw);

  const sameDbErr = assertDistinctSourceAndTarget(sourceUrl, targetUrl);
  if (sameDbErr) {
    job.status = 'failed';
    job.message = sameDbErr;
    job.finishedAt = new Date().toISOString();
    return;
  }

  const dumpPath = path.join(os.tmpdir(), `skct-import-${jobId}.dump`);

  try {
    job.status = 'dumping';
    job.message = '운영 DB 덤프 중…';
    const dump = await runCmd('pg_dump', [
      `--dbname=${sourceUrl}`,
      '-Fc',
      '-f',
      dumpPath,
      '--no-owner',
      '--no-acl',
    ]);
    if (dump.code !== 0) {
      job.status = 'failed';
      job.message = formatToolFailure('pg_dump', dump.code, dump.stderr, dump.stdout);
      job.finishedAt = new Date().toISOString();
      await fs.unlink(dumpPath).catch(() => {});
      return;
    }

    const stat = await fs.stat(dumpPath);
    if (stat.size < MIN_DUMP_BYTES) {
      job.status = 'failed';
      job.message =
        `pg_dump 결과가 비정상적으로 작습니다(${stat.size} bytes). ` +
        'STAGING_DB_IMPORT_SOURCE_DATABASE_URL이 운영 DB 공개 Proxy URL인지 확인하세요.';
      job.finishedAt = new Date().toISOString();
      await fs.unlink(dumpPath).catch(() => {});
      return;
    }

    job.status = 'restoring';
    job.message = `스테이징 DB 복원 중… (덤프 ${Math.round(stat.size / 1024)} KB, 수 분 걸릴 수 있습니다)`;

    await prisma.$disconnect();

    try {
      const restore = await runCmd('pg_restore', [
        '--exit-on-error',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        `--dbname=${targetUrl}`,
        dumpPath,
      ]);

      const restoreErr = pgRestoreLooksFailed(restore.code, restore.stderr, restore.stdout);
      if (restoreErr) {
        job.status = 'failed';
        job.message = `${restoreErr}\n\n${formatToolFailure('pg_restore', restore.code, restore.stderr, restore.stdout)}`;
      } else {
        const verify = await verifyRestoredData(job, sourceUrl, targetUrl);
        if (verify.error) {
          job.status = 'failed';
          job.message = verify.summary
            ? `${verify.error}\n\n${verify.summary}`
            : verify.error;
        } else {
          const syncErr = await runPostRestoreSchemaSync(job);
          if (syncErr) {
            job.status = 'failed';
            job.message = verify.summary ? `${syncErr}\n\n검증(복원 직후):\n${verify.summary}` : syncErr;
          } else {
            job.status = 'done';
            const verifyLine = verify.summary ? `\n\n검증:\n${verify.summary}` : '';
            job.message =
              restore.code === 1
                ? `복원·마이그레이션 완료(복원 중 일부 경고). 페이지를 새로고침해 확인하세요.${verifyLine}`
                : `복원·마이그레이션 완료. 페이지를 새로고침해 확인하세요.${verifyLine}`;
          }
        }
      }
    } finally {
      await prisma.$connect().catch(() => {});
    }

    await fs.unlink(dumpPath).catch(() => {});
  } catch (e) {
    job.status = 'failed';
    job.message = e instanceof Error ? e.message : String(e);
    await prisma.$connect().catch(() => {});
    await fs.unlink(dumpPath).catch(() => {});
  }

  job.finishedAt = new Date().toISOString();
}

const router = Router();

router.post('/staging-db-import/start', authMiddleware, adminOnly, async (req: Request, res: Response) => {
  const user = (req as Request & { user: AuthPayload }).user;
  if (!userMayUseStagingDbImport(user.role, user.email)) {
    res.status(403).json({ error: '이 기능을 사용할 수 없습니다.' });
    return;
  }
  if (!config.stagingDbImport.enabled) {
    res.status(403).json({ error: '스테이징 DB 가져오기 기능이 비활성화되어 있습니다.' });
    return;
  }

  const password = (req.body as { password?: string })?.password;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
    return;
  }

  if (anyJobRunning()) {
    res.status(409).json({ error: '이미 진행 중인 가져오기 작업이 있습니다. 완료 후 다시 시도해 주세요.' });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  });
  if (!dbUser) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const ok = await bcrypt.compare(password, dbUser.passwordHash);
  if (!ok) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const jobId = randomUUID();
  jobs.set(jobId, {
    status: 'queued',
    message: '작업 대기 중…',
    startedAt: new Date().toISOString(),
  });

  setImmediate(() => {
    void executeImportJob(jobId);
  });

  res.status(202).json({ jobId });
});

router.get('/staging-db-import/status/:jobId', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const user = (req as Request & { user: AuthPayload }).user;
  if (!userMayUseStagingDbImport(user.role, user.email)) {
    res.status(403).json({ error: '이 기능을 사용할 수 없습니다.' });
    return;
  }
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
    return;
  }
  res.json({
    status: job.status,
    message: job.message ?? null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt ?? null,
  });
});

export default router;
