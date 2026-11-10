import { Link } from 'react-router-dom';
import {
  ALIMTALK_UNIT_PRICE_ATA_KRW,
  ALIMTALK_UNIT_PRICE_LMS_KRW,
} from '@shared/alimtalkPolicy';
import { CASHBILL_UNIT_PRICE_KRW, TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { ReceiptWalletCard } from '../../components/wallet/ReceiptWalletCard';
import { ReceiptWalletHistoryPanel } from '../../components/wallet/ReceiptWalletHistoryPanel';
import { ReceiptWalletProvider, useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';

const PATH = '/admin/team-leaders/wallet';

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function AdminWalletPageBody() {
  const { openCharge, reload } = useReceiptWallet();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PageTitleWithFavorite label="청소비서 지갑" path={PATH}>
          <h1 className="text-fluid-lg font-semibold text-slate-900">청소비서 지갑</h1>
        </PageTitleWithFavorite>
        <button type="button" className={BTN} onClick={() => openCharge()}>
          충전하기
        </button>
      </div>
      <p className="text-fluid-xs text-slate-600">
        현금영수증·세금계산서·알림톡이 같은 잔액을 씁니다. 카드 충전은 바로 반영되고, 무통장 입금은 확인 후 반영됩니다.
      </p>

      <ReceiptWalletCard historyHref="#wallet-history" />

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">건당 요금</h2>
        <p className="mt-1 text-fluid-2xs text-slate-500">부가세 별도 · 지갑에서 차감</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-fluid-xs sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">현금영수증</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{won(CASHBILL_UNIT_PRICE_KRW)}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">세금계산서</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{won(TAXINVOICE_UNIT_PRICE_KRW)}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">알림톡</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {won(ALIMTALK_UNIT_PRICE_ATA_KRW)}
              <span className="ml-1 font-normal text-slate-500">· LMS {won(ALIMTALK_UNIT_PRICE_LMS_KRW)}</span>
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-fluid-2xs text-slate-500">
          알림톡 설정은{' '}
          <Link to="/admin/team-leaders/alimtalk" className="font-medium text-sky-700 hover:underline">
            알림톡
          </Link>
          에서, 영수증 발행은 서비스접수 → 영수증 메뉴에서 합니다.
        </p>
      </section>

      <section id="wallet-history" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">충전·사용 내역</h2>
          <button
            type="button"
            className="text-fluid-2xs text-slate-600 underline hover:text-slate-900"
            onClick={() => void reload()}
          >
            새로고침
          </button>
        </div>
        <ReceiptWalletHistoryPanel />
      </section>
    </div>
  );
}

export function AdminWalletPage() {
  return (
    <ReceiptWalletProvider>
      <AdminWalletPageBody />
    </ReceiptWalletProvider>
  );
}
