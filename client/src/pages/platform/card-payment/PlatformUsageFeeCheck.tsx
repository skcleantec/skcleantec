import { useState } from 'react';
import { openPlatformUsageFeeWindow, probePlatformUsageFeeKeyin } from '../../../api/platformCardPayment';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../../utils/platformUi';

const BTN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none';

export function PlatformUsageFeeCheck() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className={`${BTN_PRIMARY} ${BTN}`}
          onClick={() => {
            setBusy(true);
            setError(null);
            void openPlatformUsageFeeWindow()
              .then((result) => {
                setMessage(result.message);
                if (result.ok && result.redirectUrl) {
                  window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
                }
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '결제창을 열지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          이용료 결제창 열기
        </button>
        <button
          type="button"
          disabled={busy}
          className={`${BTN_SECONDARY} ${BTN}`}
          onClick={() => {
            setBusy(true);
            setError(null);
            void probePlatformUsageFeeKeyin()
              .then((result) => setMessage(result.message))
              .catch((e: unknown) => setError(e instanceof Error ? e.message : '수기 확인에 실패했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          수기 연결 확인
        </button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-gray-800">{message}</p> : null}
    </div>
  );
}
