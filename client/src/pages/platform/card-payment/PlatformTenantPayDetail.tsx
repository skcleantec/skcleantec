import { useState } from 'react';
import type { TenantPayDetail } from '../../../api/platformTenantPayHistory';
import {
  cancelTenantPay,
  markTenantPayCancelled,
  openTenantSellerCenter,
  rejectTenantPayCancel,
} from '../../../api/platformTenantPayHistory';
import { Button } from '../../../components/ui/Button';
import { InlineConfirm } from '../../../components/ui/InlineConfirm';
import { openSellerCenterLoggedIn } from '../../../utils/openSellerCenterLogin';
import { PayDetailHeader, PayDetailHistory, PayDetailSection } from './PayDetailSections';
import { installmentLabel, kstStamp, statusLabel, won } from './tenantPayFormat';

function filled(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text && text !== '기록 없음' ? text : null;
}

export function PlatformTenantPayDetail({
  row,
  onChanged,
}: {
  row: TenantPayDetail;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState('');
  const [notifyTenant, setNotifyTenant] = useState(true);
  const [approvalNo, setApprovalNo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chip = statusLabel(row);
  const methodLine = row.method === 'CUSTOMER_LINK'
    ? `링크(인증)${row.paidSource ? ` · ${row.paidSource} 결제창` : ''}`
    : '수기';

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      setConfirming(false);
      setReason('');
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const card = [row.cardIssuer, row.cardLast4 ? `··${row.cardLast4}` : '', row.cardKind ? `(${row.cardKind})` : '']
    .filter(Boolean)
    .join(' ');
  const subtitle = [row.customerName, row.inquiryNumber, row.installmentMonths == null ? null : installmentLabel(row.installmentMonths)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4 text-[#141b26]">
      <PayDetailHeader chipText={chip.text} chipClassName={chip.className} amount={won(row.amountWon)} subtitle={subtitle} />

      <PayDetailSection
        title="결제"
        rows={[
          { label: '카드', value: filled(card) },
          { label: '할부', value: row.installmentMonths == null ? null : installmentLabel(row.installmentMonths) },
          { label: '승인번호', value: filled(row.approvalNo) },
          { label: '승인 시각', value: row.paidAt ? kstStamp(row.paidAt) : null },
          { label: '방식', value: methodLine },
          { label: '주문번호', value: filled(row.inquiryNumber) },
          { label: '가맹점 번호', value: row.pgMidTail ? `····${row.pgMidTail}` : null },
        ]}
      />

      <PayDetailSection
        title="업체"
        rows={[
          { label: '가맹점', value: [row.merchantName, row.brandName].filter(Boolean).join(' · ') },
          { label: '접수', value: filled(row.inquiryNumber) },
          { label: '고객 연락처', value: filled(row.customerPhoneMasked) },
        ]}
      />

      <PayDetailSection
        title="금액"
        rows={[
          { label: '업체 수수료', value: row.tenantFeeLabel },
          { label: 'PG 원가', value: row.platformCostLabel },
          { label: '플랫폼 수익', value: won(row.platformSpreadWon) },
          { label: '업체 정산', value: won(row.tenantNetWon) },
        ]}
      />

      <PayDetailHistory
        items={row.history.map((item) => ({
          at: kstStamp(item.at),
          text: [item.label, item.who, item.note].filter(Boolean).join(' · '),
        }))}
      />

      {row.status === 'APPROVED' ? (
        <section className="rounded-xl border border-[#dde3ea] bg-[#f6f8fb] p-3">
          {row.canApiCancel ? (
            <>
              <label className="block text-xs text-[#5d6878]" htmlFor="cancel-reason">취소 사유</label>
              <textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-[#dde3ea] bg-white p-2 text-sm"
              />
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notifyTenant} onChange={(e) => setNotifyTenant(e.target.checked)} />
                업체에 메일·알림
              </label>
              {confirming ? (
                <InlineConfirm
                  question={`${won(row.amountWon)}을 전액 취소할까요?`}
                  confirmLabel="전액 취소"
                  busy={busy}
                  onConfirm={() => void run(() => cancelTenantPay(row.id, reason, notifyTenant))}
                  onCancel={() => setConfirming(false)}
                />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="md"
                    variant="danger"
                    className="!border-transparent !bg-[#b42318] !font-bold !text-white hover:!bg-[#9a1d14]"
                    onClick={() => setConfirming(true)}
                    disabled={!reason.trim()}
                  >
                    {won(row.amountWon)} 전액 취소
                  </Button>
                  {row.cancelRequested ? (
                    <Button size="md" variant="secondary" disabled={busy || !reason.trim()} onClick={() => void run(() => rejectTenantPayCancel(row.id, reason))}>
                      요청 반려
                    </Button>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Button
                size="md"
                variant="secondary"
                disabled={busy}
                onClick={() => void run(async () => {
                  const login = await openTenantSellerCenter(row.id);
                  const opened = openSellerCenterLoggedIn(login.loginId, login.password);
                  if (!opened) throw new Error('팝업이 막혀 판매자센터를 열지 못했습니다.');
                })}
              >
                업체 판매자센터에서 취소 ↗
              </Button>
              <label className="block text-xs text-[#5d6878]" htmlFor="mark-approval">승인번호 확인</label>
              <input
                id="mark-approval"
                value={approvalNo}
                onChange={(e) => setApprovalNo(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#dde3ea] bg-white px-2 text-sm"
              />
              <Button size="md" variant="secondary" disabled={busy || !approvalNo.trim()} onClick={() => void run(() => markTenantPayCancelled(row.id, approvalNo))}>
                취소 완료로 표시
              </Button>
              {row.cancelRequested ? (
                <>
                  <label className="block text-xs text-[#5d6878]" htmlFor="reject-reason">반려 사유</label>
                  <textarea
                    id="reject-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="min-h-16 w-full rounded-lg border border-[#dde3ea] bg-white p-2 text-sm"
                  />
                  <Button size="md" variant="secondary" disabled={busy || !reason.trim()} onClick={() => void run(() => rejectTenantPayCancel(row.id, reason))}>
                    요청 반려
                  </Button>
                </>
              ) : null}
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-[#b42318]">{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
