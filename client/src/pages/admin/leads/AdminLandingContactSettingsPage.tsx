import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToken } from '../../../stores/auth';
import {
  getLandingContactFormConfigs,
  updateLandingContactFormConfig,
} from '../../../api/landingContact';
import type { LandingContactCustomFieldDef, LandingContactFormConfigDto } from '@shared/landingContactForm';
import { useStaffTenantSlugForLinks } from '../../../hooks/useStaffTenantSlugForLinks';
import { getContactPublicUrl } from '../../../utils/landingContactPublicUrl';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { OperatingCompanyBadge } from '../../../components/admin/OperatingCompanyBadge';

const FIELD_TYPES: LandingContactCustomFieldDef['type'][] = ['text', 'textarea', 'tel', 'email', 'number'];

function emptyField(): LandingContactCustomFieldDef {
  return { key: '', label: '', type: 'text', required: false };
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

  const updateCustomField = (ocId: string, index: number, patch: Partial<LandingContactCustomFieldDef>) => {
    setDrafts((prev) => {
      const d = prev[ocId];
      if (!d) return prev;
      const fields = [...d.customFields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, [ocId]: { ...d, customFields: fields } };
    });
  };

  const addCustomField = (ocId: string) => {
    setDrafts((prev) => {
      const d = prev[ocId];
      if (!d || d.customFields.length >= 20) return prev;
      return { ...prev, [ocId]: { ...d, customFields: [...d.customFields, emptyField()] } };
    });
  };

  const removeCustomField = (ocId: string, index: number) => {
    setDrafts((prev) => {
      const d = prev[ocId];
      if (!d) return prev;
      return {
        ...prev,
        [ocId]: { ...d, customFields: d.customFields.filter((_, i) => i !== index) },
      };
    });
  };

  const save = async (ocId: string) => {
    if (!token) return;
    const draft = drafts[ocId];
    if (!draft) return;
    setSavingId(ocId);
    setError(null);
    try {
      const saved = await updateLandingContactFormConfig(token, ocId, {
        title: draft.title,
        introText: draft.introText,
        customFields: draft.customFields.filter((f) => f.key.trim() && f.label.trim()),
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

  if (loading) {
    return <p className="py-8 text-center text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-sm text-gray-600">
          브랜드마다 문의 링크가 생성됩니다. 랜딩 페이지 「문의하기」 버튼에 아래 URL을 연결하세요.{' '}
          <Link to="/admin/inquiries/leads" className="font-medium text-sky-700 hover:underline">
            문의내역
          </Link>
        </p>
      </div>
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
                  <p className="mt-2 break-all font-mono text-fluid-xs text-gray-700">{link}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyLink(item.operatingCompanySlug, item.operatingCompanySlug)}
                  className="shrink-0 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-fluid-xs font-medium text-sky-900 hover:bg-sky-100"
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
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-fluid-sm font-semibold text-gray-900">추가 입력 항목</p>
                  <button
                    type="button"
                    onClick={() => addCustomField(item.operatingCompanyId)}
                    className="text-fluid-xs font-medium text-sky-700 hover:underline"
                  >
                    + 항목 추가
                  </button>
                </div>
                <p className="mb-2 text-fluid-2xs text-gray-500">
                  성함·연락처·문의 내용은 기본 제공됩니다. 평수·주소 등 추가 항목만 설정하세요.
                </p>
                <div className="space-y-2">
                  {draft.customFields.map((field, idx) => (
                    <div
                      key={idx}
                      className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3 sm:grid-cols-12"
                    >
                      <input
                        className="rounded border border-gray-200 px-2 py-1.5 text-fluid-xs sm:col-span-2"
                        placeholder="key (영문)"
                        value={field.key}
                        onChange={(e) =>
                          updateCustomField(item.operatingCompanyId, idx, {
                            key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                          })
                        }
                      />
                      <input
                        className="rounded border border-gray-200 px-2 py-1.5 text-fluid-xs sm:col-span-3"
                        placeholder="라벨"
                        value={field.label}
                        onChange={(e) => updateCustomField(item.operatingCompanyId, idx, { label: e.target.value })}
                      />
                      <select
                        className="rounded border border-gray-200 px-2 py-1.5 text-fluid-xs sm:col-span-2"
                        value={field.type}
                        onChange={(e) =>
                          updateCustomField(item.operatingCompanyId, idx, {
                            type: e.target.value as LandingContactCustomFieldDef['type'],
                          })
                        }
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-fluid-2xs sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={field.required === true}
                          onChange={(e) =>
                            updateCustomField(item.operatingCompanyId, idx, { required: e.target.checked })
                          }
                        />
                        필수
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(item.operatingCompanyId, idx)}
                        className="text-fluid-2xs text-red-600 sm:col-span-1"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={savingId === item.operatingCompanyId}
                onClick={() => void save(item.operatingCompanyId)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingId === item.operatingCompanyId ? '저장 중…' : '저장'}
              </button>
            </section>
          );
        })
      )}
    </div>
  );
}
