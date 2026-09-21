import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { formatTenantPaymentConfirmationRequestSubject } from '../../lib/platformWorkspace.constants.js';
import {
  buildDepositConfirmPageUrl,
  signDepositConfirmToken,
} from './tenantBilling.depositConfirmToken.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKoDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export type PaymentConfirmationEmailInput = {
  notifyEmail: string;
  tenantName: string;
  tenantSlug: string;
  tenantId: string;
  invoiceId: string;
  amountKrw: number;
  dueDate: string;
  invoiceStatus: string;
  requesterName: string;
  requesterEmail: string;
  /** 연습 메일 — 결재확인 페이지는 열리지만 업체는 활성화되지 않음 */
  isTest?: boolean;
};

export async function notifyPaymentConfirmationRequestByEmail(
  input: PaymentConfirmationEmailInput,
): Promise<{ sent: boolean; reason?: string; detail?: string; deliveryNote?: string; messageId?: string }> {
  const to = input.notifyEmail.trim();
  if (!to) return { sent: false, reason: 'NO_NOTIFY_EMAIL' };

  const platformUrl = `${getPublicAppBaseUrl()}/platform/billing`;
  const confirmToken = signDepositConfirmToken({
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    test: input.isTest === true,
  });
  const confirmUrl = buildDepositConfirmPageUrl(confirmToken);
  const confirmHint = input.isTest
    ? '연습 메일입니다. 버튼을 눌러도 실제 업체는 활성화되지 않습니다.'
    : '버튼을 누르면 미리보기 화면이 열립니다. 그다음 「결재확인」을 한 번 더 눌러야 업체가 활성화됩니다.';
  const html = `
    <h2>청소비서 — 이용료 입금 확인 요청</h2>
    <p>업체 관리자가 입금 확인을 요청했습니다.</p>
    <table style="border-collapse:collapse;font-size:14px;line-height:1.5;">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">업체</td><td><strong>${escapeHtml(input.tenantName)}</strong> (${escapeHtml(input.tenantSlug)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">청구 금액</td><td>${input.amountKrw.toLocaleString('ko-KR')}원 (VAT 별도)</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">납부기한</td><td>${escapeHtml(formatKoDate(input.dueDate))}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">청구 상태</td><td>${escapeHtml(input.invoiceStatus)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">요청자</td><td>${escapeHtml(input.requesterName)} &lt;${escapeHtml(input.requesterEmail)}&gt;</td></tr>
    </table>
    <p style="margin:20px 0 8px;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">결재확인</a>
    </p>
    <p style="color:#64748b;font-size:12px;margin:0 0 16px;">${escapeHtml(confirmHint)}</p>
    <p style="margin-top:16px;"><a href="${escapeHtml(platformUrl)}">플랫폼 결제 관리에서 확인</a></p>
    <p style="color:#64748b;font-size:12px;">청구서 ID: ${escapeHtml(input.invoiceId)} · 테넌트 ID: ${escapeHtml(input.tenantId)}</p>
  `.trim();

  const subject = formatTenantPaymentConfirmationRequestSubject(input.tenantName);
  const text = [
    subject,
    `업체: ${input.tenantName} (${input.tenantSlug})`,
    `청구 금액: ${input.amountKrw.toLocaleString('ko-KR')}원 (VAT 별도)`,
    `납부기한: ${formatKoDate(input.dueDate)}`,
    `상태: ${input.invoiceStatus}`,
    `요청자: ${input.requesterName} <${input.requesterEmail}>`,
    '',
    `결재확인: ${confirmUrl}`,
    confirmHint,
    '',
    `결제 관리: ${platformUrl}`,
    `청구서 ID: ${input.invoiceId}`,
  ].join('\n');

  return sendPlatformMail({
    to,
    subject,
    html,
    text,
  });
}
