import { useCallback, useEffect, useState } from 'react';
import {
  fetchTelecrmSoomgoBrandConfigs,
  updateTelecrmSoomgoBrandConfig,
  type TelecrmSoomgoBrandConfigDto,
} from '../../../api/telecrmSoomgo';
import { getToken } from '../../../stores/auth';
import {
  emptyOperatingCompanySoomgoForm,
  OperatingCompanySoomgoFields,
  type OperatingCompanySoomgoForm,
} from '../../admin/OperatingCompanySoomgoFields';
import { DeletePasswordModal } from './DeletePasswordModal';

type BrandDraft = {
  brand: TelecrmSoomgoBrandConfigDto;
  form: OperatingCompanySoomgoForm;
};

function draftFromBrand(brand: TelecrmSoomgoBrandConfigDto): BrandDraft {
  return {
    brand,
    form: emptyOperatingCompanySoomgoForm({
      email: brand.soomgo.email,
      enabled: brand.soomgo.enabled,
      hasPassword: brand.soomgo.hasPassword,
    }),
  };
}

/** 텔레CRM 설정 — 영업 브랜드별 숨고 계정 */
export function TelecrmBrandSoomgoSettingsSection() {
  const token = getToken();
  const [drafts, setDrafts] = useState<BrandDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pwdModal, setPwdModal] = useState<{ brandId: string; password: string } | null>(null);
  const [actorPassword, setActorPassword] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchTelecrmSoomgoBrandConfigs(token);
      setDrafts(items.map(draftFromBrand));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBrand = async (brandId: string, confirmedPassword?: string) => {
    if (!token) return;
    const draft = drafts.find((d) => d.brand.id === brandId);
    if (!draft) return;
    const { form } = draft;
    const passwordToSend = form.password.trim() || undefined;
    if (!form.hasPassword && !passwordToSend) {
      setError('숨고 비밀번호를 입력해 주세요.');
      return;
    }
    if (passwordToSend && !confirmedPassword?.trim()) {
      setError(null);
      setPwdModal({ brandId, password: passwordToSend });
      return;
    }
    setSavingId(brandId);
    setError(null);
    setMsg(null);
    try {
      const updated = await updateTelecrmSoomgoBrandConfig(token, brandId, {
        email: form.email,
        password: passwordToSend,
        enabled: form.enabled,
        actorPassword: confirmedPassword,
      });
      setDrafts((prev) =>
        prev.map((d) => (d.brand.id === brandId ? draftFromBrand(updated) : d)),
      );
      setMsg(`${updated.displayName} 브랜드 숨고 계정을 저장했습니다.`);
      window.setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSavingId(null);
      setPwdModal(null);
      setActorPassword('');
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-gray-500">브랜드 목록 불러오는 중…</p>;
  }

  if (drafts.length === 0) {
    return (
      <p className="text-fluid-sm text-gray-500">
        등록된 영업 브랜드가 없습니다. 관리자 → 영업 브랜드에서 먼저 브랜드를 추가해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-fluid-sm text-green-800">
          {msg}
        </p>
      ) : null}
      {error && !pwdModal ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p className="text-fluid-sm text-gray-600">
        작업 브랜드에 숨고 계정이 있으면 아래 <strong>업체 공통</strong> 계정보다 우선합니다. 비우면
        공통 계정을 사용합니다.
      </p>
      {drafts.map((draft, index) => (
        <div
          key={draft.brand.id}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-fluid-sm font-semibold text-gray-900">{draft.brand.displayName}</p>
              <p className="text-[11px] text-gray-500">
                {draft.brand.slug}
                {!draft.brand.isActive ? ' · 비활성' : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={savingId === draft.brand.id}
              onClick={() => void saveBrand(draft.brand.id)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-sm text-white disabled:opacity-50"
            >
              {savingId === draft.brand.id ? '저장 중…' : '저장'}
            </button>
          </div>
          <OperatingCompanySoomgoFields
            idPrefix={`crm-brand-${index}`}
            value={draft.form}
            onChange={(form) =>
              setDrafts((prev) =>
                prev.map((d) => (d.brand.id === draft.brand.id ? { ...d, form } : d)),
              )
            }
          />
        </div>
      ))}
      <DeletePasswordModal
        open={pwdModal != null}
        title="브랜드 숨고 계정 저장 확인"
        description="숨고 비밀번호를 저장하려면 텔레CRM 로그인 비밀번호를 입력해 주세요."
        confirmLabel="저장"
        confirmBusyLabel="저장 중…"
        variant="primary"
        busy={savingId != null}
        password={actorPassword}
        error={pwdModal ? error : null}
        onPasswordChange={setActorPassword}
        onConfirm={() => pwdModal && void saveBrand(pwdModal.brandId, actorPassword)}
        onClose={() => {
          setPwdModal(null);
          setActorPassword('');
          setError(null);
        }}
      />
    </div>
  );
}
