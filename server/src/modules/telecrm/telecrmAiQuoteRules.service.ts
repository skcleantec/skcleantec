/**
 * AI 견적 규칙 — 사람이 말로 적은 가격 기준을 AI(GPT)가 조건·적용으로 바꾸고,
 * 넣기 전·후 금액을 계산해 「제대로 배웠는지」 보여 준다. (GPT는 바꿀 때 한 번만 — 견적 계산은 숫자 계산)
 */
import { prisma } from '../../lib/prisma.js';
import type {
  TelecrmAiQuoteModelStatus,
  TelecrmAiQuoteRuleActionKind,
  TelecrmAiQuoteRuleCondition,
  TelecrmAiQuoteRuleExample,
  TelecrmAiQuoteRuleParseResult,
  TelecrmAiQuoteRuleSpec,
} from '../../lib/telecrmQuoteCrewLearning.js';
import { callOpenAiJson } from '../ai/aiProvider.service.js';
import { getTelecrmAiQuoteModelStatus, predictTelecrmAiQuote } from './telecrmAiQuoteModel.service.js';
import { loadActiveTelecrmAiQuoteRuleSpecs } from './telecrmAiQuoteRules.store.js';
import { loadTelecrmPropertyChoiceResolver } from './telecrmPropertyChoices.service.js';

const KINDS: TelecrmAiQuoteRuleActionKind[] = ['min', 'max', 'add', 'set', 'perPyeong'];

function man(won: number): string {
  const abs = Math.abs(won);
  const text = abs % 10000 === 0 ? `${(abs / 10000).toLocaleString('ko-KR')}만원` : `${abs.toLocaleString('ko-KR')}원`;
  return won < 0 ? `−${text}` : text;
}

function intOrNull(raw: unknown, min: number, max: number): number | null {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function describeTelecrmAiQuoteCondition(c: TelecrmAiQuoteRuleCondition): string {
  const parts: string[] = [];
  if (c.pyeongMin != null && c.pyeongMax != null) parts.push(`${c.pyeongMin}~${c.pyeongMax}평`);
  else if (c.pyeongMin != null) parts.push(`${c.pyeongMin}평 이상`);
  else if (c.pyeongMax != null) parts.push(`${c.pyeongMax}평 이하`);
  if (c.isOneRoom === true) parts.push('원룸');
  if (c.isOneRoom === false) parts.push('원룸 아님');
  const rb = [c.roomCount != null ? `방${c.roomCount}` : null, c.bathroomCount != null ? `화${c.bathroomCount}` : null]
    .filter(Boolean)
    .join('·');
  if (rb) parts.push(rb);
  if (c.balconyCount != null) parts.push(`베란다 ${c.balconyCount}개`);
  if (c.propertyType) parts.push(c.propertyType);
  return parts.length ? parts.join(' · ') : '모든 집';
}

export function describeTelecrmAiQuoteAction(a: TelecrmAiQuoteRuleSpec['action']): string {
  switch (a.kind) {
    case 'min':
      return `AI 견적이 ${man(a.amountWon)}보다 낮으면 ${man(a.amountWon)}으로`;
    case 'max':
      return `AI 견적이 ${man(a.amountWon)}보다 높으면 ${man(a.amountWon)}으로`;
    case 'add':
      return a.amountWon >= 0 ? `${man(a.amountWon)} 더하기` : `${man(-a.amountWon)} 빼기`;
    case 'set':
      return `${man(a.amountWon)}으로 정하기`;
    case 'perPyeong':
      return `평수 × ${man(a.amountWon)}으로 계산`;
    default:
      return '';
  }
}

function summaryOf(spec: TelecrmAiQuoteRuleSpec): string {
  const cond = describeTelecrmAiQuoteCondition(spec.condition);
  const a = spec.action;
  const act =
    a.kind === 'min'
      ? `최소 ${man(a.amountWon)}`
      : a.kind === 'max'
        ? `최대 ${man(a.amountWon)}`
        : a.kind === 'add'
          ? a.amountWon >= 0
            ? `+${man(a.amountWon)}`
            : man(a.amountWon)
          : a.kind === 'set'
            ? `${man(a.amountWon)}`
            : `평당 ${man(a.amountWon)}`;
  return `${cond} ${act}`.slice(0, 200);
}

/** GPT 결과를 믿지 않고 범위·형식을 다시 확인 */
function normalizeSpec(raw: Record<string, unknown>, propertyLabels: string[]): TelecrmAiQuoteRuleSpec | string {
  const c = (raw.condition ?? {}) as Record<string, unknown>;
  const a = (raw.action ?? {}) as Record<string, unknown>;
  const kind = String(a.kind ?? '') as TelecrmAiQuoteRuleActionKind;
  if (!KINDS.includes(kind)) return '금액을 어떻게 바꿀지(최소·최대·더하기·빼기·정한 금액·평당)를 알아듣지 못했어요.';
  const amount = Math.round(Number(a.amountWon));
  if (!Number.isFinite(amount)) return '금액을 알아듣지 못했어요. 「25만원」처럼 적어 주세요.';
  if (kind === 'add' ? Math.abs(amount) > 2_000_000 : amount <= 0 || amount > 10_000_000) {
    return '금액이 너무 크거나 작아요. 다시 적어 주세요.';
  }
  let propertyType: string | null = null;
  if (typeof c.propertyType === 'string' && c.propertyType.trim()) {
    const want = c.propertyType.replace(/\s+/g, '');
    propertyType = propertyLabels.find((l) => l.replace(/\s+/g, '') === want) ?? propertyLabels.find((l) => l.replace(/\s+/g, '').includes(want)) ?? null;
    if (!propertyType) return `건물 유형 「${c.propertyType}」을(를) 찾지 못했어요. (${propertyLabels.join(', ')} 중에서)`;
  }
  const condition: TelecrmAiQuoteRuleCondition = {
    pyeongMin: intOrNull(c.pyeongMin, 1, 300),
    pyeongMax: intOrNull(c.pyeongMax, 1, 300),
    roomCount: intOrNull(c.roomCount, 0, 10),
    bathroomCount: intOrNull(c.bathroomCount, 0, 10),
    balconyCount: intOrNull(c.balconyCount, 0, 10),
    isOneRoom: typeof c.isOneRoom === 'boolean' ? c.isOneRoom : null,
    propertyType,
  };
  if (condition.pyeongMin != null && condition.pyeongMax != null && condition.pyeongMin > condition.pyeongMax) {
    return '평수 범위가 거꾸로예요. 다시 적어 주세요.';
  }
  const spec: TelecrmAiQuoteRuleSpec = { condition, action: { kind, amountWon: amount }, summary: '' };
  spec.summary = summaryOf(spec);
  return spec;
}

/** 넣기 전·후 비교에 쓸 예시 손님 (규칙 조건에 맞는 집 2~3개) */
function exampleInputs(c: TelecrmAiQuoteRuleCondition) {
  let pyeongs: number[];
  if (c.pyeongMin != null && c.pyeongMax != null) {
    pyeongs = [c.pyeongMin, Math.round((c.pyeongMin + c.pyeongMax) / 2), c.pyeongMax];
  } else if (c.pyeongMin != null) pyeongs = [c.pyeongMin, c.pyeongMin + 10];
  else if (c.pyeongMax != null) pyeongs = [Math.max(5, c.pyeongMax - 10), c.pyeongMax];
  else if (c.roomCount != null || c.bathroomCount != null || c.isOneRoom) pyeongs = [12, 18, 24];
  else pyeongs = [14, 24, 34];
  return [...new Set(pyeongs)].slice(0, 3).map((p) => ({
    areaPyeong: p,
    roomCount: c.roomCount ?? null,
    bathroomCount: c.bathroomCount ?? null,
    balconyCount: c.balconyCount ?? null,
    isOneRoom: c.isOneRoom === true,
    propertyType: c.propertyType ?? null,
  }));
}

function exampleLabel(x: ReturnType<typeof exampleInputs>[number]): string {
  return [
    `${x.areaPyeong}평`,
    x.isOneRoom ? '원룸' : null,
    [x.roomCount != null ? `방${x.roomCount}` : null, x.bathroomCount != null ? `화${x.bathroomCount}` : null].filter(Boolean).join('·') || null,
    x.balconyCount != null ? `베란다${x.balconyCount}` : null,
    x.propertyType,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function buildTelecrmAiQuoteRuleExamples(
  tenantId: string,
  spec: TelecrmAiQuoteRuleSpec,
  operatingCompanyId: string | null,
  mode: 'add' | 'remove' = 'add',
): Promise<TelecrmAiQuoteRuleExample[]> {
  const active = await loadActiveTelecrmAiQuoteRuleSpecs(tenantId);
  const without = active.filter((r) => r.summary !== spec.summary);
  const withRule = [...without, spec];
  const out: TelecrmAiQuoteRuleExample[] = [];
  for (const x of exampleInputs(spec.condition)) {
    const input = { ...x, operatingCompanyId };
    const [before, after] = await Promise.all([
      predictTelecrmAiQuote(tenantId, input, { rulesOverride: mode === 'add' ? without : withRule }),
      predictTelecrmAiQuote(tenantId, input, { rulesOverride: mode === 'add' ? withRule : without }),
    ]);
    out.push({ label: exampleLabel(x), beforeWon: before?.amountWon ?? null, afterWon: after?.amountWon ?? null });
  }
  return out;
}

export async function parseTelecrmAiQuoteRule(
  tenantId: string,
  userId: string,
  text: string,
  operatingCompanyId: string | null,
): Promise<TelecrmAiQuoteRuleParseResult> {
  const trimmed = text.trim();
  if (trimmed.length < 4) return { ok: false, reason: '조금 더 자세히 적어 주세요. 예) 방 3개 화장실 2개면 최소 25만원' };
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  const propertyLabels = resolver.options.propertyTypes.map((o) => o.label).filter(Boolean);

  const system = [
    'You convert a Korean cleaning company owner\'s pricing instruction into ONE structured rule for a quote calculator.',
    'Return JSON only: {"ok":true,"condition":{...},"action":{"kind":...,"amountWon":...}} or {"ok":false,"reason":"<Korean, short, friendly>"}.',
    'condition keys (omit or null = any): pyeongMin, pyeongMax (integers, 평), roomCount, bathroomCount, balconyCount (integers),',
    `isOneRoom (boolean), propertyType (one of: ${propertyLabels.join(', ') || '아파트, 오피스텔, 빌라(연립), 상가, 기타'}).`,
    'action.kind: "min" (at least this price), "max" (at most), "add" (add; negative for discounts like 빼줘/할인), "set" (exactly this price), "perPyeong" (평수 × amount).',
    'action.amountWon: integer KRW (25만원 → 250000, 1만원 → 10000, 2만5천원 → 25000).',
    'Examples: "방3 화2는 작아도 최소 25만원" → condition {roomCount:3,bathroomCount:2}, action {kind:"min",amountWon:250000}.',
    '"오피스텔은 1만원 빼줘" → condition {propertyType:"오피스텔"}, action {kind:"add",amountWon:-10000}.',
    '"40평 넘으면 평당 1만원" → condition {pyeongMin:41}, action {kind:"perPyeong",amountWon:10000}. "40평 이상" → pyeongMin 40.',
    'If the instruction uses conditions this calculator cannot see (request text words like 베란다 확장/곰팡이, region, date, season, customer type) or contains several different rules,',
    'return ok:false with a Korean reason: what is not supported yet, and suggest writing one rule using 평수·방·화장실·베란다·원룸·건물 유형.',
    'Never invent conditions that are not in the text.',
  ].join(' ');

  const { json, failed, failKind } = await callOpenAiJson({
    product: 'telecrm_summary',
    system,
    user: trimmed.slice(0, 1000),
    temperature: 0,
    timeoutMs: 30_000,
    logContext: { tenantId, userId, chatId: null, inquiryId: null, source: 'quote_rule' },
  });
  if (failed || !json) {
    return {
      ok: false,
      reason:
        failKind === 'auth' || failKind === 'no_key'
          ? 'AI 키 문제로 지금은 규칙을 알아들을 수 없어요. 관리자에게 알려 주세요.'
          : 'AI가 잠깐 응답하지 않았어요. 다시 눌러 주세요.',
    };
  }
  if (json.ok === false) {
    return { ok: false, reason: String(json.reason ?? '이 문장은 규칙으로 바꾸기 어려워요. 한 가지 규칙만 짧게 적어 주세요.') };
  }
  const spec = normalizeSpec(json as Record<string, unknown>, propertyLabels);
  if (typeof spec === 'string') return { ok: false, reason: spec };
  const examples = await buildTelecrmAiQuoteRuleExamples(tenantId, spec, operatingCompanyId, 'add');
  return {
    ok: true,
    spec,
    understood: [`조건: ${describeTelecrmAiQuoteCondition(spec.condition)}`, `적용: ${describeTelecrmAiQuoteAction(spec.action)}`],
    examples,
  };
}

export async function getTelecrmAiQuoteStatus(
  tenantId: string,
  operatingCompanyId: string | null,
): Promise<TelecrmAiQuoteModelStatus> {
  const [model, ruleCount, activeRuleCount] = await Promise.all([
    getTelecrmAiQuoteModelStatus(tenantId, operatingCompanyId),
    prisma.telecrmAiQuoteRule.count({ where: { tenantId } }).catch(() => 0),
    prisma.telecrmAiQuoteRule.count({ where: { tenantId, isActive: true } }).catch(() => 0),
  ]);
  return { ...model, ruleCount, activeRuleCount };
}

/** 저장 직전 다시 확인 — 화면에서 온 규칙도 같은 범위·형식으로 */
export async function validateTelecrmAiQuoteRuleSpec(
  tenantId: string,
  raw: unknown,
): Promise<TelecrmAiQuoteRuleSpec | string> {
  if (!raw || typeof raw !== 'object') return '규칙 내용이 비어 있어요.';
  const resolver = await loadTelecrmPropertyChoiceResolver(tenantId);
  const labels = resolver.options.propertyTypes.map((o) => o.label).filter(Boolean);
  return normalizeSpec(raw as Record<string, unknown>, labels);
}
