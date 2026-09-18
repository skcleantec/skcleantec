import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyPlatformSupportTenantMessageByEmail(input: {
  notifyEmails: string[];
  tenantName: string;
  tenantSlug: string;
  senderName: string;
  senderRoleLabel: string;
  body: string;
}): Promise<{ sent: number }> {
  const tos = input.notifyEmails.map((e) => e.trim()).filter(Boolean);
  if (tos.length === 0) return { sent: 0 };

  const platformUrl = `${getPublicAppBaseUrl()}/platform/messages?tenant=${encodeURIComponent(input.tenantSlug)}`;
  const preview = input.body.replace(/\s+/g, ' ').trim().slice(0, 400);
  const subject = `[${input.tenantName}] 운영 메시지`;
  const html = `
    <h2>청소비서 — 업체 운영 메시지</h2>
    <p>업체가 청소비서 운영팀에 메시지를 보냈습니다.</p>
    <table style="border-collapse:collapse;font-size:14px;line-height:1.5;">
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">업체</td><td><strong>${escapeHtml(input.tenantName)}</strong> (${escapeHtml(input.tenantSlug)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#64748b;">보낸 사람</td><td>${escapeHtml(input.senderName)} (${escapeHtml(input.senderRoleLabel)})</td></tr>
    </table>
    <div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(preview)}</div>
    <p style="margin-top:16px;"><a href="${escapeHtml(platformUrl)}">플랫폼 메시지에서 답장</a></p>
  `.trim();
  const text = [
    '[청소비서 운영 메시지]',
    `업체: ${input.tenantName} (${input.tenantSlug})`,
    `보낸 사람: ${input.senderName} (${input.senderRoleLabel})`,
    '',
    preview,
    '',
    `답장: ${platformUrl}`,
  ].join('\n');

  let sent = 0;
  for (const to of tos) {
    const result = await sendPlatformMail({ to, subject, html, text });
    if (result.sent) sent += 1;
  }
  return { sent };
}
