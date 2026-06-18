import { useCallback, useEffect, useState } from 'react';
import {
  fetchTenantCompanyProfile,
  patchTenantCompanyProfile,
  sendTenantCompanyProfileTestEmail,
  uploadTenantCompanySeal,
  type TenantCompanyProfileDto,
} from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';
import {
  QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT,
  QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
  QUOTATION_SEAL_DISPLAY_WIDTH_MIN,
} from '@shared/quotationSeal';

export function useTenantCompanyProfileForm() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<string | null>(null);
  const [profile, setProfile] = useState<TenantCompanyProfileDto | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sealPreviewUrl, setSealPreviewUrl] = useState<string | null>(null);
  const [sealDisplayWidthPx, setSealDisplayWidthPx] = useState(
    String(QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT),
  );
  const [sealBusy, setSealBusy] = useState(false);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');

  const hydrate = useCallback((dto: TenantCompanyProfileDto) => {
    setProfile(dto);
    const c = dto.companyRegistration;
    setCompanyName(c.companyName ?? '');
    setRepresentativeName(c.representativeName ?? '');
    setBusinessRegistrationNo(c.businessRegistrationNo ?? '');
    setAddressLine(c.addressLine ?? '');
    setPhone(c.phone ?? '');
    setFax(c.fax ?? '');
    setContactEmail(c.contactEmail ?? '');
    setSealPreviewUrl(c.sealSecureUrl?.trim() || null);
    setSealDisplayWidthPx(String(c.sealDisplayWidthPx ?? QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT));
    setSmtpHost(dto.smtp.host);
    setSmtpPort(String(dto.smtp.port || 587));
    setSmtpSecure(dto.smtp.secure);
    setSmtpUser(dto.smtp.user);
    setSmtpFrom(dto.smtp.from);
    setPasswordConfigured(dto.smtp.passwordConfigured);
    setSmtpPassword('');
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const dto = await fetchTenantCompanyProfile(token);
      hydrate(dto);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const parseSealWidth = (): number | 'bad' | 'default' => {
    const raw = sealDisplayWidthPx.trim();
    if (!raw) return 'default';
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 'bad';
    if (n < QUOTATION_SEAL_DISPLAY_WIDTH_MIN || n > QUOTATION_SEAL_DISPLAY_WIDTH_MAX) return 'bad';
    return n;
  };

  const handleSealUpload = async (file: File) => {
    if (!token) return;
    if (file.type !== 'image/png') {
      setErr('직인은 PNG 파일만 업로드할 수 있습니다.');
      return;
    }
    const sealW = parseSealWidth();
    if (sealW === 'bad') {
      setErr(
        `직인 표시 크기는 ${QUOTATION_SEAL_DISPLAY_WIDTH_MIN}~${QUOTATION_SEAL_DISPLAY_WIDTH_MAX} px만 가능합니다.`,
      );
      return;
    }
    setSealBusy(true);
    setErr(null);
    try {
      const up = await uploadTenantCompanySeal(file, token, file.name || `seal_${Date.now()}.png`);
      const dto = await patchTenantCompanyProfile(token, {
        companyRegistration: {
          sealPublicId: up.publicId,
          sealSecureUrl: up.secureUrl,
          ...(sealW === 'default' ? {} : { sealDisplayWidthPx: sealW }),
        },
      });
      hydrate(dto);
      setSuccessModal('직인 이미지를 저장했습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '직인 업로드 실패');
    } finally {
      setSealBusy(false);
    }
  };

  const handleSealRemove = async () => {
    if (!token || !window.confirm('직인 이미지를 제거할까요?')) return;
    setSealBusy(true);
    setErr(null);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        companyRegistration: {
          sealPublicId: null,
          sealSecureUrl: null,
          sealDisplayWidthPx: null,
        },
      });
      hydrate(dto);
      setSuccessModal('직인을 제거했습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '직인 제거 실패');
    } finally {
      setSealBusy(false);
    }
  };

  const handleSealWidthSave = async () => {
    if (!token || !sealPreviewUrl) return;
    const sealW = parseSealWidth();
    if (sealW === 'bad') {
      setErr(
        `직인 표시 크기는 ${QUOTATION_SEAL_DISPLAY_WIDTH_MIN}~${QUOTATION_SEAL_DISPLAY_WIDTH_MAX} px만 가능합니다.`,
      );
      return;
    }
    setSealBusy(true);
    setErr(null);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        companyRegistration: {
          sealDisplayWidthPx: sealW === 'default' ? null : sealW,
        },
      });
      hydrate(dto);
      setSuccessModal('직인 표시 크기를 저장했습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSealBusy(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        companyRegistration: {
          companyName,
          representativeName,
          businessRegistrationNo,
          addressLine,
          phone,
          fax,
          contactEmail,
        },
      });
      hydrate(dto);
      setSuccessModal('사업자 정보가 저장되었습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSmtp = async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    const portNum = parseInt(smtpPort, 10);
    try {
      const dto = await patchTenantCompanyProfile(token, {
        smtp: {
          host: smtpHost,
          port: Number.isFinite(portNum) ? portNum : 587,
          secure: smtpSecure,
          user: smtpUser,
          from: smtpFrom,
          ...(smtpPassword ? { password: smtpPassword } : {}),
        },
      });
      hydrate(dto);
      setSuccessModal('발송 이메일 설정이 저장되었습니다.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setBusy(false);
    }
  };

  const handleTestEmail = async () => {
    if (!token) return;
    const to = testEmailTo.trim() || contactEmail.trim();
    if (!to) {
      setErr('테스트 수신 이메일을 입력해 주세요.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await sendTenantCompanyProfileTestEmail(token, to);
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
    companyName,
    setCompanyName,
    representativeName,
    setRepresentativeName,
    businessRegistrationNo,
    setBusinessRegistrationNo,
    addressLine,
    setAddressLine,
    phone,
    setPhone,
    fax,
    setFax,
    contactEmail,
    setContactEmail,
    sealPreviewUrl,
    sealDisplayWidthPx,
    setSealDisplayWidthPx,
    sealBusy,
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
    handleSealUpload,
    handleSealRemove,
    handleSealWidthSave,
    handleSaveCompany,
    handleSaveSmtp,
    handleTestEmail,
    smtpReady: profile?.smtp.configured,
  };
}
