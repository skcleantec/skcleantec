import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { scrollElementIntoNearestScrollContainer } from '../../utils/staffAppScrollRestore';
import { beginListRefresh, shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { createPortal } from 'react-dom';
import { Navigate, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { usePaginatedListQuery } from '../../hooks/usePaginatedListQuery';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { AdminOrderFormFollowupPanel } from '../../components/order-followup/AdminOrderFormFollowupPanel';
import { CustomerOrderSubmissionSnapshotModal } from '../../components/orderform/CustomerOrderSubmissionSnapshotModal';
import { OrderFormListActionsModal } from '../../components/orderform/OrderFormListActionsModal';
import { OrderFormIssueCompleteCard } from '../../components/orderform/OrderFormIssueCompleteCard';
import {
  getOrderForms,
  deleteOrderForm,
  getFormConfig,
  getAdminOrderFormPhotos,
  resendOrderFormSubmissionEmail,
  type OrderForm,
  type OrderFormIssuerOption,
  type OrderFormListDatePreset,
  type OrderFormPhotoItem,
} from '../../api/orderform';
import { getInquiries } from '../../api/inquiries';
import { listOrderFormTemplates, type OrderFormTemplate } from '../../api/orderFormTemplates';
import { getToken } from '../../stores/auth';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { opsDrillBannerLabel } from '../../utils/opsDrillDown';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  buildOrderFormCustomerMessage,
  getOrderFormPublicUrl,
  labelOrderFormIssuer,
  normalizeMsgConfigForEditor,
  orderFormBrandFromOperatingCompany,
} from '../../utils/orderFormCustomerCopy';
import type { FormMessagesState } from '../../utils/orderFormCustomerCopy';
import { InternalCustomerToneRadio } from '../../components/admin/InternalCustomerToneRadio';
import {
  DEFAULT_INTERNAL_CUSTOMER_TONE,
  normalizeInternalCustomerTone,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';
import { OrderFormPage } from '../order/OrderFormPage';

type Tab = 'issue' | 'followup' | 'list';

const VALID_TABS: Tab[] = ['issue', 'followup', 'list'];

function orderFormSubmissionEmailColumnLabel(o: OrderForm): string {
  if (!o.submittedAt) return '—';
  if (o.submissionEmail?.status === 'SENT') return '메일발송';
  return '미발송';
}

function orderFormSubmissionEmailColumnTitle(o: OrderForm): string | undefined {
  if (!o.submittedAt) return undefined;
  if (o.submissionEmail?.status === 'SENT') return '고객 이메일로 확인 메일이 발송되었습니다.';
  const err = o.submissionEmail?.lastError?.trim();
  if (err) return err;
  if (!o.submissionEmail) return '제출 확인 메일 발송 기록이 없습니다.';
  if (o.submissionEmail.status === 'FAILED') return '메일 발송에 실패했습니다.';
  if (o.submissionEmail.status === 'SKIPPED_NO_SMTP') return '발송 SMTP가 설정되지 않았습니다.';
  return '확인 메일이 아직 발송되지 않았습니다.';
}

function canResendOrderFormSubmissionEmail(o: OrderForm): boolean {
  if (!o.submittedAt) return false;
  const email = o.customerEmail?.trim() || o.submissionEmail?.toEmail?.trim();
  return Boolean(email);
}

function parseTabParam(raw: string | null): Tab {
  if (raw && VALID_TABS.includes(raw as Tab)) return raw as Tab;
  return 'issue';
}

/** 발주서 목록 「예약일」열·모바일 카드: 날짜(요일) + 시간대·상세 */
function formatOrderFormReservationCell(order: OrderForm): {
  dateText: string;
  detailText: string | null;
  title: string;
} {
  const raw = order.preferredDate?.trim();
  if (!raw) {
    return { dateText: '—', detailText: null, title: '' };
  }
  const dateText = formatDateCompactWithWeekday(raw);
  const slot =
    order.preferredTime &&
    (ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === order.preferredTime)?.label ?? order.preferredTime);
  const detail = order.preferredTimeDetail?.trim();
  const parts: string[] = [];
  if (slot) parts.push(slot);
  if (detail) parts.push(detail);
  const detailText = parts.length ? parts.join(' · ') : null;
  const title = detailText ? `${dateText} · ${detailText}` : dateText;
  return { dateText, detailText, title };
}

export function AdminOrderFormPage() {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const location = useLocation();
  const navigate = useNavigate();
  /** 접수 메뉴 하위로 끼워 넣은 발주서 화면 */
  const inquiriesEmbed = useMemo((): 'list' | 'followup' | 'issue' | null => {
    if (location.pathname === '/admin/inquiries/order-forms') return 'list';
    if (location.pathname === '/admin/inquiries/followup') return 'followup';
    if (location.pathname === '/admin/inquiries/order-issue') return 'issue';
    return null;
  }, [location.pathname]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTabParam(searchParams.get('tab')));
  const [previewModal, setPreviewModal] = useState<null | { kind: 'message' | 'link'; order: OrderForm }>(
    null
  );
  const [submissionViewer, setSubmissionViewer] = useState<null | { id: string; customerName: string }>(
    null
  );
  const [photosModal, setPhotosModal] = useState<null | {
    order: OrderForm;
    loading: boolean;
    error: string | null;
    items: OrderFormPhotoItem[];
    lightbox: OrderFormPhotoItem | null;
  }>(null);
  const [listActionsOrder, setListActionsOrder] = useState<OrderForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderForm | null>(null);
  useEffect(() => {
    if (inquiriesEmbed === 'list') {
      setTab('list');
      return;
    }
    if (inquiriesEmbed === 'followup') {
      setTab('followup');
      return;
    }
    if (inquiriesEmbed === 'issue') {
      setTab('issue');
      return;
    }
    setTab(parseTabParam(searchParams.get('tab')));
  }, [searchParams, inquiriesEmbed]);

  /** 부재현황은 `/admin/inquiries/followup` — 구 주소 `?tab=followup` 는 접수 쪽으로 넘김 */
  useEffect(() => {
    if (location.pathname !== '/admin/orderforms') return;
    const raw = searchParams.get('tab')?.trim().toLowerCase();
    if (raw !== 'followup') return;
    const inquiryId = searchParams.get('inquiryId')?.trim();
    const qs = inquiryId ? `?inquiryId=${encodeURIComponent(inquiryId)}` : '';
    navigate(`/admin/inquiries/followup${qs}`, { replace: true });
  }, [location.pathname, navigate, searchParams]);

  const linkedFollowupInquiryId = useMemo(
    () => searchParams.get('inquiryId')?.trim() || null,
    [searchParams]
  );
  const clearFollowupInquiryLink = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('inquiryId');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (inquiriesEmbed !== 'list') {
      setListOpsRange(null);
      return;
    }
    const from = searchParams.get('fromYmd')?.trim();
    const to = searchParams.get('toYmd')?.trim();
    const kh = searchParams.get('kstHour');
    const hour = kh != null ? parseInt(kh, 10) : NaN;
    if (from && to && Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      setListOpsRange({
        fromYmd: from,
        toYmd: to,
        kstHour: hour,
        kstTimeField: searchParams.get('kstTimeField') === 'submitted' ? 'submitted' : 'created',
      });
      const ss = searchParams.get('submitStatus')?.trim().toLowerCase();
      if (ss === 'submitted' || ss === 'pending') setListSubmitStatus(ss);
    } else {
      setListOpsRange(null);
    }
  }, [searchParams, inquiriesEmbed]);

  const [orderForms, setOrderForms] = useState<OrderForm[]>([]);
  const [listIssuers, setListIssuers] = useState<OrderFormIssuerOption[]>([]);
  /** 기본 '전체'는 행이 많을 때 첫 로드가 매우 느려져 '이번 달'을 디폴트로 둔다. */
  const [listDatePreset, setListDatePreset] = useState<OrderFormListDatePreset>('month');
  const [listMonthKey, setListMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [listDayKey, setListDayKey] = useState(() => kstTodayYmd());
  const [listCustomerName, setListCustomerName] = useState('');
  const [listCreatedById, setListCreatedById] = useState('');
  const [listSubmitStatus, setListSubmitStatus] = useState<'all' | 'pending' | 'submitted'>('all');
  const [listOpsRange, setListOpsRange] = useState<{
    fromYmd: string;
    toYmd: string;
    kstHour: number;
    kstTimeField?: 'created' | 'submitted';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { preserveScroll, scrollToTop } = useStaffAppScrollPreserve();
  const [error, setError] = useState<string | null>(null);
  const [resendEmailBusyId, setResendEmailBusyId] = useState<string | null>(null);

  const listFilterKey = useMemo(
    () =>
      JSON.stringify({
        listDatePreset,
        listMonthKey,
        listDayKey,
        listCustomerName: listCustomerName.trim(),
        listCreatedById: listCreatedById.trim(),
        listSubmitStatus,
        listOpsRange,
      }),
    [listDatePreset, listMonthKey, listDayKey, listCustomerName, listCreatedById, listSubmitStatus, listOpsRange]
  );

  const {
    listPage,
    listPageSize,
    total,
    setTotal,
    handleListPageChange,
    handleListPageSizeChange,
  } = usePaginatedListQuery(listFilterKey);

  const listFilters = useMemo(
    () => ({
      ...(listOpsRange
        ? {
            fromYmd: listOpsRange.fromYmd,
            toYmd: listOpsRange.toYmd,
            kstHour: listOpsRange.kstHour,
            kstTimeField: listOpsRange.kstTimeField,
          }
        : {
            datePreset: listDatePreset,
            ...(listDatePreset === 'month' ? { month: listMonthKey } : {}),
            ...(listDatePreset === 'day' ? { day: listDayKey } : {}),
          }),
      ...(listCustomerName.trim() ? { customerName: listCustomerName.trim() } : {}),
      ...(listCreatedById.trim() ? { createdById: listCreatedById.trim() } : {}),
      submitStatus: listSubmitStatus,
      limit: listPageSize,
      offset: (listPage - 1) * listPageSize,
    }),
    [
      listOpsRange,
      listDatePreset,
      listMonthKey,
      listDayKey,
      listCustomerName,
      listCreatedById,
      listSubmitStatus,
      listPage,
      listPageSize,
    ]
  );

  const hasActiveListFilters = useMemo(
    () =>
      listDatePreset !== 'all' ||
      Boolean(listCustomerName.trim()) ||
      Boolean(listCreatedById.trim()) ||
      listSubmitStatus !== 'all',
    [listDatePreset, listCustomerName, listCreatedById, listSubmitStatus]
  );

  const listActionsOrderResolved = useMemo(() => {
    if (!listActionsOrder) return null;
    return orderForms.find((row) => row.id === listActionsOrder.id) ?? listActionsOrder;
  }, [listActionsOrder, orderForms]);

  // 발급 폼 — 선택 양식의 폼을 인라인으로 렌더(OrderFormPage create 모드)
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  /** 발급 완료 후 인라인 폼을 초기화하기 위한 remount 키 */
  const [issueFormKey, setIssueFormKey] = useState(0);
  const issueCompleteRef = useRef<HTMLDivElement>(null);
  const pendingIssueScrollRef = useRef(false);
  const [pendingLinkOptions, setPendingLinkOptions] = useState<
    Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      internalCustomerTone?: InternalCustomerTone | null;
    }>
  >([]);
  const [issueTemplatesLoaded, setIssueTemplatesLoaded] = useState(false);
  const [pendingLinkId, setPendingLinkId] = useState('');
  const [issueInternalCustomerTone, setIssueInternalCustomerTone] =
    useState<InternalCustomerTone>(DEFAULT_INTERNAL_CUSTOMER_TONE);
  const [orderTemplates, setOrderTemplates] = useState<OrderFormTemplate[]>([]);
  const [issueTemplateId, setIssueTemplateId] = useState('');
  const [scheduleFabUnlinkedHint, setScheduleFabUnlinkedHint] = useState(false);
  const pendingInquiryFromUrlConsumed = useRef<string | null>(null);


  // 폼 메시지 설정 (빈 API와 동일하게 기본 문구로 채워 두어 첫 화면부터 실제 문구가 보임)
  const [msgConfig, setMsgConfig] = useState<FormMessagesState>(() =>
    normalizeMsgConfigForEditor({
      formTitle: '',
      priceLabel: '',
      reviewEventText: '',
      footerNotice1: '',
      footerNotice2: '',
      infoContent: null,
      infoLinkText: null,
      submitSuccessTitle: '',
      submitSuccessBody: '',
    })
  );

  const listQueryKey = useMemo(
    () => `${listFilterKey}\0${listPage}\0${listPageSize}`,
    [listFilterKey, listPage, listPageSize]
  );
  const prevListQueryKeyRef = useRef<string | null>(null);

  const refreshOrderForms = useCallback(() => {
    if (!token) return;
    beginListRefresh({
      showLoading: true,
      itemCount: orderForms.length,
      setLoading,
      preserveScroll,
    });
    getOrderForms(token, listFilters)
      .then((r) => {
        setOrderForms(r.items);
        if (Array.isArray(r.issuers)) setListIssuers(r.issuers);
        setTotal(typeof r.total === 'number' ? r.total : r.items.length);
      })
      .catch(() => {
        setError('발주서 목록을 불러올 수 없습니다.');
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [token, listFilters, setTotal, orderForms.length, preserveScroll]);

  const handleResendSubmissionEmail = async (order: OrderForm) => {
    if (!token || !canResendOrderFormSubmissionEmail(order)) return;
    setResendEmailBusyId(order.id);
    setError(null);
    try {
      const r = await resendOrderFormSubmissionEmail(token, order.id);
      if (!r.ok) {
        setError(r.submissionEmail?.lastError || '확인 메일 재발송에 실패했습니다.');
      }
      refreshOrderForms();
    } catch (e) {
      setError(e instanceof Error ? e.message : '확인 메일 재발송에 실패했습니다.');
    } finally {
      setResendEmailBusyId(null);
    }
  };

  const refreshMsgConfig = () => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => setMsgConfig(normalizeMsgConfigForEditor(c)))
      .catch(() => {
        setError('폼 메시지를 불러올 수 없습니다. 기본값으로 편집 가능합니다.');
        setMsgConfig(
          normalizeMsgConfigForEditor({
            formTitle: '',
            priceLabel: '',
            reviewEventText: '',
            footerNotice1: '',
            footerNotice2: '',
            infoContent: null,
            infoLinkText: null,
            submitSuccessTitle: '',
            submitSuccessBody: '',
          })
        );
      });
  };


  useEffect(() => {
    if (!token) return;
    refreshMsgConfig();
  }, [token]);

  useEffect(() => {
    if (!token || tab !== 'list') return;
    const prev = prevListQueryKeyRef.current;
    prevListQueryKeyRef.current = listQueryKey;
    if (prev !== null && prev !== listQueryKey) {
      scrollToTop();
    }
    refreshOrderForms();
  }, [token, tab, listQueryKey, refreshOrderForms, scrollToTop]);

  useEffect(() => {
    if (!token || tab !== 'issue') return;
    getInquiries(token, { status: 'PENDING,DEPOSIT_COMPLETED,ORDER_FORM_PENDING', datePreset: 'all' })
      .then(
        (r: {
          items: Array<{
            id: string;
            customerName: string;
            customerPhone?: string | null;
            internalCustomerTone?: InternalCustomerTone | null;
          }>;
        }) => {
        setPendingLinkOptions(
          r.items.map((i) => ({
            id: i.id,
            customerName: i.customerName,
            customerPhone: (i.customerPhone ?? '').trim(),
            internalCustomerTone: i.internalCustomerTone ?? null,
          }))
        );
      })
      .catch(() => setPendingLinkOptions([]));
  }, [token, tab]);

  // 발급 탭 — 발행된 발주서 양식 목록 로드(템플릿 선택용)
  useEffect(() => {
    if (!token || tab !== 'issue') return;
    let cancelled = false;
    setIssueTemplatesLoaded(false);
    void listOrderFormTemplates(token)
      .then((items) => {
        if (cancelled) return;
        const published = items.filter((t) => t.status === 'PUBLISHED');
        setOrderTemplates(published);
        setIssueTemplateId((prev) => {
          if (prev && published.some((t) => t.id === prev)) return prev;
          const def = published.find((t) => t.isDefault) ?? published[0];
          return def?.id ?? '';
        });
      })
      .catch(() => {
        if (!cancelled) setOrderTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setIssueTemplatesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab]);

  useEffect(() => {
    if (!token) return;
    const hint = searchParams.get('fabHint')?.trim();
    if (hint !== 'scheduleNoDetail') return;
    setScheduleFabUnlinkedHint(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('fabHint');
        return next;
      },
      { replace: true }
    );
  }, [token, searchParams, setSearchParams]);

  useEffect(() => {
    if (!token) return;
    const raw = searchParams.get('pendingInquiryId')?.trim();
    if (!raw) {
      pendingInquiryFromUrlConsumed.current = null;
      return;
    }
    if (pendingInquiryFromUrlConsumed.current === raw) return;
    pendingInquiryFromUrlConsumed.current = raw;
    setPendingLinkId(raw);
    setScheduleFabUnlinkedHint(false);
    setTab('issue');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('pendingInquiryId');
        next.delete('tab');
        return next;
      },
      { replace: true }
    );
  }, [token, inquiriesEmbed, searchParams, setSearchParams]);


  /** 인라인 발급 폼에서 발주서가 생성되면 호출 — 완료 카드 표시(폼 remount 없음 → 스크롤 유지) */
  const handleOrderCreated = (order: OrderForm) => {
    pendingIssueScrollRef.current = true;
    setNewOrder(order);
  };

  const startNewIssue = () => {
    pendingIssueScrollRef.current = false;
    setNewOrder(null);
    setPendingLinkId('');
    setIssueFormKey((k) => k + 1);
  };

  useLayoutEffect(() => {
    if (!pendingIssueScrollRef.current || !newOrder || tab !== 'issue') return;
    const el = issueCompleteRef.current;
    if (!el) return;
    pendingIssueScrollRef.current = false;
    requestAnimationFrame(() => {
      scrollElementIntoNearestScrollContainer(el, 'smooth', 16);
    });
  }, [newOrder, tab]);

  const brandSlugForOrder = (order: OrderForm) => order.operatingCompany?.slug ?? null;

  const getOrderLink = (orderToken: string, brandSlug?: string | null) =>
    getOrderFormPublicUrl(orderToken, undefined, staffTenantSlug || null, brandSlug);

  const getOrderMessage = (order: OrderForm) => {
    const { brandSlug, brandDisplayName } = orderFormBrandFromOperatingCompany(order.operatingCompany);
    return buildOrderFormCustomerMessage(
      msgConfig,
      order,
      undefined,
      staffTenantSlug || null,
      brandSlug,
      brandDisplayName,
    );
  };

  const handleCopyPreviewModal = async () => {
    if (!previewModal) return;
    const text =
      previewModal.kind === 'message'
        ? getOrderMessage(previewModal.order)
        : getOrderLink(previewModal.order.token, brandSlugForOrder(previewModal.order));
    const ok = await copyTextToClipboard(text);
    alert(
      ok
        ? '클립보드에 복사했습니다.'
        : '복사에 실패했습니다. 화면의 텍스트를 직접 선택해 복사해 주세요.'
    );
  };

  const openInNewTab = (order: OrderForm) => {
    window.open(getOrderLink(order.token, brandSlugForOrder(order)), '_blank', 'noopener');
  };

  const openPhotosModal = useCallback(async (order: OrderForm) => {
    const tk = getToken();
    if (!tk) return;
    setPhotosModal({ order, loading: true, error: null, items: [], lightbox: null });
    try {
      const r = await getAdminOrderFormPhotos(tk, order.id);
      setPhotosModal((prev) =>
        prev && prev.order.id === order.id
          ? { ...prev, loading: false, items: r.items, error: null }
          : prev
      );
    } catch (e) {
      setPhotosModal((prev) =>
        prev && prev.order.id === order.id
          ? {
              ...prev,
              loading: false,
              error: e instanceof Error ? e.message : '사진을 불러올 수 없습니다.',
            }
          : prev
      );
    }
  }, []);

  const openDeleteModal = (order: OrderForm) => {
    setDeleteTarget(order);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async (password: string) => {
    if (!token || !deleteTarget) return;
    await deleteOrderForm(token, deleteTarget.id, password);
    await refreshOrderForms();
  };


  const legacyTab = searchParams.get('tab');
  if (legacyTab === 'messages') {
    return <Navigate to="/admin/inquiries/order-customer-preview" replace />;
  }
  if (legacyTab === 'notice') {
    return <Navigate to="/admin/inquiries/order-customer-preview?panel=guide" replace />;
  }
  if (legacyTab === 'specialty') {
    return <Navigate to="/admin/inquiries/order-customer-preview?panel=specialty" replace />;
  }
  if (legacyTab === 'config') {
    return <Navigate to="/admin/inquiries/order-customer-preview" replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
      )}


      {tab === 'followup' && token && (
        <AdminOrderFormFollowupPanel
          token={token}
          linkedInquiryId={linkedFollowupInquiryId}
          onClearLinkedInquiry={linkedFollowupInquiryId ? clearFollowupInquiryLink : undefined}
        />
      )}

      {tab === 'issue' && (
        <div className="min-w-0 w-full max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-4 sm:px-6 sm:py-5">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-gray-900 sm:text-xl">
              <span>발주서 발급</span>
              <HelpTooltip
                className="shrink-0"
                text="「대기 접수 연결」에서 개별 접수로 등록한 대기 건을 선택하면, 같은 건에 링크가 붙고 고객이 제출 시 접수로 전환됩니다."
              />
            </h2>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            {scheduleFabUnlinkedHint ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-fluid-sm text-amber-950">
                <p className="font-medium">스케줄 화면에서 접수 상세를 연 상태에서 발주서 버튼을 눌러 주세요.</p>
                <p className="mt-1 text-fluid-xs text-amber-900/95">
                  상세 없이 발급하면 접수와 연결되지 않아 서비스접수 목록에는 미제출로 나오지 않고, 발주서 목록에만 보입니다.
                  아래 「대기 접수 연결」에서 해당 접수를 고르거나, 접수 상세를 연 뒤 다시 시도해 주세요.
                </p>
                <button
                  type="button"
                  className="mt-2 text-fluid-xs font-medium text-amber-900 underline hover:no-underline"
                  onClick={() => setScheduleFabUnlinkedHint(false)}
                >
                  닫기
                </button>
              </div>
            ) : null}
            <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-x-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-5">
                {orderTemplates.length > 0 ? (
                  <div className="md:col-span-2 lg:col-span-12">
                    <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">
                      발주서 양식
                    </label>
                    <select
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                      value={issueTemplateId}
                      onChange={(e) => setIssueTemplateId(e.target.value)}
                    >
                      {orderTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icon ? `${t.icon} ` : ''}
                          {t.title}
                          {t.isDefault ? ' (기본)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-fluid-2xs text-gray-500">
                      고객에게 보낼 발주서 양식을 선택합니다. 「발주서 양식」 메뉴에서 직접 만들 수 있습니다.
                    </p>
                  </div>
                ) : null}
                <div className="md:col-span-2 lg:col-span-12">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">
                    대기 접수 연결 (선택)
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    value={pendingLinkId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPendingLinkId(id);
                      const row = pendingLinkOptions.find((o) => o.id === id);
                      if (row?.internalCustomerTone) {
                        setIssueInternalCustomerTone(normalizeInternalCustomerTone(row.internalCustomerTone));
                      } else {
                        setIssueInternalCustomerTone(DEFAULT_INTERNAL_CUSTOMER_TONE);
                      }
                    }}
                  >
                    <option value="">없음 (일반 발급)</option>
                    {pendingLinkOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.customerName} · {o.id.slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-12">
                  <InternalCustomerToneRadio
                    value={issueInternalCustomerTone}
                    onChange={setIssueInternalCustomerTone}
                    name="issueInternalCustomerTone"
                  />
                </div>
              </div>
              {token ? (
                <div className="mt-5 border-t border-gray-100 pt-5">
                  <p className="mb-3 text-fluid-2xs leading-relaxed text-gray-500">
                    선택한 양식이 그대로 아래에 표시됩니다. 상담 내용을 미리 채우면 그 항목은 고객 화면에서 잠겨(수정 불가) 보이고, 비워 둔 항목은 고객이 직접 작성합니다.
                  </p>
                  {!issueTemplatesLoaded ? (
                    <p className="py-6 text-center text-fluid-sm text-gray-500">발주서 양식 불러오는 중…</p>
                  ) : (
                    <OrderFormPage
                      key={`issue-${issueTemplateId}-${issueFormKey}`}
                      editor={{
                        authToken: token,
                        inline: true,
                        create: {
                          templateId: issueTemplateId || undefined,
                          pendingInquiryId: pendingLinkId || undefined,
                          internalCustomerTone: issueInternalCustomerTone,
                          onCreated: handleOrderCreated,
                        },
                      }}
                    />
                  )}
                </div>
              ) : null}
              {newOrder ? (
                <div
                  ref={issueCompleteRef}
                  className="mx-auto mt-6 w-full max-w-md border-t border-gray-100 pt-6 lg:mx-0 lg:max-w-none"
                >
                  <OrderFormIssueCompleteCard
                    customerName={newOrder.customerName}
                    totalAmount={newOrder.totalAmount}
                    link={getOrderLink(newOrder.token, brandSlugForOrder(newOrder))}
                    message={getOrderMessage(newOrder)}
                    onCopyMessage={async () => {
                      const ok = await copyTextToClipboard(getOrderMessage(newOrder));
                      if (!ok) alert('복사에 실패했습니다.');
                    }}
                    onCopyLink={async () => {
                      const ok = await copyTextToClipboard(
                        getOrderLink(newOrder.token, brandSlugForOrder(newOrder)),
                      );
                      if (!ok) alert('복사에 실패했습니다.');
                    }}
                    onOpenNewTab={() => openInNewTab(newOrder)}
                    onPrefill={() => navigate(`/admin/order-prefill/${newOrder.id}`)}
                    onNewIssue={startNewIssue}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="min-w-0 w-full max-w-full">
          {listOpsRange ? (
            <p className="mb-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-fluid-xs text-indigo-900">
              대시보드 시간대 필터:{' '}
              {opsDrillBannerLabel({
                fromYmd: listOpsRange.fromYmd,
                toYmd: listOpsRange.toYmd,
                kstHour: String(listOpsRange.kstHour),
                label: listOpsRange.kstTimeField === 'submitted' ? '발주서 제출' : '발주서 발급',
              })}
            </p>
          ) : null}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/90 px-3 py-3 sm:px-4">
              <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-fluid-2xs font-semibold text-gray-700 shrink-0">발급일</span>
                <div className="inline-flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-sm shrink-0">
                    <button
                      type="button"
                      onClick={() => setListDatePreset('today')}
                      className={`px-3 py-1.5 font-medium ${
                        listDatePreset === 'today' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      오늘
                    </button>
                    <button
                      type="button"
                      onClick={() => setListDatePreset('all')}
                      className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                        listDatePreset === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      전체
                    </button>
                    <button
                      type="button"
                      onClick={() => setListDatePreset('month')}
                      className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                        listDatePreset === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      월별
                    </button>
                    <button
                      type="button"
                      onClick={() => setListDatePreset('day')}
                      className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                        listDatePreset === 'day' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      일별
                    </button>
                  </div>
                  {listDatePreset === 'month' && (
                    <YearMonthSelect
                      value={listMonthKey}
                      onChange={setListMonthKey}
                      idPrefix="orderform-list-month"
                      className="items-center"
                    />
                  )}
                  {listDatePreset === 'day' && (
                    <YmdSelect
                      value={listDayKey}
                      onChange={setListDayKey}
                      idPrefix="orderform-list-day"
                      className="items-center"
                    />
                  )}
                </div>
                </div>
                <ListPaginationBar
                  mode="summary"
                  page={listPage}
                  pageSize={listPageSize}
                  total={total}
                  onPageChange={handleListPageChange}
                  onPageSizeChange={handleListPageSizeChange}
                  className="shrink-0"
                />
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
                <div className="min-w-0 w-full lg:max-w-sm">
                  <label htmlFor="orderform-list-customer" className="mb-1 block text-fluid-2xs font-medium text-gray-600">
                    고객명
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="orderform-list-customer"
                      type="text"
                      value={listCustomerName}
                      onChange={(e) => setListCustomerName(e.target.value)}
                      placeholder="고객명 검색"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-fluid-sm text-gray-900"
                    />
                    {listCustomerName.trim() ? (
                      <button
                        type="button"
                        onClick={() => setListCustomerName('')}
                        className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-fluid-2xs text-gray-600 hover:bg-gray-50"
                      >
                        초기화
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 w-full lg:max-w-sm">
                  <label htmlFor="orderform-list-issuer" className="mb-1 block text-fluid-2xs font-medium text-gray-600">
                    담당(발급)
                  </label>
                  <select
                    id="orderform-list-issuer"
                    value={listCreatedById}
                    onChange={(e) => setListCreatedById(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-fluid-sm text-gray-900"
                  >
                    <option value="">전체 담당</option>
                    {listIssuers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-fluid-2xs font-semibold text-gray-700 shrink-0">상태</span>
                  {(
                    [
                      { v: 'all' as const, label: '전체' },
                      { v: 'pending' as const, label: '미제출' },
                      { v: 'submitted' as const, label: '제출완료' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setListSubmitStatus(c.v === listSubmitStatus && c.v !== 'all' ? 'all' : c.v)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] sm:text-fluid-2xs font-medium touch-manipulation ${
                        listSubmitStatus === c.v
                          ? 'border-gray-800 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {shouldShowListBlockingLoading(loading, orderForms.length) ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
            ) : orderForms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">
                {hasActiveListFilters ? '조건에 맞는 발주서가 없습니다.' : '발급된 발주서가 없습니다.'}
              </div>
            ) : (
              <>
                <p className="border-b border-slate-100 px-4 py-2.5 text-fluid-xs text-slate-500 lg:hidden font-medium">
                  카드 하단에서 메시지·링크·새 창을 누르세요. PC(큰 화면)에서는 표가 보입니다.
                </p>
                <div className="flex flex-col gap-3 p-3 lg:hidden">
                  {orderForms.map((o) => {
                    const resv = formatOrderFormReservationCell(o);
                    const issuer = labelOrderFormIssuer(o.createdBy ?? undefined);
                    return (
                      <div
                        key={o.id}
                        className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-md shadow-slate-100/40 hover:shadow-lg transition-all duration-200 overflow-hidden"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-fluid-sm font-semibold text-slate-900">{o.customerName}</p>
                          <p className="mt-1 text-fluid-xs text-slate-500">
                            발급 {formatDateCompactWithWeekday(o.createdAt)} · 담당 {issuer}
                          </p>
                          <p
                            className="mt-1.5 text-fluid-xs leading-snug text-slate-700"
                            title={resv.title || undefined}
                          >
                            <span className="font-semibold text-slate-500">예약일</span>{' '}
                            <span className="tabular-nums text-slate-900 font-medium">{resv.dateText}</span>
                          </p>
                          {resv.detailText ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-fluid-2xs leading-snug text-slate-600"
                              title={resv.detailText}
                            >
                              {resv.detailText}
                            </p>
                          ) : null}
                          {o.optionNote?.trim() ? (
                            <p
                              className="mt-1 line-clamp-2 text-fluid-2xs text-slate-600"
                              title={o.optionNote.trim()}
                            >
                              {o.optionNote.trim()}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2.5 text-fluid-xs">
                            <span className="tabular-nums font-semibold text-slate-900">
                              {o.totalAmount.toLocaleString('ko-KR')}원
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-fluid-2xs font-semibold ${
                                o.submittedAt
                                  ? 'bg-green-50 text-green-700 ring-1 ring-green-200/50'
                                  : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200/55'
                              }`}
                            >
                              {o.submittedAt ? '제출완료' : '미제출'}
                            </span>
                            {o.submittedAt ? (
                              <span
                                className={`rounded-md px-2 py-0.5 text-fluid-2xs font-medium ${
                                  o.submissionEmail?.status === 'SENT'
                                    ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/50'
                                    : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/50'
                                }`}
                                title={orderFormSubmissionEmailColumnTitle(o)}
                              >
                                {orderFormSubmissionEmailColumnLabel(o)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3.5 flex justify-end border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => setListActionsOrder(o)}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
                          >
                            설정
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block">
                  <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full table-fixed border-collapse text-fluid-2xs xl:text-fluid-xs 2xl:text-fluid-sm">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[13%]" />
                        <col className="w-[10%]" />
                        <col className="w-[11%]" />
                        <col className="w-[8%]" />
                        <col className="w-[10%]" />
                        <col className="w-[13%]" />
                        <col className="w-[8%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-200/60 bg-slate-50/80">
                          <th className="sticky left-0 z-10 border-r border-slate-200/60 bg-slate-50/90 px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            고객명
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            예약일
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            담당
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            총액
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            상태
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            이메일발송
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            발급일
                          </th>
                          <th className="px-1 py-2 text-center text-fluid-2xs font-semibold text-slate-500 xl:px-1.5 xl:py-2.5 2xl:text-fluid-xs">
                            관리
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderForms.map((o) => {
                          const issuer = labelOrderFormIssuer(o.createdBy ?? undefined);
                          const resv = formatOrderFormReservationCell(o);
                          return (
                            <tr key={o.id} className="group hover:bg-slate-50/80 transition-colors">
                              <td
                                className="sticky left-0 z-10 min-w-0 border-b border-r border-slate-100/80 bg-white px-1.5 py-2 align-middle group-hover:bg-slate-50/80 xl:px-2 xl:py-2.5"
                                title={o.customerName}
                              >
                                <span className="block truncate text-center font-semibold text-slate-900 xl:text-fluid-xs">
                                  {o.customerName}
                                </span>
                              </td>
                              <td
                                className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-center text-slate-700 xl:px-1.5 xl:py-2.5"
                                title={resv.title || undefined}
                              >
                                <span className="block truncate text-fluid-2xs tabular-nums leading-tight text-slate-900 font-medium xl:text-fluid-xs">
                                  {resv.dateText}
                                </span>
                                {resv.detailText ? (
                                  <span className="mt-0.5 block truncate text-fluid-2xs leading-tight text-slate-400 xl:text-fluid-xs">
                                    {resv.detailText}
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className="min-w-0 truncate border-b border-slate-100/80 px-1 py-2 align-middle text-center text-slate-600 xl:px-1.5 xl:py-2.5"
                                title={issuer}
                              >
                                {issuer}
                              </td>
                              <td className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-right tabular-nums text-slate-800 font-medium xl:px-1.5 xl:py-2.5">
                                {o.totalAmount.toLocaleString('ko-KR')}원
                              </td>
                              <td className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-center xl:px-1.5 xl:py-2.5">
                                {o.submittedAt ? (
                                  <span className="text-fluid-2xs font-semibold text-green-700 bg-green-50 ring-1 ring-green-200/50 rounded px-1.5 py-0.5 xl:text-fluid-xs">
                                    제출완료
                                  </span>
                                ) : (
                                  <span className="text-fluid-2xs text-slate-500 bg-slate-50 ring-1 ring-slate-200/50 rounded px-1.5 py-0.5 xl:text-fluid-xs">
                                    미제출
                                  </span>
                                )}
                              </td>
                              <td
                                className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-center xl:px-1.5 xl:py-2.5"
                                title={orderFormSubmissionEmailColumnTitle(o)}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`text-fluid-2xs rounded px-1.5 py-0.5 xl:text-fluid-xs ${
                                      !o.submittedAt
                                        ? 'text-slate-400'
                                        : o.submissionEmail?.status === 'SENT'
                                          ? 'font-semibold text-sky-700 bg-sky-50 ring-1 ring-sky-200/50'
                                          : 'font-medium text-amber-800 bg-amber-50 ring-1 ring-amber-200/50'
                                    }`}
                                  >
                                    {orderFormSubmissionEmailColumnLabel(o)}
                                  </span>
                                </div>
                              </td>
                              <td
                                className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-center tabular-nums text-slate-500 xl:px-1.5 xl:py-2.5"
                                title={formatDateCompactWithWeekday(o.createdAt)}
                              >
                                <span className="block truncate text-fluid-2xs leading-tight xl:text-fluid-xs">
                                  {formatDateCompactWithWeekday(o.createdAt)}
                                </span>
                              </td>
                              <td className="min-w-0 border-b border-slate-100/80 px-1 py-2 align-middle text-center xl:px-1.5 xl:py-2.5">
                                <button
                                  type="button"
                                  onClick={() => setListActionsOrder(o)}
                                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-fluid-2xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 xl:px-3 xl:py-1.5 xl:text-fluid-xs"
                                >
                                  설정
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </SyncHorizontalScroll>
                </div>
              </>
            )}
            {!shouldShowListBlockingLoading(loading, orderForms.length) && total > 0 ? (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
                <div className="text-fluid-xs text-gray-600">
                  <span className="lg:hidden">모바일은 카드 요약 · </span>
                  발주서 목록(최근 발급 순)
                  <span className="hidden lg:inline">
                    {' '}
                    · 표는 고정 폭·말줄임으로 한 화면에 맞춤(매우 좁을 때만 하단 막대)
                  </span>
                  <span className="lg:hidden"> · 카드에서 설정으로 관리</span>
                </div>
                <ListPaginationBar
                  mode="nav"
                  page={listPage}
                  pageSize={listPageSize}
                  total={total}
                  onPageChange={handleListPageChange}
                  onPageSizeChange={handleListPageSizeChange}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {previewModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
            role="presentation"
            onClick={() => setPreviewModal(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-preview-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={() => setPreviewModal(null)} />
              <div className="shrink-0 border-b border-gray-200 px-4 pb-3 pt-4 pr-14">
                <h2 id="order-preview-modal-title" className="text-lg font-semibold text-gray-900">
                  {previewModal.kind === 'message' ? '고객 발송용 메시지' : '발주서 링크'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {previewModal.order.customerName} · 총액 {previewModal.order.totalAmount.toLocaleString('ko-KR')}원
                  {previewModal.order.createdBy ? (
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      담당: {labelOrderFormIssuer(previewModal.order.createdBy)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {previewModal.kind === 'message' ? (
                  <pre className="whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-3 font-sans text-sm text-gray-800">
                    {getOrderMessage(previewModal.order)}
                  </pre>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">고객에게 보낼 URL</span>
                    <textarea
                      readOnly
                      rows={4}
                      className="w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900"
                      value={getOrderLink(previewModal.order.token, brandSlugForOrder(previewModal.order))}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void handleCopyPreviewModal()}
                  className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  클립보드에 복사
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {listActionsOrderResolved ? (
        <OrderFormListActionsModal
          order={listActionsOrderResolved}
          resendBusy={resendEmailBusyId === listActionsOrderResolved.id}
          canResendEmail={canResendOrderFormSubmissionEmail(listActionsOrderResolved)}
          onClose={() => setListActionsOrder(null)}
          onPreviewMessage={() =>
            setPreviewModal({ kind: 'message', order: listActionsOrderResolved })
          }
          onPreviewLink={() => setPreviewModal({ kind: 'link', order: listActionsOrderResolved })}
          onOpenNewTab={() => openInNewTab(listActionsOrderResolved)}
          onPrefill={() => navigate(`/admin/order-prefill/${listActionsOrderResolved.id}`)}
          onPhotos={() => void openPhotosModal(listActionsOrderResolved)}
          onSubmissionViewer={() =>
            setSubmissionViewer({
              id: listActionsOrderResolved.id,
              customerName: listActionsOrderResolved.customerName,
            })
          }
          onResendEmail={() => void handleResendSubmissionEmail(listActionsOrderResolved)}
          onDelete={() => openDeleteModal(listActionsOrderResolved)}
        />
      ) : null}
      <CustomerOrderSubmissionSnapshotModal
        open={Boolean(submissionViewer)}
        onClose={() => setSubmissionViewer(null)}
        authToken={token}
        orderFormId={submissionViewer?.id ?? null}
        customerName={submissionViewer?.customerName ?? ''}
      />

      <ConfirmPasswordModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget
            ? `발주서 삭제: ${deleteTarget.customerName}`
            : '발주서 삭제'
        }
        description={
          deleteTarget?.submittedAt ? (
            <>
              <p className="font-semibold">이미 제출된 발주서입니다.</p>
              <p className="mt-1">
                삭제하면 이 발주서로 생성된 <b>접수(Inquiry)도 함께 영구 삭제</b>되며,
                배정·청소 사진 등 관련 기록이 제거됩니다. <b>복구할 수 없습니다.</b>
              </p>
            </>
          ) : undefined
        }
        confirmLabel="삭제 확정"
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      {photosModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40"
            role="presentation"
            onClick={() => setPhotosModal(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-photos-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <ModalCloseButton onClick={() => setPhotosModal(null)} />
              <div className="shrink-0 border-b border-gray-200 px-4 pb-3 pt-4 pr-14">
                <h2 id="order-photos-modal-title" className="text-lg font-semibold text-gray-900">
                  현장 사진 · {photosModal.order.customerName}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  고객이 발주서에 직접 첨부한 사진입니다. 오염·특이 구역 확인 후
                  추가 견적 판단에 활용하세요.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {photosModal.loading ? (
                  <p className="py-8 text-center text-sm text-gray-500">사진을 불러오는 중…</p>
                ) : photosModal.error ? (
                  <p className="py-8 text-center text-sm text-red-600">{photosModal.error}</p>
                ) : photosModal.items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    첨부된 현장 사진이 없습니다.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {photosModal.items.map((p) => (
                      <li
                        key={p.id}
                        className="aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-100"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setPhotosModal((prev) => (prev ? { ...prev, lightbox: p } : prev))
                          }
                          className="block h-full w-full"
                          aria-label="사진 크게 보기"
                        >
                          <img
                            src={p.secureUrl}
                            alt="현장 사진"
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setPhotosModal(null)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>

            {photosModal.lightbox
              ? (() => {
                  const shot = photosModal.lightbox;
                  if (!shot) return null;
                  return (
                    <div
                      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
                      role="presentation"
                      onClick={() =>
                        setPhotosModal((prev) => (prev ? { ...prev, lightbox: null } : prev))
                      }
                    >
                      <div
                        className="relative max-h-full max-w-full"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <img
                          src={shot.secureUrl}
                          alt="현장 사진 확대"
                          className="max-h-[92vh] max-w-[92vw] rounded-md object-contain"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPhotosModal((prev) =>
                              prev ? { ...prev, lightbox: null } : prev
                            )
                          }
                          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white"
                          aria-label="닫기"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })()
              : null}
          </div>,
          document.body
        )}
    </div>
  );
}
