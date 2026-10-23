export type SkHomepageQuote = {
  customerName: string;
  customerPhone: string;
  preferredDate: string | null;
  moveInDate: string | null;
  address: string;
  areaPyeong: number | null;
  roomCount: number | null;
  bathroomCount: number | null;
  kitchenCount: number | null;
  balconyCount: number | null;
  specialNotes: string;
};

function normKey(value: string): string {
  return value.replace(/\s+/g, '').replace(/개수/g, '갯수');
}

function cellText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFields(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  if (/<t[dh]\b/i.test(raw)) {
    for (const row of raw.split(/<tr\b/i)) {
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cellText(m[1] ?? ''));
      if (cells.length >= 2 && cells[0]) map.set(normKey(cells[0]), cells[1] ?? '');
    }
  }
  if (!map.has('이름')) {
    const text = raw.replace(/<[^>]+>/g, '\n');
    for (const line of text.split(/\n+/)) {
      const m = line.trim().match(/^([^:：]{1,20})\s*[:：]\s*(.+)$/);
      if (!m) continue;
      map.set(normKey(m[1] ?? ''), (m[2] ?? '').trim());
    }
  }
  return map;
}

function ymd(value: string): string | null {
  const m = value.match(/(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

function countOf(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const m = value.match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function areaOf(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const m = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** 옛 홈페이지 「간편견적」 HTML 표. 제목·이름·연락처가 없으면 null. */
export function parseSkHomepageQuote(subject: string, raw: string): SkHomepageQuote | null {
  if (!subject.includes('간편견적')) return null;
  const fields = extractFields(raw);
  const customerName = fields.get('이름')?.trim() ?? '';
  const customerPhone = fields.get('연락처')?.trim() ?? '';
  if (!customerName || !customerPhone) return null;
  return {
    customerName,
    customerPhone,
    preferredDate: ymd(fields.get('청소날짜') ?? ''),
    moveInDate: ymd(fields.get('이사날짜') ?? ''),
    address: fields.get('지역')?.trim() || '지역 미입력',
    areaPyeong: areaOf(fields.get('공급면적')),
    roomCount: countOf(fields.get('방갯수')),
    bathroomCount: countOf(fields.get('화장실갯수')),
    kitchenCount: countOf(fields.get('주방갯수')),
    balconyCount: countOf(fields.get('베란다갯수')),
    specialNotes: fields.get('특이사항')?.trim() ?? '',
  };
}

export function formatSkHomepageQuote(quote: SkHomepageQuote): string {
  const lines = [
    `이름: ${quote.customerName}`,
    `연락처: ${quote.customerPhone}`,
    `청소날짜: ${quote.preferredDate ?? ''}`,
    `이사날짜: ${quote.moveInDate ?? ''}`,
    `지역: ${quote.address}`,
    `공급면적: ${quote.areaPyeong ?? ''}`,
    `방갯수: ${quote.roomCount ?? ''}`,
    `화장실갯수: ${quote.bathroomCount ?? ''}`,
    `주방갯수: ${quote.kitchenCount ?? ''}`,
    `베란다갯수: ${quote.balconyCount ?? ''}`,
  ];
  if (quote.specialNotes) lines.push(`특이사항: ${quote.specialNotes}`);
  return lines.join('\n');
}
