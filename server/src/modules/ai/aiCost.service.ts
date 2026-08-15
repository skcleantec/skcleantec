/**
 * OpenAI 호출 추정 원가 (USD micros = USD × 1_000_000, 정수).
 * 단가는 env override 가능 — OpenAI 요금 변경 시 env만 갱신.
 */
const DEFAULT_INPUT_USD_PER_1M = 0.15;
const DEFAULT_OUTPUT_USD_PER_1M = 0.6;

function parseUsdPer1M(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function estimateOpenAiCostUsdMicros(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const modelKey = model.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '_');
  const inputPer1M = parseUsdPer1M(`AI_COST_INPUT_USD_1M_${modelKey.toUpperCase()}`, DEFAULT_INPUT_USD_PER_1M);
  const outputPer1M = parseUsdPer1M(`AI_COST_OUTPUT_USD_1M_${modelKey.toUpperCase()}`, DEFAULT_OUTPUT_USD_PER_1M);
  const usd =
    (Math.max(0, promptTokens) * inputPer1M + Math.max(0, completionTokens) * outputPer1M) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
