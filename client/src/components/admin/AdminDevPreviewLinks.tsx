import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { crewDevPreviewLogin } from '../../api/crew';
import { clearToken } from '../../stores/auth';
import { setCrewToken } from '../../stores/crewAuth';
import { setTeamToken, clearTeamToken } from '../../stores/teamAuth';
import { DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY } from '../../constants/devPreviewAuth';
import { getUsers, formatAssignableUserLabel, type UserItem } from '../../api/users';
import { getTeamCrewGroups, type TeamCrewGroupItem } from '../../api/teamCrewGroups';

function kstTodayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

type Panel = 'tl' | 'ext' | 'crew' | null;

const btn =
  'rounded px-1.5 py-0.5 font-medium text-[clamp(0.6rem,1.4vw,0.75rem)] transition-colors hover:bg-gray-200/80';

const listBtn =
  'w-full min-h-[44px] touch-manipulation rounded border border-transparent px-2 py-2 text-left text-fluid-xs hover:border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-50';

export function AdminDevPreviewLinks({ adminToken }: { adminToken: string | null }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [loading, setLoading] = useState(false);
  const [teamLeaders, setTeamLeaders] = useState<UserItem[]>([]);
  const [externals, setExternals] = useState<UserItem[]>([]);
  const [crews, setCrews] = useState<TeamCrewGroupItem[]>([]);
  const [err, setErr] = useState('');
  const [crewNavBusy, setCrewNavBusy] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const panelFetchSeqRef = useRef(0);

  const closePanel = () => {
    panelFetchSeqRef.current += 1;
    setPanel(null);
    setLoading(false);
    setErr('');
  };

  const openPanel = async (p: Exclude<Panel, null>) => {
    if (!adminToken) return;
    const seq = ++panelFetchSeqRef.current;
    setPanel(p);
    setErr('');
    setTeamLeaders([]);
    setExternals([]);
    setCrews([]);
    setLoading(true);
    try {
      if (p === 'tl') {
        const items = await getUsers(adminToken, 'TEAM_LEADER', { employedOn: kstTodayYmd() });
        if (seq !== panelFetchSeqRef.current) return;
        setTeamLeaders(items);
      } else if (p === 'ext') {
        const items = await getUsers(adminToken, 'EXTERNAL_PARTNER', { employedOn: kstTodayYmd() });
        if (seq !== panelFetchSeqRef.current) return;
        setExternals(items);
      } else {
        const r = await getTeamCrewGroups(adminToken);
        if (seq !== panelFetchSeqRef.current) return;
        setCrews(r.items.filter((g) => g.isActive));
      }
    } catch (e) {
      if (seq !== panelFetchSeqRef.current) return;
      setErr(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      if (seq === panelFetchSeqRef.current) setLoading(false);
    }
  };

  const goTeamLeader = (id: string) => {
    if (!adminToken || navBusy) return;
    setNavBusy(true);
    setTeamToken(adminToken);
    navigate(
      `/team/dashboard?previewRole=team_leader&previewTeamLeaderId=${encodeURIComponent(id)}`,
      { replace: true },
    );
    closePanel();
    setNavBusy(false);
  };

  const goExternal = (u: UserItem) => {
    if (!adminToken || navBusy) return;
    setNavBusy(true);
    setTeamToken(adminToken);
    const q = new URLSearchParams({ previewRole: 'external', previewExternalUserId: u.id });
    if (u.externalCompanyId) q.set('externalCompanyId', u.externalCompanyId);
    const name = u.externalCompanyName?.trim() || u.name;
    q.set('previewExternalName', name);
    navigate(`/team/dashboard?${q.toString()}`, { replace: true });
    closePanel();
    setNavBusy(false);
  };

  const goCrew = async (loginId: string) => {
    if (!adminToken || crewNavBusy) return;
    setErr('');
    setCrewNavBusy(true);
    try {
      const data = await crewDevPreviewLogin(adminToken, loginId);
      try {
        sessionStorage.setItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY, adminToken);
      } catch {
        /* ignore */
      }
      clearToken();
      clearTeamToken();
      setCrewToken(data.token);
      navigate('/crew', {
        replace: true,
        state: {
          from: { pathname: '/crew', search: '', hash: '', state: null },
        },
      });
      closePanel();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '크루 화면으로 이동하지 못했습니다.');
    } finally {
      setCrewNavBusy(false);
    }
  };

  if (!adminToken) return null;

  return (
    <>
      <div
        className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded border border-gray-200 bg-gray-50/90 px-0.5 py-0.5 text-gray-700 admin-preview-links"
        title="관리자용: 대상 선택 후 팀장·타업체·크루 화면으로 이동"
      >
        <span className="shrink-0 pl-0.5 text-[9px] font-medium uppercase tracking-tight text-gray-400">
          미리보기
        </span>
        <button type="button" className={`${btn} text-blue-700`} onClick={() => void openPanel('tl')}>
          팀장
        </button>
        <button
          type="button"
          className={`${btn} text-indigo-700`}
          onClick={() => void openPanel('ext')}
        >
          타업체
        </button>
        <button type="button" className={`${btn} text-emerald-800`} onClick={() => void openPanel('crew')}>
          크루
        </button>
      </div>
      {panel
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-end justify-center bg-black/35 p-2 sm:items-center"
              role="dialog"
              aria-modal="true"
              onClick={closePanel}
            >
              <div
                className="flex max-h-[min(70vh,420px)] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-xl overscroll-contain"
                data-admin-dev-preview-modal
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className="text-fluid-xs font-semibold text-gray-800">
                {panel === 'tl' ? '팀장 화면' : panel === 'ext' ? '타업체 화면' : '크루 화면'}
              </span>
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
                onClick={closePanel}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
              {err ? (
                <p className="text-fluid-xs text-red-600">{err}</p>
              ) : loading ? (
                <p className="text-fluid-xs text-gray-500">불러오는 중…</p>
              ) : crewNavBusy ? (
                <p className="text-fluid-xs text-gray-500">크루 화면으로 이동 중…</p>
              ) : panel === 'tl' ? (
                <ul className="space-y-0.5">
                  {teamLeaders.length === 0 ? (
                    <li className="text-fluid-xs text-gray-500">표시할 팀장이 없습니다.</li>
                  ) : (
                    teamLeaders.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={navBusy}
                          className={`${listBtn} text-gray-900`}
                          onClick={() => goTeamLeader(u.id)}
                        >
                          {u.name}
                          <span className="ml-1 text-[10px] text-gray-400">{u.email}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : panel === 'ext' ? (
                <ul className="space-y-0.5">
                  {externals.length === 0 ? (
                    <li className="text-fluid-xs text-gray-500">표시할 타업체 계정이 없습니다.</li>
                  ) : (
                    externals.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          disabled={navBusy}
                          className={`${listBtn} text-gray-900`}
                          onClick={() => goExternal(u)}
                        >
                          {formatAssignableUserLabel(u)}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : (
                <ul className="space-y-0.5">
                  {crews.length === 0 ? (
                    <li className="text-fluid-xs text-gray-500">활성 크루 그룹이 없습니다.</li>
                  ) : (
                    crews.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          disabled={crewNavBusy}
                          className={`${listBtn} text-gray-900`}
                          onClick={() => void goCrew(g.loginId)}
                        >
                          <span className="font-medium">{g.name}</span>
                          <span className="ml-1 text-[10px] text-gray-500">{g.loginId}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
