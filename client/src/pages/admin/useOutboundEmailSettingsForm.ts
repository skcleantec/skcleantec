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
import {
  buildSmtpFrom,
  parseSmtpFrom,
  validateOutboundEmailForm,
  firstOutboundEmailValidationMessage,
} from '../../utils/outboundEmailFormHelpers';
import {
  applyOutboundEmailProviderPreset,
  inferOutboundEmailProvider,
  type OutboundEmailProviderId,
} from '../../utils/outboundEmailProviders';
import { OUTBOUND_EMAIL_COPY } from '../../utils/outboundEmailCopy';

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

  const [providerId, setProviderId] = useState<OutboundEmailProviderId>('gmail');
  const [wizardStep, setWizardStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compactGrid, setCompactGrid] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');

  const companyName = profile?.companyRegistration.companyName ?? '';
  const contactEmail = profile?.companyRegistration.contactEmail ?? '';

  const operatingCompanies = profile?.operatingCompanySmtpSettings ?? [];
  const hasOperatingCompanies = operatingCompanies.length > 0;

  const smtpFrom = useMemo(() => buildSmtpFrom(displayName, sendEmail), [displayName, sendEmail]);

  const applySmtpScope = useCallback(
    (dto: TenantCompanyProfileDto, scope: OutboundEmailScope) => {
      const defaultName = dto.companyRegistration.companyName?.trim() || '';
      if (!scope) {
        const fields = smtpFieldsFromPublic(dto.smtp);
        const parsed = parseSmtpFrom(fields.smtpFrom);
        setSmtpHost(fields.smtpHost);
        setSmtpPort(fields.smtpPort);
        setSmtpSecure(fields.smtpSecure);
        setSendEmail(fields.smtpUser || parsed.email);
        setDisplayName(parsed.displayName || defaultName);
        setPasswordConfigured(fields.passwordConfigured);
        setProviderId(inferOutboundEmailProvider(fields.smtpHost));
        setSmtpPassword('');
        return;
      }
      const brand = dto.operatingCompanySmtpSettings.find((oc) => oc.id === scope);
      if (!brand) return;
      const fields = smtpFieldsFromPublic(brand.smtp);
      const parsed = parseSmtpFrom(fields.smtpFrom);
      setSmtpHost(fields.smtpHost);
      setSmtpPort(fields.smtpPort);
      setSmtpSecure(fields.smtpSecure);
      setSendEmail(fields.smtpUser || parsed.email);
      setDisplayName(parsed.displayName || defaultName);
      setPasswordConfigured(fields.passwordConfigured);
      setProviderId(inferOutboundEmailProvider(fields.smtpHost));
      setSmtpPassword('');
    },
    [],
  );

  const hydrate = useCallback(
    (dto: TenantCompanyProfileDto, scope: OutboundEmailScope) => {
      setProfile(dto);
      applySmtpScope(dto, scope);
    },
    [applySmtpScope],
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const dto = await fetchTenantCompanyProfile(token);
        if (!cancelled) {
          hydrate(dto, '');
          if (dto.companyRegistration.contactEmail?.trim()) {
            setTestEmailTo(dto.companyRegistration.contactEmail.trim());
          }
        }
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
      setFieldErrors({});
      setWizardStep(1);
      if (profile) applySmtpScope(profile, nextScope);
    },
    [profile, applySmtpScope],
  );

  const selectProvider = useCallback((next: OutboundEmailProviderId) => {
    setProviderId(next);
    setFieldErrors({});
    if (next !== 'custom') {
      const preset = applyOutboundEmailProviderPreset(next);
      setSmtpHost(preset.host);
      setSmtpPort(preset.port);
      setSmtpSecure(preset.secure);
    } else {
      setShowAdvanced(true);
    }
  }, []);

  const scopeLabel = useMemo(() => {
    if (!smtpScope) return OUTBOUND_EMAIL_COPY.scopeCommon;
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

  const validationInput = useMemo(
    () => ({
      providerId,
      sendEmail,
      displayName,
      smtpHost,
      smtpPort,
      smtpPassword,
      passwordConfigured,
      testEmailTo,
    }),
    [providerId, sendEmail, displayName, smtpHost, smtpPort, smtpPassword, passwordConfigured, testEmailTo],
  );

  const handleSaveSmtp = async () => {
    if (!token) return;
    const errors = validateOutboundEmailForm(validationInput);
    setFieldErrors(errors);
    const first = firstOutboundEmailValidationMessage(errors);
    if (first) {
      setErr(first);
      return;
    }
    setBusy(true);
    setErr(null);
    const portNum = parseInt(smtpPort, 10);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        ...(smtpScope ? { operatingCompanyId: smtpScope } : {}),
        smtp: {
          host: smtpHost.trim() || applyOutboundEmailProviderPreset(providerId).host,
          port: Number.isFinite(portNum) ? portNum : 587,
          secure: smtpSecure,
          user: sendEmail.trim(),
          from: smtpFrom.trim(),
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      hydrate(dto, smtpScope);
      setSuccessModal(OUTBOUND_EMAIL_COPY.successSave(scopeLabel));
      setFieldErrors({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleTestEmail = async () => {
    if (!token) return;
    const errors = validateOutboundEmailForm({ ...validationInput, requireTestEmail: true });
    setFieldErrors(errors);
    const first = firstOutboundEmailValidationMessage(errors);
    if (first) {
      setErr(first);
      return;
    }
    if (!smtpReady) {
      setErr('먼저 설정을 저장해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await sendTenantCompanyProfileTestEmail(token, testEmailTo.trim(), smtpScope || null);
      setSuccessModal(OUTBOUND_EMAIL_COPY.successTest);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '연습 메일 보내기 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (!token) return;
    const errors = validateOutboundEmailForm({ ...validationInput, requireTestEmail: true });
    setFieldErrors(errors);
    const first = firstOutboundEmailValidationMessage(errors);
    if (first) {
      setErr(first);
      return;
    }
    setBusy(true);
    setErr(null);
    const portNum = parseInt(smtpPort, 10);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        ...(smtpScope ? { operatingCompanyId: smtpScope } : {}),
        smtp: {
          host: smtpHost.trim() || applyOutboundEmailProviderPreset(providerId).host,
          port: Number.isFinite(portNum) ? portNum : 587,
          secure: smtpSecure,
          user: sendEmail.trim(),
          from: smtpFrom.trim(),
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      hydrate(dto, smtpScope);
      await sendTenantCompanyProfileTestEmail(token, testEmailTo.trim(), smtpScope || null);
      setSuccessModal(OUTBOUND_EMAIL_COPY.successSaveAndTest);
      setFieldErrors({});
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 또는 연습 보내기 실패');
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
    busy,
    err,
    setErr,
    successModal,
    setSuccessModal,
    profile,
    smtpScope,
    selectScope,
    scopeLabel,
    operatingCompanies,
    hasOperatingCompanies,
    providerId,
    selectProvider,
    wizardStep,
    setWizardStep,
    showAdvanced,
    setShowAdvanced,
    compactGrid,
    setCompactGrid,
    fieldErrors,
    smtpHost,
    setSmtpHost,
    smtpPort,
    setSmtpPort,
    smtpSecure,
    setSmtpSecure,
    sendEmail,
    setSendEmail,
    displayName,
    setDisplayName,
    smtpPassword,
    setSmtpPassword,
    passwordConfigured,
    testEmailTo,
    setTestEmailTo,
    handleSaveSmtp,
    handleTestEmail,
    handleSaveAndTest,
    smtpReady,
    effectiveConfigured,
    companyName,
    contactEmail,
  };
}

export type { OperatingCompanySmtpSetting };
