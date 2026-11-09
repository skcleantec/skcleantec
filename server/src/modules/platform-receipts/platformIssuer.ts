import { callBarobill, BarobillCallError } from '../../lib/barobill/soap.js';

export type PlatformIssuer = {
  corpNum: string;
  barobillUserId: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  tel: string;
  contactName: string;
};

function env(key: string): string {
  return (process.env[key] ?? '').trim();
}

export function readPlatformIssuer(): PlatformIssuer {
  const corpNum = env('PLATFORM_ISSUER_CORP_NUM');
  const barobillUserId = env('PLATFORM_ISSUER_BAROBILL_USER_ID');
  const corpName = env('PLATFORM_ISSUER_CORP_NAME');
  const ceoName = env('PLATFORM_ISSUER_CEO_NAME');
  const addr = env('PLATFORM_ISSUER_ADDR');
  const bizType = env('PLATFORM_ISSUER_BIZ_TYPE');
  const bizClass = env('PLATFORM_ISSUER_BIZ_CLASS');
  const email = env('PLATFORM_ISSUER_EMAIL');
  const tel = env('PLATFORM_ISSUER_TEL');
  const contactName = env('PLATFORM_ISSUER_CONTACT_NAME');

  const missing: string[] = [];
  if (!corpNum) missing.push('PLATFORM_ISSUER_CORP_NUM');
  if (!barobillUserId) missing.push('PLATFORM_ISSUER_BAROBILL_USER_ID');
  if (!corpName) missing.push('PLATFORM_ISSUER_CORP_NAME');

  if (missing.length > 0) {
    throw new Error(`플랫폼 발행자 환경변수가 없습니다: ${missing.join(', ')}`);
  }

  return { corpNum, barobillUserId, corpName, ceoName, addr, bizType, bizClass, email, tel, contactName };
}

export function maskIssuer(issuer: PlatformIssuer): Omit<PlatformIssuer, 'barobillUserId'> & { barobillUserIdMasked: string } {
  const id = issuer.barobillUserId;
  const masked = id.length <= 4 ? `${id.slice(0, 1)}***` : `${id.slice(0, 2)}***${id.slice(-2)}`;
  const { barobillUserId: _omit, ...rest } = issuer;
  return { ...rest, barobillUserIdMasked: masked };
}

export async function refreshPlatformIssuerCert(): Promise<{ valid: boolean; expireDate: string | null }> {
  const issuer = readPlatformIssuer();
  let valid = false;
  let expireDate: string | null = null;
  try {
    const checked = await callBarobill('TI', 'CheckCERTIsValid', { CorpNum: issuer.corpNum }, { corpNum: issuer.corpNum });
    valid = Number(checked) > 0;
  } catch (err) {
    if (!(err instanceof BarobillCallError)) throw err;
    return { valid: false, expireDate: null };
  }
  if (valid) {
    try {
      const raw = await callBarobill('TI', 'GetCertificateExpireDate', { CorpNum: issuer.corpNum }, { corpNum: issuer.corpNum });
      const text = typeof raw === 'string' ? raw.trim() : '';
      const dashed = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dashed) expireDate = `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
      else {
        const plain = text.match(/^(\d{4})(\d{2})(\d{2})/);
        if (plain) expireDate = `${plain[1]}-${plain[2]}-${plain[3]}`;
      }
    } catch {
      expireDate = null;
    }
  }
  return { valid, expireDate };
}

export async function platformIssuerCertRegisterUrl(): Promise<string> {
  const issuer = readPlatformIssuer();
  const raw = await callBarobill(
    'TI',
    'GetBaroBillURL',
    { CorpNum: issuer.corpNum, ID: issuer.barobillUserId, PWD: '', TOGO: 'CERT' },
    { corpNum: issuer.corpNum },
  );
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url.startsWith('http')) throw new Error('공동인증서 등록 주소를 받지 못했습니다.');
  return url;
}
