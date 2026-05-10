import { randomUUID } from 'crypto';
import { Router, type Request, type Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, adminOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { ensureDatabaseUrlSslMode, userMayUseStagingDbImport } from './stagingDbImport.helpers.js';

type JobStatus = 'queued' | 'dumping' | 'restoring' | 'done' | 'failed';

type ImportJob = {
  status: JobStatus;
  message?: string;
  startedAt: string;
  finishedAt?: string;
};

const jobs = new Map<string, ImportJob>();

function runCmd(exe: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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

/** 사용자에게 보여 줄 오류 요약(비밀번호 등은 보통 stderr에 안 나옴). */
function formatToolFailure(tool: string, code: number, stderr: string, stdout: string): string {
  const combined = `${stderr.trim()}\n${stdout.trim()}`.trim();
  const max = 1600;
  const snippet = combined.length > max ? `…\n${combined.slice(-max)}` : combined || '(출력 없음)';
  return `${tool} 실패 (종료 코드 ${code}).\n${snippet}`;
}

function anyJobRunning(): boolean {
  for (const j of jobs.values()) {
    if (j.status === 'queued' || j.status === 'dumping' || j.status === 'restoring') return true;
  }
  return false;
}

async function executeImportJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const sourceRaw = config.stagingDbImport.sourceDatabaseUrl;
  const targetRaw = process.env.DATABASE_URL ?? '';
  if (!sourceRaw || !targetRaw) {
    job.status = 'failed';
    job.message = 'DATABASE_URL 또는 소스 URL이 설정되어 있지 않습니다.';
    job.finishedAt = new Date().toISOString();
    return;
  }

  const sourceUrl = ensureDatabaseUrlSslMode(sourceRaw);
  const targetUrl = ensureDatabaseUrlSslMode(targetRaw);
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

    job.status = 'restoring';
    job.message = '스테이징 DB 복원 중… (수 분 걸릴 수 있습니다)';

    await prisma.$disconnect();

    try {
      const restore = await runCmd('pg_restore', [
        '--clean',
        '--if-exists',
        `--dbname=${targetUrl}`,
        '--no-owner',
        '--no-acl',
        dumpPath,
      ]);
      // 0: 성공, 1: 경고만, 2+: 치명적
      if (restore.code >= 2) {
        job.status = 'failed';
        job.message = formatToolFailure('pg_restore', restore.code, restore.stderr, restore.stdout);
      } else {
        job.status = 'done';
        job.message =
          restore.code === 1
            ? '복원 완료(일부 경고가 있었을 수 있습니다). 스테이징 앱을 새로고침·재배포 후 확인하세요.'
            : '복원이 완료되었습니다. 스테이징 앱을 새로고침해 확인하세요.';
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
