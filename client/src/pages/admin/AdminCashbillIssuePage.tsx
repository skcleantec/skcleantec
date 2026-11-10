import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ReceiptWalletProvider, useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
import { ReceiptSetupGate } from '../../components/receipts/ReceiptSetupGate';
import { CashbillIssueForm, type CashbillIssueSeed } from '../../components/cashbill/CashbillIssueForm';
import { fetchCashbillSource, listCashbillIssues, openCashbillReceipt, type CashbillBrand } from '../../api/cashbillIssues';
import { CASHBILL_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { showReceiptDone, showReceiptFailure } from '../../components/receipts/receiptToasts';
import { ReceiptCopyButtons } from '../../components/receipts/ReceiptCopyButtons';
import { ToastButton } from '../../components/ui/Toast';
import { LineMdIcon } from '../../components/ui/LineMdIcon';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function AdminCashbillIssueInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { summary } = useReceiptWallet();
  const permissions = useMarketerPermissions();
  const isTenantAdmin = permissions.me?.role === 'ADMIN';

  const seedInquiryId = searchParams.get('inquiryId') || '';
  const fromId = searchParams.get('from') || '';

  const [brands, setBrands] = useState<CashbillBrand[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [seed, setSeed] = useState<CashbillIssueSeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  // 브랜드 로드 (1건 쿼리로 brands 받기)
  useEffect(() => {
    let stop = false;
    const qs = new URLSearchParams({ limit: '1' });
    listCashbillIssues(qs)
      .then((res) => {
        if (!stop) { setBrands(res.brands); setBrandsLoaded(true); }
      })
      .catch(() => { if (!stop) setBrandsLoaded(true); });
    return () => { stop = true; };
  }, []);

  // ?from= 시드 로드
  useEffect(() => {
    if (!fromId) return;
    let stop = false;
    fetchCashbillSource(fromId)
      .then((src) => {
        if (stop) return;
        setSeed({
          brandId: src.operatingCompanyId,
          amount: String(src.amount),
          usage: src.usage,
          itemName: src.itemName,
          memo: src.memo,
          askIdentity: true,
          customerName: src.customerName ?? '',
          taxKind: src.taxKind ?? 'taxable',
        });
      })
      .catch((err: unknown) => {
        if (!stop) setError(err instanceof Error ? err.message : '다시 발행할 내용을 불러오지 못했습니다.');
      });
    return () => { stop = true; };
  }, [fromId]);

  function goBack() {
    if (dirtyRef.current) {
      if (!window.confirm('작성 중인 내용이 있어요. 나갈까요?')) return;
    }
    navigate('/admin/inquiries/receipts/cashbill');
  }

  const needsLink = brandsLoaded && brands.every((brand) => !brand.linked);

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="목록으로"
          onClick={goBack}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <LineMdIcon name="arrow-left" className="size-4" />
        </button>
        <h1 className="text-[22px] font-bold text-slate-900">현금영수증 발행</h1>
        <div className="ml-auto shrink-0 text-[12px] text-[#64748B]">
          지갑 {summary ? won(summary.balanceKrw) : '…'} · 건당 {won(CASHBILL_UNIT_PRICE_KRW)}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</p>
      ) : null}

      {needsLink ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-fluid-sm text-amber-950">
          <p>{isTenantAdmin ? '계산서 연결을 먼저 해주세요.' : '관리자가 바로빌 가입을 마쳐야 발행할 수 있어요.'}</p>
          {isTenantAdmin ? (
            <Link
              to="/admin/team-leaders/cashbill"
              className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              계산서 연결로 가기
            </Link>
          ) : null}
        </div>
      ) : brandsLoaded ? (
        <CashbillIssueForm
          key={`${fromId || 'new'}-${seedInquiryId}`}
          brands={brands}
          seed={seed}
          seedInquiryId={seedInquiryId}
          pageLayout
          onDirtyChange={(dirty) => { dirtyRef.current = dirty; }}
          onClose={goBack}
          onDone={(issueId) => {
            showReceiptDone(
              '현금영수증을 발행했어요',
              '목록 맨 위에 표시해 두었어요.',
              <>
                <ReceiptCopyButtons kind="cashbill" issueId={issueId} official publicToken={null} copyReady={false} shareOnly inToast />
                <ToastButton
                  variant="primary"
                  onClick={() =>
                    void openCashbillReceipt(issueId).catch((err: unknown) =>
                      showReceiptFailure('영수증을 열지 못했어요', err instanceof Error ? err.message : null)
                    )
                  }
                >
                  영수증 보기
                </ToastButton>
              </>,
            );
            navigate('/admin/inquiries/receipts/cashbill', { state: { highlightId: issueId } });
          }}
        />
      ) : null}
    </div>
  );
}

export function AdminCashbillIssuePage() {
  return (
    <ReceiptWalletProvider>
      <ReceiptSetupGate kind="cashbill">
        <div className="w-full lg:w-[1040px] lg:max-w-[1040px]">
          <AdminCashbillIssueInner />
        </div>
      </ReceiptSetupGate>
    </ReceiptWalletProvider>
  );
}
