import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  approveAiDispatch,
  getAiDispatchBoard,
  getAiDispatchProgress,
  patchAiDispatchProposal,
  runAiDispatch,
  saveAiDispatchLeader,
  saveAiDispatchSettings,
  type AiDispatchBoard,
} from '../../api/aiDispatch';
import type { TeamLeaderDispatchFormValue } from '../../components/admin/TeamLeaderDispatchFields';
import { AiDispatchScreen } from '../../components/admin/ai-dispatch/AiDispatchScreen';
import { useCrmInquiryEdit } from '../../hooks/useCrmInquiryEdit';
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
  const [drafting, setDrafting] = useState(false);
  const [progressStep, setProgressStep] = useState(1);
  const [progressMessage, setProgressMessage] = useState('날짜의 일정을 모으고 있습니다.');
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [leaderSaving, setLeaderSaving] = useState(false);
  const [leaderSaveError, setLeaderSaveError] = useState<string | null>(null);
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

  const inquiryEdit = useCrmInquiryEdit(true, () => void load());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!drafting || !token) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setProgressSeconds(Math.floor((Date.now() - started) / 1000));
      void getAiDispatchProgress(token, date)
        .then((row) => {
          setProgressStep(row.step);
          setProgressMessage(row.message);
        })
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [drafting, token, date]);

  const run = async () => {
    if (!token) return;
    setRunning(true);
    setDrafting(true);
    setProgressStep(1);
    setProgressMessage('날짜의 일정을 모으고 있습니다.');
    setProgressSeconds(0);
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
      setDrafting(false);
    }
  };

  const saveLeader = async (leaderId: string, value: TeamLeaderDispatchFormValue) => {
    if (!token) return;
    setLeaderSaving(true);
    setLeaderSaveError(null);
    try {
      await saveAiDispatchLeader(token, leaderId, {
        homeAddress: value.homeAddress,
        homeAddressDetail: value.homeAddressDetail,
        jobsPerDay: value.jobsPerDay === '1' ? 1 : 2,
        sizePolicy: value.sizePolicy,
      });
      setNotice('팀장 설정을 저장했습니다.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.';
      setLeaderSaveError(message);
      throw e;
    } finally {
      setLeaderSaving(false);
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

  const selectableIds = (board?.run?.proposals ?? []).filter((row) => row.status === 'DRAFT' && row.teamLeaderId).map((row) => row.id);

  return (
    <>
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
      drafting={drafting}
      progressStep={progressStep}
      progressMessage={progressMessage}
      progressSeconds={progressSeconds}
      leaderSaving={leaderSaving}
      leaderSaveError={leaderSaveError}
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
      onSelectAll={() =>
        setPicked((prev) => (selectableIds.length > 0 && selectableIds.every((id) => prev.includes(id)) ? [] : selectableIds))
      }
      onOpenInquiry={inquiryEdit.openInquiryEdit}
      onLeaderChange={(id, teamLeaderId) => void changeLeader(id, teamLeaderId)}
      onSaveSettings={() => void saveSettings()}
      onSaveLeader={saveLeader}
      reportOpen={reportOpen}
      onOpenReport={() => setReportOpen(true)}
      onCloseReport={() => setReportOpen(false)}
    />
    {inquiryEdit.layer}
    </>
  );
}
