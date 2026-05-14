import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  listSubmissionsForTeamLeader,
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
  const [userId, setUserId] = useState('');
  const [subs, setSubs] = useState<EContractSubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadPickers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await pickerTeamLeaders(token);
      setPickers(data.teamLeaders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '팀장 목록을 불러오지 못했습니다.');
    }
  }, [token]);

  useEffect(() => {
    void loadPickers();
  }, [loadPickers]);

  const loadSubs = async (id: string) => {
    if (!token || !id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await listSubmissionsForTeamLeader(token, id);
      setSubs(data.submissions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '내역을 불러오지 못했습니다.');
      setSubs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full px-4 sm:px-0">
      <h1 className="text-fluid-xl font-semibold text-gray-900">팀장별 체결 기록</h1>
      <p className="mt-1 text-fluid-sm text-gray-600">
        어떤 계약 종류를 <span className="font-medium text-gray-800">어떤 공개 버전(vN)</span>으로 언제 체결했는지 확인합니다.
      </p>

      <div className="mt-6 max-w-md">
        <label className="block text-fluid-xs font-medium text-gray-700">팀장 선택</label>
        <select
          value={userId}
          onChange={(e) => {
            const id = e.target.value;
            setUserId(id);
            if (id) void loadSubs(id);
            else setSubs([]);
          }}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-fluid-sm"
        >
          <option value="">선택</option>
          {pickers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800">{err}</div>
      ) : null}

      {!userId ? (
        <div className="mt-8 text-fluid-sm text-gray-500">팀장을 선택하면 체결 이력이 표시됩니다.</div>
      ) : loading ? (
        <div className="mt-8 text-center text-fluid-sm text-gray-500">불러오는 중…</div>
      ) : subs.length === 0 ? (
        <div className="mt-8 text-fluid-sm text-gray-500">체결 기록이 없습니다.</div>
      ) : (
        <>
          <div className="mt-8 hidden lg:block overflow-x-auto">
            <table className="w-full table-fixed border border-gray-200 bg-white text-fluid-sm">
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '30%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs">계약 종류</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs">버전</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs">체결 시각</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs">경과</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center text-fluid-xs">문안 해시(일부)</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="truncate px-2 py-2 text-center" title={s.definitionTitle}>
                      {s.definitionTitle}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{s.versionOrdinal != null ? `v${s.versionOrdinal}` : '—'}</td>
                    <td className="px-2 py-2 text-center">{new Date(s.signedAt).toLocaleString('ko-KR')}</td>
                    <td className="px-2 py-2 text-center">{signedDaysAgo(s.signedAt)}</td>
                    <td
                      className="truncate px-2 py-2 text-center font-mono text-fluid-2xs"
                      title={s.versionContentHash ?? ''}
                    >
                      {(() => {
                        const h = s.versionContentHash;
                        if (!h) return '—';
                        return h.length <= 16 ? h : `${h.slice(0, 16)}…`;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 space-y-3 lg:hidden">
            {subs.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="font-semibold text-gray-900">{s.definitionTitle}</div>
                <div className="mt-1 text-fluid-xs text-gray-600">
                  버전 {s.versionOrdinal != null ? `v${s.versionOrdinal}` : '—'}
                </div>
                <div className="mt-2 text-fluid-sm">
                  체결: {new Date(s.signedAt).toLocaleString('ko-KR')}{' '}
                  <span className="text-gray-500">({signedDaysAgo(s.signedAt)})</span>
                </div>
                {s.versionContentHash ? (
                  <div className="mt-1 break-all font-mono text-fluid-2xs text-gray-500">{s.versionContentHash}</div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
