import express, { type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { authMiddleware } from '../auth/auth.middleware.js';
import { resolveHelpScreenshotsDir, helpScreenshotFileFilter } from './helpScreenshotsPath.js';
import {
  allowedMarketerGuideScreenshotFilenames,
  loadMarketerGuideScreenshotCatalog,
} from './marketerGuideScreenshots.js';
import { canEditMarketerGuideScreenshots } from './marketerGuideScreenshotAuth.js';

const router = express.Router();

async function ensureHelpScreenshotsDir(): Promise<string> {
  const dir = resolveHelpScreenshotsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Multer 설정: 스크린샷 업로드
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        cb(null, await ensureHelpScreenshotsDir());
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      // 파일명: timestamp_원본파일명
      const timestamp = Date.now();
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
      cb(null, `${timestamp}_${sanitized}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: helpScreenshotFileFilter,
});

const DATA_PATH = path.join(process.cwd(), 'client', 'public', 'help', 'data.json');

/**
 * 권한 체크: pyo 이메일 또는 플랫폼 관리자
 */
function requireHelpEditPermission(req: any, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isPyo = user.email?.toLowerCase().startsWith('pyo');
  const isPlatformAdmin = user.platformRole === 'ADMIN';

  if (!isPyo && !isPlatformAdmin) {
    return res.status(403).json({ error: '헬프 편집 권한이 없습니다.' });
  }

  next();
}

/** 마케터 HTML 가이드 스크린샷 교체 — pyo 등 개발자 loginId */
async function requirePyoDeveloperOnly(req: any, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const canEdit = await canEditMarketerGuideScreenshots(user);
  if (!canEdit) {
    return res.status(403).json({ error: '스크린샷 교체 권한이 없습니다.' });
  }
  next();
}

const marketerGuideScreenshotUpload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        cb(null, await ensureHelpScreenshotsDir());
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (req, _file, cb) => {
      cb(null, req.params.filename);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: helpScreenshotFileFilter,
});

/**
 * GET /api/help/marketer-guide/can-edit-screenshots
 */
router.get('/marketer-guide/can-edit-screenshots', authMiddleware, async (req: any, res) => {
  const canEdit = await canEditMarketerGuideScreenshots(req.user);
  res.json({ canEdit });
});

/**
 * GET /api/help/marketer-guide/screenshots
 */
router.get('/marketer-guide/screenshots', async (_req, res) => {
  try {
    const items = await loadMarketerGuideScreenshotCatalog();
    res.json({ items });
  } catch (error) {
    console.error('Marketer guide screenshots list error:', error);
    res.status(500).json({ error: '목록 불러오기 실패' });
  }
});

/**
 * POST /api/help/marketer-guide/screenshot/:filename
 * 고정 파일명으로 덮어쓰기 (HTML 가이드 img src 유지)
 */
router.post(
  '/marketer-guide/screenshot/:filename',
  authMiddleware,
  requirePyoDeveloperOnly,
  async (req, res, next) => {
    try {
      const { filename } = req.params;
      const allowed = await allowedMarketerGuideScreenshotFilenames();
      if (!allowed.has(filename)) {
        return res.status(400).json({ error: '허용되지 않은 파일명입니다.' });
      }
      next();
    } catch (error) {
      console.error('Marketer guide screenshot validate error:', error);
      res.status(500).json({ error: '업로드 준비 실패' });
    }
  },
  (req, res, next) => {
    marketerGuideScreenshotUpload.single('screenshot')(req, res, (err: unknown) => {
      if (err) {
        console.error('Marketer guide screenshot multer error:', err);
        const message = err instanceof Error ? err.message : '업로드 실패';
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '파일이 없습니다.' });
      }

      const filename = req.file.filename;
      const publicRoots = [
        path.join(process.cwd(), 'client', 'public', 'help', 'screenshots'),
        path.join(process.cwd(), '..', 'client', 'public', 'help', 'screenshots'),
      ];
      const servedDir = resolveHelpScreenshotsDir();
      const sourcePath = path.join(servedDir, filename);

      for (const publicDir of publicRoots) {
        try {
          if (!publicDir.includes(`${path.sep}public${path.sep}`)) continue;
          await fs.mkdir(publicDir, { recursive: true });
          await fs.copyFile(sourcePath, path.join(publicDir, filename));
          break;
        } catch {
          /* 로컬 dev용 — 프로덕션 컨테이너에서는 무시 */
        }
      }

      res.json({
        filename,
        url: `/help/screenshots/${filename}?v=${Date.now()}`,
      });
    } catch (error) {
      console.error('Marketer guide screenshot upload error:', error);
      res.status(500).json({ error: '업로드 실패' });
    }
  },
);

/**
 * POST /api/help/upload-screenshot
 * 스크린샷 이미지 업로드
 */
router.post(
  '/upload-screenshot',
  authMiddleware,
  requireHelpEditPermission,
  upload.single('screenshot'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '파일이 없습니다.' });
      }

      const filename = req.file.filename;
      res.json({ filename, url: `/help/screenshots/${filename}` });
    } catch (error) {
      console.error('Screenshot upload error:', error);
      res.status(500).json({ error: '업로드 실패' });
    }
  }
);

/**
 * PATCH /api/help/:role/:encodedPath
 * 헬프 콘텐츠 수정 (마크다운, 스크린샷 경로)
 */
router.patch(
  '/:role/:encodedPath',
  authMiddleware,
  requireHelpEditPermission,
  async (req, res) => {
    try {
      const { role, encodedPath } = req.params;
      const targetPath = decodeURIComponent(encodedPath);
      const { markdown, screenshotFile, summary, title } = req.body;

      // data.json 읽기
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      const data = JSON.parse(raw);

      // 해당 항목 찾기
      const index = data.findIndex(
        (item: any) => item.role === role && item.path === targetPath
      );

      if (index === -1) {
        return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
      }

      // 업데이트
      if (markdown !== undefined) data[index].markdown = markdown;
      if (screenshotFile !== undefined) data[index].screenshotFile = screenshotFile;
      if (summary !== undefined) data[index].summary = summary;
      if (title !== undefined) data[index].title = title;

      // 저장
      await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

      res.json({ success: true, updated: data[index] });
    } catch (error) {
      console.error('Help content update error:', error);
      res.status(500).json({ error: '업데이트 실패' });
    }
  }
);

/**
 * DELETE /api/help/screenshot/:filename
 * 스크린샷 삭제
 */
router.delete(
  '/screenshot/:filename',
  authMiddleware,
  requireHelpEditPermission,
  async (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(resolveHelpScreenshotsDir(), filename);

      // 파일 존재 확인
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
      }

      // 삭제
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      console.error('Screenshot delete error:', error);
      res.status(500).json({ error: '삭제 실패' });
    }
  }
);

export default router;
