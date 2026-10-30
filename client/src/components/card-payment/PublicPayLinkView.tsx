import { LineMdIcon } from '../ui/LineMdIcon';

export type PublicPayLinkViewData = {
  state: 'wait' | 'done' | 'expired' | 'cancelled';
  sellerName: string;
  footerName: string;
  representativeName: string | null;
  bizNo: string | null;
  address: string | null;
  supportPhone: string | null;
  statementName: string;
  amountKrw: number;
  supplyKrw: number;
  vatKrw: number;
  goodsName: string;
  serviceDateLabel: string | null;
  customerMasked: string | null;
  orderNo: string | null;
  deadlineLabel: string | null;
  paidAtLabel: string | null;
  cardLabel: string | null;
  approvalNo: string | null;
  cancelledAtLabel: string | null;
  offTitle: string | null;
};

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 받침 없으면 「로」, 있으면 「으로」. ㄹ 받침도 「로」. */
function euro(name: string): '로' | '으로' {
  const last = [...name.trim()].at(-1);
  if (!last) return '으로';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '으로';
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

export function PublicPayLinkView({
  view,
  opening,
  error,
  onPay,
}: {
  view: PublicPayLinkViewData;
  opening?: boolean;
  error?: string | null;
  onPay?: () => void;
}) {
  const mark = [...view.sellerName][0] ?? '청';
  const identity = [
    view.representativeName ? `대표 ${view.representativeName}` : '',
    view.bizNo ? `사업자등록번호 ${view.bizNo}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const ask = view.supportPhone
    ? `결제 내용이 다르면 결제하지 말고 ${view.supportPhone}으로 먼저 확인해 주세요.`
    : '결제 내용이 다르면 결제하지 말고 청소비서로 먼저 확인해 주세요.';

  return (
    <div className="min-h-dvh bg-[#f3f5f8] text-[#111827] dark:bg-[#0d1117] dark:text-[#eef1f6]">
      <main className="mx-auto grid max-w-[480px] gap-3 px-4 pb-32 pt-3">
        <div className="flex items-center gap-3 px-0.5 py-1">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#c9d7fb] bg-[#eef3ff] text-lg font-bold text-[#1b4dd8] dark:border-[#2f4472] dark:bg-[#17223a] dark:text-[#8fb0ff]">
            {mark}
          </div>
          <div className="min-w-0">
            <b className="block text-base">{view.sellerName}</b>
            <span className="text-[13px] text-[#6b7280] dark:text-[#9aa4b5]">청소 서비스 결제</span>
          </div>
          {view.bizNo ? (
            <span className="ml-auto whitespace-nowrap rounded-full bg-[#e7f6ee] px-2 py-0.5 text-xs text-[#0f7a4a] dark:bg-[#12271c] dark:text-[#7ad7a6]">
              사업자 확인됨
            </span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-[#b42318] dark:text-[#f19a90]">{error}</p> : null}

        {view.state === 'wait' ? (
          <>
            <section className="rounded-2xl border border-[#e3e7ee] bg-white p-5 dark:border-[#2a3240] dark:bg-[#161b24]">
              <div className="text-[13px] text-[#6b7280] dark:text-[#9aa4b5]">결제할 금액</div>
              <div className="mt-0.5 text-[34px] font-bold tabular-nums tracking-tight">{won(view.amountKrw)}</div>
              <div className="mt-0.5 text-[13px] tabular-nums text-[#6b7280] dark:text-[#9aa4b5]">
                공급가 {won(view.supplyKrw)} · 부가세 {won(view.vatKrw)}
              </div>
            </section>
            <section className="rounded-2xl border border-[#e3e7ee] bg-white p-5 dark:border-[#2a3240] dark:bg-[#161b24]">
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-[#6b7280] dark:text-[#9aa4b5]">결제 내용</dt>
                <dd className="text-right">{view.goodsName}</dd>
                {view.serviceDateLabel ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">서비스 날짜</dt>
                    <dd className="text-right tabular-nums">{view.serviceDateLabel}</dd>
                  </>
                ) : null}
                {view.customerMasked ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">고객</dt>
                    <dd className="text-right">{view.customerMasked} 님</dd>
                  </>
                ) : null}
                {view.orderNo ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">주문번호</dt>
                    <dd className="text-right tabular-nums">{view.orderNo}</dd>
                  </>
                ) : null}
                {view.deadlineLabel ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">결제 기한</dt>
                    <dd className="text-right tabular-nums">{view.deadlineLabel}</dd>
                  </>
                ) : null}
              </dl>
            </section>
            <section className="grid gap-2.5 rounded-2xl border border-[#e3e7ee] bg-white p-5 text-[13px] text-[#6b7280] dark:border-[#2a3240] dark:bg-[#161b24] dark:text-[#9aa4b5]" aria-label="안전 안내">
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="lock" className="mt-0.5 size-[18px]" />
                <span>
                  <b className="font-medium text-[#111827] dark:text-[#eef1f6]">카드 정보는 이 화면에서 받지 않아요.</b> 다음 단계의 카드사 인증 결제창(PG)에서 직접 입력해요.
                </span>
              </div>
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="clipboard" className="mt-0.5 size-[18px]" />
                <span>
                  카드 명세서에는 <b className="font-medium text-[#111827] dark:text-[#eef1f6]">{view.statementName}</b>{euro(view.statementName)} 표시돼요.
                </span>
              </div>
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="phone" className="mt-0.5 size-[18px]" />
                <span>{ask}</span>
              </div>
            </section>
          </>
        ) : null}

        {view.state === 'done' ? (
          <>
            <section className="grid justify-items-center gap-2 rounded-2xl border border-[#e3e7ee] bg-white px-5 py-7 text-center dark:border-[#2a3240] dark:bg-[#161b24]">
              <div className="grid size-14 place-items-center rounded-full bg-[#e7f6ee] text-[#0f7a4a] dark:bg-[#12271c] dark:text-[#7ad7a6]">
                <LineMdIcon name="confirm" className="size-7" />
              </div>
              <h2 className="text-xl font-bold">결제가 끝났어요</h2>
              <p className="text-sm tabular-nums text-[#6b7280] dark:text-[#9aa4b5]">
                {won(view.amountKrw)}
                {view.paidAtLabel ? ` · ${view.paidAtLabel}` : ''}
              </p>
            </section>
            <section className="rounded-2xl border border-[#e3e7ee] bg-white p-5 dark:border-[#2a3240] dark:bg-[#161b24]">
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-sm">
                <dt className="text-[#6b7280] dark:text-[#9aa4b5]">결제 내용</dt>
                <dd className="text-right">{view.goodsName}</dd>
                {view.cardLabel ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">카드</dt>
                    <dd className="text-right tabular-nums">{view.cardLabel}</dd>
                  </>
                ) : null}
                {view.approvalNo ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">승인번호</dt>
                    <dd className="text-right tabular-nums">{view.approvalNo}</dd>
                  </>
                ) : null}
                {view.orderNo ? (
                  <>
                    <dt className="text-[#6b7280] dark:text-[#9aa4b5]">주문번호</dt>
                    <dd className="text-right tabular-nums">{view.orderNo}</dd>
                  </>
                ) : null}
              </dl>
              <div className="my-4 h-px bg-[#e3e7ee] dark:bg-[#2a3240]" />
              <p className="text-[13px] text-[#6b7280] dark:text-[#9aa4b5]">카드사 영수증은 카드사 문자·앱에서 확인할 수 있어요. 이 화면을 닫아도 결제는 그대로예요.</p>
            </section>
          </>
        ) : null}

        {view.state === 'expired' ? (
          <section className="grid justify-items-center gap-2 rounded-2xl border border-[#e3e7ee] bg-white px-5 py-7 text-center dark:border-[#2a3240] dark:bg-[#161b24]">
            <div className="grid size-14 place-items-center rounded-full bg-[#f1f3f6] text-[#6b7280] dark:bg-[#1c2330] dark:text-[#9aa4b5]">
              <LineMdIcon name="watch-off" className="size-7" />
            </div>
            <h2 className="text-xl font-bold">{view.offTitle || '결제 기한이 지났어요'}</h2>
            <p className="text-sm text-[#6b7280] dark:text-[#9aa4b5]">
              결제가 필요하면 <b className="font-medium text-[#111827] dark:text-[#eef1f6]">{view.sellerName}</b>에 새 링크를 요청해 주세요.
            </p>
          </section>
        ) : null}

        {view.state === 'cancelled' ? (
          <section className="grid justify-items-center gap-2 rounded-2xl border border-[#e3e7ee] bg-white px-5 py-7 text-center dark:border-[#2a3240] dark:bg-[#161b24]">
            <div className="grid size-14 place-items-center rounded-full bg-[#f1f3f6] text-[#6b7280] dark:bg-[#1c2330] dark:text-[#9aa4b5]">
              <LineMdIcon name="close" className="size-7" />
            </div>
            <h2 className="text-xl font-bold">취소된 결제예요</h2>
            <p className="text-sm tabular-nums text-[#6b7280] dark:text-[#9aa4b5]">
              {view.cancelledAtLabel
                ? `${view.cancelledAtLabel}에 ${won(view.amountKrw)} 결제가 취소됐어요. 카드사 반영까지 3~5영업일 걸릴 수 있어요.`
                : `${won(view.amountKrw)} 결제가 취소됐어요. 카드사 반영까지 3~5영업일 걸릴 수 있어요.`}
            </p>
          </section>
        ) : null}

        <footer className="grid gap-1 px-1 py-2 text-xs text-[#6b7280] dark:text-[#9aa4b5]" aria-label="판매자 정보">
          <b className="font-medium text-[#111827] dark:text-[#eef1f6]">{view.footerName}</b>
          {identity ? <span className="tabular-nums">{identity}</span> : null}
          {view.address ? <span>{view.address}</span> : null}
          {view.supportPhone ? <span className="tabular-nums">고객센터 {view.supportPhone}</span> : null}
          <span className="mt-1.5">청소비서 안전결제 · 결제대행 페이시스</span>
        </footer>
      </main>

      {view.state === 'wait' && onPay ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#e3e7ee] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 dark:border-[#2a3240] dark:bg-[#161b24]">
          <div className="mx-auto grid max-w-[480px] gap-2">
            <button
              type="button"
              disabled={opening}
              onClick={onPay}
              className="h-[54px] w-full rounded-xl bg-[#1b4dd8] text-[17px] font-bold text-white hover:bg-[#173fb0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b4dd8] disabled:pointer-events-none disabled:opacity-50 dark:bg-[#8fb0ff] dark:text-[#0d1117]"
            >
              {opening ? '결제창 여는 중' : `${won(view.amountKrw)} 결제하기`}
            </button>
            <small className="text-center text-xs text-[#6b7280] dark:text-[#9aa4b5]">버튼을 누르면 카드사 인증 결제창이 열려요</small>
          </div>
        </div>
      ) : null}
    </div>
  );
}
