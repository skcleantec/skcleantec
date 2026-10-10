import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../ModalCloseButton';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import {
  fetchExtraWorkSettings,
  saveExtraWorkMarketer,
  type ExtraWorkMarketerSetting,
  type ExtraWorkOverrideSource,
  type ExtraWorkSettings,
} from '../../../api/extraWork';

const fieldClass =
  'min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
const btnClass =
  'min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

function shownPercent(value: number | null, fallback: number) {
  return value == null ? fallback : value;
}

function overrideText(row: ExtraWorkMarketerSetting, rows: ExtraWorkMarketerSetting[]) {
  if (row.overrideSource === 'NONE' || row.overridePercent <= 0 || !row.parentMarketerId) return '없음';
  const from = row.overrideSource === 'COMPANY' ? '회사' : '마케터';
  return `${from}→${parentName(rows, row.parentMarketerId)} ${row.overridePercent}%`;
}

function parentName(rows: ExtraWorkMarketerSetting[], parentId: string | null) {
  if (!parentId) return '없음';
  return rows.find((row) => row.id === parentId)?.name ?? '없음';
}

function MarketerRateEditor(props: {
  rows: ExtraWorkMarketerSetting[];
  selectedId: string;
  saving: boolean;
  defaults: { companyPercent: number; teamLeaderPercent: number; marketerPercent: number };
  earnedById: Record<string, number>;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<ExtraWorkMarketerSetting>) => void;
  onSave: (row: ExtraWorkMarketerSetting) => void;
}) {
  const { rows, selectedId, saving, defaults, earnedById, onSelect, onPatch, onSave } = props;
  const row = rows.find((item) => item.id === selectedId) ?? null;
  const overrideOn = row != null && row.overrideSource !== 'NONE';
  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-fluid-2xs text-slate-600">마케터</span>
        <select className={fieldClass} value={selectedId} onChange={(e) => onSelect(e.target.value)}>
          {rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {row ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-2">
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">회사 %</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                aria-label="회사 %"
                value={shownPercent(row.companyPercent, defaults.companyPercent)}
                onChange={(e) => onPatch(row.id, { companyPercent: percentInput(e.target.value) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">팀장 %</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                aria-label="팀장 %"
                value={shownPercent(row.teamLeaderPercent, defaults.teamLeaderPercent)}
                onChange={(e) => onPatch(row.id, { teamLeaderPercent: percentInput(e.target.value) })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">마케터 %</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                aria-label="마케터 %"
                value={shownPercent(row.marketerPercent, defaults.marketerPercent)}
                onChange={(e) => onPatch(row.id, { marketerPercent: percentInput(e.target.value) })}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">어디 몫에서</span>
              <select
                className={fieldClass}
                aria-label="어디 몫에서"
                value={row.overrideSource}
                onChange={(e) => {
                  const overrideSource = e.target.value as ExtraWorkOverrideSource;
                  onPatch(row.id, {
                    overrideSource,
                    ...(overrideSource === 'NONE' ? { parentMarketerId: null, overridePercent: 0 } : {}),
                  });
                }}
              >
                <option value="NONE">없음</option>
                <option value="COMPANY">회사 몫</option>
                <option value="MARKETER">마케터 몫</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">누구에게</span>
              <select
                className={`${fieldClass} disabled:pointer-events-none disabled:opacity-50`}
                aria-label="누구에게"
                disabled={!overrideOn}
                value={row.parentMarketerId ?? ''}
                onChange={(e) => onPatch(row.id, { parentMarketerId: e.target.value || null })}
              >
                <option value="">선택</option>
                {rows
                  .filter((other) => other.id !== row.id)
                  .map((other) => (
                    <option key={other.id} value={other.id}>
                      {other.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-fluid-2xs text-slate-600">몇 %</span>
              <input
                className={`${fieldClass} disabled:pointer-events-none disabled:opacity-50`}
                inputMode="numeric"
                aria-label="몇 %"
                disabled={!overrideOn}
                value={overrideOn ? row.overridePercent : 0}
                onChange={(e) => {
                  const n = percentInput(e.target.value);
                  onPatch(row.id, { overridePercent: n == null || Number.isNaN(n) ? 0 : n });
                }}
              />
            </label>
          </div>
          <button type="button" className={btnClass} disabled={saving} onClick={() => onSave(row)}>
            이 마케터 저장
          </button>
        </div>
      ) : null}
      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-fluid-2xs text-slate-800">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[28%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-center text-slate-500">
              <th className="px-1 py-1 font-medium">마케터</th>
              <th className="px-1 py-1 font-medium">회사</th>
              <th className="px-1 py-1 font-medium">팀장</th>
              <th className="px-1 py-1 font-medium">마케터</th>
              <th className="px-1 py-1 font-medium">오버라이딩</th>
              <th className="px-1 py-1 font-medium">번 금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const on = item.id === selectedId;
              const rule = overrideText(item, rows);
              const earned = earnedById[item.id] ?? 0;
              const earnedText = `${earned.toLocaleString('ko-KR')}원`;
              return (
                <tr key={item.id} className={on ? 'bg-slate-100' : 'hover:bg-slate-50'}>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className="max-w-full truncate font-medium text-slate-900 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                      title={item.name}
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="px-1 py-1 text-center tabular-nums">{shownPercent(item.companyPercent, defaults.companyPercent)}%</td>
                  <td className="px-1 py-1 text-center tabular-nums">{shownPercent(item.teamLeaderPercent, defaults.teamLeaderPercent)}%</td>
                  <td className="px-1 py-1 text-center tabular-nums">{shownPercent(item.marketerPercent, defaults.marketerPercent)}%</td>
                  <td className="truncate px-1 py-1 text-center" title={rule}>
                    {rule}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums" title={earnedText}>
                    {earnedText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function percentInput(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function ExtraSettlementSettings(props: {
  token: string;
  open: boolean;
  onClose: () => void;
  earnedById: Record<string, number>;
}) {
  const { token, open, onClose, earnedById } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [settings, setSettings] = useState<ExtraWorkSettings | null>(null);
  const [company, setCompany] = useState('100');
  const [leader, setLeader] = useState('0');
  const [marketer, setMarketer] = useState('0');
  const [rows, setRows] = useState<ExtraWorkMarketerSetting[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const apply = (next: ExtraWorkSettings) => {
    setSettings(next);
    setCompany(String(next.companyPercent));
    setLeader(String(next.teamLeaderPercent));
    setMarketer(String(next.marketerPercent));
    setRows(next.marketers);
    setSelectedId((current) =>
      next.marketers.some((row) => row.id === current) ? current : (next.marketers[0]?.id ?? ''),
    );
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

  const patchRow = (id: string, patch: Partial<ExtraWorkMarketerSetting>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const saveRow = async (row: ExtraWorkMarketerSetting) => {
    const companyPercent = shownPercent(row.companyPercent, percentInput(company) ?? 0);
    const teamLeaderPercent = shownPercent(row.teamLeaderPercent, percentInput(leader) ?? 0);
    const marketerPercent = shownPercent(row.marketerPercent, percentInput(marketer) ?? 0);
    if (
      [companyPercent, teamLeaderPercent, marketerPercent].some((n) => !Number.isInteger(n) || n < 0 || n > 100) ||
      companyPercent + teamLeaderPercent + marketerPercent !== 100
    ) {
      setError('회사, 팀장, 마케터 비율의 합은 100%여야 합니다.');
      return;
    }
    const overrideOn = row.overrideSource !== 'NONE';
    if (overrideOn && !row.parentMarketerId) {
      setError('오버라이딩은 누구에게 줄지 골라 주세요.');
      return;
    }
    if (overrideOn && (!Number.isInteger(row.overridePercent) || row.overridePercent < 1 || row.overridePercent > 100)) {
      setError('오버라이딩은 1~100 사이 정수로 적어 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      apply(
        await saveExtraWorkMarketer(token, row.id, {
          parentMarketerId: overrideOn ? row.parentMarketerId : null,
          companyPercent,
          teamLeaderPercent,
          marketerPercent,
          overrideSource: overrideOn ? row.overrideSource : 'NONE',
          overridePercent: overrideOn ? row.overridePercent : 0,
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
        className="modal-mobile-fullscreen-panel relative z-10 flex h-[100dvh] w-full max-w-3xl flex-col bg-white sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
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
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <MarketerRateEditor
        rows={rows}
        selectedId={selectedId}
        saving={saving}
        defaults={{
          companyPercent: percentInput(company) ?? 100,
          teamLeaderPercent: percentInput(leader) ?? 0,
          marketerPercent: percentInput(marketer) ?? 0,
        }}
        earnedById={earnedById}
        onSelect={setSelectedId}
        onPatch={patchRow}
        onSave={(row) => void saveRow(row)}
      />
        </>
      ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
