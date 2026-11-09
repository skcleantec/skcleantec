import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCashbillSettings, type CashbillSettings } from '../../api/cashbill';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { ReceiptReadyStatusBar, ReceiptSetupSteps } from './ReceiptSetupSteps';
import {
  defaultBrand,
  resolveReceiptSetupStep,
  type ReceiptSetupKind,
} from './receiptSetupState';

export function ReceiptSetupGate({
  kind,
  children,
}: {
  kind: ReceiptSetupKind;
  children: ReactNode;
}) {
  const permissions = useMarketerPermissions();
  const canEditCompany = !permissions.loading && permissions.has('admin.companyProfile');
  const { summary, reload: reloadWallet } = useReceiptWallet();
  const [settings, setSettings] = useState<CashbillSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchCashbillSettings();
      setSettings(next);
      await reloadWallet().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '준비 상태를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [reloadWallet]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const brand = useMemo(() => (settings ? defaultBrand(settings) : null), [settings]);
  const balanceKrw = summary?.balanceKrw ?? settings?.walletBalanceKrw ?? 0;
  const phase = brand
    ? resolveReceiptSetupStep({ kind, brand, balanceKrw })
    : settings && settings.brands.length === 0
      ? 'ready'
      : 1;

  if (loading) {
    return <p className="p-6 text-center text-fluid-sm text-[#5d6878]">준비 상태를 확인하는 중…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2 rounded-[10px] border border-[#f5b5b0] bg-[#fff1f0] px-3 py-3">
        <p className="text-fluid-xs text-[#b42318]">{error}</p>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-[#dde3ea] bg-white px-3 text-fluid-xs text-[#141b26] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          onClick={() => {
            setLoading(true);
            setTick((n) => n + 1);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!settings) return null;

  if (settings.brands.length === 0) {
    return (
      <p className="rounded-[10px] border border-[#dde3ea] bg-white px-3 py-3 text-fluid-xs text-[#5d6878]">
        영업브랜드가 없습니다. 관리자 전용 → 영업브랜드에서 먼저 등록해 주세요.
      </p>
    );
  }

  if (!brand) return null;

  if (phase !== 'ready') {
    return (
      <ReceiptSetupSteps
        kind={kind}
        step={phase}
        settings={settings}
        brand={brand}
        balanceKrw={balanceKrw}
        canEditCompany={canEditCompany}
        onReload={() => {
          setLoading(true);
          setTick((n) => n + 1);
        }}
        onCertSkip={() => setTick((n) => n + 1)}
      />
    );
  }

  return (
    <>
      <ReceiptReadyStatusBar kind={kind} brand={brand} balanceKrw={balanceKrw} />
      {children}
    </>
  );
}
