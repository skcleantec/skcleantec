import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBizNumberDisplay } from '@shared/authSignup';
import { visibleSupplierField } from '@shared/supplierFieldText';
import { listTaxInvoices, updateTaxInvoiceSupplier, type TaxInvoiceSupplier } from '../../api/taxInvoices';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

const FIELD =
  'mt-1 h-11 w-full rounded-lg px-3 text-sm text-slate-900 ring-1 ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const GHOST =
  'h-11 rounded-lg px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const PRIMARY =
  'h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function SupplierInfoModal({
  operatingCompanyId,
  corpNum,
  initial,
  onClose,
  onSaved,
}: {
  operatingCompanyId: string;
  corpNum: string;
  initial: { corpName: string; ceoName: string; addr: string; bizType: string; bizClass: string; email: string; tel: string };
  onClose: () => void;
  onSaved: (supplier: TaxInvoiceSupplier) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [corpName, setCorpName] = useState(visibleSupplierField(initial.corpName));
  const [ceoName, setCeoName] = useState(visibleSupplierField(initial.ceoName));
  const [addr, setAddr] = useState(visibleSupplierField(initial.addr));
  const [bizType, setBizType] = useState(initial.bizType);
  const [bizClass, setBizClass] = useState(initial.bizClass);
  const [email, setEmail] = useState(initial.email);
  const [tel, setTel] = useState(initial.tel);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    listTaxInvoices(new URLSearchParams({ datePreset: 'today', limit: '1' }))
      .then((res) => {
        if (stop) return;
        const latest = res.brands.find((brand) => brand.id === operatingCompanyId)?.supplier;
        if (!latest) return;
        setCorpName(visibleSupplierField(latest.corpName));
        setCeoName(visibleSupplierField(latest.ceoName));
        setAddr(visibleSupplierField(latest.addr));
        setBizType(latest.bizType);
        setBizClass(latest.bizClass);
        setEmail(latest.email);
        setTel(latest.tel);
      })
      .catch(() => {
        if (!stop) setError('공급자 정보를 다시 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!stop) setLoading(false);
      });
    return () => { stop = true; };
  }, [operatingCompanyId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateTaxInvoiceSupplier(operatingCompanyId, {
        corpName,
        ceoName,
        addr1: addr,
        bizType,
        bizClass,
        contactEmail: email,
        contactTel: tel,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : '공급자 정보를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 lg:items-center" role="presentation" onMouseDown={onClose}>
      <div
        className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white lg:max-w-[560px] lg:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="공급자 정보 수정"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">공급자 정보 수정</h2>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" onFocusCapture={onFieldFocus} aria-busy={loading}>
          <fieldset disabled={loading} className="min-w-0 space-y-3 disabled:opacity-60">
          <label className="block text-xs text-slate-600">
            사업자등록번호
            <input className={`${FIELD} bg-slate-50`} value={formatBizNumberDisplay(corpNum) || '—'} readOnly aria-label="사업자등록번호" />
          </label>
          <label className="block text-xs text-slate-600">
            상호
            <input className={FIELD} value={corpName} placeholder="상호" aria-label="상호" onChange={(event) => setCorpName(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            대표자명 *
            <input className={FIELD} value={ceoName} placeholder="대표자명" aria-label="대표자명" onChange={(event) => setCeoName(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            사업장 주소 *
            <input className={FIELD} value={addr} placeholder="사업장 주소" aria-label="사업장 주소" onChange={(event) => setAddr(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">
              업태
              <input className={FIELD} value={bizType} aria-label="업태" onChange={(event) => setBizType(event.target.value)} />
            </label>
            <label className="block text-xs text-slate-600">
              종목
              <input className={FIELD} value={bizClass} aria-label="종목" onChange={(event) => setBizClass(event.target.value)} />
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            담당 이메일 *
            <input className={FIELD} type="email" inputMode="email" value={email} aria-label="담당 이메일" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-600">
            담당 전화
            <input className={FIELD} type="tel" inputMode="tel" value={tel} aria-label="담당 전화" onChange={(event) => setTel(event.target.value)} />
          </label>
          {loading ? <p className="text-xs text-slate-500">불러오는 중…</p> : null}
          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          </fieldset>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" className={GHOST} disabled={saving} onClick={onClose}>취소</button>
          <button type="button" className={PRIMARY} disabled={saving || loading} onClick={() => void save()}>{saving ? '저장 중…' : '저장'}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
