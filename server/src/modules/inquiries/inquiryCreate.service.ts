import type { InquiryStatus, UserRole } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { validateInquiryAddressForStatus } from '../../lib/orderFormPendingAddress.js';
import { allocateNextInquiryNumber } from './inquiryNumber.js';
import {
  mapOperatingCompanyResolveError,
  resolveInquiryOperatingCompanyId,
} from '../operating-companies/operatingCompanyResolve.service.js';
import { recordInquiryStatusEvent } from './inquiryStatusEvent.js';
import { syncInquiryAddressGeo } from './inquiryAddressGeoSync.js';
import { notifyInquiryCelebrate } from '../realtime/inquiryCelebrateNotify.js';
import { attachInternalCustomerToneForRole } from './internalCustomerTone.js';
import { attachDistanceFromJuanForInquiry } from './inquiryJuanDistance.js';
import { inquiryDetailInclude } from './inquiryDetailInclude.js';
import {
  allTeamLeadersSolo,
  hasNoCrewMembersField,
  hasSoloTeamLeaderIdsField,
  parseNoCrewMembersInput,
  parseSoloTeamLeaderIds,
} from './inquiryNoCrewMembers.helpers.js';

export const CREATE_INQUIRY_STATUSES: InquiryStatus[] = [
  'PENDING',
  'RECEIVED',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
  'CS_PROCESSING',
];

function normalizeTeamLeaderIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const id = raw.trim();
    return id ? [id] : [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const id = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export class InquiryCreateError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'InquiryCreateError';
  }
}

export type CreateInquiryParams = {
  tenantId: string;
  userId?: string | null;
  userRole?: UserRole;
  body: Record<string, unknown>;
  /** 엑셀 등 외부 접수번호 — non-empty면 그대로 사용(DEPOSIT_PENDING 자동 발번 대신) */
  inquiryNumberOverride?: string | null;
  db?: PrismaClient;
};

export async function createInquiryFromBody(params: CreateInquiryParams) {
  const { tenantId, userId, userRole, body, inquiryNumberOverride } = params;
  const db = params.db ?? prisma;

  const rawStatus = body.status != null ? String(body.status) : '';
  const status: InquiryStatus =
    rawStatus && CREATE_INQUIRY_STATUSES.includes(rawStatus as InquiryStatus)
      ? (rawStatus as InquiryStatus)
      : 'RECEIVED';

  const createAddress = String(body.address ?? '').trim();
  const createAddressError = validateInquiryAddressForStatus(status, createAddress);
  if (createAddressError) {
    throw new InquiryCreateError(createAddressError);
  }

  let crewMemberCount: number | null = null;
  const createAllSoloLegacy =
    hasNoCrewMembersField(body) && parseNoCrewMembersInput(body.noCrewMembers);
  const createSoloIds = hasSoloTeamLeaderIdsField(body)
    ? parseSoloTeamLeaderIds(body.soloTeamLeaderIds)
    : createAllSoloLegacy
      ? []
      : [];
  const createTeamLeaderIds = normalizeTeamLeaderIds(body.teamLeaderIds);
  const createAllSolo =
    createAllSoloLegacy ||
    (createTeamLeaderIds.length > 0 && allTeamLeadersSolo(createTeamLeaderIds, createSoloIds));
  if (createAllSolo) {
    crewMemberCount = 0;
  } else if (body.crewMemberCount !== undefined && body.crewMemberCount !== null && body.crewMemberCount !== '') {
    const n = Number(body.crewMemberCount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new InquiryCreateError('팀원 인원은 0~100 사이로 입력해주세요.');
    }
    crewMemberCount = Math.floor(n);
  }

  const preferredDate = body.preferredDate ? new Date(body.preferredDate as string) : null;
  if (preferredDate && Number.isNaN(preferredDate.getTime())) {
    throw new InquiryCreateError('예약일 형식이 올바르지 않습니다.');
  }

  let operatingCompanyId: string;
  try {
    operatingCompanyId = await db.$transaction(async (tx) =>
      resolveInquiryOperatingCompanyId({
        tx,
        tenantId,
        userId: userId ?? undefined,
        userRole,
        bodyOperatingCompanyId: body.operatingCompanyId,
      }),
    );
  } catch (e) {
    const mapped = mapOperatingCompanyResolveError(e);
    if (mapped) throw new InquiryCreateError(mapped.message, mapped.status);
    throw e;
  }

  const overrideNum = inquiryNumberOverride?.trim() || String(body.inquiryNumber ?? '').trim() || '';

  const inquiry = await db.$transaction(async (tx) => {
    let inquiryNumber: string | null = null;
    if (overrideNum) {
      const dup = await tx.inquiry.findFirst({
        where: { tenantId, inquiryNumber: overrideNum },
        select: { id: true },
      });
      if (dup) {
        throw new InquiryCreateError(`접수번호 '${overrideNum}' 가 이미 존재합니다.`);
      }
      inquiryNumber = overrideNum;
    } else if (status === 'DEPOSIT_PENDING') {
      inquiryNumber = await allocateNextInquiryNumber(tx, tenantId, operatingCompanyId);
    }

    return tx.inquiry.create({
      data: {
        tenantId,
        operatingCompanyId,
        inquiryNumber,
        createdById: userId ?? null,
        customerName: String(body.customerName ?? ''),
        nickname: body.nickname ? String(body.nickname) : null,
        customerPhone: String(body.customerPhone ?? ''),
        customerPhone2: body.customerPhone2 ? String(body.customerPhone2) : null,
        address: String(body.address ?? ''),
        addressDetail: body.addressDetail ? String(body.addressDetail) : null,
        areaPyeong: body.areaPyeong != null ? Number(body.areaPyeong) : null,
        areaBasis: body.areaBasis ? String(body.areaBasis) : null,
        exclusiveAreaSqm: (() => {
          const v = body.exclusiveAreaSqm;
          if (v == null || v === '') return null;
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        propertyType: body.propertyType ? String(body.propertyType) : null,
        buildingType: body.buildingType ? String(body.buildingType) : null,
        roomCount: body.roomCount != null ? Number(body.roomCount) : null,
        bathroomCount: body.bathroomCount != null ? Number(body.bathroomCount) : null,
        balconyCount: body.balconyCount != null ? Number(body.balconyCount) : null,
        preferredDate,
        preferredTime: body.preferredTime ? String(body.preferredTime) : null,
        preferredTimeDetail: body.preferredTimeDetail ? String(body.preferredTimeDetail) : null,
        callAttempt: body.callAttempt != null ? Number(body.callAttempt) : null,
        memo: body.memo ? String(body.memo) : null,
        source: body.source ? String(body.source) : '전화',
        status,
        crewMemberCount,
        crewMemberNote: createAllSolo
          ? null
          : body.crewMemberNote
            ? String(body.crewMemberNote)
            : null,
      },
    });
  });

  await recordInquiryStatusEvent(db, {
    tenantId,
    inquiryId: inquiry.id,
    status: inquiry.status,
    actorId: userId ?? null,
    occurredAt: inquiry.createdAt,
  });
  void notifyInquiryCelebrate({
    tenantId,
    createdById: inquiry.createdById,
    customerName: inquiry.customerName,
    inquiryNumber: inquiry.inquiryNumber,
    source: inquiry.source,
  });
  await syncInquiryAddressGeo(db, inquiry.id);

  const createdOut = await db.inquiry.findUnique({
    where: { id: inquiry.id },
    include: inquiryDetailInclude,
  });
  if (!createdOut) {
    throw new InquiryCreateError('접수 생성 후 조회에 실패했습니다.', 500);
  }

  return attachInternalCustomerToneForRole(
    attachDistanceFromJuanForInquiry(createdOut),
    userRole ?? 'ADMIN',
  );
}
