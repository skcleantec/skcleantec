import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMe } from '../../api/auth';
import { getUsers } from '../../api/users';
import {
  getAdChannels,
  createAdChannel,
  updateAdChannel,
  reorderAdChannels,
  deleteAdChannel,
  getAdvertisingAnalytics,
  getAdSessionHistory,
  type AdChannel,
  type AdvertisingAnalytics,
  type HistorySession,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';
import {
  computeDateRangeFromPreset,
  DATE_RANGE_PRESET_LABELS,
  type DateRangePresetId,
} from '../../utils/dateRangePresets';
import { formatDateTimeCompactWithWeekday } from '../../utils/dateFormat';

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

function numOrDash(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function AdminAdvertisingPage() {
  const token = getToken();
  const [role, setRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [marketers, setMarketers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [marketerFilter, setMarketerFilter] = useState<string>('');

  const [periodPreset, setPeriodPreset] = useState<DateRangePresetId>('thisMonth');
  const [{ from, to }, setRange] = useState(() => computeDateRangeFromPreset('thisMonth')!);
  const [analytics, setAnalytics] = useState<AdvertisingAnalytics | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [newChannelName, setNewChannelName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdChannel | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [channels]
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const me = await getMe(token);
      setRole(me.role);
      setIsSuperAdmin(Boolean(me.isSuperAdmin));

      if (me.role === 'ADMIN') {
        const list = await getUsers(token, 'MARKETER');
        setMarketers(list.map((u) => ({ id: u.id, name: u.name, email: u.email })));
      }

      const mid = me.role === 'ADMIN' ? (marketerFilter || undefined) : undefined;
      const [an, hi, ch] = await Promise.all([
        getAdvertisingAnalytics(token, from, to, mid ?? null),
        getAdSessionHistory(token, from, to, mid ?? null),
        getAdChannels(token, me.isSuperAdmin),
      ]);
      setAnalytics(an);
      setHistory(hi.items);
      setChannels(ch.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, from, to, marketerFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddChannel = async () => {
    if (!token || !newChannelName.trim()) return;
    try {
      await createAdChannel(token, newChannelName.trim());
      setNewChannelName('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '추가 실패');
    }
  };

  const handleToggleChannel = async (c: AdChannel) => {
    if (!token) return;
    try {
      await updateAdChannel(token, c.id, { isActive: !c.isActive });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '수정 실패');
    }
  };

  const moveChannel = async (id: string, direction: 'up' | 'down') => {
    if (!token) return;
    const sorted = sortedChannels;
    const i = sorted.findIndex((c) => c.id === id);
    if (i < 0) return;
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) return;
    const next = [...sorted];
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await reorderAdChannels(
        token,
        next.map((c) => c.id)
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '순서 변경 실패');
    }
  };

  const handleConfirmDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleteSubmitting(true);
    setErr(null);
    try {
      await deleteAdChannel(token, deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const s = analytics?.summary;

  return (
    <div className="space-y-8">
      <h1 className="text-fluid-xl font-semibold text-gray-800">광고비</h1>
      <p className="text-fluid-sm text-gray-600">
        {role === 'ADMIN'
          ? '전체 마케터 기준 지출·발주서 접수 실적을 집계합니다. (마케터는 본인만 조회)'
          : '본인의 광고비 지출과 발주서 접수 실적입니다.'}
      </p>

      {err && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-fluid-sm">{err}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">기간 빠른 선택</label>
          <select
            className="border border-gray-300 rounded px-2 py-1 text-fluid-sm min-w-[8.5rem]"
            value={periodPreset}
            onChange={(e) => {
              const v = e.target.value as DateRangePresetId;
              setPeriodPreset(v);
              const r = computeDateRangeFromPreset(v);
              if (r) setRange(r);
            }}
          >
            {DATE_RANGE_PRESET_LABELS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">시작일</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1 text-fluid-sm"
            value={from}
            onChange={(e) => {
              setPeriodPreset('custom');
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
          />
        </div>
        <div>
          <label className="block text-fluid-xs text-gray-600 mb-1">종료일</label>
          <input
            type="date"
            className="border border-gray-300 rounded px-2 py-1 text-fluid-sm"
            value={to}
            onChange={(e) => {
              setPeriodPreset('custom');
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
          />
        </div>
        {role === 'ADMIN' && (
          <div>
            <label className="block text-fluid-xs text-gray-600 mb-1">마케터</label>
            <select
              className="border border-gray-300 rounded px-2 py-1 text-fluid-sm min-w-[10rem]"
              value={marketerFilter}
              onChange={(e) => setMarketerFilter(e.target.value)}
            >
              <option value="">전체</option>
              {marketers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 bg-blue-600 text-white text-fluid-sm rounded hover:bg-blue-700"
        >
          조회
        </button>
      </div>

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <>
          <div>
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">기간 요약</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard label="총 광고비" value={s ? won(s.totalAdSpend) : '—'} />
              <SummaryCard label="발주서 접수 건수" value={s ? String(s.orderInquiryCount) : '—'} />
              <SummaryCard label="접수 매출 합계" value={s ? won(s.totalRevenue) : '—'} />
              <SummaryCard label="ROAS" value={s?.roas != null ? numOrDash(s.roas) : '—'} sub="매출÷광고비" />
              <SummaryCard label="접수 1건당 비용" value={s?.costPerInquiry != null ? won(s.costPerInquiry) : '—'} />
              <SummaryCard
                label="일평균 광고비"
                value={s ? won(Math.round(s.avgDailySpend)) : '—'}
                sub={`${analytics?.period.days ?? '—'}일 기준`}
              />
            </div>
          </div>

          <div>
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">사용자별 집계</h2>
            <div className="border border-gray-200 rounded overflow-x-auto bg-white">
              <table className="w-full text-fluid-sm min-w-[720px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center py-2 px-3">이름</th>
                    <th className="text-center py-2 px-3">역할</th>
                    <th className="text-center py-2 px-3">광고비</th>
                    <th className="text-center py-2 px-3">발주 접수</th>
                    <th className="text-center py-2 px-3">매출</th>
                    <th className="text-center py-2 px-3">ROAS</th>
                    <th className="text-center py-2 px-3">건당 비용</th>
                    <th className="text-center py-2 px-3">일평균 광고비</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.byUser ?? []).map((row) => (
                    <tr key={row.userId} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-900">{row.name}</td>
                      <td className="py-2 px-3 text-gray-600">{row.role}</td>
                      <td className="py-2 px-3 text-right">{won(row.totalAdSpend)}</td>
                      <td className="py-2 px-3 text-right">{row.orderInquiryCount}</td>
                      <td className="py-2 px-3 text-right">{won(row.totalRevenue)}</td>
                      <td className="py-2 px-3 text-right">{row.roas != null ? numOrDash(row.roas) : '—'}</td>
                      <td className="py-2 px-3 text-right">
                        {row.costPerInquiry != null ? won(Math.round(row.costPerInquiry)) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right">{won(Math.round(row.avgDailySpend))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-fluid-base font-medium text-gray-800 mb-3">작업 종료 이력 (광고비 입력)</h2>
            <div className="border border-gray-200 rounded overflow-x-auto bg-white">
              <table className="w-full text-fluid-sm min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center py-2 px-3">종료 시각</th>
                    {role === 'ADMIN' && <th className="text-center py-2 px-3">담당</th>}
                    <th className="text-center py-2 px-3">채널별 금액</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={role === 'ADMIN' ? 3 : 2} className="py-4 px-3 text-gray-500 text-center">
                        데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="border-t border-gray-100">
                        <td className="py-2 px-3 whitespace-nowrap text-gray-800 text-fluid-xs tabular-nums">
                          {h.endedAt ? formatDateTimeCompactWithWeekday(h.endedAt) : '—'}
                        </td>
                        {role === 'ADMIN' && (
                          <td className="py-2 px-3 text-gray-800">
                            {h.user.name} <span className="text-gray-500 text-fluid-xs">({h.user.email})</span>
                          </td>
                        )}
                        <td className="py-2 px-3 text-gray-700">
                          {h.spendLines.map((l) => (
                            <span key={l.channel.id} className="inline-block mr-2 mb-1">
                              {l.channel.name} {won(l.amount)}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isSuperAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-fluid-base font-medium text-gray-800 mb-2">광고 채널 관리 (최고 관리자)</h2>
          <p className="text-fluid-sm text-gray-600 mb-4">
            순서는 위·아래로 조정합니다. 이력이 있는 채널은 삭제할 수 없으며 비활성화만 가능합니다. 삭제 시 본인 비밀번호가 필요합니다.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              className="border border-gray-300 rounded px-3 py-1.5 text-fluid-sm flex-1 min-w-[12rem]"
              placeholder="새 채널 이름"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void handleAddChannel()}
              className="px-3 py-1.5 bg-blue-600 text-white text-fluid-sm rounded hover:bg-blue-700"
            >
              추가
            </button>
          </div>
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-fluid-sm min-w-[520px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-center py-2 px-3 w-28">순서</th>
                  <th className="text-center py-2 px-3">채널명</th>
                  <th className="text-center py-2 px-3 w-40">관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedChannels.map((c, idx) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="py-2 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        className="px-1.5 py-0.5 border border-gray-300 rounded text-fluid-xs mr-1 disabled:opacity-40"
                        disabled={idx === 0}
                        onClick={() => void moveChannel(c.id, 'up')}
                        title="위로"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-1.5 py-0.5 border border-gray-300 rounded text-fluid-xs disabled:opacity-40"
                        disabled={idx === sortedChannels.length - 1}
                        onClick={() => void moveChannel(c.id, 'down')}
                        title="아래로"
                      >
                        ↓
                      </button>
                    </td>
                    <td className={`py-2 px-3 ${c.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {c.name}
                      {!c.isActive && ' (비활성)'}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleToggleChannel(c)}
                        className="text-fluid-xs text-blue-600 hover:underline mr-2"
                      >
                        {c.isActive ? '비활성화' : '다시 사용'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(c);
                          setDeletePassword('');
                        }}
                        className="text-fluid-xs text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6">
            <h3 className="text-fluid-base font-medium text-gray-900 mb-2">채널 삭제</h3>
            <p className="text-fluid-sm text-gray-600 mb-3">
              「{deleteTarget.name}」을(를) 삭제합니다. 본인 계정 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              className="w-full border border-gray-300 rounded px-3 py-2 text-fluid-sm mb-4"
              placeholder="비밀번호"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-fluid-sm border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletePassword('');
                }}
                disabled={deleteSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-fluid-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleConfirmDelete()}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? '처리 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <p className="text-fluid-xs text-gray-600">{label}</p>
      <p className="text-fluid-lg font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-fluid-2xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
