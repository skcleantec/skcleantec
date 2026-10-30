import { useState } from 'react';
import type { UsageFeeCardPaymentRow } from '../../../api/platformCardPayment';
import { Button } from '../../../components/ui/Button';
import { InlineConfirm } from '../../../components/ui/InlineConfirm';
import { splitTaxIncluded } from '@shared/cardPayment';
import { PayDetailHeader, PayDetailHistory, PayDetailSection } from './PayDetailSections';
import { installmentLabel, kstStamp, won } from './tenantPayFormat';

function chipOf(label: string): string {
  if (label === '결제 완료') return 'border-[#a9dfc1] bg-[#e3f6ec] text-[#126b3f]';
  if (label === '결제 대기') return 'border-[#f0d27a] bg-[#fff6dc] text-[#7a5300]';
  if (label === '취소' || label === '결제 실패') return 'border-[#f3b8b1] bg-[#fdecea] text-[#b42318]';
  return 'border-[#dde3ea] bg-[#f1f3f6] text-[#5d6878]';
}

function paid(row: UsageFeeCardPaymentRow): boolean {
  return row.status === 'APPROVED' || row.status === 'CANCELLED';
}

export function ServiceBridgePayDetail({
  row,
  copied,
  busy,
  onCopy,
  onCloseLink,
  onCancel,
}: {
  row: UsageFeeCardPaymentRow;
  copied: boolean;
  busy: boolean;
  onCopy: () => void;
  onCloseLink: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<'close' | 'cancel' | null>(null);
  const split = splitTaxIncluded(row.amountKrw, row.supplyAmountKrw, row.vatAmountKrw);
  const isLink = row.methodLabel === '링크' || Boolean(row.linkUrl || row.linkExpiresAt);
  const waiting = row.statusLabel === '결제 대기' && Boolean(row.linkUrl);
  const card = [row.cardIssuer, row.cardLast4 ? `··${row.cardLast4}` : '', row.cardKind ? `(${row.cardKind})` : '']
    .filter(Boolean)
    .join(' ');
  const installment = row.installmentMonths == null ? null : installmentLabel(row.installmentMonths);
  const method = isLink
    ? `링크(인증)${row.paidSource ? ` · ${row.paidSource} 결제창` : ''}`
    : row.methodLabel || '수기';
  const subtitle = [row.buyerName, row.goodsName, installment].filter(Boolean).join(' · ');
  const history = [
    row.createdAt
      ? { at: kstStamp(row.createdAt), text: [isLink ? '링크 만듦' : method, row.createdByName].filter(Boolean).join(' · ') }
      : null,
    paid(row) ? { at: kstStamp(row.paidAt), text: row.status === 'CANCELLED' ? '승인 · 이후 취소' : '승인' } : null,
    row.linkClosedAt ? { at: kstStamp(row.linkClosedAt), text: '링크 닫음' } : null,
  ].filter((item): item is { at: string; text: string } => Boolean(item));

  return (
    <div className="space-y-4 text-[#141b26]">
      <PayDetailHeader
        chipText={row.statusLabel || row.status}
        chipClassName={chipOf(row.statusLabel || '')}
        amount={won(row.amountKrw)}
        subtitle={subtitle}
      />
      <PayDetailSection
        title="결제"
        empty={paid(row) ? undefined : '아직 결제 전이에요'}
        rows={paid(row) ? [
          { label: '카드', value: card },
          { label: '할부', value: installment },
          { label: '승인번호', value: row.approvalNo },
          { label: '승인 시각', value: kstStamp(row.paidAt) },
          { label: '방식', value: method },
          { label: '결제번호', value: row.payNo },
          { label: '공급가', value: `${split.supplyKrw.toLocaleString('ko-KR')}원` },
          { label: '부가세', value: `${split.vatKrw.toLocaleString('ko-KR')}원` },
        ] : []}
      />
      <PayDetailSection
        title="대상"
        rows={[
          { label: '용도', value: row.purposeLabel },
          { label: row.purpose === 'CLEANING_PROXY' ? '청소한 업체' : '업체', value: row.tenantName },
          { label: '접수', value: row.inquiryNumber || row.inquiryLabel },
          { label: '고객 연락처', value: row.customerPhoneMasked },
        ]}
      />
      {isLink && (row.linkExpiresAt || waiting) ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold text-[#5d6878]">링크</h3>
          {row.linkExpiresAt ? (
            <div className="flex items-start justify-between gap-3 border-b border-[#eef2f6] py-2 text-sm">
              <span className="text-[#5d6878]">만료 시각</span>
              <span className="text-[#141b26]">{kstStamp(row.linkExpiresAt)}</span>
            </div>
          ) : null}
          {waiting ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={onCopy}>{copied ? '복사됨' : '링크 복사'}</Button>
              {confirm === 'close' ? (
                <InlineConfirm
                  question="이 결제 링크를 닫을까요?"
                  confirmLabel="닫기"
                  busy={busy}
                  onCancel={() => setConfirm(null)}
                  onConfirm={() => void onCloseLink().finally(() => setConfirm(null))}
                />
              ) : (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirm('close')}>링크 닫기</Button>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      <PayDetailHistory items={history} />
      {row.status === 'APPROVED' ? (
        <section className="rounded-xl border border-[#dde3ea] bg-[#f6f8fb] p-3">
          {row.cancelable && row.payMethod !== 'KEYIN' ? (
            confirm === 'cancel' ? (
              <InlineConfirm
                question={`${won(row.amountKrw)}을 전액 취소할까요?`}
                confirmLabel="전액 취소"
                busy={busy}
                onCancel={() => setConfirm(null)}
                onConfirm={() => void onCancel().finally(() => setConfirm(null))}
              />
            ) : (
              <Button size="md" variant="danger" className="!border-transparent !bg-[#b42318] !font-bold !text-white hover:!bg-[#9a1d14]" disabled={busy} onClick={() => setConfirm('cancel')}>
                {won(row.amountKrw)} 전액 취소
              </Button>
            )
          ) : (
            <p className="text-sm text-[#5d6878]">수기 결제이거나 승인일이 지난 건은 판매자센터에서 취소합니다.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
