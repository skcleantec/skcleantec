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

/** Railway Volume — 컨테이너 재시작·배포 후에도 교체 스크린샷 유지 */
export function helpScreenshotVolumeDir(): string | null {
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (!volume) return null;
  return path.join(volume, 'help-screenshots');
}

/** Vite dev는 public, 프로덕션 정적 서빙은 client/dist, Volume 있으면 Volume 우선 */
export function resolveHelpScreenshotsDir(): string {
  const volumeDir = helpScreenshotVolumeDir();
  if (volumeDir) return volumeDir;

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

/** 업로드 후 dist·public에도 복사 — 정적 서빙·Volume 미설정 환경 대비 */
export function helpScreenshotMirrorDirs(): string[] {
  const primary = path.normalize(resolveHelpScreenshotsDir());
  const out: string[] = [];
  const seen = new Set<string>([primary]);
  for (const root of clientDistRoots()) {
    const dir = path.normalize(path.join(root, 'help', 'screenshots'));
    if (!seen.has(dir)) {
      seen.add(dir);
      out.push(dir);
    }
  }
  for (const root of clientPublicRoots()) {
    const dir = path.normalize(path.join(root, 'help', 'screenshots'));
    if (!seen.has(dir)) {
      seen.add(dir);
      out.push(dir);
    }
  }
  return out;
}

/** GET /help/screenshots/:file — Volume·dist·public 순 조회 */
export function resolveHelpScreenshotFilePath(filename: string): string | null {
  const safe = path.basename(filename);
  if (safe !== filename || !/^s[\w-]+\.(png|jpg|jpeg|webp)$/i.test(safe)) return null;

  const dirs: string[] = [];
  const seen = new Set<string>();
  const addDir = (dir: string) => {
    const norm = path.normalize(dir);
    if (seen.has(norm)) return;
    seen.add(norm);
    dirs.push(norm);
  };

  const volumeDir = helpScreenshotVolumeDir();
  if (volumeDir) addDir(volumeDir);
  addDir(resolveHelpScreenshotsDir());
  for (const root of clientDistRoots()) addDir(path.join(root, 'help', 'screenshots'));
  for (const root of clientPublicRoots()) addDir(path.join(root, 'help', 'screenshots'));

  for (const dir of dirs) {
    const candidate = path.join(dir, safe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** dist·public 후보 경로 전부 (구 dist만 있을 때 public 최신 JSON과 병합) */
export function helpStaticPathCandidates(...segments: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (root: string) => {
    const candidate = path.normalize(path.join(root, ...segments));
    if (seen.has(candidate)) return;
    seen.add(candidate);
    if (fs.existsSync(candidate)) out.push(candidate);
  };
  for (const root of clientPublicRoots()) add(root);
  for (const root of clientDistRoots()) add(root);
  return out;
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
