import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import { fetchTelecrmWorkdeskStats, type TelecrmWorkdeskStatsDto } from '../../../api/telecrm';

function formatDuration(sec: number): string {
  if (sec <= 0) return '0분';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <span className="text-[10px] font-medium text-white/55">{label}</span>
      <span className="text-fluid-xs font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

/** CRM 헤더 중앙 — 오늘 통화·접수 집계 */
export function CrmHeaderStats({ refreshKey = 0 }: { refreshKey?: number }) {
  const token = getToken();
  const [stats, setStats] = useState<TelecrmWorkdeskStatsDto | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchTelecrmWorkdeskStats(token);
      setStats(res);
    } catch {
      setStats(null);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!stats) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto">
        <span className="text-[11px] text-white/40">집계…</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto px-1">
      <div className="inline-flex shrink-0 items-center divide-x divide-white/15 rounded-xl border border-white/10 bg-white/5 px-0.5 py-1 sm:px-1 sm:py-1.5">
        <StatChip label="연결" value={`${stats.connectedCount}건`} />
        <StatChip label="미연결" value={`${stats.noAnswerCount}건`} />
        <StatChip label="연결시간" value={formatDuration(stats.connectedDurationSec)} />
        <StatChip label="예약완료" value={`${stats.receivedCount}건`} />
        <StatChip label="부재·보류" value={`${stats.absentHoldCount}건`} />
      </div>
    </div>
  );
}
