import type { Inquiry } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/** PATCH body → Prisma update data (inquiries.routes 와 동일 조건) */
export function buildInquiryPatchData(body: Record<string, unknown>): Prisma.InquiryUpdateInput {
  const data: Prisma.InquiryUpdateInput = {};
  if (body.customerName != null) data.customerName = String(body.customerName);
  if (body.customerPhone != null) data.customerPhone = String(body.customerPhone);
  if (body.customerPhone2 != null) {
    data.customerPhone2 = body.customerPhone2 ? String(body.customerPhone2) : null;
  }
  if (body.address != null) data.address = String(body.address);
  if (body.addressDetail != null) {
    data.addressDetail = body.addressDetail ? String(body.addressDetail) : null;
  }
  if (body.areaPyeong != null) data.areaPyeong = Number(body.areaPyeong);
  if (body.areaBasis != null) data.areaBasis = body.areaBasis ? String(body.areaBasis) : null;
  if (body.propertyType != null) {
    data.propertyType = body.propertyType ? String(body.propertyType) : null;
  }
  if (body.roomCount !== undefined) {
    data.roomCount =
      body.roomCount === null || body.roomCount === '' ? null : Number(body.roomCount);
  }
  if (body.bathroomCount !== undefined) {
    data.bathroomCount =
      body.bathroomCount === null || body.bathroomCount === '' ? null : Number(body.bathroomCount);
  }
  if (body.balconyCount !== undefined) {
    data.balconyCount =
      body.balconyCount === null || body.balconyCount === '' ? null : Number(body.balconyCount);
  }
  if (body.preferredDate != null) {
    data.preferredDate = body.preferredDate ? new Date(body.preferredDate as string) : null;
  }
  if (body.preferredTime != null) {
    data.preferredTime = body.preferredTime ? String(body.preferredTime) : null;
  }
  if (body.betweenScheduleSlot !== undefined) {
    const v = body.betweenScheduleSlot;
    if (v === null || v === '') {
      data.betweenScheduleSlot = null;
    } else {
      const s = String(v);
      if (s === '오전' || s === '오후') {
        data.betweenScheduleSlot = s;
      }
    }
  }
  if (body.preferredTimeDetail != null) {
    data.preferredTimeDetail = body.preferredTimeDetail ? String(body.preferredTimeDetail) : null;
  }
  if (body.buildingType !== undefined) {
    data.buildingType = body.buildingType ? String(body.buildingType) : null;
  }
  if (body.moveInDate !== undefined) {
    data.moveInDate = body.moveInDate ? new Date(String(body.moveInDate)) : null;
  }
  if (body.specialNotes !== undefined) {
    data.specialNotes = body.specialNotes ? String(body.specialNotes) : null;
  }
  if (body.kitchenCount !== undefined) {
    data.kitchenCount =
      body.kitchenCount === null || body.kitchenCount === '' ? null : Number(body.kitchenCount);
  }
  if (body.serviceTotalAmount !== undefined) {
    data.serviceTotalAmount =
      body.serviceTotalAmount === null || body.serviceTotalAmount === ''
        ? null
        : Number(body.serviceTotalAmount);
  }
  if (body.serviceDepositAmount !== undefined) {
    data.serviceDepositAmount =
      body.serviceDepositAmount === null || body.serviceDepositAmount === ''
        ? null
        : Number(body.serviceDepositAmount);
  }
  if (body.serviceBalanceAmount !== undefined) {
    data.serviceBalanceAmount =
      body.serviceBalanceAmount === null || body.serviceBalanceAmount === ''
        ? null
        : Number(body.serviceBalanceAmount);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'externalTransferFee')) {
    const v = body.externalTransferFee;
    data.externalTransferFee =
      v === null || v === '' || v === undefined ? null : Number(v);
  }
  /** null·'' 모두 비우기 — `!= null`만 쓰면 JSON `scheduleMemo: null` 단독 PATCH가 data={}로 빠져 저장 안 됨 */
  if (Object.prototype.hasOwnProperty.call(body, 'memo')) {
    const v = body.memo;
    data.memo = v == null || v === '' ? null : String(v);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'scheduleMemo')) {
    const v = body.scheduleMemo;
    data.scheduleMemo = v == null || v === '' ? null : String(v);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'claimMemo')) {
    const v = body.claimMemo;
    data.claimMemo = v == null || v === '' ? null : String(v);
  }
  if (body.status != null) {
    data.status = body.status as
      | 'PENDING'
      | 'RECEIVED'
      | 'ASSIGNED'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'CS_PROCESSING';
  }
  if (body.crewMemberCount !== undefined) {
    if (body.crewMemberCount === null || body.crewMemberCount === '') {
      data.crewMemberCount = null;
    } else {
      const n = Number(body.crewMemberCount);
      data.crewMemberCount = Number.isFinite(n) ? Math.floor(n) : null;
    }
  }
  if (body.crewMemberNote !== undefined) {
    data.crewMemberNote = body.crewMemberNote ? String(body.crewMemberNote) : null;
  }
  return data;
}

function dateKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function formatInquiryDateKr(d: Date | null | undefined): string {
  if (!d) return '(없음)';
  const key = dateKey(d);
  if (!key) return '(없음)';
  const [y, m, day] = key.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
}

function formatWonKr(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '(없음)';
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

type AmountDateSnap = {
  preferredDate: Date | null;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
};

export function projectAfterPatch(inquiry: Inquiry, data: Prisma.InquiryUpdateInput): AmountDateSnap {
  return {
    preferredDate:
      data.preferredDate !== undefined
        ? (data.preferredDate as Date | null)
        : inquiry.preferredDate,
    serviceTotalAmount:
      data.serviceTotalAmount !== undefined
        ? (data.serviceTotalAmount as number | null)
        : inquiry.serviceTotalAmount,
    serviceDepositAmount:
      data.serviceDepositAmount !== undefined
        ? (data.serviceDepositAmount as number | null)
        : inquiry.serviceDepositAmount,
    serviceBalanceAmount:
      data.serviceBalanceAmount !== undefined
        ? (data.serviceBalanceAmount as number | null)
        : inquiry.serviceBalanceAmount,
  };
}

export function buildAmountDateChangeLines(before: AmountDateSnap, after: AmountDateSnap): string[] {
  const lines: string[] = [];
  if (dateKey(before.preferredDate) !== dateKey(after.preferredDate)) {
    lines.push(
      `청소 희망일: ${formatInquiryDateKr(before.preferredDate)} → ${formatInquiryDateKr(after.preferredDate)}`
    );
  }
  if (before.serviceTotalAmount !== after.serviceTotalAmount) {
    lines.push(`총액: ${formatWonKr(before.serviceTotalAmount)} → ${formatWonKr(after.serviceTotalAmount)}`);
  }
  if (before.serviceDepositAmount !== after.serviceDepositAmount) {
    lines.push(
      `예약금: ${formatWonKr(before.serviceDepositAmount)} → ${formatWonKr(after.serviceDepositAmount)}`
    );
  }
  if (before.serviceBalanceAmount !== after.serviceBalanceAmount) {
    lines.push(
      `잔금: ${formatWonKr(before.serviceBalanceAmount)} → ${formatWonKr(after.serviceBalanceAmount)}`
    );
  }
  return lines;
}
