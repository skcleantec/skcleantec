import { useMemo } from 'react';
import type { ExtraWorkItem } from '../../../api/extraWork';
import { SyncHorizontalScroll } from '../../ui/SyncHorizontalScroll';

export const UNASSIGNED = '__none__';

export function won(n: number) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function kstDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function dayLabel(ymd: string) {
  const [, month, day] = ymd.split('-');
  return `${Number(month)}/${Number(day)}`;
}

/** 팀장 한 명이면 칸 금액은 추가금액. 여러 명이면 그 팀장 몫만 칸에 적는다. */
export function cellAmount(item: ExtraWorkItem, leaderId: string) {
  if (leaderId === UNASSIGNED) return item.amountWon;
  const share = item.leaderShares.find((row) => row.teamLeaderId === leaderId);
  if (!share) return 0;
  if (item.leaderShares.length === 1) return item.amountWon;
  return share.amountWon;
}

export function jobsForLeader(items: ExtraWorkItem[], leaderId: string) {
  return items.filter((item) => {
    if (leaderId === UNASSIGNED) return item.leaderShares.length === 0;
    return item.leaderShares.some((share) => share.teamLeaderId === leaderId);
  });
}

function cellTitle(item: ExtraWorkItem, leaderId: string) {
  const share = item.leaderShares.find((row) => row.teamLeaderId === leaderId);
  const lines = [
    item.customerName,
    item.inquiryNumber ?? '',
    `${item.workLabel}${item.areaLabel ? ` · ${item.areaLabel}` : ''}`,
    `추가금액 ${won(item.amountWon)}`,
    `마케터 ${item.marketerName} ${won(item.marketerWon)}`,
    item.parentMarketerName ? `상위 ${item.parentMarketerName} ${won(item.parentWon)}` : '',
    share && item.leaderShares.length > 1 ? `이 팀장 몫 ${won(share.amountWon)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export type LeaderCol = { id: string; name: string };

type DayRow = {
  day: string;
  items: ExtraWorkItem[];
  amount: number;
  marketer: number;
  parent: number;
  leader: number;
  company: number;
};

function monthDays(month: string): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];
  const last = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  const days: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    days.push(`${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`);
  }
  return days;
}

export function buildBoard(items: ExtraWorkItem[], month: string, roster: LeaderCol[]) {
  const leaderNames = new Map(roster.map((leader) => [leader.id, leader.name]));
  let unassigned = false;
  for (const item of items) {
    if (item.leaderShares.length === 0) unassigned = true;
    for (const share of item.leaderShares) leaderNames.set(share.teamLeaderId, share.name);
  }
  const leaders: LeaderCol[] = [...leaderNames.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  if (unassigned) leaders.push({ id: UNASSIGNED, name: '팀장 없음' });

  const grouped = new Map<string, ExtraWorkItem[]>();
  for (const item of items) {
    const day = kstDay(item.occurredAt);
    const list = grouped.get(day) ?? [];
    list.push(item);
    grouped.set(day, list);
  }
  const dayKeys = monthDays(month);
  const keys = dayKeys.length > 0 ? dayKeys : [...grouped.keys()].sort();
  const days: DayRow[] = keys.map((day) => {
    const rows = grouped.get(day) ?? [];
    return {
      day,
      items: rows,
      amount: rows.reduce((sum, row) => sum + row.amountWon, 0),
      marketer: rows.reduce((sum, row) => sum + row.marketerWon, 0),
      parent: rows.reduce((sum, row) => sum + row.parentWon, 0),
      leader: rows.reduce((sum, row) => sum + row.teamLeaderWon, 0),
      company: rows.reduce((sum, row) => sum + row.companyWon, 0),
    };
  });

  const received = new Map<string, { name: string; ownCount: number; amount: number; take: number; fromDownline: number }>();
  const touch = (id: string, name: string) => {
    const row = received.get(id) ?? { name, ownCount: 0, amount: 0, take: 0, fromDownline: 0 };
    row.name = name;
    received.set(id, row);
    return row;
  };
  for (const item of items) {
    const own = touch(item.marketerId, item.marketerName);
    own.ownCount += 1;
    own.amount += item.amountWon;
    own.take += item.marketerWon;
    if (item.parentMarketerId && item.parentWon > 0) {
      touch(item.parentMarketerId, item.parentMarketerName ?? '상위').fromDownline += item.parentWon;
    }
  }
  const marketers = [...received.entries()]
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.take + b.fromDownline - (a.take + a.fromDownline));

  return { leaders, days, marketers };
}

function JobStack(props: { items: ExtraWorkItem[]; leaderId: string }) {
  const { items, leaderId } = props;
  if (items.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const shared = leaderId !== UNASSIGNED && item.leaderShares.length > 1;
        return (
          <div key={item.id} title={cellTitle(item, leaderId)} className="min-w-0 leading-none">
            <p className="truncate font-medium text-slate-900">{item.marketerName}</p>
            <p className="truncate text-right tabular-nums tracking-tight text-slate-800">{won(cellAmount(item, leaderId))}</p>
            <p className="truncate text-slate-500">
              {shared ? '나눠 배정 · ' : ''}
              {item.workLabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function ExtraSettlementBoard(props: { items: ExtraWorkItem[]; month: string; leaders: LeaderCol[] }) {
  const { items, month, leaders } = props;
  const board = useMemo(() => buildBoard(items, month, leaders), [items, leaders, month]);
  const monthTotals = useMemo(
    () =>
      board.days.reduce(
        (sum, day) => ({
          amount: sum.amount + day.amount,
          marketer: sum.marketer + day.marketer,
          parent: sum.parent + day.parent,
          leader: sum.leader + day.leader,
          company: sum.company + day.company,
        }),
        { amount: 0, marketer: 0, parent: 0, leader: 0, company: 0 },
      ),
    [board.days],
  );

  const summaryLabels = ['당일', '마케터', '상위', '팀장', '회사'] as const;

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        칸의 이름은 그 건을 딴 마케터입니다. 금액은 추가금액이고, 팀장이 여러 명이면 그 팀장 몫만 적습니다. 오른쪽은 그날 합계입니다.
      </p>

      <div className="space-y-2 lg:hidden">
        {items.length === 0 ? (
          <p className="text-fluid-2xs text-slate-500">이 달 추가 시공은 없습니다. 아래 표에서 날짜와 팀장 칸을 볼 수 있습니다.</p>
        ) : null}
        {board.days.filter((day) => day.items.length > 0).map((day) => (
          <article key={day.day} className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-fluid-xs font-medium text-slate-900">{dayLabel(day.day)}</p>
              <p className="tabular-nums text-fluid-xs text-slate-800">{won(day.amount)}</p>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {day.items.map((item) => (
                <div key={item.id} className="min-w-0">
                  <p className="truncate text-fluid-xs text-slate-900">
                    {(item.leaderShares.length > 0 ? item.leaderShares.map((share) => share.name).join('·') : '팀장 없음')}
                    {' · '}
                    {item.marketerName}
                  </p>
                  <p className="truncate text-fluid-2xs text-slate-500">
                    {item.customerName} · {item.workLabel} · {won(item.amountWon)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-fluid-2xs leading-snug text-slate-600">
              마케터 {won(day.marketer)} · 상위 {won(day.parent)} · 팀장 {won(day.leader)} · 회사 {won(day.company)}
            </p>
          </article>
        ))}
      </div>

      <div className="min-w-0 w-full max-w-full">
        <SyncHorizontalScroll contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0">
            <table
              className="w-max min-w-full border-collapse text-fluid-2xs tracking-tight"
              style={{ minWidth: `${56 + board.leaders.length * 72 + 5 * 76}px` }}
            >
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="sticky left-0 z-10 w-14 min-w-14 whitespace-nowrap border-b border-r border-slate-200 bg-slate-100 px-1 py-1 text-center font-medium">
                    날짜
                  </th>
                  {board.leaders.map((leader) => (
                    <th
                      key={leader.id}
                      title={leader.name}
                      className="w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] truncate border-b border-slate-200 px-1 py-1 text-center font-medium"
                    >
                      {leader.name}
                    </th>
                  ))}
                  {summaryLabels.map((label) => (
                    <th key={label} className="w-[4.75rem] min-w-[4.75rem] whitespace-nowrap border-b border-slate-200 px-1 py-1 text-center font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.days.map((day) => (
                  <tr key={day.day} className="group border-t border-slate-100">
                    <td className="sticky left-0 z-10 w-14 min-w-14 border-r border-slate-200 bg-white px-1 py-1 text-center font-medium text-slate-800 group-hover:bg-slate-50">
                      {dayLabel(day.day)}
                    </td>
                    {board.leaders.map((leader) => (
                      <td key={leader.id} className="w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] overflow-hidden px-1 py-1 align-top text-center group-hover:bg-slate-50">
                        <JobStack items={jobsForLeader(day.items, leader.id)} leaderId={leader.id} />
                      </td>
                    ))}
                    {[day.amount, day.marketer, day.parent, day.leader, day.company].map((value, index) => (
                      <td key={summaryLabels[index]} className="w-[4.75rem] min-w-[4.75rem] px-1 py-1 text-right tabular-nums tracking-tight text-slate-800">
                        {won(value)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                  <td className="sticky left-0 z-10 w-14 min-w-14 border-r border-slate-200 bg-slate-50 px-1 py-1 text-center">월정산</td>
                  {board.leaders.map((leader) => {
                    const total = board.days.reduce(
                      (sum, day) =>
                        sum + jobsForLeader(day.items, leader.id).reduce((inner, item) => inner + cellAmount(item, leader.id), 0),
                      0,
                    );
                    return (
                      <td key={leader.id} className="w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] truncate px-1 py-1 text-right tabular-nums tracking-tight">
                        {won(total)}
                      </td>
                    );
                  })}
                  {[monthTotals.amount, monthTotals.marketer, monthTotals.parent, monthTotals.leader, monthTotals.company].map((value, index) => (
                    <td key={summaryLabels[index]} className="w-[4.75rem] min-w-[4.75rem] px-1 py-1 text-right tabular-nums tracking-tight">
                      {won(value)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
        </SyncHorizontalScroll>
      </div>

      <div className="min-w-0">
        <p className="mb-1.5 text-fluid-xs font-medium text-slate-800">마케터별</p>
        <div className="space-y-1.5 lg:hidden">
          {board.marketers.length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-2 py-4 text-center text-fluid-xs text-slate-500">
              이 달 추가 시공이 없습니다.
            </p>
          ) : null}
          {board.marketers.map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-200 p-2">
              <p className="truncate text-fluid-xs font-medium text-slate-900">{row.name}</p>
              <p className="text-fluid-2xs text-slate-600">
                {row.ownCount}건 · 추가 {won(row.amount)} · 수령 {won(row.take)}
                {row.fromDownline > 0 ? ` · 하위에서 ${won(row.fromDownline)}` : ''}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full table-fixed border-collapse text-fluid-xs">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead className="bg-slate-100">
              <tr>
                {['마케터', '건수', '추가금액', '수령', '하위에서 받은 금액'].map((label) => (
                  <th key={label} className="px-2 py-2 text-center font-medium text-slate-700">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.marketers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    이 달 추가 시공이 없습니다.
                  </td>
                </tr>
              ) : null}
              {board.marketers.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="truncate px-2 py-2 text-center" title={row.name}>
                    {row.name}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">{row.ownCount}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.amount)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.take)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{won(row.fromDownline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
