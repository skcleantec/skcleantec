import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../../stores/auth';
import {
  getLandingContactFormConfigs,
  updateLandingContactFormConfig,
} from '../../../api/landingContact';
import type { LandingContactCustomFieldDef, LandingContactFormConfigDto } from '@shared/landingContactForm';
import { newLandingContactFieldKey } from '@shared/landingContactForm';
import { useStaffTenantSlugForLinks } from '../../../hooks/useStaffTenantSlugForLinks';
import { getContactPublicUrl } from '../../../utils/landingContactPublicUrl';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { OperatingCompanyBadge } from '../../../components/admin/OperatingCompanyBadge';
import { PageTitleWithFavorite } from '../../../components/layout/NavFavoritePageTitle';
import { LandingContactFieldEditor } from '../../../components/leads/LandingContactFieldEditor';
import { LandingContactFormPreviewModal } from '../../../components/leads/LandingContactFormPreviewModal';
import { LandingContactSourceLinksPanel } from '../../../components/leads/LandingContactSourceLinksPanel';

function cleanCustomFields(fields: LandingContactCustomFieldDef[]): LandingContactCustomFieldDef[] {
  return fields
    .filter((field) => field.label.trim())
    .map((field) => {
      const options = (field.options ?? [])
        .map((option) => {
          const children = (option.children ?? [])
            .map((child) => ({ label: child.label.trim() }))
            .filter((child) => child.label);
          return children.length > 0 ? { label: option.label.trim(), children } : { label: option.label.trim() };
        })
        .filter((option) => option.label);
      return {
        ...field,
        key: field.key.trim() || newLandingContactFieldKey(),
        label: field.label.trim(),
        options: field.type === 'select' ? options : undefined,
      };
    });
}

export function AdminLandingContactSettingsPage() {
  const token = getToken();
  const tenantSlug = useStaffTenantSlugForLinks();
  const [items, setItems] = useState<LandingContactFormConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, LandingContactFormConfigDto>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getLandingContactFormConfigs(token);
      setItems(res.items);
      const map: Record<string, LandingContactFormConfigDto> = {};
      for (const item of res.items) map[item.operatingCompanyId] = { ...item, customFields: [...item.customFields] };
      setDrafts(map);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (ocId: string, patch: Partial<LandingContactFormConfigDto>) => {
    setDrafts((prev) => ({
      ...prev,
      [ocId]: { ...prev[ocId], ...patch },
    }));
  };

  const save = async (ocId: string) => {
    if (!token) return;
    const draft = drafts[ocId];
    if (!draft) return;
    const customFields = cleanCustomFields(draft.customFields);
    const emptyChoice = customFields.find((field) => field.type === 'select' && !(field.options ?? []).length);
    if (emptyChoice) {
      setError(`「${emptyChoice.label}」에 선택지를 하나 이상 넣어 주세요.`);
      return;
    }
    setSavingId(ocId);
    setError(null);
    try {
      const saved = await updateLandingContactFormConfig(token, ocId, {
        title: draft.title,
        introText: draft.introText,
        customFields,
        isActive: draft.isActive,
      });
      setItems((prev) => prev.map((x) => (x.operatingCompanyId === ocId ? saved : x)));
      setDrafts((prev) => ({ ...prev, [ocId]: saved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const copyLink = async (slug: string, brandSlug: string) => {
    const url = getContactPublicUrl(undefined, tenantSlug, brandSlug);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug(null), 2000);
    }
  };

  const preview = previewId ? drafts[previewId] : null;

  if (loading) {
    return <p className="py-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <PageTitleWithFavorite label="문의 폼·링크" path="/admin/inquiries/leads/settings">
        <h1 className="text-xl font-semibold text-slate-900">문의 폼·링크</h1>
      </PageTitleWithFavorite>
      <p className="text-fluid-sm text-gray-600">
        아래에 있는 예전 주소는 그대로 둡니다. 채널별로 나눌 짧은 링크는 그 위에서 만듭니다.
      </p>
      <LandingContactSourceLinksPanel />
      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-8 text-center text-fluid-sm text-gray-500">
          활성 브랜드가 없습니다. 관리자 전용 → 영업 브랜드에서 먼저 등록해 주세요.
        </p>
      ) : (
        items.map((item) => {
          const draft = drafts[item.operatingCompanyId] ?? item;
          const link = getContactPublicUrl(undefined, tenantSlug, item.operatingCompanySlug);
          return (
            <section
              key={item.operatingCompanyId}
              className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <OperatingCompanyBadge
                    company={{
                      id: item.operatingCompanyId,
                      name: item.displayName || item.operatingCompanyName,
                      slug: item.operatingCompanySlug,
                    }}
                  />
                  <p className="mt-1 text-fluid-2xs text-slate-500">예전 주소</p>
                  <p className="mt-0.5 break-all font-mono text-fluid-xs text-gray-700">{link}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyLink(item.operatingCompanySlug, item.operatingCompanySlug)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  {copiedSlug === item.operatingCompanySlug ? '복사됨' : '링크 복사'}
                </button>
              </div>

              <label className="mb-3 flex items-center gap-2 text-fluid-sm">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => updateDraft(item.operatingCompanyId, { isActive: e.target.checked })}
                />
                문의 접수 활성
              </label>

              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-fluid-xs font-medium text-gray-700">페이지 제목</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
                    value={draft.title ?? ''}
                    onChange={(e) => updateDraft(item.operatingCompanyId, { title: e.target.value || null })}
                    placeholder={`${item.displayName} 문의하기`}
                  />
                  <p className="mt-1 text-fluid-2xs text-gray-500">
                    비워 두면 고객 화면 상단에는 「문의하기」만 표시됩니다. 브랜드명을 넣으려면 직접 입력하세요.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-fluid-xs font-medium text-gray-700">안내 문구</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm"
                    rows={3}
                    value={draft.introText ?? ''}
                    onChange={(e) => updateDraft(item.operatingCompanyId, { introText: e.target.value || null })}
                    placeholder="랜딩에서 넘어온 고객에게 보여 줄 안내"
                  />
                </div>
              </div>

              <div className="mb-3">
                <LandingContactFieldEditor
                  fields={draft.customFields}
                  onChange={(customFields) => updateDraft(item.operatingCompanyId, { customFields })}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewId(item.operatingCompanyId)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-fluid-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  미리보기
                </button>
                <button
                  type="button"
                  disabled={savingId === item.operatingCompanyId}
                  onClick={() => void save(item.operatingCompanyId)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  {savingId === item.operatingCompanyId ? '저장 중…' : '저장'}
                </button>
              </div>
            </section>
          );
        })
      )}
      {preview ? (
        <LandingContactFormPreviewModal
          open
          title={preview.title}
          introText={preview.introText}
          fields={preview.customFields}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </div>
  );
}
