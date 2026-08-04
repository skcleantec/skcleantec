import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformToken } from '../../stores/platformAuth';
import { getPlatformMe } from '../../api/platformTenants';
import {
  deletePlatformHelpCmsArticle,
  fetchPlatformHelpCmsArticles,
  fetchPlatformHelpCmsCategories,
  type HelpCmsArticleListItem,
  type HelpCmsCategory,
} from '../../api/platformHelpCms';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

export function PlatformHelpCmsPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [platformUserId, setPlatformUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<HelpCmsCategory[]>([]);
  const [items, setItems] = useState<HelpCmsArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [tabGroup, setTabGroup] = useState<'usage' | 'notice' | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMeta = useCallback(async () => {
    const token = getPlatformToken();
    if (token) {
      const me = await getPlatformMe(token);
      setIsSuperAdmin(me.role === 'SUPER_ADMIN');
      setPlatformUserId(me.id);
    }
    setCategories(await fetchPlatformHelpCmsCategories());
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPlatformHelpCmsArticles({
        tabGroup: tabGroup || undefined,
        categoryId: categoryId || undefined,
        q: q.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [tabGroup, categoryId, q]);

  useEffect(() => {
    void loadMeta().catch(() => {});
  }, [loadMeta]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const canDelete = (row: HelpCmsArticleListItem) =>
    isSuperAdmin || (platformUserId != null && row.authorPlatformUserId === platformUserId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">도움말 CMS</h1>
          <p className="mt-1 text-sm text-gray-600">
            청소비서 `/help`에 게시할 글을 작성합니다. 사진·설명은 글쓰기 창에서 자유롭게 넣을 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin ? (
            <Link to="/platform/help-cms/categories" className={BTN_SECONDARY}>
              카테고리 설정
            </Link>
          ) : null}
          <Link to="/platform/help-cms/articles/new" className={BTN_PRIMARY}>
            + 새 글
          </Link>
          <a href="/help" target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
            /help 미리보기
          </a>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <section className={`${CARD_SECTION} flex flex-wrap gap-3`}>
        <select
          className={INPUT_BASE}
          value={tabGroup}
          onChange={(e) => setTabGroup(e.target.value as '' | 'usage' | 'notice')}
        >
          <option value="">전체 탭</option>
          <option value="usage">사용법</option>
          <option value="notice">공지</option>
        </select>
        <select className={INPUT_BASE} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.tabGroup}] {c.label}
            </option>
          ))}
        </select>
        <input
          className={`${INPUT_BASE} min-w-[200px] flex-1`}
          placeholder="제목·slug 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </section>

      <section className={CARD_SECTION}>
        <p className="mb-3 text-sm text-gray-500">총 {total.toLocaleString('ko-KR')}건</p>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">글이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-gray-600">
                  <th className="py-2 px-2 text-center font-medium">제목</th>
                  <th className="py-2 px-2 text-center font-medium">카테고리</th>
                  <th className="py-2 px-2 text-center font-medium">게시</th>
                  <th className="py-2 px-2 text-center font-medium">수정일</th>
                  <th className="py-2 px-2 text-center font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 px-2 text-left">
                      <div className="font-medium text-gray-900">{row.title}</div>
                      <div className="text-xs text-gray-400">{row.slug}</div>
                    </td>
                    <td className="py-2 px-2 text-center text-gray-700">{row.categoryLabel}</td>
                    <td className="py-2 px-2 text-center">
                      {row.isPublished ? (
                        <span className="text-emerald-700">게시</span>
                      ) : (
                        <span className="text-gray-400">임시</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-gray-500 tabular-nums">
                      {new Date(row.updatedAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Link
                          to={`/platform/help-cms/articles/${row.id}/edit`}
                          className="text-sky-700 hover:underline"
                        >
                          편집
                        </Link>
                        {row.isPublished ? (
                          <a
                            href={`/help?category=${row.tabGroup}&section=${encodeURIComponent(row.categorySlug)}&article=${encodeURIComponent(row.slug)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:underline"
                          >
                            보기
                          </a>
                        ) : null}
                        {canDelete(row) ? (
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => {
                              if (!window.confirm(`「${row.title}」 글을 삭제할까요?`)) return;
                              void deletePlatformHelpCmsArticle(row.id)
                                .then(() => loadArticles())
                                .catch((e) => setError(e instanceof Error ? e.message : '삭제 실패'));
                            }}
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
        )}
      </section>
    </div>
  );
}
