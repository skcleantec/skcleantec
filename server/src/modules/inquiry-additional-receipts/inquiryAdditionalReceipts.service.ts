import type { AdditionalReceiptSettlementChannel } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notifyExtraChargeChanged } from '../inquiry-extra-charges/inquiryExtraCharges.service.js';

export interface AdditionalReceiptInput {
  description: string;
  amount: number;
  sortOrder?: number | null;
}

export interface SerializedAdditionalReceipt {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  settlementChannel: AdditionalReceiptSettlementChannel;
  sortOrder: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** 추가결재는 원화 양의 정수만 허용 (일반 서비스 금액과 별도 정산). */
export function validateAdditionalReceiptInput(input: AdditionalReceiptInput): string | null {
  const description = String(input.description ?? '').trim();
  if (!description) return '항목명을 입력해주세요.';
  if (description.length > 120) return '항목명은 120자 이하여야 합니다.';
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return '금액은 정수로 입력해주세요.';
  }
  if (amount < 1) return '추가결재 금액은 1원 이상이어야 합니다.';
  if (amount > 100_000_000) return '금액이 범위를 벗어났습니다.';
  return null;
}

export function normalizeSettlementChannel(raw: unknown): AdditionalReceiptSettlementChannel | null {
  const s = String(raw ?? '').trim();
  if (s === 'FIELD_RECEIVED') return 'FIELD_RECEIVED';
  if (s === 'COMPANY_DEPOSIT') return 'COMPANY_DEPOSIT';
  return null;
}

/** 팀장 저장 시 필수(`required: true`). 관리자 생성 시 생략 가능하면 `required: false`. */
export function validateSettlementChannelInput(
  raw: unknown,
  opts: { required: boolean },
): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return opts.required ? '현장결재 또는 회사입금 중 하나를 선택해 주세요.' : null;
  }
  const n = normalizeSettlementChannel(raw);
  if (!n) return '결재 방식 값이 올바르지 않습니다.';
  return null;
}

export async function listAdditionalReceipts(inquiryId: string): Promise<SerializedAdditionalReceipt[]> {
  const rows = await prisma.inquiryAdditionalReceipt.findMany({
    where: { inquiryId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return rows.map(serializeAdditionalReceipt);
}

export function serializeAdditionalReceipt(row: {
  id: string;
  inquiryId: string;
  description: string;
  amount: number;
  settlementChannel: AdditionalReceiptSettlementChannel;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string } | null;
}): SerializedAdditionalReceipt {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    description: row.description,
    amount: row.amount,
    settlementChannel: row.settlementChannel,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 담당 팀장 실시간 갱신 — 기존 extra-charges와 동일 신호 */
export async function notifyAdditionalReceiptChanged(inquiryId: string): Promise<void> {
  await notifyExtraChargeChanged(inquiryId);
}
