export type TelecrmSmsPlaceholderCtx = {
  customerName?: string;
  phone?: string;
  pyeong?: string;
  estimate?: string;
  orderLink?: string | null;
};

/** `{고객명}` `{연락처}` `{평수}` `{예상가}` `{발주서링크}` 치환 */
export function applyTelecrmSmsPlaceholders(body: string, ctx: TelecrmSmsPlaceholderCtx): string {
  return body
    .replace(/\{고객명\}/g, ctx.customerName?.trim() || '고객님')
    .replace(/\{연락처\}/g, ctx.phone?.trim() || '—')
    .replace(/\{평수\}/g, ctx.pyeong?.trim() || '—')
    .replace(/\{예상가\}/g, ctx.estimate?.trim() || '—')
    .replace(/\{발주서링크\}/g, ctx.orderLink?.trim() || '(발주서 링크 없음)');
}
