import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** 공통 계정과 다른 브랜드만 — 기본 브랜드(SK 등)는 별도 입력 불필요 */
export function TelecrmBrandSoomgoSettingsSection() {
  const token = getToken();
  const [allBrands, setAllBrands] = useState<TelecrmSoomgoBrandConfigDto[]>([]);
  const [drafts, setDrafts] = useState<BrandDraft[]>([]);
  const [addBrandId, setAddBrandId] = useState('');
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
      setAllBrands(items);
      const configured = items.filter((b) => b.soomgo.configured);
      setDrafts(configured.map(draftFromBrand));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const brandsAvailableToAdd = useMemo(() => {
    const shownIds = new Set(drafts.map((d) => d.brand.id));
    return allBrands.filter(
      (b) =>
        !shownIds.has(b.id) &&
        !b.soomgo.configured &&
        b.isActive &&
        !b.isDefault,
    );
  }, [allBrands, drafts]);

  const addBrandDraft = () => {
    const brand = allBrands.find((b) => b.id === addBrandId);
    if (!brand) return;
    setDrafts((prev) => [...prev, draftFromBrand(brand)]);
    setAddBrandId('');
  };

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
      setAllBrands((prev) => prev.map((b) => (b.id === brandId ? updated : b)));
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

  const clearBrandOverride = async (brandId: string) => {
    if (!token) return;
    setSavingId(brandId);
    setError(null);
    try {
      await updateTelecrmSoomgoBrandConfig(token, brandId, {
        email: '',
        password: '',
        enabled: false,
      });
      setDrafts((prev) => prev.filter((d) => d.brand.id !== brandId));
      await load();
      setMsg('브랜드별 계정을 제거했습니다. 업체 공통 계정을 사용합니다.');
      window.setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제거 실패');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <p className="text-fluid-sm text-gray-500">브랜드 목록 불러오는 중…</p>;
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
        <strong>업체 공통</strong> 숨고 계정과 다른 계정을 쓰는 브랜드만 등록합니다. 기본 브랜드·공통과
        같은 계정은 여기에 넣지 않아도 됩니다.
      </p>

      {drafts.length === 0 ? (
        <p className="text-fluid-sm text-gray-500 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center">
          별도 숨고 계정이 필요한 브랜드가 없습니다.
        </p>
      ) : (
        drafts.map((draft, index) => (
          <div
            key={draft.brand.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-fluid-sm font-semibold text-gray-900">{draft.brand.displayName}</p>
                <p className="text-[11px] text-gray-500">{draft.brand.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingId === draft.brand.id}
                  onClick={() => void clearBrandOverride(draft.brand.id)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-fluid-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  공통 계정 사용
                </button>
                <button
                  type="button"
                  disabled={savingId === draft.brand.id}
                  onClick={() => void saveBrand(draft.brand.id)}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-sm text-white disabled:opacity-50"
                >
                  {savingId === draft.brand.id ? '저장 중…' : '저장'}
                </button>
              </div>
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
        ))
      )}

      {brandsAvailableToAdd.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">다른 숨고 계정이 필요한 브랜드</span>
            <select
              value={addBrandId}
              onChange={(e) => setAddBrandId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-fluid-sm"
            >
              <option value="">브랜드 선택…</option>
              {brandsAvailableToAdd.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName} ({b.slug})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!addBrandId}
            onClick={addBrandDraft}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>
      ) : null}

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
