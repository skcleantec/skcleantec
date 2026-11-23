import { useCallback, useEffect, useState } from 'react';
import {
  dismissTelecrmWorkEntry,
  fetchTelecrmWorkEntry,
  fetchTelecrmWorkSummary,
  listTelecrmWorkEntries,
  type TelecrmWorkCounts,
  type TelecrmWorkDetail,
  type TelecrmWorkListItem,
} from '../../../api/telecrmWorkHistory';
import { getToken } from '../../../stores/auth';
import { kstTodayYmd } from '../../../utils/dateFormat';
import type { CrmWorkLeaveNotice } from '../../../hooks/useCrmWorkTracker';

const SOURCE_LABEL: Record<TelecrmWorkListItem['source'], string> = {
  soomgo: '숨고에서 가져옴',
  miso: '미소에서 가져옴',
  followup: '부재·보류에서 불러옴',
  lookup: '기존 찾기',
  manual: '직접 입력',
  incoming_call: '전화 수신',
};

const SAVED_LABEL: Record<string, string> = {
  requested: '요청 저장',
  absent: '부재 저장',
  hold: '보류 저장',
  deposit: '예약금 대기 저장',
  reserved: '입금 완료 저장',
  received: '예약완료 저장',
};

const LEFT_LABEL: Record<string, string> = {
  switch: '다른 고객을 불러오면서 넘어감',
  reset: '접수란을 비우면서 넘어감',
  close: '창을 닫으면서 넘어감',
  session_end: '종료·정산하면서 넘어감',
};

export function CrmIconWorkHistory({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function minutesLabel(item: TelecrmWorkListItem): string {
  if (!item.endedAt) return '';
  const min = Math.max(1, Math.round((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 60000));
  return ` · ${min}분`;
}

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
}

function nameOf(item: TelecrmWorkListItem): string {
  return item.nickname?.trim() || item.customerName?.trim() || '이름 없음';
}

function phoneOf(item: TelecrmWorkListItem): string {
  return item.contactPhone?.trim() || item.safePhone?.trim() || '번호 없음';
}

function actionChips(item: TelecrmWorkListItem): string[] {
  const a = item.actions;
  const out: string[] = [];
  if (a.callCount > 0) out.push(`통화 ${a.callCount}회`);
  if (a.quoteSent) out.push(a.quoteAmountWon ? `견적 보냄 ${Math.round(a.quoteAmountWon / 10000)}만` : '견적 보냄');
  if (a.smsCount > 0) out.push(`문자 ${a.smsCount}`);
  if (a.soomgoMessageCount > 0) out.push(`숨고 메시지 ${a.soomgoMessageCount}`);
  if (a.misoMessageCount > 0) out.push(`미소 메시지 ${a.misoMessageCount}`);
  if (a.memoEdited) out.push('메모 적음');
  else if (a.fieldsEdited) out.push('내용 고침');
  return out;
}

function OutcomeChip({ item }: { item: TelecrmWorkListItem }) {
  if (item.outcome === 'SAVED') {
    return (
      <span className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[11px] font-bold text-emerald-700">
        {SAVED_LABEL[item.savedKind ?? ''] ?? '저장함'}
      </span>
    );
  }
  if (item.outcome === 'UNSAVED') {
    return (
      <span className="whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 px-1.5 py-px text-[11px] font-bold text-rose-700">
        {item.resumedAt ? '저장 안 함 · 이어서 함' : item.dismissedAt ? '저장 안 함 · 정리함' : '저장 안 함'}
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px text-[11px] font-medium text-slate-600">
      {item.outcome === 'OPEN' ? '작업 중' : '보기만 함'}
    </span>
  );
}

/** 저장 안 하고 다른 고객으로 넘어갔을 때 접수란 위에 뜨는 한 줄 */
export function CrmWorkLeaveNoticeBar({
  notice,
  busy,
  onRestore,
  onDismiss,
}: {
  notice: CrmWorkLeaveNotice;
  busy: boolean;
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-1.5 space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5" role="status">
      <p className="text-fluid-2xs leading-snug text-rose-900">
        <span className="font-bold">{notice.label}</span>님을 저장하지 않았어요. 작업 기록에 남겨 뒀어요.
      </p>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-6 items-center rounded-md px-1.5 text-fluid-2xs font-medium text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        >
          닫기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRestore}
          className="inline-flex h-6 max-w-full items-center truncate rounded-md border border-rose-300 bg-white px-2 text-fluid-2xs font-bold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
        >
          {notice.label}님으로 되돌리기
        </button>
      </div>
    </div>
  );
}

/** 왼쪽에서 열리는 작업 기록 창 — 마케터는 본인 것만, 관리자는 마케터를 골라 본다 */
export function CrmWorkHistoryDrawer({
  open,
  onClose,
  isAdmin,
  myUserId,
  refreshKey,
  resumingId,
  onResume,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  myUserId: string | null;
  /** 저장·넘어감이 생기면 바뀌는 값 — 열려 있으면 목록을 다시 받는다 */
  refreshKey: number;
  resumingId: string | null;
  onResume: (entryId: string) => void;
  onChanged: () => void;
}) {
  const [date, setDate] = useState(kstTodayYmd);
  /** 관리자: '' = 마케터 전체, 그 밖에는 그 사람 */
  const [who, setWho] = useState<string>(isAdmin ? '' : (myUserId ?? ''));
  const [items, setItems] = useState<TelecrmWorkListItem[]>([]);
  const [counts, setCounts] = useState<TelecrmWorkCounts | null>(null);
  const [summary, setSummary] = useState<Array<{ userId: string; userName: string; loaded: number; saved: number; unsaved: number; viewed: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TelecrmWorkDetail | null>(null);
  const today = kstTodayYmd();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listTelecrmWorkEntries(token, { date, userId: isAdmin && who ? who : undefined, limit: 200 }),
        isAdmin ? fetchTelecrmWorkSummary(token, date).catch(() => null) : Promise.resolve(null),
      ]);
      setItems(list.items);
      setCounts(list.counts);
      setSummary(sum?.items ?? []);
    } catch (e) {
      setItems([]);
      setCounts(null);
      setError(e instanceof Error ? e.message : '작업 기록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [date, who, isAdmin]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pendingUnsaved = items.filter((item) => item.outcome === 'UNSAVED' && !item.dismissedAt && !item.resumedAt);
  const showingOthers = isAdmin && who !== (myUserId ?? '');

  const dismiss = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await dismissTelecrmWorkEntry(token, id);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '정리하지 못했어요.');
    }
  };

  const openDetail = async (id: string) => {
    const token = getToken();
    if (!token) return;
    if (detail?.id === id) {
      setDetail(null);
      return;
    }
    try {
      setDetail((await fetchTelecrmWorkEntry(token, id)).item);
    } catch (e) {
      setError(e instanceof Error ? e.message : '내용을 불러오지 못했어요.');
    }
  };

  const detailLines = (d: TelecrmWorkDetail): string[] => {
    const draft = (d.draft ?? {}) as Record<string, unknown>;
    const text = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string).trim() : '');
    return [
      text('address') ? `주소 ${text('address')}` : '',
      text('pyeong') ? `평수 ${text('pyeong')}` : '',
      text('preferredMoveInCleanYmd') ? `희망일 ${text('preferredMoveInCleanYmd')}` : '',
      text('leadSource') ? `유입 ${text('leadSource')}` : '',
      text('requestMemo') ? `메모\n${text('requestMemo')}` : '',
    ].filter(Boolean);
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="작업 기록">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/20" />
      <div className="absolute inset-y-0 left-0 flex w-[min(460px,94vw)] flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-fluid-sm font-bold text-slate-900">작업 기록</p>
          <button
            type="button"
            aria-label="하루 전"
            onClick={() => setDate((d) => shiftYmd(d, -1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            ‹
          </button>
          <span className="min-w-[5.5rem] text-center text-fluid-2xs font-medium tabular-nums text-slate-700">
            {date === today ? `오늘 · ${date.slice(5).replace('-', '.')}` : date.replace(/-/g, '.')}
          </span>
          <button
            type="button"
            aria-label="하루 뒤"
            disabled={date >= today}
            onClick={() => setDate((d) => shiftYmd(d, 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            ›
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 items-center rounded-lg px-2 text-fluid-2xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-3">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-fluid-2xs text-slate-600">
              누구 기록
              <select
                value={who}
                onChange={(e) => {
                  setWho(e.target.value);
                  setDetail(null);
                }}
                className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs text-slate-900"
              >
                <option value="">마케터 전체</option>
                {myUserId ? <option value={myUserId}>내 기록</option> : null}
                {summary
                  .filter((row) => row.userId !== myUserId)
                  .map((row) => (
                    <option key={row.userId} value={row.userId}>
                      {row.userName}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          {counts ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 px-2.5 py-1.5">
                <p className="text-[11.5px] text-slate-600">불러온 고객</p>
                <p className="text-lg font-extrabold tabular-nums text-slate-900">{counts.loaded}명</p>
              </div>
              <div className="rounded-xl border border-slate-200 px-2.5 py-1.5">
                <p className="text-[11.5px] text-slate-600">저장함</p>
                <p className="text-lg font-extrabold tabular-nums text-emerald-700">{counts.saved}명</p>
              </div>
              <div className={`rounded-xl border px-2.5 py-1.5 ${counts.unsaved > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
                <p className={`text-[11.5px] ${counts.unsaved > 0 ? 'text-rose-800' : 'text-slate-600'}`}>저장 안 함</p>
                <p className={`text-lg font-extrabold tabular-nums ${counts.unsaved > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{counts.unsaved}명</p>
                {counts.unsaved > 0 && pendingUnsaved.length !== counts.unsaved ? (
                  <p className="text-[11px] text-rose-800">아직 남은 것 {pendingUnsaved.length}명</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isAdmin && who === '' && summary.length > 0 ? (
            <div>
              <p className="mb-1 text-fluid-xs font-bold text-slate-700">마케터별</p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_4rem_3.25rem] gap-1 bg-slate-50 px-3 py-1.5 text-right text-[11.5px] font-bold text-slate-600">
                  <span className="text-left">마케터</span>
                  <span>불러옴</span>
                  <span>저장</span>
                  <span>저장 안 함</span>
                  <span>보기만</span>
                </div>
                {summary.map((row) => (
                  <button
                    key={row.userId}
                    type="button"
                    onClick={() => setWho(row.userId)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_4rem_3.25rem] items-center gap-1 border-t border-slate-100 px-3 py-2 text-right text-fluid-xs tabular-nums hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                  >
                    <span className="truncate text-left font-bold text-slate-900">{row.userName}</span>
                    <span>{row.loaded}</span>
                    <span className="font-bold text-emerald-700">{row.saved}</span>
                    <span className={row.unsaved > 0 ? 'font-extrabold text-rose-700' : 'text-slate-500'}>{row.unsaved}</span>
                    <span className="text-slate-500">{row.viewed}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-fluid-2xs font-medium text-red-700">{error}</p> : null}

          {pendingUnsaved.length > 0 ? (
            <div>
              <p className="mb-1.5 text-fluid-xs font-bold text-rose-700">저장 안 한 고객 {pendingUnsaved.length}명</p>
              <ul className="space-y-2">
                {pendingUnsaved.map((item) => {
                  const mine = item.userId === myUserId;
                  const chips = actionChips(item);
                  const tail = item.leftBy ? LEFT_LABEL[item.leftBy] : '';
                  return (
                    <li key={item.id} className="space-y-1.5 rounded-xl border border-rose-200 px-3 py-2.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-fluid-sm font-bold text-slate-900">{nameOf(item)}</span>
                        <span className="shrink-0 text-fluid-2xs tabular-nums text-slate-600">{phoneOf(item)}</span>
                        <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-slate-600">
                          {timeLabel(item.startedAt)}
                          {minutesLabel(item)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {showingOthers || (isAdmin && who === '') ? (
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-px text-[11px] font-semibold text-slate-700">{item.userName}</span>
                        ) : null}
                        <span className="rounded-md border border-slate-200 px-1.5 py-px text-[11px] text-slate-700">{SOURCE_LABEL[item.source]}</span>
                        {chips.map((chip) => (
                          <span key={chip} className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-px text-[11px] font-medium text-violet-800">
                            {chip}
                          </span>
                        ))}
                      </div>
                      {item.summary || tail ? (
                        <p className="break-words text-fluid-2xs leading-relaxed text-slate-600">
                          {[item.summary, tail].filter(Boolean).join('. ')}
                        </p>
                      ) : null}
                      {detail?.id === item.id ? (
                        <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-2 py-1.5 text-fluid-2xs leading-relaxed text-slate-700">
                          {detailLines(detail).join('\n') || '적어 둔 내용이 없어요.'}
                        </p>
                      ) : null}
                      <div className="flex justify-end gap-1.5">
                        {item.hasDraft ? (
                          <button
                            type="button"
                            onClick={() => void openDetail(item.id)}
                            className="inline-flex h-7 items-center rounded-lg px-2 text-fluid-2xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                          >
                            {detail?.id === item.id ? '내용 접기' : '내용 보기'}
                          </button>
                        ) : null}
                        {mine ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void dismiss(item.id)}
                              className="inline-flex h-7 items-center rounded-lg px-2 text-fluid-2xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                            >
                              필요 없음
                            </button>
                            <button
                              type="button"
                              disabled={!item.hasDraft || resumingId != null}
                              onClick={() => onResume(item.id)}
                              className="inline-flex h-7 items-center rounded-lg bg-violet-700 px-2.5 text-fluid-2xs font-bold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
                            >
                              {resumingId === item.id ? '불러오는 중…' : '이어서 하기'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-0.5 text-fluid-xs font-bold text-slate-700">
              {date === today ? '오늘 작업한 고객' : '이날 작업한 고객'}
              <span className="ml-1.5 font-normal text-slate-500">최근 순</span>
            </p>
            {loading && items.length === 0 ? <p className="py-6 text-center text-fluid-2xs text-slate-500">불러오는 중…</p> : null}
            {!loading && items.length === 0 && !error ? (
              <p className="py-6 text-center text-fluid-2xs text-slate-500">이날 접수란에 올린 고객이 없어요.</p>
            ) : null}
            <ul>
              {items.map((item) => (
                <li key={item.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-slate-100 py-2">
                  <span className="text-fluid-2xs tabular-nums text-slate-600">{timeLabel(item.startedAt)}</span>
                  <span className="min-w-0 truncate">
                    <span className="text-fluid-xs font-bold text-slate-900">{nameOf(item)}</span>{' '}
                    <span className="text-[11.5px] text-slate-600">
                      {[isAdmin && who === '' ? item.userName : '', SOURCE_LABEL[item.source].replace(/에서 .*$/, ''), ...actionChips(item).slice(0, 2)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <OutcomeChip item={item} />
                  {item.userId === myUserId && item.hasDraft && item.outcome !== 'SAVED' && item.outcome !== 'OPEN' ? (
                    <button
                      type="button"
                      disabled={resumingId != null}
                      onClick={() => onResume(item.id)}
                      className="inline-flex h-7 items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50"
                    >
                      {resumingId === item.id ? '불러오는 중…' : '다시 불러오기'}
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="border-t border-slate-100 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-600">
          {isAdmin
            ? '관리자는 모든 마케터의 기록을 봅니다. 「이어서 하기」는 그 기록을 만든 사람 화면에만 나와요.'
            : '내 기록만 보여요.'}{' '}
          기록은 30일, 저장 안 한 고객의 적던 내용은 14일 뒤 지워집니다.
        </p>
      </div>
    </div>
  );
}
