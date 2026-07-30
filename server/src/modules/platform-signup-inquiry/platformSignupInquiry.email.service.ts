import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { getPlatformSignupInquirySettings } from './platformSignupInquiry.settings.service.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SignupInquiryEmailPayload = {
  id: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  teamLeaderRange: string | null;
  desiredPlan: string;
  message: string;
  sourcePageUrl: string | null;
  createdAt: string;
};

export async function notifyPlatformSignupInquiryByEmail(
  inquiry: SignupInquiryEmailPayload,
): Promise<{ sent: number; skipped?: string }> {
  const settings = await getPlatformSignupInquirySettings();
  if (!settings.isActive) return { sent: 0, skipped: 'INACTIVE' };
  if (settings.notifyEmails.length === 0) return { sent: 0, skipped: 'NO_NOTIFY_EMAILS' };

  const html = `
    <h2>청소비서 — 도입 상담 신청</h2>
    <p><strong>업체명:</strong> ${escapeHtml(inquiry.companyName)}</p>
    <p><strong>담당자:</strong> ${escapeHtml(inquiry.contactName)}</p>
    <p><strong>연락처:</strong> ${escapeHtml(inquiry.contactPhone)}</p>
    ${
      inquiry.contactEmail
        ? `<p><strong>이메일:</strong> ${escapeHtml(inquiry.contactEmail)}</p>`
        : ''
    }
    ${
      inquiry.teamLeaderRange
        ? `<p><strong>팀장 수:</strong> ${escapeHtml(inquiry.teamLeaderRange)}</p>`
        : ''
    }
    <p><strong>희망 플랜:</strong> ${escapeHtml(inquiry.desiredPlan)}</p>
    <hr/>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;">${escapeHtml(inquiry.message)}</pre>
    ${
      inquiry.sourcePageUrl
        ? `<p style="color:#64748b;font-size:12px;">접수 페이지: ${escapeHtml(inquiry.sourcePageUrl)}</p>`
        : ''
    }
    <hr/>
    <p style="color:#64748b;font-size:12px;">접수 ID: ${escapeHtml(inquiry.id)} · ${escapeHtml(inquiry.createdAt)}</p>
    <p style="color:#64748b;font-size:12px;">플랫폼 → 업체 관리 → 가입승인 게시판에서 확인하세요.</p>
  `.trim();

  const text = [
    '[청소비서 도입 상담]',
    `업체명: ${inquiry.companyName}`,
    `담당자: ${inquiry.contactName}`,
    `연락처: ${inquiry.contactPhone}`,
    inquiry.contactEmail ? `이메일: ${inquiry.contactEmail}` : '',
    inquiry.teamLeaderRange ? `팀장 수: ${inquiry.teamLeaderRange}` : '',
    `희망 플랜: ${inquiry.desiredPlan}`,
    '',
    inquiry.message,
    '',
    inquiry.sourcePageUrl ? `페이지: ${inquiry.sourcePageUrl}` : '',
    `ID: ${inquiry.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  let sent = 0;
  for (const to of settings.notifyEmails) {
    const result = await sendPlatformMail({
      to,
      subject: `[청소비서 도입상담] ${inquiry.companyName} — ${inquiry.contactName}`,
      html,
      text,
    });
    if (result.sent) sent += 1;
  }
  return { sent };
}
