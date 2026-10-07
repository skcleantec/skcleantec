import { useEffect, useRef, useState } from 'react';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { PgOnboardingForm } from '../../../components/admin/card-payment/PgOnboardingForm';
import {
  fetchTenantPgState,
  saveTenantPgOnboarding,
  submitTenantPgOnboarding,
  uploadTenantPgRegistration,
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
  const [uploading, setUploading] = useState(false);

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

  const uploadRegistration = async (file: File) => {
    const token = getToken();
    if (!token || !row) return;
    setUploading(true);
    try {
      const saved = await uploadTenantPgRegistration(token, file);
      setRow({ ...row, businessRegistrationImageUrl: saved.businessRegistrationImageUrl });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '사업자등록증을 올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const persist = async (submit: boolean) => {
    const token = getToken();
    if (!token || !row) return;
    if (submit && !row.businessRegistrationImageUrl) {
      setError('사업자등록증을 등록해 주세요.');
      return;
    }
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
        사업자와 연락처를 제출하면 원성페이먼츠 전달 주소가 생깁니다. 그 주소에서 가맹 코드를 입력하면 이 업체에 바로 연결됩니다.
      </p>
      {row?.reviewToken ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
          <p className="text-fluid-2xs font-medium text-slate-800">원성 전달 주소</p>
          <p className="mt-1 break-all text-fluid-2xs text-slate-600">{`${window.location.origin}/pg-join/${row.reviewToken}`}</p>
          <button
            type="button"
            className="mt-2 min-h-9 rounded-lg border border-slate-300 bg-white px-3 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/pg-join/${row.reviewToken}`)}
          >
            주소 복사
          </button>
        </div>
      ) : null}
      {connected ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-fluid-2xs text-emerald-800">
          PG 연동됨 {tidMasked ? `(TID ${tidMasked})` : ''}
          {merchantMid ? ` · MID ${merchantMid}` : ''}
          {merchantOid ? ` · OID ${merchantOid}` : ''}
        </p>
      ) : (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-900">
          {row?.reviewToken
            ? '아직 키가 연결되지 않았습니다. 원성 전달 주소에서 코드를 입력하면 이 업체에 연결됩니다.'
            : '가입 정보를 제출하면 원성에 보낼 주소가 생깁니다.'}
        </p>
      )}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
      {row ? (
        <div className="mt-3">
          <PgOnboardingForm
            value={row}
            onChange={setRow}
            saving={saving}
            uploading={uploading}
            onUploadRegistration={(file) => void uploadRegistration(file)}
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
