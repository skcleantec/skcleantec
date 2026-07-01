import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  fetchAdminTeamLeaderTrainingMeta,
  uploadAdminTeamLeaderTrainingPdf,
  type TeamLeaderTrainingMeta,
} from '../../api/teamLeaderTraining';
import { isAuthSessionExpiredError } from '../../api/auth';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { isSkTenantSlug } from '@shared/skTenant';

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function AdminTeamLeaderTrainingPage() {
  const token = getToken();
  const { tenantSlug } = useTenantCapabilities();
  const skTenant = isSkTenantSlug(tenantSlug);

  const [meta, setMeta] = useState<TeamLeaderTrainingMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !skTenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const m = await fetchAdminTeamLeaderTrainingMeta(token);
      setMeta(m);
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        setErr('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      setErr(e instanceof Error ? e.message : '교육자료 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [token, skTenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async (file: File | null) => {
    if (!token || !file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    setUploading(true);
    setErr(null);
    setMsg(null);
    try {
      const m = await uploadAdminTeamLeaderTrainingPdf(token, file);
      setMeta(m);
      setMsg('교육자료를 업로드했습니다. 팀장 화면에서 바로 확인할 수 있습니다.');
    } catch (e) {
      if (isAuthSessionExpiredError(e)) {
        setErr('로그인이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      setErr(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  if (!skTenant) {
    return (
      <div className="min-w-0 w-full max-w-3xl space-y-4 pb-8">
        <h1 className="text-xl font-semibold text-gray-800">현장팀장 교육자료</h1>
        <p className="text-sm text-gray-600">SK클린텍 테넌트 전용 기능입니다.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  const updatedLabel = formatUpdatedAt(meta?.updatedAt ?? null);

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">현장팀장 교육자료</h1>
        <p className="mt-1 text-sm text-gray-500">
          팀장 GNB 이름 메뉴에 「현장팀장 교육자료」로 노출됩니다. PDF를 교체하면 팀장 화면에 즉시 반영됩니다.
        </p>
      </div>

      {err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {msg}
        </p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">등록 상태</h2>
          {meta?.available ? (
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {updatedLabel ? <li>업데이트: {updatedLabel}</li> : null}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              아직 등록된 PDF가 없습니다. 아래에서 업로드해 주세요.
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-800">PDF 교체·등록</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              void onUpload(f);
            }}
            className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-gray-500">최대 40MB · PDF만 가능 · 이전 파일은 자동으로 교체됩니다.</p>
      </section>
    </div>
  );
}
