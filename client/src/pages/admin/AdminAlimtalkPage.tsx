import { useCallback, useEffect, useState } from 'react';
import {
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  ALIMTALK_CHARGE_MAX_KRW,
  ALIMTALK_CHARGE_UNIT_KRW,
  type AlimtalkTemplateCode,
} from '@shared/alimtalkPolicy';
import { formatAlimtalkTemplateHelpText } from '@shared/alimtalkTemplateHelp';
import {
  getTenantAlimtalkSettings,
  patchTenantAlimtalkSettings,
  postTenantAlimtalkChargeRequest,
  TENANT_ALIMTALK_CHARGE_PRESETS_KRW,
  type TenantAlimtalkSettings,
} from '../../api/alimtalk';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { getToken } from '../../stores/auth';

const INPUT_BASE =
  'mt-1 block w-full min-h-9 rounded-lg border border-gray-200 px-3 py-2 text-fluid-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50';

const BTN_PRIMARY =
  'rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN_SECONDARY =
  'rounded-lg border border-gray-200 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const CARD =
  'rounded-xl border border-gray-200 bg-white p-3 sm:p-4 space-y-3';

function formatBankLine(bank: TenantAlimtalkSettings['bank']): string | null {
  const parts = [bank.bankName, bank.accountNumber, bank.accountHolder].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

export function AdminAlimtalkPage() {
  const token = getToken();
  const [settings, setSettings] = useState<TenantAlimtalkSettings | null>(null);
  const [templateEnabled, setTemplateEnabled] = useState<Record<AlimtalkTemplateCode, boolean>>({
    CBISEO_CUST_ORDER_LINK: true,
    CBISEO_CUST_ORDER_DONE: true,
    CBISEO_CUST_SCHEDULE_D2: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [chargeAmountKrw, setChargeAmountKrw] = useState<number>(ALIMTALK_CHARGE_UNIT_KRW);
  const [chargeMemo, setChargeMemo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTenantAlimtalkSettings(token);
      setSettings(data);
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
      setError(e instanceof Error ? e.message : '알림톡 설정 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveTemplates = async () => {
    if (!token) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await patchTenantAlimtalkSettings(token, {
        templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
          code,
          enabled: templateEnabled[code],
        })),
      });
      setSettings(data);
      setMessage('알림톡 종류 설정을 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleChargeRequest = async () => {
    if (!token) return;
    setRequesting(true);
    setMessage('');
    setError('');
    try {
      const data = await postTenantAlimtalkChargeRequest(token, {
        amountKrw: chargeAmountKrw,
        memo: chargeMemo.trim() || undefined,
      });
      setSettings(data);
      setChargeMemo('');
      setMessage(`${chargeAmountKrw.toLocaleString('ko-KR')}원 충전 신청을 접수했습니다. 입금 후 반영까지 시간이 걸릴 수 있습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '충전 신청 실패');
    } finally {
      setRequesting(false);
    }
  };

  const bankLine = settings ? formatBankLine(settings.bank) : null;
  const editable = Boolean(settings?.licensed && settings?.planAllows);

  return (
    <div className="min-w-0 w-full max-w-full space-y-3 sm:space-y-4">
      <PageTitleWithFavorite label="알림톡" path="/admin/team-leaders/alimtalk">
        <p className="mt-1 text-fluid-xs text-gray-500 sm:text-fluid-sm">
          월 무료·선불 잔액 확인, 충전 신청, 알림톡 종류 ON/OFF (기본 전체 ON)
        </p>
      </PageTitleWithFavorite>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</div>
      ) : null}

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : !settings ? null : !settings.planAllows ? (
        <section className={CARD}>
          <p className="text-fluid-sm text-amber-800">
            현재 플랜(Starter/Free)에서는 알림톡을 사용할 수 없습니다. Standard 이상 플랜으로 변경 후 이용해 주세요.
          </p>
        </section>
      ) : !settings.licensed ? (
        <section className={CARD}>
          <p className="text-fluid-sm text-amber-800">
            알림톡 라이선스가 꺼져 있습니다. 청소비서 운영팀에 문의해 주세요.
          </p>
        </section>
      ) : (
        <>
          <section className={CARD}>
            <h2 className="text-fluid-sm font-semibold text-gray-900">이용 현황</h2>
            {!settings.canSend ? (
              <p className="text-fluid-2xs text-amber-700">
                무료 잔여가 3건 미만이고 선불 잔액이 부족하면 발송이 중단될 수 있습니다. 충전을 신청해 주세요.
              </p>
            ) : null}
            <dl className="grid grid-cols-2 gap-2 text-fluid-2xs text-gray-600 sm:grid-cols-4 sm:text-fluid-xs">
              <div>
                <dt className="text-gray-400">플랜</dt>
                <dd className="font-medium text-gray-900">{settings.plan}</dd>
              </div>
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
            </dl>
            <p className="text-fluid-2xs text-gray-500">
              무료 건수는 매월 1일(KST) 리셋됩니다. 초과·대체문자(LMS)는 선불에서 차감(알림톡{' '}
              {settings.unitPriceAtaKrw.toLocaleString('ko-KR')}원/건, LMS{' '}
              {settings.unitPriceLmsKrw.toLocaleString('ko-KR')}원/건).
              {!settings.monthlyFreeEnabled ? ' (운영 설정상 이번 달 무료 제공이 꺼져 있을 수 있습니다.)' : ''}
            </p>
          </section>

          <section className={CARD}>
            <h2 className="text-fluid-sm font-semibold text-gray-900">충전 신청</h2>
            <p className="text-fluid-2xs text-gray-500">
              {ALIMTALK_CHARGE_UNIT_KRW.toLocaleString('ko-KR')}원 단위, 1회 최대{' '}
              {ALIMTALK_CHARGE_MAX_KRW.toLocaleString('ko-KR')}원. 입금 확인 후 잔액에 반영됩니다.
            </p>
            {bankLine ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-slate-700">
                입금 계좌: {bankLine}
                {settings.bank.paymentGuideText ? (
                  <>
                    <br />
                    {settings.bank.paymentGuideText}
                  </>
                ) : null}
              </p>
            ) : null}
            {settings.pendingChargeRequest ? (
              <p className="text-fluid-2xs text-amber-800">
                처리 대기 중: {settings.pendingChargeRequest.amountKrw.toLocaleString('ko-KR')}원 (
                {new Date(settings.pendingChargeRequest.createdAt).toLocaleString('ko-KR')} 신청)
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {TENANT_ALIMTALK_CHARGE_PRESETS_KRW.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={!editable || requesting || Boolean(settings.pendingChargeRequest)}
                  className={`rounded-lg border px-3 py-1.5 text-fluid-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
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
            <label className="block text-fluid-2xs text-gray-500">
              메모 (선택, 입금자명 등)
              <input
                type="text"
                className={INPUT_BASE}
                value={chargeMemo}
                disabled={!editable || requesting || Boolean(settings.pendingChargeRequest)}
                onChange={(e) => setChargeMemo(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={!editable || requesting || Boolean(settings.pendingChargeRequest)}
                onClick={() => void handleChargeRequest()}
              >
                {requesting ? '신청 중…' : `${chargeAmountKrw.toLocaleString('ko-KR')}원 충전 신청`}
              </button>
            </div>
            {settings.recentChargeLogs.length > 0 ? (
              <div className="border-t border-gray-100 pt-3">
                <h3 className="text-fluid-2xs font-medium text-gray-700">최근 충전 반영</h3>
                <ul className="mt-2 space-y-1.5">
                  {settings.recentChargeLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-2 text-fluid-2xs text-gray-600"
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

          <section className={CARD}>
            <h2 className="text-fluid-sm font-semibold text-gray-900">알림톡 종류 (기본 ON)</h2>
            <p className="text-fluid-2xs text-gray-500">끄고 싶은 종류만 OFF하세요. OFF면 수동·자동 모두 발송하지 않습니다.</p>
            <div className="space-y-2">
              {ALIMTALK_TEMPLATE_CODES.map((code) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={templateEnabled[code]}
                    disabled={!editable || saving}
                    onChange={() =>
                      setTemplateEnabled((prev) => ({
                        ...prev,
                        [code]: !prev[code],
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-fluid-xs font-medium text-gray-900">
                      {ALIMTALK_TEMPLATE_LABELS[code]}
                      <HelpTooltip text={formatAlimtalkTemplateHelpText(code)} />
                    </span>
                    <span className="mt-0.5 block text-fluid-2xs text-gray-400">{code}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={() => void load()}>
                새로고침
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={!editable || saving}
                onClick={() => void handleSaveTemplates()}
              >
                {saving ? '저장 중…' : '설정 저장'}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
