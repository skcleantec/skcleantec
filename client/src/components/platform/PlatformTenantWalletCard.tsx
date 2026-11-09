import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { walletChargePayKrw, walletChargeVatKrw, walletSupplyFromPayKrw } from '@shared/alimtalkPolicy';
import {
  getPlatformTenantAlimtalkPolicy,
  postPlatformTenantAlimtalkCharge,
  type PlatformAlimtalkPolicyResponse,
} from '../../api/platformTenants';
import { getPlatformToken } from '../../stores/platformAuth';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE, PlatformAlert } from '../../utils/platformUi';
import { ensureInputVisibleAboveKeyboard } from '../../hooks/useMobileInputVisibility';
import { getStaffAppScrollElement } from '../../utils/staffAppScrollRestore';

const MAX_KRW = 1_000_000;
const KINDS = [
  ['paid', '입금 확인(유상)'],
  ['grant', '무상 지급'],
  ['clawback', '회수(차감)'],
] as const;

type Kind = (typeof KINDS)[number][0];

type Props = {
  tenantId: string;
  tenantName: string;
  disabled?: boolean;
};

export function PlatformTenantWalletCard({ tenantId, tenantName, disabled }: Props) {
  const [settings, setSettings] = useState<PlatformAlimtalkPolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [charging, setCharging] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [kind, setKind] = useState<Kind>('paid');
  const [fromPayAmount, setFromPayAmount] = useState(false);
  const [chargeMemo, setChargeMemo] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const rawAmount = Math.round(Number(amountText.replace(/[^\d]/g, '')));
  const paidSplit = useMemo(() => {
    if (kind !== 'paid' || !Number.isInteger(rawAmount) || rawAmount <= 0) {
      return { supplyKrw: rawAmount, vatKrw: 0, payKrw: rawAmount };
    }
    if (fromPayAmount) {
      const split = walletSupplyFromPayKrw(rawAmount);
      return { supplyKrw: split.supplyKrw, vatKrw: split.vatKrw, payKrw: rawAmount };
    }
    return {
      supplyKrw: rawAmount,
      vatKrw: walletChargeVatKrw(rawAmount),
      payKrw: walletChargePayKrw(rawAmount),
    };
  }, [kind, rawAmount, fromPayAmount]);
  const amountKrw = kind === 'paid' ? paidSplit.supplyKrw : rawAmount;
  const reasonNeeded = kind !== 'paid';
  const amountOk = Number.isInteger(amountKrw) && amountKrw >= 1 && amountKrw <= MAX_KRW;
  const reasonOk = !reasonNeeded || chargeMemo.trim().length > 0;

  const handleCharge = async () => {
    const token = getPlatformToken();
    if (!token || !tenantId || !amountOk || !reasonOk) return;
    setCharging(true);
    setMessage('');
    setError('');
    try {
      const data = await postPlatformTenantAlimtalkCharge(token, tenantId, {
        amountKrw,
        kind,
        memo: chargeMemo.trim() || undefined,
      });
      setSettings(data);
      setChargeMemo('');
      setAmountText('');
      setFromPayAmount(false);
      setConfirmOpen(false);
      const verb = kind === 'clawback' ? '회수' : '반영';
      const suffix =
        kind === 'paid'
          ? ` (받을 금액 ${paidSplit.payKrw.toLocaleString('ko-KR')}원 · 부가세 ${paidSplit.vatKrw.toLocaleString('ko-KR')}원 · 세금계산서 자동 발행 요청)`
          : '';
      setMessage(`${amountKrw.toLocaleString('ko-KR')}원을 ${verb}했습니다.${suffix}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '반영에 실패했습니다.');
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
        알림톡·현금영수증·세금계산서 공용 잔액입니다. 1원 이상, 1회 최대 {MAX_KRW.toLocaleString('ko-KR')}원.
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
              disabled={disabled || charging || !licensed || !amountOk || !reasonOk}
              onClick={() => setConfirmOpen(true)}
            >
              {kind === 'clawback' ? '회수' : '충전 반영'}
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
          <div
            className="mt-3 space-y-2"
            onFocusCapture={(e) => {
              const target = e.target;
              if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) return;
              ensureInputVisibleAboveKeyboard(target, getStaffAppScrollElement(), 'smooth', 28);
            }}
          >
            <label className="block text-fluid-xs text-gray-500">
              {kind === 'paid' ? (fromPayAmount ? '입금액(부가세 포함)' : '충전금(공급가)') : '금액'}
              <input
                inputMode="numeric"
                className={`${INPUT_BASE} mt-1 tabular-nums`}
                value={amountText}
                disabled={disabled || charging || !licensed}
                placeholder="1 ~ 1,000,000"
                onChange={(e) => setAmountText(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            {kind === 'paid' ? (
              <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-fluid-xs text-gray-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={fromPayAmount}
                    disabled={disabled || charging || !licensed}
                    onChange={(e) => setFromPayAmount(e.target.checked)}
                  />
                  입금액으로 계산
                </label>
                <p>
                  받을 금액(부가세 포함){' '}
                  <span className="font-semibold tabular-nums text-gray-900">
                    {paidSplit.payKrw > 0 ? `${paidSplit.payKrw.toLocaleString('ko-KR')}원` : '—'}
                  </span>
                  {paidSplit.supplyKrw > 0 ? (
                    <span className="text-gray-500">
                      {' '}· 충전금 {paidSplit.supplyKrw.toLocaleString('ko-KR')}원 · 부가세 {paidSplit.vatKrw.toLocaleString('ko-KR')}원
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-fluid-xs">
              {KINDS.map(([id, label]) => (
                <label key={id} className="inline-flex items-center gap-1 text-gray-700">
                  <input
                    type="radio"
                    name={`wallet-kind-${tenantId}`}
                    checked={kind === id}
                    disabled={disabled || charging || !licensed}
                    onChange={() => {
                      setKind(id);
                      if (id !== 'paid') setFromPayAmount(false);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="block text-fluid-xs text-gray-500">
              {reasonNeeded ? '사유 (필수)' : '사유 (선택)'}
              <input
                type="text"
                className={`${INPUT_BASE} mt-1`}
                value={chargeMemo}
                disabled={disabled || charging || !licensed}
                onChange={(e) => setChargeMemo(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <h3 className="text-fluid-xs font-medium text-gray-700">최근 충전 이력</h3>
            {settings.recentChargeLogs?.length ? (
              <ul className="mt-2 space-y-1.5">
                {settings.recentChargeLogs.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-fluid-xs text-gray-600">
                    <span className="tabular-nums">
                      {log.tenantLabel ?? '충전'} {log.amountKrw > 0 ? '+' : ''}
                      {log.amountKrw.toLocaleString('ko-KR')}원 → 잔액 {log.balanceAfterKrw.toLocaleString('ko-KR')}원
                    </span>
                    <span className="text-gray-400">
                      {new Date(log.createdAt).toLocaleString('ko-KR')}
                      {log.actorName ? ` · ${log.actorName}` : ''}
                      {log.kind === 'paid' ? ' · 입금 확인(유상)' : log.kind === 'grant' ? ' · 무상 지급' : log.kind === 'clawback' ? ' · 회수(차감)' : ''}
                      {log.reason ? ` · ${log.reason}` : ''}
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
      {confirmOpen
        ? createPortal(
            <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
              <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="wallet-adjust-title">
                <h3 id="wallet-adjust-title" className="text-fluid-sm font-semibold text-gray-900">반영 전에 확인해 주세요</h3>
                <dl className="mt-3 space-y-1 text-fluid-xs text-gray-700">
                  <div className="flex justify-between gap-3"><dt>업체</dt><dd className="font-medium text-gray-900">{tenantName}</dd></div>
                  <div className="flex justify-between gap-3"><dt>금액</dt><dd className="tabular-nums font-medium text-gray-900">{amountKrw.toLocaleString('ko-KR')}원</dd></div>
                  <div className="flex justify-between gap-3"><dt>구분</dt><dd className="font-medium text-gray-900">{KINDS.find(([id]) => id === kind)?.[1]}</dd></div>
                </dl>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={`${BTN_SECONDARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} disabled={charging} onClick={() => setConfirmOpen(false)}>닫기</button>
                  <button type="button" className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`} disabled={charging} onClick={() => void handleCharge()}>
                    {charging ? '반영 중…' : '반영'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
