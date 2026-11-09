import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

/** IP(+키 존재)별 최근 요청 시각 — 프로세스 메모리, 분당 10회 */
const hitBuckets = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0]!.trim().slice(0, 64);
  return (req.socket.remoteAddress ?? 'unknown').slice(0, 64);
}

/**
 * 마케터 에이전트 전용 — `X-Help-Publish-Key` 와 env `HELP_CMS_PUBLISH_KEY` 일치.
 * 키 값은 로그·응답에 넣지 않는다.
 */
export function helpCmsPublishKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.HELP_CMS_PUBLISH_KEY?.trim() ?? '';
  if (!expected) {
    res.status(503).json({ error: '게시 API가 아직 설정되지 않았습니다.' });
    return;
  }
  const provided = String(req.headers['x-help-publish-key'] ?? '').trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: '인증에 실패했습니다.' });
    return;
  }

  const ip = clientIp(req);
  const now = Date.now();
  const bucketKey = `publish:${ip}`;
  const prev = (hitBuckets.get(bucketKey) ?? []).filter((t) => now - t < WINDOW_MS);
  if (prev.length >= MAX_PER_WINDOW) {
    res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }
  prev.push(now);
  hitBuckets.set(bucketKey, prev);

  (req as Request & { helpPublishIp?: string }).helpPublishIp = ip;
  next();
}

export function helpCmsPublishActor(req: Request): string {
  const raw = req.headers['x-help-publish-actor'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 128);
  return 'marketer-agent';
}

export function helpCmsPublishRequestIp(req: Request): string | null {
  return (req as Request & { helpPublishIp?: string }).helpPublishIp ?? null;
}
