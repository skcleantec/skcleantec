import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCashbillSettings, type CashbillSettings } from '../../api/cashbill';
import { useMarketerPermissions } from '../../hooks/useMarketerPermissions';
import { useReceiptWallet } from '../wallet/ReceiptWalletProvider';
import { ReceiptReadyStatusBar, ReceiptSetupSteps } from './ReceiptSetupSteps';
import {
  defaultBrand,
  receiptUnitPrice,
  resolveReceiptSetupStep,
  type ReceiptSetupKind,
  type ReceiptSetupStep,
} from './receiptSetupState';

function MarketerSetupWaiting({
  kind,
  step,
}: {
  kind: ReceiptSetupKind;
  step: ReceiptSetupStep;
}) {
  const message =
    step === 1
      ? '관리자가 바로빌 가입을 마쳐야 발행할 수 있어요.'
      : step === 2
        ? kind === 'taxinvoice'
          ? '세금계산서는 관리자가 공동인증서를 등록해야 해요.'
          : '현금영수증은 인증서 없이 진행할 수 있어요. 관리자에게 계산서 연결 상태를 확인해 달라고 해 주세요.'
        : '지갑 잔액이 부족해요. 관리자에게 충전을 요청해 주세요.';

  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
      <p className="text-fluid-sm font-semibold text-slate-900">
        {kind === 'cashbill' ? '현금영수증' : '세금계산서'}를 아직 쓸 수 없어요
      </p>
      <p className="text-fluid-sm leading-relaxed text-slate-600">{message}</p>
      {kind === 'cashbill' && step === 2 ? (
        <p className="text-fluid-2xs text-slate-500">
          현금영수증은 공동인증서가 없어도 됩니다. 바로빌 가입만 끝나면 발행할 수 있어요.
        </p>
      ) : null}
    </div>
  );
}

export function ReceiptSetupGate({
  kind,
  children,
}: {
  kind: ReceiptSetupKind;
  children: ReactNode;
}) {
  const permissions = useMarketerPermissions();
  const isTenantAdmin = permissions.me?.role === 'ADMIN';
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
  const rawPhase = brand
    ? resolveReceiptSetupStep({ kind, brand, balanceKrw })
    : settings && settings.brands.length === 0
      ? 'ready'
      : 1;
  /** 현금영수증은 인증서 불필요 — 마케터는 2단계(인증서)를 건너뛴다 */
  const phase: typeof rawPhase =
    !isTenantAdmin && kind === 'cashbill' && rawPhase === 2
      ? balanceKrw < receiptUnitPrice(kind)
        ? 3
        : 'ready'
      : rawPhase;

  if (loading || permissions.loading) {
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
    if (!isTenantAdmin) {
      return <MarketerSetupWaiting kind={kind} step={phase} />;
    }
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
