import { useCallback, useEffect, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { getToken } from '../../stores/auth';
import {
  getAdminNotificationPolicy,
  updateAdminNotificationPolicy,
  type TenantNotificationPolicyDto,
} from '../../api/notificationPolicy';
import {
  NOTIFICATION_KIND_DESCRIPTIONS,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KIND_ORDER,
  defaultTenantNotificationPolicy,
  type NotificationKindRule,
} from '@shared/notificationPolicy';
import type { StaffAppPushKind } from '@shared/staffAppPush';

function parseRemindMinutes(raw: string): number[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
}

function formatRemindMinutes(values: number[]): string {
  return values.join(', ');
}

export function AdminNotificationPolicyPage() {
  const token = getToken();
  const [policy, setPolicy] = useState<TenantNotificationPolicyDto>(defaultTenantNotificationPolicy());
  const [remindDraft, setRemindDraft] = useState<Record<StaffAppPushKind, string>>({} as Record<StaffAppPushKind, string>);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getAdminNotificationPolicy(token)
      .then((r) => {
        setPolicy(r.policy);
        const draft = {} as Record<StaffAppPushKind, string>;
        for (const k of NOTIFICATION_KIND_ORDER) {
          draft[k] = formatRemindMinutes(r.policy.kinds[k].remindBeforeDeadlineMinutes);
        }
        setRemindDraft(draft);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  const patchKind = useCallback((kind: StaffAppPushKind, patch: Partial<NotificationKindRule>) => {
    setPolicy((prev) => ({
      kinds: {
        ...prev.kinds,
        [kind]: { ...prev.kinds[kind], ...patch },
      },
    }));
  }, []);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setErr(null);
    try {
      const next: TenantNotificationPolicyDto = {
        kinds: { ...policy.kinds },
      };
      for (const k of NOTIFICATION_KIND_ORDER) {
        if (k === 'happy_call') {
          next.kinds[k] = {
            ...next.kinds[k],
            remindBeforeDeadlineMinutes: parseRemindMinutes(remindDraft[k] ?? ''),
          };
        }
        if (next.kinds[k].mandatory) {
          next.kinds[k].defaultPush = true;
        }
      }
      const r = await updateAdminNotificationPolicy(token, next);
      setPolicy(r.policy);
      setSavedMsg('저장했습니다.');
      window.setTimeout(() => setSavedMsg(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <PageTitleWithFavorite label="알림 설정">
          <h1 className="text-xl font-semibold text-gray-800">알림 설정</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-sm text-gray-500">
          업체 전체 알림 규칙입니다. 「필수」로 지정한 알림은 팀장 앱에서 끌 수 없습니다.
        </p>
      </div>

      {err ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>
      ) : null}
      {savedMsg ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{savedMsg}</p>
      ) : null}

      <div className="space-y-3">
        {NOTIFICATION_KIND_ORDER.map((kind) => {
          const rule = policy.kinds[kind];
          const showRepeat = kind === 'happy_call';
          return (
            <section
              key={kind}
              className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4 space-y-3"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{NOTIFICATION_KIND_LABELS[kind]}</h2>
                <p className="text-fluid-2xs sm:text-xs text-gray-500 mt-0.5">{NOTIFICATION_KIND_DESCRIPTIONS[kind]}</p>
              </div>

              <label className="flex items-center justify-between gap-3 text-sm">
                <span>알림 사용</span>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => patchKind(kind, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </label>

              {rule.enabled ? (
                <>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>팀장 필수 (앱에서 끌 수 없음)</span>
                    <input
                      type="checkbox"
                      checked={rule.mandatory}
                      onChange={(e) =>
                        patchKind(kind, {
                          mandatory: e.target.checked,
                          defaultPush: e.target.checked ? true : rule.defaultPush,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>신규 사용자 기본 푸시 ON</span>
                    <input
                      type="checkbox"
                      checked={rule.defaultPush}
                      disabled={rule.mandatory}
                      onChange={(e) => patchKind(kind, { defaultPush: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
                    />
                  </label>

                  {showRepeat ? (
                    <div className="border-t border-gray-100 pt-3 space-y-3">
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>마감 초과 후 반복 알림</span>
                        <input
                          type="checkbox"
                          checked={rule.repeatEnabled}
                          onChange={(e) => patchKind(kind, { repeatEnabled: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </label>
                      {rule.repeatEnabled ? (
                        <>
                          <label className="block text-sm space-y-1">
                            <span className="text-gray-700">반복 간격 (분)</span>
                            <input
                              type="number"
                              min={5}
                              step={5}
                              value={rule.repeatIntervalMinutes}
                              onChange={(e) =>
                                patchKind(kind, {
                                  repeatIntervalMinutes: Math.max(5, parseInt(e.target.value, 10) || 60),
                                })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-sm space-y-1">
                            <span className="text-gray-700">접수당 최대 반복 횟수</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={rule.repeatMaxPerInquiry}
                              onChange={(e) =>
                                patchKind(kind, {
                                  repeatMaxPerInquiry: Math.max(1, parseInt(e.target.value, 10) || 3),
                                })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                          </label>
                        </>
                      ) : null}
                      <label className="block text-sm space-y-1">
                        <span className="text-gray-700">마감 전 알림 (분, 쉼표 구분)</span>
                        <p className="text-fluid-2xs text-gray-500">
                          예: 720, 120 → 마감 12시간 전·2시간 전 (cron 15~20분 주기 권장)
                        </p>
                        <input
                          type="text"
                          value={remindDraft[kind] ?? ''}
                          onChange={(e) =>
                            setRemindDraft((d) => ({ ...d, [kind]: e.target.value }))
                          }
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          placeholder="720, 120"
                        />
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );
}
