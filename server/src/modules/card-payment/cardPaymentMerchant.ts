import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { normalizeWspayOid } from './wspayOrderId.js';

export type WindowMerchant = { mid: string; mKey: string; oid: string };
export type KeyinMerchant = { apiKey: string; tid: string; mid: string; oid: string };

/** 팀장·손님 청소비 결제창. 그 업체 키만 사용한다. 서비스브릿지 이용료 키는 쓰지 않는다. */
export async function resolveWindowMerchant(tenantId: string): Promise<WindowMerchant | null> {
  const tenant = await getDecryptedCredential(tenantId);
  const tenantOid = tenant?.oid ? normalizeWspayOid(tenant.oid) : null;
  if (tenant?.mid && tenant.apiKey && tenantOid && !tenant.apiKey.startsWith('ssp-')) {
    return { mid: tenant.mid, mKey: tenant.apiKey, oid: tenantOid };
  }
  return null;
}

/** 팀장 수기 준비. 그 업체 수기 키만 사용한다. 서비스브릿지 이용료 키는 쓰지 않는다. */
export async function resolveKeyinMerchant(tenantId: string): Promise<KeyinMerchant | null> {
  const tenant = await getDecryptedCredential(tenantId);
  const tenantOid = tenant?.oid ? normalizeWspayOid(tenant.oid) : null;
  if (tenant?.apiKey.startsWith('ssp-') && tenant.mid && tenantOid) {
    return { apiKey: tenant.apiKey, tid: tenant.tid, mid: tenant.mid, oid: tenantOid };
  }
  return null;
}
