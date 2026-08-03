import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  commitQuickPaste,
  parseQuickPaste,
  type QuickPasteCorrection,
  type QuickPasteDraft,
  type QuickPasteFieldKey,
  type QuickPasteOptionalFieldKey,
  type QuickPasteParseResponse,
  type QuickPasteParseSnapshot,
} from '../../api/quickPaste';
import { INQUIRY_STATUS_LABELS } from '../inquiries/inquiriesUiParts';
import { QuickPasteMissingClarify } from './QuickPasteMissingClarify';
import {
  formatAmountInput,
  parseAmountInput,
  QuickPasteReviewField,
} from './QuickPasteReviewField';
import { extractRhbRawSnippetFromText } from '../../utils/quickPasteRhbEvidence';
import { Z_ABOVE_MOBILE_FLOATING_MENU } from '../layout/MobileFloatingMenuButton';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

type EditableFieldKey = QuickPasteFieldKey | QuickPasteOptionalFieldKey | 'preferredTime';

const TIME_SLOT_OPTIONS = [
  { value: '오전', label: '오전' },
  { value: '오후', label: '오후' },
  { value: '사이청소', label: '사이' },
] as const;

type ScheduleQuickPasteModalProps = {
  token: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Step = 'paste' | 'scanning' | 'review';

const MIN_AI_SCAN_MS = 900;

const REQUIRED_FIELD_ORDER: QuickPasteFieldKey[] = [
  'customerName',
  'customerPhone',
  'address',
  'preferredDate',
  'areaPyeong',
  'serviceBalanceAmount',
];

const OPTIONAL_FIELD_ORDER: QuickPasteOptionalFieldKey[] = ['roomCount', 'bathroomCount', 'balconyCount'];

function fieldMissing(draft: QuickPasteDraft, key: QuickPasteFieldKey): boolean {
  const v = draft[key];
  return v == null || (typeof v === 'string' && !String(v).trim());
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l1.2 5.1L18 8.7l-4.2 2.4L12 16l-1.8-4.9L6 8.7l4.8-1.1L12 2.5z" opacity="0.95" />
      <path d="M19 13l.7 2.6L22 16l-2.3 1.2L19 20l-.7-2.8L16 16l2.3-.4L19 13z" opacity="0.7" />
      <path d="M5.5 14l.55 2L8 16.4l-1.7.9L5.5 19.5l-.55-2.2L3 16.4l1.95-.4L5.5 14z" opacity="0.55" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function QuickPasteAiScannerPanel({ rawText }: { rawText: string }) {
  return (
    <div className="space-y-3 animate-quick-paste-reveal">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-cyan-50 px-3.5 py-3 shadow-sm">
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <SparkleIcon className="h-5 w-5 animate-pulse" />
            <span className="absolute inset-0 rounded-xl ring-2 ring-violet-400/40 animate-ping opacity-40" />
          </span>
          <div className="min-w-0">
            <p className="text-fluid-xs font-semibold text-slate-900">AI가 원문을 읽는 중</p>
            <p className="text-fluid-2xs text-slate-600 animate-pulse">고객 · 연락처 · 일정 · 금액 추출…</p>
          </div>
        </div>
      </div>

      <div className="relative min-h-[40vh] overflow-hidden rounded-2xl border border-violet-300/60 bg-slate-950 shadow-inner lg:min-h-[280px]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(167,139,250,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.55)_1px,transparent_1px)] bg-[size:20px_20px]" />
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-20 h-5 w-5 border-l-2 border-t-2 border-cyan-300/80" />
        <span className="pointer-events-none absolute right-2.5 top-2.5 z-20 h-5 w-5 border-r-2 border-t-2 border-cyan-300/80" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-20 h-5 w-5 border-b-2 border-l-2 border-violet-300/80" />
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-20 h-5 w-5 border-b-2 border-r-2 border-violet-300/80" />

        <pre className="relative z-0 max-h-[50vh] overflow-hidden whitespace-pre-wrap p-4 font-mono text-fluid-2xs leading-relaxed text-violet-100/70">
          {rawText}
        </pre>

        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div className="animate-quick-paste-scan-glow absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-cyan-400/25 via-violet-400/15 to-transparent" />
          <div className="animate-quick-paste-scan-line absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_22px_4px_rgba(34,211,238,0.55)]" />
          <div className="animate-quick-paste-scan-line absolute left-0 right-0 h-20 -translate-y-10 bg-gradient-to-b from-violet-400/30 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function StepChip({
  label,
  active,
  done,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-fluid-2xs font-medium ${
        active
          ? 'bg-white/20 text-white ring-1 ring-white/30'
          : done
            ? 'bg-emerald-400/20 text-emerald-100'
            : 'bg-white/5 text-white/45'
      }`}
    >
      {done ? (
        <span className="text-emerald-300" aria-hidden>
          ✓
        </span>
      ) : null}
      {label}
    </span>
  );
}

export function ScheduleQuickPasteModal({ token, open, onClose, onSaved }: ScheduleQuickPasteModalProps) {
  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<QuickPasteParseResponse | null>(null);
  const [draft, setDraft] = useState<QuickPasteDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const [parseSnapshot, setParseSnapshot] = useState<QuickPasteParseSnapshot | null>(null);
  const [editingKey, setEditingKey] = useState<EditableFieldKey | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [wrongBaseline, setWrongBaseline] = useState<Partial<Record<EditableFieldKey, string | null>>>(
    {},
  );
  const [pendingCorrections, setPendingCorrections] = useState<
    Partial<Record<EditableFieldKey, QuickPasteCorrection>>
  >({});
  const [learnBanner, setLearnBanner] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<QuickPasteFieldKey, HTMLInputElement | null>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  const reset = useCallback(() => {
    setStep('paste');
    setRawText('');
    setPreview(null);
    setDraft(null);
    setError(null);
    setBusy(false);
    setHighlightMissing(false);
    setParseSnapshot(null);
    setEditingKey(null);
    setEditBuffer('');
    setWrongBaseline({});
    setPendingCorrections({});
    setLearnBanner(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const missingFields = useMemo(() => {
    if (!draft) return preview?.missingFields ?? [];
    return REQUIRED_FIELD_ORDER.filter((key) => fieldMissing(draft, key));
  }, [draft, preview]);

  const runParse = async () => {
    setBusy(true);
    setError(null);
    setStep('scanning');
    const startedAt = Date.now();
    try {
      const result = await parseQuickPaste(token, rawText);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_AI_SCAN_MS) {
        await waitMs(MIN_AI_SCAN_MS - elapsed);
      }
      setPreview(result);
      setDraft(result.draft);
      setParseSnapshot({
        ruleDraft: result.ruleDraft,
        previewDraft: result.draft,
        aiApplied: result.aiApplied,
        aiFilledFields: result.aiFilledFields ?? [],
      });
      setEditingKey(null);
      setEditBuffer('');
      setWrongBaseline({});
      setPendingCorrections({});
      setLearnBanner(
        result.tenantRulesApplied > 0
          ? `학습된 서식 ${result.tenantRulesApplied}건이 적용되었습니다`
          : null,
      );
      setStep('review');
      setHighlightMissing(result.missingFields.length > 0);
    } catch (e) {
      setStep('paste');
      setError(e instanceof Error ? e.message : 'AI 분석 실패');
    } finally {
      setBusy(false);
    }
  };

  const scrollToFirstMissing = (keys: QuickPasteFieldKey[]) => {
    const first = REQUIRED_FIELD_ORDER.find((k) => keys.includes(k));
    if (!first) return;
    fieldRefs.current[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fieldRefs.current[first]?.focus();
  };

  const draftValueAsString = (key: EditableFieldKey, d: QuickPasteDraft): string | null => {
    const v = d[key];
    if (v == null) return null;
    return String(v);
  };

  const beginMarkWrong = (key: EditableFieldKey) => {
    if (!draft) return;
    const current = draft[key];
    setWrongBaseline((prev) => ({
      ...prev,
      [key]: current == null ? null : String(current),
    }));
    if (key === 'serviceBalanceAmount') {
      setEditBuffer(formatAmountInput(typeof current === 'number' ? current : null));
    } else {
      setEditBuffer(current == null ? '' : String(current));
    }
    setEditingKey(key);
    setLearnBanner('수정으로 표시했습니다. 고친 값을 저장하면 AI가 이 표기를 학습합니다.');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditBuffer('');
  };

  const confirmEdit = () => {
    if (!draft || !editingKey) return;
    const key = editingKey;
    let nextVal: string | number | null = editBuffer.trim() || null;
    if (key === 'serviceBalanceAmount') {
      nextVal = parseAmountInput(editBuffer);
    } else if (key === 'areaPyeong') {
      const n = editBuffer.trim() === '' ? null : Number(editBuffer.replace(/,/g, ''));
      nextVal = n != null && Number.isFinite(n) ? n : null;
    } else if (key === 'roomCount' || key === 'bathroomCount' || key === 'balconyCount') {
      const n = editBuffer.trim() === '' ? null : Number(editBuffer);
      nextVal = n != null && Number.isFinite(n) ? Math.round(n) : null;
    } else if (key === 'preferredTime') {
      const t = editBuffer.trim();
      nextVal = t === '오전' || t === '오후' || t === '사이청소' ? t : t || null;
    }

    const wrong = wrongBaseline[key] ?? draftValueAsString(key, draft);
    const correctStr = nextVal == null ? '' : String(nextVal);
    setDraft((prev) => (prev ? { ...prev, [key]: nextVal } : prev));

    if (correctStr && wrong !== correctStr) {
      const snippet = preview?.fieldEvidence?.[key]?.snippet ?? null;
      setPendingCorrections((prev) => ({
        ...prev,
        [key]: {
          fieldKey: key,
          wrongValue: wrong,
          correctValue: correctStr,
          snippet,
        },
      }));
      const label =
        key === 'preferredTime'
          ? '시간대'
          : preview?.fieldLabels?.[key as QuickPasteFieldKey] ??
            preview?.optionalFieldLabels?.[key as QuickPasteOptionalFieldKey] ??
            key;
      setLearnBanner(`「${label}」고친 표기를 등록 시 학습합니다`);
    }

    setEditingKey(null);
    setEditBuffer('');
  };

  /** 빈 필수 필드 — 틀림 없이 바로 채움 (오답 학습 대상 아님) */
  const updateEmptyRequiredField = (key: QuickPasteFieldKey, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'serviceBalanceAmount') {
        return { ...prev, serviceBalanceAmount: parseAmountInput(value) };
      }
      if (key === 'areaPyeong') {
        const n = value.trim() === '' ? null : Number(value.replace(/,/g, ''));
        return { ...prev, areaPyeong: n != null && Number.isFinite(n) ? n : null };
      }
      return { ...prev, [key]: value.trim() || null };
    });
  };

  const runCommit = async () => {
    if (!draft) return;
    if (editingKey) {
      setError('편집 중인 필드의 「고친 값 저장」을 먼저 눌러 주세요.');
      return;
    }
    if (missingFields.length > 0) {
      setHighlightMissing(true);
      setError('필수 항목을 입력해 주세요.');
      scrollToFirstMissing(missingFields);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const corrections = Object.values(pendingCorrections).filter(
        (c): c is QuickPasteCorrection => Boolean(c),
      );
      const result = await commitQuickPaste(
        token,
        rawText,
        draft,
        parseSnapshot ?? undefined,
        corrections,
      );
      const learnedN = result.learnedRules?.length ?? result.correctionsLearned ?? corrections.length;
      if (learnedN > 0) {
        // 닫히기 전 짧게 보이도록 — 부모 갱신 전에 alert 대신 배너 (모달 닫힘)
        window.setTimeout(() => {}, 0);
      }
      onSaved();
      onClose();
      if (learnedN > 0) {
        // 모달이 닫힌 뒤에도 안내
        window.alert(`AI가 수정 ${learnedN}건의 표기를 학습했습니다.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const subtitle =
    step === 'scanning'
      ? '원문에서 핵심 정보를 추출하고 있습니다'
      : step === 'review'
        ? '추출 결과를 확인한 뒤 예약완료로 등록하세요'
        : '카톡·문자를 붙여넣으면 AI가 접수로 정리합니다';

  return createPortal(
    <div
      className={`modal-mobile-safe-overlay fixed inset-0 ${Z_ABOVE_MOBILE_FLOATING_MENU} flex flex-col bg-slate-950/40 lg:items-center lg:justify-center lg:p-4`}
    >
      <button type="button" className="absolute inset-0 hidden lg:block" aria-label="닫기" onClick={onClose} />
      <div className="modal-mobile-fullscreen-panel relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:max-h-[92vh] lg:min-h-0 lg:w-full lg:max-w-lg lg:rounded-2xl lg:border lg:border-slate-200/80 lg:shadow-2xl">
        {/* Aurora header */}
        <header className="relative shrink-0 overflow-hidden bg-slate-950 px-3 pb-3 pt-3 text-white sm:px-4">
          <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-violet-500/40 blur-3xl" />
          <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-16 w-40 rounded-full bg-fuchsia-500/20 blur-2xl" />

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
                  <SparkleIcon className="h-3 w-3" />
                  AI
                </span>
                <StepChip label="붙여넣기" active={step === 'paste'} done={step !== 'paste'} />
                <StepChip label="분석" active={step === 'scanning'} done={step === 'review'} />
                <StepChip label="확인" active={step === 'review'} />
              </div>
              <h2 className="text-fluid-sm font-semibold tracking-tight text-white">AI 빠른등록</h2>
              <p className="mt-0.5 text-fluid-2xs text-slate-300">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 backdrop-blur-sm hover:bg-white/20"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4"
        >
          {preview?.coins && !preview.coins.unlimited ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-fluid-2xs text-amber-900">
              이번 등록 시 코인 <strong>{preview.coinCost}개</strong> · 잔여{' '}
              <strong>{preview.coins.remaining ?? 0}개</strong>
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-fluid-xs text-rose-700">
              {error}
            </p>
          ) : null}

          {step === 'paste' ? (
            <div className="space-y-3 animate-quick-paste-reveal">
              <div className="flex flex-wrap gap-1.5">
                {['카톡 붙여넣기', '자동 추출', '바로 등록'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-violet-200/80 bg-white px-2.5 py-1 text-fluid-2xs font-medium text-violet-800 shadow-sm"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <label className="group relative block">
                <span className="mb-1.5 flex items-center gap-1.5 text-fluid-xs font-semibold text-slate-800">
                  <SparkleIcon className="h-3.5 w-3.5 text-violet-600" />
                  확정 일감 내용 붙여넣기
                </span>
                <div
                  className={`relative rounded-2xl bg-gradient-to-br from-violet-500/25 via-cyan-400/20 to-fuchsia-400/20 p-[1.5px] shadow-sm transition-shadow focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.2)] ${
                    rawText.trim() ? 'from-violet-500/40 via-cyan-400/30 to-fuchsia-400/30' : ''
                  }`}
                >
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={12}
                    placeholder={
                      '카카오톡·문자에서 복사한 내용을 그대로 붙여넣으세요.\n\n예)\n홍길동 / 010-1234-5678\n서울 강남구 …\n3/15 오전 / 25평 / 잔금 20만'
                    }
                    className="w-full min-h-[40vh] resize-none rounded-[14px] border-0 bg-white px-3.5 py-3 text-fluid-sm text-slate-800 placeholder:text-slate-400 focus:outline-none lg:min-h-[280px]"
                  />
                </div>
              </label>
              <p className="text-fluid-2xs leading-relaxed text-slate-500">
                원문 전체는 등록 후 <span className="font-medium text-slate-700">특이사항</span>에 저장됩니다.
              </p>
            </div>
          ) : step === 'scanning' ? (
            <QuickPasteAiScannerPanel rawText={rawText} />
          ) : step === 'review' && draft && preview ? (
            <div className="space-y-3 animate-quick-paste-stack-in">
              {missingFields.length > 0 ? (
                <QuickPasteMissingClarify
                  token={token}
                  rawText={rawText}
                  draft={draft}
                  missingFields={missingFields}
                  onDraftChange={setDraft}
                />
              ) : null}

              {preview.duplicateMatches.length > 0 ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-3 py-2.5 text-fluid-2xs text-rose-900 space-y-1">
                  <p className="font-semibold">같은 연락처 접수가 {preview.duplicateMatches.length}건 있습니다</p>
                  <ul className="space-y-0.5 text-rose-800">
                    {preview.duplicateMatches.slice(0, 3).map((row) => (
                      <li key={row.id}>
                        {row.customerName}
                        {row.inquiryNumber ? ` · ${row.inquiryNumber}` : ''}
                        {row.preferredDate ? ` · ${row.preferredDate}` : ''}
                        {' · '}
                        {INQUIRY_STATUS_LABELS[row.status] ?? row.status}
                      </li>
                    ))}
                  </ul>
                  <p className="text-rose-700">중복 등록이 아닌지 확인한 뒤 등록해 주세요.</p>
                </div>
              ) : null}

              {preview.soloAutoAssign ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-fluid-2xs text-emerald-900">
                  등록 시 <strong>{preview.soloAutoAssign.teamLeaderName}</strong> 팀장에게 1인(solo) 자동
                  배정됩니다.
                </p>
              ) : null}

              {preview.aiApplied || preview.aiReviewed || preview.aiContextSummary ? (
                <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-white to-cyan-50 px-3 py-2.5 text-fluid-2xs text-violet-950 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25">
                      <SparkleIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 space-y-1 leading-relaxed">
                      {preview.aiContextSummary ? (
                        <p className="font-medium text-violet-950">{preview.aiContextSummary}</p>
                      ) : null}
                      <p className="text-violet-900/90">
                        {preview.aiFilledFields.length > 0
                          ? `찾은 항목: ${preview.aiFilledFields.join(', ')}`
                          : null}
                        {preview.aiCorrectedFields?.length > 0
                          ? `${preview.aiFilledFields.length > 0 ? ' · ' : ''}추가 교정: ${preview.aiCorrectedFields.join(', ')}`
                          : null}
                        {preview.aiFilledFields.length === 0 &&
                        !preview.aiCorrectedFields?.length &&
                        !preview.aiContextSummary
                          ? '원문 전체를 읽고 항목을 확인했습니다.'
                          : null}
                      </p>
                    </div>
                  </div>
                </div>
              ) : preview.aiAvailable === false ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-fluid-2xs text-slate-600">
                  AI 미연결 — <code className="text-fluid-2xs">server/.env</code>에{' '}
                  <code className="text-fluid-2xs">OPENAI_API_KEY</code> 저장 후 서버를 재시작하세요.
                </p>
              ) : null}

              {preview.aiWarnings && preview.aiWarnings.length > 0 ? (
                <ul className="rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-fluid-2xs text-amber-900 space-y-0.5">
                  {preview.aiWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              {preview.aiAvailable && preview.optionalAiHints.length > 0 && !preview.aiApplied && !preview.aiReviewed ? (
                <p className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-2xs text-slate-600">
                  일부 선택 항목은 서식이 달라 직접 확인이 필요할 수 있습니다.
                </p>
              ) : null}

              {learnBanner ? (
                <p className="rounded-2xl border border-violet-200 bg-violet-50/90 px-3 py-2.5 text-fluid-2xs font-medium text-violet-950">
                  {learnBanner}
                </p>
              ) : null}

              {Object.keys(pendingCorrections).length > 0 ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 text-fluid-2xs text-emerald-900">
                  수정 {Object.keys(pendingCorrections).length}건 — 등록 시 AI가 이 표기를 기억합니다.
                </p>
              ) : null}

              <p className="text-fluid-2xs text-slate-500">
                채워진 값은 <strong className="text-slate-700">수정</strong>을 누른 뒤 고칠 수 있습니다.
              </p>

              {missingFields.length > 0 ? (
                <p
                  className={`rounded-2xl border px-3 py-2.5 text-fluid-2xs ${
                    highlightMissing
                      ? 'border-amber-400 bg-amber-50 text-amber-900 animate-pulse'
                      : 'border-amber-200 bg-amber-50/80 text-amber-800'
                  }`}
                >
                  필수 {missingFields.length}항목이 비어 있습니다. 빈 칸은 바로 입력할 수 있습니다.
                </p>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-2.5 py-1.5">
                  <p className="text-fluid-xs font-semibold text-slate-800">필수 항목</p>
                </div>
                <div className="space-y-1.5 p-2">
                  {REQUIRED_FIELD_ORDER.map((key) => {
                    const isMissing = missingFields.includes(key);
                    const isEmpty = fieldMissing(draft, key);
                    const editing = editingKey === key;
                    const kind =
                      key === 'serviceBalanceAmount'
                        ? 'amount'
                        : key === 'preferredDate'
                          ? 'date'
                          : key === 'areaPyeong'
                            ? 'number'
                            : 'text';
                    return (
                      <div key={key} className="space-y-1">
                        <QuickPasteReviewField
                          label={preview.fieldLabels[key]}
                          displayValue={draft[key]}
                          kind={kind}
                          evidence={preview.fieldEvidence?.[key]}
                          aiFilled={preview.aiFilledFields?.includes(key)}
                          aiCorrected={preview.aiCorrectedFields?.includes(key)}
                          isMissing={isMissing}
                          highlightMissing={highlightMissing}
                          emptyEditable={isEmpty}
                          editing={editing}
                          markedWrong={Boolean(pendingCorrections[key])}
                          editValue={
                            editing
                              ? editBuffer
                              : key === 'serviceBalanceAmount'
                                ? formatAmountInput(draft.serviceBalanceAmount)
                                : draft[key] == null
                                  ? ''
                                  : String(draft[key])
                          }
                          inputType={
                            key === 'preferredDate'
                              ? 'date'
                              : key === 'areaPyeong'
                                ? 'number'
                                : 'text'
                          }
                          inputRef={(el) => {
                            fieldRefs.current[key] = el;
                          }}
                          onMarkWrong={() => beginMarkWrong(key)}
                          onCancelEdit={cancelEdit}
                          onConfirmEdit={confirmEdit}
                          onEditValueChange={(v) => {
                            if (editing) setEditBuffer(v);
                            else if (isEmpty) updateEmptyRequiredField(key, v);
                          }}
                        />
                        {key === 'preferredDate' ? (
                          <QuickPasteReviewField
                            label="시간대"
                            displayValue={draft.preferredTime}
                            kind="time"
                            evidence={preview.fieldEvidence?.preferredTime}
                            aiFilled={
                              preview.aiFilledFields?.includes('preferredTime') ||
                              Boolean(draft.preferredTime && preview.aiApplied)
                            }
                            aiCorrected={preview.aiCorrectedFields?.includes('preferredTime')}
                            emptyEditable={!draft.preferredTime}
                            editing={editingKey === 'preferredTime'}
                            markedWrong={Boolean(pendingCorrections.preferredTime)}
                            editValue={
                              editingKey === 'preferredTime'
                                ? editBuffer
                                : draft.preferredTime ?? ''
                            }
                            selectOptions={[...TIME_SLOT_OPTIONS]}
                            onMarkWrong={() => beginMarkWrong('preferredTime')}
                            onCancelEdit={cancelEdit}
                            onConfirmEdit={confirmEdit}
                            onEditValueChange={(v) => {
                              if (editingKey === 'preferredTime') {
                                setEditBuffer(v);
                              } else if (!draft.preferredTime) {
                                setDraft((prev) => (prev ? { ...prev, preferredTime: v } : prev));
                              }
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/80 px-2.5 py-1">
                  <p className="text-fluid-2xs font-semibold text-slate-800">
                    방·화·베
                    <span className="ml-1 font-normal text-slate-500">(선택)</span>
                  </p>
                </div>
                {(() => {
                  const hasRhbValue =
                    draft.roomCount != null ||
                    draft.bathroomCount != null ||
                    draft.balconyCount != null;
                  if (!hasRhbValue) return null;
                  // 붙여넣은 rawText에 실제로 있는 표기만 인용 (가짜 방N화N베N 금지)
                  const fromRaw = extractRhbRawSnippetFromText(rawText);
                  const fromServer = [
                    preview.fieldEvidence?.roomCount?.snippet,
                    preview.fieldEvidence?.bathroomCount?.snippet,
                    preview.fieldEvidence?.balconyCount?.snippet,
                  ].find((s) => s && rawText.includes(s));
                  const rhbSnippet = fromRaw || fromServer || null;
                  return (
                    <p className="border-b border-slate-100 bg-violet-50/60 px-2.5 py-1 text-[11px] leading-snug text-violet-900">
                      <span className="font-semibold">원문 예시 </span>
                      {rhbSnippet ? (
                        <span>「{rhbSnippet}」</span>
                      ) : (
                        <span className="text-violet-700/80">원문에서 방·화·베 표기를 찾지 못함</span>
                      )}
                    </p>
                  );
                })()}
                <div className="grid grid-cols-3 gap-1 p-1.5">
                  {OPTIONAL_FIELD_ORDER.map((key) => {
                    const isEmpty = draft[key] == null;
                    const editing = editingKey === key;
                    const rhbSnippet =
                      extractRhbRawSnippetFromText(rawText) ||
                      [
                        preview.fieldEvidence?.roomCount?.snippet,
                        preview.fieldEvidence?.bathroomCount?.snippet,
                        preview.fieldEvidence?.balconyCount?.snippet,
                      ].find((s) => s && rawText.includes(s)) ||
                      null;
                    return (
                      <QuickPasteReviewField
                        key={key}
                        label={preview.optionalFieldLabels[key]}
                        displayValue={draft[key]}
                        kind="number"
                        dense
                        evidence={
                          !isEmpty && rhbSnippet
                            ? {
                                snippet: rhbSnippet,
                                source: preview.fieldEvidence?.[key]?.source ?? 'rule',
                              }
                            : undefined
                        }
                        aiFilled={preview.aiFilledFields?.includes(key)}
                        emptyEditable={isEmpty}
                        editing={editing}
                        markedWrong={Boolean(pendingCorrections[key])}
                        editValue={editing ? editBuffer : draft[key] == null ? '' : String(draft[key])}
                        inputType="number"
                        onMarkWrong={() => beginMarkWrong(key)}
                        onCancelEdit={cancelEdit}
                        onConfirmEdit={confirmEdit}
                        onEditValueChange={(v) => {
                          if (editing) setEditBuffer(v);
                          else if (isEmpty) {
                            setDraft((prev) => {
                              if (!prev) return prev;
                              const n = v.trim() === '' ? null : Number(v);
                              return {
                                ...prev,
                                [key]: n != null && Number.isFinite(n) ? Math.round(n) : null,
                              };
                            });
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <details className="group rounded-2xl border border-slate-200/90 bg-white shadow-sm open:shadow-md">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-fluid-2xs font-semibold text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5">
                    원문 미리보기
                    <span className="text-slate-400 transition group-open:rotate-90">›</span>
                  </span>
                </summary>
                <pre className="mx-3 mb-3 max-h-40 overflow-auto rounded-xl border border-slate-100 bg-slate-50 p-2.5 whitespace-pre-wrap text-fluid-2xs text-slate-700">
                  {rawText}
                </pre>
              </details>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur-sm sm:p-4">
          {step === 'paste' ? (
            <button
              type="button"
              disabled={busy || !rawText.trim()}
              onClick={() => void runParse()}
              className="relative flex min-h-11 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 text-fluid-sm font-semibold text-white shadow-lg shadow-violet-500/30 disabled:opacity-45 disabled:shadow-none"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-quick-paste-ai-btn-shimmer" />
              <span className="relative inline-flex items-center gap-2">
                <SparkleIcon className="h-4 w-4" />
                AI로 분석하기
              </span>
            </button>
          ) : step === 'scanning' ? (
            <button
              type="button"
              disabled
              className="flex min-h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 text-fluid-sm font-semibold text-white opacity-95"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                AI 스캔 중…
              </span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('paste')}
                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3.5 text-fluid-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                다시 붙여넣기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runCommit()}
                className="relative flex min-h-11 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-violet-800 to-indigo-700 text-fluid-sm font-semibold text-white shadow-md disabled:opacity-50"
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-quick-paste-ai-btn-shimmer" />
                <span className="relative">{busy ? '등록 중…' : '예약완료로 등록 (코인 2)'}</span>
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
