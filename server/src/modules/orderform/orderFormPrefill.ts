/**
 * 발주서 "마케터 선입력 + 고객 잠금" 공용 헬퍼.
 *
 * - 면적(areaPyeong/areaBasis)·날짜(preferredDate)·시간(preferredTime/preferredTimeDetail)은
 *   기존 OrderForm typed 컬럼 잠금을 그대로 사용한다(스케줄·접수 생성과 연동되어 있음).
 * - 그 밖의 표준 항목과 커스텀 항목은 `OrderForm.prefillAnswers`(JSON)로 통합 저장한다.
 *   값이 들어간 키 = 고객 화면 잠금(확인 전용), 제출 시 그 값이 우선.
 */

import type { Prisma } from '@prisma/client';
import {
  normalizeAcUnitsAnswer,
  ORDER_FORM_AC_UNITS_FIELD_KEY,
} from '../../lib/orderFormAcUnits.js';
import {
  parseProfessionalOptionSelectionsRaw,
  serializeProfessionalOptionSelectionsJson,
} from './specialtyOptions.js';
import { isRealCustomerAddress } from '../../lib/orderFormPendingAddress.js';
import { parseIsOneRoomFlag } from './orderFormOneRoom.js';

/** prefillAnswers 로 다루는 표준(시스템) 항목 키 — 제출 body 필드명과 동일하게 맞춘다 */
export const PREFILL_STANDARD_KEYS = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'customerPhone2',
  'address',
  'addressDetail',
  'propertyType',
  'buildingType',
  'moveInDate',
  'moveInDateUndecided',
  'roomCount',
  'balconyCount',
  'bathroomCount',
  'kitchenCount',
  'specialNotes',
  'isOneRoom',
  'professionalOptionIds',
] as const;

export type PrefillStandardKey = (typeof PREFILL_STANDARD_KEYS)[number];

const PREFILL_STANDARD_KEY_SET = new Set<string>(PREFILL_STANDARD_KEYS);

export type PrefillMap = Record<string, unknown>;

function isNonEmptyValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'boolean') return v === true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

/** prefill 맵에서 "값이 있어 잠긴" 키 집합 */
export function lockedKeysFromPrefill(prefill: unknown): Set<string> {
  const out = new Set<string>();
  if (!prefill || typeof prefill !== 'object') return out;
  for (const [k, v] of Object.entries(prefill as PrefillMap)) {
    if (k === 'address') {
      if (typeof v === 'string' && isRealCustomerAddress(v)) out.add(k);
      continue;
    }
    if (k === 'addressDetail') {
      const addr = (prefill as PrefillMap).address;
      if (
        typeof v === 'string' &&
        v.trim().length > 0 &&
        typeof addr === 'string' &&
        isRealCustomerAddress(addr)
      ) {
        out.add(k);
      }
      continue;
    }
    if (isNonEmptyValue(v)) out.add(k);
  }
  return out;
}

/**
 * 편집기(마케터) 저장 payload(제출과 동일 형태 + answers)에서 prefillAnswers 를 만든다.
 * - 표준 키: 비어있지 않은 값만 보존(잠금 대상)
 * - 커스텀 키: 템플릿 customFields 키만 허용
 */
export function buildPrefillFromPayload(
  body: Record<string, unknown>,
  customFieldKeys: string[],
): PrefillMap {
  const out: PrefillMap = {};

  for (const key of PREFILL_STANDARD_KEYS) {
    if (key === 'addressDetail') continue;
    const raw = body[key];
    if (key === 'moveInDateUndecided') {
      const truthy = raw === true || raw === 'true' || String(raw ?? '') === '1';
      if (truthy) out[key] = true;
      continue;
    }
    if (key === 'isOneRoom') {
      const truthy = raw === true || raw === 'true' || String(raw ?? '') === '1';
      if (truthy) out[key] = true;
      continue;
    }
    if (key === 'professionalOptionIds') {
      if (Array.isArray(raw)) {
        const sel = parseProfessionalOptionSelectionsRaw(raw);
        if (sel.length > 0) {
          out[key] = serializeProfessionalOptionSelectionsJson(sel);
        }
      }
      continue;
    }
    if (
      key === 'roomCount' ||
      key === 'balconyCount' ||
      key === 'bathroomCount' ||
      key === 'kitchenCount'
    ) {
      if (raw != null && String(raw).trim() !== '') {
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
        if (Number.isFinite(n)) out[key] = n;
      }
      continue;
    }
    // 문자열 표준 키
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) continue;
      if (key === 'address') {
        if (isRealCustomerAddress(t)) out[key] = t;
        continue;
      }
      out[key] = t;
    } else if (typeof raw === 'number') out[key] = raw;
  }

  const detailRaw = body.addressDetail;
  if (typeof out.address === 'string' && typeof detailRaw === 'string') {
    const detail = detailRaw.trim();
    if (detail) out.addressDetail = detail;
  }

  // 커스텀 답변
  const answers = body.answers;
  if (answers && typeof answers === 'object' && customFieldKeys.length > 0) {
    const allowed = new Set(customFieldKeys);
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (!allowed.has(k)) continue;
      if (k === ORDER_FORM_AC_UNITS_FIELD_KEY) {
        const rows = normalizeAcUnitsAnswer(v);
        if (rows.length > 0) out[k] = rows;
        continue;
      }
      if (Array.isArray(v)) {
        const arr = v.map((x) => String(x)).filter(Boolean);
        if (arr.length > 0) out[k] = arr.slice(0, 50);
      } else if (typeof v === 'boolean') {
        if (v) out[k] = true;
      } else if (v != null && String(v).trim()) {
        out[k] = String(v).trim().slice(0, 2000);
      }
    }
  }

  return out;
}

/**
 * 제출 body 에 마케터 잠금값을 강제 덮어쓴다(고객 변조 방지).
 * 표준 키는 body 동일 필드명에, 커스텀 키는 body.answers 에 적용.
 */
export function overlayPrefillOntoSubmitBody(
  body: Record<string, unknown>,
  prefill: unknown,
): void {
  if (!prefill || typeof prefill !== 'object') return;
  const map = prefill as PrefillMap;
  const answers: Record<string, unknown> =
    body.answers && typeof body.answers === 'object'
      ? { ...(body.answers as Record<string, unknown>) }
      : {};
  let answersTouched = false;

  for (const [key, value] of Object.entries(map)) {
    if (!isNonEmptyValue(value)) continue;
    if (PREFILL_STANDARD_KEY_SET.has(key)) {
      body[key] = value;
    } else {
      answers[key] = value;
      answersTouched = true;
    }
  }
  if (answersTouched) body.answers = answers;
}

function parsePrefillCount(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

function parsePrefillMoveInDate(raw: unknown): Date | null {
  const ymd = typeof raw === 'string' ? raw.trim() : '';
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 마케터 선입력(prefillAnswers) → 연결 pending Inquiry 동기화 필드.
 * 면적·날짜·시간은 POST /prefill 라우트에서 typed 컬럼으로 별도 반영한다.
 */
export function inquiryUpdateDataFromPrefillMap(prefill: PrefillMap): Prisma.InquiryUpdateInput {
  const data: Prisma.InquiryUpdateInput = {};

  const isOneRoom = parseIsOneRoomFlag(prefill.isOneRoom);
  const propertyType =
    typeof prefill.propertyType === 'string' && prefill.propertyType.trim()
      ? prefill.propertyType.trim()
      : null;

  if (isOneRoom) {
    data.isOneRoom = true;
    if (!propertyType) data.propertyType = null;
  } else if (propertyType) {
    data.isOneRoom = false;
    data.propertyType = propertyType;
  }

  if (typeof prefill.buildingType === 'string' && prefill.buildingType.trim()) {
    data.buildingType = prefill.buildingType.trim();
  }

  const roomCount = parsePrefillCount(prefill.roomCount);
  if (roomCount != null) data.roomCount = roomCount;
  const bathroomCount = parsePrefillCount(prefill.bathroomCount);
  if (bathroomCount != null) data.bathroomCount = bathroomCount;
  const balconyCount = parsePrefillCount(prefill.balconyCount);
  if (balconyCount != null) data.balconyCount = balconyCount;
  const kitchenCount = parsePrefillCount(prefill.kitchenCount);
  if (kitchenCount != null) data.kitchenCount = kitchenCount;

  if (typeof prefill.specialNotes === 'string') {
    data.specialNotes = prefill.specialNotes.trim() || null;
  }

  if (prefill.moveInDateUndecided === true) {
    data.moveInDateUndecided = true;
    data.moveInDate = null;
  } else if (prefill.moveInDate != null) {
    const moveInDate = parsePrefillMoveInDate(prefill.moveInDate);
    if (moveInDate) {
      data.moveInDate = moveInDate;
      data.moveInDateUndecided = false;
    }
  }

  if (typeof prefill.address === 'string') {
    const addr = prefill.address.trim();
    if (isRealCustomerAddress(addr)) {
      data.address = addr;
    }
  }
  if (typeof prefill.addressDetail === 'string') {
    data.addressDetail = prefill.addressDetail.trim() || null;
  }

  return data;
}
