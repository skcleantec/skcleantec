import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStaffAppScrollPreserve } from '../../hooks/useStaffAppScrollPreserve';
import { beginListRefresh, shouldShowListBlockingLoading } from '../../utils/listRefreshDisplay';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import {
  getCsReports,
  acknowledgeCsReport,
  updateCsReport,
  deleteCsReport,
  forwardCsReport,
  type CsListDatePreset,
  type CsReport,
} from '../../api/cs';
import { formatInquiryListAreaLabel } from '../../utils/inquiryAreaDisplay';
import { getMe } from '../../api/auth';
import { acknowledgeTeamCsReport, getTeamCsReports, patchTeamCsReport } from '../../api/team';
import { getToken } from '../../stores/auth';
import { getTeamToken } from '../../stores/teamAuth';
import {
  formatDateTimeCompactWithWeekday,
  formatDateCompactWithWeekday,
  formatDateTimeTinyKo,
  formatPreferredDateInputYmd,
  kstTodayYmd,
} from '../../utils/dateFormat';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { ImageThumbLightbox } from '../ui/ImageThumbLightbox';
import { SyncHorizontalScroll } from '../ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import {
  clampListPage,
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
  type InquiryListPageSize,
} from '../../utils/listPagination';
import { formatInquirySourceLabel, isInquirySourceHiddenFromUi } from '../../utils/inquiryListDisplay';
import { getAssignableScheduleUsers, formatAssignableUserLabel, type UserItem } from '../../api/users';
import { teamPreviewDepsKey } from '../../utils/teamPreviewQuery';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '접수' },
  { value: 'PROCESSING', label: '처리중' },
  { value: 'DONE', label: '완료' },
];

const INQUIRY_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

function roleLabelKo(role: string): string {
  if (role === 'ADMIN') return '관리자';
  if (role === 'MARKETER') return '마케터';
  if (role === 'TEAM_LEADER') return '팀장';
  if (role === 'EXTERNAL_PARTNER') return '타업체';
  return role;
}

function formatTeamLeaderLabel(inquiry: NonNullable<CsReport['inquiry']>): string {
  const names = inquiry.assignments
    .map((a) => {
      const u = a.teamLeader as { name: string; role?: string; externalCompany?: { name: string } | null };
      if (u.role === 'EXTERNAL_PARTNER') {
        return u.externalCompany?.name ? `[타업체] ${u.externalCompany.name}` : `[타업체] ${u.name}`;
      }
      return u.name;
    })
    .filter(Boolean);
  return names.length ? names.join(' · ') : '미배정';
}

function forwardedToAsUserItem(f: NonNullable<CsReport['forwardedToUser']>): UserItem {
  return {
    id: f.id,
    email: '',
    name: f.name,
    phone: null,
    role: f.role,
    externalCompanyId: f.externalCompanyId ?? f.externalCompany?.id ?? null,
    externalCompanyName: f.externalCompany?.name ?? null,
  };
}

function assigneeListLabel(item: CsReport): string {
  const inquiryLabel = item.inquiry ? formatTeamLeaderLabel(item.inquiry) : null;
  const forwardLabel = item.forwardedToUser
    ? `[전달] ${formatAssignableUserLabel(forwardedToAsUserItem(item.forwardedToUser))}`
    : null;
  if (forwardLabel && (!inquiryLabel || inquiryLabel === '미배정')) return forwardLabel;
  if (inquiryLabel) return inquiryLabel;
  if (forwardLabel) return forwardLabel;
  return '—';
}

function firstAssigneeLabel(item: CsReport): string {
  if (item.inquiry?.assignments?.length) {
    const first = item.inquiry.assignments[0]?.teamLeader as
      | { name: string; role?: string; externalCompany?: { name: string } | null }
      | undefined;
    if (!first) return '미배정';
    if (first.role === 'EXTERNAL_PARTNER') {
      return first.externalCompany?.name ? `[타업체] ${first.externalCompany.name}` : `[타업체] ${first.name}`;
    }
    return first.name;
  }
  if (item.forwardedToUser) return formatAssignableUserLabel(forwardedToAsUserItem(item.forwardedToUser));
  return '—';
}

function processorNameLabel(item: CsReport): string {
  const n = item.completedBy?.name?.trim();
  return n || '—';
}

function formatAreaLine(inquiry: NonNullable<CsReport['inquiry']>): string {
  return formatInquiryListAreaLabel({
    areaBasis: inquiry.areaBasis,
    areaPyeong: inquiry.areaPyeong,
    exclusiveAreaSqm: inquiry.exclusiveAreaSqm,
    isOneRoom: inquiry.isOneRoom,
  });
}

function ServiceRatingStars({ value }: { value: number | null | undefined }) {
  if (value == null || value < 1 || value > 5) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex gap-px text-amber-500 tabular-nums" aria-label={`${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-500' : 'text-slate-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

function OpenInNewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

const CS_AS_DATE_HELP =
  '오늘(한국 기준) 이후만 선택됩니다. 관리 스케줄 상단 요약에만 표시되며, 팀/거래처 달력 예약 건수에는 넣지 않습니다.';

const CS_FORWARD_HELP =
  '수기·미연결 건을 선택한 담당 계정의 팀 C/S 화면에 바로 표시합니다. 저장 후 해당 계정에 실시간 반영됩니다.';

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function CsHelpQuestionButton({
  label,
  expanded,
  onToggle,
  buttonClassName,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  buttonClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        buttonClassName ??
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 text-current hover:bg-white/40 touch-manipulation'
      }
      title={label}
      aria-expanded={expanded}
      aria-label={`도움말: ${label}`}
    >
      <span className="text-sm font-semibold leading-none" aria-hidden>
        ?
      </span>
    </button>
  );
}

export type CsWorkdeskMode = 'admin' | 'team';

type CsWorkdeskProps = {
  mode: CsWorkdeskMode;
};

export function CsWorkdesk({ mode }: CsWorkdeskProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const previewKey = teamPreviewDepsKey(location.search);
  const token = mode === 'admin' ? getToken() : getTeamToken();
  const isAdmin = mode === 'admin';
  const [items, setItems] = useState<CsReport[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [datePreset, setDatePreset] = useState<CsListDatePreset>(() => {
    const dp = searchParams.get('datePreset');
    if (dp === 'month' || dp === 'day' || dp === 'last3months') return dp;
    return 'last3months';
  });
  const [monthKey, setMonthKey] = useState(() => {
    const m = searchParams.get('month');
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    return kstMonthKeyNow();
  });
  const [dayKey, setDayKey] = useState(() => {
    const d = searchParams.get('day');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return kstTodayYmd();
  });
  const [listPage, setListPage] = useState(() => parseListPage(searchParams.get('page')));
  const [listPageSize, setListPageSize] = useState<InquiryListPageSize>(() =>
    parseInquiryListPageSize(searchParams.get('pageSize'))
  );
  const [loading, setLoading] = useState(false);
  const { preserveScroll, scrollToTop } = useStaffAppScrollPreserve();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CsReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [completionMethodInput, setCompletionMethodInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectedInquiryModal, setConnectedInquiryModal] = useState<NonNullable<CsReport['inquiry']> | null>(
    null
  );
  /** 관리자(ADMIN)로 로그인한 경우에만 C/S 삭제 UI 표시 — 마케터는 동일 메뉴 사용하지만 삭제 불가 */
  const [adminViewer, setAdminViewer] = useState(false);
  const [csDeleteTarget, setCsDeleteTarget] = useState<CsReport | null>(null);
  const [forwardOptions, setForwardOptions] = useState<UserItem[]>([]);
  const [forwardSelectUserId, setForwardSelectUserId] = useState('');
  const [forwardSending, setForwardSending] = useState(false);
  const [editAsServiceDate, setEditAsServiceDate] = useState('');
  const [asDateHelpOpen, setAsDateHelpOpen] = useState(false);
  const [forwardHelpOpen, setForwardHelpOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'admin' || !token) {
      setForwardOptions([]);
      return;
    }
    getAssignableScheduleUsers(token)
      .then((r) => setForwardOptions(r.items))
      .catch(() => setForwardOptions([]));
  }, [mode, token]);

  useEffect(() => {
    if (!selected) {
      setForwardSelectUserId('');
      return;
    }
    setForwardSelectUserId(selected.forwardedToUser?.id ?? '');
  }, [selected?.id, selected?.forwardedToUser?.id]);

  useEffect(() => {
    if (!selected) {
      setEditAsServiceDate('');
      return;
    }
    setEditAsServiceDate(formatPreferredDateInputYmd(selected.asServiceDate));
  }, [selected?.id, selected?.asServiceDate]);

  const syncListUrl = useCallback(
    (
      page: number,
      pageSize: InquiryListPageSize,
      preset: CsListDatePreset,
      month: string,
      day: string
    ) => {
      if (!isAdmin) return;
      const next = new URLSearchParams(searchParams);
      next.set('datePreset', preset);
      if (preset === 'month') {
        next.set('month', month);
        next.delete('day');
      } else if (preset === 'day') {
        next.set('day', day);
        next.delete('month');
      } else {
        next.delete('month');
        next.delete('day');
      }
      if (page > 1) next.set('page', String(page));
      else next.delete('page');
      if (pageSize !== INQUIRY_LIST_DEFAULT_PAGE_SIZE) next.set('pageSize', String(pageSize));
      else next.delete('pageSize');
      setSearchParams(next, { replace: true });
    },
    [isAdmin, searchParams, setSearchParams]
  );

  const applyDatePreset = useCallback(
    (preset: CsListDatePreset) => {
      setDatePreset(preset);
      setListPage(1);
      syncListUrl(1, listPageSize, preset, monthKey, dayKey);
    },
    [listPageSize, monthKey, dayKey, syncListUrl]
  );

  const handleListPageChange = useCallback(
    (page: number) => {
      setListPage(page);
      syncListUrl(page, listPageSize, datePreset, monthKey, dayKey);
    },
    [listPageSize, datePreset, monthKey, dayKey, syncListUrl]
  );

  const handleListPageSizeChange = useCallback(
    (size: InquiryListPageSize) => {
      setListPageSize(size);
      setListPage(1);
      syncListUrl(1, size, datePreset, monthKey, dayKey);
    },
    [datePreset, monthKey, dayKey, syncListUrl]
  );

  const fetchList = useCallback(
    (opts?: { withLoading?: boolean; scrollToTop?: boolean }) => {
      if (!token) return;
      const withLoading = opts?.withLoading ?? false;
      if (opts?.scrollToTop) scrollToTop();
      if (withLoading) {
        beginListRefresh({
          showLoading: true,
          itemCount: items.length,
          setLoading,
          preserveScroll,
        });
      } else if (items.length > 0) {
        preserveScroll();
      }
      const applyRows = (rows: CsReport[]) => {
        setItems(rows);
        if (withLoading) {
          setSelected((sel) => {
            if (!sel) return null;
            const next = rows.find((i) => i.id === sel.id);
            return next ?? null;
          });
          setError(null);
        } else {
          setSelected((sel) => {
            if (!sel) return null;
            if (!rows.some((i) => i.id === sel.id)) return null;
            return sel;
          });
        }
      };
      const finish = () => {
        if (withLoading) setLoading(false);
      };
      if (isAdmin) {
        void getCsReports(token, {
          datePreset,
          month: datePreset === 'month' ? monthKey : undefined,
          day: datePreset === 'day' ? dayKey : undefined,
          limit: listPageSize,
          offset: (listPage - 1) * listPageSize,
        })
          .then((r) => {
            setListTotal(r.total);
            applyRows(r.items);
          })
          .catch((e) => {
            if (withLoading) {
              setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
            }
          })
          .finally(finish);
        return;
      }
      void getTeamCsReports(token)
        .then((r) => applyRows(r.items))
        .catch((e) => {
          if (withLoading) {
            setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.');
          }
        })
        .finally(finish);
    },
    [token, isAdmin, previewKey, datePreset, monthKey, dayKey, listPage, listPageSize, items.length, preserveScroll, scrollToTop]
  );

  const listQueryKey = useMemo(
    () =>
      [mode, datePreset, monthKey, dayKey, listPage, listPageSize, previewKey].join('\0'),
    [mode, datePreset, monthKey, dayKey, listPage, listPageSize, previewKey]
  );
  const prevListQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setListPage((p) => clampListPage(p, listTotal, listPageSize));
  }, [isAdmin, listTotal, listPageSize]);

  const lastCsWsRefreshRef = useRef(0);
  const refreshCsListFromWs = useCallback(() => {
    const now = Date.now();
    if (now - lastCsWsRefreshRef.current < 4000) return;
    lastCsWsRefreshRef.current = now;
    fetchList({ withLoading: false });
  }, [fetchList]);

  const { connected: csWsConnected } = useInboxRealtime(
    token,
    refreshCsListFromWs,
    Boolean(token)
  );
  useVisibilityInterval(refreshCsListFromWs, csWsConnected ? 0 : 15000);

  useEffect(() => {
    const prev = prevListQueryKeyRef.current;
    prevListQueryKeyRef.current = listQueryKey;
    fetchList({
      withLoading: true,
      scrollToTop: prev !== null && prev !== listQueryKey,
    });
  }, [token, listQueryKey, fetchList]);

  useEffect(() => {
    if (mode !== 'admin' || !token) {
      setAdminViewer(false);
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setAdminViewer(u.role === 'ADMIN'))
      .catch(() => setAdminViewer(false));
  }, [mode, token]);

  const patchCs = (
    id: string,
    data: {
      status?: string;
      memo?: string | null;
      completionMethod?: string | null;
      asServiceDate?: string | null;
    }
  ) => {
    if (!token) return Promise.reject(new Error('로그인이 필요합니다.'));
    return mode === 'admin' ? updateCsReport(token, id, data) : patchTeamCsReport(token, id, data);
  };

  const openDetail = (item: CsReport) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
    setCompletionMethodInput('');
    setEditAsServiceDate(formatPreferredDateInputYmd(item.asServiceDate));
    setAsDateHelpOpen(false);
    setForwardHelpOpen(false);

    if (item.status !== 'RECEIVED' || !token) return;
    const ack = mode === 'admin' ? acknowledgeCsReport(token, item.id) : acknowledgeTeamCsReport(token, item.id);
    void ack
      .then((updated) => {
        setSelected((sel) => (sel?.id === item.id ? updated : sel));
        setEditStatus(updated.status);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
      })
      .catch(() => {
        /* 상세는 이미 열림 — 확인 API 실패 시 배지만 유지 */
      });
  };

  const closeDetail = () => {
    setSelected(null);
    setAsDateHelpOpen(false);
    setForwardHelpOpen(false);
  };

  const handleSave = async () => {
    if (!token || !selected) return;
    if (editStatus === 'DONE' && selected.status !== 'DONE' && !completionMethodInput.trim()) {
      setError('처리 완료로 저장하려면 처리 방법을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchCs(selected.id, {
        status: editStatus,
        memo: editMemo,
        asServiceDate: editAsServiceDate.trim() || null,
        ...(editStatus === 'DONE' && selected.status !== 'DONE'
          ? { completionMethod: completionMethodInput.trim() }
          : {}),
      });
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setError(null);
      if (updated.status === 'DONE') setCompletionMethodInput('');
      (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
      closeDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!token || !selected) return;
    if (!completionMethodInput.trim()) {
      setError('처리 완료 시 처리 방법을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchCs(selected.id, {
        status: 'DONE',
        memo: editMemo,
        asServiceDate: editAsServiceDate.trim() || null,
        completionMethod: completionMethodInput.trim(),
      });
      setEditStatus('DONE');
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setCompletionMethodInput('');
      setError(null);
      (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
      closeDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 완료 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleForwardSend = async () => {
    if (!token || !selected || mode !== 'admin') return;
    setForwardSending(true);
    try {
      const target = forwardSelectUserId.trim() || null;
      const updated = await forwardCsReport(token, selected.id, target);
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setError(null);
      (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '전달에 실패했습니다.');
    } finally {
      setForwardSending(false);
    }
  };

  const csLink = `${window.location.origin}/cs`;
  const pageTitle = mode === 'admin' ? 'C/S 관리' : 'C/S';
  const statusSelectOptions =
    mode === 'team'
      ? STATUS_OPTIONS.filter((o) => o.value !== 'RECEIVED' || selected?.status === 'RECEIVED')
      : STATUS_OPTIONS;

  const isTeam = mode === 'team';
  /** 팀장 모드: 목록을 더 조밀하게(모바일 한 화면에 많이) */
  const tableText = isTeam
    ? 'text-fluid-2xs md:text-fluid-xs lg:text-fluid-sm leading-tight'
    : 'text-fluid-xs md:text-sm';
  const thPad = isTeam ? 'p-0.5 md:p-2 max-md:py-0.5' : 'p-1.5 md:p-3';
  const tdPad = isTeam
    ? 'p-0.5 md:p-2 max-md:py-0.5 align-middle text-center'
    : 'p-1.5 md:p-3 align-middle text-center';

  const displayItems = useMemo(() => {
    if (!isTeam) return items;
    return [...items].sort((a, b) => {
      const aDone = a.status === 'DONE' ? 1 : 0;
      const bDone = b.status === 'DONE' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, isTeam]);

  const teamIncompleteCount = isTeam ? items.filter((i) => i.status !== 'DONE').length : 0;
  const teamCompleteCount = isTeam ? items.filter((i) => i.status === 'DONE').length : 0;

  const showAdminDeleteCol = mode === 'admin' && adminViewer;

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0 ${
          isTeam ? 'mb-2 sm:mb-4' : 'mb-4'
        }`}
      >
        <h1
          className={`shrink-0 font-semibold text-gray-900 ${
            isTeam ? 'text-fluid-base sm:text-xl' : 'text-xl'
          }`}
        >
          {pageTitle}
        </h1>
        {mode === 'admin' ? (
          <div className="flex w-full min-w-0 items-center gap-2 sm:ml-4 sm:flex-1 sm:justify-end">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm">
              <span className="shrink-0 text-gray-500">고객 링크</span>
              <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs sm:max-w-md sm:text-sm">
                {csLink}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(csLink)}
                className="shrink-0 touch-manipulation rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 min-h-[36px]"
              >
                복사
              </button>
            </div>
            <a
              href="/cs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-fluid-sm font-medium text-white bg-blue-600 rounded-lg border border-blue-700 hover:bg-blue-700 active:bg-blue-800 touch-manipulation shadow-sm"
            >
              <OpenInNewIcon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">고객용 C/S 페이지 미리보기</span>
            </a>
          </div>
        ) : null}
      </div>

      {mode !== 'admin' ? (
        <p className="text-fluid-2xs sm:text-fluid-xs text-gray-600 mb-2 sm:mb-3 leading-snug">
          배정 접수와 연결된 C/S 또는 관리자가 본인에게 전달한 C/S가 표시됩니다. 완료 시 처리 방법을 입력해 주세요.
        </p>
      ) : null}

      {isAdmin ? (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
            <div className="flex flex-col gap-2 min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="text-fluid-2xs font-semibold text-gray-700 shrink-0">접수일</span>
              <div className="inline-flex rounded border border-gray-300 overflow-hidden text-fluid-sm shrink-0">
                <button
                  type="button"
                  onClick={() => applyDatePreset('last3months')}
                  className={`px-3 py-1.5 font-medium ${
                    datePreset === 'last3months'
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  3개월
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('month')}
                  className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                    datePreset === 'month'
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  월별
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('day')}
                  className={`px-3 py-1.5 font-medium border-l border-gray-300 ${
                    datePreset === 'day'
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  날짜별
                </button>
              </div>
              {datePreset === 'month' ? (
                <YearMonthSelect
                  value={monthKey}
                  onChange={(v) => {
                    setMonthKey(v);
                    setListPage(1);
                    syncListUrl(1, listPageSize, 'month', v, dayKey);
                  }}
                  idPrefix="cs-list-month"
                  className="items-center"
                />
              ) : null}
              {datePreset === 'day' ? (
                <YmdSelect
                  value={dayKey}
                  onChange={(v) => {
                    setDayKey(v);
                    setListPage(1);
                    syncListUrl(1, listPageSize, 'day', monthKey, v);
                  }}
                  idPrefix="cs-list-day"
                  className="items-center"
                />
              ) : null}
            </div>
            <ListPaginationBar
              mode="summary"
              page={listPage}
              pageSize={listPageSize}
              total={listTotal}
              onPageChange={handleListPageChange}
              onPageSizeChange={handleListPageSizeChange}
              className="shrink-0"
            />
          </div>
        </div>
      ) : null}

      {error && (
        <p className={`text-fluid-sm text-red-600 ${isTeam ? 'mb-2' : 'mb-4'}`}>{error}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden min-w-0 max-w-full">
        {shouldShowListBlockingLoading(loading, items.length) ? (
          <div className={`text-center text-gray-500 ${isTeam ? 'p-4 text-fluid-xs' : 'p-8 text-sm'}`}>
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className={`text-center text-gray-500 ${isTeam ? 'p-4 text-fluid-xs' : 'p-8 text-sm'}`}>
            표시할 C/S가 없습니다.
          </div>
        ) : (
          <>
            {isTeam && (
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/90 flex flex-wrap items-center gap-x-4 gap-y-1 text-fluid-2xs sm:text-fluid-xs text-gray-700">
                <span className="tabular-nums">
                  <span className="text-gray-500">미완료</span>{' '}
                  <strong className="text-amber-800">{teamIncompleteCount}</strong>건
                </span>
                <span className="text-gray-300 hidden sm:inline" aria-hidden>
                  |
                </span>
                <span className="tabular-nums">
                  <span className="text-gray-500">완료</span>{' '}
                  <strong className="text-green-800">{teamCompleteCount}</strong>건
                </span>
              </div>
            )}
            <SyncHorizontalScroll
              className="w-full min-w-0 max-w-full"
              contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0 w-full min-w-0 max-w-full"
            >
              <table
                className={`w-full border-collapse ${
                  isTeam
                    ? 'min-w-[720px] md:min-w-[820px]'
                    : showAdminDeleteCol
                      ? 'min-w-[740px] md:min-w-[860px]'
                      : 'min-w-[680px] md:min-w-[780px]'
                } ${tableText}`}
              >
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {isTeam ? (
                    <th
                      className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap sticky left-0 z-10 bg-gray-100 border-r border-gray-200`}
                    >
                      구분
                    </th>
                  ) : null}
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    날짜
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>성함</th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    연락처
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>담당</th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>최초 배정</th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    만족
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    상태
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>처리자</th>
                  {showAdminDeleteCol ? (
                    <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>삭제</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const assignee = assigneeListLabel(item);
                  const firstAssignee = firstAssigneeLabel(item);
                  const processor = processorNameLabel(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer group"
                      onClick={() => openDetail(item)}
                    >
                      {isTeam ? (
                        <td
                          className={`${tdPad} sticky left-0 z-10 border-r border-gray-200 bg-white group-hover:bg-gray-50`}
                        >
                          {item.status === 'DONE' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded font-medium text-green-800 bg-green-100">
                              완료
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded font-medium text-amber-900 bg-amber-100">
                              미완료
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td
                        className={`${tdPad} text-gray-700 tabular-nums whitespace-nowrap ${
                          isTeam ? 'max-w-[5.5rem] lg:max-w-none' : 'max-w-[7rem] md:max-w-none'
                        }`}
                      >
                        <span className={isTeam ? 'lg:hidden' : 'md:hidden'}>
                          {formatDateTimeTinyKo(item.createdAt)}
                        </span>
                        <span className={isTeam ? 'hidden lg:inline' : 'hidden md:inline'}>
                          {formatDateTimeCompactWithWeekday(item.createdAt)}
                        </span>
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={item.customerName}
                      >
                        {item.customerName}
                      </td>
                      <td
                        className={`${tdPad} tabular-nums whitespace-nowrap max-w-[6.5rem] sm:max-w-none`}
                      >
                        {item.customerPhone}
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={assignee}
                      >
                        {assignee}
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={firstAssignee}
                      >
                        {firstAssignee}
                      </td>
                      <td className={tdPad}>
                        <span
                          className={`tabular-nums text-gray-800 ${isTeam ? 'lg:hidden' : 'md:hidden'}`}
                        >
                          {item.serviceRating != null && item.serviceRating >= 1 && item.serviceRating <= 5
                            ? `${item.serviceRating}점`
                            : '—'}
                        </span>
                        <span
                          className={`inline-flex w-full justify-center ${isTeam ? 'hidden lg:inline-flex' : 'hidden md:inline-flex'}`}
                        >
                          <ServiceRatingStars value={item.serviceRating} />
                        </span>
                      </td>
                      <td className={tdPad}>
                        <span
                          className={`inline-block px-1 py-0.5 md:px-2 rounded leading-tight ${
                            isTeam ? 'max-lg:text-[0.62rem] max-md:text-[0.6rem]' : 'max-md:text-[0.65rem]'
                          } ${
                            item.status === 'DONE'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'PROCESSING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === item.status)?.label ?? item.status}
                        </span>
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={processor}
                      >
                        {processor}
                      </td>
                      {showAdminDeleteCol ? (
                        <td className={tdPad} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="min-h-[36px] px-2 py-1 text-fluid-xs font-medium text-red-700 border border-red-200 rounded hover:bg-red-50 touch-manipulation"
                            onClick={() => setCsDeleteTarget(item)}
                          >
                            삭제
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SyncHorizontalScroll>
            {isAdmin && !loading ? (
              <ListPaginationBar
                mode="nav"
                page={listPage}
                pageSize={listPageSize}
                total={listTotal}
                onPageChange={handleListPageChange}
                onPageSizeChange={handleListPageSizeChange}
              />
            ) : null}
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={closeDetail} />
            <div className="p-4 border-b pr-12">
              <h2 className="font-semibold">C/S 상세</h2>
              {mode === 'team' ? (
                <p className="text-fluid-xs text-gray-600 mt-1">
                  아래에 <strong className="font-medium text-gray-800">처리 방법</strong>을 적은 뒤 「처리완료」를 누르세요.
                </p>
              ) : null}
            </div>
            <div className="p-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <span className="text-gray-500 text-sm">처리 상태</span>
                  <p className="font-medium">
                    {STATUS_OPTIONS.find((s) => s.value === selected.status)?.label ?? selected.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving || selected.status === 'DONE'}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 border border-green-700 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {selected.status === 'DONE' ? '처리 완료됨' : '처리완료'}
                </button>
              </div>

              {selected.status !== 'DONE' ? (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 sm:p-4"
                  id="cs-completion-method-input"
                >
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    C/S 처리 방법 <span className="text-red-600">*</span>
                    <span className="font-normal text-gray-600 text-fluid-xs"> (처리완료 버튼 전에 입력)</span>
                  </label>
                  <textarea
                    value={completionMethodInput}
                    onChange={(e) => setCompletionMethodInput(e.target.value)}
                    rows={4}
                    className="w-full border border-amber-300 rounded px-3 py-2 text-sm resize-none bg-white"
                    placeholder="예: 고객에게 전화로 사과 및 재방문 일정 조율, 현장 확인 후 추가 청소 진행 등"
                  />
                </div>
              ) : null}

              {selected.completedAt && selected.completedBy ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm space-y-1">
                  <div className="font-medium text-green-900">처리 완료 기록</div>
                  <p>
                    <span className="text-gray-600">처리일시</span>{' '}
                    {formatDateTimeCompactWithWeekday(selected.completedAt)}
                  </p>
                  <p>
                    <span className="text-gray-600">처리자</span> {selected.completedBy.name} (
                    {roleLabelKo(selected.completedBy.role)})
                  </p>
                  <div>
                    <span className="text-gray-600">처리 방법</span>
                    <p className="whitespace-pre-wrap text-gray-900 mt-0.5">{selected.completionMethod ?? '—'}</p>
                  </div>
                </div>
              ) : selected.status === 'DONE' ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  처리 완료 상태입니다. (처리 기록이 없는 경우 관리자에게 문의하세요.)
                </div>
              ) : null}

              <div>
                <span className="text-gray-500 text-sm">성함</span>
                <p className="font-medium">{selected.customerName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">연락처</span>
                <p className="font-medium">{selected.customerPhone}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">서비스 품질 (고객 별점)</span>
                {selected.serviceRating != null &&
                selected.serviceRating >= 1 &&
                selected.serviceRating <= 5 ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-lg leading-none">
                      <ServiceRatingStars value={selected.serviceRating} />
                    </span>
                    <span className="text-sm text-gray-600 tabular-nums">{selected.serviceRating}점</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-0.5">기록 없음 (이전 접수 건)</p>
                )}
              </div>

              {selected.status !== 'DONE' ? (
                <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 space-y-1.5 text-rose-900">
                  <div className="flex items-start gap-2">
                    <label
                      className="flex-1 min-w-0 text-sm font-medium text-gray-900 pt-1"
                      htmlFor="cs-as-service-date"
                    >
                      A/S 예정일 <span className="font-normal text-gray-600">(재방문·처리일)</span>
                    </label>
                    <CsHelpQuestionButton
                      label={CS_AS_DATE_HELP}
                      expanded={asDateHelpOpen}
                      onToggle={() => setAsDateHelpOpen((v) => !v)}
                    />
                  </div>
                  {asDateHelpOpen ? (
                    <p className="text-fluid-xs leading-snug rounded-md border border-rose-200/80 bg-white/95 px-2.5 py-2 text-rose-900/90">
                      {CS_AS_DATE_HELP}
                    </p>
                  ) : null}
                  <input
                    id="cs-as-service-date"
                    type="date"
                    min={kstTodayYmd()}
                    value={editAsServiceDate}
                    onChange={(e) => setEditAsServiceDate(e.target.value)}
                    className="w-full min-h-[44px] border border-rose-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                  />
                </div>
              ) : selected.asServiceDate ? (
                <div className="text-sm text-gray-700">
                  <span className="text-gray-500">A/S 예정일</span>{' '}
                  <span className="font-medium tabular-nums">
                    {formatDateCompactWithWeekday(selected.asServiceDate)}
                  </span>
                </div>
              ) : null}

              {selected.inquiry ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div>
                    <span className="text-gray-500 text-sm">담당 팀장</span>
                    <p className="font-medium text-gray-900">{formatTeamLeaderLabel(selected.inquiry)}</p>
                  </div>
                  {selected.inquiry.inquiryNumber ? (
                    <p className="text-sm text-gray-700">
                      접수번호{' '}
                      <span className="font-mono tabular-nums">{selected.inquiry.inquiryNumber}</span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setConnectedInquiryModal(selected.inquiry!)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 touch-manipulation"
                  >
                    연결 접수 상세 보기
                  </button>
                </div>
              ) : mode === 'admin' ? (
                <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  접수 목록과 자동 연결된 건이 없습니다. (성함·연락처가 접수 DB와 일치할 때 연결됩니다.) 아래에서 팀장·타업체에
                  전달하면 해당 계정 C/S 메뉴에 표시됩니다.
                </p>
              ) : null}

              {mode === 'admin' && selected.status !== 'DONE' ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/90 p-3 space-y-2 text-indigo-950">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 text-sm font-semibold text-indigo-950 pt-1">
                      팀장·타업체에 전달
                    </div>
                    <CsHelpQuestionButton
                      label={CS_FORWARD_HELP}
                      expanded={forwardHelpOpen}
                      onToggle={() => setForwardHelpOpen((v) => !v)}
                    />
                  </div>
                  {forwardHelpOpen ? (
                    <p className="text-fluid-xs leading-snug rounded-md border border-indigo-200 bg-white/95 px-2.5 py-2 text-indigo-900/90">
                      {CS_FORWARD_HELP}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <select
                      value={forwardSelectUserId}
                      onChange={(e) => setForwardSelectUserId(e.target.value)}
                      className="flex-1 min-w-0 min-h-[44px] border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="">전달 안 함 (목록에서 제외)</option>
                      {forwardOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatAssignableUserLabel(u)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleForwardSend}
                      disabled={forwardSending}
                      className="min-h-[44px] shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-700 border border-indigo-800 hover:bg-indigo-800 disabled:opacity-50 touch-manipulation"
                    >
                      {forwardSending ? '처리 중…' : '보내기'}
                    </button>
                  </div>
                  {selected.forwardedToUser ? (
                    <p className="text-fluid-xs text-gray-700">
                      현재 전달: {formatAssignableUserLabel(forwardedToAsUserItem(selected.forwardedToUser))}
                    </p>
                  ) : null}
                </div>
              ) : mode === 'admin' && selected.forwardedToUser ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  전달: {formatAssignableUserLabel(forwardedToAsUserItem(selected.forwardedToUser))} (완료 건은 전달
                  변경 불가)
                </div>
              ) : null}

              <div>
                <span className="text-gray-500 text-sm">내용</span>
                <p className="whitespace-pre-wrap text-sm">{selected.content}</p>
              </div>
              {selected.imageUrls?.length ? (
                <div>
                  <span className="text-gray-500 text-sm block mb-2">첨부 사진</span>
                  <div className="flex flex-wrap gap-2">
                    {selected.imageUrls.map((url, i) => {
                      const slides = selected.imageUrls.map((u, j) => ({
                        src: u,
                        alt: `첨부 ${j + 1}`,
                      }));
                      return (
                        <ImageThumbLightbox
                          key={i}
                          src={url}
                          alt={`첨부 ${i + 1}`}
                          thumbClassName="w-6 h-6 object-cover rounded border border-gray-200"
                          buttonClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                          gallerySlides={selected.imageUrls.length > 1 ? slides : undefined}
                          galleryIndex={i}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태 (수동 변경)</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  {statusSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {mode === 'team' && selected.status === 'RECEIVED' && (
                  <p className="text-xs text-gray-500 mt-1">현재 접수 상태입니다. 처리중 또는 완료로만 변경할 수 있습니다.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                  placeholder="내부 메모"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50 min-h-[44px] touch-manipulation"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              {mode === 'admin' && adminViewer ? (
                <button
                  type="button"
                  onClick={() => setCsDeleteTarget(selected)}
                  className="w-full py-2 border border-red-300 text-red-700 text-sm font-medium rounded hover:bg-red-50 min-h-[44px] touch-manipulation"
                >
                  C/S 영구 삭제…
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeDetail}
                className="w-full py-2 border border-gray-300 text-gray-800 text-sm font-medium rounded bg-white hover:bg-gray-50 min-h-[44px] touch-manipulation"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmPasswordModal
        open={!!csDeleteTarget}
        title={
          csDeleteTarget
            ? `「${csDeleteTarget.customerName}」 C/S를 영구 삭제합니다. 복구할 수 없습니다.`
            : ''
        }
        confirmLabel="삭제"
        onClose={() => setCsDeleteTarget(null)}
        onConfirm={async (password) => {
          if (!token || !csDeleteTarget) return;
          await deleteCsReport(token, csDeleteTarget.id, password);
          const deletedId = csDeleteTarget.id;
          setItems((prev) => prev.filter((i) => i.id !== deletedId));
          setSelected((s) => (s?.id === deletedId ? null : s));
          (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
        }}
      />

      {connectedInquiryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setConnectedInquiryModal(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setConnectedInquiryModal(null)} />
            <div className="p-4 border-b pr-12">
              <h2 className="font-semibold text-base">연결된 접수 상세</h2>
              {connectedInquiryModal.inquiryNumber ? (
                <p className="text-sm text-gray-600 mt-1">
                  접수번호{' '}
                  <span className="font-mono tabular-nums">{connectedInquiryModal.inquiryNumber}</span>
                </p>
              ) : null}
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">접수일</span>
                  <p>
                    {connectedInquiryModal.createdAt
                      ? formatDateTimeCompactWithWeekday(connectedInquiryModal.createdAt)
                      : '-'}
                  </p>
                </div>
                {!isInquirySourceHiddenFromUi(connectedInquiryModal.source) ? (
                  <div>
                    <span className="text-gray-500 text-xs block mb-0.5">출처</span>
                    <p>{formatInquirySourceLabel(connectedInquiryModal.source)}</p>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                <span className="text-gray-500 text-xs block mb-0.5">담당 팀장</span>
                <p className="font-medium">{formatTeamLeaderLabel(connectedInquiryModal)}</p>
                </div>
                <div>
                <span className="text-gray-500 text-xs block mb-0.5">접수 상태</span>
                <p>{INQUIRY_STATUS_LABELS[connectedInquiryModal.status] ?? connectedInquiryModal.status}</p>
                </div>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">고객</span>
                <p>
                  {connectedInquiryModal.customerName} / {connectedInquiryModal.customerPhone}
                  {connectedInquiryModal.customerPhone2 ? ` / ${connectedInquiryModal.customerPhone2}` : ''}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">주소</span>
                <p className="whitespace-pre-wrap">
                  {connectedInquiryModal.address}
                  {connectedInquiryModal.addressDetail ? ` ${connectedInquiryModal.addressDetail}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">건축물 유형</span>
                  <p>{connectedInquiryModal.propertyType || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">평수</span>
                  <p>{formatAreaLine(connectedInquiryModal)}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">방/화/베/주</span>
                  <p>
                    {connectedInquiryModal.roomCount ?? '-'} / {connectedInquiryModal.bathroomCount ?? '-'} /{' '}
                    {connectedInquiryModal.balconyCount ?? '-'} / {connectedInquiryModal.kitchenCount ?? '-'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                <span className="text-gray-500 text-xs block mb-0.5">희망일·시간</span>
                <p>
                  {connectedInquiryModal.preferredDate
                    ? formatDateCompactWithWeekday(connectedInquiryModal.preferredDate)
                    : '-'}
                  {connectedInquiryModal.preferredTime
                    ? ` · ${connectedInquiryModal.preferredTime}`
                    : ''}
                  {connectedInquiryModal.preferredTimeDetail
                    ? ` (${connectedInquiryModal.preferredTimeDetail})`
                    : ''}
                </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">신축/구축/인테리어/거주</span>
                  <p>{connectedInquiryModal.buildingType || '-'}</p>
                </div>
              </div>
              {connectedInquiryModal.moveInDate ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">이사 날짜</span>
                  <p>{formatDateCompactWithWeekday(connectedInquiryModal.moveInDate)}</p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">팀원 투입</span>
                  <p>
                    {connectedInquiryModal.crewMemberCount ?? '-'}명
                    {connectedInquiryModal.crewMemberNote?.trim()
                      ? ` · ${connectedInquiryModal.crewMemberNote.trim()}`
                      : ''}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">일정 메모</span>
                  <p className="whitespace-pre-wrap text-gray-800">
                    {connectedInquiryModal.scheduleMemo?.trim() || '-'}
                  </p>
                </div>
              </div>
              {connectedInquiryModal.memo?.trim() ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">접수 메모</span>
                  <p className="whitespace-pre-wrap text-gray-800">{connectedInquiryModal.memo}</p>
                </div>
              ) : null}
              {connectedInquiryModal.claimMemo?.trim() ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">클레임 메모</span>
                  <p className="whitespace-pre-wrap text-gray-800">{connectedInquiryModal.claimMemo}</p>
                </div>
              ) : null}
              {connectedInquiryModal.specialNotes?.trim() ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">특이사항 (고객 작성)</span>
                  <p className="whitespace-pre-wrap text-gray-800">{connectedInquiryModal.specialNotes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
