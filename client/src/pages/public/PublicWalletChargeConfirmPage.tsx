import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  confirmWalletChargeByEmailToken,
  fetchWalletChargeConfirmPreview,
  type WalletChargeConfirmPreview,
} from '../../api/walletChargeConfirm';
import { TenantBrandLogo } from '../../components/brand/TenantBrandLogo';
import { LineMdIcon } from '../../components/ui/LineMdIcon';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';

function formatWon(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function formatKoDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function PublicWalletChargeConfirmPage() {
  const [params] = useSearchParams();
  const token = (params.get('t') ?? '').trim();
  const { scrollRef } = useLoginScrollSurface();

  const [preview, setPreview] = useState<WalletChargeConfirmPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('확인 링크가 올바르지 않습니다.');
      return;
    }
    setError(null);
    try {
      setPreview(await fetchWalletChargeConfirmPreview(token));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : '링크를 열 수 없습니다.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async () => {
    if (!token || !preview?.canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmWalletChargeByEmailToken(token);
      setPreview(result);
      setDoneMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const showSuccess = Boolean(
    preview && (preview.alreadyProcessed || doneMessage) && preview.status === 'APPROVED',
  );

  return (
    <div ref={scrollRef} className="login-surface min-h-dvh overflow-y-auto bg-slate-100 px-4 py-10">
      <div className="login-scroll-content mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <TenantBrandLogo height={28} />
        <h1 className="mt-4 text-fluid-sm font-semibold text-slate-900">지갑 충전 입금확인</h1>
        <p className="mt-1 text-fluid-2xs text-slate-500">
          운영팀 전용 · 이 화면에서 한 번 더 눌러야 잔액이 반영됩니다.
        </p>

        {error ? <p className="mt-4 text-fluid-sm text-red-700">{error}</p> : null}

        {preview ? (
          <div className="mt-4 space-y-3">
            {showSuccess ? (
              <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-fluid-xs text-emerald-900">
                <LineMdIcon
                  name="circle-to-confirm-circle-transition"
                  className="mt-0.5 size-5 shrink-0 text-emerald-700"
                />
                <span>{doneMessage ?? preview.message}</span>
              </p>
            ) : preview.alreadyProcessed ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-fluid-xs text-slate-700">
                {preview.message}
              </p>
            ) : (
              <p className="text-fluid-xs text-slate-600">{preview.message}</p>
            )}

            <dl className="space-y-1.5 text-fluid-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">업체</dt>
                <dd
                  className="min-w-0 truncate text-right font-medium text-slate-900"
                  title={preview.tenantName}
                >
                  {preview.tenantName}
                  <span className="ml-1 font-normal text-slate-500">({preview.tenantSlug})</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">신청자</dt>
                <dd className="text-slate-900">{preview.requesterName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">신청 시각</dt>
                <dd className="text-slate-900">{formatKoDateTime(preview.requestedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">충전금(공급가)</dt>
                <dd className="tabular-nums text-slate-900">{formatWon(preview.supplyAmountKrw)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">부가세</dt>
                <dd className="tabular-nums text-slate-900">{formatWon(preview.vatAmountKrw)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">받을 금액(입금액)</dt>
                <dd className="tabular-nums font-semibold text-slate-900">
                  {formatWon(preview.payAmountKrw)}
                </dd>
              </div>
              {preview.memo ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">메모</dt>
                  <dd className="min-w-0 text-right text-slate-900">{preview.memo}</dd>
                </div>
              ) : null}
              {preview.balanceAfterKrw != null ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">잔액</dt>
                  <dd className="tabular-nums text-slate-900">{formatWon(preview.balanceAfterKrw)}</dd>
                </div>
              ) : null}
              {preview.taxInvoiceLabel ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">세금계산서</dt>
                  <dd className="text-slate-900">{preview.taxInvoiceLabel}</dd>
                </div>
              ) : null}
            </dl>

            {preview.canConfirm ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {busy ? '확인 중…' : '입금 확인하고 충전'}
              </button>
            ) : null}

            <a
              href="/platform/billing"
              className="flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              플랫폼에서 확인
            </a>
          </div>
        ) : !error ? (
          <p className="mt-4 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
        ) : null}
      </div>
    </div>
  );
}
