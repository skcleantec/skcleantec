import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import type { HelpInquiryPostDto } from './helpInquiry.types.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function notifyHelpInquiryPostByEmail(
  notifyEmail: string,
  post: HelpInquiryPostDto,
): Promise<{ sent: boolean; reason?: string }> {
  const to = notifyEmail.trim();
  if (!to) return { sent: false, reason: 'NO_NOTIFY_EMAIL' };

  const imageBlock =
    post.imageUrls.length > 0
      ? `<h3>첨부 이미지</h3><ul>${post.imageUrls
          .map(
            (url) =>
              `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a><br/><img src="${escapeHtml(url)}" alt="" style="max-width:480px;height:auto;margin-top:8px;" /></li>`,
          )
          .join('')}</ul>`
      : '';

  const html = `
    <h2>청소비서 도움말 — 고객문의 게시판</h2>
    <p><strong>카테고리:</strong> ${escapeHtml(post.categoryLabel)}</p>
    <p><strong>작성자:</strong> ${escapeHtml(post.authorName)} &lt;${escapeHtml(post.authorEmail)}&gt;</p>
    <p><strong>제목:</strong> ${escapeHtml(post.title)}</p>
    <hr/>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.5;">${escapeHtml(post.bodyMarkdown)}</pre>
    ${imageBlock}
    <hr/>
    <p style="color:#64748b;font-size:12px;">글 ID: ${escapeHtml(post.id)} · ${escapeHtml(post.createdAt)}</p>
  `.trim();

  const text = [
    '[청소비서 도움말 고객문의]',
    `카테고리: ${post.categoryLabel}`,
    `작성자: ${post.authorName} <${post.authorEmail}>`,
    `제목: ${post.title}`,
    '',
    post.bodyMarkdown,
    '',
    post.imageUrls.length ? `첨부: ${post.imageUrls.join('\n')}` : '',
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
