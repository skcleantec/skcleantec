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
import type { CrmIntakeSavedMeta } from '../../../components/crm/intake/CrmIntakeForm';
import { CrmScriptPanel } from '../../../components/crm/scripts/CrmScriptPanel';
import { CrmPricingPanel } from '../../../components/crm/pricing/CrmPricingPanel';
import { CrmSessionBar } from '../../../components/crm/session/CrmSessionBar';
import { CrmHeaderStats } from '../../../components/crm/session/CrmHeaderStats';
import { CrmToolSideNav, CrmIconMessage } from '../../../components/crm/layout/CrmToolSideNav';
import { CrmSmsDrawer } from '../../../components/crm/sms/CrmSmsDrawer';
import { CrmSoomgoDrawer } from '../../../components/crm/soomgo/CrmSoomgoDrawer';
import { CrmSoomgoAlertDrawer, CrmIconBell } from '../../../components/crm/soomgo/CrmSoomgoAlertDrawer';
import { CrmSoomgoTopBar } from '../../../components/crm/soomgo/CrmSoomgoTopBar';
import { CrmSoomgoUpdateStrip } from '../../../components/crm/soomgo/CrmSoomgoUpdateStrip';
import { CrmIconPhone, CrmIconSoomgo } from '../../../components/crm/crmUi';
import type { SoomgoExtractedChat, SoomgoBridgeManifest, SoomgoChatAlert, SoomgoChatListSnapshotRow } from '@shared/soomgoBridge';
import { useCrmSoomgoBridge } from '../../../hooks/useCrmSoomgoBridge';
import { useSoomgoBridgeManifestRefresh } from '../../../hooks/useSoomgoBridgeManifestRefresh';
import { isSoomgoBridgeUpdateNoticeVisible } from '../../../api/soomgoBridge';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { CrmSettingsDrawer } from '../../../components/crm/settings/CrmSettingsDrawer';
import { CrmOrderIssueDrawer } from '../../../components/crm/issue/CrmOrderIssueDrawer';
import { CrmFollowupDrawer } from '../../../components/crm/followup/CrmFollowupDrawer';
import { useCrmPanelUrl } from '../../../hooks/useCrmPanelUrl';
import type { CrmOrderIssueSeed } from '../../../components/orderform/OrderIssueInlinePanel';
import { crmIntakeRequiredPermission, resolveCrmIntakeCustomerName } from '../../../components/crm/intake/crmIntakeValidation';
import {
  isCrmSafePhone,
  resolveCrmOutboundPhone,
  splitSoomgoPhones,
} from '../../../utils/crmContactPhone';
import type { CrmIntakeKind } from '../../../components/crm/intake/crmIntakeSubmit';
import {
  clearCrmIntakeDraft,
  crmIntakeDraftHasContent,
  loadCrmIntakeDraft,
  saveCrmIntakeDraft,
  type CrmIntakeFormSnapshot,
} from '../../../utils/crmIntakeDraft';
import { isTelecrmNativeApp } from '../../../utils/telecrmNativeBridge';
import {
  deriveSoomgoIntakeDefaults,
  formatSoomgoCountForCrm,
  resolveSoomgoPreferredDate,
  soomgoImportNoticeText,
  summarizeSoomgoImport,
} from '../../../utils/crmSoomgoImport';
import { useCrmConsultationQuote } from '../../../hooks/useCrmConsultationQuote';
import { telecrmQuotePayloadHasContent } from '@shared/telecrmConsultationQuote';
import {
  crmQuoteGrandTotalWon,
  crmQuoteLinesFromPayload,
  crmQuotePayloadFromState,
  crmQuoteProfessionalOptionIdsFromLines,
  type CrmPricingQuoteLine,
} from '../../../utils/crmConsultationQuoteMap';
import { linkTelecrmConsultationQuoteInquiry } from '../../../api/telecrmConsultationQuote';
import type { OrderForm } from '../../../api/orderform';
import { fitCrmPopupWindow, applyTelecrmSoomgoSplitLayout } from '../../../utils/crmSoomgoSplitLayout';
import { parseJwtPayload } from '../../../utils/jwtPayload';
import {
  dismissSoomgoInboxItems,
  loadSoomgoChatInbox,
  loadSoomgoInboxDismissals,
  pinnedSoomgoChatIds,
  saveSoomgoChatInbox,
  saveSoomgoInboxDismissals,
  syncSoomgoInboxFromScan,
  soomgoInboxPendingCount,
  toggleSoomgoInboxPin,
  upsertSoomgoChatAlerts,
  type CrmSoomgoInboxItem,
  type SoomgoInboxDismissSnapshot,
} from '../../../utils/crmSoomgoChatInbox';
import { arrangeSoomgoBridgeLayout } from '../../../api/soomgoBridge';
import { useCrmWorkBrand } from '../../../hooks/useCrmWorkBrand';
import { CrmWorkBrandBar } from '../../../components/crm/workBrand/CrmWorkBrandBar';
import {
  crmFollowupApplyFromItem,
  crmFollowupApplyFromLookupRow,
  type CrmFollowupApplySnapshot,
} from '../../../utils/crmFollowupApply';
import type { OrderFollowupItem } from '../../../api/orderFollowups';
import type { TelecrmCustomerLookupDto } from '../../../api/telecrm';
import {
  noticeForSoomgoQuoteAutoSend,
  sendSoomgoQuoteAutoMessage,
} from '../../../utils/soomgoQuoteAutoSend';

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
  const canFollowupEdit =
    permissions.me?.role === 'ADMIN' || permissions.has('followup.edit');
  const canAdsSession = permissions.has('ads.sessions');
  const canView =
    permissions.me?.role === 'ADMIN' ||
    canAccessAdminPath(permissions.me?.role, permissions.permissions, '/admin/crm');

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
  const [quoteLines, setQuoteLines] = useState<CrmPricingQuoteLine[]>([]);
  const [intakeKind, setIntakeKind] = useState<CrmIntakeKind>('absent');
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [minimumTotalAmount, setMinimumTotalAmount] = useState(0);
  const [baseEstimateOverrideWon, setBaseEstimateOverrideWon] = useState<number | null>(null);
  const [pricingResetKey, setPricingResetKey] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [lookupRefreshKey, setLookupRefreshKey] = useState(0);
  const [initialFormDraft, setInitialFormDraft] = useState<Partial<CrmIntakeFormSnapshot> | null>(null);
  const [draftRestoredPhone, setDraftRestoredPhone] = useState<string | null>(null);
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [crmContext, setCrmContext] = useState<{
    inquiryId: string | null;
    customerMatch: 'new' | 'existing' | 'pick' | 'unknown';
  }>({ inquiryId: null, customerMatch: 'new' });
  const [formResetKey, setFormResetKey] = useState(0);
  const [soomgoImportBanner, setSoomgoImportBanner] = useState<string | null>(null);
  const [soomgoImportFlashKey, setSoomgoImportFlashKey] = useState(0);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [smsDrawerOpen, setSmsDrawerOpen] = useState(false);
  const [soomgoDrawerOpen, setSoomgoDrawerOpen] = useState(false);
  const [soomgoAlertDrawerOpen, setSoomgoAlertDrawerOpen] = useState(false);
  const [soomgoInboxItems, setSoomgoInboxItems] = useState<CrmSoomgoInboxItem[]>([]);
  const [soomgoInboxRefreshing, setSoomgoInboxRefreshing] = useState(false);
  const [soomgoInboxDismissals, setSoomgoInboxDismissals] = useState<
    Map<string, SoomgoInboxDismissSnapshot>
  >(new Map());
  const [soomgoQuoteSending, setSoomgoQuoteSending] = useState(false);
  const [soomgoBridgeManifest, setSoomgoBridgeManifest] = useState<SoomgoBridgeManifest | null>(null);
  const [followupImportKey, setFollowupImportKey] = useState(0);
  const [followupImport, setFollowupImport] = useState<{
    key: number;
    snapshot: CrmFollowupApplySnapshot;
  } | null>(null);
  const dispatchNoticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftReadyRef = useRef(false);
  const formSnapshotRef = useRef<CrmIntakeFormSnapshot | null>(null);

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
    setFollowupId,
    closePanel,
    setSettingsTab,
    setCatalogScope,
    soomgoBarOpen,
    setSoomgoBarOpen,
  } = useCrmPanelUrl();

  const { openInquiryEdit, layer: inquiryEditLayer } = useCrmInquiryEdit(canView, () => {
    setLookupRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    document.title = '텔레CRM — SK클린텍';
  }, []);

  const { refreshManifest } = useSoomgoBridgeManifestRefresh(Boolean(getToken()), setSoomgoBridgeManifest);

  useEffect(() => {
    const draft = loadCrmIntakeDraft();
    if (draft && crmIntakeDraftHasContent(draft)) {
      setMode(draft.mode);
      setContactPhone(draft.contactPhone ?? draft.phone ?? '');
      setSafePhone(draft.safePhone ?? '');
      setContactUnknown(Boolean(draft.contactUnknown ?? draft.phoneUnknown));
      setCustomerName(draft.customerName);
      setPyeong(draft.pyeong);
      setInitialFormDraft({
        customerName: draft.customerName,
        nickname: draft.nickname,
        address: draft.address,
        preferredMoveInCleanYmd: draft.preferredMoveInCleanYmd,
        requestMemo: draft.requestMemo ?? '',
        roomCount: draft.roomCount ?? '',
        bathroomCount: draft.bathroomCount ?? '',
        balconyCount: draft.balconyCount ?? '',
        kind: draft.kind,
        goldDb: draft.goldDb,
      });
      const restored = (draft.contactPhone ?? draft.phone ?? '').trim();
      if (restored) setDraftRestoredPhone(restored);
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
        contactPhone,
        safePhone,
        contactUnknown,
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
    [mode, contactPhone, safePhone, contactUnknown, pyeong],
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
          savedAt: Date.now(),
        });
        setHasUnsavedDraft(true);
      }
      return;
    }
    persistDraft(form);
  }, [mode, contactPhone, safePhone, contactUnknown, pyeong, customerName, persistDraft]);

  const handleFormChange = useCallback(
    (snapshot: CrmIntakeFormSnapshot) => {
      formSnapshotRef.current = snapshot;
      if (snapshot.customerName !== customerName) setCustomerName(snapshot.customerName);
      if (snapshot.kind !== intakeKind) setIntakeKind(snapshot.kind);
      persistDraft(snapshot);
    },
    [customerName, intakeKind, persistDraft],
  );

  const handleModeChange = useCallback(
    (next: CrmCustomerMode) => {
      if (next === 'new') {
        resetQuotePricingState();
        setFormResetKey((k) => k + 1);
        setCustomerName('');
        setPyeong('');
        setInitialFormDraft({
          customerName: '',
          nickname: '',
          address: '',
          preferredMoveInCleanYmd: '',
          requestMemo: '',
          kind: 'absent',
          goldDb: false,
        });
      }
      setMode(next);
    },
    [resetQuotePricingState],
  );

  const showDispatchNotice = useCallback((message: string) => {
    setDispatchNotice(message);
    if (dispatchNoticeTimer.current) clearTimeout(dispatchNoticeTimer.current);
    dispatchNoticeTimer.current = setTimeout(() => setDispatchNotice(null), 4000);
  }, []);

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
      return;
    }
    setSoomgoInboxItems(loadSoomgoChatInbox(authUserId, workBrandSlug));
    setSoomgoInboxDismissals(loadSoomgoInboxDismissals(authUserId, workBrandSlug));
  }, [authUserId, workBrandSlug]);

  const handleSoomgoChatAlerts = useCallback(
    (alerts: SoomgoChatAlert[]) => {
      if (alerts.length === 0) return;
      setSoomgoInboxItems((prev) => {
        const { items, added, bumped } = upsertSoomgoChatAlerts(prev, alerts);
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
    [authUserId, showDispatchNotice, workBrandSlug],
  );

  const handleSoomgoChatListSnapshot = useCallback(
    (rows: SoomgoChatListSnapshotRow[]) => {
      if (rows.length === 0) return;
      setSoomgoInboxItems((prev) => {
        const next = syncSoomgoInboxFromScan(prev, rows, soomgoInboxDismissals);
        if (
          next.length === prev.length &&
          next.every(
            (row, i) =>
              row.chatId === prev[i]?.chatId &&
              row.previewText === prev[i]?.previewText &&
              row.unreadCount === prev[i]?.unreadCount,
          )
        ) {
          return prev;
        }
        if (authUserId) saveSoomgoChatInbox(authUserId, workBrandSlug, next);
        return next;
      });
    },
    [authUserId, soomgoInboxDismissals, workBrandSlug],
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
        kind: 'absent',
        goldDb: false,
      });
      setSoomgoImportBanner(null);
      setSoomgoImportFlashKey(0);
      clearCrmIntakeDraft();
      setHasUnsavedDraft(false);
      formSnapshotRef.current = null;
      pricingContextPhoneRef.current = '';
      if (notice) showDispatchNotice(notice);
    },
    [resetQuotePricingState, showDispatchNotice],
  );

  const handleIntakeReset = useCallback(() => {
    resetIntakeFormState('접수란을 초기화했습니다.');
  }, [resetIntakeFormState]);

  const handleSoomgoImport = useCallback(
    (data: SoomgoExtractedChat) => {
      resetQuotePricingState();
      const split = splitSoomgoPhones(data);
      const intakeDefaults = deriveSoomgoIntakeDefaults(data);
      const name = (data.customerName || data.nickname)?.trim() || '';
      const preferredYmd = resolveSoomgoPreferredDate(data);
      const requestMemo = (data.requestMemo || data.memo)?.trim() || '';
      const summary = summarizeSoomgoImport(data);

      setContactPhone(split.contactPhone ?? '');
      setSafePhone(split.safePhone ?? '');
      setContactUnknown(intakeDefaults.contactUnknown);
      setCustomerName(name);
      setPyeong(data.pyeong ? String(data.pyeong) : '');
      setMode('new');
      setIntakeKind(intakeDefaults.kind);
      setSoomgoImportBanner(summary.lines.join('\n'));
      setSoomgoImportFlashKey((k) => k + 1);
      setInitialFormDraft({
        customerName: name,
        nickname: name,
        address: (data.region || data.address)?.trim() || '',
        preferredMoveInCleanYmd: preferredYmd,
        requestMemo,
        roomCount: formatSoomgoCountForCrm(data.roomCount),
        bathroomCount: formatSoomgoCountForCrm(data.bathroomCount),
        balconyCount: formatSoomgoCountForCrm(data.balconyCount),
        kind: intakeDefaults.kind,
        goldDb: false,
      });
    },
    [resetQuotePricingState],
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
    openChatRoomAndExtract,
    busy: soomgoBusy,
    busyAction: soomgoBusyAction,
    busyLabel: soomgoBusyLabel,
    status: soomgoStatus,
    preview: soomgoPreview,
    bridgeUp: soomgoBridgeUp,
    error: soomgoError,
    refreshStatus: refreshSoomgoStatus,
    requestBridgeUpdate,
  } = soomgoBridge;

  const soomgoUpdateNoticeVisible = useMemo(
    () => isSoomgoBridgeUpdateNoticeVisible(soomgoStatus, soomgoBridgeManifest),
    [soomgoStatus, soomgoBridgeManifest],
  );

  const handleDismissSoomgoInbox = useCallback(
    (chatIds: string[]) => {
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
    },
    [authUserId, soomgoInboxDismissals, workBrandSlug],
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
      handleDismissSoomgoInbox([chatId]);
      void openChatRoomAndExtract(chatId);
    },
    [handleDismissSoomgoInbox, openChatRoomAndExtract],
  );

  const handleToggleSoomgoBar = useCallback(() => {
    const next = !soomgoBarOpen;
    setSoomgoBarOpen(next);
    if (next) void openSoomgo();
    else if (isPopup) fitCrmPopupWindow();
  }, [isPopup, soomgoBarOpen, setSoomgoBarOpen, openSoomgo]);

  const handleIntakeSaved = useCallback(
    (meta?: CrmIntakeSavedMeta) => {
      clearCrmIntakeDraft();
      setHasUnsavedDraft(false);
      setLookupRefreshKey((k) => k + 1);
      setStatsRefreshKey((k) => k + 1);
      if (!meta?.freshStart) return;
      resetIntakeFormState(null);
      if (soomgoBarOpen) {
        void applyTelecrmSoomgoSplitLayout(arrangeSoomgoBridgeLayout, { resizeCrm: isPopup });
      }
    },
    [isPopup, resetIntakeFormState, soomgoBarOpen],
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

  const {
    pendingQuote,
    dismissPendingQuote,
    startFreshQuote,
    saveError: quoteSaveError,
    saving: quoteSaving,
    finalizing: quoteFinalizing,
    finalizeError: quoteFinalizeError,
    finalizeQuoteHold,
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
      });
      const notice = noticeForSoomgoQuoteAutoSend(result);
      if (notice) showDispatchNotice(notice);
    } finally {
      setSoomgoQuoteSending(false);
    }
  }, [
    activeOperatingCompanyId,
    customerName,
    contactPhone,
    safePhone,
    quoteGrandTotal,
    pyeong,
    showDispatchNotice,
  ]);

  const applyFollowupToCrm = useCallback(
    (snapshot: CrmFollowupApplySnapshot, opts?: { closeDrawer?: boolean }) => {
      resetQuotePricingState();
      setMode('existing');
      setContactPhone(snapshot.contactPhone);
      setSafePhone(snapshot.safePhone);
      setContactUnknown(false);
      setCustomerName(snapshot.customerName);
      if (snapshot.pyeong) setPyeong(snapshot.pyeong);
      setIntakeKind(snapshot.kind);
      setInitialFormDraft({
        customerName: snapshot.customerName,
        nickname: snapshot.nickname,
        address: snapshot.address,
        preferredMoveInCleanYmd: snapshot.preferredMoveInCleanYmd,
        requestMemo: snapshot.requestMemo,
        kind: snapshot.kind,
        goldDb: snapshot.goldDb,
      });
      setFormResetKey((k) => k + 1);
      const nextKey = followupImportKey + 1;
      setFollowupImportKey(nextKey);
      setFollowupImport({ key: nextKey, snapshot });
      setCrmContext({
        inquiryId: snapshot.inquiryId,
        customerMatch: snapshot.inquiryId ? 'existing' : 'unknown',
      });
      showDispatchNotice('부재·보류 정보를 CRM 접수란으로 가져왔습니다.');
      if (opts?.closeDrawer !== false) closePanel();
    },
    [followupImportKey, closePanel, resetQuotePricingState, showDispatchNotice],
  );

  const handleApplyFollowupItem = useCallback(
    (item: OrderFollowupItem) => {
      applyFollowupToCrm(crmFollowupApplyFromItem(item));
    },
    [applyFollowupToCrm],
  );

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
          splitLayout={soomgoBarOpen && !isMobileApp}
          topBar={
            !isMobileApp || showWorkBrandSwitcher ? (
              <>
                {showWorkBrandSwitcher ? (
                  <CrmWorkBrandBar
                    items={workBrandItems}
                    activeSlug={workBrandActive?.slug ?? null}
                    onSwitch={handleWorkBrandSwitch}
                    switching={workBrandLoading}
                  />
                ) : null}
                {!isMobileApp && soomgoUpdateNoticeVisible ? (
                  <CrmSoomgoUpdateStrip
                    status={soomgoStatus}
                    bridgeManifest={soomgoBridgeManifest}
                    onRequestUpdate={() => void requestBridgeUpdate('install')}
                    onRefresh={() => {
                      void refreshManifest();
                      void refreshSoomgoStatus();
                    }}
                    onOpenSoomgoBar={() => setSoomgoBarOpen(true)}
                  />
                ) : null}
                {!isMobileApp ? (
                  <CrmSoomgoTopBar
                open={soomgoBarOpen}
                onClose={() => setSoomgoBarOpen(false)}
                status={soomgoStatus}
                preview={soomgoPreview}
                bridgeUp={soomgoBridgeUp}
                busy={soomgoBusy}
                busyLabel={soomgoBusyLabel}
                error={soomgoError}
                onOpenSoomgo={() => void openSoomgo()}
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
                onRequestUpdate={() => void requestBridgeUpdate('install')}
                  />
                ) : null}
              </>
            ) : undefined
          }
          header={
            <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3 py-2.5 text-white shadow-lg sm:gap-x-3 sm:px-4 sm:py-3 lg:flex-nowrap">
              <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 shadow-md shadow-indigo-900/40">
                  <CrmIconPhone className="h-5 w-5" />
                </span>
                <h1 className="shrink-0 text-fluid-sm font-bold tracking-tight whitespace-nowrap">텔레CRM</h1>
              </div>
              {canAdsSession ? (
                <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto">
                  <CrmSessionBar enabled={canAdsSession} />
                </div>
              ) : null}
              {hasUnsavedDraft ? (
                <span className="order-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-amber-100 ring-1 ring-inset ring-amber-300/30 sm:order-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                  미저장
                </span>
              ) : null}
              <CrmHeaderStats refreshKey={statsRefreshKey} />
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 lg:ml-0">
                {isMobileApp ? (
                  <button
                    type="button"
                    onClick={() => setSmsDrawerOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-fluid-xs font-semibold whitespace-nowrap text-violet-100"
                  >
                    <CrmIconMessage className="h-4 w-4" />
                    문자
                  </button>
                ) : null}
                {!isMobileApp ? (
                  <button
                    type="button"
                    onClick={handleToggleSoomgoBar}
                    className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-fluid-xs font-semibold whitespace-nowrap ${
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
                {canFollowupEdit ? (
                  <button
                    type="button"
                    onClick={() => openFollowup()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-fluid-xs font-semibold whitespace-nowrap text-amber-100 hover:bg-amber-500/25"
                  >
                    부재·보류
                  </button>
                ) : null}
                {canOrderIssue ? (
                  <button
                    type="button"
                    onClick={() => openIssue()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-fluid-xs font-semibold whitespace-nowrap text-sky-100 hover:bg-sky-500/25"
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
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-fluid-xs font-semibold whitespace-nowrap text-violet-100 hover:bg-violet-500/25"
                  >
                    설정
                  </button>
                ) : null}
                {isPopup ? (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-fluid-xs font-medium whitespace-nowrap hover:bg-white/20"
                  >
                    창 닫기
                  </button>
                ) : isMobileApp ? null : (
                  <Link
                    to="/admin/dashboard"
                    className="shrink-0 rounded-xl bg-white/10 px-3 py-1.5 text-fluid-xs font-medium whitespace-nowrap hover:bg-white/20"
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
                    disabled: soomgoBusy,
                    onClick: () => setSmsDrawerOpen(true),
                  },
                  {
                    id: 'soomgo-extract',
                    label: '정보 갖고오기',
                    icon: <CrmIconSoomgo />,
                    active: false,
                    loading: soomgoBusyAction === 'extract',
                    disabled: soomgoBusy && soomgoBusyAction !== 'extract',
                    onClick: () => void extract(),
                  },
                  {
                    id: 'soomgo-call',
                    label: '숨고 안심번호',
                    icon: <CrmIconPhone />,
                    active: false,
                    loading: soomgoBusyAction === 'call',
                    disabled: soomgoBusy && soomgoBusyAction !== 'call',
                    onClick: () => void callFromChat(),
                  },
                  {
                    id: 'soomgo-alerts',
                    label: '숨고 알림함',
                    icon: <CrmIconBell className="h-[18px] w-[18px]" />,
                    active: soomgoAlertDrawerOpen,
                    badgeCount: soomgoInboxPendingCountValue,
                    disabled: soomgoBusy,
                    onClick: () => setSoomgoAlertDrawerOpen(true),
                  },
                  {
                    id: 'soomgo-message',
                    label: '숨고 메시지',
                    icon: <CrmIconMessage />,
                    active: soomgoDrawerOpen,
                    disabled: soomgoBusy,
                    onClick: () => setSoomgoDrawerOpen(true),
                  },
                ]}
              />
            ) : undefined
          }
          left={
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              <CrmIntakePanel
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
                onPyeongChange={setPyeong}
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
                onIntakeReset={handleIntakeReset}
                onPricingReset={resetQuotePricingState}
                followupImport={followupImport}
                onSelectFollowup={canFollowupEdit ? handleSelectFollowupFromLookup : undefined}
              />
            </div>
          }
          center={
            <CrmScriptPanel
              customerName={customerName || undefined}
              pyeong={pyeong || undefined}
              estimateWon={scriptEstimateWon}
              refreshKey={catalogRefreshKey}
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
              pricePerPyeong={pricePerPyeong}
              minimumTotalAmount={minimumTotalAmount}
              baseEstimateOverrideWon={baseEstimateOverrideWon}
              onBaseEstimateOverrideChange={setBaseEstimateOverrideWon}
              onPricePerPyeongChange={setPricePerPyeong}
              onMinimumTotalAmountChange={setMinimumTotalAmount}
              quoteLines={quoteLines}
              onQuoteLinesChange={setQuoteLines}
              pendingQuote={pendingQuote}
              onLoadPendingQuote={applyPendingQuote}
              onDismissPendingQuote={dismissPendingQuote}
              onStartFreshQuote={() => void handleStartFreshQuote()}
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
            onIssued={(order) => void handleOrderIssued(order)}
          />
        ) : null}
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
        {dispatchNotice ? (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-fluid-sm text-white shadow-lg">
            {dispatchNotice}
          </div>
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
              onOpenPresetSettings={
                canOpenSettings
                  ? () => {
                      setSoomgoDrawerOpen(false);
                      openSettings('soomgo-presets', 'personal');
                    }
                  : undefined
              }
            />
          </>
        ) : null}
      </div>
    </FeatureGate>
  );
}
