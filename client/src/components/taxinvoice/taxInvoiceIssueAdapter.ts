import type { TaxInvoiceBrand, TaxInvoiceReissueSource, TaxInvoiceSearchHit } from '../../api/taxInvoices';
import {
  fetchTaxInvoiceSource,
  issueTaxInvoice,
  listTaxInvoices,
  searchTaxInvoiceInquiries,
} from '../../api/taxInvoices';
import {
  fetchPlatformReceiptIssuer,
  fetchPlatformReceiptCert,
  issuePlatformTaxInvoice,
  listPlatformTaxInvoiceBuyers,
  upsertPlatformTaxInvoiceBuyer,
  updatePlatformTaxInvoiceBuyer,
  removePlatformTaxInvoiceBuyer,
  fetchPlatformTenantsForBuyer,
  type PlatformBuyerTenant,
} from '../../api/platformReceipts';
import {
  tenantTaxInvoiceBuyerApi,
  type TaxInvoiceBuyerApi,
  type TaxInvoiceBuyerInput,
} from '../../api/taxInvoiceBuyers';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';

export type TaxInvoiceIssuePayload = Record<string, unknown>;

export type TaxInvoiceIssuerAdapter = {
  mode: 'tenant' | 'platform';
  draftScope: string;
  useWallet: boolean;
  unitPriceKrw: number;
  allowInquiry: boolean;
  supplierLocked: boolean;
  buyerApi: TaxInvoiceBuyerApi;
  /** 플랫폼: 청소비서 업체에서 고르기 */
  loadTenantBuyers?: () => Promise<PlatformBuyerTenant[]>;
  loadBrands: () => Promise<TaxInvoiceBrand[]>;
  issue: (payload: TaxInvoiceIssuePayload) => Promise<{ id: string }>;
  loadSource?: (id: string) => Promise<TaxInvoiceReissueSource>;
  searchInquiries?: (q: string, inquiryId?: string) => Promise<TaxInvoiceSearchHit[]>;
  saveBuyerAfterIssue: (input: TaxInvoiceBuyerInput) => Promise<void>;
};

export const tenantTaxInvoiceAdapter: TaxInvoiceIssuerAdapter = {
  mode: 'tenant',
  draftScope: 'tenant',
  useWallet: true,
  unitPriceKrw: TAXINVOICE_UNIT_PRICE_KRW,
  allowInquiry: true,
  supplierLocked: false,
  buyerApi: tenantTaxInvoiceBuyerApi,
  loadBrands: async () => {
    const qs = new URLSearchParams({ datePreset: 'today', limit: '1' });
    const res = await listTaxInvoices(qs);
    return res.brands;
  },
  issue: (payload) => issueTaxInvoice(payload),
  loadSource: fetchTaxInvoiceSource,
  searchInquiries: (q, inquiryId) => searchTaxInvoiceInquiries(q, inquiryId),
  saveBuyerAfterIssue: async (input) => {
    await tenantTaxInvoiceBuyerApi.upsert(input);
  },
};

export function createPlatformTaxInvoiceAdapter(): TaxInvoiceIssuerAdapter {
  const buyerApi: TaxInvoiceBuyerApi = {
    list: listPlatformTaxInvoiceBuyers,
    upsert: upsertPlatformTaxInvoiceBuyer,
    update: updatePlatformTaxInvoiceBuyer,
    remove: removePlatformTaxInvoiceBuyer,
  };
  return {
    mode: 'platform',
    draftScope: 'platform',
    useWallet: false,
    unitPriceKrw: TAXINVOICE_UNIT_PRICE_KRW,
    allowInquiry: false,
    supplierLocked: true,
    buyerApi,
    loadTenantBuyers: async () => {
      const res = await fetchPlatformTenantsForBuyer();
      return res.items;
    },
    loadBrands: async () => {
      const [issuer, cert] = await Promise.all([
        fetchPlatformReceiptIssuer(),
        fetchPlatformReceiptCert().catch(() => ({ valid: false, expireDate: null as string | null })),
      ]);
      return [
        {
          id: 'platform',
          name: issuer.corpName || '서비스브릿지',
          linked: true,
          simplified: false,
          certValid: cert.valid,
          certExpireDate: cert.expireDate,
          supplier: {
            corpNum: issuer.corpNum,
            corpName: issuer.corpName,
            ceoName: issuer.ceoName ?? '',
            addr: issuer.addr ?? '',
            bizType: issuer.bizType ?? '',
            bizClass: issuer.bizClass ?? '',
            email: '',
            tel: '',
            contactName: '',
          },
        },
      ];
    },
    issue: async (payload) => {
      const buyer = (payload.buyer ?? {}) as Record<string, string>;
      const lines = Array.isArray(payload.lines)
        ? (payload.lines as Array<{ name?: string; supply?: number | string; tax?: number | string }>)
        : [];
      const supply = lines.reduce((s, line) => s + Math.trunc(Number(line.supply) || 0), 0);
      const tax = lines.reduce((s, line) => s + Math.trunc(Number(line.tax) || 0), 0);
      const itemName = lines[0]?.name?.trim() || '청소비서 이용료';
      const writeRaw = String(payload.writeDate ?? '').replace(/\D/g, '');
      const writeDate =
        writeRaw.length === 8
          ? `${writeRaw.slice(0, 4)}-${writeRaw.slice(4, 6)}-${writeRaw.slice(6, 8)}`
          : String(payload.writeDate ?? '');
      const row = await issuePlatformTaxInvoice({
        writeDate,
        corpNum: buyer.corpNum ?? '',
        corpName: buyer.corpName ?? '',
        ceoName: buyer.ceoName,
        addr: buyer.addr,
        email: buyer.email,
        bizType: buyer.bizType,
        bizClass: buyer.bizClass,
        supplyAmountKrw: supply,
        vatAmountKrw: tax,
        itemName,
        memo: typeof payload.remark === 'string' ? payload.remark : undefined,
        tenantId: typeof payload.buyerTenantId === 'string' ? payload.buyerTenantId : undefined,
      });
      return { id: row.id };
    },
    saveBuyerAfterIssue: async (input) => {
      await buyerApi.upsert(input);
    },
  };
}
