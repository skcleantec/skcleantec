import { Router } from 'express';
import type { Request } from 'express';
import multer from 'multer';
import { InspectionAreaPhotoPhase } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth, resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { findInquiryForTeamLeader } from './inquiryInspection.access.js';
import {
  addCustomInspectionArea,
  assertChecklistEditableForTeam,
  completeInspectionChecklist,
  getOrCreateInspectionChecklist,
  loadInspectionChecklist,
  patchInspectionArea,
  updateInspectionDraft,
} from './inquiryInspection.service.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import { serializeInspectionChecklist } from './inquiryInspection.serialize.js';
import {
  deleteInspectionPhoto,
  uploadInspectionPhotoBuffer,
  uploadInspectionSignatureBuffer,
} from './inquiryInspection.photos.service.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { prisma } from '../../lib/prisma.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const uploadImages = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'image', maxCount: 1 },
]);

const uploadSignature = upload.single('signature');

function collectUploadedFiles(req: Request): Express.Multer.File[] {
  const raw = req.files as Record<string, Express.Multer.File[]> | undefined;
  return [...(raw?.images ?? []), ...(raw?.image ?? [])];
}

const router = Router({ mergeParams: true });

async function tenantIdForTeamReq(req: Request): Promise<string | null> {
  const user = (req as unknown as { user: AuthPayload }).user;
  return getTenantIdFromAuth(user) ?? (await resolveTenantIdFromAuth(user));
}

/** GET — 검수 체크리스트 조회(없으면 표준 구역으로 생성) */
router.get('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }

  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }

  const dto = await getOrCreateInspectionChecklist({
    inquiryId,
    tenantId,
    teamLeaderId: userId,
    roomCount: inquiry.roomCount,
    isOneRoom: inquiry.isOneRoom,
    customerName: inquiry.customerName,
    preferredDate: inquiry.preferredDate,
  });
  res.json({ checklist: dto });
});

/** PATCH — 초안 저장 (기본사항·동의·이메일·특이사항) */
router.patch('/', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }

  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId, tenantId },
  });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다. 먼저 조회해 주세요.' });
    return;
  }

  const b = req.body as Record<string, unknown>;
  try {
    const updated = await updateInspectionDraft({
      checklistId: checklist.id,
      tenantId,
      patch: {
        leaderNotes: typeof b.leaderNotes === 'string' ? b.leaderNotes : b.leaderNotes === null ? null : undefined,
        customerEmail:
          typeof b.customerEmail === 'string' ? b.customerEmail : b.customerEmail === null ? null : undefined,
        basicAnswersJson: b.basicAnswers !== undefined ? (b.basicAnswers as object) : undefined,
        consentPersonalInfo: typeof b.consentPersonalInfo === 'boolean' ? b.consentPersonalInfo : undefined,
        consentThirdParty: typeof b.consentThirdParty === 'boolean' ? b.consentThirdParty : undefined,
        consentScopeConfirm: typeof b.consentScopeConfirm === 'boolean' ? b.consentScopeConfirm : undefined,
        consentLeaderLiability: typeof b.consentLeaderLiability === 'boolean' ? b.consentLeaderLiability : undefined,
        consentCustomerConfirm: typeof b.consentCustomerConfirm === 'boolean' ? b.consentCustomerConfirm : undefined,
        consentCommercialUse: typeof b.consentCommercialUse === 'boolean' ? b.consentCommercialUse : undefined,
        consentEmailDelivery: typeof b.consentEmailDelivery === 'boolean' ? b.consentEmailDelivery : undefined,
      },
    });
    res.json({
      checklist: serializeInspectionChecklist(updated, {
        customerName: inquiry.customerName,
        preferredDate: inquiry.preferredDate,
      }),
    });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** POST /areas — 구역 추가 */
router.post('/areas', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await assertChecklistEditableForTeam({ inquiryId, tenantId });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  const label = typeof req.body?.label === 'string' ? req.body.label : '';
  try {
    const area = await addCustomInspectionArea({ checklistId: checklist.id, tenantId, label });
    res.status(201).json({ area });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    if (code === 'bad_request') {
      res.status(400).json({ error: '구역 이름을 입력해 주세요.' });
      return;
    }
    throw e;
  }
});

/** PATCH /areas/:areaId */
router.patch('/areas/:areaId', async (req, res) => {
  const { inquiryId, areaId } = req.params as { inquiryId: string; areaId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({ where: { inquiryId, tenantId } });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  const b = req.body as Record<string, unknown>;
  try {
    const area = await patchInspectionArea({
      checklistId: checklist.id,
      tenantId,
      areaId,
      notApplicable: typeof b.notApplicable === 'boolean' ? b.notApplicable : undefined,
      naReason: typeof b.naReason === 'string' ? b.naReason : b.naReason === null ? null : undefined,
    });
    res.json({ area });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '구역을 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** POST /areas/:areaId/photos */
router.post('/areas/:areaId/photos', uploadImages, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: 'Cloudinary가 설정되지 않았습니다.' });
    return;
  }
  const { inquiryId, areaId } = req.params as { inquiryId: string; areaId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const files = collectUploadedFiles(req);
  if (!files.length) {
    res.status(400).json({ error: '이미지 파일을 선택해 주세요.' });
    return;
  }
  const phaseRaw = typeof req.body?.phase === 'string' ? req.body.phase.toUpperCase() : 'BEFORE';
  const phase: InspectionAreaPhotoPhase = phaseRaw === 'AFTER' ? 'AFTER' : 'BEFORE';

  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({ where: { inquiryId, tenantId } });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    await assertChecklistEditableForTeam({ inquiryId, tenantId });
  } catch {
    res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
    return;
  }

  const area = await prisma.inquiryInspectionArea.findFirst({
    where: { id: areaId, checklistId: checklist.id },
  });
  if (!area) {
    res.status(404).json({ error: '구역을 찾을 수 없습니다.' });
    return;
  }
  if (area.notApplicable) {
    res.status(400).json({ error: '해당사항 없음 구역에는 사진을 등록할 수 없습니다.' });
    return;
  }

  const created = [];
  for (const file of files) {
    if (!file.buffer?.length) continue;
    const row = await uploadInspectionPhotoBuffer({
      inquiryId,
      areaId,
      phase,
      uploadedById: userId,
      buffer: file.buffer,
    });
    created.push({
      id: row.id,
      phase: row.phase,
      secureUrl: row.secureUrl,
      width: row.width,
      height: row.height,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt.toISOString(),
    });
  }
  if (!created.length) {
    res.status(400).json({ error: '유효한 이미지 파일이 없습니다.' });
    return;
  }
  res.status(201).json({ items: created });
});

/** DELETE /areas/:areaId/photos/:photoId */
router.delete('/areas/:areaId/photos/:photoId', async (req, res) => {
  const { inquiryId, areaId, photoId } = req.params as {
    inquiryId: string;
    areaId: string;
    photoId: string;
  };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({ where: { inquiryId, tenantId } });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    await assertChecklistEditableForTeam({ inquiryId, tenantId });
  } catch {
    res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
    return;
  }
  const deleted = await deleteInspectionPhoto({ photoId, areaId, checklistId: checklist.id });
  if (!deleted) {
    res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    return;
  }
  res.json({ ok: true });
});

/** POST /signature */
router.post('/signature', uploadSignature, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: 'Cloudinary가 설정되지 않았습니다.' });
    return;
  }
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '서명 이미지를 업로드해 주세요.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({ where: { inquiryId, tenantId } });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    const up = await uploadInspectionSignatureBuffer({ inquiryId, buffer: file.buffer });
    const updated = await updateInspectionDraft({
      checklistId: checklist.id,
      tenantId,
      patch: { signaturePublicId: up.public_id, signatureSecureUrl: up.secure_url },
    });
    res.json({
      signature: { publicId: up.public_id, secureUrl: up.secure_url },
      checklist: serializeInspectionChecklist(updated, {
        customerName: inquiry.customerName,
        preferredDate: inquiry.preferredDate,
      }),
    });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** POST /complete — 청소완료(검수 마감) */
router.post('/complete', async (req, res) => {
  const { inquiryId } = req.params as { inquiryId: string };
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await tenantIdForTeamReq(req);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 세션이 필요합니다.' });
    return;
  }
  const inquiry = await findInquiryForTeamLeader({ inquiryId, teamLeaderId: userId, tenantId });
  if (!inquiry) {
    res.status(404).json({ error: '담당 접수를 찾을 수 없습니다.' });
    return;
  }
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId, tenantId },
    include: inspectionChecklistInclude,
  });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    const dto = await completeInspectionChecklist({
      checklistId: checklist.id,
      tenantId,
      inquiryId,
    });
    res.json({ checklist: dto });
  } catch (e) {
    const err = e as { code?: string; issues?: { message: string }[] };
    if (err.code === 'validation_failed' && err.issues?.length) {
      res.status(400).json({ error: err.issues[0]!.message, issues: err.issues });
      return;
    }
    if (err.code === 'already_completed') {
      res.status(409).json({ error: '이미 완료된 검수입니다.' });
      return;
    }
    throw e;
  }
});

export default router;
