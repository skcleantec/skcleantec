import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';
import { PageTitleWithFavorite } from '../layout/NavFavoritePageTitle';
import { HelpTooltip } from '../ui/HelpTooltip';
import { LineMdIcon } from '../ui/LineMdIcon';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

const GHOST =
  'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const PRIMARY =
  'min-h-11 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export type ReceiptConnectionStatus = {
  ok: boolean;
  label: string;
};

export function ReceiptListHeader({
  title,
  path,
  issueLabel,
  onIssue,
  issueDisabled,
  hideIssue,
  statusChip,
  unitPriceKrw,
  onOpenSettings,
  compactPc,
  tab,
  onTabChange,
  connectionStatus,
}: {
  title: string;
  path: string;
  issueLabel: string;
  onIssue: () => void;
  issueDisabled?: boolean;
  hideIssue?: boolean;
  statusChip?: ReactNode;
  /** 현금영수증 22 · 세금계산서 150 */
  unitPriceKrw: number;
  /** 발행 기본설정 모달 */
  onOpenSettings?: () => void;
  /** lg+ 한 줄 헤더(현금영수증 PC) */
  compactPc?: boolean;
  tab?: 'issue' | 'history';
  onTabChange?: (tab: 'issue' | 'history') => void;
  connectionStatus?: ReceiptConnectionStatus | null;
}) {
  const permissions = useMarketerPermissions();
  const canCharge = permissions.me?.role === 'ADMIN';
  const { summary, openCharge, openHistory } = useReceiptWallet();
  const balanceKrw = summary?.balanceKrw;
  const walletShort = balanceKrw != null && balanceKrw < unitPriceKrw;
  const blocked = Boolean(issueDisabled) || walletShort;

  return (
    <div className="flex flex-col gap-2">
      {/* 모바일·기본 */}
      <div className={compactPc ? 'flex flex-col gap-2 lg:hidden' : 'flex flex-col gap-2'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PageTitleWithFavorite label={title} path={path}>
            <h1 className="text-fluid-lg font-semibold text-slate-900">{title}</h1>
          </PageTitleWithFavorite>
          <div className="flex flex-wrap items-center gap-2">
            {canCharge ? (
              <Link
                to="/admin/team-leaders/wallet"
                className="text-fluid-sm font-semibold tabular-nums text-slate-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                title="청소비서 지갑"
              >
                지갑 {summary ? won(summary.balanceKrw) : '…'}
              </Link>
            ) : (
              <span className="text-fluid-sm font-semibold tabular-nums text-slate-900" title="청소비서 지갑">
                지갑 {summary ? won(summary.balanceKrw) : '…'}
              </span>
            )}
            <span className="text-fluid-xs tabular-nums text-slate-600">건당 {won(unitPriceKrw)}</span>
            <button type="button" className={GHOST} onClick={openHistory}>
              내역
            </button>
            {canCharge ? (
              walletShort ? (
                <button type="button" className={PRIMARY} onClick={() => openCharge()}>
                  충전하기
                </button>
              ) : (
                <button type="button" className={GHOST} onClick={() => openCharge()}>
                  충전
                </button>
              )
            ) : null}
            {onOpenSettings ? (
              <button type="button" className={GHOST} onClick={onOpenSettings}>
                설정
              </button>
            ) : null}
            {statusChip}
            {hideIssue ? null : (
              <button type="button" className={PRIMARY} disabled={blocked} onClick={onIssue}>
                {issueLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PC 한 줄 — 탭 있음 */}
      {compactPc && tab && onTabChange ? (
        <div className="hidden items-center justify-between gap-3 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <PageTitleWithFavorite label={title} path={path}>
              <h1 className="text-[22px] font-semibold text-slate-900">{title}</h1>
            </PageTitleWithFavorite>
            <SegmentedControl
              ariaLabel="발행 탭"
              value={tab}
              onChange={onTabChange}
              options={[
                { value: 'issue', label: '발행하기' },
                { value: 'history', label: '발행 내역' },
              ]}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
            {connectionStatus ? (
              <span className={`inline-flex items-center gap-1.5 ${connectionStatus.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                <span
                  className={`size-1.5 shrink-0 rounded-full ${connectionStatus.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  aria-hidden
                />
                {connectionStatus.label}
              </span>
            ) : null}
            <span className="text-slate-300" aria-hidden>|</span>
            <span className="tabular-nums text-slate-700">
              지갑 {summary ? won(summary.balanceKrw) : '…'} · 건당 {won(unitPriceKrw)}
            </span>
            {canCharge ? (
              <button
                type="button"
                className="inline-flex h-[30px] items-center rounded-[8px] bg-[#1e3a5f] px-2.5 text-[12px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={() => openCharge()}
              >
                충전
              </button>
            ) : null}
            <button
              type="button"
              className="h-[30px] px-1 text-[12px] font-medium text-[#64748B] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={openHistory}
            >
              내역
            </button>
            {onOpenSettings ? (
              <button
                type="button"
                className="inline-flex size-[30px] items-center justify-center rounded-[8px] text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                aria-label="설정"
                onClick={onOpenSettings}
              >
                <LineMdIcon name="cog" className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* PC 한 줄 — 탭 없음 (목록 전용) */}
      {compactPc && !tab ? (
        <div className="hidden items-center justify-between gap-3 lg:flex">
          <PageTitleWithFavorite label={title} path={path}>
            <h1 className="text-[22px] font-bold text-slate-900">{title}</h1>
          </PageTitleWithFavorite>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
            {connectionStatus ? (
              <span className={`inline-flex items-center gap-1.5 ${connectionStatus.ok ? 'text-emerald-700' : 'text-amber-700'}`}>
                <span
                  className={`size-1.5 shrink-0 rounded-full ${connectionStatus.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  aria-hidden
                />
                {connectionStatus.label}
              </span>
            ) : null}
            <span className="text-slate-300" aria-hidden>|</span>
            <span className="tabular-nums text-slate-700">
              지갑 {summary ? won(summary.balanceKrw) : '…'} · 건당 {won(unitPriceKrw)}
            </span>
            {canCharge ? (
              <button
                type="button"
                className="inline-flex h-[30px] items-center px-1 text-[12px] font-medium text-[#64748B] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={() => openCharge()}
              >
                충전
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex h-[30px] items-center px-1 text-[12px] font-medium text-[#64748B] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={openHistory}
            >
              내역
            </button>
            {onOpenSettings ? (
              <button
                type="button"
                className="inline-flex size-[30px] items-center justify-center rounded-[8px] text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                aria-label="설정"
                onClick={onOpenSettings}
              >
                <LineMdIcon name="cog" className="size-4" />
              </button>
            ) : null}
            {hideIssue ? null : (
              <button
                type="button"
                disabled={blocked}
                onClick={onIssue}
                className="inline-flex h-[36px] items-center rounded-[10px] bg-[#1e3a5f] px-3 text-[13px] font-semibold text-white hover:bg-[#152a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-50"
              >
                {issueLabel}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {walletShort ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
          {canCharge
            ? `청소비서 지갑 잔액이 건당 요금(${won(unitPriceKrw)})보다 적어 발행할 수 없습니다. 충전 후 다시 시도해 주세요.`
            : `청소비서 지갑 잔액이 건당 요금(${won(unitPriceKrw)})보다 적어 발행할 수 없습니다. 관리자에게 충전을 요청해 주세요.`}
        </p>
      ) : null}
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
  issueFailCount,
  onIssueFailed,
  compact,
}: {
  issuedCount: number;
  issuedWon: number;
  waitingCount: number;
  failedCount: number;
  costWon: number;
  onFailed: () => void;
  issueFailCount?: number;
  onIssueFailed?: () => void;
  /** PC 미리보기 아래 작은 3칸 */
  compact?: boolean;
}) {
  if (compact) {
    const cell = 'min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-white px-2.5 py-2';
    return (
      <div className="flex gap-2">
        <section className={cell}>
          <p className="text-[11px] text-slate-500">이번 달 발행</p>
          <p className="text-[14px] font-bold tabular-nums text-slate-900">{issuedCount}건</p>
          <p className="text-[11px] tabular-nums text-slate-500">{won(issuedWon)}</p>
        </section>
        <section className={cell}>
          <p className="text-[11px] text-slate-500">국세청 전송</p>
          <p className="text-[14px] font-bold tabular-nums text-slate-900">대기 {waitingCount}</p>
          <p className="text-[11px] text-slate-500">
            {failedCount > 0 ? (
              <button type="button" className="font-semibold text-red-700 underline" onClick={onFailed}>
                실패 {failedCount}
              </button>
            ) : (
              '실패 0'
            )}
          </p>
        </section>
        <section className={cell}>
          <p className="text-[11px] text-slate-500">이번 달 비용</p>
          <p className="text-[14px] font-bold tabular-nums text-slate-900">{won(costWon)}</p>
        </section>
      </div>
    );
  }

  const card = 'min-w-0 flex-1 rounded-[14px] border border-slate-200 bg-white px-4 py-3';
  return (
    <div className="flex flex-wrap gap-2">
      <section className={card}>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] text-slate-500">이번 달 발행</span>
          <span className="text-[16px] font-bold tabular-nums text-slate-900">{issuedCount}건</span>
          <span className="text-[12px] tabular-nums text-slate-500">{won(issuedWon)}</span>
        </p>
      </section>
      <section className={card}>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 text-[12px] text-slate-500">
            국세청 전송
            <HelpTooltip text="발급완료 후 국세청 전송을 기다리는 건" />
          </span>
          <span className="text-[16px] font-bold tabular-nums text-slate-900">대기 {waitingCount}</span>
          <span className="text-[12px] text-slate-500">
            {failedCount > 0 ? (
              <button type="button" className="font-semibold text-red-700 underline hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2" onClick={onFailed}>
                실패 {failedCount}
              </button>
            ) : (
              '실패 0'
            )}
          </span>
        </p>
        {onIssueFailed ? (
          <button type="button" className="mt-1 text-[12px] font-semibold text-red-700 underline hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2" onClick={onIssueFailed}>
            발행 실패 {issueFailCount ?? 0}
          </button>
        ) : null}
      </section>
      <section className={card}>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] text-slate-500">이번 달 비용</span>
          <span className="text-[16px] font-bold tabular-nums text-slate-900">{won(costWon)}</span>
        </p>
      </section>
    </div>
  );
}
