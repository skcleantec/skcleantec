/**
 * 고정 입금처 — 순수 로직 (DB 없음)
 * PG사·협력업체처럼 늘 들어오는 입금자를 알림 없이 IGNORED 로 쌓기 위한 매칭·검증.
 */
export const MUTED_KINDS = ['PG', 'PARTNER', 'OTHER'] as const;
export type MutedKind = (typeof MUTED_KINDS)[number];
export const MUTED_MATCH_MODES = ['exact', 'prefix'] as const;
export type MutedMatchMode = (typeof MUTED_MATCH_MODES)[number];

export const MUTED_KIND_LABEL: Record<MutedKind, string> = { PG: 'PG사', PARTNER: '협력업체', OTHER: '기타' };

export type MutedRule = {
  id: string;
  operatingCompanyId: string | null;
  nameNorm: string;
  displayName: string;
  matchMode: string;
  enabled: boolean;
};

/** 입금자명 매칭 키: 공백 제거 + 소문자 */
export function mutedNameNorm(name: string): string {
  return name.replace(/\s/g, '').toLowerCase();
}

/** prefix 모드: 뒤에 붙은 숫자·기호(_-.)·공백을 뗀 앞부분이 같으면 매칭 */
function prefixKey(norm: string): string {
  return norm.replace(/[\d_\-.·()]+$/u, '');
}

export function mutedRuleMatches(rule: MutedRule, depositorName: string, operatingCompanyId: string | null): boolean {
  if (!rule.enabled) return false;
  if (rule.operatingCompanyId && rule.operatingCompanyId !== operatingCompanyId) return false;
  const norm = mutedNameNorm(depositorName);
  if (!norm || !rule.nameNorm) return false;
  if (rule.matchMode === 'prefix') {
    const key = prefixKey(rule.nameNorm);
    return key.length >= 2 && (norm === rule.nameNorm || norm.startsWith(key));
  }
  return norm === rule.nameNorm;
}

/** 브랜드 지정 규칙을 공통 규칙보다 먼저 본다. */
export function pickMutedRule<T extends MutedRule>(
  rules: T[],
  depositorName: string,
  operatingCompanyId: string | null,
): T | null {
  const sorted = [...rules].sort((a, b) => Number(Boolean(b.operatingCompanyId)) - Number(Boolean(a.operatingCompanyId)));
  return sorted.find((rule) => mutedRuleMatches(rule, depositorName, operatingCompanyId)) ?? null;
}

export function mutedNote(displayName: string): string {
  return `고정 입금처 · ${displayName}`.slice(0, 200);
}

export type MutedInput = {
  depositorName: string;
  displayName?: string;
  kind?: string;
  matchMode?: string;
  operatingCompanyId?: string | null;
  memo?: string | null;
  enabled?: boolean;
};

export type MutedValidated = {
  nameNorm: string;
  displayName: string;
  kind: MutedKind;
  matchMode: MutedMatchMode;
  operatingCompanyId: string | null;
  memo: string | null;
  enabled: boolean;
};

export function validateMutedInput(input: MutedInput): { ok: true; value: MutedValidated } | { ok: false; error: string } {
  const depositorName = (input.depositorName ?? '').trim();
  const nameNorm = mutedNameNorm(depositorName);
  if (nameNorm.length < 2) return { ok: false, error: '입금자명을 2자 이상 적어 주세요.' };
  if (nameNorm.length > 80) return { ok: false, error: '입금자명이 너무 길어요.' };
  const displayName = (input.displayName ?? '').trim().slice(0, 80) || depositorName.slice(0, 80);
  const kind = (MUTED_KINDS as readonly string[]).includes(input.kind ?? '') ? (input.kind as MutedKind) : 'OTHER';
  const matchMode = (MUTED_MATCH_MODES as readonly string[]).includes(input.matchMode ?? '')
    ? (input.matchMode as MutedMatchMode)
    : 'exact';
  const operatingCompanyId = typeof input.operatingCompanyId === 'string' && input.operatingCompanyId.trim() ? input.operatingCompanyId.trim() : null;
  const memo = typeof input.memo === 'string' && input.memo.trim() ? input.memo.trim().slice(0, 200) : null;
  const enabled = input.enabled !== false;
  return { ok: true, value: { nameNorm, displayName, kind, matchMode, operatingCompanyId, memo, enabled } };
}
