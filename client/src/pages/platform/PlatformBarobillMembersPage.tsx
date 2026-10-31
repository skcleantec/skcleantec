import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BAROBILL_MEMBER_STATUS_LABEL, barobillTaxTypeLabel, barobillUserIdError } from '@shared/barobillPolicy';
import { alignPlatformBarobillNts, approvePlatformBarobillMember, checkPlatformBarobillMember, completePlatformBarobillLink, fetchPlatformBarobillMembers, fetchPlatformCashbillHolds, rejectPlatformBarobillMember, releasePlatformBarobillProcessing, returnPlatformBarobillLink, type PlatformBarobillMemberRow } from '../../api/platformBarobill';
import { PlatformBarobillLinkCard } from '../../components/platform/PlatformBarobillLinkCard';
import { ListPaginationBar } from '../../components/ui/ListPaginationBar';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { YearMonthSelect, YmdSelect } from '../../components/ui/DateQuerySelects';
import {
  INQUIRY_LIST_DEFAULT_PAGE_SIZE,
  parseInquiryListPageSize,
  parseListPage,
} from '../../utils/listPagination';
import { BTN_PRIMARY } from '../../utils/platformUi';

const SEG =
  'rounded-md px-2 py-1 text-fluid-2xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const SEG_ON = 'bg-slate-900 text-white hover:bg-slate-800';

const BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800',
  LINK_REQUIRED: 'bg-amber-50 text-amber-800',
  FAILED: 'bg-red-50 text-red-700',
  PENDING_REVIEW: 'bg-amber-50 text-amber-900',
  REJECTED: 'bg-red-50 text-red-800',
  PROCESSING: 'bg-slate-100 text-slate-700',
};

function seoulYmd(date = new Date()): { ym: string; ymd: string } {
  const text = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return { ym: text.slice(0, 7), ymd: text };
}

export function PlatformBarobillMembersPage() {
  const [params, setParams] = useSearchParams();
  const datePreset = params.get('datePreset') || 'all';
  const month = params.get('month') || seoulYmd().ym;
  const day = params.get('day') || seoulYmd().ymd;
  const status = params.get('status') || '';
  const env = params.get('env') || '';
  const page = parseListPage(params.get('page'));
  const pageSize = parseInquiryListPageSize(params.get('pageSize'));
  const [items, setItems] = useState<PlatformBarobillMemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userIds, setUserIds] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, { isMember: boolean; message: string }>>({});
  const [holds, setHolds] = useState<{ id: string; tenantName: string; code: number; kind?: string; createdAt: string }[]>([]);

  function replace(next: Record<string, string | null>, resetPage: boolean) {
    const qs = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (!value) qs.delete(key);
      else qs.set(key, value);
    }
    if (resetPage) qs.set('page', '1');
    setParams(qs, { replace: true });
  }

  useEffect(() => {
    const qs = new URLSearchParams();
    qs.set('datePreset', datePreset);
    if (datePreset === 'month') qs.set('month', month);
    if (datePreset === 'day') qs.set('day', day);
    if (status) qs.set('status', status);
    if (env) qs.set('env', env);
    qs.set('limit', String(pageSize));
    qs.set('offset', String((page - 1) * pageSize));
    let cancelled = false;
    setLoading(true);
    fetchPlatformBarobillMembers(qs)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datePreset, month, day, status, env, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformCashbillHolds()
      .then((items) => {
        if (!cancelled) setHolds(items);
      })
      .catch(() => {
        if (!cancelled) setHolds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  async function reload() {
    const qs = new URLSearchParams();
    qs.set('datePreset', datePreset);
    if (datePreset === 'month') qs.set('month', month);
    if (datePreset === 'day') qs.set('day', day);
    if (status) qs.set('status', status);
    if (env) qs.set('env', env);
    qs.set('limit', String(pageSize));
    qs.set('offset', String((page - 1) * pageSize));
    const res = await fetchPlatformBarobillMembers(qs);
    setItems(res.items);
    setTotal(res.total);
  }

  async function approve(row: PlatformBarobillMemberRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await approvePlatformBarobillMember(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '승인에 실패했습니다.');
      try {
        await reload();
      } catch {
        /* 목록 갱신 실패는 위 오류를 유지한다. */
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: PlatformBarobillMemberRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await rejectPlatformBarobillMember(row.id, reasons[row.id] ?? '');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '반려에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function checkMember(row: PlatformBarobillMemberRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const result = await checkPlatformBarobillMember(row.id);
      setChecks((prev) => ({ ...prev, [row.id]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 여부를 확인하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function release(row: PlatformBarobillMemberRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await releasePlatformBarobillProcessing(row.id);
      setChecks((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '검토 중으로 되돌리지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }
  async function returnLink(row: PlatformBarobillMemberRow, reason: string) {
    setBusyId(row.id);
    setError(null);
    try {
      await returnPlatformBarobillLink(row.id, reason);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결 불가로 돌려보내지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function alignNts(row: PlatformBarobillMemberRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await alignPlatformBarobillNts(row.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '국세청 전송 설정을 바꾸지 못했습니다.');
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function complete(row: PlatformBarobillMemberRow, userIdOverride?: string) {
    const barobillUserId = (userIdOverride ?? userIds[row.id] ?? '').trim();
    const invalid = barobillUserIdError(barobillUserId);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await completePlatformBarobillLink(row.id, barobillUserId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리완료에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  const showBlocking = loading && items.length === 0;

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      <h1 className="text-fluid-lg font-semibold text-slate-900">계산서(바로빌)</h1>
      {holds.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">
          <p className="font-medium">발급 보류</p>
          <ul className="mt-1 space-y-0.5">
            {holds.map((hold) => (
              <li key={hold.id}>{hold.tenantName} · {hold.kind === 'taxinvoice' ? '세금계산서' : '현금영수증'} · 일시적으로 발급할 수 없습니다 · {hold.code}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <span className="text-fluid-xs text-slate-600">등록일</span>
        <div className="inline-flex gap-0.5 rounded-lg border border-gray-200 p-0.5">
          {(
            [
              ['all', '전체'],
              ['month', '월별'],
              ['day', '날짜'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${SEG} ${datePreset === id ? SEG_ON : 'text-slate-700'}`}
              onClick={() => replace({ datePreset: id }, true)}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === 'month' ? (
          <YearMonthSelect value={month} onChange={(value) => replace({ month: value }, true)} />
        ) : null}
        {datePreset === 'day' ? <YmdSelect value={day} onChange={(value) => replace({ day: value }, true)} /> : null}
        <div className="inline-flex gap-0.5 rounded-lg border border-gray-200 p-0.5">
          {(
            [
              ['', '전체'],
              ['ACTIVE', '가입완료'],
              ['PENDING_REVIEW', '검토 중'],
              ['REJECTED', '반려'],
              ['LINK_REQUIRED', '연결 필요'],
              ['FAILED', '실패'],
              ['PROCESSING', '처리 중'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={label}
              type="button"
              className={`${SEG} ${status === id ? SEG_ON : 'text-slate-700'}`}
              onClick={() => replace({ status: id || null }, true)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ListPaginationBar
        mode="summary"
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(next) => replace({ page: String(next) }, false)}
        onPageSizeChange={(size) => replace({ pageSize: String(size), page: '1' }, false)}
      />
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {showBlocking ? <p className="p-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {!showBlocking && items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
          회원사가 없습니다.
        </p>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="space-y-2 lg:hidden">
            {items.map((row) => (
              <MemberCard
                key={row.id}
                row={row}
                userId={userIds[row.id] ?? ''}
                reason={reasons[row.id] ?? ''}
                busy={busyId === row.id}
                onUserId={(value) => setUserIds((prev) => ({ ...prev, [row.id]: value }))}
                onReason={(value) => setReasons((prev) => ({ ...prev, [row.id]: value }))}
                onComplete={(userId) => void complete(row, userId)}
                onReturn={(reason) => void returnLink(row, reason)}
                onApprove={() => void approve(row)}
                onReject={() => void reject(row)}
                check={checks[row.id] ?? null}
                onCheck={() => void checkMember(row)}
                onRelease={() => void release(row)}
                onAlign={() => void alignNts(row)}
              />
            ))}
          </div>
          <div className="hidden lg:block">
            <SyncHorizontalScroll>
              <table className="w-full border-collapse text-fluid-xs">
                <thead className="bg-gray-100">
                  <tr>
                    {['환경', '업체', '브랜드', '사업자번호', '상태', '과세유형', '인증서 만료', '처리'].map((label) => (
                      <th key={label} className="px-2 py-2 text-center font-medium text-slate-700">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-2 py-2 text-center">{row.env}</td>
                      <td className="max-w-[10rem] truncate px-2 py-2 text-center" title={row.tenantName}>
                        {row.tenantName}
                      </td>
                      <td className="max-w-[10rem] truncate px-2 py-2 text-center" title={row.brandName ?? ''}>
                        {row.brandName ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums">{row.corpNumMasked}</td>
                      <td className="px-2 py-2 text-center">
                        <StatusBadge row={row} />
                        <DuplicateWarning row={row} />
                      </td>
                      <td className="px-2 py-2 text-center">{barobillTaxTypeLabel(row.taxType)}</td>
                      <td className="px-2 py-2 text-center"><CertExpireCell expireDate={row.certExpireDate} /></td>
                      <td className="px-2 py-2 text-center">
                        <ReviewActions
                          row={row}
                          userId={userIds[row.id] ?? ''}
                          reason={reasons[row.id] ?? ''}
                          busy={busyId === row.id}
                          onUserId={(value) => setUserIds((prev) => ({ ...prev, [row.id]: value }))}
                          onReason={(value) => setReasons((prev) => ({ ...prev, [row.id]: value }))}
                          onComplete={(userId) => void complete(row, userId)}
                          onReturn={(reason) => void returnLink(row, reason)}
                          onApprove={() => void approve(row)}
                          onReject={() => void reject(row)}
                          check={checks[row.id] ?? null}
                          onCheck={() => void checkMember(row)}
                          onRelease={() => void release(row)}
                          onAlign={() => void alignNts(row)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncHorizontalScroll>
          </div>
        </>
      ) : null}
      {!loading ? (
        <ListPaginationBar
          mode="nav"
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(next) => replace({ page: String(next) }, false)}
          onPageSizeChange={(size) => replace({ pageSize: String(size) }, true)}
        />
      ) : null}
      <p className="text-fluid-2xs text-slate-500">페이지당 기본 {INQUIRY_LIST_DEFAULT_PAGE_SIZE}건 · 등록일 기준</p>
    </div>
  );
}

function statusView(row: PlatformBarobillMemberRow): { label: string; className: string } {
  if (row.confirmNeeded) return { label: '확인 필요', className: 'bg-red-50 text-red-800' };
  if (row.status === 'LINK_REQUIRED' && row.linkRequestedAt) return { label: '대기', className: 'bg-amber-50 text-amber-800' };
  return {
    label: BAROBILL_MEMBER_STATUS_LABEL[row.status],
    className: BADGE[row.status] ?? 'bg-slate-100 text-slate-700',
  };
}

function StatusBadge({ row }: { row: PlatformBarobillMemberRow }) {
  const view = statusView(row);
  return <span className={`rounded-full px-2 py-0.5 ${view.className}`}>{view.label}</span>;
}

function DuplicateWarning({ row }: { row: PlatformBarobillMemberRow }) {
  if (row.duplicateApplicants.length === 0) return null;
  const text = row.duplicateApplicants
    .map((item) => `${item.tenantName}(${BAROBILL_MEMBER_STATUS_LABEL[item.status]})`)
    .join(', ');
  return (
    <p className="mt-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-fluid-2xs text-amber-900" title={text}>
      다른 업체 신청 · {text}
    </p>
  );
}

function LinkComplete({
  userId,
  busy,
  onUserId,
  onComplete,
}: {
  userId: string;
  busy: boolean;
  onUserId: (value: string) => void;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <input
        className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        value={userId}
        placeholder="회원 아이디"
        onChange={(e) => onUserId(e.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`}
        disabled={busy || userId.trim().length < 6}
        onClick={() => onComplete()}
      >
        처리완료
      </button>
    </div>
  );
}

function ReviewActions({
  row,
  userId,
  reason,
  busy,
  check,
  onUserId,
  onReason,
  onComplete,
  onReturn,
  onApprove,
  onReject,
  onCheck,
  onRelease,
  onAlign,
}: {
  row: PlatformBarobillMemberRow;
  userId: string;
  reason: string;
  busy: boolean;
  check: { isMember: boolean; message: string } | null;
  onUserId: (value: string) => void;
  onReason: (value: string) => void;
  onComplete: (userId?: string) => void;
  onReturn: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCheck: () => void;
  onRelease: () => void;
  onAlign: () => void;
}) {
  if (row.status === 'ACTIVE') return <NtsAlignControl row={row} busy={busy} onAlign={onAlign} />;
  if (row.status === 'LINK_REQUIRED') {
    return <PlatformBarobillLinkCard row={row} busy={busy} onComplete={onComplete} onReturn={onReturn} />;
  }
  if (row.confirmNeeded) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          disabled={busy}
          onClick={onCheck}
        >
          회원 여부 확인
        </button>
        {check ? <p className="text-fluid-2xs text-slate-700">{check.message}</p> : null}
        {check?.isMember ? (
          <LinkComplete userId={userId} busy={busy} onUserId={onUserId} onComplete={onComplete} />
        ) : null}
        {check && !check.isMember ? (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            disabled={busy}
            onClick={onRelease}
          >
            검토 중으로 되돌리기
          </button>
        ) : null}
      </div>
    );
  }
  if (row.status !== 'PENDING_REVIEW') return <span className="text-slate-400">—</span>;
  return (
    <div className="space-y-1">
      {row.businessRegistrationImageUrl ? (
        <a href={row.businessRegistrationImageUrl} target="_blank" rel="noreferrer" className="block text-fluid-2xs text-slate-800 underline">
          사업자등록증
        </a>
      ) : (
        <p className="text-fluid-2xs text-red-700">사업자등록증 없음</p>
      )}
      <p className="truncate text-fluid-2xs text-slate-600" title={row.corpName}>{row.corpName}</p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          className={`${BTN_PRIMARY} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none`}
          disabled={busy}
          onClick={onApprove}
        >
          승인
        </button>
        <input
          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-fluid-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          value={reason}
          placeholder="반려 사유"
          onChange={(e) => onReason(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-fluid-xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          disabled={busy || reason.trim().length === 0}
          onClick={onReject}
        >
          반려
        </button>
      </div>
    </div>
  );
}

const NTS_CONSOLE_HINT = '바로빌 콘솔 › 회원사 관리에서 국세청 전송을 익일 전송으로 바꿔 주세요';

function NtsAlignControl({
  row,
  busy,
  onAlign,
}: {
  row: PlatformBarobillMemberRow;
  busy: boolean;
  onAlign: () => void;
}) {
  if (row.ntsNextDayBlocked) {
    return <span className="text-fluid-2xs text-slate-700">국세청 전송: 익일 · 지연발급: 차단</span>;
  }
  return (
    <div className="space-y-1">
      {row.ntsAlignFailed ? <p className="text-fluid-2xs text-amber-800">{NTS_CONSOLE_HINT}</p> : null}
      <button
        type="button"
        className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-fluid-2xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        disabled={busy}
        onClick={onAlign}
      >
        {busy ? '맞추는 중…' : '익일로 맞추기'}
      </button>
    </div>
  );
}

function CertExpireCell({ expireDate }: { expireDate: string | null }) {
  if (!expireDate) return <span className="text-slate-400">—</span>;
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  const end = Date.parse(`${expireDate.slice(0, 10)}T00:00:00+09:00`);
  const start = Date.parse(`${today}T00:00:00+09:00`);
  const left = Number.isFinite(end) && Number.isFinite(start) ? Math.round((end - start) / 86_400_000) : null;
  const tone = left != null && left < 0
    ? 'font-medium text-[#b42318]'
    : left != null && left <= 30
      ? 'font-medium text-amber-700'
      : 'text-slate-700';
  return <span className={`tabular-nums ${tone}`}>{expireDate.slice(0, 10)}</span>;
}

function MemberCard({
  row,
  userId,
  reason,
  busy,
  check,
  onUserId,
  onReason,
  onComplete,
  onReturn,
  onApprove,
  onReject,
  onCheck,
  onRelease,
  onAlign,
}: {
  row: PlatformBarobillMemberRow;
  userId: string;
  reason: string;
  busy: boolean;
  check: { isMember: boolean; message: string } | null;
  onUserId: (value: string) => void;
  onReason: (value: string) => void;
  onComplete: (userId?: string) => void;
  onReturn: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onCheck: () => void;
  onRelease: () => void;
  onAlign: () => void;
}) {
  return (
    <article className="space-y-1 rounded-lg border border-gray-200 bg-white p-2">
      <p className="truncate text-fluid-sm font-medium text-slate-900" title={row.tenantName}>
        {row.tenantName}
      </p>
      <p className="truncate text-fluid-xs text-slate-600" title={row.brandName ?? ''}>
        {row.brandName ?? '브랜드 없음'} · {row.env} · {row.corpNumMasked}
      </p>
      <p className="text-fluid-xs">
        <StatusBadge row={row} />
        <span className="ml-2 text-slate-600">{barobillTaxTypeLabel(row.taxType)}</span>
        <CertExpireCell expireDate={row.certExpireDate} />
      </p>
      <DuplicateWarning row={row} />
      {row.rejectReason ? <p className="text-fluid-2xs text-red-800">반려 사유: {row.rejectReason}</p> : null}
      {row.lastError ? <p className="text-fluid-2xs text-amber-800">{row.lastError}</p> : null}
      <ReviewActions
        row={row}
        userId={userId}
        reason={reason}
        busy={busy}
        check={check}
        onUserId={onUserId}
        onReason={onReason}
        onComplete={onComplete}
        onReturn={onReturn}
        onApprove={onApprove}
        onReject={onReject}
        onCheck={onCheck}
        onRelease={onRelease}
        onAlign={onAlign}
      />
    </article>
  );
}
