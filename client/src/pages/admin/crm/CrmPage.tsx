import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { computeEstimateTotalFromPyeong } from '@shared/estimateTotal';
import type { TelecrmAreaResolveResult } from '@shared/telecrmAreaResolve';
import { resolveTelecrmArea, saveTelecrmAreaCase } from '../../../api/telecrmQuoteCrewLearning';
import { CrmPyeongResolveHint } from '../../../components/crm/intake/CrmPyeongResolveHint';
import { getToken } from '../../../stores/auth';
import { useMarketerPermissions } from '../../../hooks/useMarketerPermissions';
import { useCrmInquiryEdit } from '../../../hooks/useCrmInquiryEdit';
import { fetchTelecrmPricingCatalog } from '../../../api/telecrm';
import { CrmShell } from '../../../components/crm/layout/CrmShell';
import { CrmContactHistoryDrawer } from '../../../components/crm/contact/CrmContactHistoryDrawer';
import { useCrmContactTimeline } from '../../../hooks/useCrmContactTimeline';
import {
  crmContactIdentityKey,
  type CrmContactIdentity,
} from '@shared/crmContactIdentity';
import { CrmIntakePanel, type CrmCustomerMode } from '../../../components/crm/intake/CrmIntakePanel';
import type { CrmIntakeSavedMeta } from '../../../components/crm/intake/CrmIntakeForm';
import { CrmScriptAiCenterPanel } from '../../../components/crm/scripts/CrmScriptAiCenterPanel';
import { CrmPricingPanel } from '../../../components/crm/pricing/CrmPricingPanel';
import { CrmSessionBar } from '../../../components/crm/session/CrmSessionBar';
import { CrmHeaderStats } from '../../../components/crm/session/CrmHeaderStats';
import { CrmToolSideNav, CrmIconMessage } from '../../../components/crm/layout/CrmToolSideNav';
import { CrmSmsDrawer } from '../../../components/crm/sms/CrmSmsDrawer';
import { CrmSoomgoDrawer } from '../../../components/crm/soomgo/CrmSoomgoDrawer';
import { CrmSoomgoStaleCleanupModal } from '../../../components/crm/soomgo/CrmSoomgoStaleCleanupModal';
import { CrmSoomgoAlertDrawer, CrmIconBell } from '../../../components/crm/soomgo/CrmSoomgoAlertDrawer';
import { CrmSoomgoTopBar } from '../../../components/crm/soomgo/CrmSoomgoTopBar';
import { CrmSoomgoUpdateStrip } from '../../../components/crm/soomgo/CrmSoomgoUpdateStrip';
import { CrmMisoTopBar } from '../../../components/crm/miso/CrmMisoTopBar';
import { CrmMisoDrawer } from '../../../components/crm/miso/CrmMisoDrawer';
import { CrmIconPhone, CrmIconMiso, CrmIconSoomgo, CrmIconReset } from '../../../components/crm/crmUi';
import { PageTitleWithFavorite } from '../../../components/layout/NavFavoritePageTitle';
import type { SoomgoExtractedChat, SoomgoBridgeManifest, SoomgoChatAlert, SoomgoChatListSnapshotRow } from '@shared/soomgoBridge';
import { useCrmSoomgoBridge } from '../../../hooks/useCrmSoomgoBridge';
import { useCrmSoomgoRoomLeave } from '../../../hooks/useCrmSoomgoRoomLeave';
import type { SoomgoSelfNavKind } from '../../../utils/crmSoomgoRoomLeave';
import { useCrmMisoBridge } from '../../../hooks/useCrmMisoBridge';
import { useSoomgoBridgeManifestRefresh } from '../../../hooks/useSoomgoBridgeManifestRefresh';
import { isMisoBridgeReachable } from '../../../api/misoBridge';
import { isSoomgoBridgeUpdateNoticeVisible, isSoomgoBridgeReachable, isSoomgoBridgeUseBlocked, SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE, soomgoBridgeOutdatedMessage } from '../../../api/soomgoBridge';
import { waitForSoomgoInChatRoom } from '../../../utils/crmSoomgoBridgeWait';
import { useTenantCapabilities } from '../../../hooks/useTenantCapabilities';
import { canAccessTelecrm, telecrmHasPlatform } from '../../../utils/telecrmDashboardAccess';
import { TelecrmAccessModal } from '../../../components/admin/TelecrmAccessModal';
import { CrmSettingsDrawer } from '../../../components/crm/settings/CrmSettingsDrawer';
import { CrmOrderIssueDrawer } from '../../../components/crm/issue/CrmOrderIssueDrawer';
import { CrmFollowupDrawer } from '../../../components/crm/followup/CrmFollowupDrawer';
import { CrmQuickScheduleDrawer } from '../../../components/crm/quick-schedule/CrmQuickScheduleDrawer';
import { CrmQuickScheduleCenterNotice } from '../../../components/crm/quick-schedule/CrmQuickScheduleCenterNotice';
import { buildQuickScheduleSnapshot } from '../../../components/crm/quick-schedule/quickScheduleSnapshot';
import { useCrmPanelUrl } from '../../../hooks/useCrmPanelUrl';
import { useTelecrmIncomingRingRealtime } from '../../../hooks/useInboxRealtime';
import type { CrmOrderIssueSeed } from '../../../components/orderform/OrderIssueInlinePanel';
import { crmIntakeRequiredPermission, resolveCrmIntakeCustomerName } from '../../../components/crm/intake/crmIntakeValidation';
import {
  isCrmSafePhone,
  isCrmMobilePhone,
  resolveCrmOutboundPhone,
  splitSoomgoPhones,
} from '../../../utils/crmContactPhone';
import type { CrmIntakeKind } from '../../../components/crm/intake/crmIntakeSubmit';
import {
  clearCrmIntakeDraft,
  clearCrmIntakeRecoverDraft,
  CRM_INTAKE_DRAFT_RECOVER_MS,
  crmIntakeDraftHasContent,
  isCrmIntakeDraftRecoverable,
  loadCrmIntakeDraft,
  loadCrmIntakeRecoverDraft,
  saveCrmIntakeDraft,
  saveCrmIntakeRecoverDraft,
  type CrmIntakeDraft,
  type CrmIntakeFormSnapshot,
} from '../../../utils/crmIntakeDraft';
import { Button } from '../../../components/ui/Button';
import { isTelecrmNativeApp } from '../../../utils/telecrmNativeBridge';
import { isRecentCrmOutboundCall, phonesMatchDigits } from '../../../utils/telecrmRecentOutbound';
import { CrmDispatchNotice } from '../../../components/ui/CrmDispatchNotice';
import {
  deriveSoomgoIntakeDefaults,
  formatSoomgoCountForCrm,
  resolveSoomgoAddress,
  resolveSoomgoPreferredDate,
  soomgoCustomerNameForIntake,
  soomgoImportNoticeText,
  summarizeSoomgoImport,
} from '../../../utils/crmSoomgoImport';
import {
  buildMisoRequestMemo,
  deriveMisoIntakeDefaults,
  misoImportNoticeText,
  parseMisoPyeong,
  resolveMisoPreferredDate,
  resolveMisoAddress,
  summarizeMisoImport,
} from '../../../utils/crmMisoImport';
import type { MisoExtractPayload } from '@shared/misoBridge';
import { BRIDGE_INQUIRY_LEAD_SOURCE_LABEL } from '@shared/inquiryLeadSourceDefaults';
import { useCrmConsultationQuote } from '../../../hooks/useCrmConsultationQuote';
import { telecrmQuotePayloadHasContent } from '@shared/telecrmConsultationQuote';
import {
  crmQuoteGrandTotalWon,
  crmQuoteLinesFromPayload,
  crmQuotePayloadFromState,
  crmQuoteProfessionalOptionIdsFromLines,
  type CrmPricingQuoteLine,
} from '../../../utils/crmConsultationQuoteMap';
import { buildCrmCoachQuote } from '../../../components/crm/scripts/crmCoachQuote';
import { linkTelecrmConsultationQuoteInquiry, recordTelecrmConsultationQuoteSent } from '../../../api/telecrmConsultationQuote';
import type { OrderForm } from '../../../api/orderform';
import { fitCrmPopupWindow, applyTelecrmSoomgoSplitLayout } from '../../../utils/crmSoomgoSplitLayout';
import { parseJwtPayload } from '../../../utils/jwtPayload';
import type { SoomgoInboxMessageRule } from '@shared/soomgoChatPreview';
import {
  dismissSoomgoInboxItems,
  loadSoomgoChatInbox,
  loadSoomgoInboxDismissals,
  pinnedSoomgoChatIds,
  reapplySoomgoInboxRules,
  saveSoomgoChatInbox,
  saveSoomgoInboxDismissals,
  syncSoomgoInboxFromScan,
  soomgoInboxPendingCount,
  toggleSoomgoInboxPin,
  upsertSoomgoChatAlerts,
  type CrmSoomgoInboxItem,
  type SoomgoInboxDismissSnapshot,
} from '../../../utils/crmSoomgoChatInbox';
import {
  loadSoomgoInboxRules,
  subscribeSoomgoInboxRulesChanged,
} from '../../../utils/crmSoomgoInboxRules';
import { arrangeSoomgoBridgeLayout } from '../../../api/soomgoBridge';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import { CrmWorkBrandBar } from '../../../components/crm/workBrand/CrmWorkBrandBar';
import {
  crmFollowupApplyFromItem,
  crmFollowupApplyFromLookupRow,
  followupIntakeExtrasNeedsSoomgoFill,
  mergeSoomgoIntoFollowupSnapshot,
  resolveSoomgoChatSearchLabel,
  resolveSoomgoChatSearchQuery,
  type CrmFollowupApplySnapshot,
} from '../../../utils/crmFollowupApply';
import { fetchOrderFollowup, type OrderFollowupItem } from '../../../api/orderFollowups';
import type { TelecrmCustomerLookupDto } from '../../../api/telecrm';
import { useCrmPropertyChoiceOptions } from '../../../components/crm/intake/useCrmPropertyChoiceOptions';
import { matchCrmImportedPropertyChoice } from '../../../utils/crmPropertyChoiceMatch';
import {
  noticeForSoomgoQuoteAutoSend,
  sendSoomgoQuoteAutoMessage,
} from '../../../utils/soomgoQuoteAutoSend';
import { useAdminStaffSession } from '../../../hooks/useAdminStaffSession';
import {
  forgetCrmQuickScheduleTab,
  isCrmQuickScheduleResponder,
  noteCrmQuickScheduleTab,
  postCrmQuickSchedule,
  subscribeCrmQuickSchedule,
} from '../../../utils/crmQuickScheduleChannel';
import { openCrmQuickScheduleWindow } from '../../../utils/openCrmQuickScheduleWindow';

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
  const canEditLeadSources = permissions.has('orderform.formConfig');
  const canOpenSettings = canSharedSettings || canPersonalCatalog || canEditLeadSources;
  const canOrderIssue =
    permissions.me?.role === 'ADMIN' || permissions.has('orderform.issue');
  const canFollowupEdit =
    permissions.me?.role === 'ADMIN' || permissions.has('followup.edit');
  const canAdsSession = permissions.has('ads.sessions');
  const canView =
    permissions.me?.role === 'ADMIN' ||
    canAccessAdminPath(permissions.me?.role, permissions.permissions, '/admin/crm');

  const { telecrm, features, tenantSlug } = useTenantCapabilities();
  const soomgoPlatformEnabled = telecrmHasPlatform(telecrm, 'soomgo');
  const misoPlatformEnabled = telecrmHasPlatform(telecrm, 'miso');

  const {
    loading: workBrandLoading,
    items: workBrandItems,
    active: workBrandActive,
    activeOperatingCompanyId,
    switchBrand,
    showSwitcher: showWorkBrandSwitcher,
  } = useCrmWorkBrand();

  const [mode, setMode] = useState<CrmCustomerMode>('new');
  const [contactPhone, setContactPhone] = useState('');
  const [safePhone, setSafePhone] = useState('');
  const [contactUnknown, setContactUnknown] = useState(false);
  const outboundPhone = useMemo(
    () => resolveCrmOutboundPhone(contactPhone, safePhone),
    [contactPhone, safePhone],
  );
  const [customerName, setCustomerName] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [areaImport, setAreaImport] = useState<{ raw: string; key: number } | null>(null);
  const [areaResult, setAreaResult] = useState<TelecrmAreaResolveResult | null>(null);
  const [areaLocked, setAreaLocked] = useState(false);
  const areaLockedRef = useRef(false);
  const areaSaveTimerRef = useRef<number | null>(null);
  const { userName: crmMarketerName } = useAdminStaffSession();
  const [quoteLines, setQuoteLines] = useState<CrmPricingQuoteLine[]>([]);
  const [intakeKind, setIntakeKind] = useState<CrmIntakeKind>('absent');
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [minimumTotalAmount, setMinimumTotalAmount] = useState(0);
  const [baseEstimateOverrideWon, setBaseEstimateOverrideWon] = useState<number | null>(null);
  const [intakeStructure, setIntakeStructure] = useState<{
    roomCount: string;
    bathroomCount: string;
    balconyCount: string;
    propertyType?: string;
    buildingType?: string;
    isOneRoom?: boolean;
  }>({
    roomCount: '',
    bathroomCount: '',
    balconyCount: '',
  });
  /** 숨고·미소 글을 발주서 선택지로 맞출 때 씀 — 콜백 deps 를 늘리지 않으려고 ref 로 둠 */
  const propertyChoiceOptions = useCrmPropertyChoiceOptions();
  const propertyChoiceOptionsRef = useRef(propertyChoiceOptions);
  propertyChoiceOptionsRef.current = propertyChoiceOptions;
  const [pricingResetKey, setPricingResetKey] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [lookupRefreshKey, setLookupRefreshKey] = useState(0);
  const [intakeIdentity, setIntakeIdentity] = useState<CrmContactIdentity>({
    customerName: '',
    nickname: '',
    address: '',
  });
  const [contactHistoryOpen, setContactHistoryOpen] = useState(false);
  const contactHistoryDismissedKeyRef = useRef<string | null>(null);
  const {
    items: contactTimelineItems,
    loading: contactTimelineLoading,
    error: contactTimelineError,
    canSearch: contactTimelineCanSearch,
  } = useCrmContactTimeline(intakeIdentity, {
    phone: outboundPhone,
    phone2: safePhone,
    operatingCompanyId: activeOperatingCompanyId,
    enabled: Boolean(activeOperatingCompanyId),
    refreshKey: lookupRefreshKey,
  });
  const contactIdentityKey = crmContactIdentityKey(intakeIdentity);
  const contactTimelineActiveCount = contactTimelineItems.filter((it) => it.active).length;

  useEffect(() => {
    contactHistoryDismissedKeyRef.current = null;
  }, [contactIdentityKey]);

  useEffect(() => {
    if (!contactTimelineCanSearch || contactTimelineItems.length === 0) {
      setContactHistoryOpen(false);
      return;
    }
    if (contactHistoryDismissedKeyRef.current === contactIdentityKey) return;
    setContactHistoryOpen(true);
  }, [contactTimelineCanSearch, contactTimelineItems.length, contactIdentityKey]);

  const [initialFormDraft, setInitialFormDraft] = useState<Partial<CrmIntakeFormSnapshot> | null>(null);
  const [draftRestoredPhone, setDraftRestoredPhone] = useState<string | null>(null);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [quickPopupBlocked, setQuickPopupBlocked] = useState(false);
  const [dispatchNoticeAction, setDispatchNoticeAction] = useState<{
    label: string;
    run: () => void;
  } | null>(null);
  const [crmContext, setCrmContext] = useState<{
    inquiryId: string | null;
    customerMatch: 'new' | 'existing' | 'pick' | 'unknown';
  }>({ inquiryId: null, customerMatch: 'new' });
  const [formResetKey, setFormResetKey] = useState(0);
  const [soomgoImportBanner, setSoomgoImportBanner] = useState<string | null>(null);
  const [soomgoImportFlashKey, setSoomgoImportFlashKey] = useState(0);
  const [soomgoHiredOther, setSoomgoHiredOther] = useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [smsDrawerOpen, setSmsDrawerOpen] = useState(false);
  const [soomgoDrawerOpen, setSoomgoDrawerOpen] = useState(false);
  const [misoDrawerOpen, setMisoDrawerOpen] = useState(false);
  const [soomgoAlertDrawerOpen, setSoomgoAlertDrawerOpen] = useState(false);
  const [soomgoStaleCleanupOpen, setSoomgoStaleCleanupOpen] = useState(false);
  const [soomgoStaleCleanupRunning, setSoomgoStaleCleanupRunning] = useState(false);
  const [soomgoInboxItems, setSoomgoInboxItems] = useState<CrmSoomgoInboxItem[]>([]);
  const [soomgoInboxRefreshing, setSoomgoInboxRefreshing] = useState(false);
  const [soomgoInboxDismissals, setSoomgoInboxDismissals] = useState<
    Map<string, SoomgoInboxDismissSnapshot>
  >(new Map());
  const [soomgoInboxRules, setSoomgoInboxRules] = useState<SoomgoInboxMessageRule[]>([]);
  const [soomgoQuoteSending, setSoomgoQuoteSending] = useState(false);
  const [soomgoBridgeManifest, setSoomgoBridgeManifest] = useState<SoomgoBridgeManifest | null>(null);
  const [followupImportKey, setFollowupImportKey] = useState(0);
  const [followupImport, setFollowupImport] = useState<{
    key: number;
    snapshot: CrmFollowupApplySnapshot;
  } | null>(null);
  const followupSoomgoAutoRef = useRef(0);
  const followupSoomgoMergeRef = useRef<CrmFollowupApplySnapshot | null>(null);
  const applyFollowupFieldsRef = useRef<
    (snapshot: CrmFollowupApplySnapshot, opts?: { closeDrawer?: boolean; notice?: string; extractPlatform?: 'soomgo' }) => void
  >(() => {});
  const dispatchNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftReadyRef = useRef(false);
  const formSnapshotRef = useRef<CrmIntakeFormSnapshot | null>(null);
  const quickBridgeRef = useRef<{
    applyItem: (item: OrderFollowupItem) => void;
    applySnapshot: (
      snapshot: CrmFollowupApplySnapshot,
      opts?: { closeDrawer?: boolean; notice?: string },
    ) => void;
    notice: (message: string, action?: { label: string; run: () => void } | null) => void;
    isBusy: () => boolean;
  } | null>(null);
  /** 「이전 입력 복구」 — 10분 안의 내 초안(화면에는 바로 넣지 않음) */
  const [recoverableDraft, setRecoverableDraft] = useState<CrmIntakeDraft | null>(null);
  /** 접수란 내용이 속한 숨고 채팅방(가져오기·빈 접수란에서 방 진입 시) */
  const lastIntakeChatIdRef = useRef<string | null>(null);
  /** 기존 고객 찾기로 숨고 채팅방을 연 고객 — 같은 고객을 다시 불러와도 또 이동하지 않게 */
  const lookupChatOpenedKeyRef = useRef<string | null>(null);
  /** CRM이 숨고 창을 옮긴 직후 12초. 다른 방으로 연 것만 접수란 비우기에서 뺀다. */
  const soomgoSelfNavRef = useRef<{ until: number; kind: SoomgoSelfNavKind } | null>(null);
  const [soomgoLeaveNotice, setSoomgoLeaveNotice] = useState<string | null>(null);

  const resetQuotePricingState = useCallback(() => {
    setQuoteLines([]);
    setBaseEstimateOverrideWon(null);
    setPricingResetKey((k) => k + 1);
  }, []);

  const handleWorkBrandSwitch = useCallback(
    (slug: string) => {
      switchBrand(slug);
      setLookupRefreshKey((k) => k + 1);
      resetQuotePricingState();
    },
    [switchBrand, resetQuotePricingState],
  );

  const pricingContextPhoneRef = useRef('');
  useEffect(() => {
    const digits = outboundPhone.replace(/\D/g, '');
    if (digits.length >= 8) {
      if (pricingContextPhoneRef.current && pricingContextPhoneRef.current !== digits) {
        resetQuotePricingState();
      }
      pricingContextPhoneRef.current = digits;
      return;
    }
    if (digits.length === 0) {
      pricingContextPhoneRef.current = '';
    }
  }, [outboundPhone, resetQuotePricingState]);

  const {
    settingsTab,
    catalogScope,
    pendingInquiryId: issuePendingInquiryId,
    isSettingsOpen,
    isIssueOpen,
    isFollowupOpen,
    followupId: panelFollowupId,
    openSettings,
    openIssue,
    openFollowup,
    openHotFollowups,
    openQuickSchedule,
    isQuickOpen,
    quickTab,
    setQuickTab,
    setFollowupId,
    closePanel,
    setSettingsTab,
    setCatalogScope,
    soomgoBarOpen,
    setSoomgoBarOpen,
    misoBarOpen,
    setMisoBarOpen,
  } = useCrmPanelUrl();

  const { openInquiryEdit, layer: inquiryEditLayer } = useCrmInquiryEdit(canView, () => {
    setLookupRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    document.title = '텔레CRM — SK클린텍';
  }, []);

  const { refreshManifest } = useSoomgoBridgeManifestRefresh(Boolean(getToken()), setSoomgoBridgeManifest);

  useEffect(() => {
    /* 새로 열면 항상 빈 접수란(신규)으로 시작 — 10분 안의 내 초안만 「이전 입력 복구」로 제안 */
    const candidates = [loadCrmIntakeDraft(), loadCrmIntakeRecoverDraft()].filter(
      (d): d is CrmIntakeDraft => isCrmIntakeDraftRecoverable(d, {}),
    );
    candidates.sort((a, b) => b.savedAt - a.savedAt);
    const pick = candidates[0] ?? null;
    clearCrmIntakeDraft();
    if (pick) {
      saveCrmIntakeRecoverDraft(pick);
      setRecoverableDraft(pick);
    } else {
      clearCrmIntakeRecoverDraft();
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
        contactPhone,
        safePhone,
        contactUnknown,
        pyeong,
        ...form,
        operatingCompanyId: activeOperatingCompanyId ?? null,
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
    [mode, contactPhone, safePhone, contactUnknown, pyeong, activeOperatingCompanyId],
  );

  useEffect(() => {
    if (!draftReadyRef.current) return;
    const form = formSnapshotRef.current;
    if (!form) {
      const partial = {
        mode,
        contactPhone,
        safePhone,
        contactUnknown,
        pyeong,
        customerName,
        savedAt: Date.now(),
      };
      if (crmIntakeDraftHasContent(partial)) {
        saveCrmIntakeDraft({
          mode,
          contactPhone,
          safePhone,
          contactUnknown,
          pyeong,
          customerName,
          nickname: '',
          address: '',
          preferredMoveInCleanYmd: '',
          requestMemo: '',
          roomCount: '',
          bathroomCount: '',
          balconyCount: '',
          kind: 'absent',
          goldDb: false,
          leadSource: '',
          operatingCompanyId: activeOperatingCompanyId ?? null,
          savedAt: Date.now(),
        });
        setHasUnsavedDraft(true);
      }
      return;
    }
    persistDraft(form);
  }, [mode, contactPhone, safePhone, contactUnknown, pyeong, customerName, persistDraft, activeOperatingCompanyId]);

  /** 지금 접수란 내용 → 초안(복구용) */
  const buildCurrentIntakeDraft = useCallback((): CrmIntakeDraft | null => {
    const form = formSnapshotRef.current;
    const draft: CrmIntakeDraft = {
      mode,
      contactPhone,
      safePhone,
      contactUnknown,
      pyeong,
      customerName: form?.customerName ?? customerName,
      nickname: form?.nickname ?? '',
      address: form?.address ?? '',
      preferredMoveInCleanYmd: form?.preferredMoveInCleanYmd ?? '',
      requestMemo: form?.requestMemo ?? '',
      roomCount: form?.roomCount ?? '',
      bathroomCount: form?.bathroomCount ?? '',
      balconyCount: form?.balconyCount ?? '',
      kind: form?.kind ?? intakeKind,
      goldDb: form?.goldDb ?? false,
      leadSource: form?.leadSource ?? '',
      extractPlatform: form?.extractPlatform,
      operatingCompanyId: activeOperatingCompanyId ?? null,
      savedAt: Date.now(),
    };
    return crmIntakeDraftHasContent(draft) ? draft : null;
  }, [mode, contactPhone, safePhone, contactUnknown, pyeong, customerName, intakeKind, activeOperatingCompanyId]);

  const dismissRecoverableDraft = useCallback(() => {
    setRecoverableDraft(null);
    clearCrmIntakeRecoverDraft();
  }, []);

  /** 「이전 입력 복구」 배너 — 저장 시각 기준 10분 뒤 자동으로 숨김 */
  useEffect(() => {
    if (!recoverableDraft) return;
    const left = recoverableDraft.savedAt + CRM_INTAKE_DRAFT_RECOVER_MS - Date.now();
    if (left <= 0) {
      dismissRecoverableDraft();
      return;
    }
    const timer = window.setTimeout(dismissRecoverableDraft, left);
    return () => window.clearTimeout(timer);
  }, [recoverableDraft, dismissRecoverableDraft]);

  const recoverableDraftVisible = Boolean(
    recoverableDraft &&
      (!activeOperatingCompanyId ||
        !recoverableDraft.operatingCompanyId ||
        recoverableDraft.operatingCompanyId === activeOperatingCompanyId),
  );

  const handleFormChange = useCallback(
    (snapshot: CrmIntakeFormSnapshot) => {
      formSnapshotRef.current = snapshot;
      setIntakeStructure({
        roomCount: snapshot.roomCount,
        bathroomCount: snapshot.bathroomCount,
        balconyCount: snapshot.balconyCount,
        propertyType: snapshot.propertyType ?? '',
        buildingType: snapshot.buildingType ?? '',
        isOneRoom: snapshot.isOneRoom === true,
      });
      setIntakeIdentity({
        customerName: snapshot.customerName,
        nickname: snapshot.nickname,
        address: snapshot.address,
      });
      if (snapshot.customerName !== customerName) setCustomerName(snapshot.customerName);
      if (snapshot.kind !== intakeKind) setIntakeKind(snapshot.kind);
      persistDraft(snapshot);
    },
    [customerName, intakeKind, persistDraft],
  );

  const onUserPyeong = useCallback((value: string) => {
    areaLockedRef.current = true;
    setAreaLocked(true);
    setPyeong(value);
    const amount = Number(value);
    const address = intakeIdentity.address.trim();
    const customerValue = areaResult?.customerValue;
    if (areaSaveTimerRef.current != null) window.clearTimeout(areaSaveTimerRef.current);
    if (!(amount > 0) || !address || customerValue == null) return;
    areaSaveTimerRef.current = window.setTimeout(() => {
      const token = getToken();
      if (!token || areaLockedRef.current !== true) return;
      void saveTelecrmAreaCase(token, {
        address,
        customerValue,
        customerMark: areaResult?.customerMark,
        supplyPyeong: amount,
        operatingCompanyId: activeOperatingCompanyId,
      }).catch(() => undefined);
    }, 800);
  }, [activeOperatingCompanyId, areaResult, intakeIdentity.address]);

  const pickAreaPyeong = useCallback(
    (value: number) => {
      areaLockedRef.current = true;
      setAreaLocked(true);
      setPyeong(String(value));
      setAreaResult((prev) =>
        prev ? { ...prev, status: '확정', pyeong: value, reason: '상담사가 고른 평수예요.', candidates: [] } : prev,
      );
      const token = getToken();
      const address = intakeIdentity.address.trim();
      const customerValue = areaResult?.customerValue;
      if (!token || !address || customerValue == null) return;
      void saveTelecrmAreaCase(token, {
        address,
        customerValue,
        customerMark: areaResult?.customerMark,
        supplyPyeong: value,
        operatingCompanyId: activeOperatingCompanyId,
      }).catch(() => undefined);
    },
    [activeOperatingCompanyId, areaResult, intakeIdentity.address],
  );

  useEffect(() => {
    if (!areaImport?.raw.trim() || areaLocked) return;
    const token = getToken();
    if (!token) return;
    const timer = window.setTimeout(() => {
      void resolveTelecrmArea(token, {
        raw: areaImport.raw,
        buildingType: intakeStructure.buildingType,
        address: intakeIdentity.address,
        operatingCompanyId: activeOperatingCompanyId,
      })
        .then((res) => {
          if (areaLockedRef.current) return;
          setAreaResult(res);
          if (res.status === '확정' && res.pyeong != null) setPyeong(String(res.pyeong));
          else setPyeong('');
        })
        .catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [areaImport, areaLocked, intakeStructure.buildingType, intakeIdentity.address, activeOperatingCompanyId]);

  const pyeongNote = (
    <CrmPyeongResolveHint
      result={areaResult}
      locked={areaLocked}
      pricePerPyeong={pricePerPyeong}
      minimumTotalAmount={minimumTotalAmount}
      quoteContext={{
        roomCount: intakeStructure.roomCount,
        bathroomCount: intakeStructure.bathroomCount,
        balconyCount: intakeStructure.balconyCount,
        propertyType: intakeStructure.propertyType,
        isOneRoom: intakeStructure.isOneRoom,
        operatingCompanyId: activeOperatingCompanyId,
      }}
      onPick={pickAreaPyeong}
    />
  );

  const handleModeChange = useCallback(
    (next: CrmCustomerMode) => {
      if (next === 'new') {
        resetQuotePricingState();
        setContactPhone('');
        setSafePhone('');
        setContactUnknown(false);
        setFollowupImport(null);
        setIntakeKind('absent');
        setIntakeStructure({
          roomCount: '',
          bathroomCount: '',
          balconyCount: '',
        });
        clearCrmIntakeDraft();
        setHasUnsavedDraft(false);
        setFormResetKey((k) => k + 1);
        setCustomerName('');
        setPyeong('');
        setInitialFormDraft({
          customerName: '',
          nickname: '',
          address: '',
          preferredMoveInCleanYmd: '',
          requestMemo: '',
          roomCount: '',
          bathroomCount: '',
          balconyCount: '',
          propertyType: '',
          buildingType: '',
          isOneRoom: false,
          oneRoomLoft: null,
          oneRoomSlidingPartition: null,
          structureBalconyNonExpanded: null,
          structurePartitionWall: null,
          structureOutdoorTerrace: null,
          kind: 'absent',
          goldDb: false,
          leadSource: '',
        });
      }
      setMode(next);
    },
    [resetQuotePricingState],
  );

  const showDispatchNotice = useCallback((message: string, action?: { label: string; run: () => void } | null) => {
    setDispatchNotice(message);
    setDispatchNoticeAction(action ?? null);
    if (dispatchNoticeTimer.current) clearTimeout(dispatchNoticeTimer.current);
    dispatchNoticeTimer.current = setTimeout(() => {
      setDispatchNotice(null);
      setDispatchNoticeAction(null);
    }, action ? 20000 : 4000);
  }, []);

  const handleOpenQuickSchedule = useCallback(() => {
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    if (isMobileApp || narrow || !activeOperatingCompanyId) {
      openQuickSchedule();
      return;
    }
    const popup = openCrmQuickScheduleWindow(activeOperatingCompanyId);
    if (!popup) {
      openQuickSchedule();
      setQuickPopupBlocked(true);
    }
  }, [activeOperatingCompanyId, isMobileApp, openQuickSchedule]);

  const quickScheduleTabIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const tabId = quickScheduleTabIdRef.current;
    const beat = () => noteCrmQuickScheduleTab(tabId, document.hasFocus());
    beat();
    window.addEventListener('focus', beat);
    const timer = window.setInterval(beat, 2000);
    const onLeave = () => forgetCrmQuickScheduleTab(tabId);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('focus', beat);
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', onLeave);
      forgetCrmQuickScheduleTab(tabId);
    };
  }, []);

  useEffect(() => {
    if (!activeOperatingCompanyId) return;
    postCrmQuickSchedule({ type: 'brand', operatingCompanyId: activeOperatingCompanyId });
  }, [activeOperatingCompanyId]);

  useEffect(() => {
    return subscribeCrmQuickSchedule((message) => {
      if (message.type !== 'apply') return;
      if (!isCrmQuickScheduleResponder(quickScheduleTabIdRef.current)) return;
      postCrmQuickSchedule({ type: 'received', requestId: message.requestId });
      const run = async () => {
        const bridge = quickBridgeRef.current;
        if (!bridge) {
          postCrmQuickSchedule({
            type: 'failed',
            requestId: message.requestId,
            message: '텔레CRM 창이 아직 준비되지 않았어요.',
          });
          return;
        }
        try {
          if (message.item.followup) {
            const token = getToken();
            if (!token) {
              postCrmQuickSchedule({
                type: 'failed',
                requestId: message.requestId,
                message: '로그인이 필요해요.',
              });
              return;
            }
            const res = await fetchOrderFollowup(token, message.item.followup.id);
            bridge.applyItem(res.item);
          } else {
            bridge.applySnapshot(buildQuickScheduleSnapshot(message.item), {
              closeDrawer: false,
              notice: '빠른일정 고객을 접수란으로 가져왔습니다.',
            });
          }
          postCrmQuickSchedule({ type: 'applied', requestId: message.requestId, id: message.item.id });
        } catch (e) {
          postCrmQuickSchedule({
            type: 'failed',
            requestId: message.requestId,
            message: e instanceof Error ? e.message : '빠른일정 고객을 불러오지 못했습니다.',
          });
        }
      };
      const bridge = quickBridgeRef.current;
      if (!bridge) {
        postCrmQuickSchedule({
          type: 'failed',
          requestId: message.requestId,
          message: '텔레CRM 창이 아직 준비되지 않았어요.',
        });
        return;
      }
      if (bridge.isBusy() && message.force !== true) {
        postCrmQuickSchedule({ type: 'confirm', requestId: message.requestId, id: message.item.id });
        return;
      }
      void run();
    });
  }, []);

  const applyMobileIncomingRing = useCallback(
    (payload: { phone: string; customerName?: string | null; inquiryStatus?: string | null }) => {
      const digits = payload.phone.replace(/\D/g, '');
      if (digits.length < 4) return;
      if (isRecentCrmOutboundCall(digits)) return;
      const name = payload.customerName?.trim();
      if (phonesMatchDigits(digits, contactPhone) || phonesMatchDigits(digits, safePhone)) {
        showDispatchNotice(`휴대폰 통화 중 · ${name || customerName.trim() || '고객'}`);
        return;
      }
      const formatted =
        digits.length === 11 && digits.startsWith('010')
          ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
          : digits;
      const form = formSnapshotRef.current;
      const intakeBusy =
        Boolean(followupImport) ||
        quoteLines.length > 0 ||
        baseEstimateOverrideWon != null ||
        hasUnsavedDraft ||
        crmIntakeDraftHasContent({
          contactPhone,
          safePhone,
          customerName,
          pyeong,
          nickname: form?.nickname,
          address: form?.address,
          preferredMoveInCleanYmd: form?.preferredMoveInCleanYmd,
          requestMemo: form?.requestMemo,
          leadSource: form?.leadSource,
          roomCount: form?.roomCount,
          bathroomCount: form?.bathroomCount,
          balconyCount: form?.balconyCount,
          propertyType: form?.propertyType,
          buildingType: form?.buildingType,
          isOneRoom: form?.isOneRoom,
        });
      const fill = () => {
        resetQuotePricingState();
        setMode('existing');
        setContactPhone(isCrmMobilePhone(digits) || isCrmSafePhone(digits) ? formatted : digits);
        setSafePhone('');
        setContactUnknown(false);
        setFollowupImport(null);
        setLookupRefreshKey((k) => k + 1);
        const noticeParts = ['휴대폰 수신', name || formatted];
        if (payload.inquiryStatus) noticeParts.push(payload.inquiryStatus);
        showDispatchNotice(noticeParts.join(' · '));
      };
      if (intakeBusy) {
        showDispatchNotice(`휴대폰 수신 · ${name || formatted}`, { label: '불러오기', run: fill });
        return;
      }
      fill();
    },
    [
      baseEstimateOverrideWon,
      contactPhone,
      customerName,
      followupImport,
      hasUnsavedDraft,
      pyeong,
      quoteLines.length,
      resetQuotePricingState,
      safePhone,
      showDispatchNotice,
    ],
  );

  useTelecrmIncomingRingRealtime(
    getToken(),
    applyMobileIncomingRing,
    Boolean(canView && telecrm && canAccessTelecrm(telecrm)),
  );

  const authUserId = useMemo(() => {
    const token = getToken();
    if (!token) return null;
    return parseJwtPayload<{ userId?: string }>(token)?.userId ?? null;
  }, []);

  const workBrandSlug = workBrandActive?.slug ?? null;

  useEffect(() => {
    if (!authUserId) {
      setSoomgoInboxItems([]);
      setSoomgoInboxDismissals(new Map());
      setSoomgoInboxRules([]);
      return;
    }
    const rules = loadSoomgoInboxRules(authUserId, workBrandSlug);
    setSoomgoInboxRules(rules);
    setSoomgoInboxItems(reapplySoomgoInboxRules(loadSoomgoChatInbox(authUserId, workBrandSlug), rules));
    setSoomgoInboxDismissals(loadSoomgoInboxDismissals(authUserId, workBrandSlug));
  }, [authUserId, workBrandSlug]);

  useEffect(() => {
    if (!authUserId) return;
    return subscribeSoomgoInboxRulesChanged(({ userId, brandSlug }) => {
      if (userId !== authUserId) return;
      if ((brandSlug ?? null) !== workBrandSlug) return;
      const rules = loadSoomgoInboxRules(authUserId, workBrandSlug);
      setSoomgoInboxRules(rules);
      setSoomgoInboxItems((prev) => {
        const next = reapplySoomgoInboxRules(prev, rules);
        saveSoomgoChatInbox(authUserId, workBrandSlug, next);
        return next;
      });
    });
  }, [authUserId, workBrandSlug]);

  const handleSoomgoChatAlerts = useCallback(
    (alerts: SoomgoChatAlert[]) => {
      if (alerts.length === 0) return;
      setSoomgoInboxItems((prev) => {
        const { items, added, bumped } = upsertSoomgoChatAlerts(prev, alerts, soomgoInboxRules);
        if (authUserId) saveSoomgoChatInbox(authUserId, workBrandSlug, items);
        const notifyRows = [...added, ...bumped];
        if (notifyRows.length > 0) {
          const head = notifyRows[0];
          const name = head.customerName ?? '고객';
          const preview = head.previewText.length > 36 ? `${head.previewText.slice(0, 36)}…` : head.previewText;
          showDispatchNotice(
            notifyRows.length === 1
              ? `숨고 알림 · ${name}: ${preview}`
              : `숨고 알림 ${notifyRows.length}건 · ${name} 외`,
          );
        }
        return items;
      });
    },
    [authUserId, showDispatchNotice, soomgoInboxRules, workBrandSlug],
  );

  const handleSoomgoChatListSnapshot = useCallback(
    (rows: SoomgoChatListSnapshotRow[]) => {
      if (rows.length === 0) return;
      setSoomgoInboxItems((prev) => {
        const next = syncSoomgoInboxFromScan(prev, rows, soomgoInboxDismissals, soomgoInboxRules);
        if (
          next.length === prev.length &&
          next.every(
            (row, i) =>
              row.chatId === prev[i]?.chatId &&
              row.previewText === prev[i]?.previewText &&
              row.unreadCount === prev[i]?.unreadCount &&
              row.highlighted === prev[i]?.highlighted,
          )
        ) {
          return prev;
        }
        if (authUserId) saveSoomgoChatInbox(authUserId, workBrandSlug, next);
        return next;
      });
    },
    [authUserId, soomgoInboxDismissals, soomgoInboxRules, workBrandSlug],
  );

  const soomgoInboxPinnedChatIds = useMemo(
    () => pinnedSoomgoChatIds(soomgoInboxItems),
    [soomgoInboxItems],
  );

  const soomgoInboxPendingCountValue = useMemo(
    () => soomgoInboxPendingCount(soomgoInboxItems),
    [soomgoInboxItems],
  );

  const resetIntakeFormState = useCallback(
    (notice?: string | null) => {
      resetQuotePricingState();
      setContactPhone('');
      setSafePhone('');
      setContactUnknown(false);
      setCustomerName('');
      setPyeong('');
      setAreaImport(null);
      setAreaResult(null);
      areaLockedRef.current = true;
      setAreaLocked(true);
      setMode('new');
      setIntakeKind('absent');
      setFormResetKey((k) => k + 1);
      setInitialFormDraft({
        customerName: '',
        nickname: '',
        address: '',
        preferredMoveInCleanYmd: '',
        requestMemo: '',
        roomCount: '',
        bathroomCount: '',
        balconyCount: '',
        propertyType: '',
        buildingType: '',
        isOneRoom: false,
        oneRoomLoft: null,
        oneRoomSlidingPartition: null,
        structureBalconyNonExpanded: null,
        structurePartitionWall: null,
        structureOutdoorTerrace: null,
        kind: 'absent',
        goldDb: false,
        leadSource: '',
      });
      setSoomgoImportBanner(null);
      setSoomgoImportFlashKey(0);
      setSoomgoHiredOther(false);
      setFollowupImport(null);
      clearCrmIntakeDraft();
      setHasUnsavedDraft(false);
      formSnapshotRef.current = null;
      pricingContextPhoneRef.current = '';
      lastIntakeChatIdRef.current = null;
      lookupChatOpenedKeyRef.current = null;
      if (notice) showDispatchNotice(notice);
    },
    [resetQuotePricingState, showDispatchNotice],
  );

  const handleIntakeReset = useCallback(() => {
    resetIntakeFormState('접수란을 초기화했습니다.');
  }, [resetIntakeFormState]);

  /** 「이전 입력 복구」 — 신규로 넣되, 기존 고객으로 쓰던 연락처가 있으면 기존 고객 조회로 */
  const applyRecoverableDraft = useCallback(() => {
    const draft = recoverableDraft;
    if (!draft) return;
    const restoredContact = (draft.contactPhone ?? draft.phone ?? '').trim();
    const restoredSafe = (draft.safePhone ?? '').trim();
    const restoreMode: CrmCustomerMode =
      draft.mode === 'existing' && (restoredContact || restoredSafe) ? 'existing' : 'new';
    resetQuotePricingState();
    setFollowupImport(null);
    setSoomgoImportBanner(null);
    setMode(restoreMode);
    setContactPhone(restoredContact);
    setSafePhone(restoredSafe);
    setContactUnknown(Boolean(draft.contactUnknown ?? draft.phoneUnknown));
    setCustomerName(draft.customerName);
    setPyeong(draft.pyeong);
    setIntakeKind(draft.kind);
    setIntakeStructure({
      roomCount: draft.roomCount ?? '',
      bathroomCount: draft.bathroomCount ?? '',
      balconyCount: draft.balconyCount ?? '',
      propertyType: draft.propertyType ?? '',
      buildingType: draft.buildingType ?? '',
      isOneRoom: draft.isOneRoom === true,
    });
    setInitialFormDraft({
      customerName: draft.customerName,
      nickname: draft.nickname,
      address: draft.address,
      preferredMoveInCleanYmd: draft.preferredMoveInCleanYmd,
      requestMemo: draft.requestMemo ?? '',
      roomCount: draft.roomCount ?? '',
      bathroomCount: draft.bathroomCount ?? '',
      balconyCount: draft.balconyCount ?? '',
      propertyType: draft.propertyType ?? '',
      buildingType: draft.buildingType ?? '',
      isOneRoom: draft.isOneRoom === true,
      oneRoomLoft: draft.isOneRoom ? (draft.oneRoomLoft ?? null) : null,
      oneRoomSlidingPartition: draft.isOneRoom ? (draft.oneRoomSlidingPartition ?? null) : null,
      structureBalconyNonExpanded: draft.structureBalconyNonExpanded ?? null,
      structurePartitionWall: draft.structurePartitionWall ?? null,
      structureOutdoorTerrace: draft.structureOutdoorTerrace ?? null,
      kind: draft.kind,
      goldDb: draft.goldDb,
      leadSource: draft.leadSource ?? '',
      extractPlatform: draft.extractPlatform,
    });
    const dial = restoredContact || restoredSafe;
    if (dial) setDraftRestoredPhone(dial);
    setHasUnsavedDraft(true);
    setRecoverableDraft(null);
    clearCrmIntakeRecoverDraft();
    showDispatchNotice('이전에 입력하던 내용을 되살렸어요.');
  }, [recoverableDraft, resetQuotePricingState, showDispatchNotice]);

  const handleSoomgoImport = useCallback(
    (data: SoomgoExtractedChat) => {
      if (data.chatId?.trim()) lastIntakeChatIdRef.current = data.chatId.trim();
      const mergeBase = followupSoomgoMergeRef.current;
      if (mergeBase) {
        followupSoomgoMergeRef.current = null;
        const mergedBase = mergeSoomgoIntoFollowupSnapshot(mergeBase, data);
        const mergedChoice = matchCrmImportedPropertyChoice(propertyChoiceOptionsRef.current, [
          data.buildingType,
          data.serviceType,
        ]);
        const merged = {
          ...mergedBase,
          propertyType: mergedBase.propertyType?.trim() || mergedChoice.propertyType,
          buildingType: mergedBase.buildingType?.trim() || mergedChoice.buildingType,
          isOneRoom: mergedBase.isOneRoom === true || mergedChoice.isOneRoom,
          oneRoomLoft:
            mergedBase.isOneRoom === true || mergedChoice.isOneRoom ? (mergedBase.oneRoomLoft ?? null) : null,
          oneRoomSlidingPartition:
            mergedBase.isOneRoom === true || mergedChoice.isOneRoom
              ? (mergedBase.oneRoomSlidingPartition ?? null)
              : null,
          structureBalconyNonExpanded: mergedBase.structureBalconyNonExpanded ?? null,
          structurePartitionWall: mergedBase.structurePartitionWall ?? null,
          structureOutdoorTerrace: mergedBase.structureOutdoorTerrace ?? null,
        };
        const summary = summarizeSoomgoImport(data);
        setSoomgoImportBanner(
          summary.lines.length > 0
            ? `부재·보류 + 숨고\n${summary.lines.join('\n')}`
            : '숨고에서 가져온 추가 필드를 반영했습니다.',
        );
        setIntakeStructure({
          roomCount: merged.roomCount,
          bathroomCount: merged.bathroomCount,
          balconyCount: merged.balconyCount,
          propertyType: merged.propertyType,
          buildingType: merged.buildingType,
          isOneRoom: merged.isOneRoom,
        });
        applyFollowupFieldsRef.current(merged, {
          closeDrawer: false,
          notice: soomgoImportNoticeText(summary, {
            safePhoneSkipped: data.safePhoneSkipped,
            phoneConsultPending: data.phoneConsultPending,
            phoneConsultAction: data.phoneConsultAction,
          }),
          extractPlatform: 'soomgo',
        });
        setSoomgoHiredOther(data.hiredOther === true);
        return;
      }

      resetQuotePricingState();
      const split = splitSoomgoPhones(data);
      const intakeDefaults = deriveSoomgoIntakeDefaults(data);
      const name = soomgoCustomerNameForIntake(data);
      const preferredYmd = resolveSoomgoPreferredDate(data);
      const requestMemo = (data.requestMemo || data.memo)?.trim() || '';
      const summary = summarizeSoomgoImport(data);
      const choice = matchCrmImportedPropertyChoice(propertyChoiceOptionsRef.current, [
        data.buildingType,
        data.serviceType,
      ]);

      setContactPhone(split.contactPhone ?? '');
      setSafePhone(split.safePhone ?? '');
      setContactUnknown(intakeDefaults.contactUnknown);
      setCustomerName(name);
      const areaRaw = [data.pyeong, data.requestMemo || data.memo].filter(Boolean).join('\n');
      areaLockedRef.current = false;
      setAreaLocked(false);
      setAreaResult(null);
      setAreaImport(areaRaw.trim() ? { raw: areaRaw, key: Date.now() } : null);
      setPyeong('');
      setMode('new');
      setIntakeKind(intakeDefaults.kind);
      setSoomgoImportBanner(summary.lines.join('\n'));
      setSoomgoImportFlashKey((k) => k + 1);
      setSoomgoHiredOther(data.hiredOther === true);
      setInitialFormDraft({
        customerName: name,
        nickname: name,
        address: resolveSoomgoAddress(data),
        preferredMoveInCleanYmd: preferredYmd,
        requestMemo,
        roomCount: formatSoomgoCountForCrm(data.roomCount),
        bathroomCount: formatSoomgoCountForCrm(data.bathroomCount),
        balconyCount: formatSoomgoCountForCrm(data.balconyCount),
        propertyType: choice.propertyType,
        buildingType: choice.buildingType,
        isOneRoom: choice.isOneRoom,
        oneRoomLoft: null,
        oneRoomSlidingPartition: null,
        structureBalconyNonExpanded: null,
        structurePartitionWall: null,
        structureOutdoorTerrace: null,
        kind: intakeDefaults.kind,
        goldDb: false,
        leadSource: BRIDGE_INQUIRY_LEAD_SOURCE_LABEL.soomgo,
        extractPlatform: 'soomgo',
      });
      setIntakeStructure({
        roomCount: formatSoomgoCountForCrm(data.roomCount),
        bathroomCount: formatSoomgoCountForCrm(data.bathroomCount),
        balconyCount: formatSoomgoCountForCrm(data.balconyCount),
        ...choice,
      });
      setIntakeIdentity({
        customerName: name,
        nickname: name,
        address: (data.region || data.address)?.trim() || '',
      });
    },
    [resetQuotePricingState],
  );

  const handleMisoImport = useCallback(
    (data: MisoExtractPayload) => {
      resetQuotePricingState();
      const intakeDefaults = deriveMisoIntakeDefaults(data);
      const name = data.customerName?.trim() || '';
      const preferredYmd = resolveMisoPreferredDate(data);
      const address = resolveMisoAddress(data);
      const requestMemo = buildMisoRequestMemo(data);
      const summary = summarizeMisoImport(data);
      const choice = matchCrmImportedPropertyChoice(propertyChoiceOptionsRef.current, [
        data.orderDetail?.residenceType,
        data.orderDetail?.serviceTypeDetail,
        data.orderDetail?.roomLayout,
      ]);

      setContactPhone(data.phone?.trim() ?? '');
      setSafePhone('');
      setContactUnknown(intakeDefaults.contactUnknown);
      setCustomerName(name);
      setPyeong(parseMisoPyeong(data.orderDetail?.areaPyung));
      setMode('new');
      setIntakeKind(intakeDefaults.kind);
      setSoomgoImportBanner(`미소\n${summary.lines.join('\n')}`);
      setSoomgoImportFlashKey((k) => k + 1);
      setInitialFormDraft({
        customerName: name,
        nickname: name,
        address,
        preferredMoveInCleanYmd: preferredYmd,
        requestMemo,
        roomCount: '',
        bathroomCount: '',
        balconyCount: '',
        propertyType: choice.propertyType,
        buildingType: choice.buildingType,
        isOneRoom: choice.isOneRoom,
        oneRoomLoft: null,
        oneRoomSlidingPartition: null,
        structureBalconyNonExpanded: null,
        structurePartitionWall: null,
        structureOutdoorTerrace: null,
        kind: intakeDefaults.kind,
        goldDb: false,
        leadSource: BRIDGE_INQUIRY_LEAD_SOURCE_LABEL.miso,
        extractPlatform: 'miso',
      });
      setIntakeIdentity({
        customerName: name,
        nickname: name,
        address,
      });
      showDispatchNotice(misoImportNoticeText(summary));
    },
    [resetQuotePricingState, showDispatchNotice],
  );

  const soomgoBridge = useCrmSoomgoBridge({
    onImport: handleSoomgoImport,
    bridgeManifest: soomgoBridgeManifest,
    onImportPhone: (phoneValue) => {
      if (isCrmSafePhone(phoneValue)) {
        setSafePhone(phoneValue);
        setContactPhone('');
      } else {
        setContactPhone(phoneValue);
        setSafePhone('');
      }
      setContactUnknown(false);
    },
    onDispatchNotice: showDispatchNotice,
    onImportNotice: (data) =>
      showDispatchNotice(
        soomgoImportNoticeText(summarizeSoomgoImport(data), {
          safePhoneSkipped: data.safePhoneSkipped,
          phoneConsultPending: data.phoneConsultPending,
          phoneConsultAction: data.phoneConsultAction,
        }),
      ),
    onChatAlerts: handleSoomgoChatAlerts,
    onChatListSnapshot: handleSoomgoChatListSnapshot,
    pollEnabled: !isMobileApp,
    intakeRoomWatch: Boolean(buildCurrentIntakeDraft()),
    isPopup,
    operatingCompanyId: activeOperatingCompanyId,
    refreshManifest,
    soomgoBarOpen,
    soomgoAlertDrawerOpen,
    inboxWatchChatIds: soomgoInboxPinnedChatIds,
  });

  const {
    openSoomgo,
    extract,
    callFromChat,
    restartBridge,
    openChatByNickname: openChatByNicknameRaw,
    openChatRoomAndExtract: openChatRoomAndExtractRaw,
    returnToChatList: returnToChatListRaw,
    busy: soomgoBusy,
    busyAction: soomgoBusyAction,
    busyLabel: soomgoBusyLabel,
    status: soomgoStatus,
    preview: soomgoPreview,
    bridgeUp: soomgoBridgeUp,
    error: soomgoError,
    refreshStatus: refreshSoomgoStatus,
    requestBridgeUpdate,
    updateBusy: soomgoUpdateBusy,
  } = soomgoBridge;

  /** 다른 방으로 연 직후만 방 전환 비우기에서 뺀다. 목록으로 나간 것은 비운다. */
  const markSoomgoSelfNav = useCallback((kind: SoomgoSelfNavKind) => {
    soomgoSelfNavRef.current = { until: Date.now() + 12_000, kind };
  }, []);
  const openChatByNickname = useCallback(
    async (...args: Parameters<typeof openChatByNicknameRaw>) => {
      markSoomgoSelfNav('open-room');
      try {
        const opened = await openChatByNicknameRaw(...args);
        const openedChatId = opened?.chatId != null ? String(opened.chatId).trim() : '';
        if (openedChatId) lastIntakeChatIdRef.current = openedChatId;
        return opened;
      } finally {
        markSoomgoSelfNav('open-room');
      }
    },
    [markSoomgoSelfNav, openChatByNicknameRaw],
  );
  const openChatRoomAndExtract = useCallback(
    async (...args: Parameters<typeof openChatRoomAndExtractRaw>) => {
      markSoomgoSelfNav('open-room');
      try {
        return await openChatRoomAndExtractRaw(...args);
      } finally {
        markSoomgoSelfNav('open-room');
      }
    },
    [markSoomgoSelfNav, openChatRoomAndExtractRaw],
  );
  const returnToChatList = useCallback(async () => {
    markSoomgoSelfNav('return-list');
    try {
      return await returnToChatListRaw();
    } finally {
      markSoomgoSelfNav('return-list');
    }
  }, [markSoomgoSelfNav, returnToChatListRaw]);

  useCrmSoomgoRoomLeave({
    status: soomgoStatus,
    busy: soomgoBusyAction === 'open' || soomgoBusyAction === 'extract',
    selfNavRef: soomgoSelfNavRef,
    buildDraft: buildCurrentIntakeDraft,
    refreshStatus: refreshSoomgoStatus,
    onRoomSeen: (chatId) => {
      lastIntakeChatIdRef.current = chatId;
    },
    onLeave: (decision, draft) => {
      resetIntakeFormState(null);
      saveCrmIntakeRecoverDraft(draft);
      setRecoverableDraft(draft);
      setSoomgoLeaveNotice(
        decision === 'clear-list'
          ? '숨고 채팅 목록으로 나와서 접수란을 비웠어요.'
          : '숨고 채팅방이 바뀌어 접수란을 비웠어요.',
      );
    },
  });

  const soomgoPanelBusy = soomgoBusy || soomgoStaleCleanupRunning;
  const soomgoPanelBusyLabel = soomgoStaleCleanupRunning
    ? '오래된 채팅 정리 중…'
    : soomgoBusyLabel;

  const misoBridge = useCrmMisoBridge({
    misoBarOpen,
    pollEnabled: !isMobileApp,
    operatingCompanyId: activeOperatingCompanyId,
    onDispatchNotice: showDispatchNotice,
    onImport: handleMisoImport,
  });

  const {
    openMiso,
    extract: extractMiso,
    sendMessage: sendMisoMessage,
    busy: misoBusy,
    busyAction: misoBusyAction,
    busyLabel: misoBusyLabel,
    status: misoStatus,
    bridgeUp: misoBridgeUp,
    chatItems: misoChatItems,
    error: misoError,
    downloadUrl: misoDownloadUrl,
    refreshStatus: refreshMisoStatus,
    startEmulator: startMisoEmulator,
    openInstall: openMisoInstall,
    openPartnerApp: openMisoPartnerApp,
  } = misoBridge;

  const openSoomgoChatForNickname = useCallback(
    async (snapshot: Pick<CrmFollowupApplySnapshot, 'nickname' | 'customerName' | 'address'>) => {
      const label = resolveSoomgoChatSearchLabel(snapshot);
      if (label.length < 2 || !soomgoBarOpen) return null;
      const { nickname, customerName } = resolveSoomgoChatSearchQuery(snapshot);
      return openChatByNickname(
        nickname.length >= 2 ? nickname : customerName,
        snapshot.address,
        customerName,
      );
    },
    [openChatByNickname, soomgoBarOpen],
  );

  const extractFromBridge = useCallback(async () => {
    if (misoBarOpen) {
      const miso = await refreshMisoStatus();
      if (isMisoBridgeReachable(miso)) {
        await extractMiso();
        return;
      }
      showDispatchNotice('PC에서 「청소비서 미소 연동」을 켠 뒤 「다시 확인」을 눌러 주세요.');
      return;
    }
    if (soomgoBarOpen) {
      const s = await refreshSoomgoStatus({ lite: true });
      if (isSoomgoBridgeUseBlocked(s, soomgoBridgeManifest)) {
        showDispatchNotice(soomgoBridgeOutdatedMessage(s, soomgoBridgeManifest));
        return;
      }
      if (isSoomgoBridgeReachable(s)) {
        const nick = intakeIdentity.nickname.trim();
        const customerName = intakeIdentity.customerName.trim();
        if (nick.length >= 2 || customerName.length >= 2) {
          await openSoomgoChatForNickname({
            nickname: intakeIdentity.nickname,
            customerName: intakeIdentity.customerName,
            address: intakeIdentity.address,
          });
        }
        await extract();
        return;
      }
      showDispatchNotice(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
      return;
    }
    showDispatchNotice('GNB에서 「미소 연동」 또는 「숨고 연동」을 켠 뒤 정보 갖고오기를 눌러 주세요.');
  }, [
    extract,
    extractMiso,
    intakeIdentity.nickname,
    intakeIdentity.customerName,
    intakeIdentity.address,
    misoBarOpen,
    openSoomgoChatForNickname,
    refreshMisoStatus,
    refreshSoomgoStatus,
    showDispatchNotice,
    soomgoBarOpen,
    soomgoBridgeManifest,
  ]);

  const bridgeExtractBusy =
    misoBusyAction === 'extract' || soomgoBusyAction === 'extract';

  const importSoomgoForAiSummary = useCallback(async () => {
    if (!soomgoBarOpen) {
      showDispatchNotice('숨고 연동을 켠 뒤 AI 정리를 사용해 주세요.');
      return false;
    }
    const s = await refreshSoomgoStatus({ lite: true });
    if (isSoomgoBridgeUseBlocked(s, soomgoBridgeManifest)) {
      showDispatchNotice(soomgoBridgeOutdatedMessage(s, soomgoBridgeManifest));
      return false;
    }
    if (!isSoomgoBridgeReachable(s)) {
      showDispatchNotice(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
      return false;
    }
    const nick = intakeIdentity.nickname.trim();
    const customerName = intakeIdentity.customerName.trim();
    if (nick.length >= 2 || customerName.length >= 2) {
      await openSoomgoChatForNickname({
        nickname: intakeIdentity.nickname,
        customerName: intakeIdentity.customerName,
        address: intakeIdentity.address,
      });
    }
    const data = await extract();
    return data != null;
  }, [
    extract,
    intakeIdentity.nickname,
    intakeIdentity.customerName,
    intakeIdentity.address,
    openSoomgoChatForNickname,
    refreshSoomgoStatus,
    showDispatchNotice,
    soomgoBarOpen,
    soomgoBridgeManifest,
  ]);

  const soomgoUpdateNoticeVisible = useMemo(
    () => isSoomgoBridgeUpdateNoticeVisible(soomgoStatus, soomgoBridgeManifest),
    [soomgoStatus, soomgoBridgeManifest],
  );

  const handleRefreshSoomgoInbox = useCallback(async () => {
    setSoomgoInboxRefreshing(true);
    try {
      await refreshManifest();
      await refreshSoomgoStatus();
    } finally {
      setSoomgoInboxRefreshing(false);
    }
  }, [refreshManifest, refreshSoomgoStatus]);

  const handleDismissSoomgoInbox = useCallback(
    (chatIds: string[], options?: { refresh?: boolean }) => {
      setSoomgoInboxItems((prev) => {
        const { items: next, dismissals: nextDismissals } = dismissSoomgoInboxItems(
          prev,
          chatIds,
          soomgoInboxDismissals,
        );
        setSoomgoInboxDismissals(nextDismissals);
        if (authUserId) {
          saveSoomgoChatInbox(authUserId, workBrandSlug, next);
          saveSoomgoInboxDismissals(authUserId, workBrandSlug, nextDismissals);
        }
        return next;
      });
      if (options?.refresh !== false) {
        void handleRefreshSoomgoInbox();
      }
    },
    [authUserId, handleRefreshSoomgoInbox, soomgoInboxDismissals, workBrandSlug],
  );

  const handleToggleSoomgoInboxPin = useCallback(
    (chatId: string) => {
      setSoomgoInboxItems((prev) => {
        const next = toggleSoomgoInboxPin(prev, chatId);
        if (authUserId) saveSoomgoChatInbox(authUserId, workBrandSlug, next);
        return next;
      });
    },
    [authUserId, workBrandSlug],
  );

  const handleDismissAllSoomgoInbox = useCallback(() => {
    const chatIds = soomgoInboxItems.map((row) => row.chatId);
    handleDismissSoomgoInbox(chatIds);
  }, [handleDismissSoomgoInbox, soomgoInboxItems]);

  const handleOpenSoomgoChatFromInbox = useCallback(
    (chatId: string) => {
      handleDismissSoomgoInbox([chatId], { refresh: false });
      void (async () => {
        try {
          await openChatRoomAndExtract(chatId);
        } finally {
          await handleRefreshSoomgoInbox();
        }
      })();
    },
    [handleDismissSoomgoInbox, handleRefreshSoomgoInbox, openChatRoomAndExtract],
  );

  const handleToggleSoomgoBar = useCallback(() => {
    const next = !soomgoBarOpen;
    setSoomgoBarOpen(next);
    if (next) void openSoomgo();
    else if (isPopup) fitCrmPopupWindow();
  }, [isPopup, soomgoBarOpen, setSoomgoBarOpen, openSoomgo]);

  const handleToggleMisoBar = useCallback(() => {
    const next = !misoBarOpen;
    setMisoBarOpen(next);
    if (next) void refreshMisoStatus();
  }, [misoBarOpen, setMisoBarOpen, refreshMisoStatus]);

  const handleIntakeSaved = useCallback(
    (meta?: CrmIntakeSavedMeta) => {
      clearCrmIntakeDraft();
      setHasUnsavedDraft(false);
      setLookupRefreshKey((k) => k + 1);
      setStatsRefreshKey((k) => k + 1);
      if (!meta?.freshStart) return;
      resetIntakeFormState(null);
      const inSoomgoRoom =
        Boolean(soomgoStatus?.bridgeRunning) &&
        (Boolean(soomgoStatus?.inChatRoom) || soomgoStatus?.pageMode === 'chat_room');
      if (soomgoBarOpen || inSoomgoRoom) {
        void returnToChatList();
        if (soomgoBarOpen) {
          void applyTelecrmSoomgoSplitLayout(arrangeSoomgoBridgeLayout, { resizeCrm: isPopup });
        }
      }
    },
    [isPopup, resetIntakeFormState, returnToChatList, soomgoBarOpen, soomgoStatus],
  );

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const estimateWon = useMemo(() => {
    if (!Number.isFinite(pyeongNum) || pyeongNum <= 0 || pricePerPyeong <= 0) return null;
    return computeEstimateTotalFromPyeong(pyeongNum, pricePerPyeong, minimumTotalAmount);
  }, [pyeongNum, pricePerPyeong, minimumTotalAmount]);

  const quotePayload = useMemo(
    () =>
      crmQuotePayloadFromState({
        pyeong,
        pricePerPyeong,
        minimumTotalAmount,
        quoteLines,
        baseEstimateOverrideWon,
      }),
    [pyeong, pricePerPyeong, minimumTotalAmount, quoteLines, baseEstimateOverrideWon],
  );
  const quoteGrandTotal = crmQuoteGrandTotalWon(quotePayload);
  const coachQuote = useMemo(
    () =>
      buildCrmCoachQuote({
        isOneRoom: intakeStructure.isOneRoom,
        roomCount: intakeStructure.roomCount,
        bathroomCount: intakeStructure.bathroomCount,
        balconyCount: intakeStructure.balconyCount,
        buildingType: intakeStructure.buildingType,
        propertyType: intakeStructure.propertyType,
        grandTotalWon: quoteGrandTotal,
        lines: quoteLines,
      }),
    [intakeStructure, quoteGrandTotal, quoteLines],
  );

  const {
    pendingQuote,
    latestSentQuote,
    dismissPendingQuote,
    startFreshQuote,
    saveError: quoteSaveError,
    saving: quoteSaving,
    finalizing: quoteFinalizing,
    finalizeError: quoteFinalizeError,
    finalizeQuoteHold,
    reloadQuotes,
  } = useCrmConsultationQuote({
    phone: outboundPhone,
    pyeong,
    pricePerPyeong,
    minimumTotalAmount,
    quoteLines,
    baseEstimateOverrideWon,
    hasLocalContent: telecrmQuotePayloadHasContent(quotePayload),
    operatingCompanyId: activeOperatingCompanyId,
    enabled: Boolean(activeOperatingCompanyId),
  });

  const applyPendingQuote = useCallback(() => {
    if (!pendingQuote) return;
    const payload = pendingQuote.payload;
    setPyeong(payload.pyeong);
    setQuoteLines(crmQuoteLinesFromPayload(payload));
    const pyeongNum = parseFloat(payload.pyeong.replace(/,/g, ''));
    const catalogBase =
      Number.isFinite(pyeongNum) && pyeongNum > 0 && pricePerPyeong > 0
        ? computeEstimateTotalFromPyeong(pyeongNum, pricePerPyeong, minimumTotalAmount)
        : null;
    setBaseEstimateOverrideWon(
      payload.baseEstimateWon != null &&
        (catalogBase == null || payload.baseEstimateWon !== catalogBase)
        ? payload.baseEstimateWon
        : null,
    );
    dismissPendingQuote();
  }, [pendingQuote, dismissPendingQuote, pricePerPyeong, minimumTotalAmount]);

  const handleStartFreshQuote = useCallback(async () => {
    resetQuotePricingState();
    await startFreshQuote();
  }, [resetQuotePricingState, startFreshQuote]);

  const canFinalizeQuoteHold =
    (permissions.me?.role === 'ADMIN' || permissions.has('followup.edit')) &&
    (intakeKind === 'absent' || intakeKind === 'hold') &&
    outboundPhone.replace(/\D/g, '').length >= 4 &&
    telecrmQuotePayloadHasContent(quotePayload);

  const handleFinalizeQuoteHold = useCallback(async () => {
    const form = formSnapshotRef.current;
    if (!form) return;
    const kind = form.kind;
    if (kind !== 'absent' && kind !== 'hold') return;
    try {
      const result = await finalizeQuoteHold({
        customerName: resolveCrmIntakeCustomerName({
          customerName: form.customerName,
          nickname: form.nickname,
          contactPhone,
          safePhone,
        }),
        nickname: form.nickname.trim() || null,
        goldDb: form.goldDb,
        preferredMoveInCleaningDate: form.preferredMoveInCleanYmd.trim() || null,
        extraMemo: form.requestMemo?.trim() || null,
        followupStatus: kind === 'absent' ? 'ABSENT' : 'ON_HOLD',
      });
      handleIntakeSaved();
      showDispatchNotice(
        result.followupCreated
          ? '견적 저장 · 부재/보류 등록되었습니다.'
          : '견적 저장 · 기존 부재/보류가 갱신되었습니다.',
      );
    } catch {
      /* finalizeError in hook */
    }
  }, [finalizeQuoteHold, handleIntakeSaved, contactPhone, safePhone, showDispatchNotice]);

  const handleSendSoomgoQuote = useCallback(async () => {
    const t = getToken();
    if (!t) return;
    const form = formSnapshotRef.current;
    const nickname = form?.nickname?.trim() || customerName.trim();
    const name = resolveCrmIntakeCustomerName({
      customerName: form?.customerName ?? customerName,
      nickname,
      contactPhone,
      safePhone,
    });
    setSoomgoQuoteSending(true);
    try {
      const result = await sendSoomgoQuoteAutoMessage(t, {
        operatingCompanyId: activeOperatingCompanyId,
        customerName: name,
        nickname,
        quoteTotalWon: quoteGrandTotal,
        pyeong,
        bridgeStatus: soomgoStatus,
        expectedChatId: lastIntakeChatIdRef.current,
      });
      const notice = noticeForSoomgoQuoteAutoSend(result);
      if (notice) showDispatchNotice(notice);
      if (result.sent && telecrmQuotePayloadHasContent(quotePayload)) {
        const digits = outboundPhone.replace(/\D/g, '');
        if (digits.length >= 4 && activeOperatingCompanyId) {
          try {
            await recordTelecrmConsultationQuoteSent(
              t,
              { phone: digits, payload: quotePayload },
              activeOperatingCompanyId,
            );
            reloadQuotes();
            setLookupRefreshKey((k) => k + 1);
          } catch {
            showDispatchNotice('숨고 전송은 완료됐으나 보낸 견적 기록에 실패했습니다.');
          }
        }
      }
    } finally {
      setSoomgoQuoteSending(false);
    }
  }, [
    activeOperatingCompanyId,
    customerName,
    contactPhone,
    safePhone,
    quoteGrandTotal,
    quotePayload,
    outboundPhone,
    pyeong,
    reloadQuotes,
    showDispatchNotice,
    soomgoStatus,
  ]);

  const applyFollowupFieldsToCrm = useCallback(
    (
      snapshot: CrmFollowupApplySnapshot,
      opts?: {
        closeDrawer?: boolean;
        notice?: string;
        extractPlatform?: 'soomgo';
      },
    ) => {
      resetQuotePricingState();
      setMode('existing');
      setContactPhone(snapshot.contactPhone);
      setSafePhone(snapshot.safePhone);
      setContactUnknown(false);
      setCustomerName(snapshot.customerName);
      setPyeong(snapshot.pyeong);
      setIntakeKind(snapshot.kind);
      setIntakeStructure({
        roomCount: snapshot.roomCount,
        bathroomCount: snapshot.bathroomCount,
        balconyCount: snapshot.balconyCount,
        propertyType: snapshot.propertyType ?? '',
        buildingType: snapshot.buildingType ?? '',
        isOneRoom: snapshot.isOneRoom === true,
      });
      const extractPlatform = opts?.extractPlatform;
      const leadSource =
        snapshot.leadSource.trim() ||
        (extractPlatform === 'soomgo' ? BRIDGE_INQUIRY_LEAD_SOURCE_LABEL.soomgo : '');
      setInitialFormDraft({
        customerName: snapshot.customerName,
        nickname: snapshot.nickname,
        address: snapshot.address,
        preferredMoveInCleanYmd: snapshot.preferredMoveInCleanYmd,
        requestMemo: snapshot.requestMemo,
        roomCount: snapshot.roomCount,
        bathroomCount: snapshot.bathroomCount,
        balconyCount: snapshot.balconyCount,
        propertyType: snapshot.propertyType ?? '',
        buildingType: snapshot.buildingType ?? '',
        isOneRoom: snapshot.isOneRoom === true,
        oneRoomLoft: snapshot.isOneRoom ? (snapshot.oneRoomLoft ?? null) : null,
        oneRoomSlidingPartition: snapshot.isOneRoom ? (snapshot.oneRoomSlidingPartition ?? null) : null,
        structureBalconyNonExpanded: snapshot.structureBalconyNonExpanded ?? null,
        structurePartitionWall: snapshot.structurePartitionWall ?? null,
        structureOutdoorTerrace: snapshot.structureOutdoorTerrace ?? null,
        kind: snapshot.kind,
        goldDb: snapshot.goldDb,
        leadSource,
        ...(extractPlatform ? { extractPlatform } : {}),
      });
      if (extractPlatform === 'soomgo') {
        setSoomgoImportFlashKey((k) => k + 1);
      }
      const nextKey = followupImportKey + 1;
      setFollowupImportKey(nextKey);
      setFollowupImport({ key: nextKey, snapshot });
      setCrmContext({
        inquiryId: snapshot.inquiryId,
        customerMatch: snapshot.inquiryId ? 'existing' : 'unknown',
      });
      setIntakeIdentity({
        customerName: snapshot.customerName,
        nickname: snapshot.nickname,
        address: snapshot.address,
      });
      showDispatchNotice(opts?.notice ?? '부재·보류 정보를 CRM 접수란으로 가져왔습니다.');
      if (opts?.closeDrawer !== false) closePanel();
    },
    [closePanel, followupImportKey, resetQuotePricingState, showDispatchNotice],
  );

  const autoFillFollowupExtrasFromSoomgo = useCallback(
    async (snapshot: CrmFollowupApplySnapshot) => {
      if (!followupIntakeExtrasNeedsSoomgoFill(snapshot)) return;
      if (!soomgoPlatformEnabled || !soomgoBarOpen || isMobileApp) return;
      const label = resolveSoomgoChatSearchLabel(snapshot);
      if (label.length < 2) return;

      const runId = followupSoomgoAutoRef.current + 1;
      followupSoomgoAutoRef.current = runId;

      try {
        const s = await refreshSoomgoStatus({ lite: true });
        if (runId !== followupSoomgoAutoRef.current) return;
        if (isSoomgoBridgeUseBlocked(s, soomgoBridgeManifest)) {
          showDispatchNotice(soomgoBridgeOutdatedMessage(s, soomgoBridgeManifest));
          return;
        }
        if (!isSoomgoBridgeReachable(s)) {
          showDispatchNotice(SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE);
          return;
        }

        followupSoomgoMergeRef.current = snapshot;
        const opened = await openSoomgoChatForNickname(snapshot);
        if (runId !== followupSoomgoAutoRef.current) return;
        if (!opened) {
          followupSoomgoMergeRef.current = null;
          return;
        }

        const ready = await waitForSoomgoInChatRoom(soomgoBridgeManifest, {
          chatId: opened.chatId,
          timeoutMs: 20000,
        });
        if (runId !== followupSoomgoAutoRef.current) return;
        if (!ready) {
          followupSoomgoMergeRef.current = null;
          showDispatchNotice('숨고 채팅방이 열리지 않았습니다. 「정보 갖고오기」를 직접 눌러 주세요.');
          return;
        }

        await new Promise((r) => window.setTimeout(r, 800));

        showDispatchNotice('추가 필드가 비어 있어 숨고에서 정보를 가져오는 중…');
        const data = await extract();
        if (runId !== followupSoomgoAutoRef.current) return;
        if (!data) {
          followupSoomgoMergeRef.current = null;
        }
      } catch (e) {
        followupSoomgoMergeRef.current = null;
        if (runId !== followupSoomgoAutoRef.current) return;
        const msg = e instanceof Error ? e.message : '숨고 추가 정보를 가져오지 못했습니다.';
        showDispatchNotice(`${msg} 「정보 갖고오기」를 직접 눌러 주세요.`);
      }
    },
    [
      extract,
      isMobileApp,
      openSoomgoChatForNickname,
      refreshSoomgoStatus,
      showDispatchNotice,
      soomgoBarOpen,
      soomgoBridgeManifest,
      soomgoPlatformEnabled,
    ],
  );

  applyFollowupFieldsRef.current = applyFollowupFieldsToCrm;

  const applyFollowupToCrm = useCallback(
    (snapshot: CrmFollowupApplySnapshot, opts?: { closeDrawer?: boolean }) => {
      const needsSoomgoFill = followupIntakeExtrasNeedsSoomgoFill(snapshot);
      applyFollowupFieldsToCrm(snapshot, {
        ...opts,
        ...(needsSoomgoFill ? { extractPlatform: 'soomgo' as const } : {}),
      });
      const label = resolveSoomgoChatSearchLabel(snapshot);
      if (label && soomgoBarOpen && !needsSoomgoFill) {
        void openSoomgoChatForNickname(snapshot);
      } else if (label && !soomgoBarOpen) {
        showDispatchNotice('숨고 연동을 켜면 닉네임·고객명으로 채팅방을 자동으로 찾아 이동합니다.');
      }
      if (needsSoomgoFill) {
        void autoFillFollowupExtrasFromSoomgo(snapshot);
      }
    },
    [
      applyFollowupFieldsToCrm,
      autoFillFollowupExtrasFromSoomgo,
      openSoomgoChatForNickname,
      showDispatchNotice,
      soomgoBarOpen,
    ],
  );

  const handleApplyFollowupItem = useCallback(
    (item: OrderFollowupItem) => {
      applyFollowupToCrm(crmFollowupApplyFromItem(item));
    },
    [applyFollowupToCrm],
  );

  quickBridgeRef.current = {
    applyItem: handleApplyFollowupItem,
    applySnapshot: applyFollowupFieldsToCrm,
    notice: showDispatchNotice,
    isBusy: () => {
      const form = formSnapshotRef.current;
      return (
        Boolean(followupImport) ||
        quoteLines.length > 0 ||
        baseEstimateOverrideWon != null ||
        hasUnsavedDraft ||
        crmIntakeDraftHasContent({
          contactPhone,
          safePhone,
          customerName,
          pyeong,
          nickname: form?.nickname,
          address: form?.address,
          preferredMoveInCleanYmd: form?.preferredMoveInCleanYmd,
          requestMemo: form?.requestMemo,
          leadSource: form?.leadSource,
          roomCount: form?.roomCount,
          bathroomCount: form?.bathroomCount,
          balconyCount: form?.balconyCount,
          propertyType: form?.propertyType,
          buildingType: form?.buildingType,
          isOneRoom: form?.isOneRoom,
        })
      );
    },
  };

  const handleSelectFollowupFromLookup = useCallback(
    (row: TelecrmCustomerLookupDto['followups'][number]) => {
      applyFollowupToCrm(crmFollowupApplyFromLookupRow(row), { closeDrawer: false });
    },
    [applyFollowupToCrm],
  );

  const handleFollowupSaved = useCallback(() => {
    setLookupRefreshKey((k) => k + 1);
    setStatsRefreshKey((k) => k + 1);
  }, []);

  const scriptEstimateWon = quoteGrandTotal ?? estimateWon;

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

  const handleOrderIssued = useCallback(
    async (order: OrderForm) => {
      setLookupRefreshKey((k) => k + 1);
      if (!telecrmQuotePayloadHasContent(quotePayload)) return;
      const token = getToken();
      const digits = outboundPhone.replace(/\D/g, '');
      if (!token || digits.length < 4) return;
      try {
        await linkTelecrmConsultationQuoteInquiry(
          token,
          {
            phone: digits,
            orderFormId: order.id,
            inquiryId: issuePendingInquiryId?.trim() || undefined,
          },
          activeOperatingCompanyId,
        );
      } catch {
        /* 견적 연결 실패는 발주서 발급 자체를 막지 않음 */
      }
    },
    [activeOperatingCompanyId, issuePendingInquiryId, outboundPhone, quotePayload],
  );

  const issueSeed = useMemo((): CrmOrderIssueSeed => {
    const form = formSnapshotRef.current;
    const profIds = crmQuoteProfessionalOptionIdsFromLines(quoteLines);
    return {
      customerName: form?.customerName?.trim() || customerName.trim() || undefined,
      customerPhone: outboundPhone.trim() || undefined,
      areaPyeong: pyeong.trim() || undefined,
      areaBasis: pyeong.trim() ? '공급' : undefined,
      address: form?.address?.trim() || undefined,
      preferredDate: form?.preferredMoveInCleanYmd?.trim() || undefined,
      roomCount: form?.roomCount?.trim() || undefined,
      bathroomCount: form?.bathroomCount?.trim() || undefined,
      balconyCount: form?.balconyCount?.trim() || undefined,
      totalAmount:
        quoteGrandTotal != null
          ? String(quoteGrandTotal)
          : estimateWon != null
            ? String(estimateWon)
            : undefined,
      depositAmount: depositAmount > 0 ? String(depositAmount) : undefined,
      ...(profIds.length > 0 ? { professionalOptionIds: profIds } : {}),
      ...(quotePayload.copyText.trim() ? { crmQuoteBreakdown: quotePayload.copyText } : {}),
    };
  }, [
    customerName,
    outboundPhone,
    pyeong,
    depositAmount,
    estimateWon,
    quoteGrandTotal,
    quoteLines,
    quotePayload.copyText,
    isIssueOpen,
  ]);

  if (!getToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-slate-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (permissions.loading || features === null || telecrm === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-slate-500">권한 확인 중…</p>
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

  if (!canAccessTelecrm(telecrm)) {
    const denyReason = telecrm.denyReason ?? 'not_licensed';
    const handleCloseAccess = () => {
      if (isPopup) window.close();
      else window.location.href = '/admin/dashboard';
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <TelecrmAccessModal open reason={denyReason} onClose={handleCloseAccess} />
      </div>
    );
  }

  return (
      <div
        className={
          isMobileApp
            ? 'box-border h-full min-w-0 w-full max-w-full'
            : 'box-border h-screen min-w-0 w-full max-w-full overflow-hidden'
        }
      >
        <CrmShell
          mobile={isMobileApp}
          fillViewport={!isMobileApp}
          splitLayout={soomgoPlatformEnabled && soomgoBarOpen && !isMobileApp}
          topBar={
            !isMobileApp ? (
              <>
                {!isMobileApp && soomgoPlatformEnabled && soomgoUpdateNoticeVisible ? (
                  <CrmSoomgoUpdateStrip
                    status={soomgoStatus}
                    bridgeManifest={soomgoBridgeManifest}
                    updateBusy={soomgoUpdateBusy}
                    onRequestUpdate={() => void requestBridgeUpdate('install')}
                    onRefresh={() => {
                      void refreshManifest();
                      void refreshSoomgoStatus();
                    }}
                    onOpenSoomgoBar={() => setSoomgoBarOpen(true)}
                  />
                ) : null}
                {!isMobileApp && soomgoPlatformEnabled ? (
                  <CrmSoomgoTopBar
                open={soomgoBarOpen}
                onClose={() => setSoomgoBarOpen(false)}
                status={soomgoStatus}
                preview={soomgoPreview}
                bridgeUp={soomgoBridgeUp}
                busy={soomgoPanelBusy}
                busyLabel={soomgoPanelBusyLabel}
                error={soomgoError}
                onOpenSoomgo={() => void openSoomgo()}
                brandName={showWorkBrandSwitcher ? workBrandActive?.displayName ?? null : null}
                onRefresh={() => {
                  void refreshManifest();
                  void refreshSoomgoStatus();
                }}
                onRestartBridge={() => void restartBridge()}
                onOpenSettings={
                  canOpenSettings
                    ? () =>
                        openSettings(
                          canSharedSettings ? 'soomgo' : 'soomgo-presets',
                          canSharedSettings ? 'shared' : canPersonalCatalog ? 'personal' : 'shared',
                        )
                    : undefined
                }
                bridgeManifest={soomgoBridgeManifest}
                updateBusy={soomgoUpdateBusy}
                onRequestUpdate={() => void requestBridgeUpdate('install')}
                  />
                ) : null}
                {!isMobileApp && misoPlatformEnabled ? (
                  <CrmMisoTopBar
                    open={misoBarOpen}
                    onClose={() => setMisoBarOpen(false)}
                    status={misoStatus}
                    bridgeUp={misoBridgeUp}
                    busy={misoBusy}
                    busyLabel={misoBusyLabel}
                    error={misoError}
                    onOpenMiso={() => void openMiso()}
                    onRefresh={() => void refreshMisoStatus()}
                    onStartEmulator={() => void startMisoEmulator()}
                    onOpenInstall={() => void openMisoInstall()}
                    onOpenMisoApp={() => void openMisoPartnerApp()}
                    downloadUrl={misoDownloadUrl}
                    chatItems={misoChatItems}
                    onExtractChat={(chatId) => void extractMiso(chatId)}
                    extractBusy={misoBusyAction === 'extract'}
                  />
                ) : null}
              </>
            ) : undefined
          }
          header={
            <header data-crm-app-header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3 py-2.5 text-white shadow-lg sm:gap-x-3 sm:px-4 sm:py-3 lg:flex-nowrap">
              <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-3.5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-md shadow-indigo-900/40 pointer-events-none"
                  aria-hidden
                >
                  <CrmIconPhone className="h-5 w-5" />
                </span>
                <span className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
                <PageTitleWithFavorite
                  label="텔레CRM"
                  onDark
                  compact
                  className="relative z-10 flex shrink-0 items-center gap-1.5 pl-0.5"
                >
                  <h1 className="shrink-0 text-fluid-sm font-bold tracking-tight whitespace-nowrap">텔레CRM</h1>
                </PageTitleWithFavorite>
              </div>
              {canAdsSession ? (
                <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto">
                  <CrmSessionBar enabled={canAdsSession} />
                </div>
              ) : null}
              {hasUnsavedDraft ? (
                <span className="order-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-fluid-2xs font-semibold whitespace-nowrap text-amber-100 ring-1 ring-inset ring-amber-300/30 sm:order-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  미저장
                </span>
              ) : null}
              <CrmHeaderStats
                refreshKey={statsRefreshKey}
                operatingCompanyId={activeOperatingCompanyId}
                onOpenHotFollowups={openHotFollowups}
                onOpenQuickSchedule={handleOpenQuickSchedule}
              />
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 lg:ml-0 lg:flex-nowrap">
                {isMobileApp ? (
                  <button
                    type="button"
                    onClick={() => setSmsDrawerOpen(true)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 text-fluid-xs font-semibold whitespace-nowrap text-violet-100"
                  >
                    <CrmIconMessage className="h-4 w-4" />
                    문자
                  </button>
                ) : null}
                {!isMobileApp && soomgoPlatformEnabled ? (
                  <button
                    type="button"
                    onClick={handleToggleSoomgoBar}
                    className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-fluid-xs font-semibold whitespace-nowrap ${
                      soomgoBarOpen
                        ? 'border-cyan-300/60 bg-cyan-400/25 text-white'
                        : soomgoUpdateNoticeVisible
                          ? 'border-amber-300/70 bg-amber-500/25 text-amber-50 hover:bg-amber-500/35'
                          : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                    }`}
                  >
                    <CrmIconSoomgo className="h-4 w-4" />
                    {soomgoUpdateNoticeVisible ? '숨고 · 업데이트' : '숨고 연동'}
                    {soomgoUpdateNoticeVisible ? (
                      <span
                        className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-400 ring-2 ring-slate-900"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                ) : null}
                {!isMobileApp && misoPlatformEnabled ? (
                  <button
                    type="button"
                    onClick={handleToggleMisoBar}
                    className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-fluid-xs font-semibold whitespace-nowrap ${
                      misoBarOpen
                        ? 'border-violet-300/60 bg-violet-400/25 text-white'
                        : 'border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25'
                    }`}
                  >
                    <CrmIconMiso className="h-4 w-4" />
                    미소 연동
                  </button>
                ) : null}
                {canFollowupEdit ? (
                  <button
                    type="button"
                    onClick={() => openFollowup()}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 text-fluid-xs font-semibold whitespace-nowrap text-amber-100 hover:bg-amber-500/25"
                  >
                    부재·보류
                  </button>
                ) : null}
                {canOrderIssue ? (
                  <button
                    type="button"
                    onClick={() => openIssue()}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 text-fluid-xs font-semibold whitespace-nowrap text-sky-100 hover:bg-sky-500/25"
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
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 text-fluid-xs font-semibold whitespace-nowrap text-violet-100 hover:bg-violet-500/25"
                  >
                    설정
                  </button>
                ) : null}
                {isPopup ? (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="inline-flex h-8 shrink-0 items-center rounded-xl bg-white/10 px-3 text-fluid-xs font-medium whitespace-nowrap hover:bg-white/20"
                  >
                    창 닫기
                  </button>
                ) : isMobileApp ? null : (
                  <Link
                    to="/admin/dashboard"
                    className="inline-flex h-8 shrink-0 items-center rounded-xl bg-white/10 px-3 text-fluid-xs font-medium whitespace-nowrap hover:bg-white/20"
                  >
                    관리자로
                  </Link>
                )}
              </div>
            </header>
          }
          toolNav={
            !isMobileApp ? (
              <CrmToolSideNav
                items={[
                  {
                    id: 'sms',
                    label: '문자 발송',
                    icon: <CrmIconMessage />,
                    active: smsDrawerOpen,
                    disabled: soomgoPanelBusy,
                    onClick: () => setSmsDrawerOpen(true),
                  },
                  ...(misoPlatformEnabled && misoBarOpen
                    ? [
                        {
                          id: 'miso-message',
                          label: '미소 메시지',
                          icon: <CrmIconMiso />,
                          active: misoDrawerOpen,
                          loading: misoBusyAction === 'send',
                          disabled: misoBusy && misoBusyAction !== 'send',
                          onClick: () => setMisoDrawerOpen(true),
                        },
                      ]
                    : []),
                  ...((soomgoPlatformEnabled || misoPlatformEnabled)
                    ? [
                        {
                          id: 'bridge-extract',
                          label: '정보 갖고오기',
                          icon: misoBarOpen && !soomgoBarOpen ? <CrmIconMiso /> : <CrmIconSoomgo />,
                          active: false,
                          loading: bridgeExtractBusy,
                          disabled: (misoBusy || soomgoPanelBusy) && !bridgeExtractBusy,
                          onClick: () => void extractFromBridge(),
                        },
                      ]
                    : []),
                  ...(soomgoPlatformEnabled
                    ? [
                        {
                          id: 'soomgo-call',
                          label: '숨고 안심번호',
                          icon: <CrmIconPhone />,
                          active: false,
                          loading: soomgoBusyAction === 'call',
                          disabled: soomgoPanelBusy && soomgoBusyAction !== 'call',
                          onClick: () => void callFromChat(),
                        },
                        {
                          id: 'soomgo-alerts',
                          label: '숨고 알림함',
                          icon: <CrmIconBell className="h-[18px] w-[18px]" />,
                          active: soomgoAlertDrawerOpen,
                          badgeCount: soomgoInboxPendingCountValue,
                          disabled: soomgoPanelBusy,
                          onClick: () => setSoomgoAlertDrawerOpen(true),
                        },
                        {
                          id: 'soomgo-message',
                          label: '숨고 메시지',
                          icon: <CrmIconMessage />,
                          active: soomgoDrawerOpen,
                          disabled: soomgoPanelBusy,
                          onClick: () => setSoomgoDrawerOpen(true),
                        },
                        {
                          id: 'soomgo-stale-cleanup',
                          label: '채팅 정리',
                          icon: <CrmIconReset className="h-[18px] w-[18px]" />,
                          active: soomgoStaleCleanupOpen,
                          disabled: soomgoPanelBusy && !soomgoStaleCleanupRunning,
                          onClick: () => setSoomgoStaleCleanupOpen(true),
                        },
                      ]
                    : []),
                ]}
              />
            ) : undefined
          }
          left={
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              <CrmIntakePanel
                soomgoBridgeStatus={soomgoStatus}
                mode={mode}
                onModeChange={handleModeChange}
                contactPhone={contactPhone}
                onContactPhoneChange={setContactPhone}
                safePhone={safePhone}
                onSafePhoneChange={setSafePhone}
                contactUnknown={contactUnknown}
                onContactUnknownChange={setContactUnknown}
                onCustomerNameChange={setCustomerName}
                pyeong={pyeong}
                onPyeongChange={onUserPyeong}
                pyeongNote={pyeongNote}
                onOpenInquiryEdit={openInquiryEdit}
                lookupRefreshKey={lookupRefreshKey}
                operatingCompanyId={activeOperatingCompanyId}
                onSaved={handleIntakeSaved}
                initialFormDraft={initialFormDraft}
                onFormChange={handleFormChange}
                skipAutoFillPhone={draftRestoredPhone}
                canSubmitKind={canSubmitIntakeKind}
                permissionsLoading={permissions.loading}
                onOpenOrderIssue={canOrderIssue ? openIssue : undefined}
                onDispatchNotice={showDispatchNotice}
                onContextChange={setCrmContext}
                formResetKey={formResetKey}
                quotePayload={telecrmQuotePayloadHasContent(quotePayload) ? quotePayload : null}
                soomgoImportBanner={soomgoImportBanner}
                soomgoImportFlashKey={soomgoImportFlashKey}
                soomgoHiredOther={soomgoHiredOther}
                onIntakeReset={handleIntakeReset}
                onPricingReset={resetQuotePricingState}
                onLookupApplied={(payload) => {
                  setIntakeIdentity({
                    customerName: payload.customerName,
                    nickname: payload.nickname,
                    address: payload.address,
                  });
                  // 기존 고객을 불러오면 숨고 창도 그 고객 채팅방으로 (같은 고객은 한 번만)
                  const chatKey = `${payload.nickname.trim()}|${payload.customerName.trim()}`;
                  if (
                    soomgoBarOpen &&
                    chatKey !== '|' &&
                    lookupChatOpenedKeyRef.current !== chatKey
                  ) {
                    lookupChatOpenedKeyRef.current = chatKey;
                    void openSoomgoChatForNickname({
                      nickname: payload.nickname,
                      customerName: payload.customerName,
                      address: payload.address,
                    });
                  }
                  setCrmContext((prev) => ({
                    inquiryId: payload.inquiryId ?? prev.inquiryId,
                    customerMatch: payload.inquiryId ? 'existing' : prev.customerMatch,
                  }));
                }}
                followupImport={followupImport}
                onSelectFollowup={canFollowupEdit ? handleSelectFollowupFromLookup : undefined}
                workBrandBar={
                  showWorkBrandSwitcher || recoverableDraftVisible ? (
                    <>
                      {showWorkBrandSwitcher ? (
                        <CrmWorkBrandBar
                          variant="inline"
                          items={workBrandItems}
                          activeSlug={workBrandActive?.slug ?? null}
                          onSwitch={handleWorkBrandSwitch}
                          switching={workBrandLoading}
                        />
                      ) : null}
                      {recoverableDraftVisible ? (
                        <div className="mt-1.5 flex flex-nowrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-0.5">
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-fluid-2xs font-medium text-slate-700" title="방금 입력하던 내용이 있어요">
                            방금 입력하던 내용이 있어요
                          </span>
                          <Button size="sm" variant="secondary" className="h-6 shrink-0 px-2" onClick={applyRecoverableDraft}>
                            이전 입력 복구
                          </Button>
                          <Button size="sm" variant="quiet" className="h-6 shrink-0 px-1.5" onClick={dismissRecoverableDraft}>
                            지우기
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : null
                }
              />
            </div>
          }
          center={
            <CrmScriptAiCenterPanel
              customerName={customerName || undefined}
              pyeong={pyeong || undefined}
              estimateWon={scriptEstimateWon}
              coachQuote={coachQuote}
              refreshKey={catalogRefreshKey}
              onOpenSettings={
                canOpenSettings
                  ? () => openSettings('scripts', canPersonalCatalog ? 'personal' : 'shared')
                  : undefined
              }
              soomgoEnabled={soomgoPlatformEnabled}
              tenantSlug={tenantSlug}
              bridgeStatus={soomgoStatus}
              bridgeManifest={soomgoBridgeManifest}
              bridgeUp={soomgoBridgeUp}
              bridgeBusy={soomgoBusy}
              onDispatchNotice={showDispatchNotice}
              inquiryId={crmContext.inquiryId}
              onImportSoomgo={soomgoPlatformEnabled ? importSoomgoForAiSummary : undefined}
            />
          }
          right={
            <CrmPricingPanel
              pyeong={pyeong}
              onPyeongChange={onUserPyeong}
              pyeongNote={pyeongNote}
              pricePerPyeong={pricePerPyeong}
              minimumTotalAmount={minimumTotalAmount}
              baseEstimateOverrideWon={baseEstimateOverrideWon}
              onBaseEstimateOverrideChange={setBaseEstimateOverrideWon}
              onPricePerPyeongChange={setPricePerPyeong}
              onMinimumTotalAmountChange={setMinimumTotalAmount}
              quoteLines={quoteLines}
              onQuoteLinesChange={setQuoteLines}
              pendingQuote={pendingQuote}
              latestSentQuote={latestSentQuote}
              onLoadPendingQuote={applyPendingQuote}
              onDismissPendingQuote={dismissPendingQuote}
              onStartFreshQuote={() => void handleStartFreshQuote()}
              contactHistoryAction={
                contactTimelineItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      contactHistoryDismissedKeyRef.current = null;
                      setContactHistoryOpen(true);
                    }}
                    className="rounded-lg border border-emerald-300/80 bg-white px-2 py-1 text-fluid-2xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1"
                  >
                    접촉 이력 {contactTimelineItems.length}건
                    {contactTimelineActiveCount > 0 ? ` · 진행 ${contactTimelineActiveCount}` : ''}
                  </button>
                ) : null
              }
              quoteSaveError={quoteSaveError}
              quoteSaving={quoteSaving}
              canFinalizeHold={canFinalizeQuoteHold}
              onFinalizeHold={() => void handleFinalizeQuoteHold()}
              quoteFinalizing={quoteFinalizing}
              quoteFinalizeError={quoteFinalizeError}
              refreshKey={catalogRefreshKey}
              onOpenSettings={
                canOpenSettings
                  ? () => openSettings('pricing', canPersonalCatalog ? 'personal' : 'shared')
                  : undefined
              }
              canSendSoomgoQuote={Boolean(activeOperatingCompanyId)}
              onSendSoomgoQuote={() => void handleSendSoomgoQuote()}
              soomgoQuoteSending={soomgoQuoteSending}
              pricingResetKey={pricingResetKey}
              learningContext={{
                pyeong,
                roomCount: intakeStructure.roomCount,
                bathroomCount: intakeStructure.bathroomCount,
                balconyCount: intakeStructure.balconyCount,
                propertyType: intakeStructure.propertyType,
                buildingType: intakeStructure.buildingType,
                isOneRoom: intakeStructure.isOneRoom,
                operatingCompanyId: activeOperatingCompanyId ?? undefined,
              }}
              onOpenLearningSettings={
                canOpenSettings
                  ? () => openSettings('quote-learning', 'shared')
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
            canEditLeadSources={canEditLeadSources}
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
            operatingCompanyId={activeOperatingCompanyId}
            onClose={closePanel}
            onIssued={(order) => void handleOrderIssued(order)}
          />
        ) : null}
        <CrmQuickScheduleDrawer
          open={isQuickOpen}
          tab={quickTab}
          onTabChange={setQuickTab}
          operatingCompanyId={activeOperatingCompanyId}
          marketerName={crmMarketerName}
          onClose={closePanel}
          onApplyFollowup={handleApplyFollowupItem}
          onApplySnapshot={(snapshot) =>
            applyFollowupFieldsToCrm(snapshot, {
              closeDrawer: true,
              notice: '빠른일정 고객을 접수란으로 가져왔습니다.',
            })
          }
          onNotice={showDispatchNotice}
        />
        {canFollowupEdit ? (
          <CrmFollowupDrawer
            open={isFollowupOpen}
            followupId={panelFollowupId || null}
            operatingCompanyId={activeOperatingCompanyId}
            crmPhone={outboundPhone}
            onClose={closePanel}
            onSelectFollowupId={setFollowupId}
            onApplyToCrm={handleApplyFollowupItem}
            onSaved={handleFollowupSaved}
          />
        ) : null}
        {quickPopupBlocked ? (
          <CrmQuickScheduleCenterNotice
            text="팝업이 막혀 있어 이 창 안에서 열었어요. 주소창 오른쪽에서 팝업을 허용하면 따로 띄울 수 있어요."
            onClose={() => setQuickPopupBlocked(false)}
          />
        ) : null}
        {soomgoLeaveNotice ? (
          <CrmQuickScheduleCenterNotice
            text={soomgoLeaveNotice}
            actionLabel="이전 입력 복구"
            onAction={() => {
              setSoomgoLeaveNotice(null);
              applyRecoverableDraft();
            }}
            secondaryLabel="닫기"
            onSecondary={() => setSoomgoLeaveNotice(null)}
          />
        ) : null}
        {dispatchNotice ? (
          <CrmDispatchNotice
            text={dispatchNotice}
            actionLabel={dispatchNoticeAction?.label}
            onAction={
              dispatchNoticeAction
                ? () => {
                    dispatchNoticeAction.run();
                  }
                : undefined
            }
          />
        ) : null}
        <CrmSmsDrawer
          open={smsDrawerOpen}
          onClose={() => setSmsDrawerOpen(false)}
          phone={outboundPhone}
          customerName={customerName || undefined}
          pyeong={pyeong || undefined}
          estimateWon={scriptEstimateWon}
          inquiryId={crmContext.inquiryId}
          customerMatch={crmContext.customerMatch}
          operatingCompanyId={activeOperatingCompanyId}
          onDispatchNotice={showDispatchNotice}
          refreshKey={catalogRefreshKey}
          onOpenOrderIssue={canOrderIssue ? () => openIssue(crmContext.inquiryId) : undefined}
          onTemplatesChanged={() => setCatalogRefreshKey((k) => k + 1)}
        />
        {!isMobileApp ? (
          <>
            {soomgoPlatformEnabled ? (
              <>
                <CrmSoomgoAlertDrawer
                  open={soomgoAlertDrawerOpen}
                  onClose={() => setSoomgoAlertDrawerOpen(false)}
                  items={soomgoInboxItems}
                  pendingCount={soomgoInboxPendingCountValue}
                  busy={soomgoBusy}
                  bridgeStatus={soomgoStatus}
                  onOpenSoomgoChat={handleOpenSoomgoChatFromInbox}
                  onDismiss={handleDismissSoomgoInbox}
                  onTogglePin={handleToggleSoomgoInboxPin}
                  onDismissAll={handleDismissAllSoomgoInbox}
                  onRefresh={() => void handleRefreshSoomgoInbox()}
                  refreshing={soomgoInboxRefreshing}
                />
                <CrmSoomgoDrawer
                  open={soomgoDrawerOpen}
                  onClose={() => setSoomgoDrawerOpen(false)}
                  busy={soomgoBusy}
                  bridgeStatus={soomgoStatus}
                  onDispatchNotice={showDispatchNotice}
                  messageFieldCtx={{
                    customerName: intakeIdentity.customerName,
                    nickname: intakeIdentity.nickname,
                    marketerName: crmMarketerName ?? undefined,
                    pyeong: pyeong || undefined,
                    estimate:
                      scriptEstimateWon != null && Number.isFinite(scriptEstimateWon)
                        ? `${Number(scriptEstimateWon).toLocaleString('ko-KR')}원`
                        : undefined,
                  }}
                  onOpenPresetSettings={
                    canOpenSettings
                      ? () => {
                          setSoomgoDrawerOpen(false);
                          openSettings('soomgo-presets', 'personal');
                        }
                      : undefined
                  }
                />
                <CrmSoomgoStaleCleanupModal
                  open={soomgoStaleCleanupOpen}
                  onClose={() => setSoomgoStaleCleanupOpen(false)}
                  status={soomgoStatus}
                  busy={soomgoPanelBusy}
                  onStart={() => setSoomgoStaleCleanupRunning(true)}
                  onFinish={() => setSoomgoStaleCleanupRunning(false)}
                />
              </>
            ) : null}
            {misoPlatformEnabled ? (
              <CrmMisoDrawer
                open={misoDrawerOpen}
                onClose={() => setMisoDrawerOpen(false)}
                busy={misoBusy}
                bridgeStatus={misoStatus}
                onSend={sendMisoMessage}
              />
            ) : null}
          </>
        ) : null}
        <CrmContactHistoryDrawer
          open={contactHistoryOpen}
          onClose={() => {
            contactHistoryDismissedKeyRef.current = contactIdentityKey;
            setContactHistoryOpen(false);
          }}
          customerName={intakeIdentity.customerName}
          nickname={intakeIdentity.nickname}
          address={intakeIdentity.address}
          items={contactTimelineItems}
          loading={contactTimelineLoading}
          error={contactTimelineError}
        />
      </div>
  );
}
