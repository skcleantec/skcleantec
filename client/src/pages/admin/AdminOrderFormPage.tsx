import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../../components/admin/ConfirmPasswordModal';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import { AdminOrderFormFollowupPanel } from '../../components/order-followup/AdminOrderFormFollowupPanel';
import {
  getOrderForms,
  createOrderForm,
  deleteOrderForm,
  getFormConfig,
  getAdminOrderFormPhotos,
  type OrderForm,
  type OrderFormIssuerOption,
  type OrderFormListDatePreset,
  type OrderFormPhotoItem,
} from '../../api/orderform';
import { getInquiries, getInquiry } from '../../api/inquiries';
import { getToken } from '../../stores/auth';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  buildOrderFormCustomerMessage,
  getOrderFormPublicUrl,
  labelOrderFormIssuer,
  normalizeMsgConfigForEditor,
  withDefaultText,
} from '../../utils/orderFormCustomerCopy';
import type { FormMessagesState } from '../../utils/orderFormCustomerCopy';

type Tab = 'issue' | 'followup' | 'list';

const VALID_TABS: Tab[] = ['issue', 'followup', 'list'];

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
  const [photosModal, setPhotosModal] = useState<null | {
    order: OrderForm;
    loading: boolean;
    error: string | null;
    items: OrderFormPhotoItem[];
    lightbox: OrderFormPhotoItem | null;
  }>(null);
  const [issuePreviewOpen, setIssuePreviewOpen] = useState(false);
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
  const [orderForms, setOrderForms] = useState<OrderForm[]>([]);
  const [listIssuers, setListIssuers] = useState<OrderFormIssuerOption[]>([]);
  const [listDatePreset, setListDatePreset] = useState<OrderFormListDatePreset>('all');
  const [listMonthKey, setListMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [listDayKey, setListDayKey] = useState(() => kstTodayYmd());
  const [listCustomerName, setListCustomerName] = useState('');
  const [listCreatedById, setListCreatedById] = useState('');
  const [listSubmitStatus, setListSubmitStatus] = useState<'all' | 'pending' | 'submitted'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFilters = useMemo(
    () => ({
      datePreset: listDatePreset,
      ...(listDatePreset === 'month' ? { month: listMonthKey } : {}),
      ...(listDatePreset === 'day' ? { day: listDayKey } : {}),
      ...(listCustomerName.trim() ? { customerName: listCustomerName.trim() } : {}),
      ...(listCreatedById.trim() ? { createdById: listCreatedById.trim() } : {}),
      submitStatus: listSubmitStatus,
    }),
    [listDatePreset, listMonthKey, listDayKey, listCustomerName, listCreatedById, listSubmitStatus]
  );

  const hasActiveListFilters = useMemo(
    () =>
      listDatePreset !== 'all' ||
      Boolean(listCustomerName.trim()) ||
      Boolean(listCreatedById.trim()) ||
      listSubmitStatus !== 'all',
    [listDatePreset, listCustomerName, listCreatedById, listSubmitStatus]
  );

  // 발급 폼
  const [issueForm, setIssueForm] = useState(() => ({
    customerName: '',
    customerPhone: '',
    totalAmount: '',
    depositAmount: '20000',
    balanceAmount: '',
    optionNote: '',
    preferredDate: '',
    preferredTime: '오전',
    preferredTimeDetail: '',
  }));
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [pendingLinkOptions, setPendingLinkOptions] = useState<
    Array<{ id: string; customerName: string; customerPhone: string }>
  >([]);
  const [pendingLinkId, setPendingLinkId] = useState('');
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

  const refreshOrderForms = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getOrderForms(token, listFilters)
      .then((r) => {
        setOrderForms(r.items);
        if (Array.isArray(r.issuers)) setListIssuers(r.issuers);
      })
      .catch(() => setError('발주서 목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token, listFilters]);

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
    refreshOrderForms();
  }, [token, tab, refreshOrderForms]);

  useEffect(() => {
    if (!token || tab !== 'issue') return;
    getInquiries(token, { status: 'PENDING,DEPOSIT_COMPLETED,ORDER_FORM_PENDING', datePreset: 'all' })
      .then((r: { items: Array<{ id: string; customerName: string; customerPhone?: string | null }> }) => {
        setPendingLinkOptions(
          r.items.map((i) => ({
            id: i.id,
            customerName: i.customerName,
            customerPhone: (i.customerPhone ?? '').trim(),
          }))
        );
      })
      .catch(() => setPendingLinkOptions([]));
  }, [token, tab]);

  useEffect(() => {
    if (!token || tab !== 'issue' || !pendingLinkId) return;
    let cancelled = false;
    void getInquiry(token, pendingLinkId)
      .then((raw) => {
        if (cancelled) return;
        const row = raw as {
          customerName?: string | null;
          customerPhone?: string | null;
          preferredDate?: string | null;
          preferredTime?: string | null;
          preferredTimeDetail?: string | null;
        };
        const nm = row.customerName?.trim() ?? '';
        const ph = row.customerPhone?.trim() ?? '';
        const prefillDate = (row.preferredDate ?? '').trim().slice(0, 10);
        const prefillTime = (row.preferredTime ?? '').trim();
        const prefillTimeDetail = (row.preferredTimeDetail ?? '').trim();
        setIssueForm((f) => ({
          ...f,
          customerName: nm || f.customerName,
          customerPhone: ph || f.customerPhone,
          preferredDate: f.preferredDate.trim() ? f.preferredDate : prefillDate,
          preferredTime: f.preferredDate.trim()
            ? f.preferredTime
            : prefillTime || f.preferredTime,
          preferredTimeDetail: f.preferredTimeDetail.trim()
            ? f.preferredTimeDetail
            : prefillTimeDetail,
        }));
      })
      .catch(() => {
        /* ignore prefill failure */
      });
    return () => {
      cancelled = true;
    };
  }, [token, tab, pendingLinkId]);

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


  const addToTotalAmount = (delta: number) => {
    setIssueForm((f) => {
      const raw = f.totalAmount.replace(/,/g, '').trim();
      const n = parseInt(raw, 10);
      const base = Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
      return { ...f, totalAmount: String(base + delta) };
    });
  };

  const handleIssue = async () => {
    if (!token) return;
    const total = parseInt(issueForm.totalAmount.replace(/,/g, ''), 10);
    if (!issueForm.customerName.trim() || isNaN(total) || total < 0) {
      setError('고객명과 총 금액을 입력해주세요.');
      return;
    }
    setIssueLoading(true);
    setError(null);
    try {
      const deposit = issueForm.depositAmount
        ? parseInt(issueForm.depositAmount.replace(/,/g, ''), 10)
        : 20000;
      const balance = issueForm.balanceAmount
        ? parseInt(issueForm.balanceAmount.replace(/,/g, ''), 10)
        : Math.max(0, total - deposit);
      const order = await createOrderForm(token, {
        customerName: issueForm.customerName.trim(),
        customerPhone: issueForm.customerPhone.trim() || undefined,
        totalAmount: total,
        depositAmount: deposit,
        balanceAmount: balance,
        optionNote: issueForm.optionNote.trim() || undefined,
        preferredDate: issueForm.preferredDate.trim() || undefined,
        preferredTime: issueForm.preferredDate.trim() ? issueForm.preferredTime : undefined,
        preferredTimeDetail: issueForm.preferredTimeDetail.trim() || undefined,
        pendingInquiryId: pendingLinkId || undefined,
      });
      setNewOrder(order);
      setPendingLinkId('');
      setIssueForm({
        ...issueForm,
        customerName: '',
        customerPhone: '',
        totalAmount: '',
        balanceAmount: '',
        optionNote: '',
        preferredDate: '',
        preferredTime: '오전',
        preferredTimeDetail: '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '발급 실패');
    } finally {
      setIssueLoading(false);
    }
  };

  const getOrderLink = (orderToken: string) => getOrderFormPublicUrl(orderToken);

  const getOrderMessage = (order: OrderForm) => buildOrderFormCustomerMessage(msgConfig, order);

  const handleCopyPreviewModal = async () => {
    if (!previewModal) return;
    const text =
      previewModal.kind === 'message'
        ? getOrderMessage(previewModal.order)
        : getOrderLink(previewModal.order.token);
    const ok = await copyTextToClipboard(text);
    alert(
      ok
        ? '클립보드에 복사했습니다.'
        : '복사에 실패했습니다. 화면의 텍스트를 직접 선택해 복사해 주세요.'
    );
  };

  const openInNewTab = (orderToken: string) => {
    window.open(getOrderLink(orderToken), '_blank', 'noopener');
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
            <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 md:gap-x-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-5">
                <div className="md:col-span-2 lg:col-span-12">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">
                    대기 접수 연결 (선택)
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    value={pendingLinkId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPendingLinkId(v);
                      const row = pendingLinkOptions.find((x) => x.id === v);
                      if (row) {
                        setIssueForm((f) => ({
                          ...f,
                          customerName: row.customerName,
                          customerPhone: row.customerPhone || f.customerPhone,
                        }));
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
                <div className="md:col-span-2 lg:col-span-7">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">고객명 *</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="홍길동"
                    value={issueForm.customerName}
                    onChange={(e) => setIssueForm((f) => ({ ...f, customerName: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-5">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">
                    고객 전화번호 <span className="font-normal text-gray-500">(선택)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="tel"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm tabular-nums focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="비워도 발급 가능 · 입력 시 고객 발주서에 자동 반영"
                    value={issueForm.customerPhone}
                    onChange={(e) => setIssueForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  />
                  <p className="mt-1 text-fluid-2xs text-gray-500">
                    대기 접수 연결 시 접수 연락처로 채워지며, 필요하면 수정할 수 있습니다.
                  </p>
                </div>
                <div className="md:col-span-2 lg:col-span-12">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">총 금액 (원) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="150000"
                    value={issueForm.totalAmount}
                    onChange={(e) => setIssueForm((f) => ({ ...f, totalAmount: e.target.value }))}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addToTotalAmount(1_000)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-fluid-sm text-gray-800 shadow-sm hover:bg-gray-50"
                    >
                      +천원
                    </button>
                    <button
                      type="button"
                      onClick={() => addToTotalAmount(10_000)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-fluid-sm text-gray-800 shadow-sm hover:bg-gray-50"
                    >
                      +만원
                    </button>
                    <button
                      type="button"
                      onClick={() => addToTotalAmount(100_000)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-fluid-sm text-gray-800 shadow-sm hover:bg-gray-50"
                    >
                      +십만원
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-6">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">예약금 (원)</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="20000"
                    value={issueForm.depositAmount}
                    onChange={(e) => setIssueForm((f) => ({ ...f, depositAmount: e.target.value }))}
                  />
                </div>
                <div className="lg:col-span-6">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">잔금 (원)</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="비어 있으면 자동 계산"
                    value={issueForm.balanceAmount}
                    onChange={(e) => setIssueForm((f) => ({ ...f, balanceAmount: e.target.value }))}
                  />
                </div>
                <div className="lg:col-span-6">
                  <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-fluid-sm font-medium text-gray-700">청소 날짜</span>
                    <div className="flex items-center gap-2 text-fluid-sm text-gray-700">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="order-issue-date-mode"
                          checked={!issueForm.preferredDate.trim()}
                          onChange={() =>
                            setIssueForm((f) => ({ ...f, preferredDate: '' }))
                          }
                        />
                        <span>미지정</span>
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="order-issue-date-mode"
                          checked={Boolean(issueForm.preferredDate.trim())}
                          onChange={() =>
                            setIssueForm((f) => ({
                              ...f,
                              preferredDate: f.preferredDate.trim() || kstTodayYmd(),
                            }))
                          }
                        />
                        <span>지정</span>
                      </label>
                    </div>
                    <HelpTooltip
                      className="shrink-0"
                      text="「미지정」이면 고객이 발주서에서 날짜·오전/오후를 직접 선택합니다. 「지정」으로 바꾸면 관리자가 정한 날짜로 고정되고 고객은 수정할 수 없습니다."
                    />
                  </div>
                  {issueForm.preferredDate.trim() ? (
                    <YmdSelect
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm shadow-sm focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-200/80 sm:py-2"
                      value={issueForm.preferredDate}
                      onChange={(v) => setIssueForm((f) => ({ ...f, preferredDate: v }))}
                      allowEmpty
                      emitOnCompleteOnly
                      minYmd={kstTodayYmd()}
                      idPrefix="order-issue-pref"
                    />
                  ) : (
                    <div className="w-full rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-fluid-sm text-gray-500 sm:py-2">
                      고객이 발주서에서 직접 선택합니다.
                    </div>
                  )}
                </div>
                <div className="lg:col-span-6">
                  <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <label htmlFor="order-issue-preferred-time" className="text-fluid-sm font-medium text-gray-700">
                      시간대
                    </label>
                    <HelpTooltip
                      className="shrink-0"
                      text="날짜를 먼저 선택하면 시간대가 함께 저장됩니다. 날짜를 비워 두면 고객이 발주서에서 날짜와 시간대를 선택합니다."
                    />
                  </div>
                  <select
                    id="order-issue-preferred-time"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 disabled:cursor-not-allowed disabled:bg-gray-50 sm:py-2"
                    value={issueForm.preferredTime}
                    onChange={(e) => setIssueForm((f) => ({ ...f, preferredTime: e.target.value }))}
                    disabled={!issueForm.preferredDate.trim()}
                  >
                    {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-12">
                  <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <label htmlFor="order-issue-preferred-time-detail" className="text-fluid-sm font-medium text-gray-700">
                      구체적 시각 (선택)
                    </label>
                    <HelpTooltip
                      className="shrink-0"
                      text="입력 시 고객 발주서에서 수정할 수 없습니다. 비우면 고객이 직접 적을 수 있습니다."
                    />
                  </div>
                  <input
                    id="order-issue-preferred-time-detail"
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="예: 10:30, 오전 10시"
                    value={issueForm.preferredTimeDetail}
                    onChange={(e) => setIssueForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-12">
                  <label className="mb-1.5 block text-fluid-sm font-medium text-gray-700">추가 사항</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-fluid-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200/80 sm:py-2"
                    placeholder="견적 포함 추가, 현장 선택 추가 등"
                    value={issueForm.optionNote}
                    onChange={(e) => setIssueForm((f) => ({ ...f, optionNote: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-12 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3 lg:justify-start">
                  <button
                    type="button"
                    onClick={() => setIssuePreviewOpen(true)}
                    className="w-full rounded-md border border-gray-300 bg-white py-3 text-fluid-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 sm:w-auto sm:min-w-[10rem] sm:px-6 sm:py-2.5"
                  >
                    발주서 미리보기
                  </button>
                  <button
                    type="button"
                    onClick={handleIssue}
                    disabled={issueLoading}
                    className="w-full rounded-md bg-gray-800 py-3 text-fluid-sm font-medium text-white shadow-sm hover:bg-gray-900 disabled:opacity-50 sm:w-auto sm:min-w-[14rem] sm:px-8 sm:py-2.5"
                  >
                    발급 및 링크 생성
                  </button>
                </div>
              </div>
            </div>

            {newOrder && (
              <div className="mx-auto mt-8 w-full max-w-md border-t border-gray-100 pt-8 lg:mx-0 lg:max-w-none">
                <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/50 p-5 sm:p-6 lg:grid lg:grid-cols-2 lg:gap-10 lg:p-8">
                  <div className="min-w-0">
                    <p className="text-fluid-sm font-semibold text-gray-900">발급 완료</p>
                    <p className="mt-1 text-fluid-sm text-gray-600 tabular-nums">
                      {newOrder.customerName}님 · {newOrder.totalAmount.toLocaleString('ko-KR')}원
                    </p>
                  </div>
                  <div className="mt-5 min-w-0 lg:mt-0">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewModal({ kind: 'message', order: newOrder })}
                        className="rounded-md bg-gray-800 px-4 py-2 text-fluid-sm font-medium text-white shadow-sm hover:bg-gray-900"
                      >
                        메시지
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewModal({ kind: 'link', order: newOrder })}
                        className="rounded-md bg-gray-700 px-4 py-2 text-fluid-sm text-white shadow-sm hover:bg-gray-800"
                      >
                        링크
                      </button>
                      <button
                        type="button"
                        onClick={() => openInNewTab(newOrder.token)}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-800 shadow-sm hover:bg-gray-50"
                      >
                        새 창에서 열기
                      </button>
                    </div>
                    <p className="mt-3 text-fluid-2xs text-gray-600">
                      메시지 복사 후 카카오톡·문자로 고객에게 보내세요.
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-fluid-xs text-gray-600 hover:text-gray-900">
                        미리보기
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white p-3 text-fluid-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                        {getOrderMessage(newOrder)}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="min-w-0 w-full max-w-full">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/90 px-3 py-3 sm:px-4">
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
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
            ) : orderForms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">
                {hasActiveListFilters ? '조건에 맞는 발주서가 없습니다.' : '발급된 발주서가 없습니다.'}
              </div>
            ) : (
              <>
                <p className="border-b border-gray-100 px-4 py-2 text-fluid-xs text-gray-600 lg:hidden">
                  카드 하단에서 메시지·링크·새 창을 누르세요. PC(큰 화면)에서는 표가 보입니다.
                </p>
                <div className="flex flex-col gap-3 p-3 lg:hidden">
                  {orderForms.map((o) => {
                    const resv = formatOrderFormReservationCell(o);
                    const issuer = labelOrderFormIssuer(o.createdBy ?? undefined);
                    return (
                      <div
                        key={o.id}
                        className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-fluid-sm font-semibold text-gray-900">{o.customerName}</p>
                          <p className="mt-1 text-fluid-xs text-gray-500">
                            발급 {formatDateCompactWithWeekday(o.createdAt)} · 담당 {issuer}
                          </p>
                          <p
                            className="mt-1.5 text-fluid-xs leading-snug text-gray-700"
                            title={resv.title || undefined}
                          >
                            <span className="font-medium text-gray-600">예약일</span>{' '}
                            <span className="tabular-nums text-gray-900">{resv.dateText}</span>
                          </p>
                          {resv.detailText ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-fluid-2xs leading-snug text-gray-600"
                              title={resv.detailText}
                            >
                              {resv.detailText}
                            </p>
                          ) : null}
                          {o.optionNote?.trim() ? (
                            <p
                              className="mt-1 line-clamp-2 text-fluid-2xs text-gray-600"
                              title={o.optionNote.trim()}
                            >
                              {o.optionNote.trim()}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-fluid-xs">
                            <span className="tabular-nums font-medium text-gray-900">
                              {o.totalAmount.toLocaleString('ko-KR')}원
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-fluid-2xs font-medium ${
                                o.submittedAt ? 'bg-green-50 text-green-800 ring-1 ring-green-200' : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
                              }`}
                            >
                              {o.submittedAt ? '제출완료' : '미제출'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-gray-100 pt-2.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModal({ kind: 'message', order: o })}
                            className="text-fluid-xs font-medium text-blue-600 hover:underline"
                          >
                            메시지
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewModal({ kind: 'link', order: o })}
                            className="text-fluid-xs font-medium text-gray-800 hover:underline"
                          >
                            링크
                          </button>
                          <button
                            type="button"
                            onClick={() => openInNewTab(o.token)}
                            className="text-fluid-xs text-gray-600 hover:underline"
                          >
                            새 창
                          </button>
                          <button
                            type="button"
                            onClick={() => void openPhotosModal(o)}
                            className="text-fluid-xs font-medium text-emerald-700 hover:underline"
                          >
                            사진
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(o)}
                            className="text-fluid-xs font-medium text-red-600 hover:underline"
                          >
                            삭제
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
                        <col className="w-[17%]" />
                        <col className="w-[15%]" />
                        <col className="w-[11%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                        <col className="w-[21%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-100">
                          <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-100 px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            고객명
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            예약일
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            담당
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            총액
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            상태
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            발급일
                          </th>
                          <th className="px-1 py-1.5 text-center text-fluid-2xs font-medium text-gray-700 xl:px-1.5 xl:py-2 2xl:text-fluid-xs">
                            링크
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderForms.map((o) => {
                          const issuer = labelOrderFormIssuer(o.createdBy ?? undefined);
                          const resv = formatOrderFormReservationCell(o);
                          return (
                            <tr key={o.id} className="group hover:bg-gray-50">
                              <td
                                className="sticky left-0 z-10 min-w-0 border-b border-r border-gray-100 bg-white px-1 py-1 align-middle group-hover:bg-gray-50 xl:px-1.5 xl:py-1.5"
                                title={o.customerName}
                              >
                                <span className="block truncate text-left font-medium text-gray-900 xl:text-fluid-xs">
                                  {o.customerName}
                                </span>
                              </td>
                              <td
                                className="min-w-0 border-b border-gray-100 px-1 py-1 align-middle text-center text-gray-700 xl:px-1.5 xl:py-1.5"
                                title={resv.title || undefined}
                              >
                                <span className="block truncate text-fluid-2xs tabular-nums leading-tight text-gray-900 xl:text-fluid-xs">
                                  {resv.dateText}
                                </span>
                                {resv.detailText ? (
                                  <span className="mt-0.5 block truncate text-fluid-2xs leading-tight text-gray-500 xl:text-fluid-xs">
                                    {resv.detailText}
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className="min-w-0 truncate border-b border-gray-100 px-1 py-1 align-middle text-center text-gray-600 xl:px-1.5 xl:py-1.5"
                                title={issuer}
                              >
                                {issuer}
                              </td>
                              <td className="min-w-0 border-b border-gray-100 px-1 py-1 align-middle text-right tabular-nums text-gray-700 xl:px-1.5 xl:py-1.5">
                                {o.totalAmount.toLocaleString('ko-KR')}원
                              </td>
                              <td className="min-w-0 border-b border-gray-100 px-1 py-1 align-middle text-center xl:px-1.5 xl:py-1.5">
                                {o.submittedAt ? (
                                  <span className="text-fluid-2xs font-medium text-green-600 xl:text-fluid-xs">
                                    제출완료
                                  </span>
                                ) : (
                                  <span className="text-fluid-2xs text-gray-500 xl:text-fluid-xs">미제출</span>
                                )}
                              </td>
                              <td
                                className="min-w-0 border-b border-gray-100 px-1 py-1 align-middle text-center tabular-nums text-gray-600 xl:px-1.5 xl:py-1.5"
                                title={formatDateCompactWithWeekday(o.createdAt)}
                              >
                                <span className="block truncate text-fluid-2xs leading-tight xl:text-fluid-xs">
                                  {formatDateCompactWithWeekday(o.createdAt)}
                                </span>
                              </td>
                              <td className="min-w-0 border-b border-gray-100 px-1 py-1 align-middle xl:px-1.5 xl:py-1.5">
                                <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModal({ kind: 'message', order: o })}
                                    className="shrink-0 text-fluid-2xs font-medium text-blue-600 hover:underline xl:text-fluid-xs"
                                  >
                                    메시지
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModal({ kind: 'link', order: o })}
                                    className="shrink-0 text-fluid-2xs font-medium text-gray-800 hover:underline xl:text-fluid-xs"
                                  >
                                    링크
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openInNewTab(o.token)}
                                    className="shrink-0 text-fluid-2xs text-gray-600 hover:underline xl:text-fluid-xs"
                                  >
                                    새 창
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void openPhotosModal(o)}
                                    className="shrink-0 text-fluid-2xs font-medium text-emerald-700 hover:underline xl:text-fluid-xs"
                                  >
                                    사진
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(o)}
                                    className="shrink-0 text-fluid-2xs font-medium text-red-600 hover:underline xl:text-fluid-xs"
                                  >
                                    삭제
                                  </button>
                                </div>
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
            {orderForms.length > 0 && !loading && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-fluid-xs text-gray-600">
                <span className="lg:hidden">총 {orderForms.length}건 · 모바일은 카드 요약 · </span>
                <span className="hidden lg:inline">총 {orderForms.length}건 · </span>
                발주서 목록(최근 발급 순)
                <span className="hidden lg:inline">
                  {' '}
                  · 표는 고정 폭·말줄임으로 한 화면에 맞춤(매우 좁을 때만 하단 막대)
                </span>
                <span className="lg:hidden"> · 카드에서 메시지·링크·새 창</span>
              </div>
            )}
          </div>
        </div>
      )}

      {issuePreviewOpen &&
        createPortal(
          (() => {
            const parsedTotal = parseInt(issueForm.totalAmount.replace(/,/g, ''), 10);
            const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
            const parsedDeposit = parseInt(issueForm.depositAmount.replace(/,/g, ''), 10);
            const deposit = Number.isFinite(parsedDeposit) && parsedDeposit >= 0 ? parsedDeposit : 20000;
            const parsedBalance = parseInt(issueForm.balanceAmount.replace(/,/g, ''), 10);
            const balance =
              Number.isFinite(parsedBalance) && parsedBalance >= 0
                ? parsedBalance
                : Math.max(0, total - deposit);
            const customerName = issueForm.customerName.trim();
            const dateLocked = Boolean(issueForm.preferredDate.trim());
            const detailLocked = Boolean(issueForm.preferredTimeDetail.trim());
            const slotLabel =
              ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === issueForm.preferredTime)?.label ??
              issueForm.preferredTime;
            const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
            const footer2 = withDefaultText(msgConfig.footerNotice2, 'footerNotice2');
            const formTitleText = withDefaultText(msgConfig.formTitle, 'formTitle');
            const priceLabelText = withDefaultText(msgConfig.priceLabel, 'priceLabel');
            const reviewText = withDefaultText(msgConfig.reviewEventText, 'reviewEventText');
            return (
              <div
                className="fixed inset-0 z-[210] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
                role="presentation"
                onClick={() => setIssuePreviewOpen(false)}
              >
                <div
                  className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl border border-gray-200"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="issue-preview-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ModalCloseButton onClick={() => setIssuePreviewOpen(false)} />
                  <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4 pr-12">
                    <h2 id="issue-preview-title" className="text-fluid-base font-semibold text-gray-900">
                      발주서 미리보기
                    </h2>
                    <p className="mt-0.5 text-fluid-2xs text-gray-500">
                      고객이 받는 발주서 상단에 이렇게 보입니다. 아직 발급 전이며, 저장되지 않았습니다.
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50 p-4 space-y-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                      <h3 className="mb-2 text-base font-semibold text-gray-900 whitespace-pre-line">{formTitleText}</h3>
                      <p className="font-medium text-gray-900 tabular-nums">
                        총 금액 {total.toLocaleString('ko-KR')}원{' '}
                        <span className="whitespace-pre-line align-top">{priceLabelText}</span>
                      </p>
                      <p className="mt-1 text-gray-600 tabular-nums">
                        잔금 {balance.toLocaleString('ko-KR')}원, 예약금 {deposit.toLocaleString('ko-KR')}원
                      </p>
                      <p className="mt-1 text-xs text-gray-600 whitespace-pre-line">{reviewText}</p>
                      {issueForm.optionNote.trim() ? (
                        <p className="mt-2 text-gray-700">추가: {issueForm.optionNote.trim()}</p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm space-y-3">
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500">고객명</p>
                        <p className="text-gray-900">{customerName || <span className="text-gray-400">(미입력)</span>}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500">고객 전화번호 (선택)</p>
                        <p className="tabular-nums text-gray-900">
                          {issueForm.customerPhone.trim() ? (
                            issueForm.customerPhone.trim()
                          ) : (
                            <span className="text-gray-400">미입력 — 고객이 발주서에서 직접 입력</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500">청소 날짜</p>
                        {dateLocked ? (
                          <div className="rounded bg-gray-100 px-3 py-2 text-xs tabular-nums text-gray-700">
                            {formatDateCompactWithWeekday(issueForm.preferredDate)}{' '}
                            <span className="text-gray-500">(관리자 지정·수정 불가)</span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">고객이 발주서에서 직접 선택합니다.</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500">시간대</p>
                        {dateLocked ? (
                          <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700">
                            {slotLabel} <span className="text-gray-500">(관리자 지정·수정 불가)</span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            고객이 날짜와 함께 시간대를 선택합니다.
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500">구체적 시각</p>
                        {detailLocked ? (
                          <div className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700">
                            {issueForm.preferredTimeDetail.trim()}{' '}
                            <span className="text-gray-500">(관리자 지정·수정 불가)</span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">고객이 직접 입력할 수 있습니다.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600 space-y-1 whitespace-pre-wrap break-words">
                      <p>{footer1}</p>
                      <p>{footer2}</p>
                    </div>
                  </div>
                  <div className="shrink-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setIssuePreviewOpen(false)}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
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
                      value={getOrderLink(previewModal.order.token)}
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
