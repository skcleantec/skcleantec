import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteBankDeposit,
  fetchBankDepositSummary,
  ignoreBankDeposit,
  listBankDepositDevices,
  listBankDeposits,
  listUnparsedBankDeposits,
  resolveUnparsedBankDeposit,
  unlinkBankDeposit,
  type BankDepositUnparsedItem,
  type BankDepositCounts,
  type BankDepositItem,
  type BankDepositSummary,
} from '../../api/bankDeposits';
import { useBankDepositRealtime } from '../../hooks/useBankDepositRealtime';
import { useOperatingCompanies } from '../../hooks/useOperatingCompanies';
import { addDaysToKstYmd, kstTodayYmd } from '../../utils/dateFormat';
import { PageTitleWithFavorite } from '../layout/NavFavoritePageTitle';
import { Button } from '../ui/Button';
import { StatusChip, Tag } from '../ui/StatusChip';
import { BankDepositLinkDialog } from './BankDepositLinkDialog';
import { BankDepositManualDialog } from './BankDepositManualDialog';
import { BankDepositSetupDialog } from './BankDepositSetupDialog';
import { notifyBankDepositNavBadgeRefresh } from './bankDepositNavBadge';
import {
  DEPOSIT_KIND_LABEL,
  DEPOSIT_STATUS_LABEL,
  DEPOSIT_STATUS_TONE,
  deviceSeen,
  kstDayLabel,
  kstTime,
  targetStatusLabel,
  won,
} from './bankDepositFormat';

type Filter = 'ALL' | 'REVIEW' | 'LINKED' | 'IGNORED';
const PAGE = 100;

function isLinked(row: BankDepositItem): boolean {
  return row.status === 'AUTO_LINKED' || row.status === 'LINKED';
}

function LinkedCell({ row }: { row: BankDepositItem }) {
  if (!isLinked(row)) {
    if (row.status === 'IGNORED') return <span className="text-fluid-2xs text-slate-400">{row.note?.trim() || '연결하지 않음'}</span>;
    if (row.noOwner) {
      return (
        <span className="block text-fluid-2xs font-semibold text-rose-700">
          팀장 모두 「내 건 아니에요」 · 사무실에서 확인해 주세요
        </span>
      );
    }
    return (
      <span className="block text-fluid-2xs text-amber-800">
        누구 입금인지 골라 주세요
        {row.teamLeaderCount && row.teamLeaderCount > 0 && (row.teamDeclinedCount ?? 0) > 0 ? (
          <span className="ml-1 text-slate-500">
            · 팀장 {row.teamLeaderCount}명 중 {row.teamDeclinedCount}명이 내 건 아니라고 했어요
          </span>
        ) : null}
      </span>
    );
  }
  const kind = row.linkedKind ? DEPOSIT_KIND_LABEL[row.linkedKind] : '';
  const linked = row.linked ?? null;
  const target = linked?.target ?? (row.linkedFollowupId ? 'followup' : 'inquiry');
  const name = linked?.customerName?.trim() || (target === 'followup' ? '부재·보류 고객' : '접수 고객');
  const sub = [
    row.claimedByTeamLeaderName ? `${row.claimedByTeamLeaderName} 팀장 확인` : '',
    kind,
    linked?.preferredDate ? `청소 ${kstDayLabel(linked.preferredDate)}` : '',
    targetStatusLabel(target, linked?.status),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className="block min-w-0">
      <span className="block truncate text-fluid-xs font-semibold text-slate-900">{name}</span>
      {sub ? <span className="block truncate text-fluid-2xs text-slate-500">{sub}</span> : null}
    </span>
  );
}

/** 담당 마케터와 배정된 팀장. 연결된 입금에만 나온다. */
function StaffCell({ row, inline = false }: { row: BankDepositItem; inline?: boolean }) {
  if (!isLinked(row) || !row.linked) return inline ? null : <span className="text-fluid-2xs text-slate-300">—</span>;
  const marketer = row.linked.marketerName?.trim() || '';
  const leaders = (row.linked.teamLeaderNames ?? []).map((x) => x.trim()).filter(Boolean);
  if (!marketer && leaders.length === 0) return inline ? null : <span className="text-fluid-2xs text-slate-300">—</span>;
  if (inline) {
    return (
      <span className="block truncate text-fluid-2xs text-slate-500">
        {[marketer ? `담당 ${marketer}` : '', leaders.length ? `팀장 ${leaders.join(', ')}` : ''].filter(Boolean).join(' · ')}
      </span>
    );
  }
  return (
    <span className="block min-w-0">
      <span className="block truncate text-fluid-xs text-slate-800">{marketer || '—'}</span>
      <span className="block truncate text-fluid-2xs text-slate-500">{leaders.length ? `팀장 ${leaders.join(', ')}` : '팀장 미배정'}</span>
    </span>
  );
}

function RowButtons({
  row,
  busy,
  canEdit,
  canDelete,
  deleteArmed,
  onFind,
  onIgnore,
  onUnlink,
  onArmDelete,
  onDelete,
}: {
  row: BankDepositItem;
  busy: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deleteArmed: boolean;
  onFind: () => void;
  onIgnore: () => void;
  onUnlink: () => void;
  onArmDelete: (armed: boolean) => void;
  onDelete: () => void;
}) {
  if (!canEdit) return null;
  if (deleteArmed) {
    return (
      <span className="flex items-center justify-end gap-1">
        <span className="mr-1 whitespace-nowrap text-fluid-2xs text-rose-700">되돌릴 수 없어요</span>
        <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
          지우기
        </Button>
        <Button size="sm" variant="quiet" onClick={() => onArmDelete(false)} disabled={busy}>
          취소
        </Button>
      </span>
    );
  }
  const del = canDelete ? (
    <button
      type="button"
      onClick={() => onArmDelete(true)}
      disabled={busy}
      aria-label="이 입금 줄 지우기"
      title="이 입금 줄 지우기"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-45"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
      </svg>
    </button>
  ) : null;
  if (row.status === 'NEEDS_REVIEW') {
    return (
      <span className="flex justify-end gap-1">
        <Button size="sm" variant="primary" onClick={onFind} disabled={busy}>
          고객 찾기
        </Button>
        <Button size="sm" variant="quiet" onClick={onIgnore} disabled={busy} title="청소와 상관없는 입금이면 목록에서 접어 둡니다">
          청소와 무관
        </Button>
        {del}
      </span>
    );
  }
  if (row.status === 'IGNORED') {
    return (
      <span className="flex justify-end gap-1">
        <Button size="sm" variant="quiet" onClick={onUnlink} disabled={busy}>
          되돌리기
        </Button>
        {del}
      </span>
    );
  }
  return (
    <span className="flex justify-end gap-1">
      <Button size="sm" onClick={onFind} disabled={busy}>
        바꾸기
      </Button>
      <Button size="sm" variant="quiet" onClick={onUnlink} disabled={busy}>
        연결 끊기
      </Button>
      {del}
    </span>
  );
}

/** 서비스접수 › 입금 확인 — 은행 입금 문자로 들어온 입금과 접수를 맞춰 본다. */
export function BankDepositPanel({ token }: { token: string }) {
  const brands = useOperatingCompanies(token);
  const brandOptions = useMemo(
    () => brands.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.displayName || b.name })),
    [brands],
  );
  const [date, setDate] = useState(() => kstTodayYmd());
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BankDepositItem[]>([]);
  const [counts, setCounts] = useState<BankDepositCounts>({ today: 0, autoLinked: 0, needsReview: 0, ignored: 0 });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<BankDepositItem | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState<BankDepositSummary | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [unparsed, setUnparsed] = useState<BankDepositUnparsedItem[]>([]);
  const [unparsedOpen, setUnparsedOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dateRef = useRef(date);
  dateRef.current = date;

  const load = useCallback(
    async (opts?: { more?: boolean; quiet?: boolean }) => {
      const ymd = dateRef.current;
      if (!opts?.quiet) setLoading(true);
      setError(null);
      try {
        const offset = opts?.more ? items.length : 0;
        const r = await listBankDeposits(token, { date: ymd, limit: PAGE, offset });
        if (dateRef.current !== ymd) return;
        setItems((prev) => (opts?.more ? [...prev, ...r.items] : r.items));
        setCounts(r.counts);
        setHasMore(r.items.length === PAGE);
      } catch (e) {
        setError(e instanceof Error ? e.message : '입금 내역을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    },
    // items.length 는 더 보기에서만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, items.length],
  );
  const loadRef = useRef(load);
  loadRef.current = load;

  const loadStatus = useCallback(async () => {
    try {
      const s = await fetchBankDepositSummary(token);
      setSummary(s);
      if ((s.unparsedCount ?? 0) > 0) {
        const u = await listUnparsedBankDeposits(token);
        setUnparsed(u.items.filter((x) => !x.resolvedAt));
      } else {
        setUnparsed([]);
      }
    } catch {
      /* 요약이 없어도 목록은 쓴다 */
    }
    try {
      const d = await listBankDepositDevices(token);
      setIsAdmin(true);
      const active = d.items.filter((x) => x.isActive && !x.revokedAt);
      const last = active
        .map((x) => x.lastSeenAt)
        .filter((x): x is string => Boolean(x))
        .sort()
        .pop();
      setSummary((prev) => ({
        ...(prev ?? {}),
        needsReviewCount: prev?.needsReviewCount ?? 0,
        devices: { total: active.length, lastSeenAt: last ?? null },
      }));
    } catch {
      /* 관리자가 아니면 기기 목록을 볼 수 없다 */
    }
  }, [token]);

  useEffect(() => {
    void loadRef.current();
  }, [date, token]);

  useEffect(() => {
    void loadStatus();
    const t = setInterval(() => {
      setNow(Date.now());
      void loadStatus();
    }, 60000);
    return () => clearInterval(t);
  }, [loadStatus]);

  useBankDepositRealtime(
    token,
    (p) => {
      if (dateRef.current === kstTodayYmd()) {
        void loadRef.current({ quiet: true });
        if (p.event !== 'changed') setFreshIds((prev) => new Set(prev).add(p.id));
        setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
        }, 6000);
      }
      notifyBankDepositNavBadgeRefresh();
    },
    true,
  );

  const afterChange = async () => {
    await loadRef.current({ quiet: true });
    notifyBankDepositNavBadgeRefresh();
  };

  const act = async (row: BankDepositItem, fn: () => Promise<unknown>) => {
    setBusyId(row.id);
    setError(null);
    try {
      await fn();
      await afterChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusyId(null);
    }
  };

  const linkedCount = Math.max(0, counts.today - counts.needsReview - counts.ignored);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      if (filter === 'REVIEW' && row.status !== 'NEEDS_REVIEW') return false;
      if (filter === 'LINKED' && !isLinked(row)) return false;
      if (filter === 'IGNORED' && row.status !== 'IGNORED') return false;
      if (!q) return true;
      return (
        row.depositorName.toLowerCase().includes(q) ||
        (row.linked?.customerName ?? '').toLowerCase().includes(q) ||
        (row.linked?.marketerName ?? '').toLowerCase().includes(q) ||
        String(row.amountWon).includes(q.replace(/[^\d]/g, '') || '\u0000')
      );
    });
  }, [items, filter, query]);

  const today = kstTodayYmd();
  const device = summary?.devices ?? null;
  const seen = device && device.total > 0 ? deviceSeen(device.lastSeenAt, now) : null;
  const sum = shown.reduce((acc, row) => acc + (row.status === 'IGNORED' ? 0 : row.amountWon), 0);
  const brandName = (id: string | null) => (id ? brandOptions.find((b) => b.id === id)?.name ?? '' : '');
  const showBrand = brandOptions.length > 1;

  const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'ALL', label: '전체', count: counts.today },
    { id: 'REVIEW', label: '확인 필요', count: counts.needsReview },
    { id: 'LINKED', label: '연결됨', count: linkedCount },
    { id: 'IGNORED', label: '청소와 무관', count: counts.ignored },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <PageTitleWithFavorite label="입금 확인">
            <h1 className="text-fluid-lg font-semibold text-slate-900">입금 확인</h1>
          </PageTitleWithFavorite>
          <p className="mt-1 text-fluid-xs text-slate-500">
            통장에 들어온 입금을 문자로 받아 접수와 맞춰 보여 줘요. 이름과 금액이 한 고객과 딱 맞으면 자동으로 잇고, 아니면 「확인 필요」로 남깁니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {seen ? (
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-fluid-2xs font-semibold ${
                seen.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
              title="입금 문자를 받는 폰이 마지막으로 서버와 연결된 때"
            >
              <span className={`size-1.5 rounded-full ${seen.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
              폰 {seen.ok ? '연결됨' : '연결 끊김'} · {seen.text}
            </span>
          ) : null}
          <Button size="sm" onClick={() => setManualOpen(true)} title="문자로 들어오지 않은 입금을 직접 넣습니다">
            입금 직접 추가
          </Button>
          {isAdmin ? (
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              폰·통장·알림 설정
            </Button>
          ) : null}
        </div>
      </div>

      {seen && !seen.ok ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-fluid-xs leading-relaxed text-rose-900">
          입금 문자를 받는 폰이 {seen.text}부터 연결되지 않았어요. 그동안 들어온 입금은 여기에 안 보일 수 있습니다. 폰이 켜져 있는지, 앱이 실행 중인지 확인해 주세요.
        </p>
      ) : null}

      {device && device.total === 0 ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-fluid-sm font-bold text-violet-950">아직 연결된 폰이 없어요</p>
          <p className="mt-1 text-fluid-xs leading-relaxed text-violet-900">
            은행 입금 문자를 받는 폰에 「청소비서 입금 알림」 앱을 깔고 연결하면, 입금이 들어올 때마다 여기에 바로 나타납니다.
          </p>
          {isAdmin ? (
            <Button size="md" variant="primary" className="mt-2" onClick={() => setSetupOpen(true)}>
              폰 연결하기
            </Button>
          ) : (
            <p className="mt-1 text-fluid-2xs text-violet-800">연결은 관리자가 할 수 있어요.</p>
          )}
        </div>
      ) : null}

      {unparsed.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-fluid-xs leading-relaxed text-amber-950">
              <span className="font-bold">읽지 못한 입금 문자 {unparsed.length}건</span> · 모양이 달라서 금액이나 입금자를 읽지 못했어요. 내용을 보고 통장과 맞춰 주세요.
            </p>
            <Button size="sm" onClick={() => setUnparsedOpen((v) => !v)}>
              {unparsedOpen ? '접기' : '내용 보기'}
            </Button>
          </div>
          {unparsedOpen ? (
            <ul className="mt-2 space-y-1.5">
              {unparsed.map((u) => (
                <li key={u.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-fluid-2xs tabular-nums text-slate-500">
                      {kstDayLabel(new Date(u.receivedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10))} {kstTime(u.receivedAt)}
                    </span>
                    <span className="mt-0.5 block whitespace-pre-wrap break-words text-fluid-xs text-slate-900">
                      {u.text ?? '잔액을 지우지 못해 내용을 저장하지 않았어요. 폰의 문자함에서 확인해 주세요.'}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() =>
                      void resolveUnparsedBankDeposit(token, u.id)
                        .then(() => loadStatus())
                        .catch((e) => setError(e instanceof Error ? e.message : '처리하지 못했어요.'))
                    }
                  >
                    확인함
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-1">
            <Button size="sm" icon aria-label="전날" onClick={() => setDate(addDaysToKstYmd(date, -1))}>
              ‹
            </Button>
            <label className="relative inline-flex h-7 items-center rounded-[7px] border border-[#dde3ea] px-2.5 text-fluid-xs font-semibold tabular-nums text-slate-900">
              {kstDayLabel(date)}
              {date === today ? <span className="ml-1 text-fluid-2xs font-medium text-slate-500">오늘</span> : null}
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="날짜 고르기"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Button size="sm" icon aria-label="다음 날" disabled={date >= today} onClick={() => setDate(addDaysToKstYmd(date, 1))}>
              ›
            </Button>
            {date !== today ? (
              <Button size="sm" variant="quiet" onClick={() => setDate(today)}>
                오늘로
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="입금 구분">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-fluid-2xs font-semibold ${
                  filter === f.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : f.id === 'REVIEW' && f.count > 0
                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {f.label}
                <span className="tabular-nums">{f.count}</span>
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="입금자·고객·담당 이름, 금액"
            aria-label="목록에서 찾기"
            className="ml-auto h-7 w-full rounded-[7px] border border-slate-300 px-2.5 text-fluid-xs text-slate-900 placeholder:text-slate-400 sm:w-48"
          />
        </div>

        {error ? <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-fluid-xs text-rose-800">{error}</p> : null}

        {loading && items.length === 0 ? (
          <p className="px-4 py-10 text-center text-fluid-xs text-slate-500">불러오는 중이에요.</p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-fluid-xs leading-relaxed text-slate-500">
            {items.length === 0
              ? date === today
                ? '오늘 들어온 입금이 아직 없어요. 입금 문자가 오면 바로 여기에 나타납니다.'
                : '이날 들어온 입금이 없어요.'
              : '조건에 맞는 입금이 없어요.'}
          </p>
        ) : (
          <>
            {/* PC */}
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-fluid-2xs font-semibold text-slate-500">
                    <th className="w-[104px] px-4 py-2">시각</th>
                    <th className="w-[120px] px-2 py-2 text-right">금액</th>
                    <th className="w-[220px] px-4 py-2">입금자</th>
                    <th className="w-[104px] px-2 py-2">상태</th>
                    <th className="px-2 py-2">연결된 고객</th>
                    <th className="w-[150px] px-2 py-2">담당 · 팀장</th>
                    <th className="w-[236px] px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 align-middle transition-colors duration-700 last:border-b-0 ${
                        freshIds.has(row.id) ? 'bg-emerald-50' : row.status === 'IGNORED' ? 'bg-slate-50/60' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-fluid-xs tabular-nums text-slate-600">{kstTime(row.depositedAt)}
                        {row.source === 'manual' ? (
                          <span className="mt-0.5 block" title="사람이 직접 넣은 입금이에요">
                            <Tag>직접 추가</Tag>
                          </span>
                        ) : null}
                        {row.source === 'scan' ? (
                          <span className="mt-0.5 block" title={`문자를 받은 순간에는 못 가져왔고, 점검에서 ${kstTime(row.receivedAt)}에 찾아왔어요`}>
                            <Tag>뒤늦게 가져옴</Tag>
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-2 py-2.5 text-right text-fluid-sm font-bold tabular-nums ${
                          row.status === 'IGNORED' ? 'text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {won(row.amountWon)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="block truncate text-fluid-xs font-semibold text-slate-900">{row.depositorName || '입금자명 없음'}</span>
                        <span className="block truncate text-fluid-2xs tabular-nums text-slate-500">
                          {[row.bankName, row.accountMask, showBrand ? brandName(row.operatingCompanyId) : ''].filter(Boolean).join(' ')}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusChip tone={DEPOSIT_STATUS_TONE[row.status]}>{DEPOSIT_STATUS_LABEL[row.status]}</StatusChip>
                      </td>
                      <td className="px-2 py-2.5">
                        <LinkedCell row={row} />
                      </td>
                      <td className="px-2 py-2.5">
                        <StaffCell row={row} />
                      </td>
                      <td className="px-4 py-2.5">
                        <RowButtons
                          row={row}
                          busy={busyId === row.id}
                          canEdit
                          canDelete={isAdmin}
                          deleteArmed={armedDeleteId === row.id}
                          onArmDelete={(armed) => setArmedDeleteId(armed ? row.id : null)}
                          onDelete={() => void act(row, () => deleteBankDeposit(token, row.id)).then(() => setArmedDeleteId(null))}
                          onFind={() => setLinkTarget(row)}
                          onIgnore={() => void act(row, () => ignoreBankDeposit(token, row.id))}
                          onUnlink={() => void act(row, () => unlinkBankDeposit(token, row.id))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {shown.map((row) => (
                <li key={row.id} className={`px-4 py-3 ${freshIds.has(row.id) ? 'bg-emerald-50' : ''}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-fluid-base font-bold tabular-nums ${row.status === 'IGNORED' ? 'text-slate-400' : 'text-slate-900'}`}>
                      {won(row.amountWon)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fluid-xs font-semibold text-slate-800">{row.depositorName || '입금자명 없음'}</span>
                    <span className="shrink-0 text-fluid-2xs tabular-nums text-slate-500">
                      {kstTime(row.depositedAt)}
                      {row.source === 'scan' ? ' · 뒤늦게 가져옴' : row.source === 'manual' ? ' · 직접 추가' : ''}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusChip tone={DEPOSIT_STATUS_TONE[row.status]}>{DEPOSIT_STATUS_LABEL[row.status]}</StatusChip>
                    <span className="min-w-0 flex-1">
                      <LinkedCell row={row} />
                      <StaffCell row={row} inline />
                    </span>
                  </div>
                  <div className="mt-2">
                    <RowButtons
                      row={row}
                      busy={busyId === row.id}
                      canEdit
                      canDelete={isAdmin}
                      deleteArmed={armedDeleteId === row.id}
                      onArmDelete={(armed) => setArmedDeleteId(armed ? row.id : null)}
                      onDelete={() => void act(row, () => deleteBankDeposit(token, row.id)).then(() => setArmedDeleteId(null))}
                      onFind={() => setLinkTarget(row)}
                      onIgnore={() => void act(row, () => ignoreBankDeposit(token, row.id))}
                      onUnlink={() => void act(row, () => unlinkBankDeposit(token, row.id))}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-fluid-2xs text-slate-500">
              <span>
                {shown.length}건 · 합계 <span className="font-bold tabular-nums text-slate-800">{won(sum)}</span>
                {filter === 'ALL' && counts.ignored > 0 ? ' (청소와 무관한 입금 제외)' : ''}
              </span>
              {hasMore ? (
                <Button size="sm" className="ml-auto" onClick={() => void load({ more: true, quiet: true })}>
                  더 보기
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <p className="text-fluid-2xs leading-relaxed text-slate-500">
        입금이 연결돼도 접수 상태는 저절로 바뀌지 않아요. 통장 잔액은 폰에서 지우고 보내므로 여기에 저장되지 않습니다.
      </p>

      {linkTarget ? (
        <BankDepositLinkDialog
          token={token}
          deposit={linkTarget}
          onClose={() => setLinkTarget(null)}
          onLinked={() => {
            setLinkTarget(null);
            void afterChange();
          }}
        />
      ) : null}
      {manualOpen ? (
        <BankDepositManualDialog
          token={token}
          brands={brandOptions}
          defaultDate={date}
          onClose={() => setManualOpen(false)}
          onCreated={() => {
            setManualOpen(false);
            void afterChange();
          }}
        />
      ) : null}
      {setupOpen ? (
        <BankDepositSetupDialog
          token={token}
          brands={brandOptions}
          onClose={() => setSetupOpen(false)}
          onChanged={() => void loadStatus()}
        />
      ) : null}
    </div>
  );
}
