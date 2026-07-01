import { createOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry } from '../../../api/inquiries';
import type { OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import { parseCrmIntakePyeong, validateCrmIntakeForm } from './crmIntakeValidation';

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
  preferredMoveInCleanYmd: string;
  address: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
};

export type CrmIntakeSubmitResult =
  | { kind: 'followup' }
  | { kind: 'inquiry'; inquiryId: string; status: string };

function inquiryExtras(pyeong: string, preferredMoveInCleanYmd: string) {
  const areaPyeong = parseCrmIntakePyeong(pyeong);
  const pmd = preferredMoveInCleanYmd.trim();
  return {
    ...(areaPyeong != null ? { areaPyeong } : {}),
    ...(pmd ? { preferredDate: pmd } : {}),
  };
}

export async function submitCrmIntake(
  token: string,
  values: CrmIntakeFormValues,
  pyeong: string,
): Promise<CrmIntakeSubmitResult> {
  const validationError = validateCrmIntakeForm(values, pyeong);
  if (validationError) throw new Error(validationError);

  const n = values.customerName.trim();
  const pmd = values.preferredMoveInCleanYmd.trim();
  const pmdBody = pmd ? { preferredMoveInCleaningDate: pmd } : {};
  const extras = inquiryExtras(pyeong, values.preferredMoveInCleanYmd);

  if (values.kind === 'requested' || values.kind === 'absent' || values.kind === 'hold') {
    const status: OrderFollowupStatus =
      values.kind === 'requested' ? 'REQUESTED' : values.kind === 'absent' ? 'ABSENT' : 'ON_HOLD';
    await createOrderFollowup(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: values.phone.trim(),
      status,
      memo: null,
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
      address: values.address.trim(),
      addressDetail: null,
      memo: null,
      source: '전화',
      status: 'RECEIVED',
      ...extras,
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
      memo: null,
      source: '전화',
    status: inqSt,
    ...extras,
  })) as { id: string };
  const fuSt: OrderFollowupStatus = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'RESERVED';
  await createOrderFollowup(token, {
    customerName: n,
    nickname: values.nickname.trim() || null,
    customerPhone: values.phone.trim(),
    status: fuSt,
    memo: null,
    goldDb: values.goldDb,
    inquiryId: created.id,
    ...pmdBody,
  });
  return { kind: 'inquiry', inquiryId: created.id, status: inqSt };
}
