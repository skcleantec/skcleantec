import { useCallback, useEffect, useState } from 'react';
import {
  ALIMTALK_CHARGE_MAX_KRW,
  ALIMTALK_CHARGE_UNIT_KRW,
} from '@shared/alimtalkPolicy';
import {
  getPlatformTenantAlimtalkPolicy,
  postPlatformTenantAlimtalkCharge,
  type PlatformAlimtalkPolicyResponse,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, CARD_SECTION, INPUT_BASE, PlatformAlert } from '../../utils/platformUi';

const CHARGE_PRESETS_KRW = [
  ALIMTALK_CHARGE_UNIT_KRW,
  ALIMTALK_CHARGE_UNIT_KRW * 2,
  ALIMTALK_CHARGE_UNIT_KRW * 3,
  ALIMTALK_CHARGE_MAX_KRW,
] as const;

type Props = {
  tenantId: string;
  disabled?: boolean;
};

export function PlatformTenantWalletCard({ tenantId, disabled }: Props) {
  const [settings, setSettings] = useState<PlatformAlimtalkPolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
      setSettings(await getPlatformTenantAlimtalkPolicy(token, tenantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : '지갑 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : '충전 신청 승인 실패');
    } finally {
      setApprovingRequestId(null);
    }
  };

  const licensed = settings?.licensed === true;
  const usage = settings?.monthUsage ?? [
    { key: 'alimtalk' as const, label: '알림톡', amountKrw: 0 },
    { key: 'cashbill' as const, label: '현금영수증', amountKrw: 0 },
    { key: 'taxinvoice' as const, label: '세금계산서', amountKrw: 0 },
  ];

  return (
    <section id="section-wallet" className={`${CARD_SECTION} scroll-mt-24`}>
      <h2 className="text-base font-semibold text-gray-900">청소비서 지갑</h2>
      <p className="mt-0.5 text-fluid-xs text-gray-500">
        알림톡·현금영수증·세금계산서 공용 잔액입니다. {ALIMTALK_CHARGE_UNIT_KRW.toLocaleString('ko-KR')}원 단위, 1회 최대{' '}
        {ALIMTALK_CHARGE_MAX_KRW.toLocaleString('ko-KR')}원.
      </p>
      {message ? <div className="mt-3"><PlatformAlert message={message} variant="success" /></div> : null}
      {error ? <div className="mt-3"><PlatformAlert message={error} variant="error" /></div> : null}
      {loading ? <p className="mt-3 text-fluid-sm text-gray-500">불러오는 중…</p> : null}
      {settings ? (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-fluid-xs text-gray-400">잔액</p>
              <p className="text-3xl font-semibold tabular-nums leading-none text-gray-900">
                {settings.prepaidBalanceKrw.toLocaleString('ko-KR')}원
              </p>
            </div>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={disabled || charging || !licensed}
              onClick={() => void handleCharge()}
            >
              {charging ? '반영 중…' : '충전 반영'}
            </button>
          </div>
          {!licensed ? (
            <p className="mt-2 text-fluid-xs text-amber-700">직접 충전은 알림톡 라이선스가 켜져 있을 때 반영됩니다. 대기 신청은 라이선스와 상관없이 반영할 수 있습니다.</p>
          ) : null}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-fluid-xs text-gray-600">
            {usage.map((row) => (
              <div key={row.key}>
                <dt className="text-gray-400">이번 달 {row.label}</dt>
                <dd className="font-medium tabular-nums text-gray-900">{row.amountKrw.toLocaleString('ko-KR')}원</dd>
              </div>
            ))}
          </dl>
          {settings.pendingChargeRequests?.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-fluid-xs font-medium text-amber-900">충전 신청 대기</h3>
              <ul className="mt-2 space-y-2">
                {settings.pendingChargeRequests.map((req) => (
                  <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 text-fluid-xs text-amber-950">
                    <span className="tabular-nums">
                      {req.amountKrw.toLocaleString('ko-KR')}원 · {new Date(req.createdAt).toLocaleString('ko-KR')}
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
          ) : (
            <p className="mt-3 text-fluid-xs text-gray-400">충전 신청 대기 없음</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {CHARGE_PRESETS_KRW.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={disabled || charging || !licensed}
                className={`rounded-lg border px-3 py-1.5 text-fluid-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
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
          <label className="mt-3 block text-fluid-xs text-gray-500">
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
          <div className="mt-4 border-t border-gray-100 pt-3">
            <h3 className="text-fluid-xs font-medium text-gray-700">최근 충전 이력</h3>
            {settings.recentChargeLogs?.length ? (
              <ul className="mt-2 space-y-1.5">
                {settings.recentChargeLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-fluid-xs text-gray-600">
                    <span className="tabular-nums">
                      +{log.amountKrw.toLocaleString('ko-KR')}원 → 잔액 {log.balanceAfterKrw.toLocaleString('ko-KR')}원
                    </span>
                    <span className="text-gray-400">
                      {new Date(log.createdAt).toLocaleString('ko-KR')}
                      {log.memo ? ` · ${log.memo}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-fluid-xs text-gray-400">최근 충전 이력 없음</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
