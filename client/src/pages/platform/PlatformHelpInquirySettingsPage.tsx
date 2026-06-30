import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformHelpInquiryPosts,
  fetchPlatformHelpInquirySettings,
  updatePlatformHelpInquirySettings,
  type HelpInquiryPlatformSettings,
} from '../../api/platformHelpInquiry';
import type { HelpInquiryCategory } from '../../api/helpInquiry';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
} from '../../utils/platformUi';

function slugId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣_-]/g, '')
    .slice(0, 48);
  return base || `cat-${Date.now()}`;
}

export function PlatformHelpInquirySettingsPage() {
  const [settings, setSettings] = useState<HelpInquiryPlatformSettings | null>(null);
  const [categories, setCategories] = useState<HelpInquiryCategory[]>([]);
  const [contactEmail, setContactEmail] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [composeHelpText, setComposeHelpText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [postTotal, setPostTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, posts] = await Promise.all([
        fetchPlatformHelpInquirySettings(),
        fetchPlatformHelpInquiryPosts({ limit: 1, offset: 0 }),
      ]);
      setSettings(s);
      setContactEmail(s.contactEmail);
      setNotifyEmail(s.notifyEmail);
      setComposeHelpText(s.composeHelpText ?? '');
      setCategories(s.categories);
      setPostTotal(posts.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updatePlatformHelpInquirySettings({
        contactEmail,
        notifyEmail,
        composeHelpText: composeHelpText.trim() || null,
        categories: categories.map((c, i) => ({ ...c, sortOrder: i })),
      });
      setSettings(updated);
      setCategories(updated.categories);
      setMessage('저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const label = '새 카테고리';
    setCategories((prev) => [...prev, { id: slugId(`${label}-${prev.length}`), label, sortOrder: prev.length }]);
  };

  const moveCategory = (index: number, dir: -1 | 1) => {
    setCategories((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">도움말 · 고객문의</h1>
        <p className="mt-1 text-sm text-gray-600">
          `/help` 고객문의 탭 — 이메일·게시판 카테고리·글 작성 안내·알림 메일을 설정합니다.
        </p>
        <p className="mt-1 text-sm text-gray-500">등록된 게시글 {postTotal.toLocaleString('ko-KR')}건</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <section className={CARD_SECTION}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">연락처 · 알림</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">화면 표시 이메일 (고객 문의)</span>
            <input
              className={INPUT_BASE}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">게시글 알림 수신 메일</span>
            <input
              className={INPUT_BASE}
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500">새 게시글이 등록되면 이 주소로 본문·사진 링크가 발송됩니다.</span>
          </label>
        </div>
      </section>

      <section className={CARD_SECTION}>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">글 작성 창 도움말</h2>
        <p className="text-sm text-gray-600 mb-3">고객이 「글쓰기」 탭에서 보는 안내 문구입니다.</p>
        <textarea
          className={`${INPUT_BASE} min-h-[120px] font-normal`}
          value={composeHelpText}
          onChange={(e) => setComposeHelpText(e.target.value)}
          placeholder="예: 버그 신고 시 재현 방법·브라우저 종류를 함께 적어 주세요."
        />
      </section>

      <section className={CARD_SECTION}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">게시판 카테고리</h2>
          <button type="button" className={BTN_SECONDARY} onClick={addCategory}>
            + 카테고리
          </button>
        </div>
        <ul className="space-y-2">
          {categories.map((c, i) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <span className="text-xs text-gray-400 w-16 shrink-0 truncate" title={c.id}>
                {c.id}
              </span>
              <input
                className={`${INPUT_BASE} flex-1 min-w-[140px]`}
                value={c.label}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev.map((row, j) => (j === i ? { ...row, label: e.target.value } : row)),
                  )
                }
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={i === 0}
                  onClick={() => moveCategory(i, -1)}
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={i === categories.length - 1}
                  onClick={() => moveCategory(i, 1)}
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  disabled={categories.length <= 1}
                  onClick={() => setCategories((prev) => prev.filter((_, j) => j !== i))}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void save()}>
          {saving ? '저장 중…' : '저장'}
        </button>
        {settings ? (
          <span className="self-center text-xs text-gray-400">
            기본값: {settings.contactEmail} / 알림 {settings.notifyEmail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
