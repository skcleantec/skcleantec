import type { PrismaClient } from '@prisma/client';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Railway 등: preDeploy 직후 Postgres가 아직 internal DNS/기동 중일 때 P1001이 날 수 있음.
 */
export async function connectPrismaWithRetry(
  prisma: PrismaClient,
  opts?: { maxAttempts?: number; delayMs?: number },
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 15;
  const delayMs = opts?.delayMs ?? 2000;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      if (attempt > 1) {
        console.log(`[db] PostgreSQL 연결됨 (${attempt}번째 시도)`);
      }
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxAttempts) {
        console.warn(`[db] 연결 실패 (${attempt}/${maxAttempts}): ${msg} — ${delayMs}ms 후 재시도`);
        await sleep(delayMs);
      }
    }
  }

  throw lastErr;
}
