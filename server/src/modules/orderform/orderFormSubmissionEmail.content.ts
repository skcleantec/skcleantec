export type OrderFormSubmissionEmailContentInput = {
  brandDisplayName: string;
  customerName: string;
  inquiryNumber: string | null;
  preferredDateYmd: string;
  preferredTime: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
};

function formatWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function buildOrderFormSubmissionEmailSubject(input: OrderFormSubmissionEmailContentInput): string {
  const brand = input.brandDisplayName.trim() || '청소 예약';
  const name = input.customerName.trim() || '고객';
  return `[${brand}] ${name}님 발주서 접수가 완료되었습니다`;
}

export function buildOrderFormSubmissionEmailPlainText(
  input: OrderFormSubmissionEmailContentInput,
): string {
  const brand = input.brandDisplayName.trim() || '청소 업체';
  const lines = [
    `${input.customerName.trim() || '고객'}님, 안녕하세요.`,
    '',
    `${brand}에 청소 예약(발주서) 접수가 정상적으로 완료되었습니다.`,
    '',
    '— 접수 요약 —',
    input.inquiryNumber ? `접수번호: ${input.inquiryNumber}` : null,
    `청소 희망일: ${input.preferredDateYmd}`,
    `시간대: ${input.preferredTime}`,
    `총액: ${formatWon(input.totalAmount)} (예약금 ${formatWon(input.depositAmount)} / 잔금 ${formatWon(input.balanceAmount)})`,
    '',
    '담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.',
    '본 메일은 발송 전용입니다. 문의는 업체 대표 연락처로 부탁드립니다.',
  ].filter((line): line is string => line != null);
  return lines.join('\n');
}

export function buildOrderFormSubmissionEmailHtml(input: OrderFormSubmissionEmailContentInput): string {
  const plain = buildOrderFormSubmissionEmailPlainText(input);
  const body = plain
    .split('\n')
    .map((line) => (line.trim() === '' ? '<br>' : `<p style="margin:0 0 8px;line-height:1.5">${escapeHtml(line)}</p>`))
    .join('');
  return `<div style="font-family:'Noto Sans KR',sans-serif;color:#0f172a;font-size:14px">${body}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
