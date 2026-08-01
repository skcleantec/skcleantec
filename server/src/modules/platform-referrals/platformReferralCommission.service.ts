import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { kstYmdFromDate } from '../billing/tenantBilling.dates.js';

function parseEligiblePlanIds(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  return ids.length ? ids : null;
}

function isPlanEligible(plan: string, eligiblePlanIds: unknown): boolean {
  const allowed = parseEligiblePlanIds(eligiblePlanIds);
  if (!allowed) return plan !== 'free';
  return allowed.includes(plan.trim().toLowerCase());
}

export function computeReferrerCommissionAmount(amountKrw: number, rateBps: number): number {
  if (amountKrw <= 0 || rateBps <= 0) return 0;
  return Math.floor((amountKrw * rateBps) / 10_000);
}

export async function createReferrerCommissionAccrualForInvoice(
  invoiceId: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;

  const invoice = await db.tenantInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      tenantId: true,
      plan: true,
      amountKrw: true,
      periodStart: true,
      status: true,
    },
  });
  if (!invoice || invoice.status !== 'PAID') return null;
  if (invoice.amountKrw <= 0) return null;

  const attribution = await db.tenantReferralAttribution.findUnique({
    where: { tenantId: invoice.tenantId },
    select: {
      id: true,
      referrerId: true,
      referrer: {
        select: {
          id: true,
          status: true,
          commissionRateBps: true,
          eligiblePlanIds: true,
        },
      },
    },
  });
  if (!attribution?.referrer || attribution.referrer.status !== 'ACTIVE') return null;
  if (!isPlanEligible(invoice.plan, attribution.referrer.eligiblePlanIds)) return null;

  const commissionRateBps = attribution.referrer.commissionRateBps;
  const commissionAmount = computeReferrerCommissionAmount(invoice.amountKrw, commissionRateBps);
  if (commissionAmount <= 0) return null;

  const periodYm = kstYmdFromDate(invoice.periodStart).slice(0, 7);

  try {
    return await db.platformReferrerCommissionAccrual.create({
      data: {
        referrerId: attribution.referrerId,
        tenantId: invoice.tenantId,
        attributionId: attribution.id,
        invoiceId: invoice.id,
        periodYm,
        invoicePaidAmount: invoice.amountKrw,
        commissionRateBps,
        commissionAmount,
        status: 'PENDING',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint failed/i.test(msg)) return null;
    throw e;
  }
}
