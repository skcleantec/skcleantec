import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { CardPaymentLedger } from '../../../components/admin/card-payment/CardPaymentLedger';
import { PgOnboardingForm } from '../../../components/admin/card-payment/PgOnboardingForm';
import {
  canOpenPgApplication,
  pgConnectionView,
  PgContractFileActions,
  PgOnboardingLanding,
  PgOnboardingSteps,
} from '../../../components/admin/card-payment/PgOnboardingLanding';
import {
  fetchTenantPgState,
  saveTenantPgOnboarding,
  submitTenantPgOnboarding,
  uploadTenantPgDocument,
  uploadTenantPgRegistration,
  type PgOnboardingRow,
} from '../../../api/cardPayment';
import { getToken } from '../../../stores/auth';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { PageTitleWithFavorite } from '../../../components/layout/NavFavoritePageTitle';
import { RoundBackButton } from '../../../components/ui/RoundBackButton';
import { openPgContractWindow } from '../../../utils/openPgContractWindow';

export function AdminCardPaymentPgPage() {
  return (
    <FeatureGate module="mod_card_payment">
      <AdminCardPaymentPgInner />
    </FeatureGate>
  );
}

function AdminCardPaymentPgInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const applying = location.pathname.endsWith('/apply');
  const landingPath = location.pathname.replace(/\/apply$/, '');
  const applyPath = applying ? location.pathname : `${location.pathname.replace(/\/$/, '')}/apply`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, applying);
  const [row, setRow] = useState<PgOnboardingRow | null>(null);
  const [connected, setConnected] = useState(false);
  const [merchantMid, setMerchantMid] = useState<string | null>(null);
  const [merchantOid, setMerchantOid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    const load = () => {
      void fetchTenantPgState(token)
        .then((res) => {
          if (cancelled) return;
          setRow(res.onboarding);
          const cred = res.credential;
          setConnected(cred.connected && (!('isActive' in cred) || cred.isActive));
          setMerchantMid(res.credential.connected ? res.credential.mid : null);
          setMerchantOid(res.credential.connected ? res.credential.oid : null);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    };
    load();
    const onSigned = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'pg-contract:signed') return;
      load();
    };
    window.addEventListener('message', onSigned);
    return () => {
      cancelled = true;
      window.removeEventListener('message', onSigned);
    };
  }, []);

  const view = pgConnectionView(
    connected,
    row?.status,
    row?.contractSignedAt,
    row?.contractMailedAt,
    Boolean(row?.merchantDeletedAt),
  );
  const detail =
    view === '연결됨'
      ? [merchantMid ? `MID ${merchantMid}` : null, merchantOid ? `OID ${merchantOid}` : null].filter(Boolean).join(' · ') ||
        '카드 결제가 연결되었습니다.'
      : view === '전자계약'
        ? '심사가 끝났습니다. 전자계약하기를 누르면 작성 창이 열립니다.'
        : view === '우편발송'
          ? '계약을 제출했습니다. 원성페이먼츠가 날인해서 우편으로 보내고, 가맹 코드를 연결하면 사용할 수 있습니다.'
          : view === '코드연결'
            ? '계약을 제출했습니다. 원성페이먼츠가 날인해서 우편으로 보내고, 가맹 코드를 연결하면 사용할 수 있습니다.'
            : view === '심사중'
              ? '신청을 접수했습니다. 원성페이먼츠가 승인하거나 거절합니다.'
              : view === '반려'
                ? '신청이 반려되었습니다. 내용을 고쳐 다시 신청할 수 있습니다.'
                : view === '해제'
                  ? '가맹 연결이 해제되었습니다. 카드결재를 받을 수 없습니다.'
                  : '아직 PG가 연결되지 않았습니다.';

  const uploadRegistration = async (file: File) => {
    const token = getToken();
    if (!token || !row) return;
    setUploadingKey('registration');
    try {
      const saved = await uploadTenantPgRegistration(token, file);
      setRow({ ...row, businessRegistrationImageUrl: saved.businessRegistrationImageUrl });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '사업자등록증을 올리지 못했습니다.');
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadDocument = async (kind: 'bankbook' | 'idcard', file: File) => {
    const token = getToken();
    if (!token || !row) return;
    setUploadingKey(kind);
    try {
      const saved = await uploadTenantPgDocument(token, kind, file);
      setRow({
        ...row,
        bankbookImageUrl: saved.bankbookImageUrl ?? row.bankbookImageUrl,
        idCardImageUrl: saved.idCardImageUrl ?? row.idCardImageUrl,
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '서류를 올리지 못했습니다.');
    } finally {
      setUploadingKey(null);
    }
  };

  const persist = async (submit: boolean) => {
    const token = getToken();
    if (!token || !row) return;
    if (submit && row.merchantKind === 'solo' && !row.businessRegistrationImageUrl) {
      setError('사업자등록증을 등록해 주세요.');
      return;
    }
    if (submit && row.merchantKind === 'solo' && !row.bankbookImageUrl) {
      setError('통장사본을 등록해 주세요.');
      return;
    }
    if (submit && row.merchantKind === 'solo' && !row.idCardImageUrl) {
      setError('신분증을 등록해 주세요.');
      return;
    }
    if (submit && row.merchantKind !== 'solo' && row.merchantKind !== 'corp') {
      setError('개인사업자 또는 법인을 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const next = submit ? await submitTenantPgOnboarding(token, row) : await saveTenantPgOnboarding(token, row);
      setRow(next);
      setError(null);
      if (submit) navigate(landingPath, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (applying && loaded && row && !canOpenPgApplication(view)) {
    return <Navigate to={landingPath} replace />;
  }

  if (loaded && view === '연결됨' && !applying) {
    return (
      <div className="min-w-0 w-full max-w-full space-y-3 pb-8">
        <div className="min-w-0">
          <PageTitleWithFavorite label="PG신청">
            <h1 className="text-xl font-semibold text-gray-800">PG신청</h1>
          </PageTitleWithFavorite>
          <p className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-fluid-xs font-medium text-emerald-800">
            연결됨{detail ? ` · ${detail}` : ''}
          </p>
        </div>
        {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
        {row?.contractSignedAt ? (
          <PgContractFileActions
            onView={() => openPgContractWindow()}
            onDownload={() => openPgContractWindow('/pg-contract?download=1')}
          />
        ) : null}
        <CardPaymentLedger />
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-3 pb-8">
      <div className="flex items-start gap-2">
        {applying ? (
          <RoundBackButton
            ariaLabel="신청 안내"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={() => navigate(landingPath)}
          />
        ) : null}
        <div className="min-w-0">
          <PageTitleWithFavorite label="PG신청">
            <h1 className="text-xl font-semibold text-gray-800">PG신청</h1>
          </PageTitleWithFavorite>
          <p className="mt-1 text-sm text-gray-500">
            {applying
              ? '개인은 서류 3가지를 올리고, 법인은 우편으로 보냅니다.'
              : '카드 결제를 받으려면 PG를 신청합니다.'}
          </p>
        </div>
      </div>
      <div
        ref={scrollRef}
        onFocusCapture={onFieldFocus}
        className={`modal-form-scroll-surface min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm ${applying ? 'overflow-y-auto p-2 sm:p-4' : 'overflow-hidden'}`}
      >
        {error ? <p className="mb-2 px-2 text-fluid-xs text-red-700 sm:px-0">{error}</p> : null}
        {!loaded || !row ? (
          <p className="p-8 text-center text-fluid-sm text-slate-500">{error ? '' : '불러오는 중…'}</p>
        ) : applying ? (
          <div className="space-y-4">
            <PgOnboardingSteps view={view} compact />
            <PgOnboardingForm
            value={row}
            onChange={setRow}
            saving={saving}
            uploadingKey={uploadingKey}
            onUploadRegistration={(file) => void uploadRegistration(file)}
            onUploadDocument={(kind, file) => void uploadDocument(kind, file)}
            submitted={row.status === 'SUBMITTED' || row.status === 'FORWARDED_TO_PG' || row.status === 'APPROVED'}
            onSave={() => void persist(false)}
            onSubmit={() => void persist(true)}
            />
          </div>
        ) : (
          <PgOnboardingLanding
            view={view}
            detail={detail}
            onApply={() => navigate(applyPath)}
            onContract={() => openPgContractWindow()}
            onViewContract={row.contractSignedAt ? () => openPgContractWindow() : undefined}
            onDownloadContract={row.contractSignedAt ? () => openPgContractWindow('/pg-contract?download=1') : undefined}
          />
        )}
      </div>
    </div>
  );
}
