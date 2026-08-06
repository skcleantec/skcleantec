import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HelpCmsRichEditor } from '../../components/help-cms/HelpCmsRichEditor';
import {
  createPlatformCustomerBoardPost,
  deletePlatformCustomerBoardPost,
  fetchPlatformCustomerBoardCategories,
  fetchPlatformCustomerBoardPost,
  updatePlatformCustomerBoardPost,
  uploadPlatformCustomerBoardImage,
  type PlatformBoardCategory,
  type PlatformBoardPost,
  type PlatformBoardPostStatus,
} from '../../api/platformCustomerBoard';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

export function PlatformCustomerBoardPostEditPage() {
  const { boardSlug, id } = useParams<{ boardSlug?: string; id?: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const resolvedBoardSlug = boardSlug ?? 'notice';

  const [post, setPost] = useState<PlatformBoardPost | null>(null);
  const [categories, setCategories] = useState<PlatformBoardCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [status, setStatus] = useState<PlatformBoardPostStatus>('OPEN');
  const [isSecret, setIsSecret] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setError('');
    const slug = isNew ? resolvedBoardSlug : undefined;
    const boardForCats = slug ?? 'notice';
    try {
      const cats = await fetchPlatformCustomerBoardCategories(boardForCats);
      setCategories(cats);
      if (!isNew && id) {
        const p = await fetchPlatformCustomerBoardPost(id);
        setPost(p);
        setCategoryId(p.categoryId ?? cats[0]?.id ?? '');
        setTitle(p.title);
        setExcerpt(p.excerpt ?? '');
        setBodyHtml(p.bodyHtml ?? '<p></p>');
        setIsPinned(p.isPinned);
        setIsPublished(p.isPublished);
        setStatus(p.status);
        setIsSecret(p.isSecret);
      } else if (cats[0]) {
        setCategoryId(cats[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, resolvedBoardSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const boardType = post?.boardType ?? (resolvedBoardSlug === 'inquiry' ? 'INQUIRY' : 'NOTICE');
  const activeSlug = post?.boardSlug ?? resolvedBoardSlug;

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (isNew) {
        const created = await createPlatformCustomerBoardPost(activeSlug, {
          categoryId: categoryId || null,
          title,
          excerpt: excerpt.trim() || null,
          bodyHtml,
          isPinned,
          isPublished,
        });
        setMessage('등록했습니다.');
        navigate(`/platform/customer-boards/posts/${created.id}/edit`, { replace: true });
      } else if (id) {
        await updatePlatformCustomerBoardPost(id, {
          categoryId: categoryId || null,
          title,
          excerpt: excerpt.trim() || null,
          bodyHtml,
          isPinned,
          isPublished,
          status,
          isSecret,
        });
        setMessage('저장했습니다.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || isNew) return;
    if (!window.confirm('이 글을 삭제할까요?')) return;
    try {
      await deletePlatformCustomerBoardPost(id);
      navigate('/platform/customer-boards?board=' + encodeURIComponent(activeSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-slate-500">불러오는 중…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/platform/customer-boards?board=${encodeURIComponent(activeSlug)}`} className={BTN_SECONDARY}>
          ← 목록
        </Link>
        {!isNew ? (
          <button type="button" onClick={() => void remove()} className={BTN_SECONDARY}>
            삭제
          </button>
        ) : null}
      </div>

      <h1 className="text-fluid-lg font-bold text-slate-900">
        {isNew ? (boardType === 'NOTICE' ? '공지 작성' : '글 작성') : '글 수정'}
      </h1>

      <div className={`${CARD_SECTION} space-y-4`}>
        {boardType === 'INQUIRY' && post ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-fluid-xs text-slate-700">
            <p>
              <span className="font-medium">작성자:</span> {post.authorName ?? '—'}{' '}
              {post.authorEmail ? `<${post.authorEmail}>` : ''}
            </p>
            {post.tenantName ? (
              <p>
                <span className="font-medium">업체:</span> {post.tenantName}
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="block space-y-1">
          <span className="text-fluid-2xs font-medium text-slate-600">카테고리</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={INPUT_BASE}
            disabled={boardType === 'INQUIRY' && !isNew}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-fluid-2xs font-medium text-slate-600">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={INPUT_BASE}
            readOnly={boardType === 'INQUIRY' && !isNew}
          />
        </label>

        {boardType === 'NOTICE' ? (
          <label className="block space-y-1">
            <span className="text-fluid-2xs font-medium text-slate-600">요약 (목록용, 선택)</span>
            <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={INPUT_BASE} />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-4 text-fluid-xs">
          {boardType === 'NOTICE' ? (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
                상단 고정
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                공개
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <span className="text-slate-600">상태</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PlatformBoardPostStatus)}
                  className="rounded-lg border border-slate-200 px-2 py-1"
                >
                  <option value="OPEN">접수</option>
                  <option value="ANSWERED">답변완료</option>
                  <option value="HIDDEN">숨김</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} />
                비밀글
              </label>
            </>
          )}
        </div>

        <div>
          <p className="mb-1 text-fluid-2xs font-medium text-slate-600">본문</p>
          {boardType === 'INQUIRY' && !isNew ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div
                className="prose prose-slate max-w-none text-fluid-sm"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>
          ) : (
            <HelpCmsRichEditor
              editorKey={`platform-board-${id ?? 'new'}`}
              value={bodyHtml}
              onChange={setBodyHtml}
              onUploadImage={(file) => uploadPlatformCustomerBoardImage(activeSlug, file)}
            />
          )}
        </div>

        {error ? <p className="text-fluid-xs text-red-600">{error}</p> : null}
        {message ? <p className="text-fluid-xs text-emerald-700">{message}</p> : null}

        {(boardType === 'NOTICE' || isNew) && (
          <button type="button" disabled={saving} onClick={() => void save()} className={BTN_PRIMARY}>
            {saving ? '저장 중…' : isNew ? '등록' : '저장'}
          </button>
        )}

        {boardType === 'INQUIRY' && !isNew ? (
          <button type="button" disabled={saving} onClick={() => void save()} className={BTN_PRIMARY}>
            {saving ? '저장 중…' : '상태 저장'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
