/** 브랜드별 입금 안내 계좌. 응답 외의 로그에는 계좌번호를 넣지 않는다. */

import { Prisma, type PrismaClient } from '@prisma/client';
import { decideGuideAccountWrite, type GuideAccountFields } from './bankDepositGuide.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const PUBLIC_SELECT = {
  operatingCompanyId: true,
  bankName: true,
  accountNumber: true,
  accountHolder: true,
} satisfies Prisma.BankDepositGuideAccountSelect;

export async function listGuideAccounts(db: Db, tenantId: string) {
  const items = await db.bankDepositGuideAccount.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: PUBLIC_SELECT,
  });
  return { items };
}

export async function writeGuideAccount(
  db: Db,
  input: {
    tenantId: string;
    userId: string;
    isAdmin: boolean;
    operatingCompanyId: string;
    bankName: unknown;
    accountNumber: unknown;
    accountHolder: unknown;
  },
) {
  const brand = input.isAdmin
    ? await db.operatingCompany.findFirst({
        where: { id: input.operatingCompanyId, tenantId: input.tenantId },
        select: { id: true },
      })
    : null;
  const decision = decideGuideAccountWrite({
    isAdmin: input.isAdmin,
    brandInTenant: Boolean(brand),
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder,
  });
  if (!decision.ok) return decision;
  if (decision.action === 'delete') {
    await db.bankDepositGuideAccount.deleteMany({
      where: { tenantId: input.tenantId, operatingCompanyId: input.operatingCompanyId },
    });
    return { ok: true as const };
  }
  await saveGuideAccount(db, input.tenantId, input.operatingCompanyId, input.userId, decision.fields);
  return { ok: true as const };
}

async function saveGuideAccount(
  db: Db,
  tenantId: string,
  operatingCompanyId: string,
  userId: string,
  fields: GuideAccountFields,
) {
  await db.bankDepositGuideAccount.upsert({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    create: { tenantId, operatingCompanyId, updatedByUserId: userId, ...fields },
    update: { ...fields, updatedByUserId: userId },
  });
}

export async function guideAccountForInquiry(db: Db, tenantId: string, operatingCompanyId: string) {
  return db.bankDepositGuideAccount.findFirst({
    where: { tenantId, operatingCompanyId },
    select: { bankName: true, accountNumber: true, accountHolder: true },
  });
}
