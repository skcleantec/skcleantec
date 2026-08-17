import { createOrderFollowup, deferOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry } from '../../../api/inquiries';
import { finalizeTelecrmConsultationQuote } from '../../../api/telecrmConsultationQuote';
import type { OrderFollowupStatus } from '../../../constants/orderFollowupStatus';
import {
  telecrmQuotePayloadHasContent,
  type TelecrmConsultationQuotePayload,
} from '@shared/telecrmConsultationQuote';
import { parseCrmRoomCountInput, parseCrmRoomCountOrNull } from '../../../utils/crmSoomgoImport';
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
  | { kind: 'followup'; followupId?: string; deferIncremented?: boolean }
  | { kind: 'inquiry'; inquiryId: string; status: string }
);

const CRM_INTAKE_FOLLOWUP_DEFER_KINDS = new Set<CrmIntakeKind>(['requested', 'absent', 'hold']);

export { CRM_INTAKE_FOLLOWUP_DEFER_KINDS };

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

function followupIntakeExtras(values: CrmIntakeFormValues, pyeong: string) {
  const pmd = values.preferredMoveInCleanYmd.trim();
  return {
    preferredMoveInCleaningDate: pmd || null,
    address: values.address.trim() || null,
    areaPyeong: parseCrmIntakePyeong(pyeong),
    roomCount: parseCrmRoomCountOrNull(values.roomCount),
    bathroomCount: parseCrmRoomCountOrNull(values.bathroomCount),
    balconyCount: parseCrmRoomCountOrNull(values.balconyCount),
  };
}

export async function submitCrmIntake(
  token: string,
  values: CrmIntakeFormValues,
  pyeong: string,
  opts: {
    operatingCompanyId: string;
    quotePayload?: TelecrmConsultationQuotePayload | null;
    /** 저장 후 부재 횟수 +1 (`POST …/defer`) */
    incrementDefer?: boolean;
  },
): Promise<CrmIntakeSubmitResult> {
  if (opts.incrementDefer && !CRM_INTAKE_FOLLOWUP_DEFER_KINDS.has(values.kind)) {
    throw new Error('부재+1은 요청·부재·보류 처리 구분에서만 사용할 수 있습니다.');
  }

  const validationError = validateCrmIntakeForm(values, pyeong);
  if (validationError) throw new Error(validationError);

  const operatingCompanyId = opts.operatingCompanyId?.trim();
  if (!operatingCompanyId) throw new Error('작업 브랜드가 선택되지 않았습니다.');

  const n = resolveCrmIntakeCustomerName(values);
  const followupMemo = values.requestMemo.trim() || null;
  const followupExtras = followupIntakeExtras(values, pyeong);
  const extras = inquiryExtras(pyeong, values.preferredMoveInCleanYmd, values);
  const brandBody = { operatingCompanyId };
  const stored = resolveCrmStoredPhones(values.contactPhone, values.safePhone);
  const outbound = resolveCrmOutboundPhone(values.contactPhone, values.safePhone);
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
      const finalized = await finalizeTelecrmConsultationQuote(
        token,
        {
          phone: outbound,
          payload: quotePayload,
          customerName: n,
          nickname: values.nickname.trim() || null,
          goldDb: values.goldDb,
          followupStatus: status as 'ABSENT' | 'ON_HOLD',
          extraMemo: followupMemo,
          leadSource: values.leadSource.trim(),
          strictLeadSource: true,
          ...followupExtras,
        },
        operatingCompanyId,
      );
      const followupId = finalized.followupId;
      if (opts.incrementDefer) {
        await deferOrderFollowup(token, followupId);
      }
      return {
        kind: 'followup',
        followupId,
        deferIncremented: Boolean(opts.incrementDefer),
        ...submitMeta(values),
      };
    }
    const created = await createOrderFollowup(token, {
      customerName: n,
      nickname: values.nickname.trim() || null,
      customerPhone: stored.customerPhone,
      customerPhone2: stored.customerPhone2,
      status,
      memo: followupMemo,
      goldDb: values.goldDb,
      leadSource: values.leadSource.trim(),
      strictLeadSource: true,
      ...followupExtras,
      ...brandBody,
    });
    const followupId = created.item.id;
    if (opts.incrementDefer) {
      await deferOrderFollowup(token, followupId);
    }
    return {
      kind: 'followup',
      followupId,
      deferIncremented: Boolean(opts.incrementDefer),
      ...submitMeta(values),
    };
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
    ...followupExtras,
    ...brandBody,
  });
  return { kind: 'inquiry', inquiryId: created.id, status: inqSt, ...submitMeta(values) };
}
