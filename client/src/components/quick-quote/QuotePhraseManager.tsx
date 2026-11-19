import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SoomgoMessageStep } from '@shared/soomgoMessagePresets';
import { SOOMGO_QUOTE_PLACEHOLDER_HINTS } from '@shared/telecrmSoomgoQuotePlaceholders';
import { getToken } from '../../stores/auth';
import { uploadTelecrmSoomgoPresetImage } from '../../api/telecrmSoomgoMessagePresets';
import {
  createQuickQuoteKind,
  deleteQuickQuoteKind,
  reorderQuickQuoteKinds,
  saveQuickQuoteAutoKind,
  updateQuickQuoteKind,
  type QuickQuoteKind,
} from '../../api/quickQuote';
import { DeletePasswordModal } from '../crm/settings/DeletePasswordModal';
import { Button } from '../ui/Button';
import { normalizeSoomgoPresetSteps } from '../crm/settings/SoomgoMessagePresetEditor';

type Draft = {
  id: string;
  source: 'auto_quote' | 'quick_quote' | 'new';
  label: string;
  steps: SoomgoMessageStep[];
  paybackWon: string;
};

function toDraft(kind: QuickQuoteKind): Draft {
  return {
    id: kind.id,
    source: kind.source,
    label: kind.label,
    steps: kind.steps.map((step) => ({ ...step })),
    paybackWon: kind.paybackWon == null ? '' : String(kind.paybackWon),
  };
}

function paybackNumber(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits);
}

export function QuotePhraseManager({
  open,
  kinds,
  canEdit,
  operatingCompanyId,
  onClose,
  onSaved,
}: {
  open: boolean;
  kinds: QuickQuoteKind[];
  canEdit: boolean;
  operatingCompanyId: string;
  onClose: () => void;
  onSaved: (kinds: QuickQuoteKind[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(kinds[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft | null>(kinds[0] ? toDraft(kinds[0]) : null);
  const [focusStep, setFocusStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!open || !draft) return null;

  const token = getToken();
  const extras = kinds.filter((k) => k.source === 'quick_quote');

  const patchStep = (index: number, step: SoomgoMessageStep) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      steps[index] = step;
      return { ...prev, steps };
    });
  };

  const insertToken = (tokenText: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      const index = steps[focusStep]?.type === 'text' ? focusStep : steps.findIndex((s) => s.type === 'text');
      if (index < 0) {
        steps.push({ type: 'text', text: tokenText });
        return { ...prev, steps };
      }
      const step = steps[index];
      if (step?.type !== 'text') return prev;
      steps[index] = { type: 'text', text: `${step.text}${tokenText}` };
      return { ...prev, steps };
    });
  };

  const save = async () => {
    if (!token || !canEdit) return;
    const steps = normalizeSoomgoPresetSteps(draft.steps).map((step) =>
      step.type === 'images' ? { ...step, mode: step.urls.length > 1 ? ('bundle' as const) : step.mode } : step,
    );
    if (!steps.length) {
      setError('문구를 한 칸 이상 남겨 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const paybackWon = paybackNumber(draft.paybackWon);
      const res =
        draft.source === 'auto_quote'
          ? await saveQuickQuoteAutoKind(token, { operatingCompanyId, steps, paybackWon })
          : draft.source === 'new'
            ? await createQuickQuoteKind(token, {
                operatingCompanyId,
                label: draft.label.trim(),
                steps,
                paybackWon,
              })
            : await updateQuickQuoteKind(token, draft.id, {
                operatingCompanyId,
                label: draft.label.trim(),
                steps,
                paybackWon,
              });
      onSaved(res.kinds);
      const next =
        draft.source === 'new'
          ? res.kinds.find((k) => k.source === 'quick_quote' && k.label === draft.label.trim())
          : res.kinds.find((k) => k.id === draft.id);
      if (next) {
        setSelectedId(next.id);
        setDraft(toDraft(next));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    if (!token || !canEdit) return;
    const ids = extras.map((k) => k.id);
    const index = ids.indexOf(id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const ordered = [...ids];
    const [item] = ordered.splice(index, 1);
    if (!item) return;
    ordered.splice(target, 0, item);
    setBusy(true);
    setError(null);
    try {
      const res = await reorderQuickQuoteKinds(token, { operatingCompanyId, orderedIds: ordered });
      onSaved(res.kinds);
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || draft.source !== 'quick_quote') return;
    setBusy(true);
    setPasswordError(null);
    try {
      const res = await deleteQuickQuoteKind(token, draft.id, { operatingCompanyId, password });
      onSaved(res.kinds);
      setDeleteOpen(false);
      setPassword('');
      const first = res.kinds[0];
      if (first) {
        setSelectedId(first.id);
        setDraft(toDraft(first));
      }
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : '삭제하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const onImage = async (index: number, file: File) => {
    if (!token || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      setDraft((prev) => {
        if (!prev) return prev;
        const steps = [...prev.steps];
        const step = steps[index];
        if (step?.type !== 'images') return prev;
        steps[index] = { ...step, urls: [...step.urls, url] };
        return { ...prev, steps };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 올리지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-card" role="dialog" aria-modal="true" aria-label="문구 관리">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-fluid-sm font-semibold text-slate-900">문구 관리</p>
          <Button variant="quiet" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {!canEdit ? <p className="text-fluid-2xs text-slate-500">보기만 할 수 있어요.</p> : null}
          <div className="flex gap-1 overflow-x-auto">
            {kinds.map((kind) => (
              <Button
                key={kind.id}
                variant={selectedId === kind.id && draft.source !== 'new' ? 'primary' : 'quiet'}
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setSelectedId(kind.id);
                  setDraft(toDraft(kind));
                  setError(null);
                }}
              >
                {kind.label}
              </Button>
            ))}
            {draft.source === 'new' ? (
              <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-fluid-2xs text-white">새 종류</span>
            ) : null}
          </div>

          {draft.source === 'auto_quote' ? (
            <p className="text-fluid-2xs leading-snug text-slate-500">이 문구를 저장하면 CRM 견적보내기 서식도 같이 바뀝니다.</p>
          ) : (
            <label className="block">
              <span className="text-fluid-2xs text-slate-500">견적 종류</span>
              <input
                value={draft.label}
                disabled={!canEdit}
                className="mt-1 w-full rounded-xl bg-field px-3 py-2 text-fluid-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
                onChange={(e) => setDraft({ ...draft, label: e.target.value.slice(0, 40) })}
              />
            </label>
          )}

          <label className="block">
            <span className="text-fluid-2xs text-slate-500">페이백 (원)</span>
            <input
              inputMode="numeric"
              value={draft.paybackWon}
              disabled={!canEdit}
              placeholder="20000"
              className="mt-1 w-full rounded-xl bg-field px-3 py-2 text-fluid-sm tabular-nums text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              onChange={(e) => setDraft({ ...draft, paybackWon: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            />
          </label>

          <div className="flex flex-wrap gap-1">
            {SOOMGO_QUOTE_PLACEHOLDER_HINTS.map((tokenText) => (
              <Button key={tokenText} variant="secondary" size="sm" disabled={!canEdit} onClick={() => insertToken(tokenText)}>
                {tokenText}
              </Button>
            ))}
          </div>

          {draft.steps.map((step, index) => (
            <div key={index} className="rounded-xl bg-field p-2">
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-fluid-2xs text-slate-500">{step.type === 'text' ? '문구' : '사진'}</span>
                {canEdit ? (
                  <span className="flex gap-1">
                    <Button variant="quiet" size="sm" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })}>
                      삭제
                    </Button>
                    <Button variant="quiet" size="sm" disabled={index === 0} onClick={() => {
                      const steps = [...draft.steps];
                      const [item] = steps.splice(index, 1);
                      if (!item) return;
                      steps.splice(index - 1, 0, item);
                      setDraft({ ...draft, steps });
                    }}>
                      위로
                    </Button>
                    <Button variant="quiet" size="sm" disabled={index === draft.steps.length - 1} onClick={() => {
                      const steps = [...draft.steps];
                      const [item] = steps.splice(index, 1);
                      if (!item) return;
                      steps.splice(index + 1, 0, item);
                      setDraft({ ...draft, steps });
                    }}>
                      아래로
                    </Button>
                  </span>
                ) : null}
              </div>
              {step.type === 'text' ? (
                <textarea
                  value={step.text}
                  readOnly={!canEdit}
                  rows={4}
                  className="w-full resize-y rounded-lg bg-white px-2 py-1.5 text-fluid-xs text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
                  onFocus={() => setFocusStep(index)}
                  onChange={(e) => patchStep(index, { type: 'text', text: e.target.value.slice(0, 4000) })}
                />
              ) : (
                <div className="space-y-1">
                  {step.urls.map((url) => (
                    <p key={url} className="truncate text-fluid-2xs text-slate-600" title={url}>
                      {url}
                    </p>
                  ))}
                  {canEdit ? (
                    <label className="inline-flex cursor-pointer rounded-lg bg-white px-2 py-1 text-fluid-2xs text-slate-700 hover:bg-slate-100">
                      사진 추가
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) void onImage(index, file);
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {canEdit ? (
            <div className="flex gap-1">
              <Button size="sm" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { type: 'text', text: '' }] })}>
                문구 추가
              </Button>
              <Button size="sm" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { type: 'images', urls: [], mode: 'single' }] })}>
                사진 추가
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-fluid-2xs text-red-600">{error}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-2">
          {canEdit && draft.source === 'quick_quote' ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void move(draft.id, -1)}>순서 위</Button>
              <Button size="sm" disabled={busy} onClick={() => void move(draft.id, 1)}>순서 아래</Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => { setPassword(''); setPasswordError(null); setDeleteOpen(true); }}>
                종류 삭제
              </Button>
            </>
          ) : null}
          {canEdit && draft.source !== 'new' ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                setDraft({
                  id: 'new',
                  source: 'new',
                  label: '',
                  steps: [{ type: 'text', text: '' }],
                  paybackWon: draft.paybackWon,
                })
              }
            >
              종류 추가
            </Button>
          ) : null}
          <span className="flex-1" />
          {canEdit ? (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? '저장 중' : '저장'}
            </Button>
          ) : null}
        </div>
      </div>
      <DeletePasswordModal
        open={deleteOpen}
        title="이 견적 종류를 삭제할까요?"
        description="본인 비밀번호를 입력해 주세요."
        busy={busy}
        password={password}
        error={passwordError}
        onPasswordChange={setPassword}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteOpen(false)}
      />
    </div>,
    document.body,
  );
}
