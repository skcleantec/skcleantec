import { useEffect, useRef, useState } from 'react';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { PgOnboardingForm } from '../../../components/admin/card-payment/PgOnboardingForm';
import {
  fetchTenantPgState,
  saveTenantPgOnboarding,
  submitTenantPgOnboarding,
  type PgOnboardingRow,
} from '../../../api/cardPayment';
import { getToken } from '../../../stores/auth';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';

export function AdminCardPaymentPgPage() {
  return (
    <FeatureGate module="mod_card_payment">
      <AdminCardPaymentPgInner />
    </FeatureGate>
  );
}

function AdminCardPaymentPgInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);
  const [row, setRow] = useState<PgOnboardingRow | null>(null);
  const [connected, setConnected] = useState(false);
  const [tidMasked, setTidMasked] = useState<string | null>(null);
  const [merchantMid, setMerchantMid] = useState<string | null>(null);
  const [merchantOid, setMerchantOid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetchTenantPgState(token)
      .then((res) => {
        setRow(res.onboarding);
        setConnected(res.credential.connected);
        setTidMasked(res.credential.connected ? res.credential.tidMasked : null);
        setMerchantMid(res.credential.connected ? res.credential.mid : null);
        setMerchantOid(res.credential.connected ? res.credential.oid : null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  }, []);

  const persist = async (submit: boolean) => {
    const token = getToken();
    if (!token || !row) return;
    setSaving(true);
    try {
      const next = submit ? await submitTenantPgOnboarding(token, row) : await saveTenantPgOnboarding(token, row);
      setRow(next);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="modal-form-scroll-surface min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 sm:p-4"
    >
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        원성페이먼츠 가입에 필요한 정보를 적어 제출하면, 플랫폼이 PG사에 전달합니다. 키가 오면 이 업체에서 카드결재를 쓸 수 있습니다.
      </p>
      {connected ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs text-emerald-800">
          PG 연동됨 {tidMasked ? `(TID ${tidMasked})` : ''}
          {merchantMid ? ` · MID ${merchantMid}` : ''}
          {merchantOid ? ` · OID ${merchantOid}` : ''}
        </p>
      ) : (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-900">
          아직 키가 연결되지 않았습니다. 제출 후 개통을 기다려 주세요.
        </p>
      )}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      {row ? (
        <div className="mt-3">
          <PgOnboardingForm
            value={row}
            onChange={setRow}
            saving={saving}
            submitted={row.status === 'SUBMITTED' || row.status === 'FORWARDED_TO_PG' || row.status === 'APPROVED'}
            onSave={() => void persist(false)}
            onSubmit={() => void persist(true)}
          />
        </div>
      ) : (
        <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
      )}
    </div>
  );
}
