import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, adminOnly } from '../auth/auth.middleware.js';

const router = Router();

const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'uploads');
const csDir = path.join(uploadDir, 'cs');

function humanBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Math.round(v * 10) / 10} ${units[i]}`;
}

function pct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

/** 관리자 전용: 앱 볼륨(업로드 경로) 용량·inode(파일 개수) 사용률 진단. 테넌트 데이터 미노출. */
router.get('/volume-stats', authMiddleware, adminOnly, (_req: Request, res: Response) => {
  const result: Record<string, unknown> = {
    mountPath: uploadDir,
    railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH ?? null,
  };

  try {
    const st = fs.statfsSync(uploadDir);
    const blockSize = Number(st.bsize);
    const totalBytes = Number(st.blocks) * blockSize;
    const freeBytes = Number(st.bfree) * blockSize;
    const usedBytes = totalBytes - freeBytes;
    const totalInodes = Number(st.files);
    const freeInodes = Number(st.ffree);
    const usedInodes = totalInodes - freeInodes;
    result.bytes = {
      total: totalBytes,
      used: usedBytes,
      free: freeBytes,
      usedPct: pct(usedBytes, totalBytes),
      totalHuman: humanBytes(totalBytes),
      usedHuman: humanBytes(usedBytes),
      freeHuman: humanBytes(freeBytes),
    };
    result.inodes = {
      total: totalInodes,
      used: usedInodes,
      free: freeInodes,
      usedPct: pct(usedInodes, totalInodes),
    };
  } catch (e) {
    result.statfsError = (e as Error).message;
  }

  try {
    const entries = fs.readdirSync(csDir);
    result.csFileCount = entries.length;
  } catch (e) {
    result.csFileCount = null;
    result.csReadError = (e as Error).message;
  }

  res.json(result);
});

export default router;
