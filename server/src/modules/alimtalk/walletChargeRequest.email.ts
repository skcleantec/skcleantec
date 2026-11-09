import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { walletChargePayKrw, walletChargeVatKrw } from '../../lib/alimtalkPolicy.js';
import {
  buildWalletChargeConfirmPageUrl,
  signWalletChargeConfirmToken,
} from './walletChargeConfirmToken.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKoDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function formatTenantWalletChargeConfirmSubject(tenantName: string): string {
  const name = tenantName.trim() || '업체';
  return `[${name}] 지갑 충전 입금확인요청`;
}

export type WalletChargeRequestEmailInput = {
  notifyEmail: string;
  tenantName: string;
  tenantSlug: string;
  tenantId: string;
  chargeRequestId: string;
  supplyAmountKrw: number;
  memo: string | null;
  requesterName: string;
  requestedAt: string;
};

export async function notifyWalletChargeRequestByEmail(
  input: WalletChargeRequestEmailInput,
): Promise<{ sent: boolean; reason?: string; detail?: string }> {
  const to = input.notifyEmail.trim();
  if (!to) return { sent: false, reason: 'NO_NOTIFY_EMAIL' };

  const vatKrw = walletChargeVatKrw(input.supplyAmountKrw);
  const payKrw = walletChargePayKrw(input.supplyAmountKrw);
  const platformUrl = `${getPublicAppBaseUrl()}/platform/tenants/${encodeURIComponent(input.tenantId)}#section-wallet`;
  const confirmToken = signWalletChargeConfirmToken({
    tenantId: input.tenantId,
    chargeRequestId: input.chargeRequestId,
  });
  const confirmUrl = buildWalletChargeConfirmPageUrl(confirmToken);
  const subject = formatTenantWalletChargeConfirmSubject(input.tenantName);
  const memoLine = input.memo?.trim() || '—';

  const html = `
    <h2>청소비서 — 지갑 충전 입금 확인 요청</h2>
    <p>업체가 청소비서 지갑 충전을 신청했습니다.</p>
    <table style="border-collapse:collapse;font-size:14px;line-height:1.5;">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">업체</td><td><strong>${escapeHtml(input.tenantName)}</strong> (${escapeHtml(input.tenantSlug)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">신청자</td><td>${escapeHtml(input.requesterName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">신청 시각</td><td>${escapeHtml(formatKoDateTime(input.requestedAt))}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">충전금(공급가)</td><td>${input.supplyAmountKrw.toLocaleString('ko-KR')}원</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">부가세</td><td>${vatKrw.toLocaleString('ko-KR')}원</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">받을 금액(입금액)</td><td><strong style="font-size:16px;">${payKrw.toLocaleString('ko-KR')}원</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">메모</td><td>${escapeHtml(memoLine)}</td></tr>
    </table>
    <p style="margin:20px 0 8px;">
      <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">입금 확인하고 충전</a>
    </p>
    <p style="color:#64748b;font-size:12px;margin:0 0 16px;">버튼을 누르면 미리보기 화면이 열립니다. 그다음 「입금 확인하고 충전」을 한 번 더 눌러야 잔액이 반영됩니다.</p>
    <p style="margin-top:16px;"><a href="${escapeHtml(platformUrl)}">플랫폼에서 확인</a></p>
    <p style="color:#64748b;font-size:12px;">신청 ID: ${escapeHtml(input.chargeRequestId)} · 테넌트 ID: ${escapeHtml(input.tenantId)}</p>
  `.trim();

  const text = [
    subject,
    `업체: ${input.tenantName} (${input.tenantSlug})`,
    `신청자: ${input.requesterName}`,
    `신청 시각: ${formatKoDateTime(input.requestedAt)}`,
    `충전금(공급가): ${input.supplyAmountKrw.toLocaleString('ko-KR')}원`,
    `부가세: ${vatKrw.toLocaleString('ko-KR')}원`,
    `받을 금액(입금액): ${payKrw.toLocaleString('ko-KR')}원`,
    `메모: ${memoLine}`,
    '',
    `입금 확인하고 충전: ${confirmUrl}`,
    '미리보기만으로는 승인되지 않습니다. 화면에서 버튼을 한 번 더 눌러 주세요.',
    '',
    `플랫폼에서 확인: ${platformUrl}`,
    `신청 ID: ${input.chargeRequestId}`,
  ].join('\n');

  return sendPlatformMail({
    to,
    subject,
    html,
    text,
  });
}
