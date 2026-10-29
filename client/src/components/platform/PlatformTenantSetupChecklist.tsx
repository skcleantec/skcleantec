import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TENANT_FEATURE_MODULES, TENANT_PLANS, type TenantFeatureModuleId } from '@shared/tenantFeatureModules';
import { getModuleVisibility } from '@shared/tenantModuleVisibility';
import { normalizePlanId } from '@shared/tenantPlanNormalize';
import type { PlatformTenantAdmin, PlatformTenantDetail, PlatformTenantFeatureRow } from '../../api/platformTenants';
import { getPlatformTenantBilling } from '../../api/platformBilling';
import { getPlatformToken } from '../../stores/platformAuth';
import { CARD_SECTION } from '../../utils/platformUi';
import { useTenantAddonSnapshot } from './PlatformTenantAddonStatus';

export type TenantDetailTabId = 'overview' | 'billing' | 'features' | 'addons' | 'account' | 'danger';

type Props = {
  tenantId: string;
  detail: PlatformTenantDetail;
  features: PlatformTenantFeatureRow[];
  admins: PlatformTenantAdmin[];
  onOpenTab: (tab: TenantDetailTabId, sectionId: string) => void;
};

type Tone = 'ok' | 'warn' | 'miss' | 'lock';

type CheckRow = {
  label: string;
  value: string;
  tone: Tone;
  todo?: string;
  tab: TenantDetailTabId;
  sectionId: string;
};

const TONE_MARK: Record<Tone, string> = {
  ok: '✓',
  warn: '⚠',
  miss: '✗',
  lock: '🔒',
};

function featureOn(features: PlatformTenantFeatureRow[], moduleId: string): boolean {
  return features.some((row) => row.moduleId === moduleId && row.effective);
}

function enabledIds(features: PlatformTenantFeatureRow[]): string[] {
  return features.filter((row) => row.effective).map((row) => row.moduleId);
}

function isModule(id: string): id is TenantFeatureModuleId {
  return Object.prototype.hasOwnProperty.call(TENANT_FEATURE_MODULES, id);
}

function planLockLabel(moduleId: string, plan: string, features: PlatformTenantFeatureRow[]): string | null {
  if (!isModule(moduleId)) return null;
  const vis = getModuleVisibility(moduleId, plan, enabledIds(features));
  if (vis.state !== 'locked') return null;
  return vis.requiredPlanLabel ? `${vis.requiredPlanLabel}부터` : '플랜 미포함';
}

function cashbillLabel(members: { status: string }[]): { value: string; tone: Tone; todo?: string } {
  if (members.length === 0) return { value: '없음', tone: 'miss', todo: '계산서 회원 연결이 필요합니다.' };
  if (members.some((row) => row.status === 'ACTIVE')) return { value: '가입완료', tone: 'ok' };
  if (members.some((row) => row.status === 'PENDING_REVIEW')) {
    return { value: '검토 중', tone: 'warn', todo: '바로빌 검토가 끝날 때까지 기다립니다.' };
  }
  if (members.some((row) => row.status === 'LINK_REQUIRED')) {
    return { value: '연결 필요', tone: 'warn', todo: '계산서 연결을 마무리하세요.' };
  }
  return { value: '확인 필요', tone: 'warn', todo: '회원사 상태를 확인하세요.' };
}

export function PlatformTenantSetupChecklist({ tenantId, detail, features, admins, onOpenTab }: Props) {
  const snap = useTenantAddonSnapshot(tenantId);
  const plan = detail.tenant.plan;
  const planLabel = TENANT_PLANS[normalizePlanId(plan)].label;
  const [contractSaved, setContractSaved] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    let cancelled = false;
    void getPlatformTenantBilling(token, tenantId)
      .then((data) => {
        if (!cancelled) setContractSaved(Boolean(data.profile.billingStartDate));
      })
      .catch(() => {
        if (!cancelled) setContractSaved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const alimtalkLock = planLockLabel('mod_alimtalk', plan, features);
  const pgLock = planLockLabel('mod_card_payment', plan, features);
  const cashbillLock = planLockLabel('mod_cashbill', plan, features);
  const bill = cashbillLabel(snap.members);
  const joined = snap.members.some((row) => row.status === 'ACTIVE');

  const rows: CheckRow[] = [
    detail.signupBusiness
      ? { label: '사업자 정보', value: '입력됨', tone: 'ok', tab: 'account', sectionId: 'section-business' }
      : {
          label: '사업자 정보',
          value: '없음',
          tone: 'miss',
          todo: '가입 사업자 정보가 없습니다.',
          tab: 'account',
          sectionId: 'section-business',
        },
    contractSaved === null && normalizePlanId(plan) !== 'free'
      ? {
          label: '플랜·과금',
          value: `${planLabel} · 확인 중`,
          tone: 'warn',
          tab: 'billing',
          sectionId: 'section-billing-contract',
        }
      : normalizePlanId(plan) === 'free'
        ? {
            label: '플랜·과금',
            value: '무료 플랜 · 과금 없음',
            tone: 'ok',
            tab: 'billing',
            sectionId: 'section-billing-contract',
          }
        : contractSaved
        ? {
            label: '플랜·과금',
            value: `${planLabel} · 계약 설정됨`,
            tone: 'ok',
            tab: 'billing',
            sectionId: 'section-billing-contract',
          }
        : {
            label: '플랜·과금',
            value: `${planLabel} · 과금 계약 미설정`,
            tone: 'warn',
            todo: '계약 조건을 저장하세요.',
            tab: 'billing',
            sectionId: 'section-billing-contract',
          },
    admins.length > 0
      ? { label: '관리자 계정', value: `${admins.length}명`, tone: 'ok', tab: 'account', sectionId: 'section-admins' }
      : {
          label: '관리자 계정',
          value: '없음',
          tone: 'miss',
          todo: '관리자 계정을 만드세요.',
          tab: 'account',
          sectionId: 'section-admins',
        },
    alimtalkLock
      ? { label: '알림톡', value: alimtalkLock, tone: 'lock', tab: 'addons', sectionId: 'section-alimtalk' }
      : featureOn(features, 'mod_alimtalk')
        ? { label: '알림톡', value: '켜짐', tone: 'ok', tab: 'addons', sectionId: 'section-alimtalk' }
        : {
            label: '알림톡',
            value: '꺼짐',
            tone: 'miss',
            todo: '알림톡을 켜세요.',
            tab: 'addons',
            sectionId: 'section-alimtalk',
          },
    pgLock
      ? { label: '카드결제 PG', value: pgLock, tone: 'lock', tab: 'addons', sectionId: 'section-pg' }
      : snap.loading
        ? { label: '카드결제 PG', value: '확인 중', tone: 'warn', tab: 'addons', sectionId: 'section-pg' }
        : snap.pgConnected
          ? { label: '카드결제 PG', value: '연결됨', tone: 'ok', tab: 'addons', sectionId: 'section-pg' }
          : {
              label: '카드결제 PG',
              value: '연결 안 됨',
              tone: 'miss',
              todo: 'PG 키를 연결하세요.',
              tab: 'addons',
              sectionId: 'section-pg',
            },
    cashbillLock
      ? { label: '계산서 연결', value: cashbillLock, tone: 'lock', tab: 'addons', sectionId: 'section-cashbill' }
      : snap.loading
        ? { label: '계산서 연결', value: '확인 중', tone: 'warn', tab: 'addons', sectionId: 'section-cashbill' }
        : { label: '계산서 연결', ...bill, tab: 'addons', sectionId: 'section-cashbill' },
  ];

  if (joined) {
    const certOk = snap.members.some((row) => row.status === 'ACTIVE' && row.certValid);
    rows.push(
      certOk
        ? { label: '공동인증서', value: '유효', tone: 'ok', tab: 'addons', sectionId: 'section-cert' }
        : {
            label: '공동인증서',
            value: '미등록',
            tone: 'miss',
            todo: '공동인증서를 등록하세요.',
            tab: 'addons',
            sectionId: 'section-cert',
          },
    );
  }

  return (
    <section className={CARD_SECTION}>
      <h2 className="text-base font-semibold text-gray-900">설정 점검</h2>
      <p className="mt-0.5 text-fluid-xs text-gray-500">줄을 누르면 해당 탭의 섹션으로 이동합니다.</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {rows.map((row) => (
          <li key={row.label}>
            <button
              type="button"
              onClick={() => onOpenTab(row.tab, row.sectionId)}
              className="flex w-full items-start justify-between gap-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              <span className="min-w-0">
                <span className="text-fluid-sm font-medium text-gray-900">
                  <span className="mr-1.5" aria-hidden>
                    {TONE_MARK[row.tone]}
                  </span>
                  {row.label}
                </span>
                {row.todo ? <span className="mt-0.5 block text-fluid-xs text-amber-800">{row.todo}</span> : null}
              </span>
              <span className="shrink-0 text-fluid-sm text-gray-500">{row.value}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-fluid-xs text-gray-400">
        전체 목록은{' '}
        <Link to="/platform/card-payment" className="underline hover:text-gray-600">
          카드결제 PG
        </Link>
        {' · '}
        <Link to="/platform/barobill-members" className="underline hover:text-gray-600">
          계산서(바로빌)
        </Link>
      </p>
    </section>
  );
}
