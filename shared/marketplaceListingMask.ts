/**
 * DB 마켓(정보공유) 구매 전 PII 마스킹.
 * @see docs/DB_MARKETPLACE.md
 */

const METRO_SIDO_SHORT: ReadonlyArray<{ pattern: RegExp; short: string }> = [
  { pattern: /^서울(?:특별시|시)?/, short: '서울' },
  { pattern: /^부산(?:광역시|시)?/, short: '부산' },
  { pattern: /^대구(?:광역시|시)?/, short: '대구' },
  { pattern: /^인천(?:광역시|시)?/, short: '인천' },
  { pattern: /^광주(?:광역시|시)?/, short: '광주' },
  { pattern: /^대전(?:광역시|시)?/, short: '대전' },
  { pattern: /^울산(?:광역시|시)?/, short: '울산' },
  { pattern: /^세종(?:특별자치시|시)?/, short: '세종' },
];

const PROVINCE_SHORT: ReadonlyArray<{ pattern: RegExp; short: string }> = [
  { pattern: /^경기(?:도)?/, short: '경기' },
  { pattern: /^강원(?:특별자치도|도)?/, short: '강원' },
  { pattern: /^충청북도|^충북/, short: '충북' },
  { pattern: /^충청남도|^충남/, short: '충남' },
  { pattern: /^전북(?:특별자치도|도)?|^전라북도/, short: '전북' },
  { pattern: /^전라남도|^전남/, short: '전남' },
  { pattern: /^경상북도|^경북/, short: '경북' },
  { pattern: /^경상남도|^경남/, short: '경남' },
  { pattern: /^제주(?:특별자치도|도)?/, short: '제주' },
];

/** 고객명 마스킹 — 2글자 `표0`, 3글자 `표0오`, 4글자+ 가운데 1자리 `0` */
export function maskMarketplaceCustomerName(name: string | null | undefined): string {
  const n = String(name ?? '').trim();
  if (!n) return '';
  if (n.length === 1) return n;
  if (n.length === 2) return `${n[0]}0`;
  if (n.length === 3) return `${n[0]}0${n[2]}`;
  const mid = Math.floor(n.length / 2);
  return `${n.slice(0, mid)}0${n.slice(mid + 1)}`;
}

function normalizeAddressSpaces(address: string): string {
  return address.replace(/\s+/g, ' ').trim();
}

function shortSidoToken(raw: string): string | null {
  for (const { pattern, short } of METRO_SIDO_SHORT) {
    if (pattern.test(raw)) return short;
  }
  for (const { pattern, short } of PROVINCE_SHORT) {
    if (pattern.test(raw)) return short;
  }
  return null;
}

/** 주소 → 시·구(군) 수준만 (예: `인천 미추홀구`) */
export function maskMarketplaceAddressRegion(address: string | null | undefined): string {
  const raw = normalizeAddressSpaces(String(address ?? ''));
  if (!raw) return '';

  const sidoShort = shortSidoToken(raw);
  const districtMatch = raw.match(/([가-힣]+(?:구|군))/);
  const district = districtMatch?.[1] ?? '';

  if (sidoShort && district) return `${sidoShort} ${district}`;

  const cityMatch = raw.match(/([가-힣]+시)/);
  const city = cityMatch?.[1] ?? '';
  if (sidoShort && city) {
    const cityShort = city.endsWith('시') ? city.slice(0, -1) : city;
    if (district && !city.includes(district.replace(/구|군$/, ''))) {
      return `${sidoShort} ${cityShort} ${district}`.trim();
    }
    return `${sidoShort} ${cityShort}`.trim();
  }

  if (district) return district;
  if (sidoShort) return sidoShort;

  const parts = raw.split(' ').filter(Boolean);
  return parts.slice(0, 2).join(' ');
}
