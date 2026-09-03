import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFormConfig, updateFormConfig } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';
import { parseGuideFromStoredContent } from '../../utils/orderGuideParse';
import { ORDER_FORM_CONFIG_DEFAULTS, orderFormConfigLine } from '../../constants/orderFormConfigDefaults';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import {
  ensureCancellationPolicyPlaceholderInSections,
  ORDER_FORM_GUIDE_PLACEHOLDERS,
  sectionTitleLooksLikeCancellation,
} from '@shared/orderFormGuidePlaceholders';
import { OrderGuideCancellationPreview } from '../../components/admin/OrderGuideCancellationPreview';
import { OrderGuideSectionCard } from '../../components/admin/OrderGuideSectionCard';
import {
  editorTextToGuideItems,
  persistGuideItems,
  sectionDraftFingerprint,
} from '../../utils/orderGuideSectionDraft';

const BTN_PRIMARY =
  'rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN_SECONDARY =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-fluid-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

function cloneSections(s: GuideSection[]): GuideSection[] {
  return s.map((sec) => ({ title: sec.title, items: [...sec.items] }));
}

function fingerprintsOf(sections: GuideSection[]): string[] {
  return sections.map((s) => sectionDraftFingerprint(s));
}

function persistSections(sections: GuideSection[]): GuideSection[] {
  return ensureCancellationPolicyPlaceholderInSections(
    sections
      .map((s) => ({
        title: s.title.trim(),
        items: persistGuideItems(s.items),
      }))
      .filter((s) => s.title || s.items.length),
  );
}

export function AdminOrderFormNoticePage({ embedded = false }: { embedded?: boolean }) {
  const token = getToken();
  const [sections, setSections] = useState<GuideSection[]>(() => cloneSections(ORDER_GUIDE_DEFAULT_SECTIONS));
  const [savedFingerprints, setSavedFingerprints] = useState<string[]>(() =>
    fingerprintsOf(ORDER_GUIDE_DEFAULT_SECTIONS),
  );
  const [infoLinkText, setInfoLinkText] = useState<string>(
    ORDER_FORM_CONFIG_DEFAULTS.infoLinkText,
  );
  const [savedInfoLink, setSavedInfoLink] = useState<string>(ORDER_FORM_CONFIG_DEFAULTS.infoLinkText);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState('');

  const applyLoaded = (next: GuideSection[], link: string) => {
    const cleaned = persistSections(next);
    setSections(cleaned);
    setSavedFingerprints(fingerprintsOf(cleaned));
    setInfoLinkText(link);
    setSavedInfoLink(link);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getFormConfig(token)
      .then((c) => {
        applyLoaded(
          parseGuideFromStoredContent(c.infoContent),
          orderFormConfigLine(c.infoLinkText, ORDER_FORM_CONFIG_DEFAULTS.infoLinkText),
        );
        setError(null);
      })
      .catch(() => {
        setError('설정을 불러오지 못했습니다. 아래 내용으로 편집·저장할 수 있습니다.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const flashSaved = (msg: string) => {
    setSavedOk(msg);
    window.setTimeout(() => setSavedOk(''), 3000);
  };

  const writeInfoContent = async (nextSections: GuideSection[]) => {
    if (!token) return;
    const trimmed = persistSections(nextSections);
    if (!trimmed.length) {
      setError('최소 한 개 섹션에 안내 문구를 입력해 주세요.');
      return null;
    }
    await updateFormConfig(token, {
      infoContent: JSON.stringify({ sections: trimmed }),
    });
    return trimmed;
  };

  const handleSaveSection = async (index: number) => {
    if (!token) return;
    setSavingKey(`section-${index}`);
    setError(null);
    try {
      const latest = persistSections(parseGuideFromStoredContent((await getFormConfig(token)).infoContent));
      const merged = cloneSections(latest);
      const local = sections[index];
      if (!local) throw new Error('섹션을 찾을 수 없습니다.');
      const persisted = {
        title: local.title.trim() || '안내',
        items: persistGuideItems(local.items),
      };
      if (index < merged.length) merged[index] = persisted;
      else merged.push(persisted);
      const saved = await writeInfoContent(merged);
      if (!saved) return;
      setSections((prev) => prev.map((s, i) => (i === index ? saved[index] ?? persisted : s)));
      setSavedFingerprints((prev) => {
        const next = [...prev];
        next[index] = sectionDraftFingerprint(saved[index] ?? persisted);
        return next;
      });
      flashSaved(`「${persisted.title}」을 저장했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveInfoLink = async () => {
    if (!token) return;
    setSavingKey('infoLink');
    setError(null);
    try {
      const next = infoLinkText.trim() || ORDER_FORM_CONFIG_DEFAULTS.infoLinkText;
      await updateFormConfig(token, { infoLinkText: next });
      setInfoLinkText(next);
      setSavedInfoLink(next);
      flashSaved('동의란 링크 문구를 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAll = async () => {
    if (!token) return;
    setSavingKey('all');
    setError(null);
    try {
      const saved = await writeInfoContent(sections);
      if (!saved) return;
      const nextLink = infoLinkText.trim() || ORDER_FORM_CONFIG_DEFAULTS.infoLinkText;
      await updateFormConfig(token, { infoLinkText: nextLink });
      applyLoaded(saved, nextLink);
      flashSaved('안내사항 전체를 저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  const resetToDefault = () => {
    if (!confirm('기본 안내(초기 문구)로 모두 바꿀까요? 저장하지 않은 편집 내용은 사라집니다.')) return;
    const next = persistSections(cloneSections(ORDER_GUIDE_DEFAULT_SECTIONS));
    setSections(next);
    setInfoLinkText(ORDER_FORM_CONFIG_DEFAULTS.infoLinkText);
  };

  const insertCancellationGuideBlock = () => {
    setSections((prev) => persistSections(cloneSections(prev)));
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: '새 섹션', items: [''] }]);
    setSavedFingerprints((prev) => [...prev, '']);
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setSavedFingerprints((prev) => prev.filter((_, i) => i !== index));
  };

  if (!token) {
    return <p className="text-gray-600">로그인이 필요합니다.</p>;
  }

  const titleCls = embedded ? 'text-base font-medium text-gray-900' : 'text-xl font-semibold text-gray-900';
  const busy = savingKey != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {embedded ? (
            <h2 className={titleCls}>안내사항설정</h2>
          ) : (
            <PageTitleWithFavorite label="고객 안내사항">
              <h1 className={titleCls}>고객 안내사항</h1>
            </PageTitleWithFavorite>
          )}
          <p className="text-sm text-gray-500 mt-1">
            섹션마다 「이 섹션 저장」을 누르면 그 섹션만 반영됩니다. 고객이{' '}
            <Link to="/info" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              /info
            </Link>{' '}
            에서 보는 안내입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resetToDefault} className={BTN_SECONDARY}>
            기본 문구로 초기화
          </button>
          <a
            href="/info"
            target="_blank"
            rel="noopener noreferrer"
            className={BTN_SECONDARY}
          >
            고객 화면 미리보기
          </a>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-amber-50 text-amber-900 text-sm rounded border border-amber-200">{error}</div>
      ) : null}
      {savedOk ? (
        <div className="p-3 bg-green-50 text-green-800 text-sm rounded border border-green-200">{savedOk}</div>
      ) : null}

      {loading ? (
        <p className="text-gray-600">불러오는 중…</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <section className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              발주서 동의란에 보이는 링크 문구
            </label>
            <textarea
              rows={3}
              className="w-full resize-y min-h-[4rem] px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              value={infoLinkText}
              onChange={(e) => setInfoLinkText(e.target.value)}
              placeholder={ORDER_FORM_CONFIG_DEFAULTS.infoLinkText}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void handleSaveInfoLink()}>
                {savingKey === 'infoLink' ? '저장 중…' : '링크 문구 저장'}
              </button>
              {infoLinkText.trim() !== savedInfoLink.trim() ? (
                <span className="text-fluid-2xs text-amber-800">수정됨</span>
              ) : null}
            </div>
          </section>

          <section className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <h2 className="text-sm font-medium text-gray-900">브랜드 위약 — 자동 반영</h2>
            <OrderGuideCancellationPreview
              token={token}
              cancellationSection={sections.find((s) => sectionTitleLooksLikeCancellation(s.title))}
            />
            <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-950">
                다른 치환코드 (자세히)
              </summary>
              <ul className="mt-2 space-y-1.5">
                {ORDER_FORM_GUIDE_PLACEHOLDERS.map((p) => (
                  <li key={p.token} className="text-xs text-gray-700">
                    <code className="rounded bg-slate-50 border border-gray-200 px-1.5 py-0.5 font-mono">
                      {p.token}
                    </code>{' '}
                    — {p.description}
                  </li>
                ))}
              </ul>
            </details>
            <button type="button" onClick={insertCancellationGuideBlock} className={BTN_SECONDARY}>
              취소·변경에 위약 코드 다시 넣기
            </button>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium text-gray-900">안내 본문 (섹션별)</h2>
            <button type="button" onClick={addSection} className={BTN_SECONDARY}>
              섹션 추가
            </button>
          </div>

          {sections.map((sec, i) => (
            <OrderGuideSectionCard
              key={i}
              section={sec}
              dirty={sectionDraftFingerprint(sec) !== (savedFingerprints[i] ?? '')}
              saving={savingKey === `section-${i}`}
              onTitleChange={(title) => {
                setSections((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i]!, title };
                  return next;
                });
              }}
              onItemsTextChange={(text) => {
                setSections((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i]!, items: editorTextToGuideItems(text) };
                  return next;
                });
              }}
              onSave={() => void handleSaveSection(i)}
              onRemove={() => removeSection(i)}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void handleSaveAll()}>
              {savingKey === 'all' ? '저장 중…' : '전체 저장'}
            </button>
            <span className="text-xs text-gray-500">각 섹션 저장과 같습니다. 관리자만 저장할 수 있습니다.</span>
          </div>
        </div>
      )}
    </div>
  );
}
