import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  commitQuickPaste,
  parseQuickPaste,
  type QuickPasteDraft,
  type QuickPasteFieldKey,
  type QuickPasteOptionalFieldKey,
  type QuickPasteParseResponse,
} from '../../api/quickPaste';
import { INQUIRY_STATUS_LABELS } from '../inquiries/inquiriesUiParts';

type ScheduleQuickPasteModalProps = {
  token: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Step = 'paste' | 'review';

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

export function ScheduleQuickPasteModal({ token, open, onClose, onSaved }: ScheduleQuickPasteModalProps) {
  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<QuickPasteParseResponse | null>(null);
  const [draft, setDraft] = useState<QuickPasteDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const fieldRefs = useRef<Partial<Record<QuickPasteFieldKey, HTMLInputElement | null>>>({});

  const reset = useCallback(() => {
    setStep('paste');
    setRawText('');
    setPreview(null);
    setDraft(null);
    setError(null);
    setBusy(false);
    setHighlightMissing(false);
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
    try {
      const result = await parseQuickPaste(token, rawText);
      setPreview(result);
      setDraft(result.draft);
      setStep('review');
      setHighlightMissing(result.missingFields.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패');
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

  const runCommit = async () => {
    if (!draft) return;
    if (missingFields.length > 0) {
      setHighlightMissing(true);
      setError('필수 항목을 입력해 주세요.');
      scrollToFirstMissing(missingFields);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await commitQuickPaste(token, rawText, draft);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  const updateRequiredField = (key: QuickPasteFieldKey, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'serviceBalanceAmount' || key === 'areaPyeong') {
        const n = value.trim() === '' ? null : Number(value);
        return { ...prev, [key]: Number.isFinite(n) ? n : null };
      }
      return { ...prev, [key]: value.trim() || null };
    });
  };

  const updateOptionalField = (key: QuickPasteOptionalFieldKey, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const n = value.trim() === '' ? null : Number(value);
      return { ...prev, [key]: n != null && Number.isFinite(n) ? Math.round(n) : null };
    });
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-white lg:items-center lg:justify-center lg:bg-black/40 lg:p-4">
      <button type="button" className="absolute inset-0 hidden lg:block" aria-label="닫기" onClick={onClose} />
      <div className="relative flex min-h-0 flex-1 flex-col bg-white lg:max-h-[92vh] lg:min-h-0 lg:w-full lg:max-w-lg lg:rounded-2xl lg:shadow-xl lg:border lg:border-slate-200">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-4">
          <div>
            <h2 className="text-fluid-sm font-semibold text-slate-900">빠른등록</h2>
            <p className="text-fluid-2xs text-slate-500">카톡·문자 내용 붙여넣기 → 예약완료 접수</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-fluid-xs text-slate-600 hover:bg-slate-100"
          >
            닫기
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {preview?.coins && !preview.coins.unlimited ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-600">
              이번 등록 시 코인 <strong>{preview.coinCost}개</strong> · 잔여{' '}
              <strong>{preview.coins.remaining ?? 0}개</strong>
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-fluid-xs text-red-700">{error}</p>
          ) : null}

          {step === 'paste' ? (
            <>
              <label className="block space-y-1">
                <span className="text-fluid-xs font-medium text-slate-700">확정 일감 내용 붙여넣기</span>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={12}
                  placeholder="카카오톡·문자에서 복사한 내용을 그대로 붙여넣으세요."
                  className="w-full min-h-[40vh] rounded-xl border border-slate-200 px-3 py-2 text-fluid-sm focus:outline-none focus:ring-2 focus:ring-sky-500 lg:min-h-[280px]"
                />
              </label>
              <p className="text-fluid-2xs text-slate-500">
                원문 전체는 등록 후 <strong>특이사항</strong>에 저장됩니다.
              </p>
            </>
          ) : draft && preview ? (
            <>
              {preview.duplicateMatches.length > 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-fluid-2xs text-rose-900 space-y-1">
                  <p className="font-medium">같은 연락처 접수가 {preview.duplicateMatches.length}건 있습니다.</p>
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
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-fluid-2xs text-emerald-900">
                  등록 시 <strong>{preview.soloAutoAssign.teamLeaderName}</strong> 팀장에게 1인(solo) 자동 배정됩니다.
                </p>
              ) : null}

              {missingFields.length > 0 ? (
                <p
                  className={`rounded-lg border px-2.5 py-2 text-fluid-2xs ${
                    highlightMissing
                      ? 'border-amber-400 bg-amber-50 text-amber-900 animate-pulse'
                      : 'border-amber-200 bg-amber-50/80 text-amber-800'
                  }`}
                >
                  필수 {missingFields.length}항목이 비어 있습니다. 노란 칸을 채워 주세요.
                </p>
              ) : null}

              <p className="text-fluid-xs font-medium text-slate-800">필수 항목</p>
              {REQUIRED_FIELD_ORDER.map((key) => {
                const isMissing = missingFields.includes(key);
                const showAlert = highlightMissing && isMissing;
                return (
                  <label key={key} className="block space-y-1">
                    <span
                      className={`text-fluid-2xs font-medium ${showAlert ? 'text-amber-800' : 'text-slate-600'}`}
                    >
                      {preview.fieldLabels[key]}
                      {isMissing ? <span className="ml-1 text-amber-700">(필수)</span> : null}
                    </span>
                    <input
                      ref={(el) => {
                        fieldRefs.current[key] = el;
                      }}
                      type={
                        key === 'preferredDate'
                          ? 'date'
                          : key === 'serviceBalanceAmount' || key === 'areaPyeong'
                            ? 'number'
                            : 'text'
                      }
                      value={
                        draft[key] == null
                          ? ''
                          : key === 'serviceBalanceAmount' || key === 'areaPyeong'
                            ? String(draft[key])
                            : String(draft[key])
                      }
                      onChange={(e) => updateRequiredField(key, e.target.value)}
                      className={`w-full min-h-10 rounded-lg border px-3 text-fluid-sm focus:outline-none focus:ring-2 ${
                        showAlert
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300 animate-pulse focus:ring-amber-500'
                          : 'border-slate-200 focus:ring-sky-500'
                      }`}
                    />
                  </label>
                );
              })}

              <div className="pt-1 space-y-2">
                <p className="text-fluid-xs font-medium text-slate-700">
                  선택 — 방·화장실·베란다
                  <span className="ml-1 font-normal text-slate-500">(없어도 등록 가능)</span>
                </p>
                <p className="text-fluid-2xs text-slate-500">
                  (3,2,1) · 3,2,1 형식은 방·화·베 순으로 자동 인식합니다. 특이 서식은 직접 입력하세요.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {OPTIONAL_FIELD_ORDER.map((key) => {
                    const aiHint = preview.optionalAiHints?.includes(key);
                    return (
                      <label key={key} className="block space-y-1">
                        <span className="text-fluid-2xs font-medium text-slate-600">
                          {preview.optionalFieldLabels[key]}
                          {aiHint ? (
                            <span className="ml-0.5 block text-fluid-2xs font-normal text-violet-600">
                              AI 보조 예정
                            </span>
                          ) : null}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={draft[key] == null ? '' : String(draft[key])}
                          onChange={(e) => updateOptionalField(key, e.target.value)}
                          className="w-full min-h-10 rounded-lg border border-slate-200 px-2 text-fluid-sm text-center focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <details className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <summary className="cursor-pointer text-fluid-2xs font-medium text-slate-600">원문 미리보기</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-fluid-2xs text-slate-700">
                  {rawText}
                </pre>
              </details>
            </>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-slate-200 p-3 sm:p-4 flex gap-2">
          {step === 'paste' ? (
            <button
              type="button"
              disabled={busy || !rawText.trim()}
              onClick={() => void runParse()}
              className="flex-1 min-h-11 rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? '분석 중…' : '분석하기'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('paste')}
                className="min-h-11 rounded-xl border border-slate-200 px-4 text-fluid-sm text-slate-700"
              >
                다시 붙여넣기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runCommit()}
                className="flex-1 min-h-11 rounded-xl bg-blue-600 text-fluid-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? '등록 중…' : '예약완료로 등록 (코인 2)'}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
