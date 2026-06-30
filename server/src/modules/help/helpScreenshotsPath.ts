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

/** help 정적 JSON·HTML — dist 우선, 없으면 public (로컬 dev) */
export function resolveHelpStaticPath(...segments: string[]): string {
  const distRoot = path.join(process.cwd(), 'client', 'dist');
  const publicRoot = path.join(process.cwd(), 'client', 'public');
  const distPath = path.join(distRoot, ...segments);
  const publicPath = path.join(publicRoot, ...segments);

  if (fs.existsSync(distPath)) return distPath;
  if (fs.existsSync(publicPath)) return publicPath;
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distRoot)) return distPath;
  return publicPath;
}
