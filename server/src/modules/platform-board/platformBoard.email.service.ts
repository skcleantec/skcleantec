/**
 * 1:1 문의 메일 — ① 담당자 알림(새 문의·추가 질문) ② 고객 답변.
 * 답장은 게시판 설정의 「답장 받는 메일함」으로 오고, 제목의 #번호로 문의를 찾는다.
 */
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import type { PlatformBoardPostDto } from './platformBoard.service.js';
import {
  escapeHtml,
  htmlToPlainText,
  inquiryMessageId,
  inquirySubject,
} from './platformBoardInquiry.helpers.js';

const CONTACT_PHONE = '010-6862-8692';
const CONTACT_HOURS = '평일 오전 10시~오후 7시';

function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || 'https://www.cbiseo.com').replace(/\/$/, '');
}

export function platformInquiryUrl(postId: string): string {
  return `${appBaseUrl()}/platform/customer-boards/posts/${encodeURIComponent(postId)}/edit`;
}

export function publicInquiryUrl(postId: string): string {
  return `${appBaseUrl()}/help?category=inquiry&post=${encodeURIComponent(postId)}`;
}

function formatKst(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 본문 HTML의 사진은 링크로만 보낸다(메일에서 원격 이미지를 띄우지 않게) */
function bodyHtmlWithImageLinks(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, src: string) => {
    const url = String(src);
    if (!/^https?:\/\//i.test(url)) return '';
    return `<a href="${escapeHtml(url)}" style="color:#0369a1;">[첨부 사진 보기]</a>`;
  });
}

function bodyTextFromHtml(html: string): string {
  const withLinks = html.replace(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, src: string) =>
    /^https?:\/\//i.test(src) ? `\n[첨부 사진] ${src}\n` : '',
  );
  return htmlToPlainText(withLinks);
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#0f172a;color:#ffffff;font-weight:700;border-radius:10px;padding:10px 16px;font-size:14px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function shell(inner: string): string {
  return `<!doctype html><html lang="ko"><body style="margin:0;padding:24px 12px;background:#f1f4f9;font-family:'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;color:#0f172a;word-break:keep-all;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">${inner}</div>
</body></html>`;
}

export type StaffNotifyKind = 'NEW' | 'FOLLOWUP';

/** ① 담당자 알림 — 받는 사람마다 1통씩 */
export async function notifyInquiryStaff(params: {
  post: PlatformBoardPostDto;
  notifyEmails: string[];
  replyInboxEmail: string | null;
  kind: StaffNotifyKind;
  /** 추가 질문일 때 고객이 새로 쓴 내용(글) */
  followupText?: string;
}): Promise<{ sent: number; failed: number }> {
  const { post, notifyEmails, replyInboxEmail, kind } = params;
  const token = post.replyToken ?? '';
  if (!token || notifyEmails.length === 0) return { sent: 0, failed: 0 };

  const isFollowup = kind === 'FOLLOWUP';
  const subject = isFollowup
    ? inquirySubject(token, `(추가 질문) ${post.title}`)
    : inquirySubject(token, post.title);
  const when = formatKst(new Date().toISOString());
  const guide = replyInboxEmail
    ? '이 메일에 바로 답장하면 고객에게 답변 메일이 가고, 문의 글에도 답변이 남아요.'
    : '답장 받는 메일함이 아직 연결되지 않았어요. 플랫폼에서 답변을 써 주세요.';

  const rows: [string, string][] = [
    ['문의 종류', post.categoryLabel ?? '—'],
    ['이름', post.authorName ?? '—'],
    ['휴대폰', post.authorPhone ?? '—'],
    ['이메일', post.authorEmail ?? '—'],
  ];
  if (post.tenantName) rows.push(['업체', post.tenantName]);

  const contentHtml = isFollowup
    ? escapeHtml(params.followupText ?? '').replace(/\n/g, '<br/>')
    : bodyHtmlWithImageLinks(post.bodyHtml ?? '');

  const html = shell(`
<div style="padding:20px 22px;display:block;font-size:14px;line-height:1.6;">
  <div style="background:#fffbeb;border-radius:10px;padding:10px 14px;color:#92400e;font-weight:700;margin:0 0 14px;">${escapeHtml(guide)}</div>
  ${isFollowup ? '<p style="margin:0 0 10px;font-weight:700;">고객이 추가 질문을 남겼어요.</p>' : ''}
  <table style="border-collapse:collapse;font-size:14px;margin:0 0 14px;">
    <tbody>
      ${rows
        .map(
          ([k, v]) =>
            `<tr><th scope="row" style="text-align:left;color:#64748b;font-weight:500;padding:4px 16px 4px 0;">${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <p style="margin:0 0 6px;font-weight:700;">${escapeHtml(post.title)}</p>
  <div style="border-left:3px solid #cbd5e1;padding:4px 0 4px 14px;line-height:1.7;color:#1e293b;margin:0 0 16px;">${contentHtml}</div>
  <div style="margin:0 0 14px;">${button(platformInquiryUrl(post.id), '플랫폼에서 열기')}</div>
  <p style="margin:0;font-size:12px;color:#94a3b8;">문의 #${escapeHtml(token)} · ${escapeHtml(when)}</p>
</div>`);

  const text = [
    guide,
    '',
    isFollowup ? '고객이 추가 질문을 남겼어요.' : '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    post.title,
    isFollowup ? params.followupText ?? '' : bodyTextFromHtml(post.bodyHtml ?? ''),
    '',
    `플랫폼에서 열기: ${platformInquiryUrl(post.id)}`,
    `문의 #${token} · ${when}`,
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n');

  const threadId = inquiryMessageId(post.id);
  let sent = 0;
  let failed = 0;
  for (const to of notifyEmails) {
    try {
      const r = await sendPlatformMail({
        to,
        subject,
        html,
        text,
        replyTo: replyInboxEmail ?? undefined,
        ...(isFollowup ? { inReplyTo: threadId, references: threadId } : { messageId: threadId }),
      });
      if (r.sent) sent += 1;
      else {
        failed += 1;
        console.warn('[help-inquiry-mail] staff notify not sent', r.reason ?? 'unknown');
      }
    } catch (e) {
      failed += 1;
      console.error('[help-inquiry-mail] staff notify failed', e instanceof Error ? e.message : 'error');
    }
  }
  return { sent, failed };
}

/** ② 고객 답변 메일 */
export async function sendInquiryAnswerToCustomer(params: {
  post: PlatformBoardPostDto;
  answerHtml: string;
  replyInboxEmail: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const { post } = params;
  const to = post.authorEmail?.trim();
  const token = post.replyToken ?? '';
  if (!to) return { sent: false, error: '고객 이메일이 없어요.' };
  if (!token) return { sent: false, error: '문의 번호가 없어요.' };

  const name = post.authorName?.trim() || '고객';
  const original = htmlToPlainText(post.bodyHtml ?? '').replace(/\s+/g, ' ').trim();
  const originalShort = original.length > 200 ? `${original.slice(0, 200)}…` : original;
  const answerText = htmlToPlainText(params.answerHtml);

  const html = shell(`
<div style="background:#0f172a;color:#ffffff;padding:16px 22px;font-weight:800;font-size:15px;">
  청소비서 고객센터
</div>
<div style="padding:20px 22px;font-size:14.5px;line-height:1.75;">
  <p style="margin:0 0 14px;">${escapeHtml(name)}님, 남겨 주신 문의에 답변드려요.</p>
  <div style="background:#f0f9ff;border-radius:12px;padding:14px 16px;margin:0 0 14px;">${params.answerHtml}</div>
  ${originalShort ? `<div style="font-size:13px;color:#64748b;border-left:3px solid #e2e8f0;padding-left:12px;margin:0 0 14px;">남기신 문의 · ${escapeHtml(originalShort)}</div>` : ''}
  <p style="margin:0 0 14px;font-size:13.5px;color:#475569;">더 궁금한 점은 이 메일에 그대로 답장해 주세요. 같은 문의로 이어서 답해 드려요.</p>
  <div>${button(publicInquiryUrl(post.id), '문의 글에서 보기')}</div>
</div>
<p style="margin:0;padding:12px 22px 18px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">청소비서 고객센터 · ${CONTACT_HOURS} · ${CONTACT_PHONE}</p>`);

  const text = [
    `${name}님, 남겨 주신 문의에 답변드려요.`,
    '',
    answerText,
    '',
    originalShort ? `남기신 문의 · ${originalShort}` : '',
    '',
    '더 궁금한 점은 이 메일에 그대로 답장해 주세요. 같은 문의로 이어서 답해 드려요.',
    `문의 글에서 보기: ${publicInquiryUrl(post.id)}`,
    '',
    `청소비서 고객센터 · ${CONTACT_HOURS} · ${CONTACT_PHONE}`,
  ].join('\n');

  const threadId = inquiryMessageId(post.id);
  try {
    const r = await sendPlatformMail({
      to,
      subject: `Re: ${inquirySubject(token, post.title)}`,
      html,
      text,
      replyTo: params.replyInboxEmail ?? undefined,
      inReplyTo: threadId,
      references: threadId,
    });
    if (r.sent) return { sent: true };
    return { sent: false, error: r.detail ?? '메일을 보내지 못했어요.' };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message.slice(0, 200) : '메일을 보내지 못했어요.' };
  }
}
