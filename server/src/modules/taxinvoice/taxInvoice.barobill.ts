import { callBarobill } from '../../lib/barobill/soap.js';

export const PARTNER_BALANCE_CODES = new Set([-26006, -26011]);
export const CERT_ERROR_CODES = new Set([-26001, -26002, -26003]);

export type TaxInvoiceLine = {
  name: string;
  supply: number;
  tax: number;
  month?: string;
  day?: string;
  spec?: string;
  qty?: string;
  unitPrice?: string;
  remark?: string;
};

export type TaxInvoicePayload = {
  corpNum: string;
  userId: string;
  mgtKey: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  tel: string;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCeoName: string;
  buyerAddr: string;
  buyerEmail: string;
  buyerBizType: string;
  buyerBizClass: string;
  writeDate: string;
  purposeType: 1 | 2;
  /** 바로빌 TaxInvoice.TaxType. 1 과세, 2 영세, 3 면세. */
  taxType: 1 | 2 | 3;
  /** 바로빌 TaxInvoice.TaxInvoiceType. 면세는 2(계산서), 그 외 1(세금계산서). */
  taxInvoiceType: 1 | 2;
  supply: number;
  tax: number;
  total: number;
  lines: TaxInvoiceLine[];
  /** WSDL 필드명만 확인. 한글 칸 뜻은 BAROBILL_API_NOTES §6. */
  cash?: string;
  chkBill?: string;
  note?: string;
  credit?: string;
  remark?: string;
  buyerTaxRegId?: string;
};

function party(input: {
  contactId: string;
  mgtNum: string;
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  tel: string;
  taxRegId?: string;
}) {
  return {
    ContactID: input.contactId,
    CorpNum: input.corpNum,
    MgtNum: input.mgtNum,
    CorpName: input.corpName,
    TaxRegID: String(input.taxRegId ?? '').replace(/\D/g, '').slice(0, 10),
    CEOName: input.ceoName,
    Addr: input.addr,
    BizClass: input.bizClass,
    BizType: input.bizType,
    ContactName: '',
    TEL: input.tel,
    HP: '',
    Email: input.email,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function readTaxInvoiceState(raw: unknown): { barobillState: string; ntsSendState: string; ntsSendKey: string | null } | null {
  const row = asRecord(raw);
  if (!row) return null;
  const state = row.BarobillState;
  const nts = row.NTSSendState;
  if ((typeof state !== 'number' && typeof state !== 'string') || (typeof nts !== 'number' && typeof nts !== 'string')) return null;
  const key = row.NTSSendKey;
  return {
    barobillState: String(state),
    ntsSendState: String(nts),
    ntsSendKey: typeof key === 'string' && key.trim() ? key.trim() : null,
  };
}

export function readTaxInvoiceStates(raw: unknown): { mgtKey: string; barobillState: string; ntsSendState: string; ntsSendKey: string | null }[] {
  const row = asRecord(raw);
  const list = row?.TaxInvoiceStateEX;
  const items = Array.isArray(list) ? list : list ? [list] : [];
  return items.flatMap((item) => {
    const parsed = readTaxInvoiceState(item);
    const key = asRecord(item)?.MgtKey;
    if (!parsed || typeof key !== 'string' || !key) return [];
    return [{ mgtKey: key, ...parsed }];
  });
}

function linePurchaseExpiry(writeDate: string, month?: string, day?: string): string {
  const m = String(month ?? '').replace(/\D/g, '');
  const d = String(day ?? '').replace(/\D/g, '');
  if (!m || !d || writeDate.length !== 8) return writeDate;
  return `${writeDate.slice(0, 4)}${m.padStart(2, '0').slice(-2)}${d.padStart(2, '0').slice(-2)}`;
}

/** 간편발급. 정발행. 과세·영세·면세는 TaxType, 면세 계산서는 TaxInvoiceType 2. 내부 메모는 넣지 않는다. */
export async function registAndIssueTaxInvoice(input: TaxInvoicePayload): Promise<void> {
  await callBarobill(
    'TI',
    'RegistAndIssueTaxInvoice',
    {
      CorpNum: input.corpNum,
      Invoice: {
        InvoicerParty: party({
          contactId: input.userId,
          mgtNum: input.mgtKey,
          corpNum: input.corpNum,
          corpName: input.corpName,
          ceoName: input.ceoName,
          addr: input.addr,
          bizType: input.bizType,
          bizClass: input.bizClass,
          email: input.email,
          tel: input.tel,
        }),
        InvoiceeParty: party({
          contactId: '',
          mgtNum: '',
          corpNum: input.buyerCorpNum,
          corpName: input.buyerCorpName,
          ceoName: input.buyerCeoName,
          addr: input.buyerAddr,
          bizType: input.buyerBizType,
          bizClass: input.buyerBizClass,
          email: input.buyerEmail,
          tel: '',
          taxRegId: input.buyerTaxRegId,
        }),
        IssueDirection: 1,
        TaxInvoiceType: input.taxInvoiceType,
        TaxType: input.taxType,
        TaxCalcType: 1,
        PurposeType: input.purposeType,
        ModifyCode: '',
        WriteDate: input.writeDate,
        Cash: input.cash ?? '',
        ChkBill: input.chkBill ?? '',
        Note: input.note ?? '',
        Credit: input.credit ?? '',
        AmountTotal: String(input.supply),
        TaxTotal: String(input.tax),
        TotalAmount: String(input.total),
        Remark1: input.remark ?? '',
        Remark2: '',
        Remark3: '',
        TaxInvoiceTradeLineItems: {
          TaxInvoiceTradeLineItem: input.lines.map((line) => ({
            PurchaseExpiry: linePurchaseExpiry(input.writeDate, line.month, line.day),
            Name: line.name,
            Information: line.spec ?? '',
            ChargeableUnit: line.qty ? line.qty : '1',
            UnitPrice: line.unitPrice ? line.unitPrice : String(line.supply),
            Amount: String(line.supply),
            Tax: String(line.tax),
            Description: line.remark ?? '',
          })),
        },
      },
      SendSMS: false,
      ForceIssue: false,
      MailTitle: '',
    },
    { corpNum: input.corpNum },
  );
}

/** 국세청 전송 전 발급취소. ProcType 은 현재 TI WSDL 기준 ISSUE_CANCEL. */
export async function cancelIssuedTaxInvoice(input: { corpNum: string; mgtKey: string }): Promise<void> {
  await callBarobill(
    'TI',
    'ProcTaxInvoice',
    {
      CorpNum: input.corpNum,
      MgtKey: input.mgtKey,
      ProcType: 'ISSUE_CANCEL',
      Memo: '',
    },
    { corpNum: input.corpNum },
  );
}

export async function fetchTaxInvoiceMailUrl(input: { corpNum: string; mgtKey: string }): Promise<string> {
  const raw = await callBarobill(
    'TI',
    'GetTaxinvoiceMailURL',
    { CorpNum: input.corpNum, MgtKey: input.mgtKey },
    { corpNum: input.corpNum },
  );
  if (typeof raw !== 'string' || !raw.startsWith('http')) {
    throw new Error('세금계산서 확인 주소를 받지 못했습니다.');
  }
  return raw;
}

/** 인쇄 화면. 레퍼런스상 60초만 유효하다. PWD 는 빈 값. */
export async function fetchTaxInvoicePrintUrl(input: { corpNum: string; userId: string; mgtKey: string }): Promise<string> {
  const raw = await callBarobill(
    'TI',
    'GetTaxInvoicePrintURL',
    { CorpNum: input.corpNum, MgtKey: input.mgtKey, ID: input.userId, PWD: '' },
    { corpNum: input.corpNum },
  );
  if (typeof raw !== 'string' || !raw.startsWith('http')) {
    throw new Error('세금계산서 인쇄 주소를 받지 못했습니다.');
  }
  return raw;
}

export async function fetchTaxInvoiceStates(input: { corpNum: string; mgtKeys: string[] }) {
  const raw = await callBarobill(
    'TI',
    'GetTaxInvoiceStatesEX',
    { CorpNum: input.corpNum, MgtKeyList: { string: input.mgtKeys } },
    { corpNum: input.corpNum },
  );
  return readTaxInvoiceStates(raw);
}
