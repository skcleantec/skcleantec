import { buildEmailDetailSections, type EmailDetailRow } from './orderFormSubmissionEmail.snapshot.js';

export type OrderFormSubmissionEmailContentInput = {
  brandDisplayName: string;
  customerName: string;
  inquiryNumber: string | null;
  customerSubmissionSnapshot: unknown;
  /** 스냅샷 없을 때 최소 요약(레거시) */
  fallback?: {
    preferredDateYmd: string;
    preferredTime: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
  };
};

function formatWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function buildOrderFormSubmissionEmailSubject(input: OrderFormSubmissionEmailContentInput): string {
  const brand = input.brandDisplayName.trim() || '청소 예약';
  const name = input.customerName.trim() || '고객';
  return `[${brand}] ${name}님 발주서 접수가 완료되었습니다`;
}

function buildFallbackRows(input: OrderFormSubmissionEmailContentInput): EmailDetailRow[] {
  const fb = input.fallback;
  if (!fb) return [];
  return [
    ...(input.inquiryNumber ? [{ label: '접수번호', value: input.inquiryNumber }] : []),
    { label: '청소 희망일', value: fb.preferredDateYmd },
    { label: '시간대', value: fb.preferredTime },
    {
      label: '총액',
      value: `${formatWon(fb.totalAmount)} (예약금 ${formatWon(fb.depositAmount)} / 잔금 ${formatWon(fb.balanceAmount)})`,
    },
  ];
}

function sectionsForEmail(input: OrderFormSubmissionEmailContentInput) {
  const fromSnapshot = buildEmailDetailSections(input.customerSubmissionSnapshot, input.inquiryNumber);
  if (fromSnapshot.length > 0) return fromSnapshot;
  const rows = buildFallbackRows(input);
  if (rows.length === 0) return [];
  return [{ title: '접수 요약', rows }];
}

export function buildOrderFormSubmissionEmailPlainText(
  input: OrderFormSubmissionEmailContentInput,
): string {
  const brand = input.brandDisplayName.trim() || '청소 업체';
  const lines: string[] = [
    `${input.customerName.trim() || '고객'}님, 안녕하세요.`,
    '',
    `${brand}에 청소 예약(발주서) 접수가 정상적으로 완료되었습니다.`,
    '',
  ];

  for (const section of sectionsForEmail(input)) {
    lines.push(`— ${section.title} —`);
    for (const row of section.rows) {
      const valueLines = row.value.split('\n');
      if (valueLines.length === 1) {
        lines.push(`${row.label}: ${row.value}`);
      } else {
        lines.push(`${row.label}:`);
        for (const vl of valueLines) lines.push(`  ${vl}`);
      }
    }
    lines.push('');
  }

  lines.push(
    '담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.',
    '본 메일은 발송 전용입니다. 문의는 업체 대표 연락처로 부탁드립니다.',
  );
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function renderSectionHtml(section: { title: string; rows: EmailDetailRow[] }): string {
  const rows = section.rows
    .map(
      (row) =>
        `<tr><th style="padding:8px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;text-align:left;font-weight:600;color:#475569;white-space:nowrap;vertical-align:top;width:38%">${escapeHtml(row.label)}</th><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<h3 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#0f172a">${escapeHtml(section.title)}</h3><table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px">${rows}</table>`;
}

export function buildOrderFormSubmissionEmailHtml(input: OrderFormSubmissionEmailContentInput): string {
  const brand = input.brandDisplayName.trim() || '청소 업체';
  const intro = `<p style="margin:0 0 12px;line-height:1.6">${escapeHtml(input.customerName.trim() || '고객')}님, 안녕하세요.</p><p style="margin:0 0 16px;line-height:1.6">${escapeHtml(brand)}에 청소 예약(발주서) 접수가 정상적으로 완료되었습니다.</p>`;
  const sections = sectionsForEmail(input).map(renderSectionHtml).join('');
  const footer =
    '<p style="margin:20px 0 0;line-height:1.6;color:#475569;font-size:13px">담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.<br>본 메일은 발송 전용입니다. 문의는 업체 대표 연락처로 부탁드립니다.</p>';
  return `<div style="font-family:'Noto Sans KR',Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:#0f172a;font-size:14px;max-width:640px">${intro}${sections}${footer}</div>`;
}
