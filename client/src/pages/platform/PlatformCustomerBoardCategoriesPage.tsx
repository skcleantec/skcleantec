import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createPlatformCustomerBoardCategory,
  deletePlatformCustomerBoardCategory,
  fetchPlatformCustomerBoardCategories,
  fetchPlatformCustomerBoards,
  updatePlatformCustomerBoardCategory,
  type PlatformBoard,
  type PlatformBoardCategory,
} from '../../api/platformCustomerBoard';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

export function PlatformCustomerBoardCategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const boardSlug = searchParams.get('board') || 'notice';
  const [boards, setBoards] = useState<PlatformBoard[]>([]);
  const [items, setItems] = useState<PlatformBoardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const activeBoard = boards.find((b) => b.slug === boardSlug);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [boardList, cats] = await Promise.all([
        fetchPlatformCustomerBoards(),
        fetchPlatformCustomerBoardCategories(boardSlug),
      ]);
      setBoards(boardList);
      setItems(cats);
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
    setAdding(true);
    setError('');
    try {
      await createPlatformCustomerBoardCategory(boardSlug, { label: newLabel.trim() });
      setNewLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link to={`/platform/customer-boards?board=${encodeURIComponent(boardSlug)}`} className={BTN_SECONDARY}>
        ← 게시판으로
      </Link>
      <h1 className="text-fluid-lg font-bold text-slate-900">카테고리 관리</h1>
      <p className="text-fluid-xs text-slate-500">
        공지와 문의 카테고리는 따로입니다. 지금 고른 게시판에만 추가됩니다.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {boards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => {
              setSearchParams({ board: b.slug });
            }}
            className={`rounded-lg px-3 py-1.5 text-fluid-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              boardSlug === b.slug
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className={`${CARD_SECTION} space-y-3`}>
        {activeBoard ? (
          <p className="text-fluid-xs font-medium text-slate-700">{activeBoard.label} 카테고리</p>
        ) : null}
        {loading ? (
          <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
        ) : (
          <ul className="space-y-2">
            {items.length === 0 ? (
              <li className="text-fluid-xs text-slate-500">아직 카테고리가 없습니다. 아래에서 추가하세요.</li>
            ) : null}
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
                  className="text-fluid-2xs text-red-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addCategory();
              }
            }}
            placeholder="새 카테고리 이름 (한글 가능)"
            className={`${INPUT_BASE} flex-1`}
          />
          <button
            type="button"
            disabled={adding || !newLabel.trim()}
            onClick={() => void addCategory()}
            className={BTN_PRIMARY}
          >
            {adding ? '추가 중…' : '추가'}
          </button>
        </div>
        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
