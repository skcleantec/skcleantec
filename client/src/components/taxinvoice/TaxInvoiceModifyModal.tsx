import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { LineMdIcon } from '../ui/LineMdIcon';
import { modifyTaxInvoice, type TaxInvoiceRow } from '../../api/taxInvoices';
import { formatSignedWon } from '../../utils/signedWon';

const INPUT = 'min-h-9 w-full rounded-lg border border-slate-300 px-2 text-fluid-xs';

function md(writeDate: string | null | undefined): string {
  const text = (writeDate ?? '').replace(/\D/g, '');
  if (text.length < 8) return '';
  return `${Number(text.slice(4, 6))}.${Number(text.slice(6, 8))}`;
}

export function TaxInvoiceModifyModal({
  row,
  onClose,
  onDone,
}: {
  row: TaxInvoiceRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [kind, setKind] = useState<'release' | 'supply' | 'correction'>('release');
  const [newTotal, setNewTotal] = useState('');
  const [corpName, setCorpName] = useState(row.buyerCorpName);
  const [corpNum, setCorpNum] = useState(row.buyerCorpNum ?? '');
  const [ceoName, setCeoName] = useState('');
  const [email, setEmail] = useState('');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = md(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10).replace(/-/g, ''));

  const preview = useMemo(() => {
    if (kind === 'release') {
      return { amount: -Math.abs(row.totalAmount), sheets: 1, cost: 150, note: `작성일 오늘 (${today}) · 비용 150원 · 받는 곳에도 메일로 가요` };
    }
    if (kind === 'supply') {
      const next = Number(newTotal.replace(/[^\d-]/g, ''));
      const diff = Number.isFinite(next) && newTotal.trim() ? next - row.totalAmount : null;
      return { amount: diff, sheets: 1, cost: 150, note: `작성일 오늘 (${today}) · 차액만 · 비용 150원` };
    }
    return { amount: row.totalAmount, sheets: 2, cost: 300, note: '원래 건 마이너스 1장 + 고친 건 1장 · 비용 300원' };
  }, [kind, newTotal, row.totalAmount, today]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await modifyTaxInvoice(row.id, {
        kind,
        newTotal: kind === 'supply' ? Number(newTotal.replace(/[^\d-]/g, '')) : undefined,
        buyer: kind === 'correction' ? { corpName, corpNum, ceoName, email, addr } : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정세금계산서 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = preview.amount == null
    ? '수정 발급'
    : preview.sheets === 2
      ? '2장 수정 발급'
      : `${formatSignedWon(preview.amount)} 수정 발급`;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tax-modify-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 id="tax-modify-title" className="text-fluid-sm font-semibold text-slate-900">수정세금계산서 발급</h2>
          <button type="button" aria-label="닫기" className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" onClick={onClose} disabled={busy}>
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
          <p className="text-fluid-xs text-slate-700">발급된 세금계산서는 수정세금계산서로 바로잡아요. 국세청 전송 전이면 발급 취소도 할 수 있어요.</p>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-fluid-xs">
            <dt className="text-slate-500">원래 건</dt>
            <dd>{md(row.writeDate) || '—'} · {formatSignedWon(row.totalAmount)}</dd>
            <dt className="text-slate-500">받는 곳</dt>
            <dd className="truncate" title={row.buyerCorpName}>{row.buyerCorpName}</dd>
            <dt className="text-slate-500">승인번호</dt>
            <dd className="truncate tabular-nums" title={row.ntsSendKey ?? ''}>{row.ntsSendKey || '—'}</dd>
          </dl>
          <fieldset className="space-y-2">
            <Choice checked={kind === 'release'} onPick={() => setKind('release')} title="거래가 취소됐어요 (계약의 해제)" body="같은 금액을 마이너스로 발급해 원래 건을 없앤 것과 같게 만들어요." />
            <Choice checked={kind === 'supply'} onPick={() => setKind('supply')} title="금액이 바뀌었어요 (공급가액 변동)" body="늘거나 줄어든 차액만 발급해요." />
            {kind === 'supply' ? (
              <label className="block text-fluid-xs text-slate-700">
                바뀐 합계
                <input className={INPUT} inputMode="numeric" value={newTotal} onChange={(event) => setNewTotal(event.target.value)} />
              </label>
            ) : null}
            <Choice checked={kind === 'correction'} onPick={() => setKind('correction')} title="받는 곳·내용을 잘못 적었어요 (기재사항 착오)" body="원래 건을 마이너스로, 고친 건을 새로 — 2장이 발급돼요." />
            {kind === 'correction' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-fluid-xs text-slate-700">상호<input className={INPUT} value={corpName} onChange={(event) => setCorpName(event.target.value)} /></label>
                <label className="text-fluid-xs text-slate-700">사업자번호<input className={INPUT} value={corpNum} onChange={(event) => setCorpNum(event.target.value)} /></label>
                <label className="text-fluid-xs text-slate-700">대표자<input className={INPUT} value={ceoName} onChange={(event) => setCeoName(event.target.value)} /></label>
                <label className="text-fluid-xs text-slate-700">이메일<input className={INPUT} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label className="text-fluid-xs text-slate-700 sm:col-span-2">주소<input className={INPUT} value={addr} onChange={(event) => setAddr(event.target.value)} /></label>
              </div>
            ) : null}
          </fieldset>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <p className="text-fluid-2xs text-slate-500">발급될 수정세금계산서</p>
            <p className={`tabular-nums ${preview.amount == null ? 'text-fluid-sm font-semibold text-slate-900' : 'text-[20px] font-bold text-[#b42318]'}`}>{preview.amount == null ? '차액을 입력해 주세요' : formatSignedWon(preview.amount)}</p>
            <p className="text-fluid-xs text-slate-600">{preview.note}</p>
          </div>
          {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-3 py-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>그만두기</Button>
          <Button variant="primary" size="md" disabled={busy || (kind === 'supply' && preview.amount == null)} onClick={() => void submit()}>
            {busy ? '발급 중…' : buttonLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function Choice({ checked, onPick, title, body }: { checked: boolean; onPick: () => void; title: string; body: string }) {
  return (
    <label className={`block cursor-pointer rounded-xl border px-3 py-2 ${checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <span className="flex items-start gap-2">
        <input type="radio" className="mt-1" checked={checked} onChange={onPick} />
        <span>
          <span className="block text-fluid-xs font-semibold text-slate-900">{title}</span>
          <span className="block text-fluid-2xs text-slate-600">{body}</span>
        </span>
      </span>
    </label>
  );
}
