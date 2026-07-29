import { useCallback, useEffect, useState } from 'react';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import { TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS } from '@shared/tenantSignup';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import {
  cancelTenantPlanUpgradeRequest,
  createTenantPlanUpgradeRequest,
  fetchTenantPlanUpgradeRequest,
  type TenantPlanUpgradeRequestRow,
  useAdminTokenOrThrow,
} from '../../api/tenantPlanUpgrade';
import { normalizePlanId } from '@shared/tenantPlanNormalize';

type Props = {
  currentPlan: string;
  onChanged?: () => void;
};

export function TenantPlanUpgradeRequestPanel({ currentPlan, onChanged }: Props) {
  const plan = normalizePlanId(currentPlan);
  const [pending, setPending] = useState<TenantPlanUpgradeRequestRow | null>(null);
  const [requestedPlan, setRequestedPlan] = useState<TenantPlanId>('standard');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (plan !== 'free') {
      setPending(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = useAdminTokenOrThrow();
      const data = await fetchTenantPlanUpgradeRequest(token);
      setPending(data.pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [plan]);

  useEffect(() => {
    void load();
  }, [load]);

  if (plan !== 'free') return null;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = useAdminTokenOrThrow();
      const row = await createTenantPlanUpgradeRequest(token, {
        requestedPlan,
        message: message.trim() || undefined,
      });
      setPending(row);
      setMessage('');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '신청 실패');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!pending || !window.confirm('유료 전환 신청을 취소할까요?')) return;
    setSaving(true);
    setError(null);
    try {
      const token = useAdminTokenOrThrow();
      await cancelTenantPlanUpgradeRequest(token, pending.id);
      setPending(null);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <h2 className="text-fluid-sm font-semibold text-sky-950">유료 플랜 전환 신청</h2>
      <p className="mt-1 text-fluid-2xs leading-relaxed text-sky-900/80">
        현재 <strong>Free</strong> 플랜입니다. Standard 이상은 플랫폼 승인 후 7일 체험·정식 이용이 시작됩니다.
      </p>

      {loading ? <p className="mt-3 text-fluid-2xs text-slate-600">불러오는 중…</p> : null}

      {pending ? (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5">
          <p className="text-fluid-xs font-medium text-amber-900">검토 중 · {pending.requestedPlan}</p>
          {pending.message ? <p className="text-fluid-2xs text-slate-600">{pending.message}</p> : null}
          <p className="text-fluid-2xs text-slate-500">
            신청일 {new Date(pending.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void cancel()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-2xs font-semibold text-slate-700"
          >
            신청 취소
          </button>
        </div>
      ) : !loading ? (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-fluid-2xs font-medium text-slate-700">희망 플랜</span>
            <select
              value={requestedPlan}
              onChange={(e) => setRequestedPlan(e.target.value as TenantPlanId)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
            >
              {TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS.map((id: Exclude<TenantPlanId, 'free'>) => (
                <option key={id} value={id}>
                  {TENANT_PLAN_PRESENTATIONS[id].label} — {TENANT_PLAN_PRESENTATIONS[id].monthlyPriceHint}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-fluid-2xs font-medium text-slate-700">전달 메모 (선택)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-fluid-xs"
              placeholder="희망 시작 시기, 문의 사항 등"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? '접수 중…' : '유료 플랜 전환 신청'}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-fluid-2xs text-red-600">{error}</p> : null}
    </section>
  );
}
