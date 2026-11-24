import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BankDepositDuplicateError, createManualBankDeposit } from '../../api/bankDeposits';
import { kstTodayYmd } from '../../utils/dateFormat';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { Button } from '../ui/Button';

type Brand = { id: string; name: string };

function nowHm(): string {
  return new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 5);
}

/** 문자로 못 받은 입금을 직접 넣는다. 넣은 뒤에는 문자로 온 입금과 똑같이 맞추기·알림을 탄다. */
export function BankDepositManualDialog({
  token,
  brands,
  defaultDate,
  onClose,
  onCreated,
}: {
  token: string;
  brands: Brand[];
  defaultDate?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [date, setDate] = useState(defaultDate || kstTodayYmd());
  const [time, setTime] = useState(nowHm());
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const amountWon = Number(amount.replace(/[^\d]/g, ''));
  const ready = Boolean(date && time && name.trim() && Number.isFinite(amountWon) && amountWon > 0);

  const save = async (force: boolean) => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createManualBankDeposit(token, {
        ...(brandId ? { operatingCompanyId: brandId } : {}),
        amountWon,
        depositorName: name.trim(),
        depositedAt: new Date(`${date}T${time}:00+09:00`).toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(force ? { force: true } : {}),
      });
      onCreated();
    } catch (e) {
      if (e instanceof BankDepositDuplicateError) {
        setDuplicate(true);
        setError('같은 시각·금액·이름의 입금이 이미 목록에 있어요. 정말 따로 들어온 입금이면 한 번 더 눌러 추가하세요.');
      } else {
        setError(e instanceof Error ? e.message : '추가하지 못했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const field = 'h-9 w-full rounded-lg border border-slate-300 px-2.5 text-fluid-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="입금 직접 추가">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative w-[min(440px,100%)] rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-4 py-3 pr-14">
          <p className="text-fluid-sm font-bold text-slate-900">입금 직접 추가</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
            문자로 들어오지 않은 입금을 통장 내역을 보고 넣어요. 넣으면 접수와 맞추고 알림도 똑같이 갑니다.
          </p>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="grid gap-3 px-4 py-4">
          {brands.length > 1 ? (
            <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
              브랜드
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`${field} bg-white`}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
              입금 날짜
              <input type="date" value={date} max={kstTodayYmd()} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
              시각
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
              금액
              <input
                value={amount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, '');
                  setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
                  setDuplicate(false);
                }}
                inputMode="numeric"
                placeholder="20,000"
                className={`${field} tabular-nums`}
              />
            </label>
            <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
              입금자명
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDuplicate(false);
                }}
                placeholder="통장에 찍힌 이름 그대로"
                className={field}
                autoComplete="off"
              />
            </label>
          </div>
          <label className="grid gap-1 text-fluid-2xs font-semibold text-slate-600">
            메모 (선택)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 문자 누락, 통장 내역 보고 추가" className={field} />
          </label>
          {error ? <p className={`text-fluid-2xs leading-relaxed ${duplicate ? 'text-amber-800' : 'text-rose-700'}`}>{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button variant="primary" disabled={!ready || busy} onClick={() => void save(duplicate)}>
            {busy ? '추가하는 중' : duplicate ? '그래도 추가' : '추가하기'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
