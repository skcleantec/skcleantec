import type { GuideSection } from '../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../constants/orderInfoDefaultSections';

function cloneDefault(): GuideSection[] {
  return ORDER_GUIDE_DEFAULT_SECTIONS.map((s) => ({
    title: s.title,
    items: [...s.items],
  }));
}

/** DB `infoContent` 문자열 → 섹션 배열 (JSON·레거시 본문·빈 값 처리) */
export function parseGuideFromStoredContent(raw: string | null | undefined): GuideSection[] {
  if (!raw?.trim()) return cloneDefault();
  const t = raw.trim();
  if (t.startsWith('{')) {
    try {
      const p = JSON.parse(t) as { sections?: unknown };
      if (Array.isArray(p.sections) && p.sections.length > 0) {
        const out: GuideSection[] = [];
        for (const s of p.sections) {
          if (s && typeof s === 'object') {
            const title = String((s as { title?: unknown }).title ?? '').trim();
            const itemsRaw = (s as { items?: unknown }).items;
            const items = Array.isArray(itemsRaw)
              ? itemsRaw.map((x) => String(x).trim()).filter(Boolean)
              : [];
            if (title || items.length) out.push({ title: title || '안내', items });
          }
        }
        if (out.length) return out;
      }
    } catch {
      /* 레거시 한 줄 본문 등 */
    }
  }
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length) return [{ title: '안내', items: lines }];
  return cloneDefault();
}
