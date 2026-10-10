import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../ModalCloseButton';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import {
  fetchExtraWorkSettings,
  saveExtraWorkMarketer,
  saveExtraWorkSettings,
  type ExtraWorkMarketerSetting,
  type ExtraWorkOverrideSource,
  type ExtraWorkSettings,
} from '../../../api/extraWork';

const fieldClass =
  'min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
const btnClass =
  'min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function percentInput(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function ExtraSettlementSettings(props: { token: string; open: boolean; onClose: () => void }) {
  const { token, open, onClose } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [settings, setSettings] = useState<ExtraWorkSettings | null>(null);
  const [company, setCompany] = useState('100');
  const [leader, setLeader] = useState('0');
  const [marketer, setMarketer] = useState('0');
  const [presets, setPresets] = useState('');
  const [allowTraining, setAllowTraining] = useState(false);
  const [rows, setRows] = useState<ExtraWorkMarketerSetting[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const apply = (next: ExtraWorkSettings) => {
    setSettings(next);
    setCompany(String(next.companyPercent));
    setLeader(String(next.teamLeaderPercent));
    setMarketer(String(next.marketerPercent));
    setPresets(next.presets.join(', '));
    setAllowTraining(next.allowTraining);
    setRows(next.marketers);
  };

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setError('');
    void fetchExtraWorkSettings(token)
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const saveTenant = async () => {
    const companyPercent = percentInput(company);
    const teamLeaderPercent = percentInput(leader);
    const marketerPercent = percentInput(marketer);
    if (companyPercent == null || teamLeaderPercent == null || marketerPercent == null) {
      setError('업체 비율은 0~100 사이 정수로 적어 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      apply(
        await saveExtraWorkSettings(token, {
          companyPercent,
          teamLeaderPercent,
          marketerPercent,
          presets: presets.split(',').map((item) => item.trim()).filter(Boolean),
          allowTraining,
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '설정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const patchRow = (id: string, patch: Partial<ExtraWorkMarketerSetting>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const saveRow = async (row: ExtraWorkMarketerSetting) => {
    setSaving(true);
    setError('');
    try {
      apply(
        await saveExtraWorkMarketer(token, row.id, {
          parentMarketerId: row.parentMarketerId,
          companyPercent: row.companyPercent,
          teamLeaderPercent: row.teamLeaderPercent,
          marketerPercent: row.marketerPercent,
          overrideSource: row.overrideSource,
          overridePercent: row.overridePercent,
        }),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '마케터 설정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="설정 닫기" onClick={onClose} />
      <div
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-lg flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-settlement-settings-title"
      >
        <div className="relative flex shrink-0 items-center border-b border-slate-200 px-3 py-2 pr-12">
          <h2 id="extra-settlement-settings-title" className="truncate text-fluid-sm font-semibold text-slate-900">
            추가정산 설정
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
          onFocusCapture={onFieldFocus}
        >
      {!settings ? <p className="text-fluid-xs text-slate-500">{error || '설정을 불러오는 중…'}</p> : null}
      {settings ? (
        <>
      <p className="text-fluid-2xs leading-snug text-slate-600">
        회사, 팀장, 마케터 비율의 합은 100%입니다. 오버라이딩은 회사 몫 또는 그 마케터 몫에서 직속 상위에게 줍니다. 이미 저장된 내역은 바꾸지 않습니다.
      </p>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-fluid-2xs text-slate-600">회사 %</span>
          <input className={fieldClass} inputMode="numeric" value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-fluid-2xs text-slate-600">팀장 %</span>
          <input className={fieldClass} inputMode="numeric" value={leader} onChange={(e) => setLeader(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-fluid-2xs text-slate-600">마케터 %</span>
          <input className={fieldClass} inputMode="numeric" value={marketer} onChange={(e) => setMarketer(e.target.value)} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-fluid-2xs text-slate-600">시공 예시 (쉼표로 구분)</span>
        <input className={fieldClass} value={presets} onChange={(e) => setPresets(e.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-fluid-xs text-slate-800">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={allowTraining}
          onChange={(e) => setAllowTraining(e.target.checked)}
        />
        <span>
          나중에 견적 앱 학습에 이 업체 사진을 쓸 수 있게 허용합니다. 지금은 기록만 하고, 고객 이름·전화·주소는 학습에 넣지 않습니다.
        </span>
      </label>
      <button type="button" className={btnClass} disabled={saving} onClick={() => void saveTenant()}>
        업체 기본값 저장
      </button>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
            <p className="text-fluid-xs font-medium text-slate-900">{row.name}</p>
            <label className="block space-y-1">
              <span className="text-fluid-2xs text-slate-600">직속 상위</span>
              <select
                className={fieldClass}
                value={row.parentMarketerId ?? ''}
                onChange={(e) => patchRow(row.id, { parentMarketerId: e.target.value || null })}
              >
                <option value="">없음</option>
                {rows
                  .filter((other) => other.id !== row.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="회사 %"
                value={row.companyPercent ?? ''}
                onChange={(e) => patchRow(row.id, { companyPercent: percentInput(e.target.value) })}
              />
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="팀장 %"
                value={row.teamLeaderPercent ?? ''}
                onChange={(e) => patchRow(row.id, { teamLeaderPercent: percentInput(e.target.value) })}
              />
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="마케터 %"
                value={row.marketerPercent ?? ''}
                onChange={(e) => patchRow(row.id, { marketerPercent: percentInput(e.target.value) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className={fieldClass}
                value={row.overrideSource}
                onChange={(e) => patchRow(row.id, { overrideSource: e.target.value as ExtraWorkOverrideSource })}
              >
                <option value="NONE">오버라이딩 없음</option>
                <option value="COMPANY">회사 몫에서</option>
                <option value="MARKETER">마케터 몫에서</option>
              </select>
              <input
                className={fieldClass}
                inputMode="numeric"
                placeholder="오버라이딩 %"
                value={row.overridePercent}
                onChange={(e) => {
                  const n = percentInput(e.target.value);
                  patchRow(row.id, { overridePercent: n == null || Number.isNaN(n) ? 0 : n });
                }}
              />
            </div>
            <button type="button" className={btnClass} disabled={saving} onClick={() => void saveRow(row)}>
              이 마케터 저장
            </button>
          </div>
        ))}
      </div>
        </>
      ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
