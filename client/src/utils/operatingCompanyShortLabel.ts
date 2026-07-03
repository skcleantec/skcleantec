/** 영업 브랜드 목록·배지용 — 앞 2글자 (예: SK클린텍→SK, 타나클린→타나) */
export function operatingCompanyShortLabel(name: string | null | undefined): string {
  const t = name != null ? String(name).trim() : '';
  if (!t) return '';
  return [...t].slice(0, 2).join('');
}
