import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminEContractSubmissionDetailModal } from '../../components/e-contract/AdminEContractSubmissionDetailModal';
import { SyncHorizontalScroll } from '../../components/ui/SyncHorizontalScroll';
import { getToken } from '../../stores/auth';
import {
  listAllEContractSubmissions,
  pickerTeamLeaders,
  type EContractSubmissionRow,
  type TeamLeaderPicker,
} from '../../api/adminEContract';

function signedDaysAgo(signedIso: string): string {
  const ms = Date.now() - new Date(signedIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  if (d >= 1) return `${d}일 전`;
  if (h >= 1) return `${h}시간 전`;
  return '방금';
}

export function AdminEContractTeamOverviewPage() {
  const token = getToken();
  const [pickers, setPickers] = useState<TeamLeaderPicker[]>([]);
  const [filterLeaderId, setFilterLeaderId] = useState('');
  const [allSubs, setAllSubs] = useState<EContractSubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submissionModalId, setSubmissionModalId] = useState<string | null>(null);

  const loadPickers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await pickerTeamLeaders(token);
      setPickers(data.teamLeaders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '팀장 목록을 불러오지 못했습니다.');
    }
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await listAllEContractSubmissions(token, 300);
      setAllSubs(data.submissions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '체결 목록을 불러오지 못했습니다.');
      setAllSubs([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPickers();
  }, [loadPickers]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows = useMemo(() => {
    if (!filterLeaderId) return allSubs;
    return allSubs.filter((s) => s.teamLeaderId === filterLeaderId);
  }, [allSubs, filterLeaderId]);

  return (
    <div className="min-w-0 w-full max-w-full px-4 sm:px-0">
      <h1 className="text-fluid-xl font-semibold text-gray-900">체결 기록</h1>
      <p className="mt-1 text-fluid-sm text-gray-600">
        <span className="font-medium text-gray-800">상세보기</span>에서{' '}
        <span className="font-medium text-gray-800">업체(갑)·팀장(을) 서명이 반영된 최종 HTML</span>을 볼 수 있고, HTML 다운로드·인쇄(PDF
        저장)로 보관할 수 있습니다. 팀장 본인은 체결 완료 후 같은 링크에서도 동일 문서를 볼 수 있습니다.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] max-w-md flex-1">
          <label className="block text-fluid-xs font-medium text-gray-700">팀장 필터(선택)</label>
          <select
            value={filterLeaderId}
            onChange={(e) => setFilterLeaderId(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
          >
            <option value="">전체</option>
            {pickers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={loading || !token}
          onClick={() => void loadAll()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          새로고침
        </button>
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div>
      ) : null}

      {loading ? (
        <div className="mt-10 text-center text-fluid-sm text-gray-500">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="mt-10 text-center text-fluid-sm text-gray-500">표시할 체결 기록이 없습니다.</div>
      ) : (
        <div className="mt-8">
          <p className="mb-2 text-fluid-2xs text-gray-500 lg:hidden">표는 좌우로 스크롤하여 전체 열을 볼 수 있습니다.</p>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <SyncHorizontalScroll
              className="min-w-0"
              contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0"
            >
              <table className="w-full min-w-[920px] table-fixed border-collapse border-0 text-fluid-sm">
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100">
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">팀장</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">이메일</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">계약 종류</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">버전</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">체결 시각</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">경과</th>
                    <th className="px-2 py-2 text-center text-fluid-xs font-medium text-gray-800">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="group border-b border-gray-100 hover:bg-gray-50">
                      <td className="truncate px-2 py-2 text-center text-fluid-xs" title={s.teamLeaderName}>
                        {s.teamLeaderName}
                      </td>
                      <td className="truncate px-2 py-2 text-center text-fluid-2xs" title={s.teamLeaderEmail}>
                        {s.teamLeaderEmail}
                      </td>
                      <td className="truncate px-2 py-2 text-center text-fluid-xs" title={s.definitionTitle}>
                        {s.definitionTitle}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-fluid-xs">
                        {s.versionOrdinal != null ? `v${s.versionOrdinal}` : '—'}
                      </td>
                      <td className="truncate px-2 py-2 text-center text-fluid-2xs tabular-nums">
                        {new Date(s.signedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-2 py-2 text-center text-fluid-xs">{signedDaysAgo(s.signedAt)}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-fluid-xs font-medium text-blue-900 hover:bg-blue-100"
                          onClick={() => setSubmissionModalId(s.id)}
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SyncHorizontalScroll>
          </div>
          <p className="mt-3 text-center text-fluid-2xs text-gray-500">
            최대 300건까지 최신순으로 표시됩니다. 팀장 필터로 목록을 좁힐 수 있습니다.
          </p>
        </div>
      )}

      <AdminEContractSubmissionDetailModal
        token={token}
        submissionId={submissionModalId}
        open={Boolean(submissionModalId)}
        onClose={() => setSubmissionModalId(null)}
      />
    </div>
  );
}
