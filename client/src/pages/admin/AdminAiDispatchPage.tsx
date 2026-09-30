import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aiDispatchSlotLabel } from '@shared/aiDispatch';
import {
  approveAiDispatch,
  getAiDispatchBoard,
  patchAiDispatchProposal,
  runAiDispatch,
  saveAiDispatchSettings,
  type AiDispatchBoard,
} from '../../api/aiDispatch';
import { AiDispatchLeaderStrip, AiDispatchProposalCard } from '../../components/admin/ai-dispatch/AiDispatchBoard';
import { getToken } from '../../stores/auth';

function todayYmd(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function AdminAiDispatchPage() {
  const token = getToken();
  const [params, setParams] = useSearchParams();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? (params.get('date') as string) : todayYmd();
  const [board, setBoard] = useState<AiDispatchBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [minPyeong, setMinPyeong] = useState('40');
  const [leaderCount, setLeaderCount] = useState('2');
  const [twoRoom, setTwoRoom] = useState('15');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getAiDispatchBoard(token, date);
      setBoard(next);
      setMinPyeong(String(next.settings.extraLeaderMinPyeong));
      setLeaderCount(String(next.settings.extraLeaderCount));
      setTwoRoom(String(next.settings.twoRoomMaxPyeong));
      setPicked([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const jobById = useMemo(() => new Map((board?.jobs ?? []).map((job) => [job.id, job])), [board]);

  const run = async () => {
    if (!token) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runAiDispatch(token, date);
      if (!result.aiConfigured) setNotice('AI 미설정. 배정 초안을 만들지 않았습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '실행에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  const changeLeader = async (id: string, teamLeaderId: string | null) => {
    if (!token) return;
    setError(null);
    try {
      await patchAiDispatchProposal(token, id, { teamLeaderId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    }
  };

  const approve = async () => {
    if (!token || picked.length === 0) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await approveAiDispatch(token, picked);
      const fail = result.failed.map((row) => row.error).join(' ');
      setNotice(
        `반영 ${result.approvedInquiryIds.length}건${fail ? `. 보류: ${fail}` : ''}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  const saveSettings = async () => {
    if (!token) return;
    setError(null);
    try {
      await saveAiDispatchSettings(token, {
        extraLeaderMinPyeong: Number(minPyeong),
        extraLeaderCount: Number(leaderCount),
        twoRoomMaxPyeong: Number(twoRoom),
      });
      setNotice('규칙을 저장했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '규칙 저장에 실패했습니다.');
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-fluid-lg font-semibold text-slate-900">AI 미리 배정</h1>
          <p className="text-fluid-2xs text-slate-500">날짜를 고르고 실행한 뒤, 확인한 건만 실제 배정됩니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-fluid-xs text-slate-600">
            날짜
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set('date', e.target.value);
                setParams(next, { replace: true });
              }}
              className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-fluid-xs"
            />
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void run()}
            className="min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {running ? '실행 중…' : 'AI 미리 배정'}
          </button>
        </div>
      </div>

      {board && !board.aiConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-xs text-amber-900">
          AI 미설정. 키를 연결하기 전에는 점수로 대신 배정하지 않습니다.
        </p>
      ) : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-xs text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-xs text-slate-700">{notice}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
        <h2 className="mb-2 text-fluid-xs font-semibold text-slate-800">팀장 컨디션</h2>
        {loading && !board ? <p className="text-fluid-xs text-slate-500">불러오는 중…</p> : <AiDispatchLeaderStrip leaders={board?.leaders ?? []} />}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-fluid-xs font-semibold text-slate-800">
            제안 {board?.run ? `· ${board.run.summary ?? ''}` : '· 아직 실행하지 않았습니다'}
          </h2>
          <button
            type="button"
            disabled={running || picked.length === 0}
            onClick={() => void approve()}
            className="min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            선택 승인
          </button>
        </div>
        <div className="space-y-1.5">
          {(board?.run?.proposals ?? []).map((proposal) => (
            <AiDispatchProposalCard
              key={proposal.id}
              proposal={proposal}
              job={jobById.get(proposal.inquiryId)}
              leaders={board?.leaders ?? []}
              checked={picked.includes(proposal.id)}
              onToggle={(id) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
              onLeaderChange={(id, teamLeaderId) => void changeLeader(id, teamLeaderId)}
            />
          ))}
          {!loading && (board?.run?.proposals.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-fluid-xs text-slate-500">
              {board?.jobs.length
                ? `미배정 ${board.jobs.length}건. AI 미리 배정을 누르면 초안이 생깁니다.`
                : '이 날짜에 배정 전인 예약완료 건이 없습니다.'}
            </p>
          ) : null}
        </div>
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3">
        <summary className="cursor-pointer text-fluid-xs font-semibold text-slate-800">배정 규칙</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-fluid-2xs text-slate-600">
            이 평수 이상
            <input value={minPyeong} onChange={(e) => setMinPyeong(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-fluid-xs" />
          </label>
          <label className="text-fluid-2xs text-slate-600">
            팀장 수
            <input value={leaderCount} onChange={(e) => setLeaderCount(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-fluid-xs" />
          </label>
          <label className="text-fluid-2xs text-slate-600">
            투룸으로 볼 평수 상한
            <input value={twoRoom} onChange={(e) => setTwoRoom(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-fluid-xs" />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void saveSettings()}
          className="mt-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          규칙 저장
        </button>
        <p className="mt-2 text-fluid-2xs text-slate-500">
          시간대 예: {aiDispatchSlotLabel('AM')}, {aiDispatchSlotLabel('PM')}, {aiDispatchSlotLabel('ALL_DAY')}. 사이청소·조율은 사람 판단입니다.
        </p>
      </details>
    </div>
  );
}
