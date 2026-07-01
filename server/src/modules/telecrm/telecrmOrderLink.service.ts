import { prisma } from '../../lib/prisma.js';

/** 접수에 연결된 발주서 공개 링크 (SMS `{발주서링크}` 치환용) */
export async function resolveTelecrmOrderFormLink(
  tenantId: string,
  inquiryId: string,
  origin: string,
): Promise<string | null> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: {
      orderForm: { select: { token: true } },
      tenant: { select: { slug: true } },
    },
  });
  const token = inquiry?.orderForm?.token;
  if (!token) return null;
  const base = origin.replace(/\/$/, '');
  const slug = inquiry.tenant.slug?.trim();
  const url = new URL(`${base}/order/${encodeURIComponent(token)}`);
  if (slug) url.searchParams.set('tenant', slug);
  return url.toString();
}
