import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToken } from '../../../../stores/auth';
import {
  createTelecrmSmsTemplate,
  deleteTelecrmSmsTemplate,
  fetchTelecrmSmsTemplates,
  uploadTelecrmSmsTemplateImage,
  type TelecrmSmsTemplateDto,
} from '../../../../api/telecrmSms';
import type { TelecrmCatalogOwnerScope } from '../../../../api/telecrm';
import { DeletePasswordModal, SettingsCard } from '../../../../components/crm/settings/DeletePasswordModal';
import { crmFieldClass } from '../../../../components/crm/crmUi';
import { TelecrmBrandSelect } from '../../../../components/crm/settings/TelecrmBrandSelect';

export function TelecrmSmsTemplateSettingsPage({
  catalogScope: catalogScopeProp,
}: {
  catalogScope?: TelecrmCatalogOwnerScope;
} = {}) {
  const [searchParams] = useSearchParams();
  const catalogScope: TelecrmCatalogOwnerScope =
    catalogScopeProp ?? (searchParams.get('catalog') === 'shared' ? 'shared' : 'personal');
  const token = getToken();
  const [brandId, setBrandId] = useState('default');
  const operatingCompanyId = catalogScope === 'shared' && brandId !== 'default' ? brandId : null;
  const [templates, setTemplates] = useState<TelecrmSmsTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ label: '', body: '', imageUrl: '' });
  const [deleteTarget, setDeleteTarget] = useState<TelecrmSmsTemplateDto | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTelecrmSmsTemplates(token, {
        includeInactive: true,
        scope: catalogScope,
        operatingCompanyId: catalogScope === 'shared' ? operatingCompanyId : undefined,
      });
      setTemplates(res.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, catalogScope, operatingCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTemplate = async () => {
    if (!token || !form.label.trim() || !form.body.trim()) return;
    setBusy(true);
    try {
      await createTelecrmSmsTemplate(token, {
        label: form.label.trim(),
        body: form.body.trim(),
        imageUrl: form.imageUrl.trim() || null,
        ownerScope: catalogScope,
        operatingCompanyId: catalogScope === 'shared' ? operatingCompanyId : null,
      });
      setForm({ label: '', body: '', imageUrl: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const onImagePick = async (file: File | null) => {
    if (!file || !token) return;
    setBusy(true);
    try {
      const url = await uploadTelecrmSmsTemplateImage(token, file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 업로드 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {catalogScope === 'shared' ? (
        <>
          <TelecrmBrandSelect token={token} value={brandId} onChange={setBrandId} />
          <p className="text-fluid-xs text-gray-600">
            업체 공유 문자 템플릿을 브랜드별로 관리합니다. <strong>업체 기본</strong>은 모든 브랜드에서
            함께 보입니다.
          </p>
        </>
      ) : null}
      <p className="text-fluid-xs text-gray-600">
        치환: {'{고객명}'} {'{연락처}'} {'{평수}'} {'{예상가}'} {'{발주서링크}'}
      </p>
      {loading ? <p className="text-fluid-sm text-gray-500">불러오는 중…</p> : null}
      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}

      <SettingsCard title="새 문자 템플릿">
        <div className="space-y-2">
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="템플릿 이름 (예: 발주서 링크 안내)"
            className={crmFieldClass}
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            placeholder="문자 본문"
            className={crmFieldClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs">
              사진 첨부
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onImagePick(e.target.files?.[0] ?? null)} />
            </label>
            {form.imageUrl ? (
              <>
                <img src={form.imageUrl} alt="" className="h-12 rounded border" />
                <button type="button" className="text-fluid-xs text-rose-600" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                  제거
                </button>
              </>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addTemplate()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>
      </SettingsCard>

      <div className="space-y-2">
        {templates.map((t) => (
          <SettingsCard key={t.id} title={t.label}>
            <p className="whitespace-pre-wrap text-fluid-xs text-gray-700">{t.body}</p>
            {t.imageUrl ? <img src={t.imageUrl} alt="" className="mt-2 h-16 rounded border object-cover" /> : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="text-fluid-xs text-rose-600"
                onClick={() => {
                  setDeleteTarget(t);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
              >
                삭제
              </button>
            </div>
          </SettingsCard>
        ))}
      </div>

      <DeletePasswordModal
        open={Boolean(deleteTarget)}
        title="문자 템플릿 삭제"
        password={deletePassword}
        error={deleteError}
        onPasswordChange={setDeletePassword}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!token || !deleteTarget) return;
          try {
            await deleteTelecrmSmsTemplate(token, deleteTarget.id, deletePassword);
            setDeleteTarget(null);
            await load();
          } catch (e) {
            setDeleteError(e instanceof Error ? e.message : '삭제 실패');
          }
        }}
      />
    </div>
  );
}
