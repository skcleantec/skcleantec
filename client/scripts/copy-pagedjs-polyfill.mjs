// pagedjs 의 dist/paged.polyfill.min.js 를 client/public/vendor/pagedjs/ 로 복사한다.
// 이유: pagedjs(0.4.3) 의 package.json `exports` 가 `./dist/*` 를 노출하지 않아
//      Vite 새 버전에서 직접 `?url` import 가 실패한다. 정적 자산으로 두고 절대 URL 로
//      iframe 안에서 로드하기 위한 사본을 만든다. 결과 파일은 git 에 포함하지 않는다
//      (.gitignore — `client/public/vendor/`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');

const src = path.join(clientRoot, 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.min.js');
const destDir = path.join(clientRoot, 'public', 'vendor', 'pagedjs');
const dest = path.join(destDir, 'paged.polyfill.min.js');

try {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-pagedjs-polyfill] 원본 없음: ${src} (pagedjs 미설치)`);
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-pagedjs-polyfill] copied → ${path.relative(clientRoot, dest)}`);
} catch (err) {
  // 복사 실패는 빌드를 막지 않는다(런타임에 vendor URL 이 404 가 되면 인쇄만 영향).
  console.warn('[copy-pagedjs-polyfill] 실패:', err);
}
