import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { loadServiceBridgeMerchants } from './serviceBridgeWspay.js';
import { normalizeWspayOid } from './wspayOrderId.js';

export type WindowMerchant = { mid: string; mKey: string; oid: string };
export type KeyinMerchant = { apiKey: string; tid: string; mid: string; oid: string };

/** 업체 키가 수기(ssp-)가 아니면 그 업체의 결제창 키를 쓰고, 없으면 서비스브릿지 인증 키를 씁니다. */
export async function resolveWindowMerchant(tenantId: string): Promise<WindowMerchant | null> {
  const tenant = await getDecryptedCredential(tenantId);
  const tenantOid = tenant?.oid ? normalizeWspayOid(tenant.oid) : null;
  if (tenant?.mid && tenant.apiKey && tenantOid && !tenant.apiKey.startsWith('ssp-')) {
    return { mid: tenant.mid, mKey: tenant.apiKey, oid: tenantOid };
  }
  const bridge = loadServiceBridgeMerchants().appCard;
  if (!bridge) return null;
  return { mid: bridge.mid, mKey: bridge.apiKey, oid: bridge.oid };
}

/** 업체 키가 ssp- 수기 키면 그 키를 쓰고, 없으면 서비스브릿지 수기 키를 씁니다. */
export async function resolveKeyinMerchant(tenantId: string): Promise<KeyinMerchant | null> {
  const tenant = await getDecryptedCredential(tenantId);
  const tenantOid = tenant?.oid ? normalizeWspayOid(tenant.oid) : null;
  if (tenant?.apiKey.startsWith('ssp-') && tenant.mid && tenantOid) {
    return { apiKey: tenant.apiKey, tid: tenant.tid, mid: tenant.mid, oid: tenantOid };
  }
  const bridge = loadServiceBridgeMerchants().keyin;
  if (!bridge) return null;
  return { apiKey: bridge.apiKey, tid: bridge.tid, mid: bridge.mid, oid: bridge.oid };
}
