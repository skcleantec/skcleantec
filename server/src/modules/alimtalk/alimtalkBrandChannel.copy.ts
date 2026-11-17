import { barobillKakaoChannelId, getTemplates } from '../../lib/barobill/kakaotalk.js';
import type { BarobillKakaoButton } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import { BAROBILL_TEMPLATE_NAME_BY_CODE } from './alimtalkBarobillSync.service.js';
import { BRAND_CHANNEL_TEMPLATE_CODES } from './alimtalkBrandChannel.select.js';
import {
  brandTemplateCategory,
  buildBrandTemplateVariant,
  emphasizeTypeLabel,
  type BrandTemplateButton,
  type BrandTemplateSource,
} from './alimtalkBrandTemplateVariant.js';

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
    const subtitle = live?.TemplateSubtitle ?? saved?.barobillSubtitle ?? '';
    const emphasizeType = emphasizeTypeLabel(
      live ? live.TemplateEmphasizeType : subtitle.trim() || title.trim() ? 1 : 0,
    );
    const source: BrandTemplateSource = {
      name,
      category: brandTemplateCategory(code),
      emphasizeType,
      title,
      extra: subtitle.trim() || (live?.TemplateExtra ?? saved?.barobillExtra ?? ''),
      content: live?.TemplateContent ?? saved?.barobillContent ?? '',
      buttons: live ? readButtons(live.Buttons) : readButtons(saved?.barobillButtonsJson),
    };
    return buildBrandTemplateVariant(source);
  });
}
