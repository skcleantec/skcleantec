import { isManualIntakeInquiry } from './manualIntakeInquiry';
import {
  isOrderFormPendingPlaceholderAddress,
  customerFormAddressFromInquiry,
} from '@shared/orderFormPendingAddress';

/** 출처 한 줄 UI를 아예 숨길 값(예: 예전 테스트 시드 문자열) */
export function isInquirySourceHiddenFromUi(source: string | null | undefined): boolean {
  return (source ?? '').trim() === '시드';
}

/** 접수 출처 표시 — 빈 값은 대시, 수기(간편) 등록은 통일 문구 */
export function formatInquirySourceLabel(source: string | null | undefined): string {
  const s = (source ?? '').trim();
  if (!s) return '-';
  if (isManualIntakeInquiry(source)) return '수기등록';
  return s;
}

/** 목록용: 시·구(또는 도·시·구)까지만 — 열 폭 절약, 전체는 title로 */
export function addressListShortSiGu(address: string): string {
  if (isOrderFormPendingPlaceholderAddress(address)) return '—';
  const parts = address.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts[0].endsWith('도')) {
    return parts.slice(0, Math.min(3, parts.length)).join(' ');
  }
  return `${parts[0]} ${parts[1]}`;
}

/** 목록 title·풀 주소 — 발주서 미제출 플레이스홀더는 안내 문구 */
export function inquiryListAddressFull(
  address: string,
  addressDetail?: string | null,
): string {
  if (isOrderFormPendingPlaceholderAddress(address)) {
    return '발주서 미제출 · 주소 대기';
  }
  return `${address}${addressDetail ? ` ${addressDetail}` : ''}`.trim();
}

/** 접수 편집 폼 초기 주소 */
export function inquiryEditFormAddress(address: string | null | undefined): string {
  return customerFormAddressFromInquiry(address);
}

/** 목록용: 11자리 휴대폰이면 첫 줄 앞 3자리(010), 둘째 줄 나머지 8자리(1234-5678) */
export function phoneListTwoLines(phone: string): { head: string; tail: string } | null {
  const d = phone.replace(/\D/g, '');
  if (d.length !== 11) return null;
  return { head: d.slice(0, 3), tail: `${d.slice(3, 7)}-${d.slice(7, 11)}` };
}

/**
 * 목록·스케줄 카드용 고객 식별 한 줄.
 * 이름·닉·전화가 없을 때 수기(간편) 등록 제목(`scheduleMemo`)을 표시 — 관리자 스케줄과 동일 규칙.
 */
export function inquiryPrimaryCustomerLabel(item: {
  customerName?: string | null;
  nickname?: string | null;
  customerPhone?: string | null;
  scheduleMemo?: string | null;
}): string {
  const name = item.customerName?.trim() ?? '';
  const nick = item.nickname?.trim() ?? '';
  const phone = item.customerPhone?.trim() ?? '';
  if (name && nick && name !== nick) return `${name} (${nick})`;
  if (name) return name;
  if (nick) return nick;
  if (phone) return phone;
  const memo = item.scheduleMemo?.trim() ?? '';
  if (memo) return memo;
  return '이름·연락처 미입력';
}
