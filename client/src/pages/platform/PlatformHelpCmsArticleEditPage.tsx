import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createPlatformHelpCmsArticle,
  fetchPlatformHelpCmsArticle,
  fetchPlatformHelpCmsArticles,
  fetchPlatformHelpCmsCategories,
  updatePlatformHelpCmsArticle,
  uploadPlatformHelpCmsImage,
  type HelpCmsArticleListItem,
  type HelpCmsCategory,
} from '../../api/platformHelpCms';
import { HelpCmsRichEditor } from '../../components/help-cms/HelpCmsRichEditor';
import { HelpCmsArticleCard, HelpCmsArticleReadLayout } from '../../components/help-cms/HelpCmsArticleReadLayout';
import { applyHelpCmsArticleToEditorState } from '../../components/help-cms/helpCmsEditorState';
import { HELP_CMS_PAGE_OUTER } from '../../components/help-cms/helpCmsArticleLayout';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

export function PlatformHelpCmsArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [categories, setCategories] = useState<HelpCmsCategory[]>([]);
  const [categoryArticles, setCategoryArticles] = useState<HelpCmsArticleListItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [isPublished, setIsPublished] = useState(false);
  const [convertedFromMarkdown, setConvertedFromMarkdown] = useState(false);
  const [articleLoading, setArticleLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editorKey = isNew ? 'new' : id ?? 'edit';

  useEffect(() => {
    void fetchPlatformHelpCmsCategories()
      .then((items) => {
        setCategories(items);
        if (isNew && items[0] && !categoryId) setCategoryId(items[0].id);
      })
      .catch(() => {});
  }, [isNew]);

  useEffect(() => {
    if (!categoryId) {
      setCategoryArticles([]);
      return;
    }
    let cancelled = false;
    setArticlesLoading(true);
    void fetchPlatformHelpCmsArticles({ categoryId, limit: 100 })
      .then((data) => {
        if (!cancelled) setCategoryArticles(data.items);
      })
      .catch(() => {
        if (!cancelled) setCategoryArticles([]);
      })
      .finally(() => {
        if (!cancelled) setArticlesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    if (isNew || !id) {
      setArticleLoading(false);
      return;
    }
    let cancelled = false;
    setArticleLoading(true);
    setError('');
    void fetchPlatformHelpCmsArticle(id)
      .then((row) => {
        if (cancelled) return;
        const next = applyHelpCmsArticleToEditorState(row);
        setCategoryId(next.categoryId);
        setTitle(next.title);
        setSlug(next.slug);
        setExcerpt(next.excerpt);
        setCoverImageUrl(next.coverImageUrl);
        setBodyHtml(next.bodyHtml);
        setIsPublished(next.isPublished);
        setConvertedFromMarkdown(next.convertedFromMarkdown);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패');
      })
      .finally(() => {
        if (!cancelled) setArticleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const uploadImage = useCallback((file: File) => uploadPlatformHelpCmsImage(file), []);

  const save = async (publish?: boolean) => {
    setSaving(true);
    setError('');
    setMessage('');
    const nextPublished = publish ?? isPublished;
    const payload = {
      categoryId,
      title,
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      contentFormat: 'html' as const,
      bodyHtml,
      bodyMarkdown: null,
      isPublished: nextPublished,
    };
    try {
      if (isNew) {
        const created = await createPlatformHelpCmsArticle(payload);
        setMessage(nextPublished ? '게시했습니다.' : '저장했습니다.');
        navigate(`/platform/help-cms/articles/${created.id}/edit`, { replace: true });
      } else {
        await updatePlatformHelpCmsArticle(id!, payload);
        setIsPublished(nextPublished);
        setConvertedFromMarkdown(false);
        setMessage(nextPublished ? '게시했습니다.' : '저장했습니다.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${HELP_CMS_PAGE_OUTER} space-y-4 py-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? '새 도움말 글' : '도움말 글 편집'}</h1>
          <p className="mt-1 text-sm text-gray-600">
            네이버 블로그처럼 본문에 보이는 그대로 /help 에 게시됩니다. **·표·사진은 툴바로 넣으세요.
          </p>
        </div>
        <Link to="/platform/help-cms" className={BTN_SECONDARY}>
          ← 목록
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {convertedFromMarkdown ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          예전 마크다운 글을 편집 화면 형식으로 불러왔습니다. 저장하면 공개 도움말도 같은 서식(HTML)으로
          게시됩니다.
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <section className={`${CARD_SECTION} space-y-4`}>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving} className={BTN_SECONDARY} onClick={() => void save(false)}>
            임시 저장
          </button>
          <button type="button" disabled={saving} className={BTN_PRIMARY} onClick={() => void save(true)}>
            게시
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block font-medium text-gray-700">카테고리</span>
            <select className={INPUT_BASE} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.tabGroup === 'usage' ? '사용법' : '공지'}] {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">주소(slug, 선택)</span>
            <input className={INPUT_BASE} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">목록 요약 (선택)</span>
            <input className={INPUT_BASE} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block font-medium text-gray-700">대표 이미지 URL (선택)</span>
            <input className={INPUT_BASE} value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />
          </label>
        </div>
      </section>

      <HelpCmsArticleReadLayout
        sidebarItems={categories.map((c) => ({
          id: c.id,
          label: c.label,
          count: c.articleCount,
          active: c.id === categoryId,
          onSelect: () => setCategoryId(c.id),
        }))}
        articleItems={categoryArticles.map((row) => ({
          id: row.id,
          title: row.title,
          active: !isNew && id === row.id,
          muted: !row.isPublished,
          onSelect: () => {
            if (row.id === id) return;
            navigate(`/platform/help-cms/articles/${row.id}/edit`);
          },
        }))}
        articlesLoading={articlesLoading}
        showArticleSidebar={Boolean(categoryId)}
      >
        <HelpCmsArticleCard>
          {articleLoading && !isNew ? (
            <p className="py-16 text-center text-fluid-sm text-slate-500">글을 불러오는 중…</p>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="sr-only">제목</span>
                <input
                  className="w-full border-0 bg-transparent p-0 text-2xl font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  disabled={articleLoading}
                />
              </label>

              {coverImageUrl.trim() ? (
                <img
                  src={coverImageUrl.trim()}
                  alt=""
                  className="max-h-80 w-full rounded-xl object-cover"
                />
              ) : null}

              <HelpCmsRichEditor
                key={editorKey}
                editorKey={editorKey}
                value={bodyHtml}
                onChange={setBodyHtml}
                onUploadImage={uploadImage}
                onUploadError={(msg) => setError(msg)}
              />
            </div>
          )}
        </HelpCmsArticleCard>
      </HelpCmsArticleReadLayout>

      {isNew ? (
        <p className="text-center text-sm text-slate-500">
          저장하면 왼쪽 「글」 목록에서 다른 글을 선택할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
