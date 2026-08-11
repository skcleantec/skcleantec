function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlToPlainTextForEmail(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '· ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type PlatformCustomerEmailLayoutInput = {
  subject: string;
  preheader?: string | null;
  headline: string;
  introHtml: string;
  dynamicHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
};

/** 청소비서 브랜드 카드 레이아웃 — platformTransactionalEmail 스타일 */
export function wrapPlatformCustomerEmailHtml(input: PlatformCustomerEmailLayoutInput): string {
  const preheader = (input.preheader ?? input.subject).trim();
  const intro = input.introHtml.trim();
  const dynamic = input.dynamicHtml.trim();
  const footer = input.footerHtml.trim();
  const noreply = input.noreplyNoticeHtml.trim();

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Apple SD Gothic Neo','Noto Sans KR',Malgun Gothic,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:28px 28px 20px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#94a3b8;">Clean Assistant</p>
              <p style="margin:8px 0 0;font-size:24px;font-weight:700;line-height:1.25;color:#ffffff;">청소비서</p>
              <p style="margin:6px 0 0;font-size:13px;font-weight:500;line-height:1.45;color:#cbd5e1;">고객관리 솔루션</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0284c7;">Customer Mail</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeHtml(input.headline)}</h1>
              <div style="font-size:15px;line-height:1.65;color:#334155;">${intro}</div>
              ${dynamic ? `<div style="margin-top:20px;font-size:14px;line-height:1.6;color:#0f172a;">${dynamic}</div>` : ''}
              ${footer ? `<div style="margin-top:20px;font-size:14px;line-height:1.65;color:#475569;">${footer}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <div style="margin-top:8px;padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:13px;line-height:1.6;color:#64748b;">${noreply}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">(주)서비스브릿지 · 청소비서 · <a href="https://www.cbiseo.com" style="color:#0284c7;text-decoration:none;">cbiseo.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function wrapPlatformCustomerEmailPlainText(input: {
  headline: string;
  introHtml: string;
  dynamicPlain: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
}): string {
  const parts = [
    input.headline,
    '',
    htmlToPlainTextForEmail(input.introHtml),
    input.dynamicPlain.trim(),
    htmlToPlainTextForEmail(input.footerHtml),
    htmlToPlainTextForEmail(input.noreplyNoticeHtml),
    '',
    '(주)서비스브릿지 · 청소비서 · https://www.cbiseo.com',
  ].filter((p, i, arr) => !(p === '' && arr[i - 1] === ''));
  return parts.join('\n');
}
