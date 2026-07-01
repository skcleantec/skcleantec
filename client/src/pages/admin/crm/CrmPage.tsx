import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { getToken } from '../../../stores/auth';
import { useMarketerPermissions } from '../../../hooks/useMarketerPermissions';
import { useCrmInquiryEdit } from '../../../hooks/useCrmInquiryEdit';
import { fetchTelecrmPricingCatalog } from '../../../api/telecrm';
import { CrmShell } from '../../../components/crm/layout/CrmShell';
import { CrmIntakePanel, type CrmCustomerMode } from '../../../components/crm/intake/CrmIntakePanel';
import { CrmScriptPanel } from '../../../components/crm/scripts/CrmScriptPanel';
import { CrmPricingPanel } from '../../../components/crm/pricing/CrmPricingPanel';
import { CrmSessionBar } from '../../../components/crm/session/CrmSessionBar';
import { FeatureGate } from '../../../components/auth/FeatureGate';

export function CrmPage() {
  const [searchParams] = useSearchParams();
  const isPopup = searchParams.get('popup') === '1';
  const permissions = useMarketerPermissions();
  const canSettings = permissions.has('crm.settings');
  const canAdsSession = permissions.has('ads.sessions');
  const canView =
    permissions.me?.role === 'ADMIN' ||
    canAccessAdminPath(permissions.me?.role, permissions.permissions, '/admin/crm');

  const [mode, setMode] = useState<CrmCustomerMode>('new');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pyeong, setPyeong] = useState('');
  const [pricePerPyeong, setPricePerPyeong] = useState(0);
  const [lookupRefreshKey, setLookupRefreshKey] = useState(0);

  const { openInquiryEdit, layer: inquiryEditLayer } = useCrmInquiryEdit(canView, () => {
    setLookupRefreshKey((k) => k + 1);
  });

  useEffect(() => {
    document.title = '텔레CRM — SK클린텍';
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void fetchTelecrmPricingCatalog(token).then((res) => {
      setPricePerPyeong(res.estimateConfig.pricePerPyeong);
    });
  }, []);

  const pyeongNum = parseFloat(pyeong.replace(/,/g, ''));
  const estimateWon = useMemo(() => {
    if (!Number.isFinite(pyeongNum) || pyeongNum <= 0 || pricePerPyeong <= 0) return null;
    return Math.round(pyeongNum * pricePerPyeong);
  }, [pyeongNum, pricePerPyeong]);

  if (!getToken()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-gray-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  if (!permissions.loading && !canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center">
        <p className="text-fluid-sm text-amber-900">텔레CRM 사용 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <FeatureGate module="mod_telecrm">
      <div className="min-w-[1280px]">
        <CrmShell
          header={
            <header className="theme-dark-header flex shrink-0 items-center justify-between gap-4 px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="truncate text-fluid-sm font-semibold">텔레CRM</h1>
                <CrmSessionBar enabled={canAdsSession} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canSettings ? (
                  <Link
                    to="/admin/crm/settings/scripts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-fluid-xs hover:bg-white/10"
                  >
                    설정
                  </Link>
                ) : null}
                {isPopup ? (
                  <button
                    type="button"
                    onClick={() => window.close()}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-fluid-xs hover:bg-white/20"
                  >
                    창 닫기
                  </button>
                ) : (
                  <Link
                    to="/admin/dashboard"
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-fluid-xs hover:bg-white/20"
                  >
                    관리자로
                  </Link>
                )}
              </div>
            </header>
          }
          left={
            <CrmIntakePanel
              mode={mode}
              onModeChange={setMode}
              phone={phone}
              onPhoneChange={setPhone}
              onCustomerNameChange={setCustomerName}
              pyeong={pyeong}
              onPyeongChange={setPyeong}
              onOpenInquiryEdit={openInquiryEdit}
              lookupRefreshKey={lookupRefreshKey}
              onSaved={() => {
                setLookupRefreshKey((k) => k + 1);
              }}
            />
          }
          center={
            <CrmScriptPanel
              customerName={customerName || undefined}
              pyeong={pyeong || undefined}
              estimateWon={estimateWon}
            />
          }
          right={<CrmPricingPanel pyeong={pyeong} onPyeongChange={setPyeong} />}
        />
        {inquiryEditLayer}
      </div>
    </FeatureGate>
  );
}
