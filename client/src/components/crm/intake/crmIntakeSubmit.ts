import { createOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry } from '../../../api/inquiries';
import type { OrderFollowupStatus } from '../../../constants/orderFollowupStatus';

export type CrmIntakeKind =
  | 'requested'
  | 'absent'
  | 'hold'
  | 'deposit'
  | 'reserved'
  | 'received';

export type CrmIntakeFormValues = {
  customerName: string;
  nickname: string;
  phone: string;
  memo: string;
  preferredMoveInCleanYmd: string;
  address: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
};

export type CrmIntakeSubmitResult =
  | { kind: 'followup' }
  | { kind: 'inquiry'; inquiryId: string; status: string };

export async function submitCrmIntake(
  token: string,
  values: CrmIntakeFormValues,
): Promise<CrmIntakeSubmitResult> {
  const n = values.customerName.trim();
  if (!n) throw new Error('고객명을 입력해 주세요.');

  const pmd = values.preferredMoveInCleanYmd.trim();
  const pmdBody = pmd ? { preferredMoveInCleaningDate: pmd } : {};

  if (values.kind === 'requested' || values.kind === 'absent' || values.kind === 'hold') {
    const status: OrderFollowupStatus =
      values.kind === 'requested' ? 'REQUESTED' : values.kind === 'absent' ? 'ABSENT' : 'ON_HOLD';
    await createOrderFollowup(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: values.phone.trim(),
      status,
      memo: values.memo.trim() || null,
      goldDb: values.goldDb,
      ...pmdBody,
    });
    return { kind: 'followup' };
  }

  if (values.kind === 'received') {
    const created = (await createInquiry(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: values.phone.trim() || '',
      address: values.address.trim() || '',
      addressDetail: null,
      memo: values.memo.trim() || null,
      source: '전화',
      status: 'RECEIVED',
    })) as { id: string };
    return { kind: 'inquiry', inquiryId: created.id, status: 'RECEIVED' };
  }

  const inqSt = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
  const created = (await createInquiry(token, {
    customerName: n,
    nickname: values.nickname.trim() || null,
    customerPhone: values.phone.trim() || '',
    address: values.address.trim() || '',
    addressDetail: null,
    memo: values.memo.trim() || null,
    source: '전화',
    status: inqSt,
  })) as { id: string };
  const fuSt: OrderFollowupStatus = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'RESERVED';
  await createOrderFollowup(token, {
    customerName: n,
    nickname: values.nickname.trim() || null,
    customerPhone: values.phone.trim(),
    status: fuSt,
    memo: values.memo.trim() || null,
    goldDb: values.goldDb,
    inquiryId: created.id,
    ...pmdBody,
  });
  return { kind: 'inquiry', inquiryId: created.id, status: inqSt };
}
