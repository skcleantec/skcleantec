import { useCallback, useEffect, useState } from 'react';
import { SOOMGO_CALL_AUTO_TRIGGER_LABEL } from '@shared/soomgoMessagePresets';
import { getToken } from '../../../stores/auth';
import {
  fetchTelecrmSoomgoCallAutoMessage,
  updateTelecrmSoomgoCallAutoMessage,
  uploadTelecrmSoomgoPresetImage,
} from '../../../api/telecrmSoomgoMessagePresets';
import { TelecrmBrandSelect } from './TelecrmBrandSelect';
import {
  normalizeSoomgoPresetSteps,
  SoomgoMessagePresetEditor,
  type SoomgoPresetDraft,
} from './SoomgoMessagePresetEditor';
import { OnOffSwitch } from '../../ui/OnOffSwitch';

/** 숨고 프리셋 — 통화 시 자동 안내 (마케터 개인·브랜드별) */
export function TelecrmSoomgoCallAutoMessageSection() {
  const token = getToken();
  const [brandId, setBrandId] = useState('default');
  const [draft, setDraft] = useState<SoomgoPresetDraft | null>(null);
  const [fallbackFromDefault, setFallbackFromDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const operatingCompanyId = brandId === 'default' ? null : brandId;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSoomgoCallAutoMessage(token, operatingCompanyId);
      setFallbackFromDefault(res.fallbackFromDefault === true);
      const item = res.item;
      const previewSteps =
        res.fallbackFromDefault && res.defaultItem?.steps.length
          ? res.defaultItem.steps
          : item.steps;
      setDraft({
        id: item.id,
        label: item.label,
        steps: previewSteps.length ? previewSteps : item.steps,
        isActive: item.isActive,
        sortOrder: 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, operatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onImagePick = async (stepIndex: number, file: File) => {
    if (!token || !draft) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSoomgoPresetImage(token, file);
      setDraft((prev) => {
        if (!prev) return prev;
        const step = prev.steps[stepIndex];
        if (step?.type !== 'images') return prev;
        const steps = [...prev.steps];
        steps[stepIndex] = { ...step, urls: [...step.urls, url] };
        return { ...prev, steps };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!token || !draft) return;
    const steps = normalizeSoomgoPresetSteps(draft.steps);
    if (draft.isActive && !steps.length) {
      setError('자동 전송을 켜려면 텍스트 또는 이미지 스텝을 1개 이상 추가해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const updated = await updateTelecrmSoomgoCallAutoMessage(token, {
        steps,
        isActive: draft.isActive,
        operatingCompanyId,
      });
      setFallbackFromDefault(false);
      setDraft({
        id: updated.id,
        label: updated.label,
        steps: updated.steps,
        isActive: updated.isActive,
        sortOrder: 0,
      });
      setMsg(`${SOOMGO_CALL_AUTO_TRIGGER_LABEL} 자동 안내를 저장했습니다.`);
      window.setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  if (!draft) {
    return <p className="text-fluid-sm text-red-600">통화 자동 안내 설정을 불러오지 못했습니다.</p>;
  }

  const stepCount = draft.steps.length;
  const placeholderHint = '{마케터명}, {고객명}, {닉네임}';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-fluid-sm font-semibold text-slate-900">통화 시 자동 안내 (내 계정)</p>
        <p className="mt-1 text-fluid-2xs leading-snug text-slate-600">
          CRM 「통화」 버튼을 누를 때 숨고 채팅으로 먼저 보낼 안내입니다. 브랜드별 ON/OFF·문구를
          설정할 수 있으며, 브랜드에 저장하지 않으면 <strong>내 기본</strong> 문구를 따릅니다. 통화
          시도마다 전송됩니다(쿨다운 없음).
        </p>
      </div>

      <TelecrmBrandSelect
        token={token}
        value={brandId}
        onChange={setBrandId}
        defaultOptionLabel="내 기본"
      />
      {fallbackFromDefault ? (
        <p className="text-fluid-2xs text-amber-700">
          이 브랜드 전용 설정이 없습니다 — 아래는 내 기본 미리보기입니다. 저장하면 브랜드별로
          생성됩니다.
        </p>
      ) : null}

      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-fluid-2xs text-green-800">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-2xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex min-w-0 items-center gap-2 px-2.5 py-2">
          <OnOffSwitch
            checked={draft.isActive}
            onChange={(next) => setDraft((d) => (d ? { ...d, isActive: next } : d))}
            label={SOOMGO_CALL_AUTO_TRIGGER_LABEL}
            title="자동 전송 켜기/끄기 — 바꾼 뒤 「저장」을 눌러야 적용돼요"
          />
          <span className="min-w-0 flex-1 truncate text-fluid-2xs text-slate-500">
            통화 버튼 클릭 시 · {stepCount > 0 ? `${stepCount}스텝` : '미설정'} · {placeholderHint}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-200 px-2 py-0.5 text-fluid-2xs text-slate-600 hover:bg-slate-50"
          >
            {expanded ? '접기' : '편집'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="shrink-0 rounded-lg bg-slate-900 px-2 py-0.5 text-fluid-2xs text-white disabled:opacity-50"
          >
            저장
          </button>
        </div>
        {expanded ? (
          <div className="border-t border-slate-100 bg-slate-50/80 px-2 pb-2 pt-1">
            <SoomgoMessagePresetEditor
              draft={draft}
              index={0}
              busy={busy}
              hideLabel
              fixedTitle={SOOMGO_CALL_AUTO_TRIGGER_LABEL}
              activeCheckboxLabel="자동 전송 사용"
              textPlaceholder="예: {마케터명}님이 지금 전화 연결을 시도 중입니다."
              hint={`치환: ${placeholderHint}`}
              compact
              onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              onSave={() => void save()}
              onImagePick={onImagePick}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
