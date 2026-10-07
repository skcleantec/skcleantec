import { prisma } from '../../lib/prisma.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';
import { getDecryptedCredential } from './cardPaymentCredential.service.js';
import { requestPaysisPaymentWindow } from './paysisWindow.adapter.js';
import { probeWspayListAuth } from './wspayAdapter.js';
import { buildWspayOrderId, normalizeWspayOid } from './wspayOrderId.js';

export type TenantPaymentProbe =
  | { rail: 'KEYIN'; ok: boolean; message: string }
  | { rail: 'PAY_WINDOW'; ok: boolean; message: string; redirectUrl?: string };

/** 저장한 업체 키만 확인한다. 카드 승인·서비스브릿지 키는 쓰지 않는다. */
export async function probeTenantPaymentConnection(
  tenantId: string,
): Promise<{ error: string; status: 400 | 404 } | { result: TenantPaymentProbe }> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return { error: '업체를 찾을 수 없습니다.', status: 404 };
  const cred = await getDecryptedCredential(tenantId);
  const oid = cred?.oid ? normalizeWspayOid(cred.oid) : null;
  if (!cred?.mid || !cred.apiKey || !oid) {
    return { error: '이 업체 결제 키가 없습니다. MID, OID, 키를 저장한 뒤 다시 확인하세요.', status: 400 };
  }
  if (cred.apiKey.startsWith('ssp-')) {
    const probed = await probeWspayListAuth({ apiKey: cred.apiKey, tid: cred.tid, mid: cred.mid, oid });
    return {
      result: {
        rail: 'KEYIN',
        ok: probed.accepted,
        message: probed.accepted
          ? '수기 키 연결을 확인했습니다. 카드 승인 요청은 보내지 않았습니다.'
          : '수기 키가 조회에서 거절되었습니다.',
      },
    };
  }
  const orderNo = buildWspayOrderId(oid, `probe${Date.now().toString(36)}`)?.slice(0, 30);
  if (!orderNo) return { error: '주문번호를 만들지 못했습니다.', status: 400 };
  const base = getPublicAppBaseUrl();
  const opened = await requestPaysisPaymentWindow({
    mid: cred.mid,
    mKey: cred.apiKey,
    type: 'P',
    amount: '1000',
    productName: '연결확인',
    userId: 'platform',
    userName: '확인',
    orderNo,
    returnUrl: `${base}/api/public/card-payment/paysis-noti`,
    successUrl: `${base}/pay/paysis/ok`,
    failUrl: `${base}/pay/paysis/fail`,
    closeUrl: `${base}/pay/paysis/close`,
  });
  if (!opened.ok) {
    return { result: { rail: 'PAY_WINDOW', ok: false, message: opened.message } };
  }
  return {
    result: {
      rail: 'PAY_WINDOW',
      ok: true,
      message: '결제창 주소를 받았습니다. 창에서 결제하면 실제 승인입니다. 연결만 볼 때는 창을 닫으세요.',
      redirectUrl: opened.redirectUrl,
    },
  };
}
