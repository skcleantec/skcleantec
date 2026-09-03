import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getFormConfig, updateFormConfig, updateBrandCancellationGuide } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';
import { ORDER_GUIDE_DEFAULT_SECTIONS } from '../../constants/orderInfoDefaultSections';
import { parseGuideFromStoredContent } from '../../utils/orderGuideParse';
import { ORDER_FORM_CONFIG_DEFAULTS, orderFormConfigLine } from '../../constants/orderFormConfigDefaults';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import {
  ensureCancellationPolicyPlaceholderInSections,
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  ORDER_FORM_GUIDE_PLACEHOLDERS,
  sectionTitleLooksLikeCancellation,
} from '@shared/orderFormGuidePlaceholders';
import { OrderGuideCancellationPreview } from '../../components/admin/OrderGuideCancellationPreview';
import { OrderGuideSectionCard } from '../../components/admin/OrderGuideSectionCard';
import { OrderGuideBrandScopeBar } from '../../components/admin/OrderGuideBrandScopeBar';
import {
  editorTextToGuideItems,
  persistGuideItems,
  sectionDraftFingerprint,
} from '../../utils/orderGuideSectionDraft';
import { useOperatingCompanies, invalidateOperatingCompaniesCache } from '../../hooks/useOperatingCompanies';

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

function defaultCancelSection(from?: GuideSection): GuideSection {
  return {
    title: from?.title.trim() || '취소·변경 안내',
    items: from?.items.length ? [...from.items] : [GUIDE_PLACEHOLDER_CANCELLATION_POLICY],
  };
}

export function AdminOrderFormNoticePage({ embedded = false }: { embedded?: boolean }) {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeId = searchParams.get('guideBrand')?.trim() || 'common';
  const brands = useOperatingCompanies(token);
  const activeBrands = useMemo(() => brands.filter((b) => b.isActive), [brands]);
  const selectedBrand = activeBrands.find((b) => b.id === scopeId) ?? null;
  const isBrandScope = Boolean(selectedBrand);

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
  const [overrideById, setOverrideById] = useState<Record<string, string[] | null>>({});
  const [brandDraft, setBrandDraft] = useState<GuideSection>(() => defaultCancelSection());
  const [brandSavedFp, setBrandSavedFp] = useState('');

  const commonCancel = sections.find((s) => sectionTitleLooksLikeCancellation(s.title));
  const commonCancelKey = commonCancel ? sectionDraftFingerprint(commonCancel) : '';

  useEffect(() => {
    setOverrideById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of brands) {
        if (b.id in next) continue;
        next[b.id] = b.config.cancellationGuideItems?.length
          ? [...b.config.cancellationGuideItems]
          : null;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [brands]);

  useEffect(() => {
    const brand = activeBrands.find((b) => b.id === scopeId);
    if (!brand) return;
    const override = overrideById[brand.id];
    const fromOverride = override?.length ? { title: '취소·변경 안내', items: [...override] } : null;
    const common = sections.find((s) => sectionTitleLooksLikeCancellation(s.title));
    const next = defaultCancelSection(fromOverride ?? common);
    setBrandDraft(next);
    setBrandSavedFp(sectionDraftFingerprint(next));
  }, [scopeId, overrideById, commonCancelKey, activeBrands, sections]);

  const setGuideBrand = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (embedded) next.set('panel', 'guide');
    if (id === 'common') next.delete('guideBrand');
    else next.set('guideBrand', id);
    setSearchParams(next, { replace: true });
  };

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

  const handleSaveBrandGuide = async () => {
    if (!token || !selectedBrand) return;
    setSavingKey('brand-guide');
    setError(null);
    try {
      const items = persistGuideItems(brandDraft.items);
      if (!items.length) {
        setError('취소·변경 안내 문구를 한 줄 이상 입력해 주세요.');
        return;
      }
      const saved = await updateBrandCancellationGuide(token, selectedBrand.id, items);
      invalidateOperatingCompaniesCache();
      const nextItems = saved.cancellationGuideItems ?? items;
      const nextSec = { title: brandDraft.title.trim() || '취소·변경 안내', items: nextItems };
      setBrandDraft(nextSec);
      setBrandSavedFp(sectionDraftFingerprint(nextSec));
      setOverrideById((prev) => ({ ...prev, [selectedBrand.id]: nextItems }));
      flashSaved(`「${selectedBrand.displayName}」 취소·변경 안내를 저장했습니다.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleClearBrandGuide = async () => {
    if (!token || !selectedBrand) return;
    if (!confirm('이 브랜드는 다시 공통 취소·변경 문구를 사용합니다. 계속할까요?')) return;
    setSavingKey('brand-clear');
    setError(null);
    try {
      await updateBrandCancellationGuide(token, selectedBrand.id, null);
      invalidateOperatingCompaniesCache();
      const next = defaultCancelSection(commonCancel);
      setBrandDraft(next);
      setBrandSavedFp(sectionDraftFingerprint(next));
      setOverrideById((prev) => ({ ...prev, [selectedBrand.id]: null }));
      flashSaved('공통 문구를 사용합니다.');
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
    if (isBrandScope) {
      await handleSaveBrandGuide();
      return;
    }
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
    if (isBrandScope) return;
    if (!confirm('기본 안내(초기 문구)로 모두 바꿀까요? 저장하지 않은 편집 내용은 사라집니다.')) return;
    const next = persistSections(cloneSections(ORDER_GUIDE_DEFAULT_SECTIONS));
    setSections(next);
    setInfoLinkText(ORDER_FORM_CONFIG_DEFAULTS.infoLinkText);
  };

  const insertCancellationGuideBlock = () => {
    if (isBrandScope) {
      setBrandDraft((prev) => {
        const items = persistGuideItems(prev.items);
        if (items.some((l) => l.includes(GUIDE_PLACEHOLDER_CANCELLATION_POLICY))) return prev;
        return { ...prev, items: [GUIDE_PLACEHOLDER_CANCELLATION_POLICY, ...items] };
      });
      return;
    }
    setSections((prev) => persistSections(cloneSections(prev)));
  };

  const addSection = () => {
    if (isBrandScope) return;
    setSections((prev) => [...prev, { title: '새 섹션', items: [''] }]);
    setSavedFingerprints((prev) => [...prev, '']);
  };

  const removeSection = (index: number) => {
    if (isBrandScope) return;
    setSections((prev) => prev.filter((_, i) => i !== index));
    setSavedFingerprints((prev) => prev.filter((_, i) => i !== index));
  };

  if (!token) {
    return <p className="text-gray-600">로그인이 필요합니다.</p>;
  }

  const titleCls = embedded ? 'text-base font-medium text-gray-900' : 'text-xl font-semibold text-gray-900';
  const busy = savingKey != null;
  const infoHref = selectedBrand
    ? `/info?brand=${encodeURIComponent(selectedBrand.slug)}`
    : '/info';
  const previewSection = isBrandScope ? brandDraft : commonCancel;
  const visibleSections = isBrandScope ? [brandDraft] : sections;
  const brandHasOverride = selectedBrand ? Boolean(overrideById[selectedBrand.id]?.length) : false;

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
            <Link to={infoHref} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              /info
            </Link>{' '}
            에서 보는 안내입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isBrandScope ? (
            <button type="button" onClick={resetToDefault} className={BTN_SECONDARY}>
              기본 문구로 초기화
            </button>
          ) : null}
          <a
            href={infoHref}
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
          <OrderGuideBrandScopeBar
            brands={activeBrands.map((b) => ({
              id: b.id,
              displayName: b.displayName,
              hasOverride: Boolean(overrideById[b.id]?.length),
            }))}
            scopeId={selectedBrand?.id ?? 'common'}
            onChange={setGuideBrand}
          />

          {!isBrandScope ? (
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
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs text-gray-700 leading-snug">
              {selectedBrand?.displayName}만 취소·변경 문구를 다르게 합니다. 다른 섹션은 공통을 씁니다.
              {brandHasOverride ? ' 지금 이 브랜드는 별도 문구입니다.' : ' 아직 공통 문구입니다. 저장하면 이 브랜드만 바뀝니다.'}
            </p>
          )}

          <section className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <h2 className="text-sm font-medium text-gray-900">브랜드 위약 — 자동 반영</h2>
            <OrderGuideCancellationPreview
              token={token}
              cancellationSection={previewSection}
              previewBrand={
                selectedBrand
                  ? {
                      displayName: selectedBrand.displayName,
                      cancellationPolicy: selectedBrand.config.cancellationPolicy,
                    }
                  : null
              }
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
            <h2 className="text-base font-medium text-gray-900">
              {isBrandScope ? '취소·변경 안내 (이 브랜드)' : '안내 본문 (섹션별)'}
            </h2>
            {!isBrandScope ? (
              <button type="button" onClick={addSection} className={BTN_SECONDARY}>
                섹션 추가
              </button>
            ) : brandHasOverride ? (
              <button type="button" onClick={() => void handleClearBrandGuide()} className={BTN_SECONDARY} disabled={busy}>
                {savingKey === 'brand-clear' ? '처리 중…' : '공통 문구 사용'}
              </button>
            ) : null}
          </div>

          {visibleSections.map((sec, i) => (
            <OrderGuideSectionCard
              key={isBrandScope ? `brand-${selectedBrand?.id}` : i}
              section={sec}
              dirty={
                isBrandScope
                  ? sectionDraftFingerprint(brandDraft) !== brandSavedFp
                  : sectionDraftFingerprint(sec) !== (savedFingerprints[i] ?? '')
              }
              saving={savingKey === (isBrandScope ? 'brand-guide' : `section-${i}`)}
              onTitleChange={(title) => {
                if (isBrandScope) {
                  setBrandDraft((prev) => ({ ...prev, title }));
                  return;
                }
                setSections((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i]!, title };
                  return next;
                });
              }}
              onItemsTextChange={(text) => {
                const items = editorTextToGuideItems(text);
                if (isBrandScope) {
                  setBrandDraft((prev) => ({ ...prev, items }));
                  return;
                }
                setSections((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i]!, items };
                  return next;
                });
              }}
              canRemove={!isBrandScope}
              onSave={() => void (isBrandScope ? handleSaveBrandGuide() : handleSaveSection(i))}
              onRemove={() => removeSection(i)}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void handleSaveAll()}>
              {savingKey === 'all' || savingKey === 'brand-guide' ? '저장 중…' : isBrandScope ? '이 브랜드 저장' : '전체 저장'}
            </button>
            <span className="text-xs text-gray-500">
              {isBrandScope
                ? '이 브랜드 발주서·안내 페이지에만 적용됩니다.'
                : '각 섹션 저장과 같습니다. 관리자만 저장할 수 있습니다.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
