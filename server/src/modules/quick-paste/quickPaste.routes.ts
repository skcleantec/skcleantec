import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { mapTenantCoinError } from '../tenants/tenantCoin.service.js';
import {
  buildQuickPastePreview,
  commitQuickPasteIntake,
  normalizeCorrections,
  QuickPasteValidationError,
  type QuickPasteCommitSnapshot,
} from './quickPasteCommit.service.js';
import {
  askQuickPasteMissingField,
  respondQuickPasteMissingField,
} from './quickPasteClarify.service.js';
import {
  listQuickPasteLearnedRules,
  listQuickPasteLearningLogs,
} from './quickPasteLearning.service.js';
import type { QuickPasteFieldKey } from './quickPaste.constants.js';
import { QUICK_PASTE_REQUIRED_FIELDS } from './quickPaste.constants.js';

const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.create'));

router.post('/parse', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const preview = await buildQuickPastePreview(rawText, tenantId, user.userId);
    res.json(preview);
  } catch (e) {
    const coinErr = mapTenantCoinError(e);
    if (coinErr) {
      res.status(coinErr.status).json({ error: coinErr.message });
      return;
    }
    console.error('[quick-paste] parse', e);
    res.status(500).json({ error: '분석에 실패했습니다.' });
  }
});

router.post('/commit', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const overrides =
      req.body?.draft && typeof req.body.draft === 'object'
        ? (req.body.draft as Record<string, unknown>)
        : {};
    const snap = req.body?.parseSnapshot;
    const parseSnapshot: QuickPasteCommitSnapshot | undefined =
      snap && typeof snap === 'object'
        ? {
            ruleDraft:
              snap.ruleDraft && typeof snap.ruleDraft === 'object'
                ? (snap.ruleDraft as QuickPasteCommitSnapshot['ruleDraft'])
                : undefined,
            previewDraft:
              snap.previewDraft && typeof snap.previewDraft === 'object'
                ? (snap.previewDraft as QuickPasteCommitSnapshot['previewDraft'])
                : undefined,
            aiApplied: snap.aiApplied === true,
            aiFilledFields: Array.isArray(snap.aiFilledFields)
              ? snap.aiFilledFields.filter((x: unknown) => typeof x === 'string')
              : undefined,
          }
        : undefined;

    const corrections = normalizeCorrections(req.body?.corrections);
    const result = await commitQuickPasteIntake({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      rawText,
      overrides,
      parseSnapshot,
      corrections,
    });
    res.status(201).json(result);
  } catch (e) {
    const coinErr = mapTenantCoinError(e);
    if (coinErr) {
      res.status(coinErr.status).json({ error: coinErr.message });
      return;
    }
    if (e instanceof QuickPasteValidationError) {
      res.status(400).json({ error: e.message, missingFields: e.missingFields ?? [] });
      return;
    }
    console.error('[quick-paste] commit', e);
    res.status(500).json({ error: '등록에 실패했습니다.' });
  }
});

router.post('/clarify/ask', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const fieldKey = req.body?.fieldKey as QuickPasteFieldKey;
    const draft = req.body?.draft as Record<string, unknown> | undefined;
    if (!rawText.trim() || !fieldKey || !draft || !QUICK_PASTE_REQUIRED_FIELDS.includes(fieldKey)) {
      res.status(400).json({ error: '요청 형식이 올바르지 않습니다.' });
      return;
    }
    const result = await askQuickPasteMissingField(rawText, draft as never, fieldKey);
    res.json(result);
  } catch (e) {
    console.error('[quick-paste] clarify ask', e);
    res.status(500).json({ error: '질문 생성에 실패했습니다.' });
  }
});

router.post('/clarify/respond', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const fieldKey = req.body?.fieldKey as QuickPasteFieldKey;
    const userAnswer = typeof req.body?.userAnswer === 'string' ? req.body.userAnswer : '';
    const draft = req.body?.draft as Record<string, unknown> | undefined;
    const snippet = typeof req.body?.snippet === 'string' ? req.body.snippet : null;
    const sourceLabel = typeof req.body?.sourceLabel === 'string' ? req.body.sourceLabel : null;
    if (!rawText.trim() || !fieldKey || !userAnswer.trim() || !draft || !QUICK_PASTE_REQUIRED_FIELDS.includes(fieldKey)) {
      res.status(400).json({ error: '답변을 입력해 주세요.' });
      return;
    }
    const result = await respondQuickPasteMissingField(prisma, tenantId, {
      rawText,
      draft: draft as never,
      fieldKey,
      userAnswer,
      snippet,
      sourceLabel,
    });
    res.json(result);
  } catch (e) {
    console.error('[quick-paste] clarify respond', e);
    res.status(500).json({ error: '학습에 실패했습니다.' });
  }
});

router.get('/learning/rules', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const rules = await listQuickPasteLearnedRules(prisma, tenantId, { limit, source });
    res.json({ rules, total: rules.length });
  } catch (e) {
    console.error('[quick-paste] learning rules', e);
    res.status(500).json({ error: '학습 규칙 조회에 실패했습니다.' });
  }
});

router.get('/learning/logs', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
    const logs = await listQuickPasteLearningLogs(prisma, tenantId, { limit });
    res.json({ logs, total: logs.length });
  } catch (e) {
    console.error('[quick-paste] learning logs', e);
    res.status(500).json({ error: '학습 로그 조회에 실패했습니다.' });
  }
});

export default router;
