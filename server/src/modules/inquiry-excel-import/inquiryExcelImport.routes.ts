import { Router, type Request } from 'express';
import multer from 'multer';
import type { UserRole } from '@prisma/client';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  createInquiryExcelProfile,
  deleteInquiryExcelProfile,
  executeInquiryExcelImport,
  extractExcelHeaders,
  getInquiryExcelFieldCatalog,
  getInquiryExcelProfile,
  listInquiryExcelProfiles,
  listInquiryExcelRuns,
  previewInquiryExcelImport,
  updateInquiryExcelProfile,
} from './inquiryExcelImport.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(authMiddleware, adminOrMarketer);

function tenantIdOr403(req: Request, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

router.get('/field-catalog', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const catalog = await getInquiryExcelFieldCatalog(tenantId);
  res.json(catalog);
});

router.get('/profiles', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const items = await listInquiryExcelProfiles(tenantId);
  res.json({ items });
});

router.get('/profiles/:id', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const profile = await getInquiryExcelProfile(tenantId, req.params.id);
  if (!profile) {
    res.status(404).json({ error: '매칭 서식을 찾을 수 없습니다.' });
    return;
  }
  res.json(profile);
});

router.post('/profiles', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;
  try {
    const profile = await createInquiryExcelProfile({
      tenantId,
      userId: user.userId,
      name: String(body.name ?? ''),
      mappingSpec: body.mappingSpec,
    });
    res.status(201).json(profile);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '저장 실패' });
  }
});

router.patch('/profiles/:id', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const body = req.body as Record<string, unknown>;
  try {
    const profile = await updateInquiryExcelProfile({
      tenantId,
      profileId: req.params.id,
      name: body.name != null ? String(body.name) : undefined,
      mappingSpec: body.mappingSpec,
    });
    if (!profile) {
      res.status(404).json({ error: '매칭 서식을 찾을 수 없습니다.' });
      return;
    }
    res.json(profile);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '저장 실패' });
  }
});

router.delete('/profiles/:id', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const profile = await deleteInquiryExcelProfile(tenantId, req.params.id);
  if (!profile) {
    res.status(404).json({ error: '매칭 서식을 찾을 수 없습니다.' });
    return;
  }
  res.json({ ok: true });
});

router.post('/profiles/analyze-sample', upload.single('file'), async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '엑셀 파일을 업로드해주세요.' });
    return;
  }
  try {
    const headers = extractExcelHeaders(file.buffer);
    res.json({ headers, fileName: file.originalname });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '파일 분석 실패' });
  }
});

router.post('/import/preview', upload.single('file'), async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const file = req.file;
  const profileId = String(req.body.profileId ?? '').trim();
  if (!profileId) {
    res.status(400).json({ error: '매칭 서식을 선택해주세요.' });
    return;
  }
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '엑셀 파일을 업로드해주세요.' });
    return;
  }
  try {
    const result = await previewInquiryExcelImport({
      tenantId,
      profileId,
      buffer: file.buffer,
      fileName: file.originalname,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '미리보기 실패' });
  }
});

router.post('/import/execute', upload.single('file'), async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const file = req.file;
  const profileId = String(req.body.profileId ?? '').trim();
  if (!profileId) {
    res.status(400).json({ error: '매칭 서식을 선택해주세요.' });
    return;
  }
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '엑셀 파일을 업로드해주세요.' });
    return;
  }
  try {
    const result = await executeInquiryExcelImport({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      profileId,
      buffer: file.buffer,
      fileName: file.originalname,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '일괄 등록 실패' });
  }
});

router.get('/runs', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const data = await listInquiryExcelRuns(tenantId, limit, offset);
  res.json(data);
});

export default router;
