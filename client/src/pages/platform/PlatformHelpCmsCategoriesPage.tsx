import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformToken } from '../../stores/platformAuth';
import { getPlatformMe } from '../../api/platformTenants';
import {
  createPlatformHelpCmsCategory,
  deletePlatformHelpCmsCategory,
  fetchPlatformHelpCmsCategories,
  reorderPlatformHelpCmsCategories,
  updatePlatformHelpCmsCategory,
  type HelpCmsCategory,
} from '../../api/platformHelpCms';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

const TAB_OPTIONS = [
  { value: 'usage', label: '사용법 탭' },
  { value: 'notice', label: '공지 탭' },
] as const;

function slugId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  return base || `cat-${Date.now()}`;
}

export function PlatformHelpCmsCategoriesPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [categories, setCategories] = useState<HelpCmsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tabFilter, setTabFilter] = useState<'usage' | 'notice'>('usage');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getPlatformToken();
      if (token) {
        const me = await getPlatformMe(token);
        setIsSuperAdmin(me.role === 'SUPER_ADMIN');
      }
      setCategories(await fetchPlatformHelpCmsCategories());
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = categories.filter((c) => c.tabGroup === tabFilter);

  const saveOrder = async (ordered: HelpCmsCategory[]) => {
    setSaving(true);
    setError('');
    try {
      const items = await reorderPlatformHelpCmsCategories(
        tabFilter,
        ordered.map((c) => c.id),
      );
      setCategories((prev) => {
        const rest = prev.filter((c) => c.tabGroup !== tabFilter);
        return [...rest, ...items].sort((a, b) =>
          a.tabGroup === b.tabGroup ? a.sortOrder - b.sortOrder : a.tabGroup.localeCompare(b.tabGroup),
        );
      });
      setMessage('순서를 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...filtered];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    void saveOrder(next);
  };

  const addCategory = async () => {
    setSaving(true);
    setError('');
    try {
      await createPlatformHelpCmsCategory({
        label: '새 카테고리',
        slug: slugId(`new-${Date.now()}`),
        tabGroup: tabFilter,
      });
      setMessage('카테고리를 추가했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin && !loading) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        카테고리 설정은 플랫폼 최고 관리자만 이용할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">도움말 카테고리</h1>
          <p className="mt-1 text-sm text-gray-600">
            `/help` 사용법·공지 탭 아래에 표시될 카테고리를 관리합니다.
          </p>
        </div>
        <Link to="/platform/help-cms" className={BTN_SECONDARY}>
          ← 글 목록
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TAB_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTabFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tabFilter === opt.value ? 'bg-slate-900 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <button type="button" onClick={() => void addCategory()} disabled={saving} className={BTN_PRIMARY}>
          + 카테고리
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <section className={`${CARD_SECTION} space-y-3`}>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">카테고리가 없습니다.</p>
          ) : (
            filtered.map((cat, index) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                index={index}
                total={filtered.length}
                onMove={move}
                onSave={async (patch) => {
                  setSaving(true);
                  try {
                    await updatePlatformHelpCmsCategory(cat.id, patch);
                    await load();
                    setMessage('저장했습니다.');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '저장 실패');
                  } finally {
                    setSaving(false);
                  }
                }}
                onDelete={async () => {
                  if (!window.confirm(`「${cat.label}」 카테고리를 삭제할까요?`)) return;
                  setSaving(true);
                  try {
                    await deletePlatformHelpCmsCategory(cat.id);
                    await load();
                    setMessage('삭제했습니다.');
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '삭제 실패');
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}

function CategoryRow({
  cat,
  index,
  total,
  onMove,
  onSave,
  onDelete,
}: {
  cat: HelpCmsCategory;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onSave: (patch: Partial<HelpCmsCategory>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [label, setLabel] = useState(cat.label);
  const [slug, setSlug] = useState(cat.slug);
  const [description, setDescription] = useState(cat.description ?? '');
  const [published, setPublished] = useState(cat.isPublished);

  useEffect(() => {
    setLabel(cat.label);
    setSlug(cat.slug);
    setDescription(cat.description ?? '');
    setPublished(cat.isPublished);
  }, [cat]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_SECONDARY} disabled={index === 0} onClick={() => onMove(index, -1)}>
          ↑
        </button>
        <button type="button" className={BTN_SECONDARY} disabled={index >= total - 1} onClick={() => onMove(index, 1)}>
          ↓
        </button>
        <span className="text-xs text-gray-500">글 {cat.articleCount}건</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          공개
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">이름</span>
          <input className={INPUT_BASE} value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">주소(slug)</span>
          <input className={INPUT_BASE} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">설명 (선택)</span>
        <input className={INPUT_BASE} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() =>
            void onSave({
              label,
              slug,
              description: description.trim() || null,
              isPublished: published,
            })
          }
        >
          저장
        </button>
        <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => void onDelete()}>
          삭제
        </button>
      </div>
    </div>
  );
}
