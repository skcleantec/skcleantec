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
import {
  addCustomInspectionItem,
  patchInspectionItem,
} from './inquiryInspection.items.service.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';
import { serializeInspectionChecklist } from './inquiryInspection.serialize.js';
import {
  deleteInspectionPhoto,
  patchInspectionPhotoFlag,
  uploadInspectionPhotoBuffer,
  uploadInspectionSignatureBuffer,
} from './inquiryInspection.photos.service.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { prisma } from '../../lib/prisma.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import {
  buildAreaBeforePhotosZipBuffer,
  InspectionAreaZipError,
} from './inquiryInspection.zip.service.js';
import {
  addInspectionAreaInstance,
  removeInspectionAreaInstance,
} from './inquiryInspection.areas.service.js';
import { notifyInspectionChecklistRefresh } from './inquiryInspectionNotify.js';

function fireInspectionRefresh(inquiryId: string, tenantId: string, includeStaff = false) {
  void notifyInspectionChecklistRefresh({ inquiryId, tenantId, includeStaff });
}

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

router.use(requireFeature('mod_inspection'));

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
    kitchenCount: inquiry.kitchenCount,
    bathroomCount: inquiry.bathroomCount,
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
    fireInspectionRefresh(inquiryId, tenantId);
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
    fireInspectionRefresh(inquiryId, tenantId);
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

/** POST /areas/instances — 표준 구역 1개 추가 (방·거실·주방 등) */
router.post('/areas/instances', async (req, res) => {
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
  const templateKey = typeof req.body?.templateKey === 'string' ? req.body.templateKey.trim() : '';
  if (!templateKey) {
    res.status(400).json({ error: 'templateKey가 필요합니다.' });
    return;
  }
  try {
    const updated = await addInspectionAreaInstance({
      checklistId: checklist.id,
      tenantId,
      templateKey,
    });
    if (!updated) {
      res.status(500).json({ error: '구역 추가에 실패했습니다.' });
      return;
    }
    fireInspectionRefresh(inquiryId, tenantId);
    res.status(201).json({
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
    if (code === 'bad_request') {
      const msg =
        e instanceof Error && e.message === 'max_instances'
          ? '더 이상 추가할 수 없습니다.'
          : '추가할 수 없는 구역입니다.';
      res.status(400).json({ error: msg });
      return;
    }
    throw e;
  }
});

/** DELETE /areas/:areaId/instance — 표준 구역 1개 제거 */
router.delete('/areas/:areaId/instance', async (req, res) => {
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
  const checklist = await assertChecklistEditableForTeam({ inquiryId, tenantId });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  try {
    const updated = await removeInspectionAreaInstance({
      checklistId: checklist.id,
      tenantId,
      areaId,
    });
    if (!updated) {
      res.status(500).json({ error: '구역 삭제에 실패했습니다.' });
      return;
    }
    fireInspectionRefresh(inquiryId, tenantId);
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
    if (code === 'bad_request') {
      const msg =
        e instanceof Error && e.message === 'min_instances'
          ? '최소 1개는 남겨 두어야 합니다.'
          : '삭제할 수 없는 구역입니다.';
      res.status(400).json({ error: msg });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '구역을 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** GET /areas/:areaId/before-photos.zip — 구역 청소 전 사진 ZIP (카톡·공유용) */
router.get('/areas/:areaId/before-photos.zip', async (req, res) => {
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
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { inquiryId, tenantId },
    include: inspectionChecklistInclude,
  });
  if (!row) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  const area = row.areas.find((a) => a.id === areaId);
  if (!area) {
    res.status(404).json({ error: '구역을 찾을 수 없습니다.' });
    return;
  }
  try {
    const zip = await buildAreaBeforePhotosZipBuffer(area);
    const safeArea = area.label.replace(/[\\/:*?"<>|]/g, '_').slice(0, 24) || 'area';
    const safeCustomer = inquiry.customerName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 16) || 'customer';
    const fileName = `preclean_${safeArea}_${safeCustomer}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(zip);
  } catch (e) {
    if (e instanceof InspectionAreaZipError) {
      const status = e.code === 'no_photos' ? 400 : 502;
      res.status(status).json({ error: e.message });
      return;
    }
    console.error('[inspection] area before zip failed', e);
    res.status(500).json({ error: '사진 ZIP 생성에 실패했습니다.' });
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
    fireInspectionRefresh(inquiryId, tenantId);
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

/** PATCH /items/:itemId */
router.patch('/items/:itemId', async (req, res) => {
  const { inquiryId, itemId } = req.params as { inquiryId: string; itemId: string };
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
    await assertChecklistEditableForTeam({ inquiryId, tenantId });
    const item = await patchInspectionItem({
      checklistId: checklist.id,
      tenantId,
      itemId,
      notApplicable: typeof b.notApplicable === 'boolean' ? b.notApplicable : undefined,
      naReason: typeof b.naReason === 'string' ? b.naReason : b.naReason === null ? null : undefined,
    });
    fireInspectionRefresh(inquiryId, tenantId);
    res.json({ item });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** POST /areas/:areaId/items — 커스텀 세부 항목 추가 */
router.post('/areas/:areaId/items', async (req, res) => {
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
  const checklist = await assertChecklistEditableForTeam({ inquiryId, tenantId });
  if (!checklist) {
    res.status(404).json({ error: '검수 체크리스트가 없습니다.' });
    return;
  }
  const label = typeof req.body?.label === 'string' ? req.body.label : '';
  try {
    const item = await addCustomInspectionItem({
      checklistId: checklist.id,
      tenantId,
      areaId,
      label,
    });
    fireInspectionRefresh(inquiryId, tenantId);
    res.status(201).json({ item });
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
    if (code === 'locked') {
      res.status(409).json({ error: '완료된 검수본은 수정할 수 없습니다.' });
      return;
    }
    if (code === 'bad_request') {
      res.status(400).json({ error: '항목 이름을 입력해 주세요.' });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '구역을 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

/** POST /items/:itemId/photos */
router.post('/items/:itemId/photos', uploadImages, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({ error: 'Cloudinary가 설정되지 않았습니다.' });
    return;
  }
  const { inquiryId, itemId } = req.params as { inquiryId: string; itemId: string };
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

  const item = await prisma.inquiryInspectionItem.findFirst({
    where: { id: itemId, area: { checklistId: checklist.id } },
    include: { area: true },
  });
  if (!item) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  if (item.area.notApplicable || item.notApplicable) {
    res.status(400).json({ error: '해당사항 없음 항목에는 사진을 등록할 수 없습니다.' });
    return;
  }

  const created = [];
  for (const file of files) {
    if (!file.buffer?.length) continue;
    const row = await uploadInspectionPhotoBuffer({
      inquiryId,
      itemId,
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
      flagged: row.flagged,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt.toISOString(),
    });
  }
  if (!created.length) {
    res.status(400).json({ error: '유효한 이미지 파일이 없습니다.' });
    return;
  }
  fireInspectionRefresh(inquiryId, tenantId);
  res.status(201).json({ items: created });
});

/** PATCH /items/:itemId/photos/:photoId — 청소 전 오염 심함 표시 */
router.patch('/items/:itemId/photos/:photoId', async (req, res) => {
  const { inquiryId, itemId, photoId } = req.params as {
    inquiryId: string;
    itemId: string;
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
  const flagged = req.body?.flagged;
  if (typeof flagged !== 'boolean') {
    res.status(400).json({ error: 'flagged(true/false)가 필요합니다.' });
    return;
  }
  try {
    const updated = await patchInspectionPhotoFlag({
      photoId,
      itemId,
      checklistId: checklist.id,
      flagged,
    });
    if (!updated) {
      res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
      return;
    }
    fireInspectionRefresh(inquiryId, tenantId);
    res.json({
      photo: {
        id: updated.id,
        phase: updated.phase,
        secureUrl: updated.secureUrl,
        width: updated.width,
        height: updated.height,
        flagged: updated.flagged,
        uploadedBy: updated.uploadedBy,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'BEFORE_ONLY') {
      res.status(400).json({ error: '청소 전 사진만 표시할 수 있습니다.' });
      return;
    }
    console.error('[inspection] patch photo flag failed', e);
    res.status(500).json({ error: '표시 저장에 실패했습니다.' });
  }
});

/** DELETE /items/:itemId/photos/:photoId */
router.delete('/items/:itemId/photos/:photoId', async (req, res) => {
  const { inquiryId, itemId, photoId } = req.params as {
    inquiryId: string;
    itemId: string;
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
  const deleted = await deleteInspectionPhoto({ photoId, itemId, checklistId: checklist.id });
  if (!deleted) {
    res.status(404).json({ error: '사진을 찾을 수 없습니다.' });
    return;
  }
  fireInspectionRefresh(inquiryId, tenantId);
  res.json({ ok: true });
});

/** @deprecated 구역 단위 — v2는 /items/:itemId/photos 사용 */
router.post('/areas/:areaId/photos', uploadImages, async (req, res) => {
  res.status(410).json({ error: '세부 항목별 사진 API를 사용해 주세요. (/items/:itemId/photos)' });
});

/** @deprecated */
router.delete('/areas/:areaId/photos/:photoId', async (_req, res) => {
  res.status(410).json({ error: '세부 항목별 사진 API를 사용해 주세요.' });
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
    fireInspectionRefresh(inquiryId, tenantId);
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
    fireInspectionRefresh(inquiryId, tenantId, true);
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
