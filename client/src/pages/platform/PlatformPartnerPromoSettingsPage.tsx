import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  createPlatformPartnerPromo,
  deletePlatformPartnerPromo,
  fetchPlatformPartnerPromos,
  reorderPlatformPartnerPromos,
  updatePlatformPartnerPromo,
  uploadPlatformPartnerPromoImage,
  type PlatformPromoAdminItem,
  type PlatformPromoUpsertBody,
} from '../../api/platformPartnerPromo';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import {
  PLATFORM_PROMO_DESKTOP_SPEC,
  PLATFORM_PROMO_MOBILE_SPEC,
  platformPromoImageHint,
} from '@shared/platformPromoImageSpec';

type FormState = {
  title: string;
  mobileImageUrl: string;
  desktopImageUrl: string;
  linkUrl: string;
  linkTarget: '_blank' | '_self';
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showOnMobile: boolean;
  showOnDesktop: boolean;
  showToExternalPartner: boolean;
  showToTenantStaff: boolean;
};

const emptyForm = (): FormState => ({
  title: '',
  mobileImageUrl: '',
  desktopImageUrl: '',
  linkUrl: '',
  linkTarget: '_blank',
  startsAt: '',
  endsAt: '',
  isActive: true,
  showOnMobile: true,
  showOnDesktop: true,
  showToExternalPartner: true,
  showToTenantStaff: true,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formFromItem(item: PlatformPromoAdminItem): FormState {
  return {
    title: item.title,
    mobileImageUrl: item.mobileImageUrl,
    desktopImageUrl: item.desktopImageUrl,
    linkUrl: item.linkUrl ?? '',
    linkTarget: item.linkTarget === '_self' ? '_self' : '_blank',
    startsAt: toLocalInput(item.startsAt),
    endsAt: toLocalInput(item.endsAt),
    isActive: item.isActive,
    showOnMobile: item.showOnMobile,
    showOnDesktop: item.showOnDesktop,
    showToExternalPartner: item.showToExternalPartner,
    showToTenantStaff: item.showToTenantStaff,
  };
}

function toIsoOrNull(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formToBody(form: FormState): PlatformPromoUpsertBody {
  return {
    title: form.title.trim(),
    mobileImageUrl: form.mobileImageUrl.trim(),
    desktopImageUrl: form.desktopImageUrl.trim(),
    linkUrl: form.linkUrl.trim() || null,
    linkTarget: form.linkTarget,
    startsAt: toIsoOrNull(form.startsAt),
    endsAt: toIsoOrNull(form.endsAt),
    isActive: form.isActive,
    showOnMobile: form.showOnMobile,
    showOnDesktop: form.showOnDesktop,
    showToExternalPartner: form.showToExternalPartner,
    showToTenantStaff: form.showToTenantStaff,
  };
}

function ImageUploadField({
  label,
  hint,
  url,
  uploading,
  onUpload,
  previewAspect = 'auto',
}: {
  label: string;
  hint: string;
  url: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  previewAspect?: 'auto' | '5/2';
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void onUpload(file);
  };
  return (
    <div className="space-y-1.5">
      <span className="text-fluid-xs font-semibold text-slate-700">{label}</span>
      <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>
      {url ? (
        <img
          src={url}
          alt=""
          className={
            previewAspect === '5/2'
              ? 'aspect-[5/2] w-full max-w-md rounded-lg border border-slate-200 object-cover bg-slate-50'
              : 'max-h-32 rounded-lg border border-slate-200 object-contain bg-slate-50'
          }
        />
      ) : null}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50">
        <input type="file" accept="image/*" className="sr-only" onChange={onChange} disabled={uploading} />
        {uploading ? '업로드 중…' : url ? '이미지 교체' : '이미지 선택'}
      </label>
    </div>
  );
}

export function PlatformPartnerPromoSettingsPage() {
  const [items, setItems] = useState<PlatformPromoAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchPlatformPartnerPromos());
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (item: PlatformPromoAdminItem) => {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = formToBody(form);
      if (!body.showToExternalPartner && !body.showToTenantStaff) {
        throw new Error('노출 대상을 하나 이상 선택해 주세요.');
      }
      if (editingId) {
        await updatePlatformPartnerPromo(editingId, body);
        setMessage('수정했습니다.');
      } else {
        await createPlatformPartnerPromo(body);
        setMessage('추가했습니다.');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('이 배너를 삭제할까요?')) return;
    try {
      await deletePlatformPartnerPromo(id);
      setMessage('삭제했습니다.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    const [row] = reordered.splice(idx, 1);
    reordered.splice(next, 0, row!);
    setItems(reordered);
    try {
      await reorderPlatformPartnerPromos(reordered.map((x) => x.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '순서 저장 실패');
      await load();
    }
  };

  const uploadMobile = async (file: File) => {
    setUploadingMobile(true);
    try {
      const url = await uploadPlatformPartnerPromoImage(file);
      setForm((f) => ({ ...f, mobileImageUrl: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploadingMobile(false);
    }
  };

  const uploadDesktop = async (file: File) => {
    setUploadingDesktop(true);
    try {
      const url = await uploadPlatformPartnerPromoImage(file);
      setForm((f) => ({ ...f, desktopImageUrl: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploadingDesktop(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-fluid-lg font-bold text-slate-900">타업체·테넌트 홍보 배너</h1>
          <p className="mt-1 text-fluid-xs text-slate-600">
            타업체·테넌트 대시보드에 청소비서 안내 배너를 게시합니다. 모바일·PC 모두 가로형(5:2) 비율로
            업로드해 주세요.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={openCreate}>
          + 배너 추가
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">{error}</div> : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-800">{message}</div>
      ) : null}

      <div className={CARD_SECTION}>
        {loading ? (
          <p className="text-fluid-sm text-slate-500">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-fluid-sm text-slate-500">등록된 배너가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-fluid-xs">
              <thead>
                <tr className="border-b border-slate-200 text-center text-slate-600">
                  <th className="px-2 py-2">순서</th>
                  <th className="px-2 py-2">제목</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">노출</th>
                  <th className="px-2 py-2">기간</th>
                  <th className="px-2 py-2">미리보기</th>
                  <th className="px-2 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex gap-1">
                        <button type="button" className={BTN_SECONDARY} disabled={i === 0} onClick={() => void move(item.id, -1)}>
                          ↑
                        </button>
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          disabled={i === items.length - 1}
                          onClick={() => void move(item.id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-2 text-center" title={item.title}>
                      {item.title}
                    </td>
                    <td className="px-2 py-2 text-center">{item.scheduleStatus ?? '—'}</td>
                    <td className="px-2 py-2 text-center text-[11px]">
                      {item.showToExternalPartner ? '타업체' : ''}
                      {item.showToExternalPartner && item.showToTenantStaff ? ' · ' : ''}
                      {item.showToTenantStaff ? '테넌트' : ''}
                    </td>
                    <td className="px-2 py-2 text-center text-[11px] tabular-nums">
                      {item.startsAt ? new Date(item.startsAt).toLocaleString('ko-KR') : '즉시'}
                      <br />~ {item.endsAt ? new Date(item.endsAt).toLocaleString('ko-KR') : '무기한'}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex gap-2">
                        <img src={item.mobileImageUrl} alt="" className="h-10 w-20 rounded object-cover ring-1 ring-slate-200" />
                        <img src={item.desktopImageUrl} alt="" className="h-10 w-20 rounded object-cover ring-1 ring-slate-200" />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex flex-wrap justify-center gap-1">
                        <button type="button" className={BTN_SECONDARY} onClick={() => openEdit(item)}>
                          수정
                        </button>
                        <button type="button" className={BTN_SECONDARY} onClick={() => void remove(item.id)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <h2 className="text-fluid-base font-bold text-slate-900">{editingId ? '배너 수정' : '배너 추가'}</h2>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1">
                <span className="text-fluid-xs font-semibold text-slate-700">관리 제목</span>
                <input
                  className={INPUT_BASE}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="예: 2026 봄 프로모"
                />
              </label>
              <ImageUploadField
                label="모바일 이미지"
                hint={`${platformPromoImageHint(PLATFORM_PROMO_MOBILE_SPEC)} 타업체 상단 롤링·테넌트 모바일.`}
                url={form.mobileImageUrl}
                uploading={uploadingMobile}
                onUpload={uploadMobile}
                previewAspect="5/2"
              />
              <ImageUploadField
                label="PC 이미지"
                hint={`${platformPromoImageHint(PLATFORM_PROMO_DESKTOP_SPEC)} 테넌트 대시보드 우측·타업체 PC.`}
                url={form.desktopImageUrl}
                uploading={uploadingDesktop}
                onUpload={uploadDesktop}
                previewAspect="5/2"
              />
              <label className="block space-y-1">
                <span className="text-fluid-xs font-semibold text-slate-700">링크 (https)</span>
                <input
                  className={INPUT_BASE}
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  placeholder="https://www.cbiseo.com/…"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-fluid-xs font-semibold text-slate-700">게시 시작</span>
                  <input
                    type="datetime-local"
                    className={INPUT_BASE}
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-fluid-xs font-semibold text-slate-700">게시 종료</span>
                  <input
                    type="datetime-local"
                    className={INPUT_BASE}
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  />
                </label>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-fluid-xs font-semibold text-slate-700">노출 대상</legend>
                <label className="flex items-center gap-2 text-fluid-xs">
                  <input
                    type="checkbox"
                    checked={form.showToExternalPartner}
                    onChange={(e) => setForm((f) => ({ ...f, showToExternalPartner: e.target.checked }))}
                  />
                  타업체 (/team)
                </label>
                <label className="flex items-center gap-2 text-fluid-xs">
                  <input
                    type="checkbox"
                    checked={form.showToTenantStaff}
                    onChange={(e) => setForm((f) => ({ ...f, showToTenantStaff: e.target.checked }))}
                  />
                  테넌트 대시보드 (/admin/dashboard)
                </label>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-fluid-xs font-semibold text-slate-700">노출 기기</legend>
                <label className="flex items-center gap-2 text-fluid-xs">
                  <input
                    type="checkbox"
                    checked={form.showOnMobile}
                    onChange={(e) => setForm((f) => ({ ...f, showOnMobile: e.target.checked }))}
                  />
                  모바일 (롤링 배너)
                </label>
                <label className="flex items-center gap-2 text-fluid-xs">
                  <input
                    type="checkbox"
                    checked={form.showOnDesktop}
                    onChange={(e) => setForm((f) => ({ ...f, showOnDesktop: e.target.checked }))}
                  />
                  PC (대시보드 가로형 5:2)
                </label>
                <label className="flex items-center gap-2 text-fluid-xs">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  게시 활성
                </label>
              </fieldset>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => setModalOpen(false)}>
                취소
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={() => void save()}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
