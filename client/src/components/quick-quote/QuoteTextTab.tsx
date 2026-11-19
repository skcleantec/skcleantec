import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  applySoomgoQuotePlaceholders,
  computeSoomgoEventPriceWon,
  formatSoomgoQuoteWon,
} from '@shared/telecrmSoomgoQuotePlaceholders';
import { quotePreviewSegments } from '@shared/quickQuotePreview';
import { manwonDigitsToWon } from '@shared/quickQuoteArea';
import { Button } from '../ui/Button';
import { QuoteBottomBar, QuoteChip, quoteBottomButton, quoteCard } from './quoteChrome';
import type { QuickQuoteKind } from '../../api/quickQuote';
import { copyQuoteText, saveQuoteImages } from './quoteClipboard';

function PreviewText({ text, boxRef }: { text: string; boxRef: RefObject<HTMLParagraphElement | null> }) {
  const parts = quotePreviewSegments(text);
  return (
    <p ref={boxRef} className="select-text whitespace-pre-wrap break-keep text-fluid-sm leading-relaxed text-slate-800">
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
  const previewRef = useRef<HTMLParagraphElement>(null);

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

  const markAndAdvance = (index = stepIndex) => {
    setDone((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setStepIndex(index < applied.length - 1 ? index + 1 : index);
  };

  /** 문구 한 칸 복사 — 하단 「복사하기」·미리보기·목록 터치 공통 */
  const copyTextStep = async (index: number) => {
    const step = applied[index];
    if (!step || step.type !== 'text' || busy) return;
    setBusy(true);
    try {
      const ok = await copyQuoteText(step.text);
      if (!ok) {
        setStepIndex(index);
        window.setTimeout(() => {
          const box = previewRef.current;
          const selection = window.getSelection();
          if (box && selection) {
            const range = document.createRange();
            range.selectNodeContents(box);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 0);
        onToast('복사가 안 됐어요. 길게 눌러 복사해 주세요');
        return;
      }
      onToast('복사했어요 · 숨고에 붙여넣기 하세요');
      markAndAdvance(index);
    } finally {
      setBusy(false);
    }
  };

  /** 미리보기 글 터치 — 길게 눌러 일부를 고른 경우는 복사하지 않음 */
  const onPreviewTap = () => {
    const selected = window.getSelection()?.toString() ?? '';
    if (selected.trim()) return;
    void copyTextStep(stepIndex);
  };

  const onPrimary = async () => {
    if (!current || busy) return;
    if (current.type === 'text') {
      await copyTextStep(stepIndex);
      return;
    }
    setBusy(true);
    try {
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
            <QuoteChip
              key={item.id}
              on={on}
              label={item.label}
              onClick={() => {
                onKindId(item.id);
                resetProgress();
              }}
            />
          );
        })}
      </div>

      <label className="block rounded-2xl border-2 border-[#1f4fb8] bg-white p-3">
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

      <label className={`block px-3 py-2 ${quoteCard}`}>
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

      <div className={`p-3 ${quoteCard}`}>
        {current?.type === 'text' ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="문구 복사하기"
            onClick={onPreviewTap}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void copyTextStep(stepIndex);
              }
            }}
            className="-m-1 cursor-pointer rounded-xl p-1 transition-colors active:bg-sky-50"
          >
            <PreviewText text={current.text} boxRef={previewRef} />
            <p className="mt-2 text-right text-fluid-2xs font-medium text-[#1f4fb8]/80">
              {done[stepIndex] ? '✓ 복사됨 · 다시 누르면 또 복사' : '글을 누르면 바로 복사돼요'}
            </p>
          </div>
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
                onClick={() => {
                  if (step.type === 'text') void copyTextStep(index);
                  else setStepIndex(index);
                }}
                aria-label={step.type === 'text' ? `${index + 1}번 문구 복사하기` : `${index + 1}번 사진 보기`}
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

      <QuoteBottomBar>
        <Button
          variant="primary"
          size="lg"
          className={quoteBottomButton}
          disabled={!current || busy}
          onClick={() => void onPrimary()}
        >
          {busy ? '잠시만요' : primaryLabel}
        </Button>
      </QuoteBottomBar>
    </div>
  );
}
