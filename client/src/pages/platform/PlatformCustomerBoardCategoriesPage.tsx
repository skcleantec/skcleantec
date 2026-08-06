import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createPlatformCustomerBoardCategory,
  deletePlatformCustomerBoardCategory,
  fetchPlatformCustomerBoardCategories,
  updatePlatformCustomerBoardCategory,
  type PlatformBoardCategory,
} from '../../api/platformCustomerBoard';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

export function PlatformCustomerBoardCategoriesPage() {
  const [searchParams] = useSearchParams();
  const boardSlug = searchParams.get('board') || 'inquiry';
  const [items, setItems] = useState<PlatformBoardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPlatformCustomerBoardCategories(boardSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [boardSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCategory = async () => {
    if (!newLabel.trim()) return;
    try {
      await createPlatformCustomerBoardCategory(boardSlug, { label: newLabel.trim() });
      setNewLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link to={`/platform/customer-boards?board=${encodeURIComponent(boardSlug)}`} className={BTN_SECONDARY}>
        ← 게시판으로
      </Link>
      <h1 className="text-fluid-lg font-bold text-slate-900">카테고리 관리</h1>
      <div className={`${CARD_SECTION} space-y-3`}>
        {loading ? (
          <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                <input
                  defaultValue={c.label}
                  onBlur={(e) => {
                    const label = e.target.value.trim();
                    if (label && label !== c.label) {
                      void updatePlatformCustomerBoardCategory(boardSlug, c.id, { label }).then(load);
                    }
                  }}
                  className={`${INPUT_BASE} flex-1`}
                />
                <span className="text-fluid-2xs tabular-nums text-slate-400">{c.postCount}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`「${c.label}」 카테고리를 삭제할까요?`)) return;
                    void deletePlatformCustomerBoardCategory(boardSlug, c.id).then(load);
                  }}
                  className="text-fluid-2xs text-red-600 hover:underline"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="새 카테고리 이름"
            className={`${INPUT_BASE} flex-1`}
          />
          <button type="button" onClick={() => void addCategory()} className={BTN_PRIMARY}>
            추가
          </button>
        </div>
        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
