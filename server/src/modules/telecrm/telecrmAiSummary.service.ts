import { prisma } from '../../lib/prisma.js';
import { filterSoomgoChatMessages } from '../../lib/soomgoChatTranscriptNoise.js';
import { formatCrmAiActionLabel } from '../../lib/crmAiActionLabels.js';
import { callOpenAiJson, isAiProductConfigured } from '../ai/aiProvider.service.js';
import { assertTelecrmAiQuota, getTelecrmAiUsageSnapshot } from './telecrmAiLimit.service.js';
import type { TelecrmAiUsageSnapshot } from './telecrmAiLimit.service.js';

const MAX_MESSAGE_CHARS = 14_000;
const MAX_MESSAGES = 200;
const MAX_TOTAL_MESSAGE_CHARS = 80_000;

export type TelecrmChatSummaryMessage = {
  role: 'customer' | 'pro' | 'system';
  text: string;
  at?: string | null;
};

export type TelecrmAiNextAction = {
  action: string;
  suggestedReply: string;
};

export type TelecrmChatSummaryResult = {
  summary: string;
  customerQuestions: string[];
  nextActions: TelecrmAiNextAction[];
  suggestedReply?: string;
  warnings?: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    model: string;
  };
  monthUsage: TelecrmAiUsageSnapshot;
};

type AiSummaryJson = {
  summary?: string;
  customerQuestions?: unknown;
  nextActions?: unknown;
  suggestedReply?: string | null;
  warnings?: unknown;
};

export function isTelecrmAiConfigured(): boolean {
  return isAiProductConfigured('telecrm_summary');
}

function normalizeMessages(raw: unknown): TelecrmChatSummaryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: TelecrmChatSummaryMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const text = (item as { text?: unknown }).text;
    if (role !== 'customer' && role !== 'pro' && role !== 'system') continue;
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) continue;
    const atRaw = (item as { at?: unknown }).at;
    out.push({
      role,
      text: trimmed.slice(0, 4000),
      at: typeof atRaw === 'string' ? atRaw : null,
    });
    if (out.length >= MAX_MESSAGES) break;
  }
  return filterSoomgoChatMessages(out);
}

function truncateForPrompt(messages: TelecrmChatSummaryMessage[]): {
  messages: TelecrmChatSummaryMessage[];
  warnings: string[];
} {
  const warnings: string[] = [];
  let total = 0;
  const kept: TelecrmChatSummaryMessage[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!;
    const len = msg.text.length + 20;
    if (kept.length > 0 && total + len > MAX_MESSAGE_CHARS) break;
    kept.unshift(msg);
    total += len;
  }
  if (kept.length < messages.length) {
    warnings.push(
      `대화가 길어 최근 ${kept.length}건만 AI에 전달했습니다. (전체 ${messages.length}건)`,
    );
  }
  return { messages: kept, warnings };
}

function formatTranscriptLines(messages: TelecrmChatSummaryMessage[]): string {
  return messages
    .map((m) => {
      const who = m.role === 'customer' ? '고객' : m.role === 'pro' ? '고수' : '시스템';
      return `[${who}] ${m.text}`;
    })
    .join('\n');
}

function parseStringArray(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 500))
    .slice(0, max);
}

function parseNextActions(raw: unknown): TelecrmAiNextAction[] {
  if (!Array.isArray(raw)) return [];
  const out: TelecrmAiNextAction[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ action: formatCrmAiActionLabel(item.trim()).slice(0, 500), suggestedReply: '' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const o = item as { action?: unknown; suggestedReply?: unknown };
    const action = typeof o.action === 'string' ? o.action.trim() : '';
    const suggestedReply = typeof o.suggestedReply === 'string' ? o.suggestedReply.trim() : '';
    if (action) {
      out.push({
        action: formatCrmAiActionLabel(action).slice(0, 500),
        suggestedReply: suggestedReply.slice(0, 2000),
      });
    }
  }
  return out.slice(0, 5);
}

export async function summarizeTelecrmChat(params: {
  tenantId: string;
  userId: string;
  source: string;
  chatId: string;
  inquiryId?: string | null;
  customerName?: string | null;
  messages: unknown;
  contentHash?: string | null;
  persistSummary?: boolean;
}): Promise<
  | { ok: true; data: TelecrmChatSummaryResult }
  | { ok: false; status: number; error: string; code?: string }
> {
  if (!isTelecrmAiConfigured()) {
    return {
      ok: false,
      status: 503,
      error: 'AI 정리 기능이 설정되지 않았습니다. TELECRM_AI_OPENAI_API_KEY를 확인해 주세요.',
      code: 'telecrm_ai_not_configured',
    };
  }

  const chatId = params.chatId.trim();
  if (!/^\d+$/.test(chatId)) {
    return { ok: false, status: 400, error: 'chatId가 올바르지 않습니다.' };
  }

  const rawList = Array.isArray(params.messages) ? params.messages : [];
  if (rawList.length > MAX_MESSAGES) {
    return {
      ok: false,
      status: 400,
      error: `메시지가 ${MAX_MESSAGES}건을 초과합니다. 대화 가져오기 후 다시 시도해 주세요.`,
      code: 'telecrm_ai_too_many_messages',
    };
  }

  const messages = normalizeMessages(params.messages);
  if (messages.length === 0) {
    return { ok: false, status: 400, error: '정리할 대화 메시지가 없습니다.', code: 'telecrm_ai_empty' };
  }

  const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0);
  if (totalChars > MAX_TOTAL_MESSAGE_CHARS) {
    return {
      ok: false,
      status: 400,
      error: `대화가 너무 깁니다(약 ${Math.ceil(totalChars / 1000)}천 글자). 숨고 방을 나누거나 최근 대화만 정리해 주세요.`,
      code: 'telecrm_ai_transcript_too_long',
    };
  }

  const inqId =
    typeof params.inquiryId === 'string' && params.inquiryId.trim() ? params.inquiryId.trim() : null;
  if (inqId) {
    const inquiry = await prisma.inquiry.findFirst({
      where: { id: inqId, tenantId: params.tenantId },
      select: { id: true },
    });
    if (!inquiry) {
      return { ok: false, status: 404, error: '접수를 찾을 수 없습니다.' };
    }
  }

  const quota = await assertTelecrmAiQuota(params.tenantId);
  if (!quota.ok) {
    return { ok: false, status: quota.status, error: quota.error, code: quota.code };
  }

  const { messages: promptMessages, warnings: truncateWarnings } = truncateForPrompt(messages);
  const customerLabel = (params.customerName || '').trim() || '고객';

  const system = [
    'You summarize Korean Soomgo (숨고) cleaning service chat transcripts for a call-center agent (청소비서 텔레CRM).',
    'Return JSON only with keys:',
    'summary (Korean, 1-3 sentences),',
    'customerQuestions (string array, max 5 — real customer questions from the transcript only),',
    'nextActions (array of objects { action: string, suggestedReply: string }, max 5).',
    'Each nextActions item: action = short Korean task label for the agent (examples: "가격 안내", "팀 구성 설명", "입주·준공 차이 설명", "예약금 안내") — NEVER English camelCase codes like confirmPrice.',
    'Each nextActions item: suggestedReply = complete Korean message the pro can paste into Soomgo chat.',
    'CRITICAL — suggestedReply must DIRECTLY answer the related customer question when the customer asked something (e.g. 입주청소 vs 준공청소 차이, 가격, 일정, 외국인 작업자, 청소 범위).',
    'For cleaning terminology or technical customer questions: include accurate brief explanation IN suggestedReply (not "설명드리겠습니다" alone).',
    'Do NOT reply with only "차이를 설명드리겠습니다" — include the actual concise explanation in suggestedReply.',
    'Cleaning reference (use when customer asks; keep accurate and brief):',
    '입주청소 = 이사/입주 전 빈 공간(가구 적음) 먼지·오염 제거, 거주 전 마무리.',
    '준공청소 = 공사·리모델링 직후 건설먼지·잔재물 중심 정리, 공사 오염이 많음.',
    '이사청소 = 이사 나가기/들어가기 전후 정리. 거주청소 = 거주 중인 집 정기·부분 청소.',
    'suggestedReply tone: warm, friendly, lively but professional Korean; 2-4 short sentences when explaining; include 1-2 natural emojis (😊 🙏 ✨ 👍); no markdown, no bullet labels.',
    'warnings (optional Korean, short).',
    'Focus on: schedule/area/pyeong/price/deposit, customer intent, unanswered questions.',
    'Ignore UI menu text, legal disclaimers, fraud warnings from the platform — they are not customer chat.',
    'Do not invent prices or dates not in the transcript.',
  ].join(' ');

  const user = [
    `Customer label: ${customerLabel}`,
    `Chat ID: ${chatId}`,
    '--- transcript (oldest to newest) ---',
    formatTranscriptLines(promptMessages).slice(0, MAX_MESSAGE_CHARS + 500),
  ].join('\n');

  const { json: rawJson, usage, failed } = await callOpenAiJson({
    product: 'telecrm_summary',
    system,
    user,
    temperature: 0.2,
    logContext: {
      tenantId: params.tenantId,
      userId: params.userId,
      chatId,
      inquiryId: inqId,
      source: params.source,
    },
  });
  const json = rawJson as AiSummaryJson | null;
  if (failed || !json || !usage) {
    return {
      ok: false,
      status: 502,
      error: 'AI 정리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      code: 'telecrm_ai_failed',
    };
  }

  const summary = typeof json.summary === 'string' ? json.summary.trim().slice(0, 1200) : '';
  if (!summary) {
    return {
      ok: false,
      status: 502,
      error: 'AI 응답 형식이 올바르지 않습니다.',
      code: 'telecrm_ai_invalid_response',
    };
  }

  const customerQuestions = parseStringArray(json.customerQuestions);
  let nextActions = parseNextActions(json.nextActions);
  const legacySuggestedReply =
    typeof json.suggestedReply === 'string' && json.suggestedReply.trim()
      ? json.suggestedReply.trim().slice(0, 2000)
      : undefined;
  const suggestedReply =
    legacySuggestedReply ||
    nextActions.find((a) => a.suggestedReply.trim())?.suggestedReply ||
    undefined;
  for (const item of nextActions) {
    if (!item.suggestedReply.trim() && suggestedReply) {
      item.suggestedReply = suggestedReply;
    }
  }
  const aiWarnings = parseStringArray(json.warnings, 5);
  const warnings = [...truncateWarnings, ...aiWarnings];

  const payloadJson = {
    summary,
    customerQuestions,
    nextActions,
    suggestedReply: suggestedReply ?? null,
    warnings,
    customerName: customerLabel,
    chatId,
    contentHash: params.contentHash ?? null,
  };

  if (params.persistSummary) {
    const hashKey = (params.contentHash || '').trim() || '_none';
    await prisma.telecrmAiSummary.upsert({
      where: {
        tenantId_chatId_contentHash: {
          tenantId: params.tenantId,
          chatId,
          contentHash: hashKey,
        },
      },
      create: {
        tenantId: params.tenantId,
        userId: params.userId,
        chatId,
        inquiryId: inqId,
        contentHash: hashKey,
        summary,
        payloadJson,
      },
      update: {
        userId: params.userId,
        inquiryId: inqId,
        summary,
        payloadJson,
      },
    });
  }

  const monthUsage = await getTelecrmAiUsageSnapshot(params.tenantId);

  return {
    ok: true,
    data: {
      summary,
      customerQuestions,
      nextActions,
      suggestedReply,
      warnings: warnings.length > 0 ? warnings : undefined,
      usage,
      monthUsage,
    },
  };
}
