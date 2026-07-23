import { createOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry } from '../../../api/inquiries';
import { finalizeTelecrmConsultationQuote } from '../../../api/telecrmConsultationQuote';
import type { OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import {
  telecrmQuotePayloadHasContent,
  type TelecrmConsultationQuotePayload,
} from '@shared/telecrmConsultationQuote';
import { parseCrmRoomCountInput } from '../../../utils/crmSoomgoImport';
import {
  resolveCrmOutboundPhone,
  resolveCrmStoredPhones,
} from '../../../utils/crmContactPhone';
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
  contactPhone: string;
  safePhone: string;
  contactUnknown: boolean;
  requestMemo: string;
  preferredMoveInCleanYmd: string;
  address: string;
  roomCount: string;
  bathroomCount: string;
  balconyCount: string;
  kind: CrmIntakeKind;
  goldDb: boolean;
  /** 유입 플랫폼 — 카탈로그 label, 저장 전 필수(브릿지 extract 시 자동) */
  leadSource: string;
  /** 텔레CRM 정보 갖고오기 출처(변경 이력용) */
  extractPlatform?: 'miso' | 'soomgo';
};

export type CrmIntakeSubmitResult = {
  intakeKind: CrmIntakeKind;
  customerName: string;
  nickname: string;
} & (
  | { kind: 'followup' }
  | { kind: 'inquiry'; inquiryId: string; status: string }
);

function submitMeta(values: CrmIntakeFormValues): Pick<CrmIntakeSubmitResult, 'intakeKind' | 'customerName' | 'nickname'> {
  return {
    intakeKind: values.kind,
    customerName: resolveCrmIntakeCustomerName(values),
    nickname: values.nickname.trim(),
  };
}

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
  const stored = resolveCrmStoredPhones(values.contactPhone, values.safePhone);
  const outbound = resolveCrmOutboundPhone(values.contactPhone, values.safePhone);
  const followupMemo = values.requestMemo.trim() || null;
  const intakeMeta = {
    channel: 'telecrm' as const,
    ...(values.extractPlatform ? { extractPlatform: values.extractPlatform } : {}),
  };
  const inquiryCreateBody = {
    strictLeadSource: true,
    intakeMeta,
    source: values.leadSource.trim(),
  };

  if (values.kind === 'requested' || values.kind === 'absent' || values.kind === 'hold') {
    const status: OrderFollowupStatus =
      values.kind === 'requested' ? 'REQUESTED' : values.kind === 'absent' ? 'ABSENT' : 'ON_HOLD';
    const quotePayload = opts.quotePayload;
    if (
      (values.kind === 'absent' || values.kind === 'hold') &&
      quotePayload &&
      telecrmQuotePayloadHasContent(quotePayload) &&
      !values.contactUnknown &&
      outbound.replace(/\D/g, '').length >= 4
    ) {
      await finalizeTelecrmConsultationQuote(
        token,
        {
          phone: outbound,
          payload: quotePayload,
          customerName: n,
          nickname: values.nickname.trim() || null,
          goldDb: values.goldDb,
          ...(pmd ? { preferredMoveInCleaningDate: pmd } : {}),
          followupStatus: status as 'ABSENT' | 'ON_HOLD',
          extraMemo: followupMemo,
          leadSource: values.leadSource.trim(),
          strictLeadSource: true,
        },
        operatingCompanyId,
      );
      return { kind: 'followup', ...submitMeta(values) };
    }
    await createOrderFollowup(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: stored.customerPhone,
      customerPhone2: stored.customerPhone2,
      status,
      memo: followupMemo,
      goldDb: values.goldDb,
      leadSource: values.leadSource.trim(),
      strictLeadSource: true,
      ...pmdBody,
      ...brandBody,
    });
    return { kind: 'followup', ...submitMeta(values) };
  }

  if (values.kind === 'received') {
    const created = (await createInquiry(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: stored.customerPhone,
      customerPhone2: stored.customerPhone2,
      address: values.address.trim(),
      addressDetail: null,
      memo: followupMemo,
      status: 'RECEIVED',
      ...inquiryCreateBody,
      ...extras,
      ...brandBody,
    })) as { id: string };
    return { kind: 'inquiry', inquiryId: created.id, status: 'RECEIVED', ...submitMeta(values) };
  }

  const inqSt = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
  const created = (await createInquiry(token, {
    customerName: n,
    nickname: values.nickname.trim() || null,
    customerPhone: stored.customerPhone,
    customerPhone2: stored.customerPhone2,
    address: values.address.trim() || '',
    addressDetail: null,
    memo: followupMemo,
    status: inqSt,
    ...inquiryCreateBody,
    ...extras,
    ...brandBody,
  })) as { id: string };
  const fuSt: OrderFollowupStatus = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'RESERVED';
  await createOrderFollowup(token, {
    customerName: n,
    nickname: values.nickname.trim() || null,
    customerPhone: stored.customerPhone,
    customerPhone2: stored.customerPhone2,
    status: fuSt,
    memo: followupMemo,
    goldDb: values.goldDb,
    inquiryId: created.id,
    leadSource: values.leadSource.trim(),
    strictLeadSource: true,
    ...pmdBody,
    ...brandBody,
  });
  return { kind: 'inquiry', inquiryId: created.id, status: inqSt, ...submitMeta(values) };
}
