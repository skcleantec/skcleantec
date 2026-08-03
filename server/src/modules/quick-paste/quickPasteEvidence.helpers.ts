import type { QuickPasteOptionalFieldKey } from './quickPaste.constants.js';
import {
  QUICK_PASTE_OPTIONAL_FIELDS,
  QUICK_PASTE_REQUIRED_FIELDS,
  type QuickPasteFieldKey,
} from './quickPaste.constants.js';
import { findBalanceEvidenceSnippet } from './quickPasteAmount.helpers.js';
import { parsePreferredDateFromText } from './quickPasteDate.helpers.js';
import { dateLabelAlternation, nameLabelAlternation } from './quickPastePatterns.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';

export type QuickPasteEvidenceSource = 'rule' | 'tenant_rule' | 'ai' | 'user';

export type QuickPasteFieldEvidence = {
  snippet: string | null;
  source: QuickPasteEvidenceSource;
};

export type QuickPasteFieldEvidenceMap = Partial<
  Record<QuickPasteFieldKey | QuickPasteOptionalFieldKey | 'preferredTime', QuickPasteFieldEvidence>
>;

function lineAround(text: string, index: number, len = 80): string {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const lineEnd = text.indexOf('\n', index);
  return text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim().slice(0, len);
}

function findLineWith(text: string, needle: string | RegExp): string | null {
  if (!needle) return null;
  if (typeof needle === 'string') {
    const idx = text.indexOf(needle);
    if (idx < 0) return null;
    return lineAround(text, idx);
  }
  const m = text.match(needle);
  if (!m || m.index == null) return null;
  return lineAround(text, m.index);
}

/** 규칙 파서가 값을 찾은 위치의 원문 한 줄 */
export function buildRuleFieldEvidence(
  rawText: string,
  draft: QuickPasteDraft,
): QuickPasteFieldEvidenceMap {
  const text = rawText.trim();
  const out: QuickPasteFieldEvidenceMap = {};
  const nameAlt = nameLabelAlternation();
  const dateAlt = dateLabelAlternation();

  if (draft.customerName) {
    const sn =
      findLineWith(text, new RegExp(`(?:${nameAlt})\\s*[:：]?\\s*${escape(draft.customerName)}`, 'i')) ||
      findLineWith(text, draft.customerName);
    out.customerName = { snippet: sn, source: 'rule' };
  }
  if (draft.customerPhone) {
    const digits = draft.customerPhone.replace(/\D/g, '');
    const sn =
      findLineWith(text, /(?:연락처|전화|휴대폰|핸드폰)\s*[:：]?/i) ||
      findLineWith(text, new RegExp(digits.slice(0, 3) + '[\\s.-]*' + digits.slice(3, 7))) ||
      findLineWith(text, draft.customerPhone);
    out.customerPhone = { snippet: sn, source: 'rule' };
  }
  if (draft.address) {
    const sn =
      findLineWith(text, /(?:주소|청소\s*주소|현장)\s*[:：]?/i) ||
      findLineWith(text, draft.address.slice(0, 12));
    out.address = { snippet: sn, source: 'rule' };
  }
  if (draft.preferredDate) {
    const parsed = parsePreferredDateFromText(text, dateAlt);
    const sn =
      parsed.rawDateText ||
      parsed.snippet ||
      findLineWith(text, new RegExp(`(?:${dateAlt})\\s*[:：]?`, 'i')) ||
      findLineWith(text, /\d{4}[-./]\d{1,2}[-./]\d{1,2}/) ||
      findLineWith(text, /\d{6}/);
    out.preferredDate = { snippet: sn, source: 'rule' };
  }
  if (draft.preferredTime) {
    const sn =
      findLineWith(text, /사이\s*청소|사이청소|사이\s*일정/) ||
      findLineWith(text, /오전|오후/);
    out.preferredTime = { snippet: sn, source: 'rule' };
  }
  if (draft.serviceBalanceAmount != null) {
    const sn = findBalanceEvidenceSnippet(text, draft.serviceBalanceAmount);
    out.serviceBalanceAmount = { snippet: sn, source: 'rule' };
  }
  if (draft.areaPyeong != null) {
    const sn = findLineWith(text, /(?:평수|평)\s*[:：]?|\d+(?:\.\d+)?\s*평/);
    out.areaPyeong = { snippet: sn, source: 'rule' };
  }
  if (draft.roomCount != null || draft.bathroomCount != null || draft.balconyCount != null) {
    const sn = extractRhbRawSnippet(text);
    if (draft.roomCount != null) out.roomCount = { snippet: sn, source: 'rule' };
    if (draft.bathroomCount != null) out.bathroomCount = { snippet: sn, source: 'rule' };
    if (draft.balconyCount != null) out.balconyCount = { snippet: sn, source: 'rule' };
  }

  return out;
}

/**
 * 방·화·베를 뽑아 온 **실제 원문 표기**만 반환.
 * 원문에 없는 `방3화2베1` 같은 문자열을 새로 만들지 않는다.
 */
export function extractRhbRawSnippet(text: string): string | null {
  // 평수 옆 괄호: 25평(3/2/1) · 25평（3,2,1） — 가장 흔한 서식 우선
  const withPyeong = text.match(
    /\d+(?:\.\d+)?\s*평\s*[(\uFF08]\s*\d+\s*[,，·/\s]\s*\d+\s*[,，·/\s]\s*\d+\s*[)\uFF09]/,
  );
  if (withPyeong?.[0]) return withPyeong[0].replace(/\s+/g, ' ').trim().slice(0, 48);

  const patterns: RegExp[] = [
    // 원문에 실제로 있을 때만 (만들어 내지 않음)
    /방\s*\d+\s*화(?:장실|욕실)?\s*\d+\s*베(?:란다)?\s*\d+/i,
    /[(\uFF08]\s*\d+\s*[,，·/\s]\s*\d+\s*[,，·/\s]\s*\d+\s*[)\uFF09]/,
    /(?<![0-9])\d+\s*[,，·/]\s*\d+\s*[,，·/]\s*\d+(?![0-9])/,
    /방\s*\d+[^\n]{0,24}(?:화장실|욕실|화)\s*\d+[^\n]{0,24}베(?:란다)?\s*\d+/i,
    /방\s*\d+/i,
    /(?:화장실|욕실)\s*\d+/i,
    /베란다\s*\d+/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) return m[0].replace(/\s+/g, ' ').trim().slice(0, 48);
  }
  // 줄 단위 — 평·괄호 숫자가 있는 줄
  const line =
    findLineWith(text, /\d+\s*평\s*[(\uFF08]/) ||
    findLineWith(text, /[(\uFF08]\s*\d+\s*[,，·/]/) ||
    findLineWith(text, /방|화장실|욕실|베란다/);
  return line ? line.slice(0, 48) : null;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function mergeFieldEvidence(
  base: QuickPasteFieldEvidenceMap,
  draft: QuickPasteDraft,
  filledKeys: string[],
  source: QuickPasteEvidenceSource,
  rawText: string,
): QuickPasteFieldEvidenceMap {
  const next = { ...base };
  const text = rawText.trim();
  const rhbKeys = new Set(['roomCount', 'bathroomCount', 'balconyCount']);
  const rhbTouched = filledKeys.some((k) => rhbKeys.has(k));
  const rhbSnippet = rhbTouched ? extractRhbRawSnippet(text) : null;

  for (const key of filledKeys) {
    const k = key as keyof QuickPasteFieldEvidenceMap;
    if (rhbKeys.has(key)) {
      const sn = next[k]?.snippet || rhbSnippet;
      next[k] = { snippet: sn, source };
      continue;
    }
    // 잔금: 값이 바뀌면 원문 인용도 금액에 맞게 다시 잡음 (광고 15만 상당 잔존 방지)
    if (key === 'serviceBalanceAmount') {
      const sn = findBalanceEvidenceSnippet(text, draft.serviceBalanceAmount);
      next.serviceBalanceAmount = {
        snippet: sn || next.serviceBalanceAmount?.snippet || null,
        source,
      };
      continue;
    }
    if (next[k]?.snippet) {
      next[k] = { ...next[k]!, source };
      continue;
    }
    const val = draft[key as keyof QuickPasteDraft];
    let sn: string | null = null;
    if (typeof val === 'string' && val.trim()) sn = findLineWith(text, val.trim().slice(0, 16));
    if (!sn) sn = next[k]?.snippet ?? null;
    next[k] = { snippet: sn, source };
  }
  return next;
}

export function evidenceForFilledDraft(
  draft: QuickPasteDraft,
  map: QuickPasteFieldEvidenceMap,
  rawText?: string,
): QuickPasteFieldEvidenceMap {
  const out: QuickPasteFieldEvidenceMap = {};
  const keys = [
    ...QUICK_PASTE_REQUIRED_FIELDS,
    ...QUICK_PASTE_OPTIONAL_FIELDS,
    'preferredTime' as const,
  ];
  const text = rawText?.trim() ?? '';
  const rhbSnippet =
    draft.roomCount != null || draft.bathroomCount != null || draft.balconyCount != null
      ? extractRhbRawSnippet(text) ||
        map.roomCount?.snippet ||
        map.bathroomCount?.snippet ||
        map.balconyCount?.snippet ||
        null
      : null;

  for (const key of keys) {
    const v = draft[key as keyof QuickPasteDraft];
    const empty = v == null || (typeof v === 'string' && !String(v).trim());
    if (empty) continue;
    if (key === 'roomCount' || key === 'bathroomCount' || key === 'balconyCount') {
      out[key] = {
        snippet: map[key]?.snippet || rhbSnippet,
        source: map[key]?.source ?? 'rule',
      };
      continue;
    }
    if (key === 'serviceBalanceAmount' && text) {
      const sn =
        findBalanceEvidenceSnippet(text, draft.serviceBalanceAmount) ||
        map.serviceBalanceAmount?.snippet ||
        null;
      out.serviceBalanceAmount = {
        snippet: sn,
        source: map.serviceBalanceAmount?.source ?? 'rule',
      };
      continue;
    }
    out[key] = map[key] ?? { snippet: null, source: 'rule' };
  }
  return out;
}
