import { callBarobill, type BarobillServiceName } from './soap.js';

/** 현금영수증 WSDL 클라이언트. 식별번호는 redact 로만 넘긴다. */
export async function callCashbill(
  method: string,
  args: Record<string, unknown>,
  options?: { corpNum?: string; redact?: readonly string[] },
): Promise<unknown> {
  return callBarobill('CASHBILL', method, args, options);
}

export const CASHBILL_SERVICE: BarobillServiceName = 'CASHBILL';
