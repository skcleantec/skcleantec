import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StaffAppPushKind } from '@shared/staffAppPush';
import { useStaffAppNativePushRegister } from '../../hooks/useStaffAppNativePushRegister';
import {
  getCbiseoStaffAppVersionCode,
  isCbiseoStaffNativeApp,
  registerCbiseoStaffPushWithPoll,
  requestCbiseoStaffNotificationPermission,
} from '../../utils/cbiseoNativeApp';
import { fetchStaffAppPushStatus, type StaffAppPushStatus } from '../../api/staffAppPush';

export type StaffNotificationSettingItem = {
  kind: StaffAppPushKind;
  label: string;
  description: string;
  mandatory: boolean;
  push: boolean;
  canToggle: boolean;
};

type StaffNotificationSettingsPanelProps = {
  authToken?: string | null;
  loadItems: () => Promise<StaffNotificationSettingItem[]>;
  saveToggle: (kind: StaffAppPushKind, push: boolean) => Promise<StaffNotificationSettingItem[]>;
  backHref?: string;
  backLabel?: string;
};

export function StaffNotificationSettingsPanel({
  authToken,
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
  const [pushStatus, setPushStatus] = useState<StaffAppPushStatus | null>(null);
  const [pushStatusLoading, setPushStatusLoading] = useState(false);
  const [pushSyncMsg, setPushSyncMsg] = useState<string | null>(null);
  const [pushSyncErr, setPushSyncErr] = useState<string | null>(null);
  const appVersionCode = isCbiseoStaffNativeApp() ? getCbiseoStaffAppVersionCode() : null;

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

  const refreshPushStatus = useCallback(() => {
    if (!authToken || !isCbiseoStaffNativeApp()) {
      setPushStatus(null);
      return;
    }
    setPushStatusLoading(true);
    fetchStaffAppPushStatus(authToken)
      .then(setPushStatus)
      .catch(() => setPushStatus(null))
      .finally(() => setPushStatusLoading(false));
  }, [authToken]);

  useStaffAppNativePushRegister(authToken);

  useEffect(() => {
    refreshPushStatus();
  }, [refreshPushStatus]);

  const syncPushToken = async () => {
    if (!authToken) {
      setPushSyncErr('로그인 세션이 없습니다.');
      return;
    }
    setPushSyncErr(null);
    setPushSyncMsg('등록 중…');
    requestCbiseoStaffNotificationPermission();
    try {
      const result = await registerCbiseoStaffPushWithPoll(authToken);
      if (result.ok) {
        setPushSyncMsg(result.message);
        setPushSyncErr(null);
        refreshPushStatus();
      } else {
        setPushSyncMsg(null);
        setPushSyncErr(result.message);
      }
    } catch (e) {
      setPushSyncMsg(null);
      setPushSyncErr(e instanceof Error ? e.message : '서버 등록 실패');
    }
  };

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

      {isCbiseoStaffNativeApp() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 space-y-2">
          <p className="text-fluid-2xs text-amber-900">
            앱 푸시는 「기기 알림 허용」과 「서버 등록」이 모두 필요합니다. 아래가 「등록 완료」여야
            알림이 옵니다.
            {appVersionCode != null ? (
              <>
                {' '}
                (앱 빌드 <strong>{appVersionCode}</strong>
                {appVersionCode < 21 ? ' — 21 이상 업데이트 필요' : ''})
              </>
            ) : (
              <> (앱 빌드 확인 불가 — Play v21 미설치 가능)</>
            )}
          </p>
          {pushStatusLoading ? (
            <p className="text-fluid-2xs text-amber-800">등록 상태 확인 중…</p>
          ) : pushStatus ? (
            <p className="text-fluid-2xs text-amber-900">
              서버 등록:{' '}
              <strong>{pushStatus.hasRegisteredToken ? '완료' : '미등록'}</strong>
              {pushStatus.hasRegisteredToken && pushStatus.deviceLabel
                ? ` · ${pushStatus.deviceLabel}`
                : ''}
              {!pushStatus.fcmServerConfigured ? ' · 서버 FCM 미설정' : ''}
            </p>
          ) : null}
          {pushSyncMsg ? (
            <p className="text-fluid-2xs text-emerald-800">{pushSyncMsg}</p>
          ) : null}
          {pushSyncErr ? (
            <p className="text-fluid-2xs text-red-800">{pushSyncErr}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => requestCbiseoStaffNotificationPermission()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              알림 허용
            </button>
            <button
              type="button"
              onClick={syncPushToken}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              서버 등록 새로고침
            </button>
            <button
              type="button"
              onClick={refreshPushStatus}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              상태 확인
            </button>
          </div>
        </div>
      ) : null}

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
