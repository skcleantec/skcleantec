export function applyTelecrmScriptPlaceholders(
  body: string,
  ctx: { customerName?: string; pyeong?: string; estimate?: string },
): string {
  return body
    .replace(/\{고객명\}/g, ctx.customerName || '고객님')
    .replace(/\{평수\}/g, ctx.pyeong || '—')
    .replace(/\{예상가\}/g, ctx.estimate || '—');
}
