import { useCallback, useEffect, useState } from 'react';
import { fetchBankDepositsByInquiry, type BankDepositItem } from '../../api/bankDeposits';
import { useBankDepositRealtime } from '../../hooks/useBankDepositRealtime';
import { DEPOSIT_KIND_LABEL, kstDayLabel, kstTime, won } from './bankDepositFormat';

function ymdKst(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 접수 상세 — 통장 입금 문자로 확인된 입금을 한 줄씩 보여 준다. 없으면 아무것도 그리지 않는다. */
export function InquiryBankDepositsNote({
  token,
  inquiryId,
  className = '',
}: {
  token: string | null;
  inquiryId: string;
  className?: string;
}) {
  const [items, setItems] = useState<BankDepositItem[]>([]);

  const load = useCallback(async () => {
    if (!token || !inquiryId) {
      setItems([]);
      return;
    }
    try {
      const r = await fetchBankDepositsByInquiry(token, inquiryId);
      setItems(r.items);
    } catch {
      setItems([]);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);

  useBankDepositRealtime(
    token,
    (p) => {
      if (p.linkedInquiryId === inquiryId || items.some((x) => x.id === p.id)) void load();
    },
    Boolean(token && inquiryId),
  );

  if (items.length === 0) return null;

  return (
    <ul className={`space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 ${className}`} aria-label="통장 입금 확인">
      {items.map((row) => (
        <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-fluid-xs text-emerald-950">
          <span className="font-bold">
            ✓ {row.linkedKind ? DEPOSIT_KIND_LABEL[row.linkedKind] : '입금'} {won(row.amountWon)} 입금 확인
          </span>
          <span className="text-fluid-2xs tabular-nums text-emerald-800">
            {kstDayLabel(ymdKst(row.depositedAt))} {kstTime(row.depositedAt)} · {row.bankName} · 입금자 {row.depositorName || '이름 없음'}
          </span>
        </li>
      ))}
    </ul>
  );
}
