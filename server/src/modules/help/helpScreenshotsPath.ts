import fs from 'fs';
import path from 'path';

/** Vite dev는 public, 프로덕션 정적 서빙은 client/dist */
export function resolveHelpScreenshotsDir(): string {
  const distRoot = path.join(process.cwd(), 'client', 'dist');
  const distDir = path.join(distRoot, 'help', 'screenshots');
  const publicDir = path.join(process.cwd(), 'client', 'public', 'help', 'screenshots');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distRoot)) {
    return distDir;
  }
  return publicDir;
}
