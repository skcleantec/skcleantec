import type { MisoExtractPayload } from '@shared/misoBridge';
import type { CrmIntakeKind } from '../components/crm/intake/crmIntakeSubmit';
import { normalizeSoomgoPreferredDate } from './crmSoomgoImport';

export type MisoImportSummary = {
  filled: string[];
  lines: string[];
  empty: string[];
};

export function deriveMisoIntakeDefaults(data: MisoExtractPayload): {
  kind: CrmIntakeKind;
  contactUnknown: boolean;
} {
  const phone = data.phone?.trim();
  if (!phone || !data.phoneAvailable) {
    return { kind: 'requested', contactUnknown: true };
  }
  return { kind: 'absent', contactUnknown: false };
}

export function resolveMisoAddress(data: MisoExtractPayload): string {
  return (
    data.serviceAddress?.trim() ||
    data.address?.trim() ||
    data.orderDetail?.serviceAddress?.trim() ||
    ''
  );
}

export function summarizeMisoImport(data: MisoExtractPayload): MisoImportSummary {
  const filled: string[] = [];
  const lines: string[] = [];
  const empty: string[] = [];

  const name = data.customerName?.trim() || '';
  if (name) {
    filled.push('customerName');
    lines.push(`고객명: ${name}`);
  } else {
    empty.push('고객명');
  }

  const phone = data.phone?.trim();
  if (phone) {
    filled.push('contactPhone');
    lines.push(`연락처: ${phone}`);
  } else {
    empty.push('연락처');
    lines.push('연락처: 고용 후 표시 (현재 없음)');
  }

  const address = resolveMisoAddress(data);
  if (address) {
    filled.push('address');
    lines.push(`주소: ${address}`);
  } else {
    empty.push('주소');
  }

  if (data.requestSummary?.trim()) {
    filled.push('requestSummary');
    lines.push(`요약: ${data.requestSummary.trim()}`);
  }

  if (data.messagesPreview?.trim()) {
    filled.push('requestMemo');
    lines.push('최근 채팅 1건 → 메모');
  }

  if (data.statusLabel) {
    lines.push(`상태: ${data.statusLabel}`);
  }

  const pyeong = data.orderDetail?.areaPyung?.replace(/\s*\(.*\)\s*$/, '').trim();
  if (pyeong) {
    filled.push('pyeong');
    lines.push(`평수: ${pyeong}`);
  }

  return { filled, lines, empty };
}

export function misoImportNoticeText(summary: MisoImportSummary): string {
  const head = summary.lines.length ? summary.lines.join(' · ') : '미소에서 정보를 가져왔습니다.';
  if (summary.empty.includes('연락처')) {
    return `${head} (고용 후 연락처가 표시됩니다)`;
  }
  return head;
}

export function resolveMisoPreferredDate(data: MisoExtractPayload): string {
  const raw = data.scheduledAt || data.orderDetail?.serviceDate;
  return normalizeSoomgoPreferredDate(raw ?? '');
}

export function parseMisoPyeong(raw: string | null | undefined): string {
  const t = raw?.trim() ?? '';
  if (!t) return '';
  const m = t.match(/([\d.]+)/);
  return m ? m[1] : t;
}

/** 접수란 메모 — 고객 최근 채팅 1건만 (서비스 요약은 별도 필드·배너). */
export function buildMisoRequestMemo(data: MisoExtractPayload): string {
  return data.messagesPreview?.trim() || '';
}
