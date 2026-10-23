import type { TenantPgOnboarding } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { expandEcTokenMap } from '../e-contract/eContractDynamicExpand.js';
import { EC_SIGNATURE_TOKEN } from '../e-contract/eContractField.tokens.js';
import { signerSignatureUrlLooksValid } from '../e-contract/eContractSigner.expand.js';
import { uploadBusinessRegistrationBuffer, assertBusinessRegistrationImageMime } from '../onboarding/businessRegistration.service.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import {
  isPgContractStub,
  PG_CONTRACT_DEFAULT_BODY,
  PG_CONTRACT_DEFAULT_FIELDS,
  PG_CONTRACT_DEFAULT_TITLE,
} from './pgMerchantContract.document.js';
import { clerkCodesByTenant, PG_CLERK_MAX } from './pgClerk.service.js';

const INPUT_TYPES = ['TEXT', 'TEXTAREA', 'DATE', 'NUMBER', 'PHONE', 'CHECKBOX', 'SEAL'] as const;
type PgContractInputType = (typeof INPUT_TYPES)[number];

export type PgContractField = {
  token: string;
  label: string;
  inputType: PgContractInputType;
  required: boolean;
  sortOrder: number;
};

const DEFAULT_TITLE = PG_CONTRACT_DEFAULT_TITLE;
const DEFAULT_FIELDS: PgContractField[] = PG_CONTRACT_DEFAULT_FIELDS;
const DEFAULT_BODY = PG_CONTRACT_DEFAULT_BODY;
const STUB_TITLE = '카드결제 이용약관';

const TOKEN_RE = /^\[\[EC_[A-Z0-9_]+\]\]$/;

export function parsePgContractFields(raw: unknown): PgContractField[] {
  if (!Array.isArray(raw)) return [];
  const out: PgContractField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const token = typeof row.token === 'string' ? row.token.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const inputType = INPUT_TYPES.includes(row.inputType as PgContractInputType)
      ? (row.inputType as PgContractInputType)
      : null;
    if (!TOKEN_RE.test(token) || !label || !inputType || seen.has(token)) continue;
    if (token === '[[EC_SIGNATURE]]') continue;
    seen.add(token);
    out.push({
      token,
      label: label.slice(0, 128),
      inputType,
      required: row.required !== false,
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Math.round(Number(row.sortOrder)) : (out.length + 1) * 10,
    });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export type PgContractTemplate = {
  title: string;
  bodyHtml: string;
  fields: PgContractField[];
};

function asRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export async function getPgContractTemplate(): Promise<PgContractTemplate> {
  const row = await prisma.platformCardPaymentSettings.findUnique({ where: { id: 'default' } });
  const fields = parsePgContractFields(row?.pgContractFields);
  const stored = row?.pgContractBodyHtml?.trim() ?? '';
  const stub = isPgContractStub(stored);
  const storedTitle = row?.pgContractTitle?.trim() ?? '';
  return {
    title: !storedTitle || (stub && storedTitle === STUB_TITLE) ? DEFAULT_TITLE : storedTitle,
    bodyHtml: stub ? DEFAULT_BODY : stored,
    fields: stub || fields.length === 0 ? DEFAULT_FIELDS : fields,
  };
}

export async function savePgContractTemplate(input: {
  title: string;
  bodyHtml: string;
  fields: unknown;
}): Promise<PgContractTemplate> {
  const title = input.title.trim().slice(0, 128) || DEFAULT_TITLE;
  const bodyHtml = input.bodyHtml.trim();
  if (!bodyHtml) throw new Error('계약 본문을 입력해 주세요.');
  const fields = parsePgContractFields(input.fields);
  if (fields.length === 0) throw new Error('서명자가 채울 칸을 하나 이상 넣어 주세요.');
  await prisma.platformCardPaymentSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      pgContractTitle: title,
      pgContractBodyHtml: bodyHtml,
      pgContractFields: fields,
    },
    update: {
      pgContractTitle: title,
      pgContractBodyHtml: bodyHtml,
      pgContractFields: fields,
    },
  });
  return { title, bodyHtml, fields };
}

type ContractBizPrefill = {
  merchantName: string;
  bizNo: string;
  signerName: string;
  address: string;
  phone: string;
  tel: string;
  email: string;
  staffName: string;
  birth: string;
  bank: string;
  account: string;
  holder: string;
  seal: string;
  tenantCode: string;
  kind: 'solo' | 'corp' | '';
};

function pickText(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    const t = typeof v === 'string' ? v.trim() : '';
    if (t) return t;
  }
  return '';
}

function fillBlank(values: Record<string, string>, key: string, value: string) {
  if (values[key]?.trim()) return;
  const next = value.trim();
  if (next) values[key] = next;
}

/** 업체등록정보 → 가입 사업자 → PG 신청서. 이미 적은 칸은 건드리지 않는다. */
async function loadContractBizPrefill(tenantId: string, row: TenantPgOnboarding): Promise<ContractBizPrefill> {
  const [tenant, brand, signup, config] = await Promise.all([
    prisma.tenant.findFirst({ where: { id: tenantId }, select: { slug: true, name: true } }),
    prisma.operatingCompany.findFirst({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { config: true },
    }),
    prisma.tenantSignupBusiness.findUnique({
      where: { tenantId },
      select: { businessName: true, bizNumber: true, representativeName: true, addressLine: true },
    }),
    getTenantConfig(tenantId),
  ]);
  const brandReg = parseOperatingCompanyConfig(brand?.config).companyRegistration;
  const reg = config.companyRegistration;
  const seal = pickText(brandReg?.sealSecureUrl, reg?.sealSecureUrl);
  const kindRaw = row.merchantKind?.trim();
  const signerName = pickText(
    brandReg?.representativeName,
    reg?.representativeName,
    row.representativeName,
    signup?.representativeName,
  );
  const phone = pickText(row.contactPhone, brandReg?.phone, reg?.phone);
  return {
    merchantName: pickText(brandReg?.companyName, reg?.companyName, row.businessName, signup?.businessName, tenant?.name),
    bizNo: pickText(brandReg?.businessRegistrationNo, reg?.businessRegistrationNo, row.bizNumber, signup?.bizNumber),
    signerName,
    address: pickText(brandReg?.addressLine, reg?.addressLine, row.addressLine, signup?.addressLine),
    phone,
    tel: pickText(brandReg?.phone, reg?.phone, row.contactPhone),
    email: pickText(row.contactEmail, brandReg?.contactEmail, reg?.contactEmail),
    staffName: pickText(row.contactName, signerName),
    birth: pickText(row.representativeBirth),
    bank: pickText(row.bankName),
    account: pickText(row.bankAccount),
    holder: pickText(row.accountHolder),
    seal: seal.startsWith('https://') ? seal : '',
    tenantCode: pickText(tenant?.slug),
    kind: kindRaw === 'solo' || kindRaw === 'corp' ? kindRaw : '',
  };
}

function prefillFor(profile: ContractBizPrefill, token: string): string {
  if (token === '[[EC_MERCHANT_NAME]]') return profile.merchantName;
  if (token === '[[EC_SIGNER_NAME]]') return profile.signerName;
  if (token === '[[EC_BIZ_NO]]') return profile.bizNo;
  if (token === '[[EC_SIGNER_ADDRESS]]') return profile.address;
  if (token === '[[EC_SIGNER_PHONE]]') return profile.phone;
  if (token === '[[EC_SEAL]]') return profile.seal;
  return '';
}

function newPgContractNo() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SB-PG-${y}${m}${d}-${tail}`;
}

const PG_EXTRA_KEY = /^(?:\[\[EC_[A-Z0-9_]+\]\]|pg[A-Z][A-Za-z0-9]{0,40})$/;

function extraContractValue(key: string, raw: unknown): string | null {
  if (!PG_EXTRA_KEY.test(key) || typeof raw !== 'string') return null;
  const str = raw.trim();
  if (!str || str.length > 500) return null;
  // 계좌번호·법인등록번호는 13자리 이상일 수 있다. 그 외 칸의 카드번호 형태만 거절한다.
  const digitIdOk = key === 'pgAccount' || key === 'pgCorpNo';
  if (!digitIdOk && /\d{13,19}/.test(str.replace(/[\s-]/g, ''))) return null;
  return str;
}

function checkField(field: PgContractField, raw: string): string {
  const str = raw.trim();
  if (field.inputType === 'CHECKBOX') {
    const on = str === 'Y' || str === '1' || str === '■' || str === 'true';
    if (field.required && !on) throw new Error(`「${field.label}」에 체크해 주세요.`);
    return on ? '■' : '□';
  }
  if (!str) {
    if (field.required) throw new Error(`「${field.label}」을(를) 입력해 주세요.`);
    return '';
  }
  if (field.inputType === 'SEAL') {
    if (!signerSignatureUrlLooksValid(str)) throw new Error('도장 그림을 다시 올려 주세요.');
    return str;
  }
  if (field.inputType === 'PHONE' && str.length > 32) throw new Error('연락처를 확인해 주세요.');
  if (str.length > 4000) throw new Error(`「${field.label}」이 너무 깁니다.`);
  return str;
}

export async function getTenantPgContract(tenantId: string) {
  const row = await prisma.tenantPgOnboarding.findUnique({ where: { tenantId } });
  if (!row || row.status !== 'APPROVED') {
    return { ready: false as const, reason: 'PG 승인이 난 뒤에 전자계약을 작성합니다.' };
  }
  const template = await getPgContractTemplate();
  const profile = await loadContractBizPrefill(tenantId, row);
  const saved = asRecord(row.contractValues);
  const values: Record<string, string> = {};
  for (const field of template.fields) {
    values[field.token] = saved[field.token] || prefillFor(profile, field.token);
  }
  if (saved[EC_SIGNATURE_TOKEN]) values[EC_SIGNATURE_TOKEN] = saved[EC_SIGNATURE_TOKEN];
  for (const [key, value] of Object.entries(saved)) {
    if (key.startsWith('pg') && value) values[key] = value;
  }
  // 정산 담당·공동대표·실제 소유자 2는 사람이 더 있을 때만 적으므로 채우지 않는다.
  const known: Array<[string, string]> = [
    ['pgTel', profile.tel],
    ['pgStaffName', profile.staffName],
    ['pgStaffPhone', profile.phone],
    ['pgStaffMail', profile.email],
    ['pgBirth', profile.birth],
    ['pgBank', profile.bank],
    ['pgAccount', profile.account],
    ['pgHolder', profile.holder],
    ['pgMailAddr', profile.address],
    ['pgTenantCode', profile.tenantCode],
    ['pgOwner1', profile.signerName],
    ['pgBizKind', profile.kind],
  ];
  for (const [key, value] of known) fillBlank(values, key, value);
  if (profile.signerName) fillBlank(values, 'pgOwnerSame', 'Y');
  return {
    ready: true as const,
    signed: Boolean(row.contractSignedAt),
    signedAt: row.contractSignedAt?.toISOString() ?? null,
    title: template.title,
    bodyHtml: expandEcTokenMap(template.bodyHtml, values),
    fields: template.fields,
    values,
  };
}

export async function submitTenantPgContract(
  tenantId: string,
  input: { signerFields: Record<string, unknown>; signatureUrl: string; agree: boolean },
) {
  if (!input.agree) throw new Error('계약 내용에 동의해 주세요.');
  const row = await prisma.tenantPgOnboarding.findUnique({ where: { tenantId } });
  if (!row || row.status !== 'APPROVED') throw new Error('PG 승인이 난 뒤에 전자계약을 작성합니다.');
  if (row.contractSignedAt) throw new Error('이미 전자계약을 마쳤습니다.');
  const template = await getPgContractTemplate();
  if (!signerSignatureUrlLooksValid(input.signatureUrl)) throw new Error('서명을 저장해 주세요.');
  const values: Record<string, string> = { [EC_SIGNATURE_TOKEN]: input.signatureUrl.trim() };
  for (const field of template.fields) {
    const raw = input.signerFields[field.token];
    const val = checkField(field, typeof raw === 'string' ? raw : '');
    if (val) values[field.token] = val;
  }
  for (const [key, raw] of Object.entries(input.signerFields)) {
    if (values[key]) continue;
    const extra = extraContractValue(key, raw);
    if (extra) values[key] = extra;
  }
  values.pgContractNo = newPgContractNo();
  values.pgFeeRate = '3.3';
  values.pgFeeTier = 'smb1';
  values.pgSettle = 'daily';
  const saved = await prisma.tenantPgOnboarding.update({
    where: { tenantId },
    data: { contractSignedAt: new Date(), contractValues: values },
  });
  return { signedAt: saved.contractSignedAt?.toISOString() ?? '', contractNo: values.pgContractNo };
}

export async function uploadPgContractImage(tenantId: string, buffer: Buffer, mimetype: string) {
  const row = await prisma.tenantPgOnboarding.findUnique({ where: { tenantId }, select: { status: true, contractSignedAt: true } });
  if (!row || row.status !== 'APPROVED' || row.contractSignedAt) {
    throw new Error('지금 도장이나 서명을 올릴 수 없습니다.');
  }
  assertBusinessRegistrationImageMime(mimetype);
  const uploaded = await uploadBusinessRegistrationBuffer({
    folder: `cbiseo/pg-contract/${tenantId}`,
    buffer,
    mimetype,
  });
  return { secureUrl: uploaded.secureUrl };
}

export async function getPartnerPgContract(onboardingId: string) {
  const row = await prisma.tenantPgOnboarding.findFirst({
    where: { id: onboardingId, status: { not: 'DRAFT' } },
    include: { tenant: { select: { name: true } } },
  });
  if (!row) return null;
  const template = await getPgContractTemplate();
  const values = asRecord(row.contractValues);
  const [credential, codes] = await Promise.all([
    prisma.tenantPgCredential.findFirst({
      where: { tenantId: row.tenantId },
      select: { mid: true, oid: true, apiKeyLast4: true, isActive: true },
    }),
    clerkCodesByTenant([row.tenantId]),
  ]);
  return {
    id: row.id,
    tenantName: row.tenant.name,
    businessName: row.businessName,
    status: row.status,
    signed: Boolean(row.contractSignedAt),
    signedAt: row.contractSignedAt?.toISOString() ?? null,
    title: template.title,
    bodyHtml: row.contractSignedAt ? expandEcTokenMap(template.bodyHtml, values) : template.bodyHtml,
    values,
    merchantDeleted: Boolean(row.merchantDeletedAt),
    connected: Boolean(credential?.isActive) && !row.merchantDeletedAt,
    mid: credential?.mid ?? null,
    oid: credential?.oid ?? null,
    apiKeyLast4: credential?.apiKeyLast4 ?? null,
    clerkCodes: codes.get(row.tenantId) ?? Array.from({ length: PG_CLERK_MAX }, () => ''),
  };
}
