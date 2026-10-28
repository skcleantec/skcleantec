import { callCashbill } from '../../lib/barobill/cashbill.js';
import { BarobillCallError } from '../../lib/barobill/soap.js';

export const PARTNER_BALANCE_CODES = new Set([-26006, -26011]);

export type CashbillInvoice = {
  corpNum: string;
  userId: string;
  mgtKey: string;
  identityNum: string;
  corpName: string;
  ceoName: string;
  addr: string;
  tel: string;
  tradeDate: string;
  tradeUsage: '1' | '2';
  tradeMethod: '4' | '5';
  amount: string;
  tax: string;
  serviceCharge: string;
  itemName: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function readCashbillState(raw: unknown): { barobillState: string; ntsConfirmNum: string | null } | null {
  const row = asRecord(raw);
  if (!row) return null;
  const state = row.BarobillState;
  if (typeof state !== 'number' && typeof state !== 'string') return null;
  const nts = row.NTSConfirmNum;
  return {
    barobillState: String(state),
    ntsConfirmNum: typeof nts === 'string' && nts.trim() ? nts.trim() : null,
  };
}

export function readCashbillStates(raw: unknown): { mgtKey: string; barobillState: string; ntsConfirmNum: string | null }[] {
  const root = asRecord(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(root?.CashBillState)
      ? root.CashBillState
      : root?.CashBillState
        ? [root.CashBillState]
        : [];
  const out: { mgtKey: string; barobillState: string; ntsConfirmNum: string | null }[] = [];
  for (const item of list) {
    const row = asRecord(item);
    const parsed = readCashbillState(item);
    const mgtKey = typeof row?.MgtKey === 'string' ? row.MgtKey : '';
    if (!parsed || !mgtKey) continue;
    out.push({ mgtKey, ...parsed });
  }
  return out;
}

export async function registAndIssueCashBill(invoice: CashbillInvoice): Promise<void> {
  await callCashbill(
    'RegistAndIssueCashBill',
    {
      CorpNum: invoice.corpNum,
      UserID: invoice.userId,
      Invoice: {
        MgtKey: invoice.mgtKey,
        FranchiseCorpNum: invoice.corpNum,
        FranchiseMemberID: invoice.userId,
        FranchiseCorpName: invoice.corpName,
        FranchiseCEOName: invoice.ceoName,
        FranchiseAddr: invoice.addr,
        FranchiseTel: invoice.tel,
        IdentityNum: invoice.identityNum,
        HP: '',
        Fax: '',
        Email: '',
        TradeDate: invoice.tradeDate,
        TradeType: 'N',
        TradeUsage: invoice.tradeUsage,
        TradeMethod: invoice.tradeMethod,
        Amount: invoice.amount,
        Tax: invoice.tax,
        ServiceCharge: invoice.serviceCharge,
        ItemName: invoice.itemName,
        CancelType: '',
        CancelNTSConfirmNum: '',
        CancelNTSConfirmDate: '',
      },
      SMSSendYN: false,
      MailTitle: '',
    },
    { corpNum: invoice.corpNum, redact: [invoice.identityNum] },
  );
}

export async function cancelCashBillFull(input: {
  corpNum: string;
  userId: string;
  mgtKey: string;
  cancelMgtKey: string;
}): Promise<void> {
  await callCashbill(
    'CancelCashBillEx',
    {
      CorpNum: input.corpNum,
      UserID: input.userId,
      MgtKey: input.mgtKey,
      CancelMgtKey: input.cancelMgtKey,
      SMSSendYN: false,
      MailTitle: '',
    },
    { corpNum: input.corpNum },
  );
}

export async function fetchCashbillState(input: { corpNum: string; userId: string; mgtKey: string }) {
  const raw = await callCashbill(
    'GetCashBillState',
    { CorpNum: input.corpNum, UserID: input.userId, MgtKey: input.mgtKey },
    { corpNum: input.corpNum },
  );
  return readCashbillState(raw);
}

export async function fetchCashbillStates(input: { corpNum: string; userId: string; mgtKeys: string[] }) {
  const raw = await callCashbill(
    'GetCashBillStates',
    {
      CorpNum: input.corpNum,
      UserID: input.userId,
      MgtKeyList: { string: input.mgtKeys },
    },
    { corpNum: input.corpNum },
  );
  return readCashbillStates(raw);
}

export async function fetchCashbillMailUrl(input: { corpNum: string; userId: string; mgtKey: string }): Promise<string> {
  const raw = await callCashbill(
    'GetCashBillMailURL',
    { CorpNum: input.corpNum, UserID: input.userId, MgtKey: input.mgtKey },
    { corpNum: input.corpNum },
  );
  if (typeof raw !== 'string' || !raw.startsWith('http')) {
    throw new BarobillCallError(-1, '현금영수증 확인 주소를 받지 못했습니다.');
  }
  return raw;
}
