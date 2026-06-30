import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createHelpInquiryPost,
  fetchHelpInquiryPost,
  fetchHelpInquiryPosts,
  fetchHelpInquirySettings,
  uploadHelpInquiryImage,
  type HelpInquiryPost,
  type HelpInquiryPublicSettings,
} from '../../api/helpInquiry';
import { SimpleMarkdown } from '../../utils/simpleMarkdown';
import { ListPaginationBar } from '../ui/ListPaginationBar';

type View = 'list' | 'compose' | 'detail';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function HelpInquiryBoard() {
  const [settings, setSettings] = useState<HelpInquiryPublicSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<HelpInquiryPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<HelpInquiryPost | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [title, setTitle] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchHelpInquirySettings()
      .then((s) => {
        setSettings(s);
        if (s.categories[0]) setCategoryId(s.categories[0].id);
      })
      .catch((e) => setSettingsError(e instanceof Error ? e.message : '설정 로드 실패'));
  }, []);

  const loadList = useCallback(() => {
    setListLoading(true);
    fetchHelpInquiryPosts({ limit: pageSize, offset: (page - 1) * pageSize })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setListLoading(false));
  }, [page, pageSize]);

  useEffect(() => {
    if (view === 'list') loadList();
  }, [view, loadList]);

  const openDetail = (id: string) => {
    setView('detail');
    setDetailLoading(true);
    setDetail(null);
    fetchHelpInquiryPost(id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const resetCompose = () => {
    setTitle('');
    setBodyMarkdown('');
    setPendingImages([]);
    setSubmitMsg(null);
    if (settings?.categories[0]) setCategoryId(settings.categories[0].id);
  };

  const handleImagePick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadHelpInquiryImage(file);
      setPendingImages((prev) => [...prev, url]);
      setBodyMarkdown((prev) => `${prev}${prev ? '\n\n' : ''}![${file.name.replace(/\.[^/.]+$/, '')}](${url})\n`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const r = await createHelpInquiryPost({
        categoryId,
        authorName,
        authorEmail,
        title,
        bodyMarkdown,
        imageUrls: pendingImages,
      });
      resetCompose();
      setPage(1);
      setView('list');
      setSubmitMsg(
        r.emailSent
          ? '문의가 등록되었습니다. 확인 메일을 발송했습니다.'
          : '문의가 등록되었습니다. (메일 발송은 SMTP 설정 확인이 필요할 수 있습니다.)',
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const contactEmail = settings?.contactEmail ?? 'pyo0829@gmail.com';

  const categories = settings?.categories ?? [];

  const composeDisabled =
    submitting ||
    uploading ||
    !categoryId ||
    !authorName.trim() ||
    !authorEmail.trim() ||
    !title.trim() ||
    !bodyMarkdown.trim();

  const listSummary = useMemo(
    () => ({ page, pageSize, total }),
    [page, pageSize, total],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">고객문의</h2>
        <p className="text-slate-600 mb-4">궁금한 점은 이메일 또는 아래 게시판으로 남겨 주세요.</p>
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="text-2xl" aria-hidden>
            ✉️
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">이메일 문의</p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-blue-600 hover:underline break-all"
            >
              {contactEmail}
            </a>
          </div>
        </div>
        {settingsError ? (
          <p className="mt-3 text-fluid-sm text-amber-700">{settingsError}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setView('list');
                setSubmitMsg(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-fluid-sm font-medium ${
                view === 'list' || view === 'detail'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              게시판
            </button>
            <button
              type="button"
              onClick={() => {
                setView('compose');
                setSubmitMsg(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-fluid-sm font-medium ${
                view === 'compose'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              글쓰기
            </button>
          </div>
          {view === 'compose' ? (
            <p className="text-fluid-xs text-slate-500">마크다운·사진 첨부 가능</p>
          ) : null}
        </div>

        {submitMsg && view === 'list' ? (
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-fluid-sm text-emerald-800 sm:px-6">
            {submitMsg}
          </div>
        ) : null}

        {view === 'compose' ? (
          <div className="space-y-4 p-4 sm:p-6">
            {settings?.composeHelpText ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-fluid-sm text-sky-900 whitespace-pre-wrap">
                {settings.composeHelpText}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-fluid-sm">
                <span className="mb-1 block font-medium text-slate-700">이름</span>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  maxLength={64}
                />
              </label>
              <label className="block text-fluid-sm">
                <span className="mb-1 block font-medium text-slate-700">이메일</span>
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  maxLength={256}
                />
              </label>
            </div>

            <label className="block text-fluid-sm">
              <span className="mb-1 block font-medium text-slate-700">카테고리</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-fluid-sm">
              <span className="mb-1 block font-medium text-slate-700">제목</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                maxLength={200}
              />
            </label>

            <label className="block text-fluid-sm">
              <span className="mb-1 block font-medium text-slate-700">내용</span>
              <textarea
                value={bodyMarkdown}
                onChange={(e) => setBodyMarkdown(e.target.value)}
                rows={14}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-fluid-sm leading-relaxed"
                placeholder="자유롭게 작성해 주세요. **굵게**, 목록, 사진 첨부 등 마크다운을 쓸 수 있습니다."
              />
            </label>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-sm hover:bg-slate-50">
                  <span>📷 사진 첨부</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploading || pendingImages.length >= 12}
                    onChange={(e) => {
                      void handleImagePick(e.target.files?.[0] ?? null);
                      e.target.value = '';
                    }}
                  />
                </label>
                {uploading ? <span className="text-fluid-xs text-slate-500">업로드 중…</span> : null}
              </div>
              {pendingImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pendingImages.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={composeDisabled}
                onClick={() => void handleSubmit()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? '등록 중…' : '등록하기'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCompose();
                  setView('list');
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-fluid-sm text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

        {view === 'detail' ? (
          <div className="p-4 sm:p-6">
            <button
              type="button"
              onClick={() => setView('list')}
              className="mb-4 text-fluid-sm text-slate-600 hover:text-slate-900"
            >
              ← 목록
            </button>
            {detailLoading ? (
              <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
            ) : detail ? (
              <article>
                <div className="mb-2 flex flex-wrap gap-2 text-fluid-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {detail.categoryLabel}
                  </span>
                  <span>{formatWhen(detail.createdAt)}</span>
                  <span>
                    {detail.authorName} · {detail.authorEmail}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{detail.title}</h3>
                <div className="prose prose-slate max-w-none text-fluid-sm">
                  <SimpleMarkdown source={detail.bodyMarkdown} />
                </div>
              </article>
            ) : (
              <p className="text-fluid-sm text-red-600">글을 불러올 수 없습니다.</p>
            )}
          </div>
        ) : null}

        {view === 'list' ? (
          <div className="p-4 sm:p-6">
            <ListPaginationBar
              mode="summary"
              page={listSummary.page}
              pageSize={listSummary.pageSize}
              total={listSummary.total}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 30]}
            />
            {listLoading ? (
              <p className="py-8 text-center text-fluid-sm text-slate-500">불러오는 중…</p>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-fluid-sm text-slate-500">
                아직 등록된 문의가 없습니다. 첫 글을 작성해 보세요.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(row.id)}
                      className="flex w-full flex-col gap-1 py-4 text-left hover:bg-slate-50 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-medium text-slate-700">
                          {row.categoryLabel}
                        </span>
                        <span className="text-fluid-2xs text-slate-400">{formatWhen(row.createdAt)}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{row.title}</span>
                      <span className="text-fluid-xs text-slate-500 line-clamp-1">{row.authorName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!listLoading && total > 0 ? (
              <ListPaginationBar
                mode="nav"
                page={listSummary.page}
                pageSize={listSummary.pageSize}
                total={listSummary.total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 30]}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
