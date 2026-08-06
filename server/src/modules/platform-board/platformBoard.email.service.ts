import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import type { PlatformBoardPostDto } from './platformBoard.service.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyPlatformInquiryPostByEmail(
  notifyEmail: string,
  post: PlatformBoardPostDto,
): Promise<{ sent: boolean; reason?: string }> {
  const to = notifyEmail.trim();
  if (!to) return { sent: false, reason: 'NO_NOTIFY_EMAIL' };

  const html = `
    <h2>청소비서 고객센터 — 문의 접수</h2>
    <p><strong>카테고리:</strong> ${escapeHtml(post.categoryLabel ?? '—')}</p>
    <p><strong>작성자:</strong> ${escapeHtml(post.authorName ?? '—')} &lt;${escapeHtml(post.authorEmail ?? '')}&gt;</p>
    ${post.tenantName ? `<p><strong>업체:</strong> ${escapeHtml(post.tenantName)}</p>` : ''}
    <p><strong>제목:</strong> ${escapeHtml(post.title)}${post.isSecret ? ' <span>(비밀글)</span>' : ''}</p>
    <hr/>
    <div style="font-size:14px;line-height:1.6;">${post.bodyHtml ?? ''}</div>
    <hr/>
    <p style="color:#64748b;font-size:12px;">글 ID: ${escapeHtml(post.id)} · ${escapeHtml(post.createdAt)}</p>
  `.trim();

  const text = [
    '[청소비서 고객센터 문의]',
    `카테고리: ${post.categoryLabel ?? '—'}`,
    `작성자: ${post.authorName ?? '—'} <${post.authorEmail ?? ''}>`,
    post.tenantName ? `업체: ${post.tenantName}` : '',
    `제목: ${post.title}${post.isSecret ? ' (비밀글)' : ''}`,
    '',
    '플랫폼 관리자 페이지에서 확인해 주세요.',
  ]
    .filter(Boolean)
    .join('\n');

  return sendPlatformMail({
    to,
    subject: `[청소비서 문의] ${post.title}`,
    html,
    text,
  });
}
