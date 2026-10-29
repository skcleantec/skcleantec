import type { ReactNode } from 'react';
import { PageTitleWithFavorite } from '../layout/NavFavoritePageTitle';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const PRIMARY =
  'min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function ReceiptListHeader({
  title,
  path,
  issueLabel,
  onIssue,
  issueDisabled,
  statusChip,
}: {
  title: string;
  path: string;
  issueLabel: string;
  onIssue: () => void;
  issueDisabled?: boolean;
  statusChip?: ReactNode;
}) {
  const { summary, openCharge, openHistory } = useReceiptWallet();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <PageTitleWithFavorite label={title} path={path}>
        <h1 className="text-fluid-lg font-semibold text-slate-900">{title}</h1>
      </PageTitleWithFavorite>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fluid-sm font-semibold tabular-nums text-slate-900">지갑 {summary ? won(summary.balanceKrw) : '…'}</span>
        <button type="button" className={GHOST} onClick={openHistory}>내역</button>
        <button type="button" className={GHOST} onClick={openCharge}>충전</button>
        {statusChip}
        <button type="button" className={PRIMARY} disabled={issueDisabled} onClick={onIssue}>{issueLabel}</button>
      </div>
    </div>
  );
}

export function ReceiptSummaryCards({
  issuedCount,
  issuedWon,
  waitingCount,
  failedCount,
  costWon,
  onFailed,
}: {
  issuedCount: number;
  issuedWon: number;
  waitingCount: number;
  failedCount: number;
  costWon: number;
  onFailed: () => void;
}) {
  const card = 'min-w-[9rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2';
  return (
    <div className="flex flex-wrap gap-2">
      <section className={card}>
        <p className="text-fluid-2xs text-slate-500">이번 달 발행</p>
        <p className="text-fluid-sm font-semibold tabular-nums text-slate-900">{issuedCount}건 · {won(issuedWon)}</p>
      </section>
      <section className={card}>
        <p className="text-fluid-2xs text-slate-500">국세청 전송</p>
        <p className="text-fluid-sm text-slate-800">
          대기 {waitingCount}
          {' · '}
          <button type="button" className="font-semibold text-red-700 underline hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2" onClick={onFailed}>
            실패 {failedCount}
          </button>
        </p>
      </section>
      <section className={card}>
        <p className="text-fluid-2xs text-slate-500">이번 달 비용</p>
        <p className="text-fluid-lg font-semibold tabular-nums text-slate-900">{won(costWon)}</p>
      </section>
    </div>
  );
}
