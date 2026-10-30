import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { fetchPublicServiceBridgeLink, openPublicServiceBridgeWindow } from '../../api/cardPayment';

export function PublicServiceBridgePayPage() {
  const { token } = useParams<{ token: string }>();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPublicServiceBridgeLink>> | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetchPublicServiceBridgeLink(token)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '링크를 열 수 없습니다.'));
  }, [token]);

  return (
    <div ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface min-h-dvh overflow-y-auto bg-slate-100 px-4 py-8">
      <div className="login-scroll-content mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <p className="text-sm font-semibold text-[#111a2b]">서비스브릿지</p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {data ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-800">{data.buyerName ? `${data.buyerName} 고객님` : '고객님'}</p>
            <p className="text-base font-semibold text-slate-900">{data.goodsName}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{data.amountKrw.toLocaleString('ko-KR')}원</p>
            <p className="text-xs text-slate-500">{data.statusLabel}</p>
            {data.payable ? (
              <>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                  카드번호는 이 페이지에 입력하지 않습니다. 결제창에서 입력합니다.
                </p>
                <button
                  type="button"
                  disabled={opening}
                  onClick={() => {
                    if (!token) return;
                    setOpening(true);
                    const payScreen = window.matchMedia('(max-width: 1023px)').matches ? 'M' : 'P';
                    void openPublicServiceBridgeWindow(token, payScreen)
                      .then((res) => {
                        window.location.assign(res.redirectUrl);
                      })
                      .catch((e: unknown) => {
                        setError(e instanceof Error ? e.message : '결제창을 열지 못했습니다.');
                        setOpening(false);
                      });
                  }}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#111a2b] text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  {opening ? '결제창 여는 중' : '결제창 열기'}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-700">{data.expired ? '이 링크는 만료되었습니다.' : '결제가 완료되었습니다.'}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
