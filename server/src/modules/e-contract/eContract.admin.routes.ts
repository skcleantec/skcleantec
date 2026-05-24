import { EContractAudience, EContractVersionStatus } from '@prisma/client';
import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import {
  authMiddleware,
  adminOnly,
  type AuthPayload,
} from '../auth/auth.middleware.js';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import { prisma } from '../../lib/prisma.js';
import { notifyEContractInboxIfTeamLeader } from './eContract.recipientNotify.js';
import {
  createDefinition,
  createIssuance,
  deleteDefinitionHard,
  deleteDraft,
  deletePublishedVersion,
  ensureDraft,
  getDefinitionWithVersions,
  listDefinitions,
  listIssuancesForDefinition,
  listTeamLeadersForPicker,
  listMarketersForPicker,
  listAllContractRecipientsForPicker,
  listSubmissionsByTeamLeader,
  listAllSubmissionsForAdmin,
  getSubmissionDetailForAdmin,
  patchDefinition,
  patchDraftVersion,
  publishVersion,
  parseEContractListQuery,
} from './eContract.service.js';
import { EC_ISSUER_PLACEHOLDER_KEYS } from './eContractIssuer.expand.js';
import {
  ISSUER_SEAL_CLOUDINARY_FOLDER,
  getIssuerProfilePayload,
  patchIssuerProfile,
  previewBodyWithIssuerProfile,
} from './eContractIssuer.profile.service.js';
import { submissionMergedHtmlToDocxBuffer } from './eContractSubmissionDocx.js';

const router = Router();
router.use(authMiddleware, adminOnly);

function actor(req: Request): AuthPayload {
  return (req as Request & { user: AuthPayload }).user;
}

router.get('/issuer-profile', async (_req, res) => {
  try {
    const payload = await getIssuerProfilePayload();
    res.json(payload);
  } catch (e) {
    console.error('[e-contract] issuer profile GET', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.patch('/issuer-profile', async (req, res) => {
  try {
    const b = req.body ?? {};
    const profile = await patchIssuerProfile(actor(req).userId, typeof b.profileKey === 'string' ? b.profileKey : undefined, {
      companyName: typeof b.companyName === 'string' ? b.companyName : undefined,
      representativeName:
        'representativeName' in b
          ? typeof b.representativeName === 'string' || b.representativeName === null
            ? (b.representativeName as string | null)
            : undefined
          : undefined,
      businessRegistrationNo:
        'businessRegistrationNo' in b
          ? typeof b.businessRegistrationNo === 'string' || b.businessRegistrationNo === null
            ? (b.businessRegistrationNo as string | null)
            : undefined
          : undefined,
      addressLine:
        'addressLine' in b
          ? typeof b.addressLine === 'string' || b.addressLine === null
            ? (b.addressLine as string | null)
            : undefined
          : undefined,
      phone:
        'phone' in b ? (typeof b.phone === 'string' || b.phone === null ? (b.phone as string | null) : undefined) : undefined,
      fax: 'fax' in b ? (typeof b.fax === 'string' || b.fax === null ? (b.fax as string | null) : undefined) : undefined,
      email:
        'email' in b ? (typeof b.email === 'string' || b.email === null ? (b.email as string | null) : undefined) : undefined,
      clearSeal: b.clearSeal === true,
      sealPublicId:
        'sealPublicId' in b
          ? typeof b.sealPublicId === 'string' || b.sealPublicId === null
            ? (b.sealPublicId as string | null)
            : undefined
          : undefined,
      sealSecureUrl:
        'sealSecureUrl' in b
          ? typeof b.sealSecureUrl === 'string' || b.sealSecureUrl === null
            ? (b.sealSecureUrl as string | null)
            : undefined
          : undefined,
      sealDisplayWidthPx:
        'sealDisplayWidthPx' in b
          ? b.sealDisplayWidthPx === null || typeof b.sealDisplayWidthPx === 'number'
            ? (b.sealDisplayWidthPx as number | null)
            : undefined
          : undefined,
      issuerStampKind:
        'issuerStampKind' in b && (b.issuerStampKind === 'SEAL' || b.issuerStampKind === 'SIGNATURE')
          ? b.issuerStampKind
          : undefined,
      signaturePublicId:
        'signaturePublicId' in b
          ? typeof b.signaturePublicId === 'string' || b.signaturePublicId === null
            ? (b.signaturePublicId as string | null)
            : undefined
          : undefined,
      signatureSecureUrl:
        'signatureSecureUrl' in b
          ? typeof b.signatureSecureUrl === 'string' || b.signatureSecureUrl === null
            ? (b.signatureSecureUrl as string | null)
            : undefined
          : undefined,
      signatureDisplayWidthPx:
        'signatureDisplayWidthPx' in b
          ? b.signatureDisplayWidthPx === null || typeof b.signatureDisplayWidthPx === 'number'
            ? (b.signatureDisplayWidthPx as number | null)
            : undefined
          : undefined,
      clearSignature: b.clearSignature === true,
    });
    res.json({ profile, placeholders: [...EC_ISSUER_PLACEHOLDER_KEYS] });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      const m = e instanceof Error ? e.message : '';
      const msg =
        m === 'company_required'
          ? '상호(회사명)를 입력해 주세요.'
          : m === 'seal_bad_public_id'
            ? '도장 업로드 식별자가 올바르지 않습니다.'
            : m === 'seal_bad_url'
              ? '도장 이미지 URL이 올바르지 않습니다.'
              : m === 'signature_bad_public_id'
                ? '서명 이미지 업로드 식별자가 올바르지 않습니다.'
                : m === 'signature_bad_url'
                  ? '서명 이미지 URL이 올바르지 않습니다.'
                  : m === 'stamp_kind_invalid'
                    ? '갑 인감 표시 방식이 올바르지 않습니다.'
                    : m === 'seal_width_range'
                      ? '도장 표시 너비는 48~320 사이 숫자로 입력해 주세요.'
                      : m === 'signature_width_range'
                        ? '서명 표시 너비는 48~320 사이 숫자로 입력해 주세요.'
                        : m === 'nothing_to_patch'
                          ? '변경할 값이 없습니다.'
                          : '입력값을 확인해 주세요.';
      res.status(400).json({ error: msg });
      return;
    }
    console.error('[e-contract] issuer profile PATCH', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

router.post('/issuer-profile/upload-sign', async (_req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: '이미지 저장소가 준비되지 않았습니다.' });
      return;
    }

    const ts = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp: ts, folder: ISSUER_SEAL_CLOUDINARY_FOLDER };

    const cfg = cloudinary.config();
    if (!cfg.api_secret) {
      res.status(503).json({ error: '저장 설정이 불완전합니다.' });
      return;
    }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret);

    res.json({
      cloudName: cfg.cloud_name,
      apiKey: cfg.api_key,
      timestamp: ts,
      signature,
      folder: ISSUER_SEAL_CLOUDINARY_FOLDER,
    });
  } catch (e) {
    console.error('[e-contract] issuer seal upload-sign', e);
    res.status(500).json({ error: '업로드 서명에 실패했습니다.' });
  }
});

router.post('/preview-body', async (req, res) => {
  try {
    const bodyMarkdown =
      typeof req.body?.bodyMarkdown === 'string' ? req.body.bodyMarkdown.replace(/\r\n/g, '\n') : '';
    const pk = typeof req.body?.profileKey === 'string' ? req.body.profileKey : undefined;
    const out = await previewBodyWithIssuerProfile(pk, bodyMarkdown);
    res.json(out);
  } catch (e) {
    console.error('[e-contract] preview-body', e);
    res.status(500).json({ error: '미리보기를 만들지 못했습니다.' });
  }
});

router.get('/definitions', async (_req, res) => {
  try {
    const rows = await listDefinitions();
    res.json({ definitions: rows });
  } catch (e) {
    console.error('[e-contract] list definitions', e);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

router.post('/definitions', async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const audienceRaw = typeof req.body?.audience === 'string' ? req.body.audience.trim() : '';
    const audience =
      audienceRaw === 'MARKETER' ? EContractAudience.MARKETER : EContractAudience.TEAM_LEADER;
    const row = await createDefinition(actor(req).userId, title, description, audience);
    res.status(201).json({ definition: row });
  } catch (e: unknown) {
    if (e instanceof Error && (e as { code?: string }).code === 'bad_request') {
      res.status(400).json({ error: '제목을 입력해 주세요.' });
      return;
    }
    console.error('[e-contract] create definition', e);
    res.status(500).json({ error: '등록하지 못했습니다.' });
  }
});

router.get('/definitions/:id', async (req, res) => {
  try {
    const row = await getDefinitionWithVersions(req.params.id);
    if (!row) {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    res.json({ definition: row });
  } catch (e) {
    console.error('[e-contract] get definition', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.patch('/definitions/:id', async (req, res) => {
  try {
    const b = req.body ?? {};
    const patch: Parameters<typeof patchDefinition>[1] = {};
    if (typeof b.title === 'string') patch.title = b.title;
    if ('description' in b) {
      patch.description = typeof b.description === 'string' ? b.description : null;
    }
    if (typeof b.isArchived === 'boolean') patch.isArchived = b.isArchived;
    if (typeof b.audience === 'string') {
      patch.audience =
        b.audience.trim() === 'MARKETER' ? EContractAudience.MARKETER : EContractAudience.TEAM_LEADER;
    }
    const row = await patchDefinition(req.params.id, patch);
    res.json({ definition: row });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      res.status(400).json({
        error: e instanceof Error && e.message === 'nothing_to_patch' ? '변경할 값이 없습니다.' : '제목을 확인해 주세요.',
      });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({
        error:
          e instanceof Error && e.message === 'audience_locked'
            ? '발급 내역이 있어 수신 대상 유형을 바꿀 수 없습니다.'
            : '처리할 수 없습니다.',
      });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    console.error('[e-contract] patch definition', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

router.delete('/definitions/:id', async (req, res) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: '본인 비밀번호를 입력해 주세요.' });
      return;
    }
    const uid = actor(req).userId;
    const dbUser = await prisma.user.findUnique({ where: { id: uid } });
    if (!dbUser?.passwordHash) {
      res.status(403).json({ error: '비밀번호 확인에 실패했습니다.' });
      return;
    }
    const ok = await bcrypt.compare(password, dbUser.passwordHash);
    if (!ok) {
      res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    await deleteDefinitionHard(uid, req.params.id);
    res.json({ ok: true });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'conflict') {
      res.status(409).json({ error: '체결 내역이 있어 삭제할 수 없습니다.' });
      return;
    }
    console.error('[e-contract] delete definition', e);
    res.status(500).json({ error: '삭제하지 못했습니다.' });
  }
});

router.get('/definitions/:id/issuances', async (req, res) => {
  try {
    const rows = await listIssuancesForDefinition(req.params.id, 120);
    res.json({ issuances: rows });
  } catch (e) {
    console.error('[e-contract] list issuances', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.post('/definitions/:id/draft', async (_req, res) => {
  try {
    const draft = await ensureDraft(_req.params.id);
    res.status(201).json({ draft });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'not_found') {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    console.error('[e-contract] ensure draft', e);
    res.status(500).json({ error: '초안을 만들지 못했습니다.' });
  }
});

router.patch('/versions/:vid', async (req, res) => {
  try {
    const body = req.body ?? {};
    const row = await patchDraftVersion(req.params.vid, {
      titleSnapshot: typeof body.titleSnapshot === 'string' ? body.titleSnapshot : undefined,
      bodyMarkdown:
        typeof body.bodyMarkdown === 'string' ? body.bodyMarkdown.replace(/\r\n/g, '\n') : undefined,
    });
    res.json({ version: row });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      const msg =
        e instanceof Error
          ? e.message === 'not_draft'
            ? '배포된 버전은 여기서 수정할 수 없습니다. 새 초안으로 편집하세요.'
            : e.message === 'nothing_to_patch'
              ? '변경할 값이 없습니다.'
              : '제목과 본문을 확인해 주세요.'
          : '확인해 주세요.';
      res.status(400).json({ error: msg });
      return;
    }
    console.error('[e-contract] patch version', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

router.post('/versions/:vid/publish', async (req, res) => {
  try {
    const row = await publishVersion(actor(req).userId, req.params.vid);
    res.json({ version: row });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'bad_request') {
      res.status(400).json({ error: '초안만 배포할 수 있습니다.' });
      return;
    }
    console.error('[e-contract] publish', e);
    res.status(500).json({ error: '배포하지 못했습니다.' });
  }
});

router.delete('/versions/:vid', async (req, res) => {
  try {
    const vid = req.params.vid;
    const existing = await prisma.eContractVersion.findUnique({
      where: { id: vid },
      select: { status: true },
    });
    if (!existing) {
      res.status(404).json({ error: '없습니다.' });
      return;
    }

    if (existing.status === EContractVersionStatus.DRAFT) {
      await deleteDraft(vid);
      res.json({ ok: true });
      return;
    }

    if (existing.status !== EContractVersionStatus.PUBLISHED) {
      res.status(400).json({ error: '삭제할 수 없는 버전입니다.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: '본인 비밀번호를 입력해 주세요.' });
      return;
    }
    const uid = actor(req).userId;
    const dbUser = await prisma.user.findUnique({ where: { id: uid } });
    if (!dbUser?.passwordHash) {
      res.status(403).json({ error: '비밀번호 확인에 실패했습니다.' });
      return;
    }
    const ok = await bcrypt.compare(password, dbUser.passwordHash);
    if (!ok) {
      res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    await deletePublishedVersion(uid, vid);
    res.json({ ok: true });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      res.status(400).json({
        error:
          e instanceof Error && e.message === 'not_published'
            ? '배포된 버전만 이 경로로 삭제할 수 있습니다.'
            : '초안은 「초안 폐기」를 사용하세요.',
      });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({
        error: '이 버전으로 체결된 내역이 있어 삭제할 수 없습니다.',
      });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '없습니다.' });
      return;
    }
    console.error('[e-contract] delete version', e);
    res.status(500).json({ error: '삭제하지 못했습니다.' });
  }
});

router.get('/pickers/marketers', async (_req, res) => {
  try {
    const users = await listMarketersForPicker();
    res.json({ marketers: users });
  } catch (e) {
    console.error('[e-contract] marketers picker', e);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

router.get('/pickers/recipients', async (_req, res) => {
  try {
    const users = await listAllContractRecipientsForPicker();
    res.json({ recipients: users });
  } catch (e) {
    console.error('[e-contract] recipients picker', e);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

router.get('/pickers/team-leaders', async (_req, res) => {
  try {
    const users = await listTeamLeadersForPicker();
    res.json({ teamLeaders: users });
  } catch (e) {
    console.error('[e-contract] team leaders picker', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.get('/team-leaders/:userId/submissions', async (req, res) => {
  try {
    const items = await listSubmissionsByTeamLeader(req.params.userId);
    res.json({ submissions: items });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'bad_request') {
      res.status(400).json({ error: '팀장 계정이 아닙니다.' });
      return;
    }
    console.error('[e-contract] submissions by TL', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.get('/submissions', async (req, res) => {
  try {
    const query = parseEContractListQuery(req.query as Record<string, unknown>);
    const result = await listAllSubmissionsForAdmin(query);
    res.json({ submissions: result.items, total: result.total });
  } catch (e) {
    console.error('[e-contract] submissions list all', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.get('/submissions/:submissionId/docx', async (req, res) => {
  try {
    const detail = await getSubmissionDetailForAdmin(req.params.submissionId);
    const buf = await submissionMergedHtmlToDocxBuffer({
      definitionTitle: detail.definitionTitle,
      metaLinePlain: `${detail.teamLeader.name} (${detail.teamLeader.email}) · ${new Date(detail.signedAt).toLocaleString('ko-KR')}`,
      bodyHtml: detail.bodyHtml,
      submissionId: detail.id,
    });
    const ascii = `e-contract-${req.params.submissionId.slice(0, 8)}.docx`;
    const utf8Name = `${detail.definitionTitle.replace(/["\r\n]/g, ' ').slice(0, 80)}_체결.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`
    );
    res.send(buf);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'not_found') {
      res.status(404).json({ error: '체결 기록을 찾을 수 없습니다.' });
      return;
    }
    console.error('[e-contract] submission docx', e);
    res.status(500).json({ error: 'Word 파일을 만들지 못했습니다.' });
  }
});

router.get('/submissions/:submissionId', async (req, res) => {
  try {
    const detail = await getSubmissionDetailForAdmin(req.params.submissionId);
    res.json({ submission: detail });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'not_found') {
      res.status(404).json({ error: '체결 기록을 찾을 수 없습니다.' });
      return;
    }
    console.error('[e-contract] submission detail', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.post('/issuances', async (req, res) => {
  try {
    const b = req.body ?? {};
    const definitionId = typeof b.definitionId === 'string' ? b.definitionId : '';
    const recipientUserId =
      typeof b.recipientUserId === 'string'
        ? b.recipientUserId
        : typeof b.teamLeaderId === 'string'
          ? b.teamLeaderId
          : '';
    const versionId = typeof b.versionId === 'string' ? b.versionId : null;
    if (!definitionId || !recipientUserId) {
      res.status(400).json({ error: '계약서와 수신자를 선택해 주세요.' });
      return;
    }
    const expiresAt =
      typeof b.expiresAt === 'string' && b.expiresAt.trim()
        ? new Date(b.expiresAt)
        : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      res.status(400).json({ error: '만료일시가 올바르지 않습니다.' });
      return;
    }
    const notes = typeof b.notes === 'string' ? b.notes : null;
    const row = await createIssuance({
      definitionId,
      recipientUserId,
      versionId,
      expiresAt,
      notes,
    });
    if (row.teamLeader.role) {
      notifyEContractInboxIfTeamLeader(row.teamLeaderId, row.teamLeader.role);
    }
    res.status(201).json({ issuance: row });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'bad_request') {
      const m = e instanceof Error ? e.message : '';
      const msg =
        m === 'recipient_invalid'
          ? '선택한 수신자가 이 계약서 유형(팀장/마케터)과 맞지 않습니다.'
          : m === 'team_leader_invalid'
            ? '팀장 계정만 선택할 수 있습니다.'
          : m === 'no_published_version'
            ? '먼저 계약 내용을 배포한 뒤 링크를 발급해 주세요.'
            : m === 'version_mismatch'
              ? '선택한 버전이 해당 계약서와 맞지 않습니다.'
              : '요청을 확인해 주세요.';
      res.status(400).json({ error: msg });
      return;
    }
    console.error('[e-contract] issuance', e);
    res.status(500).json({ error: '발급하지 못했습니다.' });
  }
});

export default router;
