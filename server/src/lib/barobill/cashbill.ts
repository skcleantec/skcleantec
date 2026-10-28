import { callBarobill, type BarobillServiceName } from './soap.js';

/** 현금영수증 WSDL 클라이언트. 발급 API 는 다음 단계에서 호출한다. */
export async function callCashbill(
  method: string,
  args: Record<string, unknown>,
  corpNum?: string,
): Promise<unknown> {
  return callBarobill('CASHBILL', method, args, { corpNum });
}

export const CASHBILL_SERVICE: BarobillServiceName = 'CASHBILL';
