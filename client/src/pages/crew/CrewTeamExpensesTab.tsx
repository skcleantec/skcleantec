import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrewMeResponse } from '../../api/crew';
import { getCrewToken } from '../../stores/crewAuth';
import {
  deleteCrewExpense,
  getCrewExpenses,
  postCrewExpense,
  type CrewExpenseListItemDto,
} from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { crewUiLanguageShowsAltMemberName } from '@shared/crewGroupSettings';
import { toast } from '../../components/ui/Toast';

export type CrewTeamExpensesTabVariant = 'page' | 'embedded';

const THAI_MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
function thaiMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${THAI_MONTHS_FULL[m - 1] ?? ''} ${y}`;
}
function shiftMonth(monthKey: string, delta: number): string {
  let [y, m] = monthKey.split('-').map(Number);
  m += delta;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function CrewTeamExpensesTab({
  variant,
  me,
}: {
  variant: CrewTeamExpensesTabVariant;
  me: CrewMeResponse | null;
}) {
  const [month, setMonth] = useState(() => kstMonthKeyNow());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CrewExpenseListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useCrewText();

  const [memberId, setMemberId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const itemsLengthRef = useRef(0);
  itemsLengthRef.current = items.length;

  const canEdit = me?.crewViewerRole === 'LEADER';

  const reload = useCallback(async () => {
    const token = getCrewToken();
    if (!token) return;
    if (itemsLengthRef.current === 0) setLoading(true);
    setError(null);
    try {
      const r = await getCrewExpenses(token, month);
      setItems(r.items);
    } catch (e) {
      setItems([]);
      if (e instanceof AuthSessionExpiredError) throw e;
      setError(e instanceof Error ? e.message : t('crew.common.loading'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    if (!me?.group.members.length) return;
    const first = me.group.members.find((m) => m.isActive);
    setMemberId((prev) => prev || first?.teamMemberId || '');
  }, [me]);

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(list));
  };

  const submit = async () => {
    const token = getCrewToken();
    if (!token || !canEdit) return;
    const amt = Number.parseInt(amountInput.replace(/,/g, '').trim(), 10);
    if (!memberId.trim()) {
      toast.error(t('crew.expenses.errMember'));
      return;
    }
    if (!Number.isFinite(amt) || amt < 1) {
      toast.error(t('crew.expenses.errAmount'));
      return;
    }
    const fd = new FormData();
    fd.append('monthKey', month);
    fd.append('teamMemberId', memberId.trim());
    fd.append('amount', String(amt));
    const memo = memoInput.trim();
    if (memo) fd.append('memo', memo.slice(0, 4000));
    for (const f of files) {
      fd.append('images', f);
    }
    setSaving(true);
    try {
      await postCrewExpense(token, fd);
      toast.success(t('crew.expenses.saved'));
      setAmountInput('');
      setMemoInput('');
      setFiles([]);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('crew.expenses.errAmount'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const token = getCrewToken();
    if (!token || !canEdit) return;
    if (!window.confirm(t('crew.expenses.confirmDelete'))) return;
    try {
      await deleteCrewExpense(token, id);
      toast.success(t('crew.expenses.deleted'));
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('crew.expenses.errAmount'));
    }
  };

  const activeMembers = me?.group.members.filter((m) => m.isActive) ?? [];
  const showAltName = crewUiLanguageShowsAltMemberName(me?.group.crewUiLanguage);

  return (
    <div className="space-y-4 min-w-0">
      {variant === 'page' ? (
        <div>
          <h1 className="text-fluid-lg font-semibold text-gray-900">
            <CrewBiLine id="crew.expenses.title" koClassName="text-fluid-lg font-semibold text-gray-900" />
          </h1>
          <p className="mt-1 text-fluid-xs text-gray-600">
            <CrewBiLine id="crew.expenses.intro" />
          </p>
        </div>
      ) : null}

      {/* Thai month nav */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-3 py-2">
        <button
          type="button"
          className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] text-slate-700"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          ‹
        </button>
        <div className="flex-1 text-center text-[14px] font-semibold text-[#0F172A] tabular-nums">
          {thaiMonthLabel(month)}
        </div>
        <button
          type="button"
          className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[14px] text-slate-700"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          ›
        </button>
      </div>

      {!canEdit ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-900">
          <CrewBiLine id="crew.expenses.leaderOnly" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="block text-fluid-2xs text-gray-600 mb-1">
                <CrewBiLine id="crew.expenses.memberLabel" />
              </span>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm bg-white min-w-0"
              >
                {activeMembers.map((m) => (
                  <option key={m.teamMemberId} value={m.teamMemberId}>
                    {m.name}
                    {showAltName && m.nameTh ? ` (${m.nameTh})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="block text-fluid-2xs text-gray-600 mb-1">
                <CrewBiLine id="crew.expenses.amountLabel" />
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm tabular-nums min-w-0"
                placeholder="0"
              />
            </label>
          </div>
          <label className="block min-w-0">
            <span className="block text-fluid-2xs text-gray-600 mb-1">
              <CrewBiLine id="crew.expenses.memoLabel" />
            </span>
            <input
              type="text"
              value={memoInput}
              onChange={(e) => setMemoInput(e.target.value)}
              className="w-full px-2 py-2 border border-gray-300 rounded text-fluid-sm min-w-0"
            />
          </label>
          <div className="min-w-0">
            <span className="block text-fluid-2xs text-gray-600 mb-1">
              <CrewBiLine id="crew.expenses.imagesLabel" />{' '}
              <span className="text-gray-400 font-normal">({t('crew.expenses.imagesHint')})</span>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              <CrewBiLine id="crew.expenses.pickImage" />
              {files.length > 0 ? (
                <span className="ml-2 rounded-lg bg-[#0F172A] px-2 py-0.5 text-[12px] text-white tabular-nums">
                  {files.length}
                </span>
              ) : null}
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-900 text-white text-fluid-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            <CrewBiLine id="crew.expenses.submit" />
          </button>
        </div>
      )}

      {error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-fluid-sm text-gray-500 py-8 text-center">
          <CrewBiLine id="crew.expenses.loading" />
        </p>
      ) : items.length === 0 ? (
        <p className="text-fluid-sm text-gray-500 py-8 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/60">
          <CrewBiLine id="crew.expenses.empty" />
        </p>
      ) : (
        <>
          <div className="lg:hidden divide-y divide-gray-100 border border-gray-200 rounded-lg bg-white overflow-hidden">
            {items.map((row) => (
              <div key={row.id} className="px-3 py-3 text-fluid-xs space-y-2">
                <div className="flex justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{row.teamMember.name}</div>
                    <div className="text-fluid-2xs text-gray-500 truncate">{fmtIso(row.createdAt)}</div>
                  </div>
                  <div className="shrink-0 text-right font-semibold tabular-nums text-gray-900">
                    {Number(row.amount).toLocaleString('ko-KR')}원
                  </div>
                </div>
                {row.memo ? <p className="text-gray-700 whitespace-pre-wrap break-words">{row.memo}</p> : null}
                <div className="flex flex-wrap gap-2 items-center">
                  {row.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.secureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block rounded border border-gray-200 overflow-hidden bg-gray-50"
                    >
                      <img src={a.secureUrl} alt="" className="h-16 w-16 object-cover" />
                    </a>
                  ))}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      className="ml-auto text-red-700 text-fluid-2xs font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                    >
                      <CrewBiLine id="crew.expenses.delete" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block w-full min-w-0 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-fluid-xs">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[28%]" />
                <col className="w-[26%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="border-b border-gray-200 px-2 py-2 text-center">팀원</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center">등록일시</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center">금액</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center">메모</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center">영수증</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 align-top">
                    <td
                      className="border-b border-gray-100 px-2 py-2 text-center text-gray-900 truncate"
                      title={row.teamMember.name}
                    >
                      {row.teamMember.name}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-center tabular-nums text-gray-700">
                      {fmtIso(row.createdAt)}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-right tabular-nums font-medium text-gray-900">
                      {Number(row.amount).toLocaleString('ko-KR')}원
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-center text-gray-800 whitespace-pre-wrap break-words">
                      {row.memo ?? '—'}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-center">
                      <div className="flex flex-wrap gap-1 justify-center items-start">
                        {row.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={a.secureUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded border border-gray-200 overflow-hidden bg-gray-50"
                          >
                            <img src={a.secureUrl} alt="" className="h-14 w-14 object-cover" />
                          </a>
                        ))}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => void remove(row.id)}
                            className="text-red-700 text-[12px] font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 shrink-0"
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
