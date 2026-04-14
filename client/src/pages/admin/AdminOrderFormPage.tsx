import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YmdSelect } from '../../components/ui/DateQuerySelects';
import { AdminOrderFormNoticePage } from './AdminOrderFormNoticePage';
import { AdminOrderFormSpecialtySettingsPage } from './AdminOrderFormSpecialtySettingsPage';
import {
  getEstimateConfig,
  updateEstimateConfig,
  getEstimateOptions,
  createEstimateOption,
  updateEstimateOption,
  deleteEstimateOption,
  type EstimateOption,
} from '../../api/estimate';
import {
  getOrderForms,
  createOrderForm,
  getFormConfig,
  updateFormConfig,
  type OrderForm,
  type OrderFormConfigPublic,
  type OrderFormCreatedBy,
} from '../../api/orderform';
import { getInquiries } from '../../api/inquiries';
import { getToken } from '../../stores/auth';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import { dispatchCelebrateBarTest } from '../../utils/adminCelebrateBarTest';

type Tab = 'config' | 'messages' | 'issue' | 'list' | 'specialty' | 'notice';

const VALID_TABS: Tab[] = ['config', 'messages', 'issue', 'list', 'specialty', 'notice'];

const SUB_TAB_ORDER_STORAGE_KEY = 'skcleanteck.adminOrderFormSubTabOrder';

/** 저장 없을 때 상단 탭 기본 순서 */
const DEFAULT_SUB_TAB_ORDER: Tab[] = [
  'issue',
  'config',
  'messages',
  'list',
  'specialty',
  'notice',
];

const TAB_LABELS: Record<Tab, string> = {
  issue: '발주서 발급',
  config: '설정',
  messages: '폼 메시지',
  list: '발주서 목록',
  specialty: '발주서 설정',
  notice: '안내사항설정',
};

/** 발주서 목록 — 발급자(마케터 이름 / 관리자는 문구만) */
function labelOrderFormIssuer(user: OrderFormCreatedBy | null | undefined): string {
  if (!user) return '—';
  if (user.role === 'ADMIN') return '관리자';
  if (!user.name?.trim()) return '—';
  return user.name.trim();
}

function normalizeSubTabOrder(parsed: unknown): Tab[] {
  if (!Array.isArray(parsed)) return [...DEFAULT_SUB_TAB_ORDER];
  const seen = new Set<Tab>();
  const out: Tab[] = [];
  for (const x of parsed) {
    const t = x as Tab;
    if (VALID_TABS.includes(t) && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  for (const t of VALID_TABS) {
    if (!seen.has(t)) out.push(t);
  }
  return out;
}

function loadSubTabOrder(): Tab[] {
  try {
    const raw = localStorage.getItem(SUB_TAB_ORDER_STORAGE_KEY);
    if (!raw) return [...DEFAULT_SUB_TAB_ORDER];
    return normalizeSubTabOrder(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_SUB_TAB_ORDER];
  }
}

function fallbackCopyTextToClipboard(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Clipboard API 실패·비보안 컨텍스트 등에서 폴백 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return fallbackCopyTextToClipboard(text);
}

function parseTabParam(raw: string | null): Tab {
  if (raw && VALID_TABS.includes(raw as Tab)) return raw as Tab;
  return 'issue';
}

type FormMsgDefaultKey = keyof typeof ORDER_FORM_CONFIG_DEFAULTS;

function withDefaultText(raw: string | null | undefined, key: FormMsgDefaultKey): string {
  return orderFormConfigLine(raw, ORDER_FORM_CONFIG_DEFAULTS[key]);
}

/** 폼 메시지 탭에서 다루는 필드 (고객 안내 본문은 발주서 화면의 안내사항설정 탭에서 편집) */
type FormMessagesState = Pick<
  OrderFormConfigPublic,
  | 'formTitle'
  | 'priceLabel'
  | 'reviewEventText'
  | 'footerNotice1'
  | 'footerNotice2'
  | 'submitSuccessTitle'
  | 'submitSuccessBody'
>;

/** API 응답을 편집용 상태로: 비어 있는 항목은 기본 문구로 채워 placeholder 없이 바로 수정 가능 */
function normalizeMsgConfigForEditor(c: OrderFormConfigPublic): FormMessagesState {
  return {
    formTitle: withDefaultText(c.formTitle, 'formTitle'),
    priceLabel: withDefaultText(c.priceLabel, 'priceLabel'),
    reviewEventText: withDefaultText(c.reviewEventText, 'reviewEventText'),
    footerNotice1: withDefaultText(c.footerNotice1, 'footerNotice1'),
    footerNotice2: withDefaultText(c.footerNotice2, 'footerNotice2'),
    submitSuccessTitle: withDefaultText(c.submitSuccessTitle, 'submitSuccessTitle'),
    submitSuccessBody: withDefaultText(c.submitSuccessBody, 'submitSuccessBody'),
  };
}

export function AdminOrderFormPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTabParam(searchParams.get('tab')));
  const [subTabOrder, setSubTabOrder] = useState<Tab[]>(() => loadSubTabOrder());
  const [previewModal, setPreviewModal] = useState<null | { kind: 'message' | 'link'; order: OrderForm }>(
    null
  );
  const subNavScrollRef = useRef<HTMLDivElement>(null);
  const [showSubNavMoreLeft, setShowSubNavMoreLeft] = useState(false);
  const [showSubNavMoreRight, setShowSubNavMoreRight] = useState(false);

  const updateSubNavScrollHint = useCallback(() => {
    const el = subNavScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 2;
    const atStart = scrollLeft <= 3;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 3;
    setShowSubNavMoreLeft(hasOverflow && !atStart);
    setShowSubNavMoreRight(hasOverflow && !atEnd);
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateSubNavScrollHint());
  }, [tab, subTabOrder, updateSubNavScrollHint]);

  const persistSubTabOrder = useCallback((next: Tab[]) => {
    setSubTabOrder(next);
    try {
      localStorage.setItem(SUB_TAB_ORDER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }, []);

  const moveSubTab = useCallback(
    (index: number, delta: -1 | 1) => {
      setSubTabOrder((prev) => {
        const next = [...prev];
        const j = index + delta;
        if (j < 0 || j >= next.length) return prev;
        [next[index], next[j]] = [next[j], next[index]];
        try {
          localStorage.setItem(SUB_TAB_ORDER_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    []
  );

  const resetSubTabOrder = useCallback(() => {
    persistSubTabOrder([...DEFAULT_SUB_TAB_ORDER]);
  }, [persistSubTabOrder]);

  useEffect(() => {
    const el = subNavScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateSubNavScrollHint());
    ro.observe(el);
    window.addEventListener('resize', updateSubNavScrollHint);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSubNavScrollHint);
    };
  }, [updateSubNavScrollHint]);

  const subNavScrollStep = () => {
    const el = subNavScrollRef.current;
    if (!el) return 160;
    return Math.min(160, Math.max(80, Math.round(el.clientWidth * 0.45)));
  };

  const scrollSubNavLeft = () => {
    subNavScrollRef.current?.scrollBy({ left: -subNavScrollStep(), behavior: 'smooth' });
  };

  const scrollSubNavRight = () => {
    subNavScrollRef.current?.scrollBy({ left: subNavScrollStep(), behavior: 'smooth' });
  };

  useEffect(() => {
    setTab(parseTabParam(searchParams.get('tab')));
  }, [searchParams]);

  const goTab = (t: Tab) => {
    setTab(t);
    if (t === 'issue') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: t }, { replace: true });
    }
  };
  const [options, setOptions] = useState<EstimateOption[]>([]);
  const [orderForms, setOrderForms] = useState<OrderForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 발급 폼
  const [issueForm, setIssueForm] = useState({
    customerName: '',
    totalAmount: '',
    depositAmount: '20000',
    balanceAmount: '',
    optionNote: '',
    preferredDate: '',
    preferredTime: '오전',
    preferredTimeDetail: '',
  });
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [pendingLinkOptions, setPendingLinkOptions] = useState<Array<{ id: string; customerName: string }>>([]);
  const [pendingLinkId, setPendingLinkId] = useState('');

  // 설정 폼
  const [configForm, setConfigForm] = useState({ pricePerPyeong: '', depositAmount: '' });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionAmount, setNewOptionAmount] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

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
  const [msgSaving, setMsgSaving] = useState(false);

  const refreshConfig = () => {
    if (!token) return;
    getEstimateConfig(token).then((c) => {
      setConfigForm({
        pricePerPyeong: String(c.pricePerPyeong),
        depositAmount: String(c.depositAmount),
      });
    }).catch(() => setError('설정을 불러올 수 없습니다.'));
  };

  const refreshOptions = () => {
    if (!token) return;
    getEstimateOptions(token).then((r) => setOptions(r.items)).catch(() => {});
  };

  const refreshOrderForms = () => {
    if (!token) return;
    setLoading(true);
    getOrderForms(token)
      .then((r) => setOrderForms(r.items))
      .catch(() => setError('발주서 목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
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
    refreshConfig();
    refreshOptions();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshMsgConfig();
  }, [token]);

  useEffect(() => {
    if (!token || tab !== 'list') return;
    refreshOrderForms();
  }, [token, tab]);

  useEffect(() => {
    if (!token || tab !== 'issue') return;
    getInquiries(token, { status: 'PENDING', datePreset: 'all' })
      .then((r: { items: Array<{ id: string; customerName: string }> }) => {
        setPendingLinkOptions(r.items.map((i) => ({ id: i.id, customerName: i.customerName })));
      })
      .catch(() => setPendingLinkOptions([]));
  }, [token, tab]);

  const handleSaveConfig = async () => {
    if (!token) return;
    setConfigSaving(true);
    setError(null);
    try {
      const price = parseInt(configForm.pricePerPyeong, 10);
      const deposit = parseInt(configForm.depositAmount, 10);
      if (isNaN(price) || isNaN(deposit)) throw new Error('숫자를 입력해주세요.');
      await updateEstimateConfig(token, {
        pricePerPyeong: price,
        depositAmount: deposit,
      });
      refreshConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!token || !newOptionName.trim()) return;
    setError(null);
    try {
      await createEstimateOption(token, {
        name: newOptionName.trim(),
        extraAmount: newOptionAmount ? parseInt(newOptionAmount, 10) : 0,
      });
      setNewOptionName('');
      setNewOptionAmount('');
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    }
  };

  const handleToggleOption = async (opt: EstimateOption) => {
    if (!token) return;
    try {
      await updateEstimateOption(token, opt.id, { isActive: !opt.isActive });
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    }
  };

  const handleSaveMsgConfig = async () => {
    if (!token) return;
    setMsgSaving(true);
    setError(null);
    try {
      await updateFormConfig(token, {
        formTitle: msgConfig.formTitle || undefined,
        priceLabel: msgConfig.priceLabel || undefined,
        reviewEventText: msgConfig.reviewEventText || undefined,
        footerNotice1: msgConfig.footerNotice1 || undefined,
        footerNotice2: msgConfig.footerNotice2 || undefined,
        submitSuccessTitle: msgConfig.submitSuccessTitle || undefined,
        submitSuccessBody: msgConfig.submitSuccessBody || undefined,
      });
      refreshMsgConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setMsgSaving(false);
    }
  };

  const handleDeleteOption = async (opt: EstimateOption) => {
    if (!token) return;
    if (!confirm(`"${opt.name}" 옵션을 비활성화할까요?`)) return;
    try {
      await deleteEstimateOption(token, opt.id);
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

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

  const getOrderLink = (orderToken: string) =>
    `${window.location.origin}/order/${orderToken}`;

  const getCsLink = () => `${window.location.origin}/cs`;

  const getOrderMessage = (order: OrderForm) => {
    const link = getOrderLink(order.token);
    const csLink = getCsLink();
    const title = withDefaultText(msgConfig.formTitle, 'formTitle');
    const priceLabel = withDefaultText(msgConfig.priceLabel, 'priceLabel');
    const reviewText = withDefaultText(msgConfig.reviewEventText, 'reviewEventText');
    const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
    const footer2 = withDefaultText(msgConfig.footerNotice2, 'footerNotice2');

    let msg = `${title}

총 금액 ${order.totalAmount.toLocaleString('ko-KR')}원 ${priceLabel}
잔금 ${order.balanceAmount.toLocaleString('ko-KR')}원, 예약금 ${order.depositAmount.toLocaleString('ko-KR')}원
${reviewText}`;

    if (order.preferredDate && order.preferredTime) {
      const slotLabel =
        ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === order.preferredTime)?.label ??
        order.preferredTime;
      msg += `\n청소일시: ${order.preferredDate} (${slotLabel})`;
    }
    if (order.preferredTimeDetail?.trim()) {
      msg += `\n희망 시각: ${order.preferredTimeDetail.trim()}`;
    }
    if (order.optionNote) {
      msg += `\n${order.optionNote}`;
    }

    msg += `

아래 링크에서 예약확정서를 작성해 주세요.
${link}

청소 후 청소팀 태도, 고객 불편 관련 신고는 본사에 직접 요청해주시면 바로 시정처리 해드리겠습니다.
신고 URL: ${csLink}

${footer1}
${footer2}`;

    return msg;
  };

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

  const tabClass = (t: Tab) =>
    `inline-flex items-center px-2 sm:px-3 py-2 text-[clamp(0.6rem,1.4vw,0.875rem)] font-medium rounded whitespace-nowrap shrink-0 flex-none break-keep ${tab === t ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="min-w-0 w-full max-w-full">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">발주서</h1>

      <div className="mb-6 w-full min-w-0">
        <div className="relative min-w-0">
          <div
            ref={subNavScrollRef}
            onScroll={updateSubNavScrollHint}
            className="flex flex-nowrap items-center gap-1 sm:gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
            role="tablist"
            aria-label="발주서 하위 메뉴"
          >
            {subTabOrder.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => goTab(t)}
                className={tabClass(t)}
                aria-label={t === 'notice' ? '안내사항설정' : undefined}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          {showSubNavMoreLeft && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center justify-start lg:hidden">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-gray-50 via-gray-50/95 to-transparent"
                aria-hidden
              />
              <button
                type="button"
                onClick={scrollSubNavLeft}
                className="pointer-events-auto relative ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
                aria-label="하위 메뉴가 왼쪽으로 더 있습니다. 탭하면 스크롤됩니다."
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          {showSubNavMoreRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center justify-end lg:hidden">
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-gray-50 via-gray-50/95 to-transparent"
                aria-hidden
              />
              <button
                type="button"
                onClick={scrollSubNavRight}
                className="pointer-events-auto relative mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
                aria-label="하위 메뉴가 오른쪽으로 더 있습니다. 탭하면 스크롤됩니다."
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
      )}

      {tab === 'config' && (
        <div className="space-y-6">
          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-1">발주서 화면 하위 메뉴 순서</h2>
            <p className="text-sm text-gray-500 mb-4">
              상단 탭(발주서 발급·설정 등) 표시 순서를 바꿉니다. 이 브라우저에만 저장됩니다.
            </p>
            <ul className="space-y-2 max-w-md">
              {subTabOrder.map((t, i) => (
                <li
                  key={t}
                  className="flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 border border-gray-100 rounded text-sm"
                >
                  <span className="text-gray-900 font-medium">{TAB_LABELS[t]}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSubTab(i, -1)}
                      disabled={i === 0}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label={`${TAB_LABELS[t]} 위로`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSubTab(i, 1)}
                      disabled={i === subTabOrder.length - 1}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label={`${TAB_LABELS[t]} 아래로`}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={resetSubTabOrder}
              className="mt-4 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50"
            >
              기본 순서로 초기화
            </button>
          </section>

          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">견적 기본 설정</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-sm text-gray-600 mb-1">평당 금액 (원)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  value={configForm.pricePerPyeong}
                  onChange={(e) => setConfigForm((f) => ({ ...f, pricePerPyeong: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약금 (원)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  value={configForm.depositAmount}
                  onChange={(e) => setConfigForm((f) => ({ ...f, depositAmount: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="mt-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              저장
            </button>
          </section>

          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">추가 옵션</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="옵션명 (예: 현장 선택 추가)"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
              />
              <input
                type="number"
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="추가금액"
                value={newOptionAmount}
                onChange={(e) => setNewOptionAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddOption}
                className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
              >
                추가
              </button>
            </div>
            <ul className="space-y-2">
              {options.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className={opt.isActive ? '' : 'text-gray-400 line-through'}>
                    {opt.name} {opt.extraAmount > 0 ? `+${opt.extraAmount.toLocaleString('ko-KR')}원` : ''}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOption(opt)}
                      className="text-xs text-gray-600"
                    >
                      {opt.isActive ? '비활성' : '활성'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOption(opt)}
                      className="text-xs text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-6">
          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">폼 메시지 편집</h2>
            <p className="text-sm text-gray-500 mb-4">
              고객이 보는 발주서 폼에 표시되는 문구를 수정할 수 있습니다. 저장 후 발급되는 새 발주서부터 적용됩니다.
            </p>
            <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <span className="font-medium text-gray-800">고객 안내사항</span> 본문과 동의란 링크 문구는{' '}
              <Link to="/admin/orderforms?tab=notice" className="text-blue-600 underline hover:text-blue-800">
                안내사항설정
              </Link>{' '}
              메뉴에서 편집합니다.
            </p>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm text-gray-600 mb-1">폼 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.formTitle}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">금액 라벨 (예: 특가)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.priceLabel ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">리뷰 이벤트 문구</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.reviewEventText ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 1</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.footerNotice1 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 2</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.footerNotice2 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.submitSuccessTitle ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 안내</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.submitSuccessBody ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessBody: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveMsgConfig}
              disabled={msgSaving}
              className="mt-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              저장
            </button>
          </section>

          <section className="p-4 bg-gray-50 border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-3">미리보기</h2>
            <div className="bg-white p-4 rounded border border-gray-200 text-sm max-w-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                {withDefaultText(msgConfig.formTitle, 'formTitle')}
              </h3>
              <p className="font-medium text-gray-900">
                총 금액 150,000원 {withDefaultText(msgConfig.priceLabel, 'priceLabel')}
              </p>
              <p className="text-gray-600 mt-1">잔금 130,000원, 예약금 20,000원</p>
              <p className="text-gray-800 text-xs mt-1">
                {withDefaultText(msgConfig.reviewEventText, 'reviewEventText')}
              </p>
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-700">
                <p>{withDefaultText(msgConfig.footerNotice1, 'footerNotice1')}</p>
                <p>{withDefaultText(msgConfig.footerNotice2, 'footerNotice2')}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'issue' && (
        <div className="p-4 bg-white border border-gray-200 rounded max-w-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-base font-medium text-gray-900">발주서 발급</h2>
            <button
              type="button"
              onClick={() => dispatchCelebrateBarTest()}
              className="shrink-0 px-3 py-1.5 border border-amber-500 bg-amber-50 text-amber-900 rounded text-xs font-medium hover:bg-amber-100 w-fit"
            >
              접수 축하 상단 바 미리보기
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            「대기 접수 연결」에서 개별 접수로 등록한 대기 건을 선택하면, 같은 건에 링크가 붙고 고객이 제출 시 접수로 전환됩니다.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">대기 접수 연결 (선택)</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                value={pendingLinkId}
                onChange={(e) => {
                  const v = e.target.value;
                  setPendingLinkId(v);
                  const row = pendingLinkOptions.find((x) => x.id === v);
                  if (row) {
                    setIssueForm((f) => ({ ...f, customerName: row.customerName }));
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
            <div>
              <label className="block text-sm text-gray-600 mb-1">고객명 *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="홍길동"
                value={issueForm.customerName}
                onChange={(e) => setIssueForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">총 금액 (원) *</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="150000"
                value={issueForm.totalAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => addToTotalAmount(1_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +천원
                </button>
                <button
                  type="button"
                  onClick={() => addToTotalAmount(10_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +만원
                </button>
                <button
                  type="button"
                  onClick={() => addToTotalAmount(100_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +십만원
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">예약금 (원)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="20000"
                value={issueForm.depositAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, depositAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">잔금 (원)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="비어 있으면 자동 계산"
                value={issueForm.balanceAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, balanceAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">청소 날짜</label>
              <YmdSelect
                className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
                value={issueForm.preferredDate}
                onChange={(v) => setIssueForm((f) => ({ ...f, preferredDate: v }))}
                allowEmpty
                emitOnCompleteOnly
                idPrefix="order-issue-pref"
              />
              <p className="text-xs text-gray-500 mt-1">
                비워 두면 고객이 발주서에서 날짜·오전/오후를 직접 선택합니다. 지정하면 고객은 수정할 수 없습니다.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">시간대</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
              {!issueForm.preferredDate.trim() && (
                <p className="text-xs text-gray-500 mt-1">날짜를 먼저 선택하면 함께 저장됩니다. (날짜 미지정 시 고객이 선택)</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">구체적 시각 (선택)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="예: 10:30, 오전 10시"
                value={issueForm.preferredTimeDetail}
                onChange={(e) => setIssueForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                입력 시 고객 발주서에서 수정할 수 없습니다. 비우면 고객이 직접 적을 수 있습니다.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">추가 사항</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="견적 포함 추가, 현장 선택 추가 등"
                value={issueForm.optionNote}
                onChange={(e) => setIssueForm((f) => ({ ...f, optionNote: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={handleIssue}
              disabled={issueLoading}
              className="w-full py-2 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
            >
              발급 및 링크 생성
            </button>
          </div>

          {newOrder && (
            <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm font-medium text-gray-900">발급 완료</p>
              <p className="text-sm text-gray-600 mt-1">
                {newOrder.customerName}님 · {newOrder.totalAmount.toLocaleString('ko-KR')}원
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModal({ kind: 'message', order: newOrder })}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded font-medium"
                >
                  메시지
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal({ kind: 'link', order: newOrder })}
                  className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
                >
                  링크
                </button>
                <button
                  type="button"
                  onClick={() => openInNewTab(newOrder.token)}
                  className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  새 창에서 열기
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">메시지 복사 후 카카오톡·문자로 고객에게 보내세요.</p>
              <details className="mt-2">
                <summary className="text-xs text-gray-600 cursor-pointer">미리보기</summary>
                <pre className="mt-1 p-3 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {getOrderMessage(newOrder)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <div className="min-w-0 w-full max-w-full">
          <div className="rounded-lg border border-gray-200 bg-white">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">로딩 중...</div>
            ) : orderForms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-fluid-sm">발급된 발주서가 없습니다.</div>
            ) : (
              <>
                <p className="border-b border-gray-100 px-4 pt-2 text-fluid-2xs text-gray-500 md:hidden">
                  하단 막대·◀▶ 또는 표를 좌우로 밀기
                </p>
                <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[640px] border-separate border-spacing-0 text-fluid-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="sticky left-0 z-20 border-b border-r border-gray-200 bg-gray-100 py-2 px-2 text-center text-fluid-2xs font-medium text-gray-700 sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                        고객명
                      </th>
                      <th className="w-[4.25rem] max-w-[4.25rem] sm:w-[5rem] sm:max-w-[5rem] border-b border-gray-200 py-1.5 px-1 text-center text-[10px] leading-tight font-medium text-gray-700 whitespace-nowrap">
                        담당
                      </th>
                      <th className="border-b border-gray-200 py-2 px-2 text-center text-fluid-2xs font-medium text-gray-700 sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                        총액
                      </th>
                      <th className="border-b border-gray-200 py-2 px-2 text-center text-fluid-2xs font-medium text-gray-700 sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                        상태
                      </th>
                      <th className="border-b border-gray-200 py-2 px-2 text-center text-fluid-2xs font-medium text-gray-700 sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                        발급일
                      </th>
                      <th className="min-w-[11rem] border-b border-gray-200 py-2 px-2 text-center text-fluid-2xs font-medium text-gray-700 sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                        링크
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderForms.map((o) => (
                      <tr
                        key={o.id}
                        className="group hover:bg-gray-50"
                      >
                        <td className="sticky left-0 z-10 border-b border-r border-gray-100 bg-white py-2 px-2 text-left text-fluid-xs font-medium text-gray-900 sm:px-3 sm:text-fluid-sm whitespace-nowrap group-hover:bg-gray-50">
                          {o.customerName}
                        </td>
                        <td
                          className="border-b border-gray-100 py-1.5 px-1 text-left text-[10px] sm:text-[11px] leading-tight text-gray-700 max-w-[4.25rem] sm:max-w-[5rem] truncate"
                          title={labelOrderFormIssuer(o.createdBy ?? undefined)}
                        >
                          {labelOrderFormIssuer(o.createdBy ?? undefined)}
                        </td>
                        <td className="border-b border-gray-100 py-2 px-2 text-right text-fluid-xs text-gray-700 tabular-nums sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                          {o.totalAmount.toLocaleString('ko-KR')}원
                        </td>
                        <td className="border-b border-gray-100 py-2 px-2 text-center text-fluid-xs sm:px-3 sm:text-fluid-sm whitespace-nowrap">
                          {o.submittedAt ? (
                            <span className="text-green-600">제출완료</span>
                          ) : (
                            <span className="text-gray-500">미제출</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 py-2 px-2 text-center text-fluid-2xs text-gray-600 tabular-nums sm:px-3 sm:text-fluid-xs whitespace-nowrap">
                          {formatDateCompactWithWeekday(o.createdAt)}
                        </td>
                        <td className="border-b border-gray-100 py-2 px-2 align-top sm:px-3">
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-2 min-w-[9rem]">
                            <button
                              type="button"
                              onClick={() => setPreviewModal({ kind: 'message', order: o })}
                              className="text-left text-fluid-sm text-blue-600 font-medium hover:underline whitespace-nowrap shrink-0"
                            >
                              메시지
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewModal({ kind: 'link', order: o })}
                              className="text-left text-fluid-sm text-gray-800 font-medium hover:underline whitespace-nowrap shrink-0"
                            >
                              링크
                            </button>
                            <button
                              type="button"
                              onClick={() => openInNewTab(o.token)}
                              className="text-left text-fluid-sm text-gray-600 hover:underline whitespace-nowrap shrink-0"
                            >
                              새 창
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </SyncHorizontalScroll>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'specialty' && <AdminOrderFormSpecialtySettingsPage />}

      {tab === 'notice' && <AdminOrderFormNoticePage embedded />}

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
    </div>
  );
}
