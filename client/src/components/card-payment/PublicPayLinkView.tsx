import { PgCardReceiptLink } from './PgCardReceiptLink';
import { Button } from '../ui/Button';
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
  pgReceiptUrl?: string | null;
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

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

const CARD = 'rounded-[18px] border border-[#E2E8F0] bg-white p-5 shadow-sm';
const MUTED = 'text-[#64748B]';
const INK = 'text-[#0F172A]';

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

  return (
    <div className="min-h-dvh bg-[#F4F6FA] text-[#0F172A]">
      <main className="mx-auto grid max-w-[390px] gap-3 px-4 pb-36 pt-3">
        <div className="flex items-center gap-3 px-0.5 py-1">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-fluid-lg font-bold text-[#1D4ED8]">
            {mark}
          </div>
          <div className="min-w-0">
            <b className={`block truncate text-fluid-sm ${INK}`}>{view.sellerName}</b>
            <span className={`text-fluid-2xs ${MUTED}`}>청소 서비스 결제</span>
          </div>
          {view.bizNo ? (
            <span className="ml-auto whitespace-nowrap rounded-full bg-[#EFF6FF] px-2.5 py-1 text-fluid-2xs font-medium text-[#1D4ED8]">
              사업자 확인
            </span>
          ) : null}
        </div>

        {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}

        {view.state === 'wait' ? (
          <>
            <section className={CARD}>
              <div className={`text-fluid-2xs ${MUTED}`}>결제할 금액</div>
              <div
                className="mt-1 tabular-nums tracking-tight text-[#0F172A]"
                style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.2 }}
              >
                {won(view.amountKrw)}
              </div>
              <div className={`mt-1 text-fluid-2xs tabular-nums ${MUTED}`}>
                공급가 {won(view.supplyKrw)} · 부가세 {won(view.vatKrw)}
              </div>
            </section>
            <section className={CARD}>
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-fluid-xs">
                <dt className={MUTED}>결제 내용</dt>
                <dd className="text-right">{view.goodsName}</dd>
                {view.serviceDateLabel ? (
                  <>
                    <dt className={MUTED}>서비스 날짜</dt>
                    <dd className="text-right tabular-nums">{view.serviceDateLabel}</dd>
                  </>
                ) : null}
                {view.customerMasked ? (
                  <>
                    <dt className={MUTED}>고객</dt>
                    <dd className="text-right">{view.customerMasked} 님</dd>
                  </>
                ) : null}
                {view.orderNo ? (
                  <>
                    <dt className={MUTED}>결제번호</dt>
                    <dd className="text-right tabular-nums">{view.orderNo}</dd>
                  </>
                ) : null}
              </dl>
            </section>
            <section className={`grid gap-2.5 ${CARD} text-fluid-2xs ${MUTED}`} aria-label="안전 안내">
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="security" className="mt-0.5 size-[18px] text-[#0F172A]" />
                <span>
                  <b className={`font-medium ${INK}`}>카드 정보는 이 화면에서 받지 않아요.</b> 다음 단계의
                  카드사 인증 결제창에서 직접 입력해요.
                </span>
              </div>
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="clipboard" className="mt-0.5 size-[18px]" />
                <span>
                  카드 명세서에는 <b className={`font-medium ${INK}`}>{view.statementName}</b>
                  {euro(view.statementName)} 표시돼요.
                </span>
              </div>
              <div className="grid grid-cols-[20px_1fr] gap-2">
                <LineMdIcon name="phone" className="mt-0.5 size-[18px]" />
                <span>
                  결제 내용이 다르면 결제하지 말고{' '}
                  {view.supportPhone ? (
                    <a
                      href={telHref(view.supportPhone)}
                      className="font-medium text-[#1D4ED8] underline-offset-2 hover:underline"
                    >
                      {view.supportPhone}
                    </a>
                  ) : (
                    <b className={`font-medium ${INK}`}>담당 업체</b>
                  )}
                  로 먼저 확인해 주세요.
                </span>
              </div>
            </section>
          </>
        ) : null}

        {view.state === 'done' ? (
          <>
            <section className={`grid justify-items-center gap-2 ${CARD} px-5 py-7 text-center`}>
              <div className="grid size-14 place-items-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                <LineMdIcon name="confirm" className="size-7" />
              </div>
              <h2 className="text-fluid-lg font-bold">결제가 완료됐어요</h2>
              <p
                className="tabular-nums text-[#0F172A]"
                style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}
              >
                {won(view.amountKrw)}
              </p>
              {view.paidAtLabel ? <p className={`text-fluid-2xs ${MUTED}`}>{view.paidAtLabel}</p> : null}
            </section>
            <section className={CARD}>
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2.5 text-fluid-xs">
                <dt className={MUTED}>가맹점</dt>
                <dd className="text-right">{view.sellerName}</dd>
                <dt className={MUTED}>결제 내용</dt>
                <dd className="text-right">{view.goodsName}</dd>
                {view.cardLabel ? (
                  <>
                    <dt className={MUTED}>카드</dt>
                    <dd className="text-right tabular-nums">{view.cardLabel}</dd>
                  </>
                ) : null}
                {view.approvalNo ? (
                  <>
                    <dt className={MUTED}>승인번호</dt>
                    <dd className="text-right tabular-nums">{view.approvalNo}</dd>
                  </>
                ) : null}
                {view.orderNo ? (
                  <>
                    <dt className={MUTED}>결제번호</dt>
                    <dd className="text-right tabular-nums">{view.orderNo}</dd>
                  </>
                ) : null}
              </dl>
              <PgCardReceiptLink url={view.pgReceiptUrl} size="lg" className="mt-4 w-full" />
              <div className="my-4 h-px bg-[#E2E8F0]" />
              <p className={`text-fluid-2xs ${MUTED}`}>
                카드사 영수증은 카드사 문자·앱에서 확인할 수 있어요. 이 화면을 닫아도 결제는 그대로예요.
              </p>
            </section>
          </>
        ) : null}

        {view.state === 'expired' ? (
          <section className={`grid justify-items-center gap-2 ${CARD} px-5 py-7 text-center`}>
            <div className="grid size-14 place-items-center rounded-full bg-[#F1F5F9] text-[#64748B]">
              <LineMdIcon name="watch-off" className="size-7" />
            </div>
            <h2 className="text-fluid-lg font-bold">{view.offTitle || '이 링크는 더 이상 결제할 수 없어요'}</h2>
            <p className={`text-fluid-xs ${MUTED}`}>
              결제가 필요하면 <b className={`font-medium ${INK}`}>{view.sellerName}</b>에 새 링크를 요청해
              주세요.
            </p>
          </section>
        ) : null}

        {view.state === 'cancelled' ? (
          <section className={`grid justify-items-center gap-2 ${CARD} px-5 py-7 text-center`}>
            <div className="grid size-14 place-items-center rounded-full bg-[#F1F5F9] text-[#64748B]">
              <LineMdIcon name="close" className="size-7" />
            </div>
            <h2 className="text-fluid-lg font-bold">취소된 결제예요</h2>
            <p className={`text-fluid-xs tabular-nums ${MUTED}`}>
              {view.cancelledAtLabel
                ? `${view.cancelledAtLabel}에 ${won(view.amountKrw)} 결제가 취소됐어요. 카드사 반영까지 3~5영업일 걸릴 수 있어요.`
                : `${won(view.amountKrw)} 결제가 취소됐어요. 카드사 반영까지 3~5영업일 걸릴 수 있어요.`}
            </p>
          </section>
        ) : null}

        <footer className={`grid gap-1 px-1 py-2 text-fluid-2xs ${MUTED}`} aria-label="사업자 정보">
          <b className={`font-medium ${INK}`}>{view.footerName}</b>
          {identity ? <span className="tabular-nums">{identity}</span> : null}
          {view.address ? <span>{view.address}</span> : null}
          {view.supportPhone ? (
            <a href={telHref(view.supportPhone)} className="tabular-nums text-[#1D4ED8] underline-offset-2 hover:underline">
              고객센터 {view.supportPhone}
            </a>
          ) : null}
        </footer>
      </main>

      {view.state === 'wait' && onPay ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#E2E8F0] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
          <div className="mx-auto grid max-w-[390px] gap-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={opening}
              onClick={onPay}
              className="h-[54px] w-full rounded-[14px] text-fluid-sm"
            >
              {opening ? '결제창 여는 중' : '지금 결제해 주세요'}
            </Button>
            <small className={`text-center text-fluid-2xs ${MUTED}`}>
              {won(view.amountKrw)} · 카드사 인증 결제창으로 연결
            </small>
          </div>
        </div>
      ) : null}
    </div>
  );
}
