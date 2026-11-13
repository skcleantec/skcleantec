import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BTN_SECONDARY } from '../../../utils/platformUi';
import { PlatformCardPaymentKeySection } from './PlatformCardPaymentKeySection';
import { PlatformUsageFeeCheck } from './PlatformUsageFeeCheck';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { PlatformPgMerchantStatusSection } from './PlatformPgMerchantStatusSection';
import { fetchPlatformCardPaymentSettings } from '../../../api/platformCardPayment';
import { formatWon } from '@shared/cardPayment';

export function PlatformCardPaymentPage() {
  const [summary, setSummary] = useState({
    approvedCount: 0,
    amountWon: 0,
    tenantFeeWon: 0,
    platformCostWon: 0,
    platformSpreadWon: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [serviceBridge, setServiceBridge] = useState<
    Awaited<ReturnType<typeof fetchPlatformCardPaymentSettings>>['serviceBridge']
  >(undefined);

  const [tool, setTool] = useState<'keys' | 'fees' | 'partner' | 'usage' | null>(null);
  const [copied, setCopied] = useState(false);
  const partnerUrl = `${window.location.origin}/pg-partner`;

  const reload = () => {
    void fetchPlatformCardPaymentSettings()
      .then((s) => {
        setSummary(s.summary);
        setServiceBridge(s.serviceBridge);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">카드결제 PG</h1>
        <PlatformCardPaymentTabs />
        <p className="mt-1 text-sm text-gray-500">가맹점 진행 현황 · 키 연결 · 수수료(부가세 포함)</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section aria-label="PG 도구" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ['keys', '업체 결제 키', '업체별 수기·링크 키 입력'],
            [
              'fees',
              '수수료',
              `완료 ${summary.approvedCount}건 · 마진 ${formatWon(summary.platformSpreadWon)}`,
            ],
            ['partner', '원성 로그인 주소', '원성 본사용 주소 복사'],
            [
              'usage',
              '이용료 결제 테스트',
              serviceBridge?.keyin.configured && serviceBridge?.appCard.configured
                ? '수기·앱카드 연결됨'
                : serviceBridge?.keyin.configured || serviceBridge?.appCard.configured
                  ? '일부만 연결됨'
                  : '키 없음',
            ],
          ] as const
        ).map(([id, title, sub]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCopied(false);
              setTool(id);
            }}
            className="group flex min-w-0 flex-col items-start rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold text-gray-900">
              {title}
              <span className="text-gray-300 transition-colors group-hover:text-gray-500" aria-hidden>
                ›
              </span>
            </span>
            <span className="mt-1 w-full truncate text-xs text-gray-500">{sub}</span>
          </button>
        ))}
      </section>

      <PlatformPgMerchantStatusSection />

      {tool === 'keys' ? (
        <ToolModal title="업체 결제 키" onClose={() => setTool(null)} wide>
          <PlatformCardPaymentKeySection />
        </ToolModal>
      ) : null}

      {tool === 'fees' ? (
        <ToolModal title="수수료" onClose={() => setTool(null)}>
          <p className="text-sm text-gray-600">서비스브릿지와 가맹점 사이 마진은 기간·가맹점별로 수수료 현황에서 봐요.</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ['완료 건수', `${summary.approvedCount}건`],
                ['결제 합계', formatWon(summary.amountWon)],
                ['서비스브릿지', formatWon(summary.platformCostWon)],
                ['마진', formatWon(summary.platformSpreadWon)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 px-3 py-2.5">
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex justify-end">
            <Link to="/platform/card-payment/fees" className={`${BTN_SECONDARY} inline-flex`}>
              수수료 현황 보기
            </Link>
          </div>
        </ToolModal>
      ) : null}

      {tool === 'partner' ? (
        <ToolModal title="원성 로그인 주소" onClose={() => setTool(null)}>
          <p className="text-sm text-gray-600">원성 본사에서 PG 신청과 취소·환불을 보는 주소예요.</p>
          <p className="mt-3 break-all rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-800">{partnerUrl}</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => {
                void navigator.clipboard
                  .writeText(partnerUrl)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? '복사됨' : '주소 복사'}
            </button>
          </div>
        </ToolModal>
      ) : null}

      {tool === 'usage' ? (
        <ToolModal title="이용료 결제 테스트" onClose={() => setTool(null)}>
          <p className="text-sm text-gray-600">
            솔루션 이용료 결제 키가 연결됐는지 확인하는 테스트예요. 팀장 청소비 결제에는 쓰이지 않아요.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-gray-800">
            <li>
              수기(구인증){' '}
              {serviceBridge?.keyin.configured
                ? `연결됨 · MID ${serviceBridge.keyin.mid} · OID ${serviceBridge.keyin.oid}`
                : '아직 서버에 키가 없어요.'}
            </li>
            <li>
              앱카드(인증){' '}
              {serviceBridge?.appCard.configured
                ? `연결됨 · MID ${serviceBridge.appCard.mid} · OID ${serviceBridge.appCard.oid}`
                : '아직 서버에 키가 없어요.'}
            </li>
          </ul>
          <PlatformUsageFeeCheck />
        </ToolModal>
      ) : null}
    </div>
  );
}

/** 화면 가운데 뜨는 도구 창 */
function ToolModal({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
