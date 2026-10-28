import type { BarobillMemberStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNs } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { cashbillRegistrationFolder, isValidKoreanBizNumberChecksum } from '../../lib/barobill/bizNumber.js';
import { getCorpTaxType } from '../../lib/barobill/corpState.js';
import { resolveBarobillEnv } from '../../lib/barobill/env.js';
import { maskCorpNum, normalizeCorpNum } from '../../lib/barobill/mask.js';
import { BAROBILL_ALREADY_MEMBER_CODE, BAROBILL_PROCESSING_STALE_MS } from '../../lib/barobill/policy.js';
import { BarobillCallError } from '../../lib/barobill/soap.js';
import { checkCorpIsMember, newBarobillPassword, newBarobillUserId, registCorp } from '../../lib/barobill/ti.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import { refreshBarobillCerts } from '../taxinvoice/taxInvoiceCert.service.js';

export class CashbillMemberError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALREADY_PROCESSING_MESSAGE = '이미 처리 중';
const HOLDING_STATUSES: BarobillMemberStatus[] = ['ACTIVE', 'LINK_REQUIRED'];

type CorpRow = {
  id: string;
  tenantId: string;
  status: BarobillMemberStatus;
  operatingCompany: { id: string; tenantId: string } | null;
};

function isStaleProcessing(status: BarobillMemberStatus, updatedAt: Date, now = Date.now()): boolean {
  return status === 'PROCESSING' && now - updatedAt.getTime() >= BAROBILL_PROCESSING_STALE_MS;
}

function clean(raw: unknown, max: number): string {
  return String(raw ?? '').trim().slice(0, max);
}

function assertTestEnv(): void {
  if (resolveBarobillEnv() !== 'test') {
    throw new CashbillMemberError('지금은 바로빌 테스트 환경만 사용할 수 있습니다.', 403);
  }
}

async function loadSignupProfile(tenantId: string) {
  const [signup, pg] = await Promise.all([
    prisma.tenantSignupBusiness.findFirst({
      where: { tenantId },
      select: {
        businessType: true,
        bizNumber: true,
        businessName: true,
        representativeName: true,
        addressLine: true,
      },
    }),
    prisma.tenantPgOnboarding.findFirst({
      where: { tenantId },
      select: { contactName: true, contactPhone: true, contactEmail: true },
    }),
  ]);
  return { signup, pg };
}

export async function getCashbillSettings(tenantId: string) {
  assertTestEnv();
  await refreshBarobillCerts(tenantId).catch(() => undefined);
  const env = resolveBarobillEnv();
  const { signup, pg } = await loadSignupProfile(tenantId);
  const individual = signup?.businessType === 'individual';
  const brands = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      barobillMember: {
        select: {
          id: true,
          tenantId: true,
          env: true,
          corpNum: true,
          status: true,
          taxType: true,
          lastError: true,
          barobillUserId: true,
          corpName: true,
          ceoName: true,
          addr1: true,
          rejectReason: true,
          businessRegistrationImageUrl: true,
          businessRegistrationImagePublicId: true,
          certValid: true,
          certExpireDate: true,
        },
      },
    },
  });

  return {
    env,
    businessType: signup?.businessType ?? null,
    canRegister: !individual,
    blockReason: individual
      ? '개인(비사업자) 업체는 현금영수증 회원사에 가입할 수 없습니다. 사업자등록 업체만 가입할 수 있습니다.'
      : null,
    prefill: {
      corpNum: normalizeCorpNum(signup?.bizNumber) ?? '',
      corpName: signup?.businessName?.trim() ?? '',
      ceoName: signup?.representativeName?.trim() ?? '',
      addr1: signup?.addressLine?.trim() ?? '',
      contactName: pg?.contactName?.trim() || signup?.representativeName?.trim() || '',
      contactTel: pg?.contactPhone?.trim() ?? '',
      contactEmail: pg?.contactEmail?.trim() ?? '',
    },
    brands: brands.map((brand) => {
      const member = brand.barobillMember;
      const visible = member && member.tenantId === tenantId && member.env === env ? member : null;
      return {
        operatingCompanyId: brand.id,
        name: brand.name,
        isDefault: brand.isDefault,
        member: visible
          ? {
              id: visible.id,
              status: visible.status,
              taxType: visible.taxType,
              lastError: visible.lastError,
              corpNumMasked: maskCorpNum(visible.corpNum),
              corpNum: visible.corpNum,
              corpName: visible.corpName,
              ceoName: visible.ceoName,
              addr1: visible.addr1,
              rejectReason: visible.rejectReason,
              businessRegistrationImageUrl: visible.businessRegistrationImageUrl,
              businessRegistrationImagePublicId: visible.businessRegistrationImagePublicId,
              linked: visible.status === 'ACTIVE' && Boolean(visible.barobillUserId.trim()),
              certValid: visible.certValid,
              certExpireDate: visible.certExpireDate,
            }
          : null,
      };
    }),
  };
}

type RegisterInput = {
  operatingCompanyId: string;
  bizType: string;
  bizClass: string;
  contactTel: string;
  contactEmail: string;
  contactName?: string;
  addr1?: string;
  addr2?: string;
  corpNum?: string;
  corpName?: string;
  ceoName?: string;
  businessRegistrationImageUrl?: string;
  businessRegistrationImagePublicId?: string;
};

export async function loadBrandForTenant(tenantId: string, operatingCompanyId: string) {
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId },
    select: { id: true, tenantId: true, isDefault: true, isActive: true },
  });
  if (!brand || !brand.isActive) throw new CashbillMemberError('브랜드를 찾을 수 없습니다.', 404);
  if (brand.tenantId !== tenantId) {
    throw new CashbillMemberError('다른 업체의 브랜드는 사용할 수 없습니다.', 403);
  }
  return brand;
}

function assertBizChecksum(corpNum: string): void {
  if (!isValidKoreanBizNumberChecksum(corpNum)) {
    throw new CashbillMemberError('사업자등록번호 10자리 검증에 맞지 않습니다.');
  }
}

async function findSameTenantCorp(env: string, tenantId: string, corpNum: string): Promise<CorpRow | null> {
  return prisma.barobillMember.findFirst({
    where: { env, tenantId, corpNum },
    select: {
      id: true,
      tenantId: true,
      status: true,
      operatingCompany: { select: { id: true, tenantId: true } },
    },
  });
}

async function assertNoOtherTenantHoldsCorp(env: string, corpNum: string, tenantId: string): Promise<void> {
  const hit = await prisma.barobillMember.findFirst({
    where: {
      env,
      corpNum,
      tenantId: { not: tenantId },
      status: { in: HOLDING_STATUSES },
    },
    select: { id: true },
  });
  if (hit) {
    throw new CashbillMemberError('다른 업체가 이 사업자번호로 이미 가입되어 있습니다.', 409);
  }
}

function assertSameTenantBrandLink(existing: CorpRow | null, brandId: string): void {
  const linkedId = existing?.operatingCompany?.id;
  if (linkedId && linkedId !== brandId) {
    throw new CashbillMemberError('이 업체에서 이미 쓰는 사업자번호입니다.', 409);
  }
}

async function revertProcessing(
  id: string,
  tenantId: string,
  status: 'PENDING_REVIEW' | 'FAILED',
  lastError: string | null,
): Promise<void> {
  await prisma.barobillMember.updateMany({
    where: { id, tenantId, status: 'PROCESSING' },
    data: { status, lastError },
  });
}

function readContact(input: RegisterInput, fallbackName: string) {
  const bizType = clean(input.bizType, 40);
  const bizClass = clean(input.bizClass, 40);
  const contactTel = clean(input.contactTel, 20);
  const contactEmail = clean(input.contactEmail, 120);
  const contactName = clean(input.contactName, 40) || fallbackName;
  const addr2 = clean(input.addr2, 120);
  if (!bizType || !bizClass) throw new CashbillMemberError('업태와 종목을 입력해 주세요.');
  if (contactTel.replace(/\D/g, '').length < 8) throw new CashbillMemberError('담당 전화를 입력해 주세요.');
  if (!EMAIL_RE.test(contactEmail)) throw new CashbillMemberError('담당 이메일을 확인해 주세요.');
  if (!contactName) throw new CashbillMemberError('담당자 이름을 입력해 주세요.');
  return { bizType, bizClass, contactTel, contactEmail, contactName, addr2 };
}

async function saveMember(
  tenantId: string,
  brandId: string,
  existingId: string | undefined,
  data: Prisma.BarobillMemberUncheckedCreateInput,
) {
  try {
    return await prisma.$transaction(async (tx) => {
      let id = existingId;
      if (id) {
        const { tenantId: _tenantId, ...patch } = data;
        await tx.barobillMember.updateMany({ where: { id, tenantId }, data: patch });
      } else {
        const created = await tx.barobillMember.create({ data });
        id = created.id;
      }
      await tx.operatingCompany.updateMany({
        where: { id: brandId, tenantId },
        data: { barobillMemberId: id },
      });
      return id;
    });
  } catch (err) {
    if (err instanceof PrismaNs.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new CashbillMemberError('이 업체에서 이미 쓰는 사업자번호입니다.', 409);
    }
    throw err;
  }
}

async function callBarobillSignup(input: {
  corpNum: string;
  corpName: string;
  ceoName: string;
  bizType: string;
  bizClass: string;
  addr1: string;
  addr2: string;
  contactName: string;
  contactTel: string;
  contactEmail: string;
}): Promise<{ status: BarobillMemberStatus; lastError: string | null; barobillUserId: string; taxType: string | null }> {
  const userId = newBarobillUserId();
  const password = newBarobillPassword();
  try {
    const memberFlag = await checkCorpIsMember(input.corpNum);
    if (memberFlag > 0) {
      return {
        status: 'LINK_REQUIRED',
        lastError: '이미 바로빌 회원사입니다. 콘솔에서 연결한 뒤 플랫폼에서 처리완료 해 주세요.',
        barobillUserId: '',
        taxType: null,
      };
    }
    await registCorp({
      corpNum: input.corpNum,
      corpName: input.corpName,
      ceoName: input.ceoName,
      bizType: input.bizType,
      bizClass: input.bizClass,
      addr1: input.addr1,
      addr2: input.addr2,
      memberName: input.contactName,
      id: userId,
      password,
      tel: input.contactTel,
      email: input.contactEmail,
    });
    let taxType: string | null = null;
    try {
      taxType = (await getCorpTaxType(input.corpNum)).taxType;
    } catch (err) {
      console.info(
        `[barobill] GetCorpState skipped corp=${maskCorpNum(input.corpNum)} ${err instanceof BarobillCallError ? `code=${err.code}` : 'error'}`,
      );
    }
    return { status: 'ACTIVE', lastError: null, barobillUserId: userId, taxType };
  } catch (err) {
    if (err instanceof BarobillCallError && err.code === BAROBILL_ALREADY_MEMBER_CODE) {
      return { status: 'LINK_REQUIRED', lastError: err.message, barobillUserId: '', taxType: null };
    }
    const lastError = err instanceof BarobillCallError
      ? err.message
      : err instanceof Error
        ? err.message
        : '바로빌 가입에 실패했습니다.';
    return { status: 'FAILED', lastError, barobillUserId: '', taxType: null };
  }
}

async function claimDefaultBrandProcessing(
  tenantId: string,
  brandId: string,
  existing: CorpRow | null,
  data: Prisma.BarobillMemberUncheckedCreateInput,
): Promise<string> {
  if (existing?.status === 'ACTIVE' || existing?.status === 'LINK_REQUIRED') {
    throw new CashbillMemberError('이미 가입된 브랜드입니다.', 409);
  }
  if (existing?.status === 'PROCESSING' || existing?.status === 'PENDING_REVIEW') {
    throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  }
  if (existing?.status === 'FAILED') {
    const claimed = await prisma.barobillMember.updateMany({
      where: { id: existing.id, tenantId, status: 'FAILED' },
      data: {
        status: 'PROCESSING',
        corpName: data.corpName,
        ceoName: data.ceoName,
        addr1: data.addr1,
        addr2: data.addr2,
        bizType: data.bizType,
        bizClass: data.bizClass,
        contactName: data.contactName,
        contactTel: data.contactTel,
        contactEmail: data.contactEmail,
        lastError: null,
        rejectReason: null,
        barobillUserId: '',
        taxType: null,
      },
    });
    if (claimed.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
    await prisma.operatingCompany.updateMany({
      where: { id: brandId, tenantId },
      data: { barobillMemberId: existing.id },
    });
    return existing.id;
  }
  if (existing) throw new CashbillMemberError('다시 제출할 수 없는 상태입니다.', 409);
  try {
    return await saveMember(tenantId, brandId, undefined, data);
  } catch (err) {
    if (!(err instanceof CashbillMemberError) || err.statusCode !== 409) throw err;
    const again = await findSameTenantCorp(data.env, tenantId, data.corpNum);
    assertSameTenantBrandLink(again, brandId);
    if (!again || again.status === 'PROCESSING' || again.status === 'PENDING_REVIEW') {
      throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
    }
    if (again.status === 'ACTIVE' || again.status === 'LINK_REQUIRED') {
      throw new CashbillMemberError('이미 가입된 브랜드입니다.', 409);
    }
    throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  }
}

export async function registerCashbillMember(tenantId: string, input: RegisterInput) {
  assertTestEnv();
  const env = resolveBarobillEnv();
  const { signup, pg } = await loadSignupProfile(tenantId);
  if (signup?.businessType === 'individual') {
    throw new CashbillMemberError('개인(비사업자) 업체는 현금영수증 회원사에 가입할 수 없습니다.');
  }
  const brand = await loadBrandForTenant(tenantId, input.operatingCompanyId);

  if (brand.isDefault) {
    const corpNum = normalizeCorpNum(signup?.bizNumber) ?? '';
    const corpName = signup?.businessName?.trim() ?? '';
    const ceoName = signup?.representativeName?.trim() ?? '';
    const addr1 = signup?.addressLine?.trim() || clean(input.addr1, 200);
    if (!corpNum || !corpName || !ceoName || !addr1) {
      throw new CashbillMemberError('사업자정보(사업자번호·상호·대표자·주소)를 먼저 저장해 주세요.');
    }
    assertBizChecksum(corpNum);
    const contact = readContact(input, pg?.contactName?.trim() || ceoName);
    await assertNoOtherTenantHoldsCorp(env, corpNum, tenantId);
    const existing = await findSameTenantCorp(env, tenantId, corpNum);
    assertSameTenantBrandLink(existing, brand.id);
    const memberFields = {
      tenantId,
      env,
      corpNum,
      corpName,
      ceoName,
      addr1,
      addr2: contact.addr2 || null,
      bizType: contact.bizType,
      bizClass: contact.bizClass,
      contactName: contact.contactName,
      contactTel: contact.contactTel,
      contactEmail: contact.contactEmail,
      barobillUserId: '',
      taxType: null,
      status: 'PROCESSING' as const,
      lastError: null,
      rejectReason: null,
      reviewedAt: null,
      reviewedByPlatformUserId: null,
    };
    const claimedId = await claimDefaultBrandProcessing(tenantId, brand.id, existing, memberFields);
    try {
      await assertNoOtherTenantHoldsCorp(env, corpNum, tenantId);
    } catch (err) {
      await revertProcessing(claimedId, tenantId, 'FAILED', null);
      throw err;
    }
    const called = await callBarobillSignup({ ...contact, corpNum, corpName, ceoName, addr1 });
    if (called.status === 'FAILED') {
      await revertProcessing(claimedId, tenantId, 'FAILED', called.lastError);
      return { id: claimedId, status: 'FAILED' as const, lastError: called.lastError, taxType: null };
    }
    await prisma.barobillMember.updateMany({
      where: { id: claimedId, tenantId, status: 'PROCESSING' },
      data: {
        status: called.status,
        lastError: called.lastError,
        barobillUserId: called.barobillUserId,
        taxType: called.taxType,
      },
    });
    return { id: claimedId, status: called.status, lastError: called.lastError, taxType: called.taxType };
  }

  const corpNum = normalizeCorpNum(input.corpNum) ?? '';
  const corpName = clean(input.corpName, 80);
  const ceoName = clean(input.ceoName, 40);
  const addr1 = clean(input.addr1, 200);
  const imageUrl = clean(input.businessRegistrationImageUrl, 500);
  const imageId = clean(input.businessRegistrationImagePublicId, 200);
  if (!corpNum || !corpName || !ceoName || !addr1) {
    throw new CashbillMemberError('사업자번호, 상호, 대표자, 주소를 입력해 주세요.');
  }
  assertBizChecksum(corpNum);
  if (!imageUrl.startsWith('https://') || !imageId.startsWith(cashbillRegistrationFolder(tenantId, brand.id))) {
    throw new CashbillMemberError('사업자등록증 이미지를 올려 주세요.');
  }
  const contact = readContact(input, ceoName);
  await assertNoOtherTenantHoldsCorp(env, corpNum, tenantId);
  const existing = await findSameTenantCorp(env, tenantId, corpNum);
  assertSameTenantBrandLink(existing, brand.id);
  const sameBrand = existing?.operatingCompany?.id === brand.id;
  if (existing?.status === 'PROCESSING') {
    throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  }
  if (sameBrand && existing?.status === 'PENDING_REVIEW') {
    throw new CashbillMemberError('검토 중인 브랜드입니다.', 409);
  }
  if (sameBrand && (existing?.status === 'ACTIVE' || existing?.status === 'LINK_REQUIRED')) {
    throw new CashbillMemberError('이미 가입된 브랜드입니다.', 409);
  }
  if (existing && existing.status !== 'REJECTED' && existing.status !== 'FAILED') {
    throw new CashbillMemberError('다시 제출할 수 없는 상태입니다.', 409);
  }
  const reuseId = existing && (!existing.operatingCompany || sameBrand) ? existing.id : undefined;
  const id = await saveMember(tenantId, brand.id, reuseId, {
    tenantId,
    env,
    corpNum,
    corpName,
    ceoName,
    addr1,
    addr2: contact.addr2 || null,
    bizType: contact.bizType,
    bizClass: contact.bizClass,
    contactName: contact.contactName,
    contactTel: contact.contactTel,
    contactEmail: contact.contactEmail,
    businessRegistrationImageUrl: imageUrl,
    businessRegistrationImagePublicId: imageId,
    barobillUserId: '',
    taxType: null,
    status: 'PENDING_REVIEW',
    lastError: null,
    rejectReason: null,
    reviewedAt: null,
    reviewedByPlatformUserId: null,
  });
  return { id, status: 'PENDING_REVIEW' as const, lastError: null, taxType: null };
}

/** 브랜드가 없는 접수는 업체 기본 브랜드의 회원사를 쓴다. */
export async function resolveCashbillMemberForBrand(tenantId: string, operatingCompanyId: string | null) {
  const env = resolveBarobillEnv();
  let brandId = operatingCompanyId;
  if (!brandId) {
    const fallback = await prisma.operatingCompany.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: { id: true },
    });
    brandId = fallback?.id ?? null;
  }
  if (!brandId) return null;
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: brandId, tenantId },
    select: {
      barobillMember: true,
    },
  });
  const member = brand?.barobillMember;
  if (!member || member.tenantId !== tenantId || member.env !== env || member.status !== 'ACTIVE') return null;
  return member;
}

export async function listBarobillMembersForPlatform(query: {
  env?: string;
  status?: string;
  datePreset?: string;
  month?: string;
  day?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.BarobillMemberWhereInput = {};
  if (query.env === 'test' || query.env === 'prod') where.env = query.env;
  if (
    query.status === 'ACTIVE' ||
    query.status === 'LINK_REQUIRED' ||
    query.status === 'FAILED' ||
    query.status === 'PENDING_REVIEW' ||
    query.status === 'REJECTED' ||
    query.status === 'PROCESSING'
  ) {
    where.status = query.status;
  }
  const range = createdAtRangeFromQuery({
    datePreset: query.datePreset,
    month: query.month,
    day: query.day,
  });
  if (range) where.createdAt = range;

  const [rows, total] = await prisma.$transaction([
    prisma.barobillMember.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      select: {
        id: true,
        tenantId: true,
        env: true,
        corpNum: true,
        status: true,
        taxType: true,
        lastError: true,
        rejectReason: true,
        businessRegistrationImageUrl: true,
        corpName: true,
        barobillUserId: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { name: true, slug: true } },
        operatingCompany: { select: { id: true, name: true, tenantId: true } },
      },
    }),
    prisma.barobillMember.count({ where }),
  ]);

  const corpKeys = rows.map((row) => ({ env: row.env, corpNum: row.corpNum }));
  const related = corpKeys.length === 0
    ? []
    : await prisma.barobillMember.findMany({
        where: { OR: corpKeys.map((key) => ({ env: key.env, corpNum: key.corpNum })) },
        select: {
          id: true,
          env: true,
          corpNum: true,
          tenantId: true,
          status: true,
          tenant: { select: { name: true } },
        },
      });

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      env: row.env,
      status: row.status,
      taxType: row.taxType,
      lastError: row.lastError,
      rejectReason: row.rejectReason,
      businessRegistrationImageUrl: row.businessRegistrationImageUrl,
      corpName: row.corpName,
      hasUserId: row.barobillUserId.length > 0,
      corpNumMasked: maskCorpNum(row.corpNum),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      confirmNeeded: isStaleProcessing(row.status, row.updatedAt),
      duplicateApplicants: related
        .filter((other) => other.id !== row.id && other.env === row.env && other.corpNum === row.corpNum && other.tenantId !== row.tenantId)
        .map((other) => ({ tenantName: other.tenant.name, status: other.status })),
      tenantName: row.tenant.name,
      tenantSlug: row.tenant.slug,
      brandName:
        row.operatingCompany && row.operatingCompany.tenantId === row.tenantId
          ? row.operatingCompany.name
          : null,
    })),
  };
}

export async function approveBarobillMember(memberId: string, platformUserId: string) {
  assertTestEnv();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  if (row.env !== 'test') throw new CashbillMemberError('테스트 환경 회원사만 처리할 수 있습니다.', 403);
  if (row.status === 'PROCESSING') throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  if (row.status !== 'PENDING_REVIEW') throw new CashbillMemberError('검토 중인 건만 승인할 수 있습니다.');
  const claimed = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'PENDING_REVIEW' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  try {
    await assertNoOtherTenantHoldsCorp(row.env, row.corpNum, row.tenantId);
  } catch (err) {
    await revertProcessing(row.id, row.tenantId, 'PENDING_REVIEW', null);
    throw err;
  }
  const called = await callBarobillSignup({
    corpNum: row.corpNum,
    corpName: row.corpName,
    ceoName: row.ceoName,
    bizType: row.bizType,
    bizClass: row.bizClass,
    addr1: row.addr1,
    addr2: row.addr2 ?? '',
    contactName: row.contactName,
    contactTel: row.contactTel,
    contactEmail: row.contactEmail,
  });
  if (called.status === 'FAILED') {
    await revertProcessing(row.id, row.tenantId, 'PENDING_REVIEW', called.lastError);
    throw new CashbillMemberError(called.lastError ?? '바로빌 가입에 실패했습니다.');
  }
  await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'PROCESSING' },
    data: {
      status: called.status,
      lastError: called.lastError,
      barobillUserId: called.barobillUserId,
      taxType: called.taxType,
      rejectReason: null,
      reviewedAt: new Date(),
      reviewedByPlatformUserId: platformUserId,
    },
  });
  return { id: row.id, status: called.status, lastError: called.lastError };
}

export async function rejectBarobillMember(memberId: string, platformUserId: string, reasonRaw: string) {
  assertTestEnv();
  const reason = clean(reasonRaw, 500);
  if (!reason) throw new CashbillMemberError('반려 사유를 입력해 주세요.');
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, status: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  if (row.env !== 'test') throw new CashbillMemberError('테스트 환경 회원사만 처리할 수 있습니다.', 403);
  if (row.status !== 'PENDING_REVIEW') throw new CashbillMemberError('검토 중인 건만 반려할 수 있습니다.');
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'PENDING_REVIEW' },
    data: {
      status: 'REJECTED',
      rejectReason: reason,
      lastError: null,
      reviewedAt: new Date(),
      reviewedByPlatformUserId: platformUserId,
    },
  });
  if (updated.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  return { id: row.id, status: 'REJECTED' as const };
}

export async function completeBarobillLink(memberId: string, barobillUserIdRaw: string) {
  assertTestEnv();
  const userId = barobillUserIdRaw.trim();
  if (!/^[A-Za-z0-9]{6,20}$/.test(userId)) {
    throw new CashbillMemberError('바로빌 아이디는 영문·숫자 6~20자입니다.');
  }
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, corpNum: true, status: true, updatedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  if (row.env !== 'test') {
    throw new CashbillMemberError('테스트 환경 회원사만 처리할 수 있습니다.', 403);
  }
  const stale = isStaleProcessing(row.status, row.updatedAt);
  if (row.status === 'PROCESSING' && !stale) {
    throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  }
  if (row.status !== 'LINK_REQUIRED' && !stale) {
    throw new CashbillMemberError('연결이 필요한 건만 처리완료 할 수 있습니다.');
  }
  const flag = await checkCorpIsMember(row.corpNum);
  if (flag <= 0) {
    throw new CashbillMemberError('콘솔에서 회원사 추가가 아직 확인되지 않습니다.');
  }
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: row.status },
    data: { status: 'ACTIVE', barobillUserId: userId, lastError: null },
  });
  if (updated.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  return { id: row.id, status: 'ACTIVE' as const };
}

export async function checkStaleBarobillProcessing(memberId: string) {
  assertTestEnv();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, env: true, corpNum: true, status: true, updatedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  if (row.env !== 'test') throw new CashbillMemberError('테스트 환경 회원사만 처리할 수 있습니다.', 403);
  if (row.status !== 'PROCESSING') throw new CashbillMemberError('처리 중인 건만 확인할 수 있습니다.');
  if (!isStaleProcessing(row.status, row.updatedAt)) {
    throw new CashbillMemberError('10분이 지나지 않아 아직 확인하지 않습니다.');
  }
  const flag = await checkCorpIsMember(row.corpNum);
  const isMember = flag > 0;
  return {
    id: row.id,
    isMember,
    message: isMember
      ? '바로빌에 회원으로 있습니다. 콘솔에서 아이디를 확인한 뒤 처리완료 해 주세요.'
      : '바로빌 회원이 아닙니다. 자동으로 다시 가입하지 않습니다.',
  };
}

export async function releaseStaleBarobillProcessing(memberId: string) {
  assertTestEnv();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, corpNum: true, status: true, updatedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  if (row.env !== 'test') throw new CashbillMemberError('테스트 환경 회원사만 처리할 수 있습니다.', 403);
  if (!isStaleProcessing(row.status, row.updatedAt)) {
    throw new CashbillMemberError('10분이 지나지 않은 처리 중 건은 되돌릴 수 없습니다.');
  }
  const flag = await checkCorpIsMember(row.corpNum);
  if (flag > 0) {
    throw new CashbillMemberError('바로빌에 회원으로 있습니다. 처리완료로 연결해 주세요.');
  }
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'PROCESSING' },
    data: {
      status: 'PENDING_REVIEW',
      lastError: '회원 여부를 확인한 뒤 검토 중으로 되돌렸습니다.',
    },
  });
  if (updated.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  return { id: row.id, status: 'PENDING_REVIEW' as const };
}
