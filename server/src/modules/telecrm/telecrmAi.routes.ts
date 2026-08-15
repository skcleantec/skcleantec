import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTelecrmPlatform } from './requireTelecrmAccess.js';
import { requireTelecrmTenant } from './telecrm.helpers.js';
import { summarizeTelecrmChat } from './telecrmAiSummary.service.js';
import { getTelecrmAiUsageSnapshot } from './telecrmAiLimit.service.js';

const router = Router();
router.use(staffMarketerRoleOnly, requireTelecrmPlatform('soomgo'));

router.get('/usage-month', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  try {
    const snapshot = await getTelecrmAiUsageSnapshot(tenantId);
    res.json(snapshot);
  } catch (e) {
    console.error('[telecrm-ai] usage-month failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'AI 사용량을 불러올 수 없습니다.', code: 'telecrm_ai_usage_failed' });
  }
});

router.post('/chat-summary', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;

  const body = req.body as {
    source?: string;
    chatId?: string;
    inquiryId?: string | null;
    customerName?: string | null;
    messages?: unknown;
    contentHash?: string | null;
    persistSummary?: boolean;
  };

  const source = typeof body.source === 'string' ? body.source.trim() : 'soomgo';
  if (source !== 'soomgo') {
    res.status(400).json({ error: '지원하지 않는 source입니다.' });
    return;
  }

  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
  if (!chatId) {
    res.status(400).json({ error: 'chatId가 필요합니다.' });
    return;
  }

  try {
    const result = await summarizeTelecrmChat({
      tenantId,
      userId: user.userId,
      source,
      chatId,
      inquiryId: body.inquiryId,
      customerName: body.customerName,
      messages: body.messages,
      contentHash: body.contentHash,
      persistSummary: Boolean(body.persistSummary),
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error, code: result.code });
      return;
    }

    res.json(result.data);
  } catch (e) {
    console.error('[telecrm-ai] chat-summary failed', e instanceof Error ? e.message : e);
    res.status(500).json({ error: 'AI 정리에 실패했습니다.', code: 'telecrm_ai_server_error' });
  }
});

export const telecrmAiRouter = router;
