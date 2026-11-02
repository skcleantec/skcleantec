import { createOrderFollowup, deferOrderFollowup } from '../../../api/orderFollowups';
import { createInquiry, updateInquiry } from '../../../api/inquiries';
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
  /** 건축물 유형 — 발주서 선택지 저장값 */
  propertyType?: string;
  /** 건물 형태(신축·구축 등) — 발주서 선택지 저장값 */
  buildingType?: string;
  isOneRoom?: boolean;
  kind: CrmIntakeKind;
  goldDb: boolean;
  /** 유입 플랫폼 — 카탈로그 label, 저장 전 필수(브릿지 extract 시 자동) */
  leadSource: string;
  /** 협업 마케터(선택) */
  collaborationMarketerId?: string;
  /** 텔레CRM 정보 갖고오기 출처(변경 이력용) */
  extractPlatform?: 'miso' | 'soomgo';
};

export type CrmIntakeSubmitResult = {
  intakeKind: CrmIntakeKind;
  customerName: string;
  nickname: string;
} & (
  | { kind: 'followup'; followupId?: string; deferIncremented?: boolean }
  | {
      kind: 'inquiry';
      inquiryId: string;
      status: string;
      /** 기존 접수에 이어서 저장 — merged: 상태까지 반영, appended: 더 진행된 접수라 내용만 추가 */
      continued?: 'merged' | 'appended';
    }
);

/** 기존 고객 모드에서 이어서 저장할 접수(취소·완료 제외) */
export type CrmIntakeExistingInquiry = {
  id: string;
  status: string;
  memo?: string | null;
  source?: string | null;
};

/** 접수 진행 단계 — 높을수록 더 진행됨(보류·대기는 처음 단계로 봄) */
const INQUIRY_STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  ON_HOLD: 0,
  RECEIVED: 1,
  DEPOSIT_PENDING: 2,
  DEPOSIT_COMPLETED: 3,
  ORDER_FORM_PENDING: 4,
  ASSIGNED: 5,
  IN_PROGRESS: 6,
  CS_PROCESSING: 7,
  COMPLETED: 8,
};

const CRM_INTAKE_CONTINUABLE_BLOCKED = new Set(['CANCELLED', 'COMPLETED']);

export function isCrmIntakeContinuableInquiryStatus(status: string | null | undefined): boolean {
  const st = String(status ?? '').trim();
  return Boolean(st) && !CRM_INTAKE_CONTINUABLE_BLOCKED.has(st);
}

/** 기존 메모 뒤에 새 내용만 덧붙임(이미 있는 줄은 건너뜀) */
export function appendCrmIntakeMemo(existing: string | null | undefined, addition: string | null | undefined): string | null {
  const base = String(existing ?? '').trim();
  const add = String(addition ?? '').trim();
  if (!add) return base || null;
  if (!base) return add;
  if (base.includes(add)) return base;
  const baseLines = new Set(
    base
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const newLines = add
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !baseLines.has(l));
  if (newLines.length === 0) return base;
  return `${base}\n${newLines.join('\n')}`;
}

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
  structure: Pick<
    CrmIntakeFormValues,
    'roomCount' | 'bathroomCount' | 'balconyCount' | 'propertyType' | 'buildingType' | 'isOneRoom'
  >,
) {
  const areaPyeong = parseCrmIntakePyeong(pyeong);
  const pmd = preferredMoveInCleanYmd.trim();
  const roomCount = parseCrmRoomCountInput(structure.roomCount);
  const bathroomCount = parseCrmRoomCountInput(structure.bathroomCount);
  const balconyCount = parseCrmRoomCountInput(structure.balconyCount);
  const propertyType = structure.propertyType?.trim() ?? '';
  const buildingType = structure.buildingType?.trim() ?? '';
  return {
    ...(areaPyeong != null ? { areaPyeong } : {}),
    ...(pmd ? { preferredDate: pmd } : {}),
    ...(roomCount != null ? { roomCount } : {}),
    ...(bathroomCount != null ? { bathroomCount } : {}),
    ...(balconyCount != null ? { balconyCount } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(buildingType ? { buildingType } : {}),
    ...(structure.isOneRoom ? { isOneRoom: true } : {}),
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
    /** 기존 고객 — 진행 중 접수가 있으면 새로 만들지 않고 이어서 저장 */
    existingInquiry?: CrmIntakeExistingInquiry | null;
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
    ...(values.collaborationMarketerId?.trim()
      ? { collaborationMarketerId: values.collaborationMarketerId.trim() }
      : {}),
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
          ...(stored.customerPhone2 ? { customerPhone2: stored.customerPhone2 } : {}),
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

  const existing =
    opts.existingInquiry?.id?.trim() && isCrmIntakeContinuableInquiryStatus(opts.existingInquiry.status)
      ? opts.existingInquiry
      : null;
  if (existing) {
    const targetStatus =
      values.kind === 'received' ? 'RECEIVED' : values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'DEPOSIT_COMPLETED';
    const currentRank = INQUIRY_STATUS_RANK[existing.status] ?? 0;
    const targetRank = INQUIRY_STATUS_RANK[targetStatus] ?? 0;
    const upgrade = targetRank > currentRank;
    const mergedMemo = appendCrmIntakeMemo(existing.memo, followupMemo);
    const address = values.address.trim();
    const patch: Record<string, unknown> = {
      customerName: n,
      ...(values.nickname.trim() ? { nickname: values.nickname.trim() } : {}),
      ...(stored.customerPhone ? { customerPhone: stored.customerPhone } : {}),
      ...(stored.customerPhone2 ? { customerPhone2: stored.customerPhone2 } : {}),
      ...(address ? { address } : {}),
      ...(mergedMemo != null && mergedMemo !== (existing.memo ?? '').trim() ? { memo: mergedMemo } : {}),
      ...extras,
      ...(!existing.source?.trim() && values.leadSource.trim() ? { source: values.leadSource.trim() } : {}),
      ...(upgrade ? { status: targetStatus } : {}),
    };
    await updateInquiry(token, existing.id, patch);
    if (upgrade && values.kind !== 'received') {
      const fuSt: OrderFollowupStatus = values.kind === 'deposit' ? 'DEPOSIT_PENDING' : 'RESERVED';
      await createOrderFollowup(token, {
        customerName: n,
        nickname: values.nickname.trim() || null,
        customerPhone: stored.customerPhone,
        customerPhone2: stored.customerPhone2,
        status: fuSt,
        memo: followupMemo,
        goldDb: values.goldDb,
        inquiryId: existing.id,
        leadSource: values.leadSource.trim(),
        strictLeadSource: true,
        ...followupExtras,
        ...brandBody,
      });
    }
    return {
      kind: 'inquiry',
      inquiryId: existing.id,
      status: upgrade ? targetStatus : existing.status,
      continued: upgrade ? 'merged' : 'appended',
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
