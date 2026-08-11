/**
 * 플랫폼 고객 메일 CMS 기본 HTML — 청소비서 브랜드(slate·sky) 인라인 서식
 * 이메일 클라이언트 호환: table + inline style 위주
 */

const P = {
  greeting:
    'margin:0 0 16px;font-size:16px;line-height:1.65;color:#0f172a',
  body: 'margin:0;font-size:15px;line-height:1.65;color:#334155',
  muted: 'margin:0;font-size:14px;line-height:1.6;color:#64748b',
  accentLabel:
    'margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#0284c7',
  strong: 'color:#0f172a',
  link: 'color:#0284c7;text-decoration:none;font-weight:600',
} as const;

function highlightCard(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:separate">
<tbody><tr><td style="padding:16px 18px;background-color:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0284c7;border-radius:12px">
${inner}
</td></tr></tbody></table>`;
}

export const ORDER_FORM_INTRO_HTML_DEFAULT =
  `<p style="${P.greeting}"><strong style="${P.strong}">{{customerName}}</strong>님, 안녕하세요.</p>` +
  highlightCard(
    `<p style="${P.accentLabel}">청소비서 · Clean Assistant</p>` +
      `<p style="${P.body}"><strong style="${P.strong}">{{brandDisplayName}}</strong> 청소 예약(발주서) 접수가 <strong style="${P.strong}">정상 완료</strong>되었습니다.</p>`,
  ) +
  `<p style="${P.muted}">입주·이사 청소 전문 플랫폼 <strong style="color:#475569">청소비서</strong>를 통해 안전하게 접수되었습니다. 아래는 접수하신 내용 요약입니다.</p>`;

export const ORDER_FORM_FOOTER_HTML_DEFAULT =
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:separate">
<tbody><tr><td style="padding:14px 16px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#334155">담당자가 일정을 확인한 뒤 연락드릴 수 있습니다.</p>
<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b">청소비서는 입주·이사 청소 예약을 돕는 서비스입니다.</p>
</td></tr></tbody></table>`;

export const INSPECTION_INTRO_HTML_DEFAULT =
  `<p style="${P.greeting}"><strong style="${P.strong}">{{customerName}}</strong>님, 안녕하세요.</p>` +
  highlightCard(
    `<p style="${P.accentLabel}">청소비서 · 현장 검수</p>` +
      `<p style="${P.body}"><strong style="${P.strong}">{{brandDisplayName}}</strong> 현장 검수가 <strong style="${P.strong}">완료</strong>되었습니다. 아래에서 검수 결과·사진을 확인하실 수 있습니다.</p>`,
  ) +
  `<p style="${P.muted}">청소 전·후 상태와 기본 확인 사항을 투명하게 기록·전달하는 것이 청소비서 현장 검수 서비스입니다.</p>`;

export const INSPECTION_FOOTER_HTML_DEFAULT =
  `<p style="margin:0;font-size:14px;line-height:1.6;color:#475569">검수 사진·완료본 PDF는 아래 링크에서 확인하실 수 있습니다.</p>`;

export const NOREPLY_NOTICE_HTML_DEFAULT =
  `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b">본 메일은 발신 전용 주소(<strong style="color:#475569">noreply</strong>)로 발송되었으며 <strong style="color:#0f172a">회신되지 않습니다</strong>.</p>` +
  `<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b">문의·일정 변경 등은 <strong style="color:#0f172a">해당 업체</strong>로만 연락해 주세요.</p>`;
