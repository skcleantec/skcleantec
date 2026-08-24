import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StaffAppPushKind } from '@shared/staffAppPush';

export type StaffNotificationSettingItem = {
  kind: StaffAppPushKind;
  label: string;
  description: string;
  mandatory: boolean;
  push: boolean;
  canToggle: boolean;
};

type StaffNotificationSettingsPanelProps = {
  loadItems: () => Promise<StaffNotificationSettingItem[]>;
  saveToggle: (kind: StaffAppPushKind, push: boolean) => Promise<StaffNotificationSettingItem[]>;
  backHref?: string;
  backLabel?: string;
};

export function StaffNotificationSettingsPanel({
  loadItems,
  saveToggle,
  backHref,
  backLabel,
}: StaffNotificationSettingsPanelProps) {
  const [items, setItems] = useState<StaffNotificationSettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    loadItems()
      .then(setItems)
      .catch(() => setErr('알림 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [loadItems]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePush = async (kind: StaffAppPushKind, next: boolean) => {
    const row = items.find((i) => i.kind === kind);
    if (!row?.canToggle) return;
    setSaving(true);
    setErr(null);
    try {
      const nextItems = await saveToggle(kind, next);
      setItems(nextItems);
      setSavedMsg('저장했습니다.');
      window.setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-fluid-xs text-slate-500">불러오는 중…</div>;
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-4 min-w-0">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        앱 푸시 알림을 종류별로 켜거나 끌 수 있습니다. 관리자가 「필수」로 지정한 알림은 끌 수 없습니다.
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-2xs text-red-800">
          {err}
        </div>
      ) : null}
      {savedMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs text-emerald-800">
          {savedMsg}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-fluid-xs text-slate-500 py-4 text-center">설정 가능한 알림이 없습니다.</p>
        ) : (
          items.map((row) => (
            <div
              key={row.kind}
              className="flex items-start justify-between gap-2 border-b border-slate-100 last:border-0 pb-2 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-fluid-xs font-medium text-slate-900 flex items-center gap-1.5 flex-wrap">
                  {row.label}
                  {row.mandatory ? (
                    <span className="rounded px-1.5 py-0 text-fluid-2xs bg-amber-100 text-amber-900">
                      필수
                    </span>
                  ) : null}
                </p>
                <p className="text-fluid-2xs text-slate-500 mt-0.5">{row.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-fluid-2xs text-slate-700">
                <span className="sr-only">{row.label} 푸시</span>
                <input
                  type="checkbox"
                  checked={row.push}
                  disabled={!row.canToggle || saving}
                  onChange={(e) => void togglePush(row.kind, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
                />
                <span aria-hidden>{row.push ? 'ON' : 'OFF'}</span>
              </label>
            </div>
          ))
        )}
      </div>

      {backHref ? (
        <Link
          to={backHref}
          className="text-fluid-2xs text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
        >
          {backLabel ?? '← 돌아가기'}
        </Link>
      ) : null}
    </div>
  );
}
