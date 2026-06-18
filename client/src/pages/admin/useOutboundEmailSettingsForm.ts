import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  type OperatingCompanySmtpSetting,
  type TenantCompanyProfileDto,
  type TenantSmtpSettingsPublic,
} from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';

/** '' = 테넌트 공통 기본, 그 외 = 영업 브랜드 id */
export type OutboundEmailScope = '' | string;

function smtpFieldsFromPublic(smtp: TenantSmtpSettingsPublic) {
  return {
    smtpHost: smtp.host,
    smtpPort: String(smtp.port || 587),
    smtpSecure: smtp.secure,
    smtpUser: smtp.user,
    smtpFrom: smtp.from,
    passwordConfigured: smtp.passwordConfigured,
  };
}

export function useOutboundEmailSettingsForm() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [profile, setProfile] = useState<TenantCompanyProfileDto | null>(null);
  const [smtpScope, setSmtpScope] = useState<OutboundEmailScope>('');

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');

  const operatingCompanies = profile?.operatingCompanySmtpSettings ?? [];
  const hasOperatingCompanies = operatingCompanies.length > 0;

  const applySmtpScope = useCallback(
    (dto: TenantCompanyProfileDto, scope: OutboundEmailScope) => {
      if (!scope) {
        const fields = smtpFieldsFromPublic(dto.smtp);
        setSmtpHost(fields.smtpHost);
        setSmtpPort(fields.smtpPort);
        setSmtpSecure(fields.smtpSecure);
        setSmtpUser(fields.smtpUser);
        setSmtpFrom(fields.smtpFrom);
        setPasswordConfigured(fields.passwordConfigured);
        setSmtpPassword('');
        return;
      }
      const brand = dto.operatingCompanySmtpSettings.find((oc) => oc.id === scope);
      if (!brand) return;
      const fields = smtpFieldsFromPublic(brand.smtp);
      setSmtpHost(fields.smtpHost);
      setSmtpPort(fields.smtpPort);
      setSmtpSecure(fields.smtpSecure);
      setSmtpUser(fields.smtpUser);
      setSmtpFrom(fields.smtpFrom);
      setPasswordConfigured(fields.passwordConfigured);
      setSmtpPassword('');
    },
    [],
  );

  const hydrate = useCallback((dto: TenantCompanyProfileDto, scope: OutboundEmailScope) => {
    setProfile(dto);
    applySmtpScope(dto, scope);
  }, [applySmtpScope]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const dto = await fetchTenantCompanyProfile(token);
        if (!cancelled) hydrate(dto, '');
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : '불러오기 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hydrate]);

  const selectScope = useCallback(
    (nextScope: OutboundEmailScope) => {
      setSmtpScope(nextScope);
      if (profile) applySmtpScope(profile, nextScope);
    },
    [profile, applySmtpScope],
  );

  const scopeLabel = useMemo(() => {
    if (!smtpScope) return '공통 기본';
    return operatingCompanies.find((oc) => oc.id === smtpScope)?.displayName ?? '영업 브랜드';
  }, [smtpScope, operatingCompanies]);

  const smtpReady = useMemo(() => {
    if (!profile) return false;
    if (!smtpScope) return profile.smtp.configured;
    const brand = profile.operatingCompanySmtpSettings.find((oc) => oc.id === smtpScope);
    return brand?.hasOwnSmtp ?? false;
  }, [profile, smtpScope]);

  const effectiveConfigured = useMemo(() => {
    if (!profile) return false;
    if (!smtpScope) {
      return profile.smtp.configured || profile.globalSmtpFallbackAvailable;
    }
    const brand = profile.operatingCompanySmtpSettings.find((oc) => oc.id === smtpScope);
    return brand?.effectiveConfigured ?? false;
  }, [profile, smtpScope]);

  const handleSaveSmtp = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    const portNum = parseInt(smtpPort, 10);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        ...(smtpScope ? { operatingCompanyId: smtpScope } : {}),
        smtp: {
          host: smtpHost,
          port: Number.isFinite(portNum) ? portNum : 587,
          secure: smtpSecure,
          user: smtpUser,
          from: smtpFrom,
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      hydrate(dto, smtpScope);
      setSuccessModal(`${scopeLabel} 발송 이메일 설정이 저장되었습니다.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleTestEmail = async () => {
    if (!token) return;
    const to = testEmailTo.trim();
    if (!to) {
      setErr('테스트 수신 이메일을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await sendTenantCompanyProfileTestEmail(token, to, smtpScope || null);
      setSuccessModal('테스트 메일이 발송되었습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '테스트 발송 실패');
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
    busy,
    err,
    successModal,
    setSuccessModal,
    profile,
    smtpScope,
    selectScope,
    scopeLabel,
    operatingCompanies,
    hasOperatingCompanies,
    smtpHost,
    setSmtpHost,
    smtpPort,
    setSmtpPort,
    smtpSecure,
    setSmtpSecure,
    smtpUser,
    setSmtpUser,
    smtpFrom,
    setSmtpFrom,
    smtpPassword,
    setSmtpPassword,
    passwordConfigured,
    testEmailTo,
    setTestEmailTo,
    handleSaveSmtp,
    handleTestEmail,
    smtpReady,
    effectiveConfigured,
    companyName: profile?.companyRegistration.companyName ?? '',
    contactEmail: profile?.companyRegistration.contactEmail ?? '',
  };
}

export type { OperatingCompanySmtpSetting };
