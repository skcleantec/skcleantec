import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createBankDepositMuted,
  updateBankDepositMuted,
  type BankDepositMutedItem,
  type BankDepositMutedKind,
} from '../../api/bankDeposits';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';

export const MUTED_KIND_LABEL: Record<string, string> = { PG: 'PG사', PARTNER: '협력업체', OTHER: '기타' };

const KIND_OPTIONS: { value: BankDepositMutedKind; label: string }[] = [
  { value: 'PG', label: 'PG사' },
  { value: 'PARTNER', label: '협력업체' },
  { value: 'OTHER', label: '기타' },
];

/** 고정 입금처 등록·수정 작은 창 — 시안 「고정 입금처로 등록」 */
export function BankDepositMuteDialog({
  token,
  brands,
  initial,
  editing,
  openSameNameCount = 0,
  onClose,
  onSaved,
}: {
  token: string;
  brands: { id: string; name: string }[];
  /** 입금내역 행에서 열 때 미리 채울 값 */
  initial?: { depositorName: string; operatingCompanyId: string | null };
  /** 목록에서 수정할 때 */
  editing?: BankDepositMutedItem | null;
  /** 아직 확인 안 한 같은 이름 입금 수 (행에서 열 때) */
  openSameNameCount?: number;
  onClose: () => void;
  onSaved: (item: BankDepositMutedItem, ignoredIds: string[]) => void;
}) {
  const [depositorName, setDepositorName] = useState(editing?.depositorName ?? initial?.depositorName ?? '');
  const [prefix, setPrefix] = useState((editing?.matchMode ?? 'exact') === 'prefix');
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '');
  const [kind, setKind] = useState<BankDepositMutedKind>((editing?.kind as BankDepositMutedKind) ?? 'PG');
  const [brandId, setBrandId] = useState(editing?.operatingCompanyId ?? initial?.operatingCompanyId ?? '');
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [ignorePast, setIgnorePast] = useState(openSameNameCount > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (busy) return;
    if (depositorName.trim().replace(/\s/g, '').length < 2) {
      setError('입금자명을 2자 이상 적어 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        depositorName: depositorName.trim(),
        displayName: displayName.trim() || undefined,
        kind,
        matchMode: prefix ? ('prefix' as const) : ('exact' as const),
        operatingCompanyId: brandId || null,
        memo: memo.trim() || null,
      };
      if (editing) {
        const r = await updateBankDepositMuted(token, editing.id, body);
        onSaved(r.item, []);
      } else {
        const r = await createBankDepositMuted(token, { ...body, ignorePast: ignorePast && openSameNameCount > 0 });
        onSaved(r.item, r.ignoredIds);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-9 rounded-lg bg-slate-100 px-3 text-fluid-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="고정 입금처 등록">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative flex w-[min(440px,100%)] flex-col rounded-2xl bg-white shadow-2xl">
        <div className="px-5 pb-3 pt-4 pr-14">
          <p className="text-fluid-sm font-bold text-slate-900">{editing ? '고정 입금처 수정' : '고정 입금처로 등록'}</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">앞으로 이 입금자는 알림 없이 입금내역에만 쌓여요.</p>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-3.5 px-5">
          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <label htmlFor="bd-mute-name" className="text-fluid-xs text-slate-600">
              입금자명
            </label>
            <input
              id="bd-mute-name"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              className={`${field} w-full lg:w-[240px]`}
              placeholder="문자에 찍힌 입금자명"
              autoFocus={!editing && !initial?.depositorName}
            />
            <span />
            <label className="flex items-center gap-1.5 text-fluid-2xs text-slate-600">
              <input type="checkbox" checked={prefix} onChange={(e) => setPrefix(e.target.checked)} className="size-3.5" />
              뒷자리 숫자·기호가 달라도 같은 입금처로 보기 <span className="text-slate-400">(예: KSNET_1234)</span>
            </label>
          </div>

          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <label htmlFor="bd-mute-display" className="text-fluid-xs text-slate-600">
              표시명
            </label>
            <input
              id="bd-mute-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`${field} w-full lg:w-[240px]`}
              placeholder="비우면 입금자명 그대로"
            />
          </div>

          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <span className="text-fluid-xs text-slate-600">구분</span>
            <SegmentedControl value={kind} onChange={setKind} options={KIND_OPTIONS} ariaLabel="고정 입금처 구분" className="lg:w-[240px]" />
          </div>

          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <label htmlFor="bd-mute-brand" className="text-fluid-xs text-slate-600">
              브랜드
            </label>
            <select id="bd-mute-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`${field} w-full lg:w-[240px]`}>
              <option value="">모든 브랜드</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[88px_1fr] items-center gap-2">
            <label htmlFor="bd-mute-memo" className="text-fluid-xs text-slate-600">
              메모
            </label>
            <input
              id="bd-mute-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={`${field} w-full lg:w-[320px]`}
              placeholder="예: 카드 결제 정산 (선택)"
            />
          </div>

          {!editing && openSameNameCount > 0 ? (
            <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2.5">
              <label className="flex items-start gap-2 text-fluid-2xs leading-relaxed text-slate-600">
                <input type="checkbox" checked={ignorePast} onChange={(e) => setIgnorePast(e.target.checked)} className="mt-0.5 size-3.5" />
                <span>
                  아직 확인 안 한 같은 이름 입금 <b className="text-slate-900">{openSameNameCount}건</b>도 지금 함께 「고정 입금처」로 접기
                </span>
              </label>
            </div>
          ) : null}

          {error ? <p className="text-fluid-2xs text-rose-700">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4 pt-3.5">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? '저장 중' : editing ? '저장' : '등록하고 알림 끄기'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
