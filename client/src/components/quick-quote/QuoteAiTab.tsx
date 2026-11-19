import { useEffect, useState } from 'react';
import { ORDER_FORM_CLEANING_KIND_OPTIONS } from '@shared/orderFormCleaningKind';
import { fetchTelecrmOrderOptions, type TelecrmOrderOptionDto } from '../../api/telecrm';
import {
  fetchTelecrmPropertyChoiceOptions,
  previewTelecrmAiQuote,
} from '../../api/telecrmQuoteCrewLearning';
import type { TelecrmPropertyChoiceOption } from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../stores/auth';
import { Button } from '../ui/Button';

type Props = {
  operatingCompanyId: string;
  onUseQuote: (manwon: string, pyeong: string) => void;
};

function won(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <Button variant="quiet" size="sm" className={on ? '!bg-white shadow-thumb' : ''} onClick={onClick}>
      {label}
    </Button>
  );
}

export function QuoteAiTab({ operatingCompanyId, onUseQuote }: Props) {
  const [pyeong, setPyeong] = useState('');
  const [rooms, setRooms] = useState('');
  const [baths, setBaths] = useState('');
  const [balcony, setBalcony] = useState('');
  const [oneRoom, setOneRoom] = useState(false);
  const [cleaning, setCleaning] = useState('');
  const [property, setProperty] = useState('');
  const [memo, setMemo] = useState('');
  const [properties, setProperties] = useState<TelecrmPropertyChoiceOption[]>([]);
  const [options, setOptions] = useState<TelecrmOrderOptionDto[]>([]);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountWon, setAmountWon] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let alive = true;
    void Promise.all([
      fetchTelecrmPropertyChoiceOptions(token).catch(() => null),
      fetchTelecrmOrderOptions(token).catch(() => null),
    ]).then(([propertyRes, optionRes]) => {
      if (!alive) return;
      setProperties(propertyRes?.propertyTypes ?? []);
      setOptions((optionRes?.items ?? []).filter((item) => item.label.trim()));
    });
    return () => {
      alive = false;
    };
  }, []);

  const visibleOptions = showAllOptions ? options : options.slice(0, 24);
  const pyeongNum = Number(pyeong);
  const ready = Number.isFinite(pyeongNum) && pyeongNum > 0;

  const calc = async () => {
    const token = getToken();
    if (!token || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await previewTelecrmAiQuote(token, {
        pyeong: pyeongNum,
        roomCount: rooms ? Number(rooms) : null,
        bathroomCount: baths ? Number(baths) : null,
        balconyCount: balcony ? Number(balcony) : null,
        isOneRoom: oneRoom,
        propertyType: property || null,
        operatingCompanyId,
      });
      if (!res.quote) {
        setAmountWon(null);
        setReason('');
        setError('아직 추천할 금액이 없어요.');
        return;
      }
      const chosen = options.filter((item) => picked.includes(item.id));
      const extra = chosen.reduce((sum, item) => sum + (item.priceAmount ?? 0), 0);
      const bits = [
        cleaning,
        ...res.quote.parts.map((part) => part.label.replace(/^규칙:\s*/, '')),
        ...chosen.map((item) => item.label),
      ];
      if (memo.trim()) bits.push(memo.trim());
      const total = Math.max(10_000, Math.round((res.quote.amountWon + extra) / 10_000) * 10_000);
      setAmountWon(total);
      setReason(bits.filter(Boolean).join(' · '));
    } catch (e) {
      setAmountWon(null);
      setError(e instanceof Error ? e.message : '추천가를 계산하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const manwon = amountWon != null ? String(Math.max(1, Math.round(amountWon / 10_000))) : '';

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <label className="rounded-2xl bg-white p-3 shadow-card">
        <span className="text-fluid-2xs text-slate-500">평수</span>
        <input
          inputMode="decimal"
          value={pyeong}
          placeholder="34"
          className="mt-1 w-full bg-transparent text-center text-fluid-xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
          onChange={(e) => setPyeong(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['방', rooms, setRooms],
          ['화장실', baths, setBaths],
          ['베란다', balcony, setBalcony],
        ].map(([label, value, set]) => (
          <label key={String(label)} className="rounded-2xl bg-white p-2 shadow-card">
            <span className="text-fluid-2xs text-slate-500">{label as string}</span>
            <input
              inputMode="numeric"
              value={value as string}
              placeholder="0"
              className="mt-1 w-full bg-transparent text-center text-fluid-base font-semibold tabular-nums text-slate-900 outline-none"
              onChange={(e) => (set as (next: string) => void)(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        <Chip on={oneRoom} label="원룸" onClick={() => setOneRoom((prev) => !prev)} />
        {ORDER_FORM_CLEANING_KIND_OPTIONS.map((item) => (
          <Chip
            key={item.value}
            on={cleaning === item.label}
            label={item.label}
            onClick={() => setCleaning((prev) => (prev === item.label ? '' : item.label))}
          />
        ))}
      </div>

      {properties.length ? (
        <div className="flex flex-wrap gap-1">
          {properties.map((item) => (
            <Chip
              key={item.value}
              on={property === item.value}
              label={item.label}
              onClick={() => setProperty((prev) => (prev === item.value ? '' : item.value))}
            />
          ))}
        </div>
      ) : null}

      {options.length ? (
        <div className="flex flex-wrap gap-1">
          {visibleOptions.map((item) => (
            <Chip
              key={item.id}
              on={picked.includes(item.id)}
              label={item.label}
              onClick={() =>
                setPicked((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))
              }
            />
          ))}
          {options.length > 24 && !showAllOptions ? (
            <Button variant="quiet" size="sm" onClick={() => setShowAllOptions(true)}>
              옵션 더 보기
            </Button>
          ) : null}
        </div>
      ) : null}

      <label className="rounded-2xl bg-white p-3 shadow-card">
        <span className="text-fluid-2xs text-slate-500">메모</span>
        <input
          value={memo}
          maxLength={80}
          placeholder="참고할 말"
          className="mt-1 w-full bg-transparent text-fluid-sm text-slate-900 outline-none placeholder:text-slate-300"
          onChange={(e) => setMemo(e.target.value)}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
      </label>

      <Button variant="secondary" className="w-full" disabled={!ready || busy} onClick={() => void calc()}>
        {busy ? '계산하는 중' : '추천가 보기'}
      </Button>

      {error ? <p className="px-1 text-fluid-xs text-red-600">{error}</p> : null}
      {amountWon != null ? (
        <div className="rounded-2xl bg-white p-3 shadow-card">
          <p className="text-fluid-lg font-semibold tabular-nums text-slate-900">{won(amountWon)}</p>
          {reason ? <p className="mt-1 line-clamp-2 text-fluid-xs text-slate-600">{reason}</p> : null}
        </div>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-3 pt-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-bar"
          disabled={amountWon == null}
          onClick={() => {
            if (!manwon) return;
            onUseQuote(manwon, pyeong);
          }}
        >
          {amountWon != null ? '이 금액으로 견적 문구 만들기 →' : '추천가를 먼저 확인해 주세요'}
        </Button>
      </div>
    </div>
  );
}
