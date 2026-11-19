import { useEffect, useState } from 'react';
import { ORDER_FORM_CLEANING_KIND_OPTIONS } from '@shared/orderFormCleaningKind';
import { fetchTelecrmOrderOptions, type TelecrmOrderOptionDto } from '../../api/telecrm';
import {
  fetchTelecrmPropertyChoiceOptions,
  fetchTelecrmQuoteCrewLearningHints,
  previewTelecrmAiQuote,
} from '../../api/telecrmQuoteCrewLearning';
import type { TelecrmPropertyChoiceOption, TelecrmQuoteCrewLearningHints } from '@shared/telecrmQuoteCrewLearning';
import { getToken } from '../../stores/auth';
import { Button } from '../ui/Button';
import { QuoteBottomBar, QuoteChip, quoteBottomButton, quoteCard } from './quoteChrome';
import { QuoteAiSimilarCard } from './QuoteAiSimilarCard';

type Props = {
  operatingCompanyId: string;
  onUseQuote: (manwon: string, pyeong: string) => void;
};

function won(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
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
  const [reasonOpen, setReasonOpen] = useState(false);
  const [hints, setHints] = useState<TelecrmQuoteCrewLearningHints | null>(null);
  const [hintsReady, setHintsReady] = useState(false);

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
    setHints(null);
    setHintsReady(false);
    try {
      const hintQuery = {
        pyeong: String(pyeongNum),
        roomCount: rooms || undefined,
        bathroomCount: baths || undefined,
        balconyCount: balcony || undefined,
        propertyType: property || undefined,
        isOneRoom: oneRoom,
        operatingCompanyId,
      };
      const [quoteResult, hintRes] = await Promise.all([
        previewTelecrmAiQuote(token, {
          pyeong: pyeongNum,
          roomCount: rooms ? Number(rooms) : null,
          bathroomCount: baths ? Number(baths) : null,
          balconyCount: balcony ? Number(balcony) : null,
          isOneRoom: oneRoom,
          propertyType: property || null,
          operatingCompanyId,
        }).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        ),
        fetchTelecrmQuoteCrewLearningHints(token, hintQuery).catch(() => null),
      ]);
      setHints(hintRes);
      setHintsReady(true);
      if (!quoteResult.ok) {
        setAmountWon(null);
        setReason('');
        setError(quoteResult.error instanceof Error ? quoteResult.error.message : '추천가를 계산하지 못했어요.');
        return;
      }
      const res = quoteResult.value;
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
      setHintsReady(true);
      setError(e instanceof Error ? e.message : '추천가를 계산하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setAmountWon(null);
    setReason('');
    setReasonOpen(false);
    setHints(null);
    setHintsReady(false);
    setError(null);
  }, [balcony, baths, cleaning, memo, oneRoom, picked, property, pyeong, rooms]);

  const manwon = amountWon != null ? String(Math.max(1, Math.round(amountWon / 10_000))) : '';

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <label className="rounded-2xl border-2 border-[#1f4fb8] bg-white p-3">
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
          <label key={String(label)} className={`p-2 ${quoteCard}`}>
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

      <section className={`p-3 ${quoteCard}`} aria-label="청소 종류">
        <p className="mb-1.5 flex items-baseline justify-between text-fluid-2xs font-semibold text-slate-700">
          청소 종류 <span className="font-normal text-slate-400">하나 고르기</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {ORDER_FORM_CLEANING_KIND_OPTIONS.map((item) => (
            <QuoteChip
              key={item.value}
              on={cleaning === item.label}
              label={item.label}
              onClick={() => setCleaning((prev) => (prev === item.label ? '' : item.label))}
            />
          ))}
        </div>
      </section>

      <section className={`p-3 ${quoteCard}`} aria-label="건물 형태">
        <p className="mb-1.5 flex items-baseline justify-between text-fluid-2xs font-semibold text-slate-700">
          건물 형태 <span className="font-normal text-slate-400">하나 고르기</span>
        </p>
        <div className="flex flex-wrap gap-1">
          {properties.map((item) => (
            <QuoteChip
              key={item.value}
              on={property === item.value}
              label={item.label}
              onClick={() => setProperty((prev) => (prev === item.value ? '' : item.value))}
            />
          ))}
          <QuoteChip on={oneRoom} label="원룸" onClick={() => setOneRoom((prev) => !prev)} />
        </div>
      </section>

      {options.length ? (
        <section className={`p-3 ${quoteCard}`} aria-label="추가 옵션">
          <p className="mb-1.5 flex items-baseline justify-between text-fluid-2xs font-semibold text-slate-700">
            <span>
              추가 옵션{picked.length ? <span className="ml-1 text-blue-700">{picked.length}개 선택</span> : null}
            </span>
            <span className="font-normal text-slate-400">여러 개 고르기</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {visibleOptions.map((item) => (
              <QuoteChip
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
        </section>
      ) : null}

      <label className={`p-3 ${quoteCard}`}>
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

      {error ? <p className="px-1 text-fluid-xs text-red-600">{error}</p> : null}
      {amountWon != null ? (
        <div className={`p-3 ${quoteCard}`}>
          <p className="text-fluid-lg font-semibold tabular-nums text-slate-900">{won(amountWon)}</p>
          {reason ? (
            <div className="mt-1">
              <Button variant="quiet" size="sm" className="!px-0" onClick={() => setReasonOpen((prev) => !prev)}>
                {reasonOpen ? '금액 근거 접기' : '금액 근거 보기'}
              </Button>
              {reasonOpen ? <p className="mt-1 text-fluid-xs text-slate-600">{reason}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {hintsReady ? (
        <QuoteAiSimilarCard
          hints={hints}
          onUseAmount={(amount, nextPyeong) => {
            onUseQuote(String(Math.max(1, Math.round(amount / 10_000))), nextPyeong || pyeong);
          }}
        />
      ) : null}

      <QuoteBottomBar>
        {amountWon != null ? (
          <Button variant="primary" size="lg" className={quoteBottomButton} onClick={() => onUseQuote(manwon, pyeong)}>
            이 금액으로 견적 문구 만들기 →
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className={quoteBottomButton}
            disabled={!ready || busy}
            onClick={() => void calc()}
          >
            {busy ? '계산하는 중' : '추천가 보기'}
          </Button>
        )}
      </QuoteBottomBar>
    </div>
  );
}
