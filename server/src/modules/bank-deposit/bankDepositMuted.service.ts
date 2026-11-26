import { Prisma, type PrismaClient } from '@prisma/client';
import {
  mutedNote,
  pickMutedRule,
  validateMutedInput,
  type MutedInput,
} from './bankDepositMuted.logic.js';

type Db = PrismaClient | Prisma.TransactionClient;

const select = {
  id: true,
  operatingCompanyId: true,
  operatingCompany: { select: { name: true } },
  nameNorm: true,
  displayName: true,
  kind: true,
  matchMode: true,
  enabled: true,
  memo: true,
  matchCount: true,
  lastMatchedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BankDepositMutedDepositorSelect;

type Row = Prisma.BankDepositMutedDepositorGetPayload<{ select: typeof select }>;

function toItem(row: Row) {
  return {
    id: row.id,
    operatingCompanyId: row.operatingCompanyId,
    operatingCompanyName: row.operatingCompany?.name?.trim() || null,
    depositorName: row.nameNorm,
    displayName: row.displayName,
    kind: row.kind,
    matchMode: row.matchMode,
    enabled: row.enabled,
    memo: row.memo,
    matchCount: row.matchCount,
    lastMatchedAt: row.lastMatchedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
export type BankDepositMutedItem = ReturnType<typeof toItem>;

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function listMutedDepositors(db: Db, tenantId: string): Promise<BankDepositMutedItem[]> {
  const rows = await db.bankDepositMutedDepositor.findMany({
    where: { tenantId },
    orderBy: [{ enabled: 'desc' }, { lastMatchedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select,
  });
  return rows.map(toItem);
}

export async function createMutedDepositor(
  db: Db,
  tenantId: string,
  userId: string | null,
  input: MutedInput,
): Promise<{ ok: true; item: BankDepositMutedItem } | { ok: false; status: number; error: string }> {
  const checked = validateMutedInput(input);
  if (!checked.ok) return { ok: false, status: 400, error: checked.error };
  const v = checked.value;
  if (v.operatingCompanyId) {
    const brand = await db.operatingCompany.findFirst({ where: { id: v.operatingCompanyId, tenantId }, select: { id: true } });
    if (!brand) return { ok: false, status: 400, error: '브랜드를 찾을 수 없어요.' };
  }
  try {
    const row = await db.bankDepositMutedDepositor.create({
      data: { tenantId, createdByUserId: userId, ...v },
      select,
    });
    return { ok: true, item: toItem(row) };
  } catch (error) {
    if (isUniqueConflict(error)) return { ok: false, status: 409, error: '이미 등록된 입금자명이에요.' };
    throw error;
  }
}

export async function updateMutedDepositor(
  db: Db,
  tenantId: string,
  id: string,
  patch: Partial<MutedInput>,
): Promise<{ ok: true; item: BankDepositMutedItem } | { ok: false; status: number; error: string }> {
  const current = await db.bankDepositMutedDepositor.findFirst({ where: { id, tenantId }, select });
  if (!current) return { ok: false, status: 404, error: '없는 항목이에요.' };
  const checked = validateMutedInput({
    depositorName: patch.depositorName ?? current.nameNorm,
    displayName: patch.displayName ?? current.displayName,
    kind: patch.kind ?? current.kind,
    matchMode: patch.matchMode ?? current.matchMode,
    operatingCompanyId: patch.operatingCompanyId === undefined ? current.operatingCompanyId : patch.operatingCompanyId,
    memo: patch.memo === undefined ? current.memo : patch.memo,
    enabled: patch.enabled ?? current.enabled,
  });
  if (!checked.ok) return { ok: false, status: 400, error: checked.error };
  const v = checked.value;
  if (v.operatingCompanyId && v.operatingCompanyId !== current.operatingCompanyId) {
    const brand = await db.operatingCompany.findFirst({ where: { id: v.operatingCompanyId, tenantId }, select: { id: true } });
    if (!brand) return { ok: false, status: 400, error: '브랜드를 찾을 수 없어요.' };
  }
  try {
    const updated = await db.bankDepositMutedDepositor.update({ where: { id }, data: v, select });
    return { ok: true, item: toItem(updated) };
  } catch (error) {
    if (isUniqueConflict(error)) return { ok: false, status: 409, error: '이미 등록된 입금자명이에요.' };
    throw error;
  }
}

export async function deleteMutedDepositor(db: Db, tenantId: string, id: string): Promise<boolean> {
  const deleted = await db.bankDepositMutedDepositor.deleteMany({ where: { id, tenantId } });
  return deleted.count === 1;
}

/** 들어온 입금이 고정 입금처에 해당하면 그 규칙을 돌려준다. */
export async function findMutedRuleFor(
  db: Db,
  tenantId: string,
  depositorName: string,
  operatingCompanyId: string | null,
): Promise<{ id: string; displayName: string; note: string } | null> {
  const rules = await db.bankDepositMutedDepositor.findMany({
    where: { tenantId, enabled: true },
    select: { id: true, operatingCompanyId: true, nameNorm: true, displayName: true, matchMode: true, enabled: true },
  });
  const rule = pickMutedRule(rules, depositorName, operatingCompanyId);
  return rule ? { id: rule.id, displayName: rule.displayName, note: mutedNote(rule.displayName) } : null;
}

export async function touchMutedRule(db: Db, tenantId: string, id: string, now: Date): Promise<void> {
  await db.bankDepositMutedDepositor.updateMany({
    where: { id, tenantId },
    data: { matchCount: { increment: 1 }, lastMatchedAt: now },
  });
}

/** 같은 입금자명으로 이미 들어와 아직 처리 안 된(NEEDS_REVIEW) 입금을 함께 접는다. */
export async function ignorePastDepositsOfMuted(
  db: Db,
  tenantId: string,
  ruleId: string,
  now: Date,
): Promise<string[]> {
  const rule = await db.bankDepositMutedDepositor.findFirst({
    where: { id: ruleId, tenantId },
    select: { id: true, operatingCompanyId: true, nameNorm: true, displayName: true, matchMode: true, enabled: true },
  });
  if (!rule) return [];
  const open = await db.bankDeposit.findMany({
    where: { tenantId, status: 'NEEDS_REVIEW', ...(rule.operatingCompanyId ? { operatingCompanyId: rule.operatingCompanyId } : {}) },
    select: { id: true, depositorName: true, operatingCompanyId: true },
  });
  const hit = open.filter((row) => pickMutedRule([rule], row.depositorName, row.operatingCompanyId));
  if (hit.length === 0) return [];
  await db.bankDeposit.updateMany({
    where: { tenantId, id: { in: hit.map((row) => row.id) }, status: 'NEEDS_REVIEW' },
    data: { status: 'IGNORED', note: mutedNote(rule.displayName), openReminderStoppedAt: now },
  });
  await db.bankDepositMutedDepositor.updateMany({
    where: { id: rule.id, tenantId },
    data: { matchCount: { increment: hit.length }, lastMatchedAt: now },
  });
  return hit.map((row) => row.id);
}
