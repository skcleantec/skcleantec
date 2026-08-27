import { useCallback, useEffect, useState } from 'react';
import {
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  ALIMTALK_CHARGE_MAX_KRW,
  ALIMTALK_CHARGE_UNIT_KRW,
  type AlimtalkTemplateCode,
} from '@shared/alimtalkPolicy';
import {
  getPlatformTenantAlimtalkPolicy,
  patchPlatformTenantAlimtalkPolicy,
  postPlatformTenantAlimtalkCharge,
  type PlatformAlimtalkPolicyResponse,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE, PlatformAlert, PlatformToggle } from '../../utils/platformUi';

const CHARGE_PRESETS_KRW = [
  ALIMTALK_CHARGE_UNIT_KRW,
  ALIMTALK_CHARGE_UNIT_KRW * 2,
  ALIMTALK_CHARGE_UNIT_KRW * 3,
  ALIMTALK_CHARGE_MAX_KRW,
] as const;

type Props = {
  tenantId: string;
  disabled?: boolean;
  onSaved?: () => void;
};

export function PlatformTenantAlimtalkPanel({ tenantId, disabled, onSaved }: Props) {
  const [settings, setSettings] = useState<PlatformAlimtalkPolicyResponse | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [monthlyFreeEnabled, setMonthlyFreeEnabled] = useState(true);
  const [templateEnabled, setTemplateEnabled] = useState<Record<AlimtalkTemplateCode, boolean>>({
    CBISEO_CUST_ORDER_LINK: true,
    CBISEO_CUST_ORDER_DONE: true,
    CBISEO_CUST_SCHEDULE_D2: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [charging, setCharging] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [chargeAmountKrw, setChargeAmountKrw] = useState<number>(ALIMTALK_CHARGE_UNIT_KRW);
  const [chargeMemo, setChargeMemo] = useState('');
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

  const handleCharge = async () => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setCharging(true);
    setMessage('');
    setError('');
    try {
      const data = await postPlatformTenantAlimtalkCharge(token, tenantId, {
        amountKrw: chargeAmountKrw,
        memo: chargeMemo.trim() || undefined,
      });
      setSettings(data);
      setChargeMemo('');
      setMessage(`${chargeAmountKrw.toLocaleString('ko-KR')}원 충전을 반영했습니다.`);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '충전 반영 실패');
    } finally {
      setCharging(false);
    }
  };

  const handleApproveChargeRequest = async (requestId: string, amountKrw: number) => {
    const token = getPlatformToken();
    if (!token || !tenantId) return;
    setApprovingRequestId(requestId);
    setMessage('');
    setError('');
    try {
      const data = await postPlatformTenantAlimtalkCharge(token, tenantId, {
        chargeRequestId: requestId,
        amountKrw,
        memo: '충전 신청 승인',
      });
      setSettings(data);
      setMessage(`${amountKrw.toLocaleString('ko-KR')}원 충전 신청을 반영했습니다.`);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '충전 신청 승인 실패');
    } finally {
      setApprovingRequestId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">알림톡 설정 불러오는 중…</p>;
  }

  return (
    <div className="space-y-4">
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
            disabled={disabled || saving || !licensed}
            onChange={() => setMonthlyFreeEnabled((v) => !v)}
          />
        </div>
        {settings && licensed ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
            <div>
              <dt className="text-gray-400">이번 달 무료</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {settings.monthlyFreeUsed.toLocaleString('ko-KR')} /{' '}
                {settings.monthlyFreeQuota.toLocaleString('ko-KR')}건
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">무료 잔여</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {settings.monthlyFreeRemaining.toLocaleString('ko-KR')}건
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">선불 잔액</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {settings.prepaidBalanceKrw.toLocaleString('ko-KR')}원
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
        <h2 className="text-base font-semibold text-gray-900">충전금 관리</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          입금 확인 후 반영합니다. {ALIMTALK_CHARGE_UNIT_KRW.toLocaleString('ko-KR')}원 단위, 1회 최대{' '}
          {ALIMTALK_CHARGE_MAX_KRW.toLocaleString('ko-KR')}원.
        </p>
        {settings?.pendingChargeRequests?.length ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-xs font-medium text-amber-900">업체 충전 신청 (대기)</h3>
            <ul className="mt-2 space-y-2">
              {settings.pendingChargeRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950"
                >
                  <span className="tabular-nums">
                    {req.amountKrw.toLocaleString('ko-KR')}원 ·{' '}
                    {new Date(req.createdAt).toLocaleString('ko-KR')}
                    {req.memo ? ` · ${req.memo}` : ''}
                  </span>
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={disabled || approvingRequestId === req.id}
                    onClick={() => void handleApproveChargeRequest(req.id, req.amountKrw)}
                  >
                    {approvingRequestId === req.id ? '반영 중…' : '입금 확인 · 반영'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {CHARGE_PRESETS_KRW.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={disabled || charging || !licensed}
              className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                chargeAmountKrw === amount
                  ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setChargeAmountKrw(amount)}
            >
              {amount.toLocaleString('ko-KR')}원
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs text-gray-500">
          메모 (선택)
          <input
            type="text"
            className={`${INPUT_BASE} mt-1`}
            value={chargeMemo}
            disabled={disabled || charging || !licensed}
            placeholder="입금 확인·계좌 등"
            onChange={(e) => setChargeMemo(e.target.value)}
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={disabled || charging || !licensed}
            onClick={() => void handleCharge()}
          >
            {charging ? '반영 중…' : `${chargeAmountKrw.toLocaleString('ko-KR')}원 충전 반영`}
          </button>
        </div>
        {settings?.recentChargeLogs?.length ? (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <h3 className="text-xs font-medium text-gray-700">최근 충전 이력</h3>
            <ul className="mt-2 space-y-1.5">
              {settings.recentChargeLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-gray-600"
                >
                  <span className="tabular-nums">
                    +{log.amountKrw.toLocaleString('ko-KR')}원 → 잔액{' '}
                    {log.balanceAfterKrw.toLocaleString('ko-KR')}원
                  </span>
                  <span className="text-gray-400">
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                    {log.memo ? ` · ${log.memo}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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
