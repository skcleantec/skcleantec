/**
 * OpenAI 호출 추정 원가 (USD micros = USD × 1_000_000, 정수).
 * 단가는 env override 가능 — OpenAI 요금 변경 시 env만 갱신.
 */
const DEFAULT_INPUT_USD_PER_1M = 0.15;
const DEFAULT_OUTPUT_USD_PER_1M = 0.6;

/** 모델별 기본 단가 (USD / 1M 토큰) — env 가 있으면 env 우선 */
const KNOWN_MODEL_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-6.1-terra': { input: 1.0, output: 5.0 },
};

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
  const known = KNOWN_MODEL_USD_PER_1M[model.trim().toLowerCase()];
  const inputPer1M = parseUsdPer1M(
    `AI_COST_INPUT_USD_1M_${modelKey.toUpperCase()}`,
    known?.input ?? DEFAULT_INPUT_USD_PER_1M,
  );
  const outputPer1M = parseUsdPer1M(
    `AI_COST_OUTPUT_USD_1M_${modelKey.toUpperCase()}`,
    known?.output ?? DEFAULT_OUTPUT_USD_PER_1M,
  );
  const usd =
    (Math.max(0, promptTokens) * inputPer1M + Math.max(0, completionTokens) * outputPer1M) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
