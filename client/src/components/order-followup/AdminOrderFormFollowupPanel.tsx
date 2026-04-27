import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  deleteOrderFollowup,
  deferOrderFollowup,
  listOrderFollowupLogs,
  listOrderFollowups,
  patchOrderFollowup,
  type OrderFollowupDatePreset,
  type OrderFollowupItem,
  type OrderFollowupLogItem,
} from '../../api/orderFollowups';
import { getInquiries } from '../../api/inquiries';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { HelpTooltip } from '../ui/HelpTooltip';
import {
  ORDER_FOLLOWUP_STATUS_LABEL,
  type OrderFollowupStatus,
} from '../../constants/orderFollowupStatus';
import { formatDateCompactWithWeekday, formatDateTimeCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromLocalDatetimeValue(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function displayPhone(phone: string | null | undefined): string {
  const t = phone?.trim() ?? '';
  return t ? t : '—';
}

/** 부재현황 편집 모달의 접수 검색 결과용 — 접수 목록 STATUS_LABELS와 동일 뜻 */
const INQUIRY_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  DEPOSIT_PENDING: '입금대기',
  DEPOSIT_COMPLETED: '입금완료',
  ORDER_FORM_PENDING: '미제출',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

function statusLabelKo(code: string): string {
  if (code in ORDER_FOLLOWUP_STATUS_LABEL) {
    return ORDER_FOLLOWUP_STATUS_LABEL[code as OrderFollowupStatus];
  }
  return code;
}

function roleLabelKo(role: string): string {
  const map: Record<string, string> = {
    ADMIN: '관리자',
    MARKETER: '마케터',
    TEAM_LEADER: '팀장',
    EXTERNAL_PARTNER: '협력사',
  };
  return map[role] ?? role;
}

function actionLabelKo(action: string): string {
  const map: Record<string, string> = {
    CREATE: '등록',
    STATUS: '상태 변경',
    MEMO: '메모',
    NEXT_CONTACT: '다음 연락',
    DEFER: '부재 누적',
    GOLD_DB: '골드DB',
    CUSTOMER_NAME: '고객명 변경',
    NICKNAME: '닉네임 변경',
    LINK_ORDERFORM: '발주서 연결(구버전 기록)',
    UNLINK_ORDERFORM: '발주서 연결 해제(구버전 기록)',
    INQUIRY_LINK: '접수 연결',
  };
  return map[action] ?? action;
}

export const FOLLOWUP_PANEL_HELP =
  '전화 부재·보류 등 후속 관리입니다.\n' +
  '이 화면에서는 부재·보류 건만 목록·필터합니다. 재연락 후 이용 확정이면 편집에서 「예약금 대기」또는「입금 완료」로 바꾸면 접수가 자동으로 만들어지고 접수 목록에서 이어갈 수 있습니다.\n' +
  '등록일로 범위를 좁힌 뒤, 상단 칩으로 「부재」「보류」를 골라 볼 수 있습니다.\n' +
  '재연락 후에도 부재·보류가 이어지면 「부재+1」로 누적 횟수를 올릴 수 있습니다.\n' +
  '편집에서 「골드DB」를 켜면 고급 DB로 올릴 때까지 집중이 필요한 건으로, 목록에서 노란 배경으로 표시됩니다.\n' +
  '「골드DB만」을 켜면 골드DB 건만 목록에 남깁니다. 안내는 화면 상단 ? 아이콘에서 볼 수 있습니다.';

/** 로그 `detail` 을 화면용 한글 설명으로 */
function logDetailDescription(log: OrderFollowupLogItem): string {
  const d = log.detail?.trim();
  if (!d) {
    if (log.action === 'UNLINK_ORDERFORM') return '발주서 연결을 해제했습니다.';
    return '—';
  }

  if (log.action === 'MEMO') {
    return d ? `메모: ${d}` : '메모를 비웠습니다.';
  }

  if (log.action === 'NEXT_CONTACT') {
    const t = new Date(d);
    if (!Number.isNaN(t.getTime())) {
      return `다음 연락 시각을 ${formatDateTimeCompactWithWeekday(t.toISOString())}(으)로 설정했습니다.`;
    }
    return `다음 연락: ${d}`;
  }

  try {
    const j = JSON.parse(d) as Record<string, unknown>;

    if (log.action === 'CREATE') {
      const name = typeof j.customerName === 'string' ? j.customerName.trim() : '';
      const nick = typeof j.nickname === 'string' ? j.nickname.trim() : '';
      const phone = typeof j.customerPhone === 'string' ? j.customerPhone.trim() : '';
      const st = typeof j.status === 'string' ? statusLabelKo(j.status) : '';
      const head = name
        ? `「${name}${nick ? `(${nick})` : ''}」고객을 새로 등록했습니다.`
        : '신규 건을 등록했습니다.';
      const stPart = st ? ` 초기 상태는 「${st}」입니다.` : '';
      const phPart = phone ? ` 연락처: ${phone}.` : ' 연락처는 비어 있습니다.';
      const inqPart =
        typeof j.inquiryId === 'string' && j.inquiryId.trim() ? ' 특정 접수에 연결해 등록했습니다.' : '';
      return `${head}${stPart}${phPart}${inqPart}`;
    }

    if (log.action === 'INQUIRY_LINK' && typeof j.from !== 'undefined') {
      const to = j.to === null || j.to === undefined || j.to === '' ? null : String(j.to);
      const from =
        j.from === null || j.from === undefined || j.from === '' ? null : String(j.from);
      if (!from && to) return `접수와 연결했습니다.`;
      if (from && !to) return '접수 연결을 해제했습니다.';
      if (from && to) return '연결된 접수를 다른 접수로 바꿨습니다.';
      return '접수 연결을 변경했습니다.';
    }

    if (log.action === 'STATUS' && typeof j.from === 'string' && typeof j.to === 'string') {
      return `상태를 「${statusLabelKo(j.from)}」에서 「${statusLabelKo(j.to)}」(으)로 바꿨습니다.`;
    }

    if (log.action === 'CUSTOMER_NAME' && typeof j.from === 'string' && typeof j.to === 'string') {
      return `고객명을 「${j.from}」에서 「${j.to}」(으)로 바꿨습니다.`;
    }

    if (log.action === 'NICKNAME') {
      const from = typeof j.from === 'string' && j.from.trim() ? j.from.trim() : null;
      const to = typeof j.to === 'string' && j.to.trim() ? j.to.trim() : null;
      if (from && to) return `닉네임을 「${from}」에서 「${to}」(으)로 바꿨습니다.`;
      if (!from && to) return `닉네임을 「${to}」(으)로 설정했습니다.`;
      if (from && !to) return '닉네임을 비웠습니다.';
      return '닉네임을 업데이트했습니다.';
    }

    if (log.action === 'DEFER') {
      const n = typeof j.deferCount === 'number' ? j.deferCount : Number(j.deferCount);
      const note = typeof j.note === 'string' && j.note.trim() ? j.note.trim() : '';
      const head = Number.isFinite(n) ? `부재·재연락 누적을 ${n}회차로 올렸습니다.` : '부재·재연락 누적을 올렸습니다.';
      return note ? `${head} 메모: ${note}` : head;
    }

    if (log.action === 'GOLD_DB' && typeof j.goldDb === 'boolean') {
      return j.goldDb
        ? '골드DB로 표시했습니다. (고급 DB 전까지 집중 관리)'
        : '골드DB 표시를 해제했습니다.';
    }

    if (log.action === 'LINK_ORDERFORM' && typeof j.orderFormId === 'string') {
      return '(과거 기능) 발주서와 연결해 처리 완료로 바꾼 기록입니다.';
    }
  } catch {
    /* fall through */
  }

  return d.length > 200 ? `${d.slice(0, 200)}…` : d;
}

function statusToneClass(status: OrderFollowupStatus): string {
  return status === 'FULFILLED'
    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
    : status === 'RESERVED'
      ? 'bg-blue-50 text-blue-900 border border-blue-200'
      : status === 'ON_HOLD'
        ? 'bg-amber-50 text-amber-950 border border-amber-200'
        : status === 'DEPOSIT_PENDING'
          ? 'bg-orange-50 text-orange-900 border border-orange-200'
          : 'bg-gray-100 text-gray-800 border border-gray-200';
}

const STATUS_BADGE_BASE =
  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] sm:text-fluid-2xs font-semibold tabular-nums';

function StatusBadge({ status }: { status: OrderFollowupStatus }) {
  return (
    <span className={`${STATUS_BADGE_BASE} ${statusToneClass(status)}`}>
      {ORDER_FOLLOWUP_STATUS_LABEL[status]}
    </span>
  );
}

/**
 * 메모가 있을 때만 상호작용 — PC hover 로 짧은 팝오버 미리보기, 클릭(또는 모바일 탭) 시 전체 모달을 연다.
 * 메모가 없으면 기존 `StatusBadge` 그대로 렌더한다.
 */
function StatusBadgeWithMemo({
  row,
  onOpenMemo,
}: {
  row: OrderFollowupItem;
  onOpenMemo: (row: OrderFollowupItem) => void;
}) {
  const memo = row.memo?.trim();
  if (!memo) {
    return <StatusBadge status={row.status} />;
  }
  const preview = memo.length > 140 ? `${memo.slice(0, 140)}…` : memo;
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={() => onOpenMemo(row)}
        aria-label={`${ORDER_FOLLOWUP_STATUS_LABEL[row.status]} · 메모 보기`}
        title="메모 보기"
        className={`${STATUS_BADGE_BASE} ${statusToneClass(
          row.status
        )} cursor-pointer pr-1.5 ring-offset-1 hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400`}
      >
        <span>{ORDER_FOLLOWUP_STATUS_LABEL[row.status]}</span>
        <svg
          className="ml-0.5 h-3 w-3 opacity-70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 5h16v11H7l-3 3V5z" />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 left-auto top-full z-30 mt-1 hidden w-64 max-w-[min(18rem,80vw)] whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-[11px] leading-5 text-gray-700 shadow-lg lg:group-hover:block"
      >
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          메모
        </span>
        {preview}
      </span>
    </span>
  );
}

export function AdminOrderFormFollowupPanel({
  token,
  linkedInquiryId = null,
  onClearLinkedInquiry,
}: {
  token: string;
  /** URL `inquiryId` — 목록을 해당 접수에 연결된 부재현황만으로 제한 */
  linkedInquiryId?: string | null;
  onClearLinkedInquiry?: () => void;
}) {
  const [items, setItems] = useState<OrderFollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGoldDbOnly, setFilterGoldDbOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderFollowupStatus | ''>('');
  const [filterCustomerName, setFilterCustomerName] = useState('');
  const [datePreset, setDatePreset] = useState<OrderFollowupDatePreset>('all');
  const [dateMonthKey, setDateMonthKey] = useState(() => kstTodayYmd().slice(0, 7));
  const [dateDayKey, setDateDayKey] = useState(() => kstTodayYmd());

  const [logFor, setLogFor] = useState<OrderFollowupItem | null>(null);
  const [logs, setLogs] = useState<OrderFollowupLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [edit, setEdit] = useState<OrderFollowupItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editStatus, setEditStatus] = useState<OrderFollowupStatus>('ABSENT');
  const [editMemo, setEditMemo] = useState('');
  const [editNext, setEditNext] = useState('');
  const [editGoldDb, setEditGoldDb] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [connectInqQ, setConnectInqQ] = useState('');
  const [connectInqQuery, setConnectInqQuery] = useState('');
  const [connectInqRows, setConnectInqRows] = useState<
    Array<{
      id: string;
      inquiryNumber: string | null;
      customerName: string;
      customerPhone: string;
      status: string;
    }>
  >([]);
  const [connectInqLoading, setConnectInqLoading] = useState(false);
  const connectInqDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deferTarget, setDeferTarget] = useState<OrderFollowupItem | null>(null);
  const [deferNote, setDeferNote] = useState('');
  const [deferSaving, setDeferSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrderFollowupItem | null>(null);
  const [memoView, setMemoView] = useState<OrderFollowupItem | null>(null);
  const suspendListRenderWhileEdit = Boolean(edit);

  /** `status: ''` 를 넘기면 서버 상태 필터 없이 조회(상단 칩은 별도로 맞춤) */
  const load = useCallback(
    async (opts?: { status?: OrderFollowupStatus | '' }) => {
      setLoading(true);
      setError(null);
      const useStatus =
        opts !== undefined && 'status' in opts
          ? opts.status === ''
            ? undefined
            : opts.status
          : filterStatus || undefined;
      try {
        const r = await listOrderFollowups(token, {
          status: useStatus,
          customerName: filterCustomerName.trim() || undefined,
          goldDbOnly: filterGoldDbOnly || undefined,
          ...(linkedInquiryId?.trim() ? { inquiryId: linkedInquiryId.trim() } : {}),
          ...(datePreset !== 'all'
            ? {
                datePreset,
                ...(datePreset === 'month' ? { month: dateMonthKey } : {}),
                ...(datePreset === 'day' ? { day: dateDayKey } : {}),
              }
            : {}),
        });
        setItems(r.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [token, filterGoldDbOnly, filterStatus, filterCustomerName, datePreset, dateMonthKey, dateDayKey, linkedInquiryId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** 예전에 다른 상태로 필터를 둔 경우 — 이 화면에서는 부재·보류만 */
  useEffect(() => {
    if (filterStatus !== '' && filterStatus !== 'ABSENT' && filterStatus !== 'ON_HOLD') {
      setFilterStatus('');
    }
  }, [filterStatus]);

  useEffect(() => {
    if (!logFor) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    listOrderFollowupLogs(token, logFor.id)
      .then((r) => setLogs(r.items))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }, [token, logFor]);

  /* 편집·삭제로 items가 바뀌면 모달의 메모도 최신 행으로 맞춘다 */
  useEffect(() => {
    if (!memoView) return;
    const fresh = items.find((it) => it.id === memoView.id);
    if (!fresh) {
      setMemoView(null);
      return;
    }
    if (fresh !== memoView) setMemoView(fresh);
  }, [items, memoView]);

  useEffect(() => {
    if (!edit) return;
    setEditName(edit.customerName);
    setEditNickname(edit.nickname ?? '');
    setEditStatus(edit.status);
    setEditMemo(edit.memo ?? '');
    setEditNext(toLocalDatetimeValue(edit.nextContactAt));
    setEditGoldDb(edit.goldDb ?? false);
    /** 편집 열자마자 자동 검색 요청을 보내면 입력·드롭다운 체감이 끊겨 보여 수동 검색으로 변경 */
    setConnectInqQ('');
    setConnectInqQuery('');
    setConnectInqRows([]);
  }, [edit]);

  useEffect(() => {
    if (!edit || edit.inquiry || edit.status === 'FULFILLED') {
      setConnectInqRows([]);
      setConnectInqLoading(false);
      return;
    }
    const q = connectInqQuery.trim();
    if (q.length < 2) {
      setConnectInqRows([]);
      setConnectInqLoading(false);
      return;
    }
    let cancelled = false;
    setConnectInqLoading(true);
    if (connectInqDebounceRef.current) clearTimeout(connectInqDebounceRef.current);
    connectInqDebounceRef.current = setTimeout(() => {
      connectInqDebounceRef.current = null;
      void getInquiries(token, { search: q, datePreset: 'all', limit: 15 })
        .then((res: { items: Array<Record<string, unknown>> }) => {
          if (cancelled) return;
          setConnectInqRows(
            res.items.map((it) => ({
              id: String(it.id),
              inquiryNumber: (it.inquiryNumber as string | null | undefined) ?? null,
              customerName: String(it.customerName ?? ''),
              customerPhone: String(it.customerPhone ?? ''),
              status: String(it.status ?? ''),
            }))
          );
        })
        .catch(() => {
          if (!cancelled) setConnectInqRows([]);
        })
        .finally(() => {
          if (!cancelled) setConnectInqLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      if (connectInqDebounceRef.current) {
        clearTimeout(connectInqDebounceRef.current);
        connectInqDebounceRef.current = null;
      }
    };
  }, [edit, connectInqQuery, token]);

  const saveEdit = async () => {
    if (!edit) return;
    const nextName = editName.trim();
    if (!nextName) {
      alert('고객명은 비워둘 수 없습니다.');
      return;
    }
    setSavingEdit(true);
    try {
      await patchOrderFollowup(token, edit.id, {
        customerName: nextName,
        nickname: editNickname.trim() || null,
        status: editStatus,
        memo: editMemo.trim() || null,
        nextContactAt: fromLocalDatetimeValue(editNext),
        goldDb: editGoldDb,
      });
      setEdit(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDefer = async () => {
    if (!deferTarget) return;
    setDeferSaving(true);
    try {
      await deferOrderFollowup(token, deferTarget.id, deferNote.trim());
      setDeferTarget(null);
      setDeferNote('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '처리에 실패했습니다.');
    } finally {
      setDeferSaving(false);
    }
  };

  const closeDeleteModal = () => setDeleteTarget(null);

  const confirmDelete = async (password: string) => {
    if (!deleteTarget) return;
    await deleteOrderFollowup(token, deleteTarget.id, password);
    if (edit?.id === deleteTarget.id) setEdit(null);
    setLogFor((prev) => (prev?.id === deleteTarget.id ? null : prev));
    setDeleteTarget(null);
    await load();
  };

  const filterChips = useMemo(
    () =>
      [
        { value: '' as const, label: '전체' },
        { value: 'ABSENT' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT },
        { value: 'ON_HOLD' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD },
      ] as const,
    []
  );

  /** 부재·보류 편집: 부재/보류 유지 + 재연락 성공 시 입금 흐름(접수 자동 생성·연결은 서버 처리) */
  const editStatusOptions = useMemo(
    () =>
      (
        [
          'ABSENT',
          'ON_HOLD',
          'DEPOSIT_PENDING',
          'RESERVED',
        ] as const satisfies readonly OrderFollowupStatus[]
      ).map((value) => ({
        value,
        label: ORDER_FOLLOWUP_STATUS_LABEL[value],
      })),
    []
  );

  const unlinkInquiryFromEdit = async () => {
    if (!edit) return;
    setSavingEdit(true);
    try {
      const r = await patchOrderFollowup(token, edit.id, { inquiryId: null });
      setEdit(r.item);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '연결 해제에 실패했습니다.');
    } finally {
      setSavingEdit(false);
    }
  };

  const connectInquiryToFollowup = async (inquiryId: string) => {
    if (!edit) return;
    setSavingEdit(true);
    try {
      const r = await patchOrderFollowup(token, edit.id, { inquiryId });
      setEdit(r.item);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '접수 연결에 실패했습니다.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">{error}</div>
      )}

      {linkedInquiryId?.trim() ? (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2.5 text-fluid-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0">
            <span className="font-medium">접수 연결 모드</span>
            <span className="text-blue-900/90">
              {' '}
              — 목록은 이 접수에 연결된 부재·보류 부재현황만 보입니다.
            </span>
          </p>
          {onClearLinkedInquiry ? (
            <button
              type="button"
              onClick={onClearLinkedInquiry}
              className="shrink-0 self-start rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-fluid-2xs font-medium text-blue-900 hover:bg-blue-50 sm:self-auto"
            >
              필터 해제
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-3">
          <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2">
            <span className="text-fluid-2xs font-semibold text-gray-700 shrink-0">등록일</span>
            <div className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <div className="inline-flex shrink-0 rounded border border-gray-300 overflow-hidden text-fluid-sm">
                <button
                  type="button"
                  onClick={() => setDatePreset('today')}
                  className={`px-3 py-1.5 font-medium ${
                    datePreset === 'today' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  오늘
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDatePreset('all');
                    setFilterGoldDbOnly(false);
                  }}
                  className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                    datePreset === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('month')}
                  className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                    datePreset === 'month' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  월별
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset('day')}
                  className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                    datePreset === 'day' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  일별
                </button>
              </div>
              {datePreset === 'month' && (
                <YearMonthSelect
                  value={dateMonthKey}
                  onChange={setDateMonthKey}
                  idPrefix="followup-reg-month"
                  className="items-center"
                />
              )}
              {datePreset === 'day' && (
                <YmdSelect
                  value={dateDayKey}
                  onChange={setDateDayKey}
                  idPrefix="followup-reg-day"
                  className="items-center"
                />
              )}
            </div>
            <HelpTooltip className="shrink-0 sm:ml-auto" text={FOLLOWUP_PANEL_HELP} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:min-w-[220px]">
                <input
                  type="text"
                  value={filterCustomerName}
                  onChange={(e) => setFilterCustomerName(e.target.value)}
                  placeholder="고객명 검색"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-fluid-2xs sm:text-fluid-xs text-gray-900"
                />
                {filterCustomerName.trim() ? (
                  <button
                    type="button"
                    onClick={() => setFilterCustomerName('')}
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-fluid-2xs text-gray-600 hover:bg-gray-50"
                  >
                    초기화
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setFilterGoldDbOnly((v) => !v)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] sm:text-fluid-2xs font-medium touch-manipulation sm:ml-auto ${
                  filterGoldDbOnly
                    ? 'border-amber-600 bg-amber-100 text-amber-950 ring-1 ring-amber-300/80'
                    : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                }`}
              >
                골드DB만
              </button>
              {filterChips.map((c) => (
                <button
                  key={String(c.value)}
                  type="button"
                  onClick={() => {
                    const next = c.value === filterStatus && c.value !== '' ? '' : c.value;
                    setFilterStatus(next);
                    if (next === '') setFilterGoldDbOnly(false);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] sm:text-fluid-2xs font-medium touch-manipulation ${
                    (c.value === '' && filterStatus === '') || c.value === filterStatus
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
          <div className="p-10 text-center text-fluid-sm text-gray-500">불러오는 중…</div>
        ) : suspendListRenderWhileEdit ? (
          <div className="p-10 text-center text-fluid-sm text-gray-500">
            편집 중…
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-fluid-sm text-gray-500">
            {filterGoldDbOnly
              ? '골드DB 건이 없습니다.'
              : linkedInquiryId?.trim()
                ? '이 접수에 연결된 부재현황이 없습니다.'
                : '등록된 건이 없습니다.'}
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-fluid-xs text-center">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="py-2.5 px-2 font-semibold text-gray-600">고객</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">연락처</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">상태</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">부재</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">담당</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">다음 연락</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">등록일</th>
                    <th className="py-2.5 px-2 font-semibold text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 ${
                        row.goldDb
                          ? 'bg-yellow-100 hover:bg-yellow-200/50 border-l-[3px] border-l-amber-500'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td className="py-2 px-2 font-medium text-gray-900 truncate max-w-[10rem]">
                        <span>{row.customerName}</span>
                        {row.nickname?.trim() ? (
                          <>
                            <span className="mx-1 text-[11px] font-normal text-gray-400" aria-hidden>
                              ·
                            </span>
                            <span className="text-[11px] font-normal text-gray-500">
                              {row.nickname}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td className="py-2 px-2 tabular-nums text-gray-800">{displayPhone(row.customerPhone)}</td>
                      <td className="py-2 px-2">
                        <StatusBadgeWithMemo row={row} onOpenMemo={setMemoView} />
                      </td>
                      <td className="py-2 px-2 tabular-nums text-gray-800">{row.deferCount}</td>
                      <td className="py-2 px-2 text-gray-700 truncate max-w-[6rem]">
                        {row.handledBy?.name ?? '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-600 tabular-nums text-[11px]">
                        {row.nextContactAt ? formatDateTimeCompactWithWeekday(row.nextContactAt) : '—'}
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-[11px] tabular-nums">
                        {formatDateCompactWithWeekday(row.createdAt)}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap justify-center gap-1">
                          <Link
                            to="/admin/inquiries/order-issue"
                            className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100"
                          >
                            발주서
                          </Link>
                          <button
                            type="button"
                            onClick={() => setEdit(row)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-50"
                          >
                            편집
                          </button>
                          <button
                            type="button"
                            onClick={() => setLogFor(row)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-50"
                          >
                            로그
                          </button>
                          {row.status !== 'FULFILLED' ? (
                            <button
                              type="button"
                              onClick={() => setDeferTarget(row)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100"
                            >
                              부재+1
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100 p-2 space-y-0">
              {items.map((row) => (
                <div
                  key={row.id}
                  className={`px-2 py-3 rounded-lg ${
                    row.goldDb ? 'bg-yellow-100 border-l-[3px] border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        <span>{row.customerName}</span>
                        {row.nickname?.trim() ? (
                          <>
                            <span className="mx-1 text-fluid-xs font-normal text-gray-400" aria-hidden>
                              ·
                            </span>
                            <span className="text-fluid-xs font-normal text-gray-500">
                              {row.nickname}
                            </span>
                          </>
                        ) : null}
                      </p>
                      <p className="text-fluid-xs text-gray-600 tabular-nums">{displayPhone(row.customerPhone)}</p>
                    </div>
                    <StatusBadgeWithMemo row={row} onOpenMemo={setMemoView} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-fluid-2xs text-gray-600">
                    <span>부재 {row.deferCount}회</span>
                    <span>담당 {row.handledBy?.name ?? '—'}</span>
                    <span>등록일 {formatDateCompactWithWeekday(row.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      to="/admin/inquiries/order-issue"
                      className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-fluid-2xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      발주서
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEdit(row)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-fluid-2xs font-medium text-gray-800"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFor(row)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-fluid-2xs font-medium text-gray-800"
                    >
                      로그
                    </button>
                    {row.status !== 'FULFILLED' ? (
                      <button
                        type="button"
                        onClick={() => setDeferTarget(row)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-fluid-2xs font-medium text-amber-950"
                      >
                        부재+1
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-fluid-2xs font-medium text-red-700 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {logFor &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
            aria-labelledby="followup-log-title"
          >
            <div className="absolute inset-0" aria-hidden onClick={() => setLogFor(null)} />
            <div className="relative flex max-h-[min(88dvh,560px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl border border-gray-200">
              <ModalCloseButton onClick={() => setLogFor(null)} />
              <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4 pr-12">
                <h2 id="followup-log-title" className="text-fluid-base font-semibold text-gray-900">
                  활동 로그
                </h2>
                <p className="text-fluid-2xs text-gray-500 mt-0.5 truncate">
                  {logFor.customerName}
                  {logFor.customerPhone.trim() ? ` · ${logFor.customerPhone}` : ''}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3">
                {logsLoading ? (
                  <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
                ) : logs.length === 0 ? (
                  <p className="text-fluid-sm text-gray-500">로그가 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {logs.map((log) => (
                      <li
                        key={log.id}
                        className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-left"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                          <span className="text-[11px] font-semibold text-gray-800">
                            {actionLabelKo(log.action)}
                          </span>
                          <time className="text-[10px] tabular-nums text-gray-500">
                            {formatDateTimeCompactWithWeekday(log.createdAt)}
                          </time>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          {log.actor.name} · {roleLabelKo(log.actor.role)} · {log.actor.email}
                        </p>
                        <p className="text-[11px] text-gray-700 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                          {logDetailDescription(log)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {edit &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
            aria-labelledby="followup-edit-title"
          >
            <div className="absolute inset-0" aria-hidden onClick={() => setEdit(null)} />
            <div className="relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl border border-gray-200">
              <ModalCloseButton onClick={() => setEdit(null)} />
              <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4 pr-12 min-w-0">
                <h2
                  id="followup-edit-title"
                  className="text-fluid-base font-semibold text-gray-900 truncate tracking-tight"
                >
                  {edit.customerName.trim() || '고객명 없음'}
                  {edit.nickname?.trim() ? (
                    <span className="ml-1 text-fluid-sm font-normal text-gray-500">
                      ({edit.nickname})
                    </span>
                  ) : null}
                </h2>
                <p className="text-fluid-2xs text-gray-500 mt-0.5 truncate">
                  부재현황 편집
                  {edit.customerPhone.trim() ? (
                    <span className="tabular-nums"> · {edit.customerPhone}</span>
                  ) : null}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="block text-fluid-2xs font-medium text-gray-500 mb-1">고객명</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm text-gray-900 shadow-sm"
                      placeholder="홍길동"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-fluid-2xs font-medium text-gray-500 mb-1">닉네임 (선택)</label>
                    <input
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm text-gray-900 shadow-sm"
                      placeholder="동명이인 구분용 별명"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-fluid-2xs font-medium text-gray-500 mb-1">상태</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as OrderFollowupStatus)}
                    disabled={edit.status === 'FULFILLED'}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm bg-white disabled:bg-gray-50"
                  >
                    {(edit.status === 'FULFILLED'
                      ? [
                          ...editStatusOptions,
                          {
                            value: 'FULFILLED' as const,
                            label: ORDER_FOLLOWUP_STATUS_LABEL.FULFILLED,
                          },
                        ]
                      : editStatusOptions
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {edit.status !== 'FULFILLED' ? (
                    <p className="mt-1 text-fluid-2xs text-gray-500 leading-snug">
                      「예약금 대기」는 접수 목록의 입금대기로, 「입금 완료」는 입금완료로 넘깁니다. 접수가 아직 없으면
                      저장 시 자동으로 만들어 연결됩니다.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-fluid-2xs font-medium text-gray-500 mb-1">메모</label>
                  <textarea
                    value={editMemo}
                    onChange={(e) => setEditMemo(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm resize-y"
                  />
                </div>
                {!edit.inquiry && edit.status !== 'FULFILLED' ? (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 space-y-2">
                    <p className="text-fluid-2xs font-medium text-indigo-950">접수 연결</p>
                    <p className="text-fluid-2xs text-gray-600">
                      접수 목록과 동일한 검색입니다. 두 글자 이상 입력 후 행에서 연결하세요. (권한 없는 접수는
                      서버에서 거절됩니다.)
                    </p>
                    <input
                      type="text"
                      value={connectInqQ}
                      onChange={(e) => setConnectInqQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        setConnectInqQuery(connectInqQ.trim());
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-fluid-sm text-gray-900 shadow-sm"
                      placeholder="고객명 검색"
                    />
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setConnectInqQuery(connectInqQ.trim())}
                        className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-fluid-2xs font-medium text-indigo-900 hover:bg-indigo-50"
                      >
                        검색
                      </button>
                    </div>
                    {connectInqQuery.trim().length < 2 ? (
                      <p className="text-fluid-2xs text-gray-500">이름 두 글자 이상으로 검색합니다.</p>
                    ) : connectInqLoading ? (
                      <p className="text-fluid-2xs text-gray-500">검색 중…</p>
                    ) : connectInqRows.length === 0 ? (
                      <p className="text-fluid-2xs text-gray-500">검색 결과가 없습니다.</p>
                    ) : (
                      <ul className="max-h-40 space-y-1.5 overflow-y-auto overscroll-y-contain rounded-md border border-indigo-100 bg-white p-1.5">
                        {connectInqRows.map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-col gap-1 rounded border border-gray-100 px-2 py-1.5 text-fluid-2xs sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 text-center sm:text-left">
                              <span className="font-medium text-gray-900">
                                {INQUIRY_STATUS_LABEL[row.status] ?? row.status} ·{' '}
                                {row.inquiryNumber ?? '번호 없음'} — {row.customerName}
                              </span>
                              <span className="mt-0.5 block tabular-nums text-gray-600">{row.customerPhone || '—'}</span>
                            </div>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => void connectInquiryToFollowup(row.id)}
                              className="shrink-0 rounded-md bg-indigo-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-800 disabled:opacity-40"
                            >
                              연결
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {edit.inquiry ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5 space-y-2">
                    <p className="text-fluid-2xs font-medium text-gray-700">연결된 접수</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/inquiries?openInquiry=${encodeURIComponent(edit.inquiry.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-fluid-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                      >
                        {edit.inquiry.inquiryNumber ?? '(번호 없음)'} · {edit.inquiry.customerName}
                      </Link>
                      <button
                        type="button"
                        disabled={savingEdit || edit.status === 'FULFILLED'}
                        onClick={() => void unlinkInquiryFromEdit()}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-fluid-2xs font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-40"
                      >
                        연결 해제
                      </button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="block text-fluid-2xs font-medium text-gray-500 mb-1">다음 연락</label>
                  <input
                    type="datetime-local"
                    value={editNext}
                    onChange={(e) => setEditNext(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
                  />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                  <input
                    id="followup-gold-db"
                    type="checkbox"
                    checked={editGoldDb}
                    onChange={(e) => setEditGoldDb(e.target.checked)}
                    disabled={edit.status === 'FULFILLED'}
                    className="mt-0.5 rounded border-gray-300"
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="followup-gold-db" className="text-fluid-xs font-medium text-gray-900 cursor-pointer">
                      골드DB
                    </label>
                  </div>
                  <HelpTooltip
                    className="shrink-0"
                    text="고급 DB로 올릴 때까지 팀에서 더 촘촘히 챙길 고객으로 표시합니다. 켜면 목록에서 노란 배경으로 보입니다."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => void saveEdit()}
                    className="flex-1 rounded-lg bg-gray-900 py-2.5 text-fluid-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => setDeleteTarget(edit)}
                    className="w-24 rounded-lg border border-red-300 bg-red-50 py-2.5 text-fluid-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {deferTarget &&
        createPortal(
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal>
            <div className="absolute inset-0" aria-hidden onClick={() => setDeferTarget(null)} />
            <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-gray-200">
              <h3 className="text-fluid-base font-semibold text-gray-900 mb-1">부재 누적</h3>
              <p className="text-fluid-2xs text-gray-600 mb-3">
                재연락 후에도 부재 등으로 이어질 때 횟수를 올립니다. (현재 {deferTarget.deferCount}회)
              </p>
              <label className="block text-fluid-2xs text-gray-500 mb-1">메모 (선택)</label>
              <textarea
                value={deferNote}
                onChange={(e) => setDeferNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm mb-4"
                placeholder="통화 결과 등"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setDeferTarget(null);
                    setDeferNote('');
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-fluid-sm text-gray-700"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={deferSaving}
                  onClick={() => void confirmDefer()}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {deferSaving ? '처리 중…' : '확인'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {memoView &&
        createPortal(
          <div
            className="fixed inset-0 z-[230] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal
            aria-labelledby="followup-memo-title"
          >
            <div className="absolute inset-0" aria-hidden onClick={() => setMemoView(null)} />
            <div className="relative flex max-h-[min(88dvh,560px)] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl border border-gray-200">
              <ModalCloseButton onClick={() => setMemoView(null)} />
              <div className="shrink-0 border-b border-gray-100 px-4 pb-2 pt-4 pr-12 min-w-0">
                <h2
                  id="followup-memo-title"
                  className="text-fluid-base font-semibold text-gray-900 truncate"
                >
                  메모 · {memoView.customerName || '고객명 없음'}
                  {memoView.nickname?.trim() ? (
                    <span className="ml-1 text-fluid-sm font-normal text-gray-500">
                      ({memoView.nickname})
                    </span>
                  ) : null}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-fluid-2xs text-gray-500">
                  <StatusBadge status={memoView.status} />
                  <span className="tabular-nums">
                    등록일 {formatDateCompactWithWeekday(memoView.createdAt)}
                  </span>
                  {memoView.customerPhone.trim() ? (
                    <span className="tabular-nums">· {memoView.customerPhone}</span>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3">
                {memoView.memo?.trim() ? (
                  <p className="whitespace-pre-wrap break-all text-fluid-sm leading-relaxed text-gray-800">
                    {memoView.memo}
                  </p>
                ) : (
                  <p className="text-fluid-sm text-gray-500">메모가 비어 있습니다.</p>
                )}
              </div>
              <div className="shrink-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setEdit(memoView);
                    setMemoView(null);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  편집
                </button>
                <button
                  type="button"
                  onClick={() => setMemoView(null)}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-gray-800"
                >
                  닫기
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
            ? `부재현황 삭제: ${deleteTarget.customerName}`
            : '부재현황 삭제'
        }
        confirmLabel="삭제 확정"
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
