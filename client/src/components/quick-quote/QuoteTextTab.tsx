import { useMemo, useState } from 'react';
import {
  applySoomgoQuotePlaceholders,
  computeSoomgoEventPriceWon,
  formatSoomgoQuoteWon,
} from '@shared/telecrmSoomgoQuotePlaceholders';
import { quotePreviewSegments } from '@shared/quickQuotePreview';
import { manwonDigitsToWon } from '@shared/quickQuoteArea';
import { Button } from '../ui/Button';
import type { QuickQuoteKind } from '../../api/quickQuote';
import { copyQuoteText, saveQuoteImages } from './quoteClipboard';

function PreviewText({ text }: { text: string }) {
  const parts = quotePreviewSegments(text);
  return (
    <p className="whitespace-pre-wrap break-keep text-fluid-sm leading-relaxed text-slate-800">
      {parts.map((part, i) =>
        part.emphasis ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function QuoteTextTab({
  kinds,
  kindId,
  onKindId,
  manwon,
  onManwon,
  pyeong,
  onPyeong,
  onToast,
}: {
  kinds: QuickQuoteKind[];
  kindId: string;
  onKindId: (id: string) => void;
  manwon: string;
  onManwon: (value: string) => void;
  pyeong: string;
  onPyeong: (value: string) => void;
  onToast: (message: string) => void;
}) {
  const kind = kinds.find((k) => k.id === kindId) ?? kinds[0];
  const steps = kind?.steps ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);

  const quoteWon = manwonDigitsToWon(manwon);
  const payback = kind?.paybackWon ?? 0;
  const eventWon = computeSoomgoEventPriceWon(quoteWon, payback);

  const applied = useMemo(() => {
    return steps.map((step) => {
      if (step.type !== 'text') return step;
      return {
        type: 'text' as const,
        text: applySoomgoQuotePlaceholders(step.text, {
          quoteTotalWon: quoteWon,
          paybackWon: payback,
          pyeong: pyeong.trim(),
        }),
      };
    });
  }, [payback, pyeong, quoteWon, steps]);

  const current = applied[stepIndex];
  const textTotal = applied.filter((s) => s.type === 'text').length;
  const textOrdinal =
    current?.type === 'text' ? applied.slice(0, stepIndex + 1).filter((s) => s.type === 'text').length : 0;
  const copiedBefore = done.slice(0, stepIndex).some(Boolean);

  const resetProgress = () => {
    setStepIndex(0);
    setDone([]);
  };

  const markAndAdvance = () => {
    setDone((prev) => {
      const next = [...prev];
      next[stepIndex] = true;
      return next;
    });
    if (stepIndex < applied.length - 1) setStepIndex(stepIndex + 1);
  };

  const onPrimary = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (current.type === 'text') {
        const ok = await copyQuoteText(current.text);
        if (!ok) {
          onToast('복사하지 못했어요. 문구를 길게 눌러 복사해 주세요.');
          return;
        }
        onToast('복사했어요 · 숨고에 붙여넣기 하세요');
        markAndAdvance();
        return;
      }
      const result = await saveQuoteImages(current.urls);
      if (result === 'cancelled') return;
      if (result === 'opened') onToast('사진이 새 탭에 열렸어요. 길게 눌러 저장하세요.');
      else if (result === 'shared') onToast('사진 저장 창을 열었어요.');
      else onToast('저장할 사진이 없어요.');
      if (result === 'shared' || result === 'opened') markAndAdvance();
    } finally {
      setBusy(false);
    }
  };

  let primaryLabel = '복사할 문구가 없어요';
  if (current?.type === 'text' && textTotal > 0) {
    primaryLabel = `${copiedBefore ? '다음 복사' : '복사하기'} (${textOrdinal}/${textTotal})`;
  } else if (current?.type === 'images') {
    primaryLabel = '사진 저장';
  }

  const priceLine =
    quoteWon == null
      ? '견적(만원)을 입력하면 금액이 들어가요.'
      : payback > 0 && eventWon != null
        ? `견적가 ${formatSoomgoQuoteWon(quoteWon)} · 페이백 빼면 이벤트가 ${formatSoomgoQuoteWon(eventWon)}`
        : `견적가 ${formatSoomgoQuoteWon(quoteWon)}`;

  return (
    <div className="flex flex-col gap-2 px-3 pb-24 pt-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {kinds.map((item) => {
          const on = item.id === kind?.id;
          return (
            <Button
              key={item.id}
              variant="quiet"
              size="sm"
              className={`shrink-0 ${on ? '!bg-white shadow-thumb' : ''}`}
              onClick={() => {
                onKindId(item.id);
                resetProgress();
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </div>

      <label className="block rounded-2xl bg-white p-3 shadow-card">
        <span className="text-fluid-2xs text-slate-500">견적 (만원)</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          value={manwon}
          placeholder="15"
          className="mt-1 w-full bg-transparent text-center text-fluid-xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
          onChange={(e) => {
            onManwon(e.target.value.replace(/\D/g, '').slice(0, 5));
            resetProgress();
          }}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
      </label>

      <label className="block rounded-2xl bg-white px-3 py-2 shadow-card">
        <span className="text-fluid-2xs text-slate-500">평수 (선택)</span>
        <input
          inputMode="decimal"
          value={pyeong}
          placeholder="34"
          className="mt-0.5 w-full bg-transparent text-fluid-sm text-slate-900 outline-none placeholder:text-slate-300"
          onChange={(e) => {
            onPyeong(e.target.value.replace(/[^\d.]/g, '').slice(0, 6));
            resetProgress();
          }}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
        />
      </label>

      <p className="px-1 text-fluid-2xs leading-snug text-slate-500">{priceLine}</p>

      <div className="rounded-2xl bg-white p-3 shadow-card">
        {current?.type === 'text' ? (
          <PreviewText text={current.text} />
        ) : current?.type === 'images' ? (
          <div className="flex gap-2 overflow-x-auto">
            {current.urls.map((url) => (
              <img key={url} src={url} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        ) : (
          <p className="text-fluid-sm text-slate-500">문구가 아직 없어요. 문구 관리에서 넣어 주세요.</p>
        )}
      </div>

      {applied.length > 1 ? (
        <ol className="space-y-1">
          {applied.map((step, index) => (
            <li key={index}>
              <Button
                variant="quiet"
                size="sm"
                nowrap={false}
                className={`!h-auto w-full !justify-start gap-2 !px-2 !py-1.5 ${index === stepIndex ? '!bg-white shadow-thumb' : ''}`}
                onClick={() => setStepIndex(index)}
              >
                <span className={`shrink-0 ${done[index] ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {done[index] ? (step.type === 'text' ? '✓복사됨' : '✓저장') : `${index + 1}`}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {step.type === 'text' ? step.text : `사진 ${step.urls.length}장`}
                </span>
              </Button>
            </li>
          ))}
        </ol>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-3 pt-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Button
          variant="primary"
          size="lg"
          className="w-full shadow-bar"
          disabled={!current || busy}
          onClick={() => void onPrimary()}
        >
          {busy ? '잠시만요' : primaryLabel}
        </Button>
      </div>
    </div>
  );
}
