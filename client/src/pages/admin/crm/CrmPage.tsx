import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';
import { getToken } from '../../../stores/auth';
import { useMarketerPermissions } from '../../../hooks/useMarketerPermissions';
import { useCrmInquiryEdit } from '../../../hooks/useCrmInquiryEdit';
import { fetchTelecrmPricingCatalog } from '../../../api/telecrm';
import { CrmShell } from '../../../components/crm/layout/CrmShell';
import { CrmIntakePanel, type CrmCustomerMode } from '../../../components/crm/intake/CrmIntakePanel';
import { CrmScriptPanel } from '../../../components/crm/scripts/CrmScriptPanel';
import { CrmPricingPanel } from '../../../components/crm/pricing/CrmPricingPanel';
import { CrmSessionBar } from '../../../components/crm/session/CrmSessionBar';
import { CrmIconPhone } from '../../../components/crm/crmUi';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { CrmSettingsDrawer } from '../../../components/crm/settings/CrmSettingsDrawer';
import { CrmOrderIssueDrawer } from '../../../components/crm/issue/CrmOrderIssueDrawer';
import { useCrmPanelUrl } from '../../../hooks/useCrmPanelUrl';
import type { CrmOrderIssueSeed } from '../../../components/orderform/OrderIssueInlinePanel';
import { crmIntakeRequiredPermission } from '../../../components/crm/intake/crmIntakeValidation';
import type { CrmIntakeKind } from '../../../components/crm/intake/crmIntakeSubmit';
import {
  clearCrmIntakeDraft,
  crmIntakeDraftHasContent,
  loadCrmIntakeDraft,
  saveCrmIntakeDraft,
  type CrmIntakeFormSnapshot,
} from '../../../utils/crmIntakeDraft';
import { isTelecrmNativeApp } from '../../../utils/telecrmNativeBridge';

export function CrmPage() {
  const [searchParams] = useSearchParams();
  const isPopup = searchParams.get('popup') === '1';
  const isMobileApp =
    searchParams.get('mobile') === '1' ||
    searchParams.get('app') === '1' ||
    isTelecrmNativeApp();
  const permissions = useMarketerPermissions();
  const canSharedSettings = permissions.has('crm.settings');
  const canPersonalCatalog = permissions.has('crm.view');
  const canOpenSettings = canSharedSettings || canPersonalCatalog;
  const canOrderIssue =
    permissions.me?.role === 'ADMIN' || permissions.has('orderform.issue');
  const canAdsSession = permissions.has('ads.sessions');
  const canView =
    permissions.me?.role === 'ADMIN' ||
    canAccessAdminPath(permissions.me?.role, permissions.permissions, '/admin/crm');

  const [mode, setMode] = useState<CrmCustomerMode>('new');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [minimumTotalAmount, setMinimumTotalAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [lookupRefreshKey, setLookupRefreshKey] = useState(0);
  const [initialFormDraft, setInitialFormDraft] = useState<Partial<CrmIntakeFormSnapshot> | null>(null);
  const [draftRestoredPhone, setDraftRestoredPhone] = useState<string | null>(null);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [smsPrefill, setSmsPrefill] = useState('');
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const dispatchNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftReadyRef = useRef(false);
  const formSnapshotRef = useRef<CrmIntakeFormSnapshot | null>(null);

  const {
    settingsTab,
    catalogScope,
    pendingInquiryId: issuePendingInquiryId,
    isSettingsOpen,
    isIssueOpen,
    openSettings,
    openIssue,
    closePanel,
    setSettingsTab,
    setCatalogScope,
  } = useCrmPanelUrl();

  const { openInquiryEdit, layer: inquiryEditLayer } = useCrmInquiryEdit(canView, () => {
    setLookupRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    document.title = '텔레CRM — SK클린텍';
  }, []);

  useEffect(() => {
    const draft = loadCrmIntakeDraft();
    if (draft && crmIntakeDraftHasContent(draft)) {
      setMode(draft.mode);
      setPhone(draft.phone);
      setCustomerName(draft.customerName);
      setPyeong(draft.pyeong);
      setInitialFormDraft({
        customerName: draft.customerName,
        nickname: draft.nickname,
        memo: draft.memo,
        address: draft.address,
        preferredMoveInCleanYmd: draft.preferredMoveInCleanYmd,
        kind: draft.kind,
        goldDb: draft.goldDb,
      });
      if (draft.phone.trim()) setDraftRestoredPhone(draft.phone.trim());
      setHasUnsavedDraft(true);
    }
    draftReadyRef.current = true;
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedDraft) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedDraft]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetchTelecrmPricingCatalog(token)
      .then((res) => {
        setPricePerPyeong(res.estimateConfig.pricePerPyeong);
        setMinimumTotalAmount(res.estimateConfig.minimumTotalAmount ?? 0);
        setDepositAmount(res.estimateConfig.depositAmount ?? 0);
      })
      .catch(() => {
        /* estimate config optional for script placeholders */
      });
  }, []);

  const canSubmitIntakeKind = useCallback(
    (kind: CrmIntakeKind) => {
      if (permissions.me?.role === 'ADMIN') return true;
      return permissions.has(crmIntakeRequiredPermission(kind));
    },
    [permissions],
  );

  const persistDraft = useCallback(
    (form: CrmIntakeFormSnapshot) => {
      if (!draftReadyRef.current) return;
      formSnapshotRef.current = form;
      const draft = {
        mode,
        phone,
        pyeong,
        ...form,
        savedAt: Date.now(),
      };
      if (crmIntakeDraftHasContent(draft)) {
        saveCrmIntakeDraft(draft);
        setHasUnsavedDraft(true);
      } else {
        clearCrmIntakeDraft();
        setHasUnsavedDraft(false);
      }
    },
    [mode, phone, pyeong],
  );

  useEffect(() => {
    if (!draftReadyRef.current) return;
    const form = formSnapshotRef.current;
    if (!form) {
      const partial = { mode, phone, pyeong, customerName, savedAt: Date.now() };
      if (crmIntakeDraftHasContent(partial)) {
        saveCrmIntakeDraft({
          mode,
          phone,
          pyeong,
          customerName,
          nickname: '',
          memo: '',
          address: '',
          preferredMoveInCleanYmd: '',
          kind: 'absent',
          goldDb: false,
          savedAt: Date.now(),
        });
        setHasUnsavedDraft(true);
      }
      return;
    }
    persistDraft(form);
  }, [mode, phone, pyeong, customerName, persistDraft]);

  const handleFormChange = useCallback(
    (snapshot: CrmIntakeFormSnapshot) => {
      formSnapshotRef.current = snapshot;
      if (snapshot.customerName !== customerName) setCustomerName(snapshot.customerName);
      setSmsPrefill(snapshot.memo ?? '');
      persistDraft(snapshot);
    },
    [customerName, persistDraft],
  );

  const showDispatchNotice = useCallback((message: string) => {
    setDispatchNotice(message);
    if (dispatchNoticeTimer.current) clearTimeout(dispatchNoticeTimer.current);
    dispatchNoticeTimer.current = setTimeout(() => setDispatchNotice(null), 4000);
  }, []);

  const handleIntakeSaved = useCallback(() => {
    clearCrmIntakeDraft();
    setHasUnsavedDraft(false);
    setLookupRefreshKey((k) => k + 1);
  }, []);

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const estimateWon = useMemo(() => {
    if (!Number.isFinite(pyeongNum) || pyeongNum <= 0 || pricePerPyeong <= 0) return null;
    return computeEstimateTotalFromPyeong(pyeongNum, pricePerPyeong, minimumTotalAmount);
  }, [pyeongNum, pricePerPyeong, minimumTotalAmount]);

  useEffect(() => {
    if (catalogRefreshKey === 0) return;
    const token = getToken();
    if (!token) return;
    void fetchTelecrmPricingCatalog(token)
      .then((res) => {
        setPricePerPyeong(res.estimateConfig.pricePerPyeong);
        setMinimumTotalAmount(res.estimateConfig.minimumTotalAmount ?? 0);
        setDepositAmount(res.estimateConfig.depositAmount ?? 0);
      })
      .catch(() => {});
  }, [catalogRefreshKey]);

  const handleCloseSettings = useCallback(() => {
    closePanel();
    setCatalogRefreshKey((k) => k + 1);
  }, [closePanel]);

  const issueSeed = useMemo((): CrmOrderIssueSeed => {
    const form = formSnapshotRef.current;
    return {
      customerName: form?.customerName?.trim() || customerName.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      areaPyeong: pyeong.trim() || undefined,
      areaBasis: pyeong.trim() ? '공급' : undefined,
      address: form?.address?.trim() || undefined,
      preferredDate: form?.preferredMoveInCleanYmd?.trim() || undefined,
      totalAmount: estimateWon != null ? String(estimateWon) : undefined,
      depositAmount: depositAmount > 0 ? String(depositAmount) : undefined,
    };
  }, [customerName, phone, pyeong, depositAmount, estimateWon, isIssueOpen]);

  if (!getToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-gray-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (permissions.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-gray-500">권한 확인 중…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-amber-900">텔레CRM 사용 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <FeatureGate
      module="mod_telecrm"
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
          <div className="max-w-md space-y-3">
            <p className="text-fluid-sm text-amber-900">이 업체에는 텔레CRM 기능(mod_telecrm)이 꺼져 있습니다.</p>
            {isPopup ? (
              <button
                type="button"
                onClick={() => window.close()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white"
              >
                창 닫기
              </button>
            ) : (
              <Link to="/admin/dashboard" className="text-fluid-sm text-sky-700 hover:underline">
                대시보드로
              </Link>
            )}
          </div>
        </div>
      }
    >
      <div className={isMobileApp ? 'min-w-0 w-full' : 'min-w-[1280px]'}>
        <CrmShell
          mobile={isMobileApp}
          header={
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 text-white shadow-lg">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-md shadow-indigo-900/40">
                  <CrmIconPhone className="h-5 w-5" />
                </span>
                <h1 className="truncate text-fluid-sm font-bold tracking-tight">텔레CRM</h1>
                {!isMobileApp ? <CrmSessionBar enabled={canAdsSession} /> : null}
                {hasUnsavedDraft ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                    미저장 초안
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canOrderIssue ? (
                  <button
                    type="button"
                    onClick={() => openIssue()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-fluid-xs font-semibold text-sky-100 hover:bg-sky-500/25"
                  >
                    발주서
                  </button>
                ) : null}
                {canOpenSettings ? (
                  <button
                    type="button"
                    onClick={() =>
                      openSettings('scripts', canPersonalCatalog ? 'personal' : 'shared')
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-fluid-xs font-semibold text-violet-100 hover:bg-violet-500/25"
                  >
                    설정
                  </button>
                ) : null}
                {isPopup ? (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="rounded-xl bg-white/10 px-3 py-1.5 text-fluid-xs font-medium hover:bg-white/20"
                  >
                    창 닫기
                  </button>
                ) : isMobileApp ? null : (
                  <Link
                    to="/admin/dashboard"
                    className="rounded-xl bg-white/10 px-3 py-1.5 text-fluid-xs font-medium hover:bg-white/20"
                  >
                    관리자로
                  </Link>
                )}
              </div>
            </header>
          }
          left={
            <CrmIntakePanel
              mode={mode}
              onModeChange={setMode}
              phone={phone}
              onPhoneChange={setPhone}
              onCustomerNameChange={setCustomerName}
              pyeong={pyeong}
              onPyeongChange={setPyeong}
              onOpenInquiryEdit={openInquiryEdit}
              lookupRefreshKey={lookupRefreshKey}
              onSaved={handleIntakeSaved}
              initialFormDraft={initialFormDraft}
              onFormChange={handleFormChange}
              skipAutoFillPhone={draftRestoredPhone}
              canSubmitKind={canSubmitIntakeKind}
              permissionsLoading={permissions.loading}
              onOpenOrderIssue={canOrderIssue ? openIssue : undefined}
              smsPrefill={smsPrefill}
              onDispatchNotice={showDispatchNotice}
            />
          }
          center={
            <CrmScriptPanel
              customerName={customerName || undefined}
              pyeong={pyeong || undefined}
              estimateWon={estimateWon}
              customerPhone={phone}
              refreshKey={catalogRefreshKey}
              onDispatchNotice={showDispatchNotice}
              onOpenSettings={
                canOpenSettings
                  ? () => openSettings('scripts', canPersonalCatalog ? 'personal' : 'shared')
                  : undefined
              }
            />
          }
          right={
            <CrmPricingPanel
              pyeong={pyeong}
              onPyeongChange={setPyeong}
              refreshKey={catalogRefreshKey}
              onOpenSettings={
                canOpenSettings
                  ? () => openSettings('pricing', canPersonalCatalog ? 'personal' : 'shared')
                  : undefined
              }
            />
          }
        />
        {inquiryEditLayer}
        {canOpenSettings ? (
          <CrmSettingsDrawer
            open={isSettingsOpen}
            tab={settingsTab}
            catalogScope={catalogScope}
            canEditShared={canSharedSettings}
            canEditPersonal={canPersonalCatalog}
            onTabChange={setSettingsTab}
            onCatalogScopeChange={setCatalogScope}
            onClose={handleCloseSettings}
          />
        ) : null}
        {canOrderIssue ? (
          <CrmOrderIssueDrawer
            open={isIssueOpen}
            pendingInquiryId={issuePendingInquiryId || undefined}
            crmSeed={issueSeed}
            onClose={closePanel}
            onIssued={() => setLookupRefreshKey((k) => k + 1)}
          />
        ) : null}
        {dispatchNotice ? (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-fluid-sm text-white shadow-lg">
            {dispatchNotice}
          </div>
        ) : null}
      </div>
    </FeatureGate>
  );
}
