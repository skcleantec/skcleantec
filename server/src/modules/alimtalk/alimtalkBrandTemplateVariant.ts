/** 청소비서 채널 승인본을 업체 채널용 문구로 바꾼다. 발송·DB 호출 없음. */

export type BrandTemplateButton = {
  type: string;
  name: string;
  mobileUrl: string;
  pcUrl: string;
};

export type BrandTemplateSource = {
  name: string;
  category: string;
  emphasizeType: string;
  title: string;
  extra: string;
  content: string;
  buttons: BrandTemplateButton[];
};

const PLATFORM_EXTRA = '고객관리 솔루션 - 청소비서';
const BRAND_EXTRA = '청소 예약 안내';
const BRAND_CLOSING = '궁금한 점은 이 대화방에 바로 남겨 주세요.';
const TOKEN_RE = /#\{[^}]+\}/g;

export function templateTokens(source: Pick<BrandTemplateSource, 'title' | 'extra' | 'content' | 'buttons'>): string[] {
  const chunks = [
    source.title,
    source.extra,
    source.content,
    ...source.buttons.flatMap((button) => [button.name, button.mobileUrl, button.pcUrl]),
  ];
  const found = chunks.join('\n').match(TOKEN_RE) ?? [];
  return [...new Set(found)];
}

/** 「본 알림은」으로 시작하는 문단부터 지우고, 끝의 빈 줄을 없앤다. */
export function stripPlatformDisclaimer(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trim().startsWith('본 알림은'));
  const kept = start >= 0 ? lines.slice(0, start) : lines;
  return kept.join('\n').replace(/\n+$/g, '');
}

function withBrandClosing(content: string): string {
  const body = stripPlatformDisclaimer(content);
  const already = body.split('\n').some((line) => line.trim() === BRAND_CLOSING);
  if (already) return body;
  return `${body}\n\n${BRAND_CLOSING}`;
}

export function buildBrandTemplateVariant(platformTemplate: BrandTemplateSource): BrandTemplateSource {
  return {
    name: platformTemplate.name,
    category: platformTemplate.category,
    emphasizeType: platformTemplate.emphasizeType,
    title: platformTemplate.title,
    extra: platformTemplate.extra.split(PLATFORM_EXTRA).join(BRAND_EXTRA),
    content: withBrandClosing(platformTemplate.content),
    buttons: platformTemplate.buttons.map((button) => ({ ...button })),
  };
}
