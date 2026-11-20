import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { estimateOpenAiCostUsdMicros } from '../ai/aiCost.service.js';
import { persistAiUsageLog } from '../ai/aiUsageLog.service.js';
import { assertTelecrmAiQuota } from './telecrmAiLimit.service.js';
import { loadCoachCards } from './telecrmResponseCards.service.js';

export type CoachSuggestion = { label: string; text: string };
export type CoachResult = {
  suggestions: CoachSuggestion[];
  nextQuestion: string;
  basedOn: string[];
};

const OUTPUT_RULE = `
출력은 JSON 객체 하나만 만든다.
{"suggestions":[{"label":"짧은 이름","text":"바로 말할 문장"}],"nextQuestion":"다음에 물어볼 한 문장","basedOn":["C001"]}
suggestions는 2개 또는 3개. 각 text는 통화에서 바로 읽을 입말 2~3문장.
basedOn은 아래에 준 카드 code 중에서, 실제로 쓴 것만.
카드와 이 지침에 없는 금액·할인·서비스·인원·일정 약속은 만들지 않는다.
모르면 text에 「확인해서 말씀드릴게요」를 넣고 basedOn은 빈 배열로 둔다.
`;

function loadCoachPrompt(): string {
  const candidates = [
    fileURLToPath(new URL('./prompts/telemarketingCoach.md', import.meta.url)),
    path.join(process.cwd(), 'src/modules/telecrm/prompts/telemarketingCoach.md'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  throw new Error('coach prompt missing');
}

function telecrmApiKey(): string {
  return (process.env.TELECRM_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function telecrmModel(): string {
  return process.env.TELECRM_AI_MODEL?.trim() || 'gpt-4o-mini';
}

export function parseCoachJson(raw: unknown, allowedCodes: Set<string>): CoachResult {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const suggestions: CoachSuggestion[] = [];
  if (Array.isArray(row.suggestions)) {
    for (const item of row.suggestions) {
      if (!item || typeof item !== 'object') continue;
      const label = typeof (item as { label?: unknown }).label === 'string' ? (item as { label: string }).label.trim() : '';
      const text = typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text.trim() : '';
      if (!label || !text) continue;
      suggestions.push({ label: label.slice(0, 40), text: text.slice(0, 500) });
      if (suggestions.length >= 3) break;
    }
  }
  const nextQuestion = typeof row.nextQuestion === 'string' ? row.nextQuestion.trim().slice(0, 200) : '';
  const basedOn = Array.isArray(row.basedOn)
    ? row.basedOn
        .filter((code): code is string => typeof code === 'string' && allowedCodes.has(code.trim()))
        .map((code) => code.trim())
        .slice(0, 6)
    : [];
  if (suggestions.length === 0) {
    suggestions.push({ label: '확인', text: '확인해서 말씀드릴게요.' });
  }
  return { suggestions, nextQuestion, basedOn };
}

function customerBlock(customer: {
  pyeong?: string;
  structure?: string;
  cleaningType?: string;
  brand?: string;
  step?: string;
}): string {
  const lines = [
    customer.pyeong ? `평수: ${customer.pyeong}` : '',
    customer.structure ? `구조: ${customer.structure}` : '',
    customer.cleaningType ? `청소 종류: ${customer.cleaningType}` : '',
    customer.brand ? `브랜드: ${customer.brand}` : '',
    customer.step ? `상담 단계: ${customer.step}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : '없음';
}

export async function coachResponseCards(params: {
  tenantId: string;
  userId: string;
  operatingCompanyId: string;
  q: string;
  cardIds: string[];
  customer: {
    pyeong?: string;
    structure?: string;
    cleaningType?: string;
    brand?: string;
    step?: string;
  };
  onDelta?: (text: string) => void;
}): Promise<{ ok: true; data: CoachResult } | { ok: false; status: number; error: string; code?: string }> {
  const quota = await assertTelecrmAiQuota(params.tenantId);
  if (!quota.ok) return quota;

  const apiKey = telecrmApiKey();
  if (!apiKey) {
    return { ok: false, status: 503, error: 'AI 코치가 설정되지 않았습니다.', code: 'telecrm_ai_not_configured' };
  }

  let prompt: string;
  try {
    prompt = loadCoachPrompt();
  } catch {
    return { ok: false, status: 503, error: 'AI 코치 지침을 찾을 수 없습니다.', code: 'telecrm_coach_prompt_missing' };
  }

  const cards = await loadCoachCards({
    tenantId: params.tenantId,
    operatingCompanyId: params.operatingCompanyId,
    cardIds: params.cardIds,
  });
  const allowed = new Set(cards.map((card) => card.code));
  const cardText = cards.length
    ? cards
        .map((card) => {
          const lines = card.responses.map((row) => `- ${row[0]}: ${row[1]}`).join('\n');
          return [
            `${card.code} ${card.title}${card.wonInCall ? ' ★' : ''}`,
            card.intent ? `속마음: ${card.intent}` : '',
            lines,
            card.avoid.length ? `피할 말: ${card.avoid.join(' / ')}` : '',
            card.rule ? `기준: ${card.rule}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n')
    : '없음';

  const model = telecrmModel();
  const body = {
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    stream: Boolean(params.onDelta),
    ...(params.onDelta ? { stream_options: { include_usage: true } } : {}),
    messages: [
      { role: 'system', content: `${prompt}\n${OUTPUT_RULE}` },
      {
        role: 'user',
        content: `상담사 말:\n${params.q}\n\n고객:\n${customerBlock(params.customer)}\n\n대응 카드:\n${cardText}`,
      },
    ],
  };

  let content = '';
  let promptTokens = 0;
  let completionTokens = 0;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error('[telecrm-cards] coach HTTP', res.status, model);
      return { ok: false, status: 502, error: 'AI 코치 응답을 받지 못했습니다.', code: 'telecrm_coach_failed' };
    }
    if (params.onDelta && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            params.onDelta(delta);
          }
          if (json.usage) {
            promptTokens = json.usage.prompt_tokens ?? promptTokens;
            completionTokens = json.usage.completion_tokens ?? completionTokens;
          }
        }
      }
    } else {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      content = data.choices?.[0]?.message?.content ?? '';
      promptTokens = data.usage?.prompt_tokens ?? 0;
      completionTokens = data.usage?.completion_tokens ?? 0;
    }
  } catch (e) {
    console.error('[telecrm-cards] coach request failed', e instanceof Error ? e.name : 'unknown');
    return { ok: false, status: 502, error: 'AI 코치 응답을 받지 못했습니다.', code: 'telecrm_coach_failed' };
  }

  if (promptTokens + completionTokens > 0) {
    try {
      await persistAiUsageLog({
        product: 'telecrm_summary',
        context: { tenantId: params.tenantId, userId: params.userId, source: 'response_coach' },
        model,
        promptTokens,
        completionTokens,
        estimatedCostUsdMicros: estimateOpenAiCostUsdMicros(model, promptTokens, completionTokens),
      });
    } catch (e) {
      console.error('[telecrm-cards] usage log failed', e instanceof Error ? e.message : 'unknown');
    }
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, status: 502, error: 'AI 코치 응답을 해석할 수 없습니다.', code: 'telecrm_coach_parse' };
  }
  return { ok: true, data: parseCoachJson(parsed, allowed) };
}
