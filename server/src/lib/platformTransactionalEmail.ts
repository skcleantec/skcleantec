import { getPublicAppBaseUrl } from './publicAppBaseUrl.js';

export type PlatformVerificationEmailKind = 'TENANT_SIGNUP' | 'PASSWORD_RESET';

export type PlatformVerificationEmailInput = {
  kind: PlatformVerificationEmailKind;
  code: string;
  /** 가입 — 업체명 */
  companyName?: string;
  /** 가입 — 업체 코드 */
  tenantSlug?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verificationCopy(kind: PlatformVerificationEmailKind) {
  if (kind === 'TENANT_SIGNUP') {
    return {
      subject: '[청소비서] 업체 개설 이메일 인증번호',
      preheader: '청소비서 업체 개설을 완료하려면 아래 인증번호를 입력해 주세요.',
      headline: '업체 개설 이메일 인증',
      lead: '청소비서 무료 플랜 업체 개설을 위해 아래 인증번호를 가입 화면에 입력해 주세요.',
      actionLabel: '가입 화면으로 이동',
      actionPath: '/signup',
      security:
        '본인이 요청하지 않았다면 이 메일을 무시해 주세요. 인증번호는 10분간 유효하며, 타인에게 공유하지 마세요.',
      textIntro: '청소비서 업체 개설을 위한 이메일 인증번호입니다.',
    };
  }
  return {
    subject: '[청소비서] 비밀번호 재설정 인증번호',
    preheader: '비밀번호 재설정을 위해 아래 인증번호를 입력해 주세요.',
    headline: '비밀번호 재설정 인증',
    lead: '등록하신 이메일로 비밀번호 재설정을 요청하셨습니다. 아래 인증번호를 입력해 주세요.',
    actionLabel: '비밀번호 찾기 화면으로 이동',
    actionPath: '/forgot-password',
    security:
      '본인이 요청하지 않았다면 이 메일을 무시해 주세요. 인증번호는 10분간 유효하며, 타인에게 공유하지 마세요.',
    textIntro: '청소비서 비밀번호 재설정을 위한 이메일 인증번호입니다.',
  };
}

export function buildPlatformVerificationEmailSubject(kind: PlatformVerificationEmailKind): string {
  return verificationCopy(kind).subject;
}

function detailRows(input: PlatformVerificationEmailInput): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (input.kind === 'TENANT_SIGNUP') {
    const name = input.companyName?.trim();
    const slug = input.tenantSlug?.trim();
    if (name) rows.push({ label: '업체명', value: name });
    if (slug) rows.push({ label: '업체 코드', value: slug });
  } else if (input.tenantSlug?.trim()) {
    rows.push({ label: '업체 코드', value: input.tenantSlug.trim() });
  }
  rows.push({ label: '유효 시간', value: '발송 시점부터 10분' });
  return rows;
}

function renderDetailTableHtml(rows: Array<{ label: string; value: string }>): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (row) =>
        `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background-color:#f8fafc;font-size:13px;font-weight:600;color:#475569;width:30%;vertical-align:top">${escapeHtml(row.label)}</th><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden">${body}</table>`;
}

export function buildPlatformVerificationEmailHtml(input: PlatformVerificationEmailInput): string {
  const copy = verificationCopy(input.kind);
  const code = input.code.trim();
  const actionUrl = `${getPublicAppBaseUrl()}${copy.actionPath}`;
  const rows = detailRows(input);
  const detailTable = renderDetailTableHtml(rows);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Apple SD Gothic Neo','Noto Sans KR',Malgun Gothic,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:28px 28px 20px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#94a3b8;">Clean Assistant</p>
              <p style="margin:8px 0 0;font-size:24px;font-weight:700;line-height:1.25;color:#ffffff;">청소비서</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0284c7;">Verification</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeHtml(copy.headline)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${escapeHtml(copy.lead)}</p>
              ${detailTable}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 28px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
                <tr>
                  <td align="center" style="padding:18px 28px;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">인증번호</p>
                    <p style="margin:0;font-size:34px;line-height:1;font-weight:700;letter-spacing:0.32em;color:#0f172a;font-family:Consolas,'Courier New',monospace;">${escapeHtml(code)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <p style="margin:20px 0 0;font-size:14px;line-height:1.65;color:#475569;">${escapeHtml(copy.security)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#0f172a;">
                    <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(copy.actionLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#64748b;">본 메일은 발송 전용입니다. 회신하지 마세요.</p>
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

export function buildPlatformVerificationEmailText(input: PlatformVerificationEmailInput): string {
  const copy = verificationCopy(input.kind);
  const actionUrl = `${getPublicAppBaseUrl()}${copy.actionPath}`;
  const lines = [copy.textIntro, ''];

  for (const row of detailRows(input)) {
    lines.push(`${row.label}: ${row.value}`);
  }

  lines.push(
    '',
    `인증번호: ${input.code.trim()}`,
    '',
    copy.security,
    '',
    `${copy.actionLabel}: ${actionUrl}`,
    '',
    '본 메일은 발송 전용입니다.',
    '(주)서비스브릿지 · 청소비서 · https://www.cbiseo.com',
  );

  return lines.join('\n');
}
