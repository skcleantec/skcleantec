import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchReceiptWallet, type ReceiptWalletSummary } from '../../api/receiptWallet';
import { WalletChargeModal } from './WalletChargeModal';
import { ReceiptWalletHistoryModal } from './ReceiptWalletHistoryModal';

type ReceiptWalletContextValue = {
  summary: ReceiptWalletSummary | null;
  reload: () => Promise<void>;
  openCharge: (amountKrw?: number) => void;
  openHistory: () => void;
};

const ReceiptWalletContext = createContext<ReceiptWalletContextValue | null>(null);

export function ReceiptWalletRefresh({ tick }: { tick: number }) {
  const { reload } = useReceiptWallet();
  useEffect(() => {
    if (tick > 0) void reload();
  }, [reload, tick]);
  return null;
}

export function useReceiptWallet(): ReceiptWalletContextValue {
  const value = useContext(ReceiptWalletContext);
  if (!value) throw new Error('청소비서 지갑은 영수증 화면 안에서만 쓸 수 있습니다.');
  return value;
}

export function ReceiptWalletProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ReceiptWalletSummary | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<number | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  const reload = useCallback(async () => {
    const next = await fetchReceiptWallet();
    setSummary(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchReceiptWallet()
      .then((next) => {
        if (!cancelled) setSummary(next);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ReceiptWalletContextValue>(
    () => ({
      summary,
      reload,
      openCharge: (amountKrw?: number) => {
        setChargeAmount(typeof amountKrw === 'number' && Number.isFinite(amountKrw) ? amountKrw : undefined);
        setChargeOpen(true);
      },
      openHistory: () => setHistoryOpen(true),
    }),
    [summary, reload],
  );

  return (
    <ReceiptWalletContext.Provider value={value}>
      {children}
      {chargeOpen ? (
        <WalletChargeModal
          key={chargeAmount ?? 'default'}
          initialAmountKrw={chargeAmount}
          onClose={() => {
            setChargeOpen(false);
            setChargeAmount(undefined);
          }}
          onDone={() => void reload()}
        />
      ) : null}
      {historyOpen ? <ReceiptWalletHistoryModal onClose={() => setHistoryOpen(false)} /> : null}
    </ReceiptWalletContext.Provider>
  );
}
