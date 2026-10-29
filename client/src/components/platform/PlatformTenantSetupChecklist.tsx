import { Link } from 'react-router-dom';
import type { PlatformTenantAdmin, PlatformTenantDetail, PlatformTenantFeatureRow } from '../../api/platformTenants';
import { CARD_SECTION } from '../../utils/platformUi';
import { useTenantAddonSnapshot } from './PlatformTenantAddonStatus';

export type TenantDetailTabId = 'overview' | 'billing' | 'features' | 'addons' | 'account' | 'danger';

type Props = {
  tenantId: string;
  detail: PlatformTenantDetail;
  features: PlatformTenantFeatureRow[];
  admins: PlatformTenantAdmin[];
  onOpenTab: (tab: TenantDetailTabId) => void;
};

function featureOn(features: PlatformTenantFeatureRow[], moduleId: string): boolean {
  return features.some((row) => row.moduleId === moduleId && row.effective);
}

export function PlatformTenantSetupChecklist({ tenantId, detail, features, admins, onOpenTab }: Props) {
  const snap = useTenantAddonSnapshot(tenantId);
  const cashbillOn = featureOn(features, 'mod_cashbill');
  const showCert = cashbillOn || snap.members.length > 0;
  const rows: { label: string; value: string; tab: TenantDetailTabId }[] = [
    {
      label: '사업자 정보',
      value: detail.signupBusiness ? '입력됨' : '없음',
      tab: 'account',
    },
    {
      label: '플랜·과금',
      value: detail.tenant.plan || '미설정',
      tab: 'billing',
    },
    {
      label: '관리자 계정',
      value: admins.length > 0 ? `${admins.length}명` : '없음',
      tab: 'account',
    },
    {
      label: '알림톡',
      value: featureOn(features, 'mod_alimtalk') ? '켜짐' : '꺼짐',
      tab: 'addons',
    },
    {
      label: '카드결제 PG',
      value: snap.loading ? '확인 중' : snap.pgConnected ? '연결됨' : '연결 안 됨',
      tab: 'addons',
    },
    {
      label: '계산서 연결',
      value: snap.loading ? '확인 중' : snap.members.length > 0 ? `${snap.members.length}건` : '없음',
      tab: 'addons',
    },
  ];
  if (showCert) {
    rows.push({
      label: '공동인증서',
      value: snap.loading ? '확인 중' : snap.members.some((row) => row.certValid) ? '유효' : '미등록',
      tab: 'addons',
    });
  }

  return (
    <section className={CARD_SECTION}>
      <h2 className="text-base font-semibold text-gray-900">설정 점검</h2>
      <p className="mt-0.5 text-xs text-gray-500">이미 저장된 값을 읽어 채웁니다. 항목을 누르면 해당 탭으로 갑니다.</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2">
            <button
              type="button"
              onClick={() => onOpenTab(row.tab)}
              className="text-left text-sm font-medium text-gray-900 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {row.label}
            </button>
            <span className="text-sm text-gray-500">{row.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400">
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
