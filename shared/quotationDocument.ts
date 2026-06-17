/** 견적서 문서 제목 — `{브랜드명} 견적서` */
export function formatQuotationDocumentTitle(brandOrCompanyName: string): string {
  const name = brandOrCompanyName.trim();
  if (!name) return '견적서';
  return `${name} 견적서`;
}
