import type { AiProductKey } from './aiProduct.constants.js';
import { estimateOpenAiCostUsdMicros } from './aiCost.service.js';
import { persistAiUsageLog, type AiUsageLogContext } from './aiUsageLog.service.js';

export type OpenAiJsonResult = {
  json: Record<string, unknown> | null;
  usage: { promptTokens: number; completionTokens: number; model: string } | null;
  failed: boolean;
};

function resolveApiKey(product: AiProductKey): string {
  if (product === 'quick_paste') {
    return (process.env.QUICK_PASTE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  }
  return (process.env.TELECRM_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function resolveModel(product: AiProductKey): string {
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
    product === 'quick_paste'
      ? (process.env.QUICK_PASTE_OPENAI_API_KEY || '').trim()
      : (process.env.TELECRM_AI_OPENAI_API_KEY || '').trim();
  if (dedicated) return 'dedicated';
  if ((process.env.OPENAI_API_KEY || '').trim()) return 'fallback';
  return 'missing';
}

export async function callOpenAiJson(params: {
  product: AiProductKey;
  system: string;
  user: string;
  temperature?: number;
  logContext?: AiUsageLogContext | null;
}): Promise<OpenAiJsonResult> {
  const apiKey = resolveApiKey(params.product);
  if (!apiKey) {
    return { json: null, usage: null, failed: true };
  }
  const model = resolveModel(params.product);
  const temperature = params.temperature ?? (params.product === 'quick_paste' ? 0.1 : 0.2);
  const logTag = params.product === 'quick_paste' ? '[quick-paste]' : '[telecrm-ai]';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`${logTag} OpenAI HTTP`, res.status);
      return { json: null, usage: null, failed: true };
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
    if (!content) return { json: null, usage, failed: true };

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return { json: null, usage, failed: true };
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
    console.error(`${logTag} OpenAI request failed`, e instanceof Error ? e.message : 'unknown');
    return { json: null, usage: null, failed: true };
  }
}
