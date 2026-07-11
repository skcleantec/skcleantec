import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { normalizeUploadedFilename } from '../../lib/uploadFilename.js';
import { INQUIRY_EXCEL_IMPORT_MAX_FILE_BYTES } from '../../lib/inquiryExcelImportPolicy.js';
import {
  createInquiryExcelProfile,
  deleteInquiryExcelProfile,
  executeInquiryExcelImport,
  executeInquiryExcelImportBatch,
  extractExcelHeaders,
  getInquiryExcelFieldCatalog,
  getInquiryExcelProfile,
  getInquiryExcelRun,
  listInquiryExcelProfiles,
  listInquiryExcelRuns,
  previewInquiryExcelImport,
  undoInquiryExcelImportRun,
  updateInquiryExcelProfile,
} from './inquiryExcelImport.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: INQUIRY_EXCEL_IMPORT_MAX_FILE_BYTES },
});

router.use(authMiddleware, requireStaffPermission('inquiry.excelImport'));

function tenantIdOr403(req: Request, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

async function verifyPasswordForRequest(
  req: Request,
  res: Response,
  passwordRaw: unknown,
): Promise<boolean> {
  const password = passwordRaw != null ? String(passwordRaw) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return false;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
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
    res.json({ headers, fileName: normalizeUploadedFilename(file.originalname) });
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
    const fileName = normalizeUploadedFilename(file.originalname) ?? undefined;
    const result = await previewInquiryExcelImport({
      tenantId,
      profileId,
      buffer: file.buffer,
      fileName,
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
    const fileName = normalizeUploadedFilename(file.originalname) ?? undefined;
    const result = await executeInquiryExcelImport({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      profileId,
      buffer: file.buffer,
      fileName,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '일괄 등록 실패' });
  }
});

router.post('/import/execute/batch', upload.single('file'), async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const file = req.file;
  const profileId = String(req.body.profileId ?? '').trim();
  const runId = String(req.body.runId ?? '').trim() || undefined;
  const startOffset = Number(req.body.startOffset ?? 0);
  const batchSize = Number(req.body.batchSize ?? 0);
  if (!profileId) {
    res.status(400).json({ error: '매칭 서식을 선택해주세요.' });
    return;
  }
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '엑셀 파일을 업로드해주세요.' });
    return;
  }
  try {
    const fileName = normalizeUploadedFilename(file.originalname) ?? undefined;
    const result = await executeInquiryExcelImportBatch({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      profileId,
      buffer: file.buffer,
      fileName,
      runId,
      startOffset: Number.isFinite(startOffset) ? startOffset : 0,
      batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : undefined,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '일괄 등록 실패' });
  }
});

router.get('/runs', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const data = await listInquiryExcelRuns(tenantId, limit, offset);
  res.json(data);
});

router.get('/runs/:id', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const run = await getInquiryExcelRun(tenantId, req.params.id);
  if (!run) {
    res.status(404).json({ error: '실행 이력을 찾을 수 없습니다.' });
    return;
  }
  res.json(run);
});

/** 비밀번호 확인 후 — 해당 실행으로 등록(CREATED)된 접수 일괄 영구 삭제 */
router.delete('/runs/:id/inquiries', async (req, res) => {
  const tenantId = tenantIdOr403(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as { password?: string };
  if (!(await verifyPasswordForRequest(req, res, body.password))) return;

  const result = await undoInquiryExcelImportRun({
    tenantId,
    runId: req.params.id,
    actorId: user.userId,
  });
  if (!result) {
    res.status(404).json({ error: '실행 이력을 찾을 수 없습니다.' });
    return;
  }
  res.json({ ok: true, ...result });
});

export default router;
