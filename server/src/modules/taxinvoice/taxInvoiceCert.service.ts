import { prisma } from '../../lib/prisma.js';
import { callBarobill, BarobillCallError } from '../../lib/barobill/soap.js';
import { resolveBarobillEnv } from '../../lib/barobill/env.js';
import { addDaysToKstYmd, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import { notifyInboxRefreshWithPush } from '../notifications/staffAppPushDispatch.helpers.js';

const CERT_GUIDE = '공동인증서가 없거나 만료되었습니다. 계산서 연결에서 공동인증서 등록을 해 주세요.';

function expireYmd(raw: unknown): string | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const dashed = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const plain = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (plain) return `${plain[1]}-${plain[2]}-${plain[3]}`;
  return null;
}

async function notifyCertExpiry(tenantId: string, brandName: string, expireDate: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { tenantId, role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  const body = `${brandName} 공동인증서가 ${expireDate}에 만료됩니다. 계산서 연결에서 갱신해 주세요.`;
  await notifyInboxRefreshWithPush(
    admins.map((row) => row.id),
    () => ({
      kind: 'generic',
      title: '공동인증서 만료 예정',
      body,
      path: '/admin/team-leaders/cashbill',
    }),
  );
}

export async function refreshBarobillCerts(tenantId: string): Promise<void> {
  const env = resolveBarobillEnv();
  const members = await prisma.barobillMember.findMany({
    where: { tenantId, env, status: 'ACTIVE', NOT: { barobillUserId: '' } },
    select: {
      id: true,
      corpNum: true,
      certWarnForExpire: true,
      operatingCompany: { select: { name: true } },
    },
  });
  for (const member of members) {
    let valid = false;
    let expireDate: string | null = null;
    try {
      const checked = await callBarobill('TI', 'CheckCERTIsValid', { CorpNum: member.corpNum }, { corpNum: member.corpNum });
      valid = Number(checked) > 0;
    } catch (err) {
      valid = false;
      if (!(err instanceof BarobillCallError)) continue;
    }
    if (valid) {
      try {
        const raw = await callBarobill('TI', 'GetCertificateExpireDate', { CorpNum: member.corpNum }, { corpNum: member.corpNum });
        expireDate = expireYmd(raw);
      } catch {
        expireDate = null;
      }
    }
    const today = kstTodayYmd();
    const warnBy = addDaysToKstYmd(today, 30);
    const shouldWarn = Boolean(expireDate && expireDate <= warnBy && member.certWarnForExpire !== expireDate);
    await prisma.barobillMember.updateMany({
      where: { id: member.id, tenantId },
      data: {
        certValid: valid,
        certExpireDate: expireDate,
        certCheckedAt: new Date(),
        certWarnForExpire: shouldWarn ? expireDate : member.certWarnForExpire,
      },
    });
    if (shouldWarn && expireDate) {
      await notifyCertExpiry(tenantId, member.operatingCompany?.name ?? '브랜드', expireDate);
    }
  }
}

function frameHeadersAllow(headers: Headers): boolean {
  const xfo = (headers.get('x-frame-options') ?? '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
  const csp = (headers.get('content-security-policy') ?? '').toLowerCase();
  const ancestors = csp.match(/frame-ancestors\s+([^;]+)/)?.[1]?.trim() ?? '';
  if (!ancestors) return true;
  return ancestors.split(/\s+/).some((token) => token === '*' || token.includes('cbiseo.com'));
}

/** 등록 주소 본문은 읽지 않는다. HEAD 로 iframe 차단 헤더만 본다. */
export async function certUrlCanEmbed(url: string): Promise<boolean> {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    let res: Response;
    try {
      res = await fetch(current, { method: 'HEAD', redirect: 'manual' });
    } catch {
      return true;
    }
    if (res.status === 405 || res.status === 501) return true;
    if (!frameHeadersAllow(res.headers)) return false;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return true;
      current = new URL(loc, current).toString();
      continue;
    }
    return true;
  }
  return false;
}

async function loadLinkedMember(tenantId: string, operatingCompanyId: string) {
  const env = resolveBarobillEnv();
  const brand = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { name: true, barobillMember: true },
  });
  const member = brand?.barobillMember;
  if (!member || member.tenantId !== tenantId || member.env !== env || member.status !== 'ACTIVE' || !member.barobillUserId.trim()) {
    return null;
  }
  return { member, brandName: brand?.name ?? '브랜드' };
}

export async function refreshOneBarobillCert(tenantId: string, operatingCompanyId: string): Promise<{ valid: boolean; expireDate: string | null }> {
  const loaded = await loadLinkedMember(tenantId, operatingCompanyId);
  if (!loaded) return { valid: false, expireDate: null };
  let valid = false;
  let expireDate: string | null = null;
  try {
    const checked = await callBarobill('TI', 'CheckCERTIsValid', { CorpNum: loaded.member.corpNum }, { corpNum: loaded.member.corpNum });
    valid = Number(checked) > 0;
  } catch (err) {
    valid = false;
    if (!(err instanceof BarobillCallError)) return { valid: false, expireDate: loaded.member.certExpireDate };
  }
  if (valid) {
    try {
      const raw = await callBarobill('TI', 'GetCertificateExpireDate', { CorpNum: loaded.member.corpNum }, { corpNum: loaded.member.corpNum });
      expireDate = expireYmd(raw);
    } catch {
      expireDate = null;
    }
  }
  const today = kstTodayYmd();
  const warnBy = addDaysToKstYmd(today, 30);
  const shouldWarn = Boolean(expireDate && expireDate <= warnBy && loaded.member.certWarnForExpire !== expireDate);
  await prisma.barobillMember.updateMany({
    where: { id: loaded.member.id, tenantId },
    data: {
      certValid: valid,
      certExpireDate: expireDate,
      certCheckedAt: new Date(),
      certWarnForExpire: shouldWarn ? expireDate : loaded.member.certWarnForExpire,
    },
  });
  if (shouldWarn && expireDate) await notifyCertExpiry(tenantId, loaded.brandName, expireDate);
  return { valid, expireDate };
}

export async function certificateRegisterUrl(
  tenantId: string,
  operatingCompanyId: string,
): Promise<{ url: string; embed: boolean }> {
  const loaded = await loadLinkedMember(tenantId, operatingCompanyId);
  if (!loaded) throw new Error('연결된 브랜드에서만 공동인증서를 등록할 수 있습니다.');
  const raw = await callBarobill(
    'TI',
    'GetBaroBillURL',
    { CorpNum: loaded.member.corpNum, ID: loaded.member.barobillUserId, PWD: '', TOGO: 'CERT' },
    { corpNum: loaded.member.corpNum },
  );
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url.startsWith('http')) throw new Error('공동인증서 등록 주소를 받지 못했습니다.');
  const embed = await certUrlCanEmbed(url);
  console.info(`[barobill] cert-url embed=${embed}`);
  return { url, embed };
}

export function certBlockMessage(): string {
  return CERT_GUIDE;
}
