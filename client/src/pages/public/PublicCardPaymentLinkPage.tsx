import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fetchPublicCardPaymentLink, openPublicPaysisWindow } from '../../api/cardPayment';
import { PublicPayLinkView, type PublicPayLinkViewData } from '../../components/card-payment/PublicPayLinkView';
import { payLinkShot } from '../../components/card-payment/payLinkShot';

export function PublicCardPaymentLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const shot = payLinkShot('tenant', params.get('shot'));
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [data, setData] = useState<PublicPayLinkViewData | null>(shot);

  useEffect(() => {
    if (shot || !token) return;
    void fetchPublicCardPaymentLink(token)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '링크를 열 수 없습니다.'));
  }, [token, shot]);

  if (!data) {
    return (
      <div className="min-h-dvh bg-[#f3f5f8] px-4 py-10 text-sm text-[#6b7280] dark:bg-[#0d1117]">
        {error ?? '결제 정보를 불러오는 중입니다.'}
      </div>
    );
  }

  return (
    <PublicPayLinkView
      view={data}
      error={error}
      opening={opening}
      onPay={
        data.state === 'wait'
          ? () => {
              if (shot || !token) return;
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
            }
          : undefined
      }
    />
  );
}
