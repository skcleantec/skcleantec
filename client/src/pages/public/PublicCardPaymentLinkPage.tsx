import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { fetchPublicCardPaymentLink, openPublicPaysisWindow } from '../../api/cardPayment';
import { CARD_PAYMENT_STATUS_LABEL, formatWon, type CardPaymentStatus } from '@shared/cardPayment';
import { TenantBrandLogo } from '../../components/brand/TenantBrandLogo';

export function PublicCardPaymentLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { scrollRef } = useLoginScrollSurface();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPublicCardPaymentLink>> | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchPublicCardPaymentLink(token)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '링크를 열 수 없습니다.'));
  }, [token]);

  return (
    <div ref={scrollRef} className="login-surface min-h-dvh overflow-y-auto bg-slate-100 px-4 py-10">
      <div className="login-scroll-content mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <TenantBrandLogo height={28} />
        {error ? <p className="mt-4 text-fluid-sm text-red-700">{error}</p> : null}
        {data ? (
          <div className="mt-4 space-y-2">
            <p className="text-fluid-xs text-slate-500">{data.tenantName}</p>
            <p className="text-fluid-sm font-semibold text-slate-900">{data.customerName} 고객님</p>
            <p className="text-fluid-lg font-semibold tabular-nums text-slate-900">{formatWon(data.amountWon)}</p>
            <p className="text-fluid-2xs text-slate-500">
              {CARD_PAYMENT_STATUS_LABEL[data.status as CardPaymentStatus]}
            </p>
            {data.status === 'APPROVED' ? (
              <p className="text-fluid-xs text-emerald-800">결제가 완료되었습니다.</p>
            ) : (
              <div className="space-y-2">
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-fluid-2xs text-slate-700">
                  카드번호는 이 페이지에 입력하지 않습니다. 결제창에서 입력합니다.
                </p>
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => {
                    if (!token) return;
                    setOpening(true);
                    const payScreen = window.matchMedia('(max-width: 1023px)').matches ? 'M' : 'P';
                    void openPublicPaysisWindow(token, payScreen)
                      .then((res) => {
                        window.location.assign(res.redirectUrl);
                      })
                      .catch((e: unknown) => {
                        setError(e instanceof Error ? e.message : '결제창을 열지 못했습니다.');
                        setOpening(false);
                      });
                  }}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  결제창 열기
                </button>
                <p className="text-fluid-2xs text-slate-500">문의는 담당 업체로 해 주세요.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
