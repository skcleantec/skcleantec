import type { AiProductKey } from './aiProduct.constants.js';
import { estimateOpenAiCostUsdMicros } from './aiCost.service.js';
import { persistAiUsageLog, type AiUsageLogContext } from './aiUsageLog.service.js';

/** 실패 이유 — 화면에 원인별 안내를 띄우기 위함 */
export type OpenAiFailKind =
  | 'no_key'
  | 'auth'
  | 'quota'
  | 'rate'
  | 'bad_request'
  | 'server'
  | 'timeout'
  | 'network'
  | 'empty'
  | 'parse';

export type OpenAiJsonResult = {
  json: Record<string, unknown> | null;
  usage: { promptTokens: number; completionTokens: number; model: string } | null;
  failed: boolean;
  failKind?: OpenAiFailKind;
};

function classifyOpenAiHttpFailure(status: number, detail: string): OpenAiFailKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return /insufficient_quota|billing|quota/i.test(detail) ? 'quota' : 'rate';
  if (status >= 500) return 'server';
  return 'bad_request';
}

function resolveApiKey(product: AiProductKey): string {
  if (product === 'quick_paste' || product === 'ai_dispatch') {
    return (process.env.QUICK_PASTE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  }
  return (process.env.TELECRM_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function resolveModel(product: AiProductKey): string {
  if (product === 'ai_dispatch') {
    return process.env.AI_DISPATCH_MODEL?.trim() || process.env.QUICK_PASTE_AI_MODEL?.trim() || 'gpt-4o-mini';
  }
  if (product === 'quick_paste') {
    return process.env.QUICK_PASTE_AI_MODEL?.trim() || 'gpt-4o-mini';
  }
  return process.env.TELECRM_AI_MODEL?.trim() || 'gpt-4o-mini';
}

export function isAiProductConfigured(product: AiProductKey): boolean {
  return resolveApiKey(product).length > 0;
}

export function openAiKeySource(product: AiProductKey): 'dedicated' | 'fallback' | 'missing' {
  const dedicated =
    product === 'telecrm_summary'
      ? (process.env.TELECRM_AI_OPENAI_API_KEY || '').trim()
      : (process.env.QUICK_PASTE_OPENAI_API_KEY || '').trim();
  if (dedicated) return 'dedicated';
  if ((process.env.OPENAI_API_KEY || '').trim()) return 'fallback';
  return 'missing';
}

export async function callOpenAiJson(params: {
  product: AiProductKey;
  system: string;
  user: string;
  temperature?: number;
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  timeoutMs?: number;
  maxCompletionTokens?: number;
  logContext?: AiUsageLogContext | null;
}): Promise<OpenAiJsonResult> {
  const apiKey = resolveApiKey(params.product);
  if (!apiKey) {
    return { json: null, usage: null, failed: true, failKind: 'no_key' };
  }
  const model = params.model?.trim() || resolveModel(params.product);
  const temperature = params.temperature ?? (params.product === 'quick_paste' ? 0.1 : 0.2);
  const logTag =
    params.product === 'quick_paste'
      ? '[quick-paste]'
      : params.product === 'ai_dispatch'
        ? '[ai-dispatch]'
        : '[telecrm-ai]';
  const body: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  };
  if (params.reasoningEffort) body.reasoning_effort = params.reasoningEffort;
  else body.temperature = temperature;
  if (params.maxCompletionTokens) body.max_completion_tokens = params.maxCompletionTokens;

  try {
    const post = (payload: Record<string, unknown>) =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(params.timeoutMs ?? 45_000),
      });
    let res = await post(body);
    if (!res.ok) {
      let detail = (await res.text()).slice(0, 400);
      // 새 모델(gpt-5·o 계열)은 temperature 를 받지 않음 → 빼고 한 번 더
      if (res.status === 400 && 'temperature' in body && /temperature/i.test(detail)) {
        console.warn(`${logTag} OpenAI temperature unsupported for ${model} — retry without it`);
        const { temperature: _omit, ...withoutTemp } = body;
        res = await post(withoutTemp);
        if (!res.ok) detail = (await res.text()).slice(0, 400);
      }
      if (!res.ok) {
        console.error(`${logTag} OpenAI HTTP`, res.status, model, detail);
        return { json: null, usage: null, failed: true, failKind: classifyOpenAiHttpFailure(res.status, detail) };
      }
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    const usage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      model,
    };
    if (!content) return { json: null, usage, failed: true, failKind: 'empty' };

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(content) as Record<string, unknown>;
    } catch {
      console.error(`${logTag} OpenAI JSON parse failed`, model, content.slice(0, 200));
      return { json: null, usage, failed: true, failKind: 'parse' };
    }

    if (params.logContext && usage.promptTokens + usage.completionTokens > 0) {
      const estimatedCostUsdMicros = estimateOpenAiCostUsdMicros(
        model,
        usage.promptTokens,
        usage.completionTokens,
      );
      try {
        await persistAiUsageLog({
          product: params.product,
          context: params.logContext,
          model,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          estimatedCostUsdMicros,
        });
      } catch (e) {
        console.error(
          `${logTag} usage log persist failed`,
          e instanceof Error ? e.message : 'unknown',
        );
      }
    }

    return { json, usage, failed: false };
  } catch (e) {
    const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    console.error(`${logTag} OpenAI request failed`, model, e instanceof Error ? `${e.name}: ${e.message}` : 'unknown');
    return { json: null, usage: null, failed: true, failKind: isTimeout ? 'timeout' : 'network' };
  }
}
