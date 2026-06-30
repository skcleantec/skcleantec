import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FileFilterCallback } from 'multer';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Railway runner cwd는 /app/server — client/dist 는 ../client/dist */
function clientDistRoots(): string[] {
  const cwd = process.cwd();
  const candidates = [
    ...(process.env.CLIENT_DIST ? [path.resolve(process.env.CLIENT_DIST)] : []),
    path.resolve(moduleDir, '../../../../client/dist'),
    path.resolve(moduleDir, '../../../client/dist'),
    path.join(cwd, 'client', 'dist'),
    path.join(cwd, '..', 'client', 'dist'),
  ];
  const seen = new Set<string>();
  return candidates.filter((p) => {
    const norm = path.normalize(p);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return fs.existsSync(p);
  });
}

function clientPublicRoots(): string[] {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(moduleDir, '../../../../client/public'),
    path.resolve(moduleDir, '../../../client/public'),
    path.join(cwd, 'client', 'public'),
    path.join(cwd, '..', 'client', 'public'),
  ];
  const seen = new Set<string>();
  return candidates.filter((p) => {
    const norm = path.normalize(p);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return fs.existsSync(p);
  });
}

/** Vite dev는 public, 프로덕션 정적 서빙은 client/dist */
export function resolveHelpScreenshotsDir(): string {
  const distRoots = clientDistRoots();
  if (process.env.NODE_ENV === 'production' && distRoots.length > 0) {
    return path.join(distRoots[0], 'help', 'screenshots');
  }
  const publicRoots = clientPublicRoots();
  if (publicRoots.length > 0) {
    return path.join(publicRoots[0], 'help', 'screenshots');
  }
  if (distRoots.length > 0) {
    return path.join(distRoots[0], 'help', 'screenshots');
  }
  return path.join(cwdFallback(), 'help', 'screenshots');
}

/** help 정적 JSON·HTML — dist 우선, 없으면 public (로컬 dev) */
export function resolveHelpStaticPath(...segments: string[]): string {
  for (const root of clientDistRoots()) {
    const candidate = path.join(root, ...segments);
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const root of clientPublicRoots()) {
    const candidate = path.join(root, ...segments);
    if (fs.existsSync(candidate)) return candidate;
  }
  const distRoots = clientDistRoots();
  if (distRoots.length > 0) return path.join(distRoots[0], ...segments);
  const publicRoots = clientPublicRoots();
  if (publicRoots.length > 0) return path.join(publicRoots[0], ...segments);
  return path.join(cwdFallback(), ...segments);
}

function cwdFallback(): string {
  const publicRoots = clientPublicRoots();
  if (publicRoots.length > 0) return publicRoots[0];
  return path.join(process.cwd(), 'client', 'public');
}

function isImageUpload(file: Express.Multer.File): boolean {
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) return true;
  return /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
}

export function helpScreenshotFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (isImageUpload(file)) {
    cb(null, true);
    return;
  }
  cb(new Error('이미지 파일만 업로드 가능합니다.'));
}
