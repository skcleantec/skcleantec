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
import { isBlankSupplierField } from '../taxinvoice/supplierFieldText.js';
import { parseTenantConfig } from '../tenants/tenantConfig.schema.js';
import { refreshBarobillCerts } from '../taxinvoice/taxInvoiceCert.service.js';
import { notifyPlatformOps } from '../platform/platformInboxNotify.service.js';
import { notifyBarobillLinkCompleted, notifyBarobillLinkRequested } from './cashbillLinkMail.js';

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

function realSupplierText(raw: unknown, max = 200): string {
  const text = clean(raw, max);
  return isBlankSupplierField(text) ? '' : text;
}

function assertBarobillConfigured(): void {
  if (!(process.env.BAROBILL_CERTKEY ?? '').trim()) {
    throw new CashbillMemberError('바로빌 연결 설정이 없습니다.', 503);
  }
}

function assertMemberEnv(env: string): void {
  if (env !== resolveBarobillEnv()) {
    throw new CashbillMemberError('현재 바로빌 환경과 다른 회원사입니다.', 403);
  }
}

type BusinessField = 'corpNum' | 'corpName' | 'ceoName' | 'addr1';

const BUSINESS_FIELD_LABEL: Record<BusinessField, string> = {
  corpNum: '사업자번호',
  corpName: '상호',
  ceoName: '대표자',
  addr1: '주소',
};

type BusinessProfile = {
  businessType: 'registered_business' | 'individual' | null;
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr1: string;
  contactTel: string;
  contactEmail: string;
  contactName: string;
};

function firstFilled(...values: unknown[]): string {
  for (const value of values) {
    const text = realSupplierText(value);
    if (text) return text;
  }
  return '';
}

function missingBusinessFields(profile: Pick<BusinessProfile, BusinessField>): BusinessField[] {
  const missing: BusinessField[] = [];
  if (!profile.corpNum) missing.push('corpNum');
  if (!profile.corpName) missing.push('corpName');
  if (!profile.ceoName) missing.push('ceoName');
  if (!profile.addr1) missing.push('addr1');
  return missing;
}

function missingBusinessMessage(missing: BusinessField[]): string {
  return `사업자정보에 ${missing.map((key) => BUSINESS_FIELD_LABEL[key]).join('·')}가 없습니다.`;
}

async function loadBusinessProfile(tenantId: string): Promise<BusinessProfile> {
  const [tenant, signup, pg] = await Promise.all([
    prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { config: true },
    }),
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
  const registration = parseTenantConfig(tenant?.config).companyRegistration;
  const corpName = firstFilled(registration?.companyName, signup?.businessName);
  const ceoName = firstFilled(registration?.representativeName, signup?.representativeName);
  const addr1 = firstFilled(registration?.addressLine, signup?.addressLine);
  return {
    businessType: signup?.businessType ?? null,
    corpNum: normalizeCorpNum(firstFilled(registration?.businessRegistrationNo, signup?.bizNumber)) ?? '',
    corpName,
    ceoName,
    addr1,
    contactTel: firstFilled(registration?.phone, pg?.contactPhone),
    contactEmail: firstFilled(registration?.contactEmail, pg?.contactEmail),
    contactName: firstFilled(pg?.contactName, ceoName),
  };
}

export async function getCashbillSettings(tenantId: string) {
  assertBarobillConfigured();
  await refreshBarobillCerts(tenantId).catch(() => undefined);
  const env = resolveBarobillEnv();
  const profile = await loadBusinessProfile(tenantId);
  const individual = profile.businessType === 'individual';
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
          bizType: true,
          bizClass: true,
          contactName: true,
          contactTel: true,
          contactEmail: true,
          linkRequestedAt: true,
          linkRequestUserIdHint: true,
          createdAt: true,
          reviewedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return {
    env,
    businessType: profile.businessType,
    canRegister: !individual,
    blockReason: individual
      ? '개인(비사업자) 업체는 현금영수증 회원사에 가입할 수 없습니다. 사업자등록 업체만 가입할 수 있습니다.'
      : null,
    prefill: {
      corpNum: profile.corpNum,
      corpName: profile.corpName,
      ceoName: profile.ceoName,
      addr1: profile.addr1,
      contactName: profile.contactName,
      contactTel: profile.contactTel,
      contactEmail: profile.contactEmail,
    },
    missing: missingBusinessFields(profile),
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
              bizType: visible.bizType,
              bizClass: visible.bizClass,
              contactName: visible.contactName,
              contactTel: visible.contactTel,
              contactEmail: visible.contactEmail,
              linkRequestedAt: visible.linkRequestedAt?.toISOString() ?? null,
              linkRequestUserIdHint: visible.linkRequestUserIdHint,
              createdAt: visible.createdAt.toISOString(),
              reviewedAt: visible.reviewedAt?.toISOString() ?? null,
              updatedAt: visible.updatedAt.toISOString(),
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
  const bizType = realSupplierText(input.bizType, 40);
  const bizClass = realSupplierText(input.bizClass, 40);
  const contactTel = clean(input.contactTel, 20);
  const contactEmail = realSupplierText(input.contactEmail, 120);
  const contactName = realSupplierText(input.contactName, 40) || realSupplierText(fallbackName, 40);
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
        lastError: '이미 바로빌에 가입된 사업자입니다.',
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
  assertBarobillConfigured();
  const env = resolveBarobillEnv();
  const profile = await loadBusinessProfile(tenantId);
  if (profile.businessType === 'individual') {
    throw new CashbillMemberError('개인(비사업자) 업체는 현금영수증 회원사에 가입할 수 없습니다.');
  }
  const brand = await loadBrandForTenant(tenantId, input.operatingCompanyId);

  if (brand.isDefault) {
    const missing = missingBusinessFields(profile);
    if (missing.length > 0) throw new CashbillMemberError(missingBusinessMessage(missing));
    const { corpNum, corpName, ceoName, addr1 } = profile;
    assertBizChecksum(corpNum);
    const contact = readContact(input, profile.contactName || ceoName);
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
  const corpName = realSupplierText(clean(input.corpName, 80));
  const ceoName = realSupplierText(clean(input.ceoName, 40));
  const addr1 = realSupplierText(clean(input.addr1, 200));
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
  void notifyPlatformOps({
    event: 'barobill_review',
    tenantId,
    title: '바로빌 검토 대기',
    body: corpName,
  }).catch((err) => console.error('[platform-inbox] barobill', err));
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
  tenantId?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.BarobillMemberWhereInput = {};
  const tenantId = query.tenantId?.trim();
  if (tenantId) where.tenantId = tenantId;
  const listedEnv = (['test', 'prod'] as const).find((name) => name === query.env);
  if (listedEnv) where.env = listedEnv;
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
        certValid: true,
        certExpireDate: true,
        linkRequestedAt: true,
        linkRequestUserIdHint: true,
        contactTel: true,
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
      certValid: row.certValid,
      certExpireDate: row.certExpireDate,
      corpNumMasked: maskCorpNum(row.corpNum),
      corpNum: row.corpNum,
      linkRequestedAt: row.linkRequestedAt?.toISOString() ?? null,
      linkRequestUserIdHint: row.linkRequestUserIdHint,
      contactTel: row.contactTel,
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
  assertBarobillConfigured();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
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
  assertBarobillConfigured();
  const reason = clean(reasonRaw, 500);
  if (!reason) throw new CashbillMemberError('반려 사유를 입력해 주세요.');
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, status: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
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
  assertBarobillConfigured();
  const userId = barobillUserIdRaw.trim();
  if (!/^[A-Za-z0-9]{6,20}$/.test(userId)) {
    throw new CashbillMemberError('바로빌 아이디는 영문·숫자 6~20자입니다.');
  }
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: {
      id: true,
      tenantId: true,
      env: true,
      corpNum: true,
      status: true,
      updatedAt: true,
      contactEmail: true,
      tenant: { select: { name: true } },
    },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
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
    data: { status: 'ACTIVE', barobillUserId: userId, lastError: null, reviewedAt: new Date() },
  });
  if (updated.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  try {
    await notifyBarobillLinkCompleted({
      to: row.contactEmail,
      tenantName: row.tenant.name,
    });
  } catch (err) {
    console.error('[cashbill] link complete mail', err instanceof Error ? err.name : 'error');
  }
  return { id: row.id, status: 'ACTIVE' as const };
}

const LINK_REQUEST_STATUSES: BarobillMemberStatus[] = ['LINK_REQUIRED', 'FAILED', 'REJECTED'];

export async function requestBarobillLink(tenantId: string, memberId: string, hintRaw: unknown) {
  const hint = typeof hintRaw === 'string' ? hintRaw.trim().slice(0, 20) : '';
  if (hint && !/^[A-Za-z0-9]{1,20}$/.test(hint)) {
    throw new CashbillMemberError('바로빌 아이디는 영문·숫자로 적어 주세요.');
  }
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId, tenantId },
    select: {
      id: true,
      env: true,
      status: true,
      corpNum: true,
      tenant: { select: { name: true } },
    },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
  if (!LINK_REQUEST_STATUSES.includes(row.status)) {
    throw new CashbillMemberError('연결 요청을 보낼 수 있는 상태가 아닙니다.');
  }
  const requestedAt = new Date();
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId, status: row.status },
    data: {
      status: 'LINK_REQUIRED',
      linkRequestedAt: requestedAt,
      linkRequestUserIdHint: hint || null,
      rejectReason: null,
      lastError: null,
    },
  });
  if (updated.count !== 1) throw new CashbillMemberError('이미 처리 중입니다. 새로고침 후 다시 확인해 주세요.', 409);
  try {
    await notifyBarobillLinkRequested({
      tenantId,
      tenantName: row.tenant.name,
      corpNum: row.corpNum,
      requestedAt,
      hint: hint || null,
    });
  } catch (err) {
    console.error('[cashbill] link request mail', err instanceof Error ? err.name : 'error');
  }
  return { id: row.id, linkRequestedAt: requestedAt.toISOString() };
}

export async function cancelBarobillLinkRequest(tenantId: string, memberId: string) {
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId, tenantId },
    select: { id: true, env: true, status: true, linkRequestedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
  if (row.status !== 'LINK_REQUIRED' || !row.linkRequestedAt) {
    throw new CashbillMemberError('취소할 연결 요청이 없습니다.');
  }
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId, status: 'LINK_REQUIRED' },
    data: { linkRequestedAt: null, linkRequestUserIdHint: null },
  });
  if (updated.count !== 1) throw new CashbillMemberError('이미 처리 중입니다. 새로고침 후 다시 확인해 주세요.', 409);
  return { id: row.id, linkRequestedAt: null };
}

export async function returnBarobillLink(memberId: string, reasonRaw: string) {
  const reason = reasonRaw.trim().slice(0, 500);
  if (!reason) throw new CashbillMemberError('사유를 입력해 주세요.');
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, status: true, linkRequestedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
  if (row.status !== 'LINK_REQUIRED' || !row.linkRequestedAt) {
    throw new CashbillMemberError('연결 요청이 있는 건만 돌려보낼 수 있습니다.');
  }
  const updated = await prisma.barobillMember.updateMany({
    where: { id: row.id, tenantId: row.tenantId, status: 'LINK_REQUIRED' },
    data: {
      status: 'FAILED',
      rejectReason: reason,
      linkRequestedAt: null,
      linkRequestUserIdHint: null,
      lastError: null,
    },
  });
  if (updated.count !== 1) throw new CashbillMemberError(ALREADY_PROCESSING_MESSAGE, 409);
  return { id: row.id, status: 'FAILED' as const };
}

export async function checkStaleBarobillProcessing(memberId: string) {
  assertBarobillConfigured();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, env: true, corpNum: true, status: true, updatedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
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
  assertBarobillConfigured();
  const row = await prisma.barobillMember.findFirst({
    where: { id: memberId },
    select: { id: true, tenantId: true, env: true, corpNum: true, status: true, updatedAt: true },
  });
  if (!row) throw new CashbillMemberError('회원사를 찾을 수 없습니다.', 404);
  assertMemberEnv(row.env);
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

/** 가입완료 브랜드의 업태·연락만 청소비서에 저장한다. 바로빌 재가입은 하지 않는다. */
export async function updateActiveCashbillContact(tenantId: string, input: RegisterInput) {
  const brand = await loadBrandForTenant(tenantId, input.operatingCompanyId);
  const owner = await prisma.operatingCompany.findFirst({
    where: { id: brand.id, tenantId },
    select: { barobillMember: { select: { id: true, tenantId: true, status: true } } },
  });
  const member = owner?.barobillMember;
  if (!member || member.tenantId !== tenantId || member.status !== 'ACTIVE') {
    throw new CashbillMemberError('가입완료인 브랜드만 연락 정보를 수정할 수 있습니다.', 409);
  }
  const profile = await loadBusinessProfile(tenantId);
  const contact = readContact(input, profile.contactName || '담당자');
  const saved = await prisma.barobillMember.updateMany({
    where: { id: member.id, tenantId, status: 'ACTIVE' },
    data: {
      bizType: contact.bizType,
      bizClass: contact.bizClass,
      contactName: contact.contactName,
      contactTel: contact.contactTel,
      contactEmail: contact.contactEmail,
    },
  });
  if (saved.count !== 1) throw new CashbillMemberError('연락 정보를 저장하지 못했습니다.', 409);
  return { ok: true as const };
}
