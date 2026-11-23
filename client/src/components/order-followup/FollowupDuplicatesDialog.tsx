import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listOrderFollowupDuplicates,
  mergeOrderFollowups,
  type OrderFollowupCandidate,
} from '../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL } from '../../constants/orderFollowupStatus';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { ModalCloseButton } from '../admin/ModalCloseButton';

type Group = { rows: OrderFollowupCandidate[] };
const PAGE = 20;

function groupKey(group: Group): string {
  return group.rows.map((row) => row.id).sort().join('|');
}

/** 관리자 — 같은 고객으로 보이는 부재·보류 묶음을 보고 한 줄로 합친다 */
export function FollowupDuplicatesDialog({
  token,
  brands,
  initialBrandId,
  onClose,
  onMerged,
}: {
  token: string;
  brands: Array<{ id: string; name: string }>;
  initialBrandId?: string;
  onClose: () => void;
  onMerged: () => void;
}) {
  const [brandId, setBrandId] = useState(initialBrandId || brands[0]?.id || '');
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 묶음별로 남길 줄 */
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({});
  /** 「합치기」를 한 번 누른 묶음 — 한 번 더 눌러야 실제로 합친다 */
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listOrderFollowupDuplicates(token, { operatingCompanyId: brandId, limit: PAGE, offset });
      setGroups(res.items);
      setTotal(res.total);
    } catch (e) {
      setGroups([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [token, brandId, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const merge = async (group: Group) => {
    const key = groupKey(group);
    const keepId = keepByGroup[key] ?? group.rows[0]?.id;
    if (!keepId) return;
    if (armedKey !== key) {
      setArmedKey(key);
      return;
    }
    setMergingKey(key);
    setError(null);
    try {
      await mergeOrderFollowups(token, {
        keepId,
        mergeIds: group.rows.map((row) => row.id).filter((id) => id !== keepId),
      });
      setDoneCount((n) => n + 1);
      setArmedKey(null);
      onMerged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '합치지 못했어요.');
    } finally {
      setMergingKey(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="중복 의심 고객">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="relative flex max-h-[86vh] w-[min(720px,100%)] flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 flex-1 pr-9">
            <p className="text-fluid-sm font-bold text-slate-900">중복 의심 고객</p>
            <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-600">
              이름·닉네임이나 번호가 같은 부재·보류를 묶어 보여 줘요. 남길 줄을 고르고 합치면 메모·부재 횟수·기록이 그 줄로 옮겨지고 나머지 줄은 사라집니다. 합친 뒤에는 되돌릴 수 없어요.
            </p>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-fluid-2xs text-slate-600">
          {brands.length > 1 ? (
            <label className="inline-flex items-center gap-1.5">
              브랜드
              <select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  setOffset(0);
                  setArmedKey(null);
                }}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-fluid-xs text-slate-900"
              >
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="tabular-nums">
            {loading ? '불러오는 중…' : `의심 묶음 ${total.toLocaleString('ko-KR')}개`}
            {doneCount > 0 ? ` · 이번에 ${doneCount}개 합침` : ''}
          </span>
          <span className="text-slate-500">같은 이름의 다른 사람일 수 있으니 번호와 메모를 보고 정해 주세요.</span>
        </div>

        {error ? <p className="px-4 pt-2 text-fluid-2xs font-medium text-red-700">{error}</p> : null}

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
          {!loading && groups.length === 0 && !error ? (
            <p className="py-8 text-center text-fluid-xs text-slate-500">이 브랜드에는 중복으로 보이는 고객이 없어요.</p>
          ) : null}
          {groups.map((group) => {
            const key = groupKey(group);
            const keepId = keepByGroup[key] ?? group.rows[0]?.id;
            const armed = armedKey === key;
            const busy = mergingKey === key;
            return (
              <fieldset key={key} className="rounded-xl border border-slate-200">
                <legend className="sr-only">남길 줄 고르기</legend>
                <ul className="divide-y divide-slate-100">
                  {group.rows.map((row) => {
                    const phones = [row.customerPhone, row.customerPhone2].map((p) => (p ?? '').trim()).filter(Boolean);
                    const keep = row.id === keepId;
                    return (
                      <li key={row.id}>
                        <label className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 ${keep ? 'bg-violet-50/60' : ''}`}>
                          <input
                            type="radio"
                            name={`keep-${key}`}
                            checked={keep}
                            onChange={() => {
                              setKeepByGroup((prev) => ({ ...prev, [key]: row.id }));
                              setArmedKey(null);
                            }}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-fluid-xs">
                              <span className="font-semibold text-slate-900">{row.customerName}</span>
                              {row.nickname?.trim() && row.nickname.trim() !== row.customerName ? (
                                <span className="text-slate-500">{row.nickname}</span>
                              ) : null}
                              <span className="tabular-nums text-slate-700">{phones.length ? phones.join(' · ') : '번호 없음'}</span>
                              {keep ? (
                                <span className="rounded-md bg-violet-700 px-1.5 py-px text-[10.5px] font-bold text-white">남길 줄</span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-fluid-2xs text-slate-500">
                              {ORDER_FOLLOWUP_STATUS_LABEL[row.status]} · 부재 {row.deferCount}회 · {formatDateCompactWithWeekday(row.createdAt)} 등록
                              {row.handlerName ? ` · ${row.handlerName}` : ''}
                            </span>
                            {row.memoPreview ? (
                              <span className="mt-0.5 block break-words text-fluid-2xs text-slate-500">{row.memoPreview}</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2">
                  {armed ? (
                    <>
                      <span className="text-fluid-2xs font-medium text-rose-700">
                        {group.rows.length - 1}줄이 사라지고 되돌릴 수 없어요.
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setArmedKey(null)}
                        className="inline-flex h-8 items-center rounded-lg px-2.5 text-fluid-2xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        취소
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || mergingKey != null}
                    onClick={() => void merge(group)}
                    className={`inline-flex h-8 items-center rounded-lg px-3 text-fluid-2xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 ${
                      armed
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {busy ? '합치는 중…' : armed ? '네, 합칠게요' : '고른 줄로 합치기'}
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>

        {total > PAGE ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-fluid-2xs text-slate-600">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 font-semibold disabled:opacity-40"
            >
              이전
            </button>
            <span className="tabular-nums">
              {offset + 1}–{Math.min(total, offset + PAGE)} / {total}
            </span>
            <button
              type="button"
              disabled={offset + PAGE >= total || loading}
              onClick={() => setOffset((o) => o + PAGE)}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 font-semibold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
