import { createOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry } from '../../../api/inquiries';
import { finalizeTelecrmConsultationQuote } from '../../../api/telecrmConsultationQuote';
import type { OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import {
  telecrmQuotePayloadHasContent,
  type TelecrmConsultationQuotePayload,
} from '@shared/telecrmConsultationQuote';
import { parseCrmRoomCountInput } from '../../../utils/crmSoomgoImport';
import { parseCrmIntakePyeong, resolveCrmIntakeCustomerName, validateCrmIntakeForm } from './crmIntakeValidation';

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
  phoneUnknown: boolean;
  preferredMoveInCleanYmd: string;
  address: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
};

export type CrmIntakeSubmitResult =
  | { kind: 'followup' }
  | { kind: 'inquiry'; inquiryId: string; status: string };

function inquiryExtras(
  pyeong: string,
  preferredMoveInCleanYmd: string,
  structure: Pick<CrmIntakeFormValues, 'roomCount' | 'bathroomCount' | 'balconyCount'>,
) {
  const areaPyeong = parseCrmIntakePyeong(pyeong);
  const pmd = preferredMoveInCleanYmd.trim();
  const roomCount = parseCrmRoomCountInput(structure.roomCount);
  const bathroomCount = parseCrmRoomCountInput(structure.bathroomCount);
  const balconyCount = parseCrmRoomCountInput(structure.balconyCount);
  return {
    ...(areaPyeong != null ? { areaPyeong } : {}),
    ...(pmd ? { preferredDate: pmd } : {}),
    ...(roomCount != null ? { roomCount } : {}),
    ...(bathroomCount != null ? { bathroomCount } : {}),
    ...(balconyCount != null ? { balconyCount } : {}),
  };
}

export async function submitCrmIntake(
  token: string,
  values: CrmIntakeFormValues,
  pyeong: string,
  opts: {
    operatingCompanyId: string;
    quotePayload?: TelecrmConsultationQuotePayload | null;
  },
): Promise<CrmIntakeSubmitResult> {
  const validationError = validateCrmIntakeForm(values, pyeong);
  if (validationError) throw new Error(validationError);

  const operatingCompanyId = opts.operatingCompanyId?.trim();
  if (!operatingCompanyId) throw new Error('작업 브랜드가 선택되지 않았습니다.');

  const n = resolveCrmIntakeCustomerName(values);
  const pmd = values.preferredMoveInCleanYmd.trim();
  const pmdBody = pmd ? { preferredMoveInCleaningDate: pmd } : {};
  const extras = inquiryExtras(pyeong, values.preferredMoveInCleanYmd, values);
  const brandBody = { operatingCompanyId };

  if (values.kind === 'requested' || values.kind === 'absent' || values.kind === 'hold') {
    const status: OrderFollowupStatus =
      values.kind === 'requested' ? 'REQUESTED' : values.kind === 'absent' ? 'ABSENT' : 'ON_HOLD';
    const quotePayload = opts.quotePayload;
    if (
      (values.kind === 'absent' || values.kind === 'hold') &&
      quotePayload &&
      telecrmQuotePayloadHasContent(quotePayload) &&
      !values.phoneUnknown &&
      values.phone.trim().replace(/\D/g, '').length >= 4
    ) {
      await finalizeTelecrmConsultationQuote(
        token,
        {
          phone: values.phone.trim(),
          payload: quotePayload,
          customerName: n,
          nickname: values.nickname.trim() || null,
          goldDb: values.goldDb,
          ...(pmd ? { preferredMoveInCleaningDate: pmd } : {}),
          followupStatus: status as 'ABSENT' | 'ON_HOLD',
        },
        operatingCompanyId,
      );
      return { kind: 'followup' };
    }
    await createOrderFollowup(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: values.phone.trim(),
      status,
      memo: null,
      goldDb: values.goldDb,
      ...pmdBody,
      ...brandBody,
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
      ...brandBody,
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
    ...brandBody,
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
    ...brandBody,
  });
  return { kind: 'inquiry', inquiryId: created.id, status: inqSt };
}
