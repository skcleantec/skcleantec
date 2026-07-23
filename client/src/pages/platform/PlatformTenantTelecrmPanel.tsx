import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TELECRM_DEFAULT_INCLUDED_SEATS,
  TELECRM_PLATFORM_IDS,
  telecrmMaxSeats,
  type TelecrmPlatformId,
  type TelecrmTenantPolicyMeta,
} from '@shared/telecrmTenantPolicy';
import {
  getPlatformTenantCrmEligibleUsers,
  getPlatformTenantTelecrmPolicy,
  patchPlatformTenantTelecrmPolicy,
  type PlatformCrmEligibleUser,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE, PlatformAlert, PlatformToggle } from '../../utils/platformUi';

type Props = {
  tenantId: string;
  disabled?: boolean;
  onSaved?: () => void;
};

export function PlatformTenantTelecrmPanel({ tenantId, disabled, onSaved }: Props) {
  const [licensed, setLicensed] = useState(false);
  const [additionalSeats, setAdditionalSeats] = useState(0);
  const [platforms, setPlatforms] = useState<TelecrmPlatformId[]>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<PlatformCrmEligibleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const maxSeats = useMemo(
    () => telecrmMaxSeats({ includedSeats: TELECRM_DEFAULT_INCLUDED_SEATS, additionalSeats }),
    [additionalSeats],
  );

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setLoading(true);
    setError('');
    try {
      const [policy, users] = await Promise.all([
        getPlatformTenantTelecrmPolicy(token, tenantId),
        getPlatformTenantCrmEligibleUsers(token, tenantId),
      ]);
      setLicensed(policy.licensed);
      setAdditionalSeats(policy.meta.additionalSeats);
      setPlatforms([...policy.meta.platforms]);
      setAllowedUserIds([...policy.meta.allowedUserIds]);
      setEligibleUsers(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CRM 설정 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePlatform = (id: TelecrmPlatformId) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const toggleUser = (userId: string) => {
    setAllowedUserIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= maxSeats) return prev;
      return [...prev, userId];
    });
  };

  const handleSave = async () => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const meta: TelecrmTenantPolicyMeta = {
        includedSeats: TELECRM_DEFAULT_INCLUDED_SEATS,
        additionalSeats,
        allowedUserIds,
        platforms,
      };
      await patchPlatformTenantTelecrmPolicy(token, tenantId, {
        licensed,
        ...meta,
      });
      setMessage('CRM 설정을 저장했습니다.');
      onSaved?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CRM 설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">CRM 설정 불러오는 중…</p>;
  }

  return (
    <div className="space-y-4">
      {message ? <PlatformAlert message={message} variant="success" /> : null}
      {error ? <PlatformAlert message={error} variant="error" /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">텔레CRM 라이선스</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Premium 플랜에 포함되지 않습니다. 별도 옵션·추가 사용료로 활성화합니다.
            </p>
          </div>
          <PlatformToggle
            checked={licensed}
            disabled={disabled || saving}
            onChange={() => setLicensed((v) => !v)}
          />
        </div>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">연동 플랫폼</h2>
        <p className="mt-0.5 mb-3 text-xs text-gray-500">CRM 화면·API에서 선택한 플랫폼만 사용할 수 있습니다.</p>
        <div className="flex flex-wrap gap-3">
          {TELECRM_PLATFORM_IDS.map((id) => (
            <label
              key={id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={platforms.includes(id)}
                disabled={disabled || saving || !licensed}
                onChange={() => togglePlatform(id)}
              />
              {id === 'soomgo' ? '숨고' : '미소'}
            </label>
          ))}
        </div>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">좌석 · 허용 계정</h2>
        <p className="mt-0.5 mb-3 text-xs text-gray-500">
          기본 {TELECRM_DEFAULT_INCLUDED_SEATS}명 포함. 추가 좌석은 별도 과금. 허용 계정은 1명 이상·최대{' '}
          {maxSeats}명까지 선택합니다.
        </p>
        <div className="mb-4 max-w-xs">
          <label className="mb-1 block text-xs font-medium text-gray-700">추가 좌석</label>
          <input
            type="number"
            min={0}
            step={1}
            value={additionalSeats}
            disabled={disabled || saving || !licensed}
            onChange={(e) => setAdditionalSeats(Math.max(0, Number(e.target.value) || 0))}
            className={INPUT_BASE}
          />
          <p className="mt-1 text-[10px] text-gray-400">
            최대 {maxSeats}명 (기본 {TELECRM_DEFAULT_INCLUDED_SEATS} + 추가 {additionalSeats})
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2 text-center">허용</th>
                <th className="px-3 py-2 text-center">이름</th>
                <th className="px-3 py-2 text-center">아이디</th>
                <th className="px-3 py-2 text-center">역할</th>
              </tr>
            </thead>
            <tbody>
              {eligibleUsers.map((u) => {
                const checked = allowedUserIds.includes(u.id);
                const seatFull = !checked && allowedUserIds.length >= maxSeats;
                return (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || saving || !licensed || seatFull}
                        onChange={() => toggleUser(u.id)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">{u.name}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{u.loginId}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                      {u.role === 'ADMIN' ? '관리자' : '마케터'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {licensed && allowedUserIds.length < 1 ? (
          <p className="mt-2 text-xs text-amber-700">CRM 사용 시 허용 계정을 1명 이상 선택해야 합니다.</p>
        ) : null}
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={() => void load()}>
          새로고침
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={disabled || saving} onClick={() => void handleSave()}>
          {saving ? '저장 중…' : 'CRM 설정 저장'}
        </button>
      </div>
    </div>
  );
}
