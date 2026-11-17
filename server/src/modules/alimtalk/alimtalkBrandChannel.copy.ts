import { barobillKakaoChannelId, getTemplates } from '../../lib/barobill/kakaotalk.js';
import type { BarobillKakaoButton } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import { BRAND_CHANNEL_TEMPLATE_CODES } from './alimtalkBrandChannel.select.js';
import { buildBrandTemplateVariant, type BrandTemplateButton, type BrandTemplateSource } from './alimtalkBrandTemplateVariant.js';

function emphasizeLabel(type: number | null, title: string): string {
  if (type === 1) return '강조표기형';
  if (type === 2) return '이미지형';
  if (type === 3) return '아이템리스트형';
  if (type === 0) return '기본형';
  return title.trim() ? '강조표기형' : '기본형';
}

function readButtons(value: unknown): BrandTemplateButton[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Partial<BarobillKakaoButton>;
    return [{
      type: typeof item.ButtonType === 'string' ? item.ButtonType : '',
      name: typeof item.Name === 'string' ? item.Name : '',
      mobileUrl: typeof item.Url1 === 'string' ? item.Url1 : '',
      pcUrl: typeof item.Url2 === 'string' ? item.Url2 : '',
    }];
  });
}

export async function loadBrandChannelCopy(): Promise<BrandTemplateSource[]> {
  const rows = await prisma.alimtalkTemplate.findMany({
    where: { code: { in: [...BRAND_CHANNEL_TEMPLATE_CODES] } },
  });
  let remote: Awaited<ReturnType<typeof getTemplates>> = [];
  try {
    remote = await getTemplates(barobillKakaoChannelId());
  } catch {
    remote = [];
  }
  return BRAND_CHANNEL_TEMPLATE_CODES.map((code) => {
    const saved = rows.find((row) => row.code === code);
    const name = BAROBILL_TEMPLATE_NAME_BY_CODE[code];
    const live = remote.find((item) => item.TemplateName.trim() === name);
    const title = live?.TemplateTitle ?? saved?.barobillTitle ?? '';
    const source: BrandTemplateSource = {
      name,
      category: '예약',
      emphasizeType: emphasizeLabel(live?.TemplateEmphasizeType ?? null, title),
      title,
      extra: live?.TemplateExtra ?? saved?.barobillExtra ?? '',
      content: live?.TemplateContent ?? saved?.barobillContent ?? '',
      buttons: live ? readButtons(live.Buttons) : readButtons(saved?.barobillButtonsJson),
    };
    return buildBrandTemplateVariant(source);
  });
}
