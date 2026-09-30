import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approveAiDispatch,
  getAiDispatchBoard,
  patchAiDispatchProposal,
  runAiDispatch,
  saveAiDispatchSettings,
  type AiDispatchBoard,
} from '../../api/aiDispatch';
import { AiDispatchScreen } from '../../components/admin/ai-dispatch/AiDispatchScreen';
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
  const [includeCrew, setIncludeCrew] = useState(false);
  const [normalDays, setNormalDays] = useState('6');
  const [normalJobs, setNormalJobs] = useState('12');
  const [reportOpen, setReportOpen] = useState(false);

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
      setIncludeCrew(next.settings.includeCrewInFatigue === true);
      setNormalDays(String(next.settings.normalWorkDaysPerWeek ?? 6));
      setNormalJobs(String(next.settings.normalJobsPerWeek ?? 12));
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

  const run = async () => {
    if (!token) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runAiDispatch(token, date);
      if (!result.aiConfigured) setNotice('AI 미설정. 배정 초안을 만들지 않았습니다.');
      else setReportOpen(true);
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
        includeCrewInFatigue: includeCrew,
        normalWorkDaysPerWeek: Number(normalDays),
        normalJobsPerWeek: Number(normalJobs),
      });
      setNotice('규칙을 저장했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '규칙 저장에 실패했습니다.');
    }
  };

  return (
    <AiDispatchScreen
      date={date}
      onDateChange={(nextDate) => {
        const next = new URLSearchParams(params);
        next.set('date', nextDate);
        setParams(next, { replace: true });
      }}
      board={board}
      loading={loading}
      running={running}
      error={error}
      notice={notice}
      picked={picked}
      minPyeong={minPyeong}
      leaderCount={leaderCount}
      twoRoom={twoRoom}
      includeCrew={includeCrew}
      normalDays={normalDays}
      normalJobs={normalJobs}
      onMinPyeong={setMinPyeong}
      onLeaderCount={setLeaderCount}
      onTwoRoom={setTwoRoom}
      onIncludeCrew={setIncludeCrew}
      onNormalDays={setNormalDays}
      onNormalJobs={setNormalJobs}
      onRun={() => void run()}
      onApprove={() => void approve()}
      onToggle={(id) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
      onLeaderChange={(id, teamLeaderId) => void changeLeader(id, teamLeaderId)}
      onSaveSettings={() => void saveSettings()}
      reportOpen={reportOpen}
      onOpenReport={() => setReportOpen(true)}
      onCloseReport={() => setReportOpen(false)}
    />
  );
}
