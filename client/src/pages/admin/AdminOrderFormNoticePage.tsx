import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFormConfig, updateFormConfig } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';
import { parseGuideFromStoredContent } from '../../utils/orderGuideParse';
import { ORDER_FORM_CONFIG_DEFAULTS, orderFormConfigLine } from '../../constants/orderFormConfigDefaults';

function cloneSections(s: GuideSection[]): GuideSection[] {
  return s.map((sec) => ({ title: sec.title, items: [...sec.items] }));
}

export function AdminOrderFormNoticePage({ embedded = false }: { embedded?: boolean }) {
  const token = getToken();
  const [sections, setSections] = useState<GuideSection[]>(() => cloneSections(ORDER_GUIDE_DEFAULT_SECTIONS));
  const [infoLinkText, setInfoLinkText] = useState<string>(
    ORDER_FORM_CONFIG_DEFAULTS.infoLinkText
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getFormConfig(token)
      .then((c) => {
        setSections(parseGuideFromStoredContent(c.infoContent));
        setInfoLinkText(
          orderFormConfigLine(c.infoLinkText, ORDER_FORM_CONFIG_DEFAULTS.infoLinkText)
        );
        setError(null);
      })
      .catch(() => {
        setError('설정을 불러오지 못했습니다. 아래 내용으로 편집·저장할 수 있습니다.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    const trimmed = sections
      .map((s) => ({
        title: s.title.trim(),
        items: s.items.map((x) => x.trim()).filter(Boolean),
      }))
      .filter((s) => s.title || s.items.length);
    if (!trimmed.length) {
      setError('최소 한 개 섹션에 안내 문구를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      await updateFormConfig(token, {
        infoContent: JSON.stringify({ sections: trimmed }),
        infoLinkText: infoLinkText.trim() || ORDER_FORM_CONFIG_DEFAULTS.infoLinkText,
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (!confirm('기본 안내(초기 문구)로 모두 바꿀까요? 저장하지 않은 편집 내용은 사라집니다.')) return;
    setSections(cloneSections(ORDER_GUIDE_DEFAULT_SECTIONS));
    setInfoLinkText(ORDER_FORM_CONFIG_DEFAULTS.infoLinkText);
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: '새 섹션', items: [''] }]);
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, title: string) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  };

  const updateItemsText = (index: number, text: string) => {
    const items = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], items: items.length ? items : [''] };
      return next;
    });
  };

  if (!token) {
    return <p className="text-gray-600">로그인이 필요합니다.</p>;
  }

  const titleCls = embedded ? 'text-base font-medium text-gray-900' : 'text-xl font-semibold text-gray-900';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className={titleCls}>안내사항설정</h2>
          ) : (
            <h1 className={titleCls}>고객 안내사항</h1>
          )}
          <p className="text-sm text-gray-500 mt-1">
            발주서 동의란 링크 문구와, 고객이{' '}
            <Link to="/info" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              /info
            </Link>{' '}
            에서 보는 안내 본문을 편집합니다. 저장 즉시 반영됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="px-3 py-2 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
          >
            기본 문구로 초기화
          </button>
          <a
            href="/info"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
          >
            고객 화면 미리보기
          </a>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 text-amber-900 text-sm rounded border border-amber-200">{error}</div>
      )}
      {savedOk && (
        <div className="p-3 bg-green-50 text-green-800 text-sm rounded border border-green-200">
          저장되었습니다.
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">불러오는 중…</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <section className="p-4 bg-white border border-gray-200 rounded">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              발주서 동의란에 보이는 링크 문구
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
              value={infoLinkText}
              onChange={(e) => setInfoLinkText(e.target.value)}
              placeholder={ORDER_FORM_CONFIG_DEFAULTS.infoLinkText}
            />
            <p className="text-xs text-gray-500 mt-2">
              고객 발주서 하단 체크박스 옆에 표시됩니다.
            </p>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-gray-900">안내 본문 (섹션별)</h2>
            <button
              type="button"
              onClick={addSection}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50"
            >
              섹션 추가
            </button>
          </div>

          {sections.map((sec, i) => (
            <section key={i} className="p-4 bg-white border border-gray-200 rounded space-y-3">
              <div className="flex items-start justify-between gap-2">
                <label className="block text-sm font-medium text-gray-700 flex-1">
                  섹션 제목
                  <input
                    type="text"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    value={sec.title}
                    onChange={(e) => updateTitle(i, e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  className="text-sm text-red-600 shrink-0 mt-7"
                >
                  삭제
                </button>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">항목 (한 줄에 한 항목)</label>
                <textarea
                  rows={Math.max(4, sec.items.length + 2)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 font-mono leading-relaxed"
                  value={sec.items.join('\n')}
                  onChange={(e) => updateItemsText(i, e.target.value)}
                  placeholder="첫 번째 안내&#10;두 번째 안내"
                />
              </div>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <span className="text-xs text-gray-500">관리자만 저장할 수 있습니다.</span>
          </div>
        </div>
      )}
    </div>
  );
}
