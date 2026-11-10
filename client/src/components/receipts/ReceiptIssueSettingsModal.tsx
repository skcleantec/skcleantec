import { useEffect, useState } from 'react';
import {
  CASHBILL_DEFAULT_FALLBACK,
  TAXINVOICE_DEFAULT_FALLBACK,
  fetchCashbillIssueSettings,
  fetchPlatformIssueSettings,
  fetchTaxInvoiceIssueSettings,
  saveCashbillIssueSettings,
  savePlatformIssueSettings,
  saveTaxInvoiceIssueSettings,
  type CashbillIssueDefaults,
  type TaxInvoiceIssueDefaults,
} from '../../api/receiptIssueSettings';
import { Button } from '../ui/Button';

const inputCls =
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-fluid-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const labelCls = 'block text-fluid-xs font-medium text-slate-600';

type Props = {
  kind: 'cashbill' | 'taxinvoice';
  mode?: 'tenant' | 'platform';
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function ReceiptIssueSettingsModal({ kind, mode = 'tenant', open, onClose, onSaved }: Props) {
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [cash, setCash] = useState<CashbillIssueDefaults>(CASHBILL_DEFAULT_FALLBACK);
  const [tax, setTax] = useState<TaxInvoiceIssueDefaults>(TAXINVOICE_DEFAULT_FALLBACK);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      if (mode === 'platform') {
        const data = await fetchPlatformIssueSettings(kind === 'cashbill' ? 'CASHBILL' : 'TAXINVOICE');
        if (stop) return;
        setBrands([]);
        setBrandId('');
        setCanEdit(data.canEdit);
        if (kind === 'cashbill') setCash(data.values as CashbillIssueDefaults);
        else setTax(data.values as TaxInvoiceIssueDefaults);
        return;
      }
      if (kind === 'cashbill') {
        const data = await fetchCashbillIssueSettings(brandId || null);
        if (stop) return;
        setBrands(data.brands);
        setCanEdit(data.canEdit);
        setCash(data.values);
        if (!brandId && data.brands.length === 1) setBrandId(data.brands[0].id);
      } else {
        const data = await fetchTaxInvoiceIssueSettings(brandId || null);
        if (stop) return;
        setBrands(data.brands);
        setCanEdit(data.canEdit);
        setTax(data.values);
        if (!brandId && data.brands.length === 1) setBrandId(data.brands[0].id);
      }
    };
    void load()
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '설정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!stop) setLoading(false);
      });
    return () => {
      stop = true;
    };
  }, [open, kind, mode, brandId]);

  if (!open) return null;

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === 'platform') {
        await savePlatformIssueSettings(
          kind === 'cashbill' ? 'CASHBILL' : 'TAXINVOICE',
          kind === 'cashbill' ? cash : tax,
        );
      } else if (kind === 'cashbill') {
        await saveCashbillIssueSettings(brandId || null, cash);
      } else {
        await saveTaxInvoiceIssueSettings(brandId || null, tax);
      }
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const showBrand = mode === 'tenant' && brands.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="receipt-issue-settings-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 id="receipt-issue-settings-title" className="text-fluid-base font-semibold text-slate-900">
            {kind === 'cashbill' ? '현금영수증' : '세금계산서'} 발행 기본설정
          </h2>
          <button type="button" className="min-h-10 rounded-lg px-2 text-fluid-sm text-slate-600 hover:bg-slate-50" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </header>
        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {showBrand ? (
            <label className="block space-y-1">
              <span className={labelCls}>영업브랜드</span>
              <select
                className={inputCls}
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                aria-label="영업브랜드"
              >
                <option value="">업체 공통</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p> : null}
          {!canEdit ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
              마케터는 기본설정을 볼 수만 있습니다. 변경은 관리자에게 요청해 주세요.
            </p>
          ) : null}

          {kind === 'cashbill' ? (
            <div className="space-y-3">
              <fieldset className="space-y-1">
                <legend className={labelCls}>과세/면세</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['taxable', '과세', 'border-sky-300 bg-sky-50 text-sky-900'],
                    ['exempt', '면세', 'border-emerald-300 bg-emerald-50 text-emerald-900'],
                  ] as const).map(([id, label, on]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm font-semibold disabled:opacity-60 ${cash.taxKind === id ? on : 'border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => setCash((v) => ({ ...v, taxKind: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-1">
                <legend className={labelCls}>용도</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['phone', '소득공제'],
                    ['biz', '지출증빙'],
                    ['voluntary', '자진발급'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm disabled:opacity-60 ${cash.usage === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
                      onClick={() => setCash((v) => ({ ...v, usage: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className={labelCls}>품목명</span>
                <input className={inputCls} disabled={!canEdit} value={cash.itemName} onChange={(e) => setCash((v) => ({ ...v, itemName: e.target.value }))} />
              </label>
              <fieldset className="space-y-1">
                <legend className={labelCls}>발행 금액 기준</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['balance', '잔금(발행 가능 한도)'],
                    ['total', '전체 금액'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm disabled:opacity-60 ${cash.amountBasis === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
                      onClick={() => setCash((v) => ({ ...v, amountBasis: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className={labelCls}>비고 기본 문구(내부 메모)</span>
                <textarea className={`${inputCls} min-h-20 py-2`} disabled={!canEdit} value={cash.memo} onChange={(e) => setCash((v) => ({ ...v, memo: e.target.value }))} />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <fieldset className="space-y-1">
                <legend className={labelCls}>과세/영세/면세</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['taxable', '과세', 'border-sky-300 bg-sky-50 text-sky-900'],
                    ['zero', '영세', 'border-indigo-300 bg-indigo-50 text-indigo-900'],
                    ['exempt', '면세', 'border-emerald-300 bg-emerald-50 text-emerald-900'],
                  ] as const).map(([id, label, on]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm font-semibold disabled:opacity-60 ${tax.taxKind === id ? on : 'border-slate-300 bg-white text-slate-700'}`}
                      onClick={() => setTax((v) => ({ ...v, taxKind: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-1">
                <legend className={labelCls}>영수/청구</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    [1, '영수'],
                    [2, '청구'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm disabled:opacity-60 ${tax.purposeType === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
                      onClick={() => setTax((v) => ({ ...v, purposeType: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className={labelCls}>품목명</span>
                <input className={inputCls} disabled={!canEdit} value={tax.itemName} onChange={(e) => setTax((v) => ({ ...v, itemName: e.target.value }))} />
              </label>
              <fieldset className="space-y-1">
                <legend className={labelCls}>작성일 기준</legend>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['today', '오늘'],
                    ['preferredDate', '청소일'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={!canEdit}
                      className={`min-h-10 rounded-lg border px-3 text-fluid-sm disabled:opacity-60 ${tax.writeDateBasis === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
                      onClick={() => setTax((v) => ({ ...v, writeDateBasis: id }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className={labelCls}>받는 이메일 기본</span>
                <input className={inputCls} type="email" disabled={!canEdit} value={tax.buyerEmail} onChange={(e) => setTax((v) => ({ ...v, buyerEmail: e.target.value }))} />
              </label>
              <label className="block space-y-1">
                <span className={labelCls}>비고 기본 문구</span>
                <textarea className={`${inputCls} min-h-20 py-2`} disabled={!canEdit} value={tax.remark} onChange={(e) => setTax((v) => ({ ...v, remark: e.target.value }))} />
              </label>
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>취소</Button>
          {canEdit ? (
            <Button type="button" variant="primary" disabled={saving || loading} onClick={() => void save()}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
