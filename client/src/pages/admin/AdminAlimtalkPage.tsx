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
  DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY,
  SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX,
} from '@shared/alimtalkScheduleD2Timing';
import {
  getTenantAlimtalkSendLogs,
  getTenantAlimtalkSettings,
  patchTenantAlimtalkSettings,
  postTenantAlimtalkChargeRequest,
  TENANT_ALIMTALK_CHARGE_PRESETS_KRW,
  type AlimtalkSendLogListItem,
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

function formatSendLogStatus(row: AlimtalkSendLogListItem): { label: string; className: string } {
  if (row.status === 'success') {
    if (row.deliveredChannel === 'LMS') {
      return { label: 'LMS 대체', className: 'text-amber-700' };
    }
    return { label: '알림톡', className: 'text-emerald-700' };
  }
  if (row.status === 'pending') {
    return { label: '처리 중', className: 'text-gray-500' };
  }
  return { label: '실패', className: 'text-red-700' };
}

function formatPreferredDateShort(ymd: string | null): string {
  if (!ymd) return '—';
  const [, m, d] = ymd.split('-');
  return `${Number(m)}/${Number(d)}`;
}

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
  const [scheduleD2DaysBeforePenalty, setScheduleD2DaysBeforePenalty] = useState<string>('');
  const [sendLogs, setSendLogs] = useState<AlimtalkSendLogListItem[]>([]);
  const [sendLogsTotal, setSendLogsTotal] = useState(0);
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
      const stored = data.scheduleD2DaysBeforePenalty;
      setScheduleD2DaysBeforePenalty(
        stored == null ? String(DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY) : String(stored),
      );
      try {
        const logs = await getTenantAlimtalkSendLogs(token, {
          templateCode: 'CBISEO_CUST_SCHEDULE_D2',
          limit: 30,
        });
        setSendLogs(logs.items);
        setSendLogsTotal(logs.total);
      } catch {
        setSendLogs([]);
        setSendLogsTotal(0);
      }
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
      const trimmed = scheduleD2DaysBeforePenalty.trim();
      let scheduleOffset: number | null;
      if (trimmed === '') {
        scheduleOffset = null;
      } else {
        const n = Number.parseInt(trimmed, 10);
        if (
          !Number.isFinite(n) ||
          !Number.isInteger(n) ||
          n < 0 ||
          n > SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX
        ) {
          throw new Error(
            `발송 시점은 0~${SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX}일 사이로 입력해 주세요.`,
          );
        }
        scheduleOffset = n === DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY ? null : n;
      }
      const data = await patchTenantAlimtalkSettings(token, {
        templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
          code,
          enabled: templateEnabled[code],
        })),
        scheduleD2DaysBeforePenalty: scheduleOffset,
      });
      setSettings(data);
      const stored = data.scheduleD2DaysBeforePenalty;
      setScheduleD2DaysBeforePenalty(
        stored == null ? String(DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY) : String(stored),
      );
      try {
        const logs = await getTenantAlimtalkSendLogs(token, {
          templateCode: 'CBISEO_CUST_SCHEDULE_D2',
          limit: 30,
        });
        setSendLogs(logs.items);
        setSendLogsTotal(logs.total);
      } catch {
        /* 발송 목록 갱신 실패는 저장 성공과 분리 */
      }
      setMessage('알림톡 설정을 저장했습니다.');
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

            {templateEnabled.CBISEO_CUST_SCHEDULE_D2 ? (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <h3 className="text-fluid-xs font-semibold text-gray-900">일정 확인 알림 — 발송 시점</h3>
                <p className="text-fluid-2xs text-gray-500">
                  위약금 발생일 기준 며칠 전에 보낼지 지정합니다. 매일 오후{' '}
                  {settings.scheduleD2SendHourKst}시(KST)에 자동 발송됩니다. 알림톡 본문의 무위약
                  마감일과 발송일은 다를 수 있습니다.
                </p>
                <label className="flex flex-wrap items-center gap-2 text-fluid-xs text-gray-700">
                  위약금 발생일
                  <input
                    type="number"
                    min={0}
                    max={SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX}
                    className="w-20 min-h-9 rounded-lg border border-gray-200 px-2 py-1 text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50"
                    value={scheduleD2DaysBeforePenalty}
                    disabled={!editable || saving}
                    onChange={(e) => setScheduleD2DaysBeforePenalty(e.target.value)}
                  />
                  일 전
                </label>
                <p className="text-fluid-2xs text-gray-400">
                  기본값 {DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY}일(위약 적용 하루 전). 0이면 위약
                  발생 당일 오후 {settings.scheduleD2SendHourKst}시에 발송합니다.
                </p>
              </div>
            ) : null}

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

          {templateEnabled.CBISEO_CUST_SCHEDULE_D2 ? (
            <section className={CARD}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-fluid-sm font-semibold text-gray-900">최근 일정 확인 알림 발송</h2>
                <span className="text-fluid-2xs text-gray-400 tabular-nums">
                  최근 30건 · 전체 {sendLogsTotal.toLocaleString('ko-KR')}건
                </span>
              </div>
              {sendLogs.length === 0 ? (
                <p className="text-fluid-2xs text-gray-500">아직 발송 내역이 없습니다.</p>
              ) : (
                <>
                  <p className="text-fluid-2xs text-gray-500 lg:hidden">표는 좌우로 스크롤할 수 있습니다.</p>
                  <div
                    className="-mx-4 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    <table className="w-full min-w-[640px] table-fixed border-collapse text-fluid-2xs sm:text-fluid-xs">
                      <colgroup>
                        <col className="w-[22%]" />
                        <col className="w-[18%]" />
                        <col className="w-[24%]" />
                        <col className="w-[14%]" />
                        <col className="w-[22%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                          <th className="px-2 py-2 text-center font-medium">발송 시각</th>
                          <th className="px-2 py-2 text-center font-medium">접수번호</th>
                          <th className="px-2 py-2 text-center font-medium">고객 · 청소일</th>
                          <th className="px-2 py-2 text-center font-medium">결과</th>
                          <th className="px-2 py-2 text-center font-medium">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendLogs.map((row) => {
                          const status = formatSendLogStatus(row);
                          return (
                            <tr key={row.id} className="border-b border-gray-100 text-gray-700">
                              <td className="px-2 py-2 text-center tabular-nums">
                                {new Date(row.createdAt).toLocaleString('ko-KR')}
                              </td>
                              <td
                                className="px-2 py-2 text-center truncate"
                                title={row.inquiryNumber ?? undefined}
                              >
                                {row.inquiryNumber ?? '—'}
                              </td>
                              <td
                                className="px-2 py-2 text-center truncate"
                                title={row.customerName ?? undefined}
                              >
                                {row.customerName ?? '—'} · {formatPreferredDateShort(row.preferredDateYmd)}
                              </td>
                              <td className={`px-2 py-2 text-center font-medium ${status.className}`}>
                                {status.label}
                              </td>
                              <td
                                className="px-2 py-2 text-center truncate text-gray-500"
                                title={row.errorMessage ?? row.toPhone}
                              >
                                {row.status === 'failed'
                                  ? row.errorMessage ?? '발송 실패'
                                  : row.toPhone}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
