import type { ScheduleItem } from '../api/schedule';
import { formatDateCompactWithWeekday } from './dateFormat';
import { formatInquiryAreaKoShortFromEditStrings } from './inquiryAreaDisplay';
import {
  effectiveCustomerOrderNotes,
  effectiveTeamSharedAdminNotes,
} from './inquirySpecialNotesDisplay';

/** 접수 수정 폼에서 정보 복사·보기에 쓰는 필드 */
export type InquiryCopyEditForm = {
  customerName: string;
  nickname: string;
  customerPhone: string;
  customerPhone2: string;
  address: string;
  addressDetail: string;
  propertyType: string;
  isOneRoom: boolean;
  areaBasis: string;
  areaPyeong: string;
  exclusiveAreaSqm: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  kitchenCount: string;
  moveInDate: string;
  moveInDateUndecided: boolean;
  preferredDate: string;
  preferredTime: string;
  betweenScheduleSlot: string;
  preferredTimeDetail: string;
  amountTotal: string;
  amountDeposit: string;
  amountBalance: string;
  externalTransferFee: string;
  memo: string;
  specialNotes: string;
  consultationMemo: string;
};

export type InquiryCopyRow = { label: string; value: string };
export type InquiryCopySection = { title: string; rows: InquiryCopyRow[] };

function effectiveAmounts(item: ScheduleItem) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

function parseWonText(v: string): number | null {
  const stripped = v.replace(/,/g, '').trim();
  if (!stripped) return null;
  const n = Number.parseInt(stripped, 10);
  return Number.isFinite(n) ? n : null;
}

function formatWonText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `${n.toLocaleString('ko-KR')}원`;
}

/**
 * 접수 정보 복사·보기용 섹션 목록.
 * 빈 값 행은 제외하고, 행이 없는 섹션은 제외한다.
 */
export function buildInquiryCopySections(
  item: ScheduleItem,
  editForm: InquiryCopyEditForm,
  oneRoomLabel = '원룸',
): InquiryCopySection[] {
  const sections: InquiryCopySection[] = [];
  const pushSection = (title: string) => {
    sections.push({ title, rows: [] });
  };
  const addRow = (label: string, value: string | null | undefined) => {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return;
    const current = sections[sections.length - 1];
    if (!current) return;
    current.rows.push({ label, value: v });
  };

  pushSection('고객');
  addRow('고객명', editForm.customerName);
  addRow('닉네임', editForm.nickname);
  addRow('연락처', editForm.customerPhone);
  addRow('보조 연락처', editForm.customerPhone2);

  pushSection('주소');
  addRow('주소', editForm.address);
  addRow('상세주소', editForm.addressDetail);

  pushSection('현장');
  addRow('건축물', editForm.propertyType);
  if (editForm.isOneRoom) addRow(oneRoomLabel, '예');
  const areaCopy = formatInquiryAreaKoShortFromEditStrings({
    areaBasis: editForm.areaBasis,
    areaPyeong: editForm.areaPyeong,
    exclusiveAreaSqm: editForm.exclusiveAreaSqm,
  });
  if (areaCopy !== '—') addRow('면적', areaCopy);
  const structureParts: string[] = [];
  if (editForm.roomCount.trim()) structureParts.push(`방 ${editForm.roomCount}`);
  if (editForm.bathroomCount.trim()) structureParts.push(`화 ${editForm.bathroomCount}`);
  if (editForm.balconyCount.trim()) structureParts.push(`베 ${editForm.balconyCount}`);
  if (editForm.kitchenCount.trim()) structureParts.push(`주방 ${editForm.kitchenCount}`);
  if (structureParts.length > 0) addRow('구조', structureParts.join(' · '));
  addRow(
    '입주 예정일',
    editForm.moveInDateUndecided
      ? '미정'
      : editForm.moveInDate.trim()
        ? formatDateCompactWithWeekday(editForm.moveInDate)
        : '—',
  );

  pushSection('일정');
  if (editForm.preferredDate.trim()) {
    addRow('예약일', formatDateCompactWithWeekday(editForm.preferredDate));
  }
  if (editForm.preferredTime.trim()) {
    const slotSuffix = editForm.betweenScheduleSlot?.trim()
      ? ` (${editForm.betweenScheduleSlot})`
      : '';
    addRow('희망 시간', `${editForm.preferredTime}${slotSuffix}`);
  }
  addRow('구체 시각', editForm.preferredTimeDetail);

  pushSection('금액');
  const fallbackAmounts = effectiveAmounts(item);
  const totalAmount = parseWonText(editForm.amountTotal) ?? fallbackAmounts.total;
  const depositAmount = parseWonText(editForm.amountDeposit) ?? fallbackAmounts.deposit;
  const balanceAmount = parseWonText(editForm.amountBalance) ?? fallbackAmounts.balance;
  addRow('총액', formatWonText(totalAmount));
  addRow('예약금', formatWonText(depositAmount));
  addRow('잔금', formatWonText(balanceAmount));
  const hasExternalAssignment = item.assignments.some((a) => !!a.teamLeader.externalCompany);
  if (hasExternalAssignment) {
    const externalFee =
      parseWonText(editForm.externalTransferFee) ?? item.externalTransferFee ?? null;
    addRow('수수료', externalFee != null ? formatWonText(externalFee) : '미입력');
  }

  pushSection('비고');
  addRow(
    '고객 발주서 특이사항',
    effectiveCustomerOrderNotes({ specialNotes: item.specialNotes, orderForm: item.orderForm }),
  );
  addRow(
    '특이사항 (팀장·타업체 공유)',
    effectiveTeamSharedAdminNotes({
      memo: editForm.memo,
      specialNotes: editForm.specialNotes,
      orderForm: item.orderForm,
    }),
  );
  if (editForm.consultationMemo.trim()) {
    addRow('상담·마케터 메모', editForm.consultationMemo.trim());
  }

  return sections.filter((s) => s.rows.length > 0);
}

/** 타업체 공유용 접수 정보 텍스트 (클립보드) */
export function buildInquiryCopyText(
  item: ScheduleItem,
  editForm: InquiryCopyEditForm,
  oneRoomLabel = '원룸',
): string {
  const sectionBlocks = buildInquiryCopySections(item, editForm, oneRoomLabel)
    .map((s) => s.rows.map((r) => `· ${r.label}: ${r.value}`).join('\n'))
    .filter((block) => block.length > 0);

  const headerLines: string[] = ['━━━━━ 접수 정보 ━━━━━'];
  if (item.inquiryNumber?.trim()) {
    headerLines.push(`접수번호: ${item.inquiryNumber.trim()}`);
  }
  const header = headerLines.join('\n');
  const footer = '━━━━━━━━━━━━━━━━━━━';
  const body = sectionBlocks.join('\n\n');
  return body ? `${header}\n\n${body}\n${footer}` : `${header}\n${footer}`;
}
