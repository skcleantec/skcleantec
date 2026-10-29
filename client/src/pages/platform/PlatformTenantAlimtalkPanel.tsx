import { useCallback, useEffect, useState } from 'react';
import {
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  type AlimtalkTemplateCode,
} from '@shared/alimtalkPolicy';
import {
  getPlatformTenantAlimtalkPolicy,
  patchPlatformTenantAlimtalkPolicy,
  type PlatformAlimtalkPolicyResponse,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, PlatformAlert, PlatformToggle } from '../../utils/platformUi';

type Props = {
  tenantId: string;
  disabled?: boolean;
  onSaved?: () => void;
};

export function PlatformTenantAlimtalkPanel({ tenantId, disabled, onSaved }: Props) {
  const [settings, setSettings] = useState<PlatformAlimtalkPolicyResponse | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [monthlyFreeEnabled, setMonthlyFreeEnabled] = useState(true);
  const [monthlyFreeUnlimited, setMonthlyFreeUnlimited] = useState(false);
  const [templateEnabled, setTemplateEnabled] = useState<Record<AlimtalkTemplateCode, boolean>>({
    CBISEO_CUST_ORDER_LINK: true,
    CBISEO_CUST_ORDER_DONE: true,
    CBISEO_CUST_SCHEDULE_D2: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPlatformTenantAlimtalkPolicy(token, tenantId);
      setSettings(data);
      setLicensed(data.licensed);
      setMonthlyFreeEnabled(data.monthlyFreeEnabled);
      setMonthlyFreeUnlimited(Boolean(data.monthlyFreeUnlimited));
      const next: Record<AlimtalkTemplateCode, boolean> = {
        CBISEO_CUST_ORDER_LINK: true,
        CBISEO_CUST_ORDER_DONE: true,
        CBISEO_CUST_SCHEDULE_D2: true,
      };
      for (const t of data.templates) {
        if (ALIMTALK_TEMPLATE_CODES.includes(t.code as AlimtalkTemplateCode)) {
          next[t.code as AlimtalkTemplateCode] = t.enabled;
        }
      }
      setTemplateEnabled(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림톡 설정 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await patchPlatformTenantAlimtalkPolicy(token, tenantId, {
        licensed,
        monthlyFreeEnabled,
        monthlyFreeUnlimited,
        templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
          code,
          enabled: templateEnabled[code],
        })),
      });
      setSettings(data);
      setMessage('알림톡 설정을 저장했습니다.');
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림톡 설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">알림톡 설정 불러오는 중…</p>;
  }

  return (
    <div id="section-alimtalk" className="scroll-mt-24 space-y-4">
      {message ? <PlatformAlert message={message} variant="success" /> : null}
      {error ? <PlatformAlert message={error} variant="error" /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">알림톡 라이선스</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Standard 이상 플랜은 기본 ON입니다. 해당 업체만 끄려면 토글을 OFF하세요.
            </p>
          </div>
          <PlatformToggle
            checked={licensed}
            disabled={disabled || saving || !settings?.planAllows}
            onChange={() => setLicensed((v) => !v)}
          />
        </div>
        {!settings?.planAllows ? (
          <p className="mt-2 text-xs text-amber-700">현재 플랜(Starter/Free)에서는 알림톡을 사용할 수 없습니다.</p>
        ) : null}
      </section>

      <section className={CARD_SECTION}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">월 무료 제공</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              OFF면 이번 달 무료 건수를 쓰지 않고 선불 잔액만 차감합니다. (플랜별{' '}
              {settings?.monthlyFreeQuota ?? 0}건/월)
            </p>
          </div>
          <PlatformToggle
            checked={monthlyFreeEnabled}
            disabled={disabled || saving || !licensed || monthlyFreeUnlimited}
            onChange={() => setMonthlyFreeEnabled((v) => !v)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">무제한</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              켜면 월 무료·충전 잔액과 관계없이 발송합니다. 솔라피 실비는 플랫폼 부담입니다.
            </p>
          </div>
          <PlatformToggle
            checked={monthlyFreeUnlimited}
            disabled={disabled || saving || !licensed || !settings?.planAllows}
            onChange={() => setMonthlyFreeUnlimited((v) => !v)}
          />
        </div>
        {settings && licensed ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3">
            <div>
              <dt className="text-gray-400">이번 달 사용</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {monthlyFreeUnlimited
                  ? `${settings.monthlyFreeUsed.toLocaleString('ko-KR')}건 · 무제한`
                  : `${settings.monthlyFreeUsed.toLocaleString('ko-KR')} / ${settings.monthlyFreeQuota.toLocaleString('ko-KR')}건`}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">무료 잔여</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {monthlyFreeUnlimited ? '무제한' : `${settings.monthlyFreeRemaining.toLocaleString('ko-KR')}건`}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">플랜</dt>
              <dd className="font-medium text-gray-900">{settings.plan}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-base font-semibold text-gray-900">템플릿 ON/OFF</h2>
        <p className="mt-0.5 mb-3 text-xs text-gray-500">
          꺼진 서식은 수동·자동 발송 모두 건너뜁니다.
        </p>
        <div className="space-y-2">
          {ALIMTALK_TEMPLATE_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={templateEnabled[code]}
                disabled={disabled || saving || !licensed}
                onChange={() =>
                  setTemplateEnabled((prev) => ({
                    ...prev,
                    [code]: !prev[code],
                  }))
                }
              />
              <span>
                <span className="font-medium text-gray-900">{ALIMTALK_TEMPLATE_LABELS[code]}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-gray-400">{code}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={() => void load()}>
          새로고침
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={disabled || saving} onClick={() => void handleSave()}>
          {saving ? '저장 중…' : '알림톡 설정 저장'}
        </button>
      </div>
    </div>
  );
}
