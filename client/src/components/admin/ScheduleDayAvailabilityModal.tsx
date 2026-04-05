import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from './ModalCloseButton';
import {
  getDayAvailability,
  putDayAvailability,
  type DayAvailabilityLeaderRow,
  type DayAvailabilityMemberRow,
} from '../../api/schedule';

type Props = {
  open: boolean;
  date: string | null;
  token: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ScheduleDayAvailabilityModal({ open, date, token, onClose, onSaved }: Props) {
  const [leaders, setLeaders] = useState<DayAvailabilityLeaderRow[]>([]);
  const [members, setMembers] = useState<DayAvailabilityMemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ kind: 'leader' | 'member'; id: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const load = useCallback(async () => {
    if (!token || !date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDayAvailability(token, date);
      setLeaders(res.teamLeaders);
      setMembers(res.teamMembers);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
      setLeaders([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    if (open && date) void load();
  }, [open, date, load]);

  const morningCount = leaders.filter((l) => l.morningAvailable).length;
  const afternoonCount = leaders.filter((l) => l.afternoonAvailable).length;
  const crewCount = members.filter((m) => m.available).length;

  const openNoteEditor = (kind: 'leader' | 'member', id: string) => {
    setNoteTarget({ kind, id });
    if (kind === 'leader') {
      setNoteDraft(leaders.find((l) => l.id === id)?.note ?? '');
    } else {
      setNoteDraft(members.find((m) => m.id === id)?.note ?? '');
    }
  };

  const saveNote = () => {
    if (!noteTarget) return;
    const trimmed = noteDraft.trim();
    const note = trimmed.length > 0 ? trimmed : null;
    if (noteTarget.kind === 'leader') {
      setLeaders((prev) =>
        prev.map((l) => (l.id === noteTarget.id ? { ...l, note } : l))
      );
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === noteTarget.id ? { ...m, note } : m))
      );
    }
    setNoteTarget(null);
  };

  const handleSave = async () => {
    if (!token || !date) return;
    setSaving(true);
    setError(null);
    try {
      await putDayAvailability(token, {
        date,
        leaders: leaders.map((l) => ({
          teamLeaderId: l.id,
          morningAvailable: l.morningAvailable,
          afternoonAvailable: l.afternoonAvailable,
          note: l.note,
        })),
        members: members.map((m) => ({
          teamMemberId: m.id,
          available: m.available,
          note: m.note,
        })),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!token || !date) return;
    if (!window.confirm('이 날짜의 수동 가용 설정을 모두 지우고, 휴무일 등 시스템 기본으로 되돌릴까요?')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await putDayAvailability(token, { date, leaders: [], members: [] });
      onSaved();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '초기화 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !date) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
      role="dialog"
      aria-modal
      aria-labelledby="avail-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-black/40 pointer-events-auto"
        aria-label="닫기"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-3xl max-h-[min(92vh,900px)] bg-white rounded-t-xl sm:rounded-xl shadow-xl flex flex-col border border-gray-200 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="avail-modal-title" className="text-lg font-semibold text-gray-900">
              가용 인원 설정
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{date}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-700">
              <span className="px-2 py-1 rounded border border-amber-200 bg-amber-50">
                오전 팀장 {morningCount}명
              </span>
              <span className="px-2 py-1 rounded border border-sky-200 bg-sky-50">
                오후 팀장 {afternoonCount}명
              </span>
              <span className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50">
                가용 팀원 {crewCount}명
              </span>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {error && (
          <div className="mx-4 mt-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">불러오는 중…</p>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">팀장 (오전·오후)</h3>
                <p className="text-xs text-gray-500 mb-2">
                  휴무일 등록과 별도로, 해당일만 오전만·오후만 근무 가능 여부를 조정할 수 있습니다. 이름을 눌러 사유를
                  적을 수 있습니다.
                </p>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs">
                      <tr>
                        <th className="text-left py-2 px-2">이름</th>
                        <th className="text-center py-2 px-1 w-16">오전</th>
                        <th className="text-center py-2 px-1 w-16">오후</th>
                        <th className="text-left py-2 px-2">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaders.map((l) => (
                        <tr key={l.id} className="border-t border-gray-100">
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => openNoteEditor('leader', l.id)}
                              className="text-left text-gray-900 hover:underline"
                            >
                              {l.name}
                            </button>
                            {l.hasUserDayOff && (
                              <span className="ml-1 text-[10px] text-amber-800 bg-amber-50 px-1 rounded">휴무등록</span>
                            )}
                          </td>
                          <td className="text-center py-2 px-1">
                            <input
                              type="checkbox"
                              checked={l.morningAvailable}
                              onChange={(ev) =>
                                setLeaders((prev) =>
                                  prev.map((x) =>
                                    x.id === l.id ? { ...x, morningAvailable: ev.target.checked } : x
                                  )
                                )
                              }
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="text-center py-2 px-1">
                            <input
                              type="checkbox"
                              checked={l.afternoonAvailable}
                              onChange={(ev) =>
                                setLeaders((prev) =>
                                  prev.map((x) =>
                                    x.id === l.id ? { ...x, afternoonAvailable: ev.target.checked } : x
                                  )
                                )
                              }
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-500 truncate max-w-[10rem]">
                            {l.note ? l.note : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">팀원</h3>
                <p className="text-xs text-gray-500 mb-2">
                  해당일 현장 투입 가능 여부입니다. 휴무 등록과 별도로 조정할 수 있습니다.
                </p>
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-2">이름</th>
                        <th className="text-center py-2 px-1 w-20">가용</th>
                        <th className="text-left py-2 px-2">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-t border-gray-100">
                          <td className="py-1.5 px-2">
                            <button
                              type="button"
                              onClick={() => openNoteEditor('member', m.id)}
                              className="text-left text-gray-900 hover:underline"
                            >
                              {m.name}
                            </button>
                            {m.hasTeamMemberDayOff && (
                              <span className="ml-1 text-[10px] text-amber-800 bg-amber-50 px-1 rounded">휴무등록</span>
                            )}
                          </td>
                          <td className="text-center py-1.5 px-1">
                            <input
                              type="checkbox"
                              checked={m.available}
                              onChange={(ev) =>
                                setMembers((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id ? { ...x, available: ev.target.checked } : x
                                  )
                                )
                              }
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-xs text-gray-500 truncate max-w-[12rem]">
                            {m.note ? m.note : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>

        {noteTarget && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
            <label className="block text-xs font-medium text-gray-600 mb-1">사유 / 메모</label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5"
              placeholder="간단히 입력 (선택)"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={saveNote}
                className="text-xs px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-900"
              >
                메모 반영
              </button>
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="text-xs px-3 py-1.5 rounded border border-gray-200 bg-white text-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleReset();
            }}
            disabled={saving || loading}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            수동 설정 전체 초기화
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-sm px-4 py-2 rounded border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleSave();
              }}
              disabled={saving || loading}
              className="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
