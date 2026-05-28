import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMe } from '../../api/auth';
import {
  getAdvertisingSettlementConfig,
  patchAdChannelSettlementMode,
  createAdChannelLineItem,
  updateAdChannelLineItem,
  deleteAdChannelLineItem,
  createAdChannel,
  updateAdChannel,
  reorderAdChannels,
  deleteAdChannel,
  type AdChannel,
  type AdChannelLineItem,
  type AdChannelSettlementMode,
} from '../../api/advertising';
import { getToken } from '../../stores/auth';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function sortItems(items: AdChannelLineItem[]): AdChannelLineItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** 관리자 전용: 채널별 정산 방식·과목(건당 금액) 설정 */
export function AdminAdvertisingSettingsPage() {
  const token = getToken();
  const [items, setItems] = useState<AdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    label: string;
    unitAmountWon: string;
    countsForSpend: boolean;
    sortOrder: string;
  } | null>(null);

  const [addDraft, setAddDraft] = useState<
    Record<string, { label: string; unitAmountWon: string; countsForSpend: boolean }>
  >({});

  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdChannel | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await getAdvertisingSettlementConfig(token);
      setItems(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void getMe(token).then((me) => {
      setIsTenantOwner(Boolean(me.isTenantOwner ?? me.isSuperAdmin));
    });
  }, [token]);

  const sortedChannels = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [items]
  );

  const setMode = async (channelId: string, settlementMode: AdChannelSettlementMode) => {
    if (!token) return;
    setBusyChannelId(channelId);
    setErr(null);
    try {
      const updated = await patchAdChannelSettlementMode(token, channelId, settlementMode);
      setItems((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, ...updated, lineItems: updated.lineItems ?? c.lineItems } : c))
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : '변경 실패');
    } finally {
      setBusyChannelId(null);
    }
  };

  const startEdit = (li: AdChannelLineItem) => {
    setEditingId(li.id);
    setEditDraft({
      label: li.label,
      unitAmountWon: String(li.unitAmountWon),
      countsForSpend: li.countsForSpend,
      sortOrder: String(li.sortOrder),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!token || !editingId || !editDraft) return;
    const label = editDraft.label.trim();
    const unit = Math.round(Number(String(editDraft.unitAmountWon).replace(/,/g, '')));
    const sortOrder = Math.round(Number(editDraft.sortOrder));
    if (!label) {
      setErr('과목 이름을 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(unit) || unit < 0) {
      setErr('건당 금액은 0 이상 숫자입니다.');
      return;
    }
    setErr(null);
    try {
      await updateAdChannelLineItem(token, editingId, {
        label,
        unitAmountWon: unit,
        countsForSpend: editDraft.countsForSpend,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      });
      cancelEdit();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    }
  };

  const removeLine = async (lineItemId: string) => {
    if (!token) return;
    if (!window.confirm('이 과목을 삭제할까요?')) return;
    setErr(null);
    try {
      await deleteAdChannelLineItem(token, lineItemId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const addLine = async (channelId: string) => {
    if (!token) return;
    const d = addDraft[channelId] ?? {
      label: '',
      unitAmountWon: '',
      countsForSpend: true,
    };
    const label = d.label.trim();
    const unit = Math.round(Number(String(d.unitAmountWon).replace(/,/g, '')));
    if (!label) {
      setErr('과목 이름을 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(unit) || unit < 0) {
      setErr('건당 금액은 0 이상 숫자입니다.');
      return;
    }
    setBusyChannelId(channelId);
    setErr(null);
    try {
      await createAdChannelLineItem(token, channelId, {
        label,
        unitAmountWon: unit,
        countsForSpend: d.countsForSpend,
      });
      setAddDraft((prev) => ({
        ...prev,
        [channelId]: { label: '', unitAmountWon: '', countsForSpend: true },
      }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusyChannelId(null);
    }
  };

  const setChannelActive = async (channelId: string, isActive: boolean) => {
    if (!token) return;
    setTogglingActiveId(channelId);
    setErr(null);
    try {
      await updateAdChannel(token, channelId, { isActive });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '사용 여부 변경 실패');
    } finally {
      setTogglingActiveId(null);
    }
  };

  const handleAddChannel = async () => {
    if (!token || !newChannelName.trim()) return;
    setAddingChannel(true);
    setErr(null);
    try {
      await createAdChannel(token, newChannelName.trim());
      setNewChannelName('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '채널 추가 실패');
    } finally {
      setAddingChannel(false);
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
    setBusyChannelId(id);
    setErr(null);
    try {
      await reorderAdChannels(
        token,
        next.map((c) => c.id),
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '순서 변경 실패');
    } finally {
      setBusyChannelId(null);
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

  if (!token) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-fluid-xl font-semibold text-gray-800">광고비 정산 설정</h1>
        <p className="mt-1 text-fluid-sm text-gray-600">
          아래에서 <strong className="font-medium text-gray-800">채널을 새로 추가할지</strong> 정하고, 채널마다{' '}
          <strong className="font-medium text-gray-800">사용함·사용 안 함</strong>·표시 순서·정산 방식을 설정합니다. 사용
          안 함이면 정산 입력·활성 목록에서 제외됩니다.
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-fluid-sm text-red-700">{err}</div>
      )}

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
            <h2 className="text-fluid-base font-medium text-gray-900 mb-2">광고 채널</h2>
            <p className="text-fluid-sm text-gray-600 mb-4">
              필요한 채널만 추가합니다. 당장 안 쓰는 채널은 삭제하지 않고 「사용 안 함」으로 두어도 됩니다.
            </p>
            <details className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80">
              <summary className="cursor-pointer px-4 py-3 text-fluid-sm font-medium text-gray-900 select-none marker:text-gray-500">
                새 광고 채널 추가 (선택 — 필요할 때만 펼치세요)
              </summary>
              <div className="flex flex-wrap items-end gap-2 border-t border-gray-200 px-4 py-4">
                <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-fluid-xs text-gray-600">
                  채널 이름
                  <input
                    type="text"
                    className="rounded border border-gray-300 px-3 py-2 text-fluid-sm"
                    placeholder="예: 네이버 검색광고"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={addingChannel || !newChannelName.trim()}
                  className="rounded bg-blue-600 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => void handleAddChannel()}
                >
                  {addingChannel ? '추가 중…' : '채널 추가'}
                </button>
              </div>
            </details>
            {sortedChannels.length === 0 ? (
              <p className="mt-4 text-fluid-sm text-gray-500">아직 등록된 채널이 없습니다. 필요하면 위에서 채널을 추가하세요.</p>
            ) : null}
          </section>

          {sortedChannels.map((ch, idx) => {
            const mode: AdChannelSettlementMode = ch.settlementMode ?? 'DIRECT_AMOUNT';
            const lines = sortItems(ch.lineItems ?? []);
            const add = addDraft[ch.id] ?? {
              label: '',
              unitAmountWon: '',
              countsForSpend: true,
            };
            return (
              <section
                key={ch.id}
                className={`rounded-lg border bg-white p-4 sm:p-6 ${ch.isActive ? 'border-gray-200' : 'border-amber-200 bg-amber-50/30'}`}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-fluid-base font-medium text-gray-900">{ch.name}</h2>
                      {isTenantOwner ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="text-fluid-2xs text-gray-500">표시 순서</span>
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-1.5 py-0.5 text-fluid-xs disabled:opacity-40"
                            disabled={idx === 0 || busyChannelId === ch.id}
                            onClick={() => void moveChannel(ch.id, 'up')}
                            title="위로"
                            aria-label="표시 순서 위로"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded border border-gray-300 px-1.5 py-0.5 text-fluid-xs disabled:opacity-40"
                            disabled={idx === sortedChannels.length - 1 || busyChannelId === ch.id}
                            onClick={() => void moveChannel(ch.id, 'down')}
                            title="아래로"
                            aria-label="표시 순서 아래로"
                          >
                            ↓
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {!ch.isActive && (
                      <p className="mt-0.5 text-fluid-xs text-amber-800">
                        사용 안 함 — 종료 정산·활성 채널 목록에 나오지 않습니다.
                      </p>
                    )}
                  </div>
                  {isTenantOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(ch);
                        setDeletePassword('');
                      }}
                      className="shrink-0 text-fluid-xs text-red-600 hover:underline"
                    >
                      채널 삭제
                    </button>
                  ) : null}
                  <div className="flex shrink-0 flex-col items-center gap-1.5 sm:items-end">
                    <span className="text-fluid-xs font-medium text-gray-700">사용ON/OFF</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ch.isActive}
                      aria-label={`사용ON/OFF, ${ch.isActive ? '켜짐' : '꺼짐'}`}
                      disabled={togglingActiveId === ch.id || busyChannelId === ch.id}
                      onClick={() => void setChannelActive(ch.id, !ch.isActive)}
                      className={`flex h-8 min-w-[5.5rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 gap-1.5 border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        ch.isActive ? 'flex-row-reverse bg-blue-600' : 'flex-row bg-gray-300'
                      }`}
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full bg-white shadow" aria-hidden />
                      <span
                        className={`min-w-[2rem] flex-1 text-center text-fluid-2xs font-medium tabular-nums leading-none ${
                          ch.isActive ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {ch.isActive ? '켜짐' : '꺼짐'}
                      </span>
                    </button>
                  </div>
                  <label className="flex flex-col gap-1 text-fluid-xs text-gray-600 sm:items-end shrink-0">
                    <span className="sm:text-end">정산 방식</span>
                    <select
                      className="rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-sm text-gray-900 disabled:opacity-50 min-w-[11rem]"
                      value={mode}
                      disabled={busyChannelId === ch.id}
                      onChange={(e) => void setMode(ch.id, e.target.value as AdChannelSettlementMode)}
                    >
                      <option value="DIRECT_AMOUNT">직접 금액 입력</option>
                      <option value="COUNT_LINES">건수 × 건당 금액</option>
                    </select>
                  </label>
                </div>

                {mode === 'COUNT_LINES' && (
                  <>
                    <div className="mb-4 rounded border border-dashed border-gray-300 bg-gray-50/80 p-4">
                      <p className="mb-3 text-fluid-xs text-gray-600">
                        <strong className="text-gray-800">과목 추가</strong>: 건수 입력란이 생깁니다.{' '}
                        <strong className="text-gray-800">합산</strong>을 끄면 광고비 총액에는 포함되지 않으며, 종료 화면에서
                        「총 광고비 ÷ 이 과목 건수」 평균만 계산해 표시합니다.
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-0.5 text-fluid-xs text-gray-600">
                          과목 이름
                          <input
                            className="rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
                            value={add.label}
                            onChange={(e) =>
                              setAddDraft((prev) => ({
                                ...prev,
                                [ch.id]: { ...add, label: e.target.value },
                              }))
                            }
                            placeholder="예: 클릭수"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5 text-fluid-xs text-gray-600">
                          건당 금액
                          <input
                            inputMode="numeric"
                            className="w-28 rounded border border-gray-300 px-2 py-1.5 text-right text-fluid-sm tabular-nums"
                            value={add.unitAmountWon}
                            onChange={(e) =>
                              setAddDraft((prev) => ({
                                ...prev,
                                [ch.id]: { ...add, unitAmountWon: e.target.value },
                              }))
                            }
                            placeholder="0"
                          />
                        </label>
                        <label className="flex items-center gap-1.5 text-fluid-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={add.countsForSpend}
                            onChange={(e) =>
                              setAddDraft((prev) => ({
                                ...prev,
                                [ch.id]: { ...add, countsForSpend: e.target.checked },
                              }))
                            }
                          />
                          광고비에 합산
                        </label>
                        <button
                          type="button"
                          disabled={busyChannelId === ch.id}
                          className="rounded bg-blue-600 px-3 py-1.5 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          onClick={() => void addLine(ch.id)}
                        >
                          과목 추가
                        </button>
                      </div>
                    </div>

                    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                      <table className="w-full min-w-[520px] border-collapse text-fluid-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">과목</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">건당 금액</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">광고비 합산</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">순서</th>
                            <th className="border-b border-gray-200 px-2 py-2 text-center">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-2 py-6 text-center text-gray-500">
                                등록된 과목이 없습니다. 위에서 과목을 추가하세요.
                              </td>
                            </tr>
                          ) : (
                            lines.map((li) =>
                              editingId === li.id && editDraft ? (
                                <tr key={li.id} className="border-t border-gray-100 bg-blue-50/40">
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      className="w-full max-w-[12rem] rounded border border-gray-300 px-2 py-1 text-center"
                                      value={editDraft.label}
                                      onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      inputMode="numeric"
                                      className="w-28 rounded border border-gray-300 px-2 py-1 text-right tabular-nums"
                                      value={editDraft.unitAmountWon}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, unitAmountWon: e.target.value })
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={editDraft.countsForSpend}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, countsForSpend: e.target.checked })
                                      }
                                      aria-label="광고비 합산"
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      inputMode="numeric"
                                      className="w-14 rounded border border-gray-300 px-2 py-1 text-center tabular-nums"
                                      value={editDraft.sortOrder}
                                      onChange={(e) =>
                                        setEditDraft({ ...editDraft, sortOrder: e.target.value })
                                      }
                                    />
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      className="mr-2 text-fluid-xs text-blue-600 hover:underline"
                                      onClick={() => void saveEdit()}
                                    >
                                      저장
                                    </button>
                                    <button
                                      type="button"
                                      className="text-fluid-xs text-gray-600 hover:underline"
                                      onClick={cancelEdit}
                                    >
                                      취소
                                    </button>
                                  </td>
                                </tr>
                              ) : (
                                <tr key={li.id} className="border-t border-gray-100">
                                  <td
                                    className="max-w-[14rem] truncate px-2 py-2 text-center text-gray-900"
                                    title={li.label}
                                  >
                                    {li.label}
                                  </td>
                                  <td className="px-2 py-2 text-right tabular-nums text-gray-800">
                                    {won(li.unitAmountWon)}
                                  </td>
                                  <td className="px-2 py-2 text-center text-gray-700">
                                    {li.countsForSpend ? '예' : '아니오 (평균만)'}
                                  </td>
                                  <td className="px-2 py-2 text-center tabular-nums text-gray-600">{li.sortOrder}</td>
                                  <td className="whitespace-nowrap px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      className="mr-2 text-fluid-xs text-blue-600 hover:underline"
                                      onClick={() => startEdit(li)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      type="button"
                                      className="text-fluid-xs text-red-600 hover:underline"
                                      onClick={() => void removeLine(li.id)}
                                    >
                                      삭제
                                    </button>
                                  </td>
                                </tr>
                              )
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {mode === 'DIRECT_AMOUNT' && (
                  <p className="text-fluid-sm text-gray-600">
                    이 채널은 작업 종료 시 <strong className="text-gray-800">원 단위 금액</strong>만 입력합니다.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-fluid-base font-medium text-gray-900">채널 삭제</h3>
            <p className="mb-3 text-fluid-sm text-gray-600">
              「{deleteTarget.name}」을(를) 삭제합니다. 본인 계정 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-fluid-sm"
              placeholder="비밀번호"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1.5 text-fluid-sm hover:bg-gray-50"
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
                className="rounded bg-red-600 px-3 py-1.5 text-fluid-sm text-white hover:bg-red-700 disabled:opacity-50"
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
