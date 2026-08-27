import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PLATFORM_NAME, PLATFORM_NAME_EN } from '@shared/platformBrand';
import {
  PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG,
  PLATFORM_LEGAL_MEMBER_TERMS_SLUG,
} from '@shared/platformLegalSlugs';
import { isValidTenantLoginId, normalizeTenantLoginId, tenantLoginIdErrorMessage } from '@shared/tenantLoginId';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import {
  TENANT_SELF_SIGNUP_PLAN_IDS,
  TENANT_SIGNUP_PAID_TRIAL_DAYS,
} from '@shared/tenantSignup';
import {
  normalizeBizNumber,
  validateSignupBusinessInput,
  type AuthIdentityProvider,
  type SignupBusinessType,
} from '@shared/authSignup';
import { TenantBrandLogo } from '../components/brand/TenantBrandLogo';
import { GoogleSignupButton } from '../components/auth/GoogleSignupButton';
import { KakaoSignupButton } from '../components/auth/KakaoSignupButton';
import { LegalDocumentViewerModal } from '../components/auth/LegalDocumentViewerModal';
import { ImageThumbLightbox } from '../components/ui/ImageThumbLightbox';
import {
  checkTenantSignupSlug,
  completeTenantSignup,
  sendTenantSignupVerificationCode,
  uploadTenantSignupBusinessRegistration,
  validateTenantSignupReferrer,
} from '../api/tenantSignup';
import {
  fetchGoogleSignupOAuthConfig,
  fetchKakaoSignupOAuthConfig,
  getSignupKakaoRedirectUri,
  KAKAO_SIGNUP_OAUTH_STATE_KEY,
  verifyGoogleSignupIdToken,
  verifyKakaoSignupAuthorizationCode,
  type SignupOAuthVerifyResult,
} from '../api/authSignupOAuth';
import { fetchSignupLegalDocuments, type PublicLegalDocument } from '../api/platformLegal';
import { useLoginScrollSurface } from '../hooks/useMobileInputVisibility';

const inputClass =
  'login-field-input w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10';

const SIGNUP_REF_STORAGE_KEY = 'cbiseo_signup_ref';

export function TenantSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [memberTermsAgreed, setMemberTermsAgreed] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TenantPlanId>('free');
  const [referrerCode, setReferrerCode] = useState('');
  const [referrerFromLink, setReferrerFromLink] = useState(false);
  const [referrerHint, setReferrerHint] = useState<string | null>(null);
  const [referrerChecking, setReferrerChecking] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [slugHint, setSlugHint] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [legalDocs, setLegalDocs] = useState<PublicLegalDocument[]>([]);
  const [legalLoadErr, setLegalLoadErr] = useState('');
  const [viewerDoc, setViewerDoc] = useState<PublicLegalDocument | null>(null);
  const termsSectionRef = useRef<HTMLElement | null>(null);
  const verificationSectionRef = useRef<HTMLDivElement | null>(null);
  const [businessType, setBusinessType] = useState<SignupBusinessType | ''>('');
  const [bizNumber, setBizNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [businessRegistrationImageUrl, setBusinessRegistrationImageUrl] = useState('');
  const [businessRegistrationImagePublicId, setBusinessRegistrationImagePublicId] = useState('');
  const [individualConfirmed, setIndividualConfirmed] = useState(false);
  const [individualUsageNote, setIndividualUsageNote] = useState('');
  const [businessUploading, setBusinessUploading] = useState(false);
  const businessFileRef = useRef<HTMLInputElement | null>(null);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [kakaoOAuthEnabled, setKakaoOAuthEnabled] = useState(false);
  const [kakaoRestApiKey, setKakaoRestApiKey] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [oauthProvider, setOauthProvider] = useState<AuthIdentityProvider | null>(null);
  const [oauthProviderEmail, setOauthProviderEmail] = useState<string | null>(null);
  const [oauthVerifying, setOauthVerifying] = useState(false);
  const kakaoCallbackHandledRef = useRef(false);

  const oauthActive = signupToken.trim().length > 0;
  const snsOAuthEnabled = googleOAuthEnabled || kakaoOAuthEnabled;
  const oauthProviderLabel = oauthProvider === 'kakao' ? '카카오' : 'Google';

  const resetVerificationProgress = useCallback(() => {
    setCodeSent(false);
    setChallengeId('');
    setVerificationCode('');
  }, []);

  const clearSignupOAuth = useCallback(() => {
    setSignupToken('');
    setOauthProvider(null);
    setOauthProviderEmail(null);
    resetVerificationProgress();
    setInfo('SNS 연결을 해제했습니다. 이메일·비밀번호로 가입할 수 있습니다.');
  }, [resetVerificationProgress]);

  const applyOAuthVerifyResult = useCallback(
    (verified: SignupOAuthVerifyResult) => {
      setSignupToken(verified.signupToken);
      setOauthProvider(verified.provider);
      setOauthProviderEmail(verified.providerEmail);
      resetVerificationProgress();
      const label = verified.provider === 'kakao' ? '카카오' : 'Google';
      setInfo(
        verified.providerEmail
          ? `${label} 계정(${verified.providerEmail})이 연결되었습니다. 담당자 이메일 인증을 이어서 진행해 주세요.`
          : `${label} 계정이 연결되었습니다. 담당자 이메일 인증을 이어서 진행해 주세요.`,
      );
    },
    [resetVerificationProgress],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchSignupLegalDocuments()
      .then(({ items }) => {
        if (!cancelled) setLegalDocs(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setLegalLoadErr(e instanceof Error ? e.message : '약관을 불러오지 못했습니다.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchGoogleSignupOAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setGoogleOAuthEnabled(cfg.enabled && cfg.clientId.trim().length > 0);
        setGoogleClientId(cfg.clientId.trim());
      })
      .catch(() => {
        if (cancelled) return;
        setGoogleOAuthEnabled(false);
        setGoogleClientId('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchKakaoSignupOAuthConfig()
      .then((cfg) => {
        if (cancelled) return;
        setKakaoOAuthEnabled(cfg.enabled && cfg.restApiKey.trim().length > 0);
        setKakaoRestApiKey(cfg.restApiKey.trim());
      })
      .catch(() => {
        if (cancelled) return;
        setKakaoOAuthEnabled(false);
        setKakaoRestApiKey('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (kakaoCallbackHandledRef.current) return;

    const oauthError = searchParams.get('error')?.trim();
    const code = searchParams.get('code')?.trim();
    if (!oauthError && !code) return;

    kakaoCallbackHandledRef.current = true;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('code');
    nextParams.delete('state');
    nextParams.delete('error');
    nextParams.delete('error_description');
    const nextSearch = nextParams.toString();
    navigate({ pathname: '/signup', search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });

    if (oauthError) {
      setError('카카오 인증이 취소되었습니다.');
      sessionStorage.removeItem(KAKAO_SIGNUP_OAUTH_STATE_KEY);
      return;
    }
    if (!code) return;

    const state = searchParams.get('state')?.trim() ?? '';
    const savedState = sessionStorage.getItem(KAKAO_SIGNUP_OAUTH_STATE_KEY)?.trim() ?? '';
    sessionStorage.removeItem(KAKAO_SIGNUP_OAUTH_STATE_KEY);
    if (!savedState || state !== savedState) {
      setError('카카오 인증 상태가 올바르지 않습니다. 다시 「카카오로 시작」을 눌러 주세요.');
      return;
    }

    setError('');
    setInfo('');
    setOauthVerifying(true);
    void verifyKakaoSignupAuthorizationCode(code, getSignupKakaoRedirectUri())
      .then(applyOAuthVerifyResult)
      .catch((err) => {
        setError(err instanceof Error ? err.message : '카카오 인증에 실패했습니다.');
      })
      .finally(() => {
        setOauthVerifying(false);
      });
  }, [applyOAuthVerifyResult, navigate, searchParams]);

  useEffect(() => {
    const refFromUrl = searchParams.get('ref')?.trim().toLowerCase() ?? '';
    if (refFromUrl) {
      sessionStorage.setItem(SIGNUP_REF_STORAGE_KEY, refFromUrl);
      setReferrerCode(refFromUrl);
      setReferrerFromLink(true);
      return;
    }
    const stored = sessionStorage.getItem(SIGNUP_REF_STORAGE_KEY)?.trim().toLowerCase() ?? '';
    if (stored) {
      setReferrerCode(stored);
      setReferrerFromLink(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const code = referrerCode.trim().toLowerCase();
    if (code.length < 2) {
      setReferrerHint(null);
      return;
    }
    const t = window.setTimeout(() => {
      setReferrerChecking(true);
      validateTenantSignupReferrer(code)
        .then((r) => {
          if (r.valid) {
            setReferrerHint(`${r.displayName ?? '추천인'} 코드가 확인되었습니다.`);
          } else {
            setReferrerHint(r.reason ?? '사용할 수 없는 코드입니다.');
          }
        })
        .catch(() => setReferrerHint(null))
        .finally(() => setReferrerChecking(false));
    }, 400);
    return () => window.clearTimeout(t);
  }, [referrerCode]);

  const termsDoc =
    legalDocs.find((d) => d.slug === PLATFORM_LEGAL_MEMBER_TERMS_SLUG) ??
    legalDocs[0] ??
    null;
  const privacyDoc =
    legalDocs.find((d) => d.slug === PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG) ??
    legalDocs[1] ??
    null;

  useEffect(() => {
    const s = slug.trim().toLowerCase();
    if (s.length < 2) {
      setSlugHint(null);
      return;
    }
    const t = window.setTimeout(() => {
      setSlugChecking(true);
      checkTenantSignupSlug(s)
        .then((r) => {
          setSlugHint(r.available ? '사용 가능한 업체 코드입니다.' : r.reason ?? '사용할 수 없습니다.');
        })
        .catch(() => setSlugHint(null))
        .finally(() => setSlugChecking(false));
    }, 400);
    return () => window.clearTimeout(t);
  }, [slug]);

  useEffect(() => {
    if (businessType !== 'registered_business') return;
    if (!businessName.trim() && name.trim()) setBusinessName(name.trim());
    if (!representativeName.trim() && adminName.trim()) setRepresentativeName(adminName.trim());
  }, [businessType, name, adminName, businessName, representativeName]);

  const signupBusinessPayload = useMemo(
    () =>
      businessType
        ? {
            businessType,
            bizNumber: bizNumber || null,
            businessName: businessName || null,
            representativeName: representativeName || null,
            addressLine: addressLine || null,
            businessRegistrationImageUrl: businessRegistrationImageUrl || null,
            businessRegistrationImagePublicId: businessRegistrationImagePublicId || null,
            individualConfirmed,
            individualUsageNote: individualUsageNote || null,
          }
        : null,
    [
      businessType,
      bizNumber,
      businessName,
      representativeName,
      addressLine,
      businessRegistrationImageUrl,
      businessRegistrationImagePublicId,
      individualConfirmed,
      individualUsageNote,
    ],
  );

  const businessValidationError = useMemo(
    () => (signupBusinessPayload ? validateSignupBusinessInput(signupBusinessPayload) : '사업자 여부를 선택해 주세요.'),
    [signupBusinessPayload],
  );

  /** 인증번호 발송 — 약관 동의 없이 전송 가능 */
  const verificationSendPayload = useMemo(
    () => ({
      slug,
      name,
      adminLoginId,
      adminPassword: oauthActive ? '' : adminPassword,
      adminName,
      contactEmail,
      contactPhone,
      memberTermsAgreed: false,
      selectedPlan,
      referrerCode: referrerCode.trim() || undefined,
      referrerFromLink,
      signupToken: oauthActive ? signupToken : undefined,
    }),
    [
      slug,
      name,
      adminLoginId,
      adminPassword,
      adminName,
      contactEmail,
      contactPhone,
      selectedPlan,
      referrerCode,
      referrerFromLink,
      oauthActive,
      signupToken,
    ],
  );

  const handlePlanChange = (plan: TenantPlanId) => {
    setSelectedPlan(plan);
    if (codeSent || challengeId || oauthActive) {
      if (oauthActive) {
        clearSignupOAuth();
      } else {
        resetVerificationProgress();
      }
      setInfo('플랜을 변경했습니다. SNS 인증·이메일 인증번호를 다시 진행해 주세요.');
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError('');
    setInfo('');
    setOauthVerifying(true);
    try {
      const verified = await verifyGoogleSignupIdToken(idToken);
      applyOAuthVerifyResult(verified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google 인증에 실패했습니다.');
    } finally {
      setOauthVerifying(false);
    }
  };

  const handleGoogleButtonError = useCallback((message: string) => {
    setError(message);
  }, []);

  const showVerificationError = (message: string) => {
    setError(message);
    verificationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const validateBeforeSendCode = (): string | null => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (normalizedSlug.length < 2) {
      return '업체 코드를 2자 이상 입력해 주세요.';
    }
    if (slugHint && !slugHint.includes('사용 가능')) {
      return slugHint;
    }
    if (!name.trim()) {
      return '업체명을 입력해 주세요.';
    }
    const loginId = normalizeTenantLoginId(adminLoginId);
    if (!isValidTenantLoginId(loginId)) {
      return tenantLoginIdErrorMessage();
    }
    if (oauthActive) {
      if (!signupToken.trim()) {
        return `${oauthProviderLabel} 인증이 만료되었습니다. 다시 SNS로 시작해 주세요.`;
      }
    } else if (adminPassword.trim().length < 4) {
      return '관리자 비밀번호를 4자 이상 입력한 뒤 인증번호를 받아 주세요.';
    }
    const email = contactEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return '담당자 이메일 주소를 확인해 주세요.';
    }
    const phoneDigits = contactPhone.replace(/\D/g, '');
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
      return '담당자 휴대폰 번호를 확인해 주세요. (예: 01012345678)';
    }
    return null;
  };

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    const validationError = validateBeforeSendCode();
    if (validationError) {
      showVerificationError(validationError);
      return;
    }
    setSendingCode(true);
    try {
      const sent = await sendTenantSignupVerificationCode(verificationSendPayload);
      setChallengeId(sent.challengeId);
      setCodeSent(true);
      setInfo(`${contactEmail.trim()} 로 인증번호를 보냈습니다. 10분 이내에 아래 칸에 입력해 주세요.`);
    } catch (err) {
      showVerificationError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleBusinessFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    setBusinessUploading(true);
    try {
      const uploaded = await uploadTenantSignupBusinessRegistration(file);
      setBusinessRegistrationImageUrl(uploaded.businessRegistrationImageUrl);
      setBusinessRegistrationImagePublicId(uploaded.businessRegistrationImagePublicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사업자등록증 업로드에 실패했습니다.');
    } finally {
      setBusinessUploading(false);
      if (businessFileRef.current) businessFileRef.current.value = '';
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      showVerificationError('먼저 「이메일 인증번호 받기」를 눌러 인증번호를 받아 주세요.');
      return;
    }
    if (verificationCode.length < 6) {
      showVerificationError('이메일 인증번호 6자리를 입력해 주세요.');
      return;
    }
    if (!memberTermsAgreed) {
      setError('회원사 이용약관에 동의해 주세요.');
      termsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!signupBusinessPayload || businessValidationError) {
      setError(businessValidationError ?? '사업자 정보를 확인해 주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await completeTenantSignup({
        challengeId,
        contactEmail,
        verificationCode,
        memberTermsAgreed: true,
        ...signupBusinessPayload,
      });
      const signupQuery =
        oauthProvider === 'kakao' ? 'kakao' : oauthProvider === 'google' ? 'google' : '1';
      navigate(`/login?tenant=${encodeURIComponent(result.tenant.slug)}&signup=${signupQuery}`, {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="login-surface relative min-h-dvh min-h-screen overflow-y-auto overscroll-y-contain bg-[#f4f6f8]"
    >
      <div className="relative flex min-h-dvh flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:justify-center sm:py-14">
        <div className="login-scroll-content mx-auto w-full max-w-[480px]">
          <div className="mb-5 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.34em] text-slate-400">
              {PLATFORM_NAME_EN}
            </p>
            <div className="mt-3 flex justify-center">
              <TenantBrandLogo surface="on-light" className="h-10" />
            </div>
            <h1 className="mt-4 text-fluid-lg font-semibold text-slate-900">청소비서 가입하기</h1>
            <p className="mt-2 text-fluid-2xs leading-relaxed text-slate-500">
              Google·카카오 또는 이메일·비밀번호로 시작한 뒤 담당자 이메일 인증으로 가입을 완료합니다. 가입 후{' '}
              <strong>{TENANT_SIGNUP_PAID_TRIAL_DAYS}일(약 2개월)</strong> 동안 코인 제한 없이 이용할 수
              있습니다. 유료 플랜은 같은 기간 요금 없이 체험됩니다.
            </p>
          </div>

          <form
            onSubmit={handleComplete}
            onFocusCapture={onFieldFocus}
            className="space-y-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl shadow-slate-900/5"
          >
            {snsOAuthEnabled ? (
              <div className="space-y-3">
                {oauthActive ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                    <p className="text-fluid-xs font-semibold text-emerald-900">
                      {oauthProviderLabel} 계정 연결됨
                    </p>
                    {oauthProviderEmail ? (
                      <p className="mt-0.5 text-fluid-2xs text-emerald-800">{oauthProviderEmail}</p>
                    ) : null}
                    <p className="mt-1 text-fluid-2xs leading-relaxed text-emerald-900/80">
                      관리자 비밀번호는 설정하지 않습니다. 담당자 이메일 OTP로 본인 확인 후 가입을
                      마무리해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={clearSignupOAuth}
                      className="mt-2 text-fluid-2xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    >
                      다른 방식으로 가입
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-fluid-2xs leading-relaxed text-slate-600">
                      업체 최고 관리자(ADMIN) 계정만 Google·카카오로 개설할 수 있습니다.
                    </p>
                    <div className="space-y-2">
                      {googleOAuthEnabled && googleClientId ? (
                        <GoogleSignupButton
                          clientId={googleClientId}
                          disabled={oauthVerifying || loading || sendingCode}
                          onCredential={(credential) => {
                            void handleGoogleCredential(credential);
                          }}
                          onError={handleGoogleButtonError}
                        />
                      ) : null}
                      {kakaoOAuthEnabled && kakaoRestApiKey ? (
                        <KakaoSignupButton
                          restApiKey={kakaoRestApiKey}
                          disabled={oauthVerifying || loading || sendingCode}
                        />
                      ) : null}
                    </div>
                    {oauthVerifying ? (
                      <p className="text-center text-fluid-2xs text-slate-500">SNS 계정 확인 중…</p>
                    ) : null}
                  </>
                )}
                {!oauthActive ? (
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" aria-hidden />
                    <span className="shrink-0 text-fluid-2xs text-slate-400">또는 이메일·비밀번호로 가입</span>
                    <div className="h-px flex-1 bg-slate-200" aria-hidden />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">업체 코드</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className={`${inputClass} font-mono`}
                    placeholder="예: cbiseo"
                  required
                />
                {slugHint ? (
                  <p
                    className={`mt-1 text-fluid-2xs ${slugHint.includes('사용 가능') ? 'text-emerald-700' : 'text-amber-700'}`}
                  >
                    {slugChecking ? '확인 중…' : slugHint}
                  </p>
                ) : (
                  <p className="mt-1 text-fluid-2xs text-slate-500">로그인 시 입력하는 코드</p>
                )}
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">업체명</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </label>
            </div>

            <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
              <legend className="px-1 text-fluid-xs font-semibold text-slate-800">이용 플랜</legend>
              <p className="text-fluid-2xs text-slate-600">
                가입 후 {TENANT_SIGNUP_PAID_TRIAL_DAYS}일(약 2개월) 동안 코인 제한 없이 이용할 수 있습니다. 유료
                플랜은 같은 기간 요금 없이 체험됩니다.
              </p>
              <div className="space-y-2">
                {TENANT_SELF_SIGNUP_PLAN_IDS.map((planId) => {
                  const presentation = TENANT_PLAN_PRESENTATIONS[planId];
                  const isPaid = planId !== 'free';
                  const checked = selectedPlan === planId;
                  return (
                    <label
                      key={planId}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                        checked
                          ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900/10'
                          : 'border-slate-200 bg-white/80 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="signup-plan"
                        value={planId}
                        checked={checked}
                        onChange={() => handlePlanChange(planId)}
                        className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-slate-900 focus:ring-sky-500/30"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-fluid-xs font-semibold text-slate-900">
                            {presentation.label}
                          </span>
                          <span className="text-fluid-2xs text-slate-600">{presentation.monthlyPriceHint}</span>
                          {isPaid ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              {TENANT_SIGNUP_PAID_TRIAL_DAYS}일 무료
                            </span>
                          ) : (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                              코인 {TENANT_SIGNUP_PAID_TRIAL_DAYS}일 무제한
                            </span>
                          )}
                          {presentation.recommended ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                              추천
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-fluid-2xs leading-snug text-slate-500">
                          {presentation.tagline}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">관리자 실명</span>
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className={inputClass}
                  placeholder="홍길동"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">관리자 아이디</span>
                <input
                  value={adminLoginId}
                  onChange={(e) => setAdminLoginId(e.target.value.toLowerCase())}
                  className={`${inputClass} font-mono`}
                  required
                />
                <p className="mt-1 text-fluid-2xs text-slate-500">{tenantLoginIdErrorMessage()}</p>
              </label>
            </div>

            {!oauthActive ? (
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">관리자 비밀번호</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className={inputClass}
                  minLength={4}
                  required
                />
              </label>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">담당자 이메일 (인증·비밀번호 찾기)</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                  required
                />
                {oauthActive ? (
                  <p className="mt-1 text-fluid-2xs leading-relaxed text-slate-500">
                    SNS에 등록된 이메일과 다를 수 있습니다. 본인 확인용 이메일을 인증해 주세요.
                  </p>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">담당자 휴대폰</span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={inputClass}
                  placeholder="01012345678"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-fluid-xs font-medium text-slate-600">추천인 코드 (선택)</span>
              <input
                value={referrerCode}
                onChange={(e) => {
                  setReferrerCode(e.target.value.toLowerCase());
                  setReferrerFromLink(false);
                }}
                className={`${inputClass} font-mono`}
                placeholder="추천 링크로 들어오면 자동 입력됩니다"
              />
              {referrerHint ? (
                <p
                  className={`mt-1 text-fluid-2xs ${referrerHint.includes('확인') ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {referrerChecking ? '확인 중…' : referrerHint}
                </p>
              ) : (
                <p className="mt-1 text-fluid-2xs text-slate-500">입력 시 가입 업체에 추천인이 연결됩니다.</p>
              )}
            </label>

            <section
              ref={termsSectionRef}
              className={`space-y-2 rounded-xl border px-3 py-3 ${
                memberTermsAgreed
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <p className="text-fluid-xs font-semibold text-slate-800">
                이용약관 동의 <span className="text-red-600">(필수)</span>
              </p>
              <p className="text-fluid-2xs leading-relaxed text-slate-600">
                아래 문서를 확인한 뒤 「동의합니다」를 눌러 주세요.
              </p>
              {legalLoadErr ? (
                <p className="text-fluid-2xs text-amber-800">{legalLoadErr}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {termsDoc ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-2xs font-semibold text-sky-900 hover:border-sky-300 hover:bg-sky-50/80"
                    onClick={() => setViewerDoc(termsDoc)}
                  >
                    {termsDoc.title} 보기
                  </button>
                ) : null}
                {privacyDoc ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-fluid-2xs font-semibold text-sky-900 hover:border-sky-300 hover:bg-sky-50/80"
                    onClick={() => setViewerDoc(privacyDoc)}
                  >
                    {privacyDoc.title} 보기
                  </button>
                ) : null}
                {!termsDoc && !privacyDoc && !legalLoadErr ? (
                  <p className="text-fluid-2xs text-slate-500">약관 불러오는 중…</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (memberTermsAgreed) {
                    setMemberTermsAgreed(false);
                    return;
                  }
                  if (termsDoc) {
                    setViewerDoc(termsDoc);
                    return;
                  }
                  setMemberTermsAgreed(true);
                }}
                className={`w-full rounded-xl py-2.5 text-fluid-xs font-semibold transition ${
                  memberTermsAgreed
                    ? 'border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {memberTermsAgreed ? '동의함 · 다시 확인하려면 누르세요' : '약관 확인 후 동의합니다'}
              </button>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={memberTermsAgreed}
                  onChange={(e) => setMemberTermsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="text-fluid-2xs leading-relaxed text-slate-700">
                  위{' '}
                  {termsDoc ? (
                    <button
                      type="button"
                      className="font-semibold text-sky-800 underline-offset-2 hover:underline"
                      onClick={() => setViewerDoc(termsDoc)}
                    >
                      {termsDoc.title}
                    </button>
                  ) : (
                    <Link
                      to={`/legal/${PLATFORM_LEGAL_MEMBER_TERMS_SLUG}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-800 underline-offset-2 hover:underline"
                    >
                      회원사 이용약관
                    </Link>
                  )}
                  및{' '}
                  {privacyDoc ? (
                    <button
                      type="button"
                      className="font-semibold text-sky-800 underline-offset-2 hover:underline"
                      onClick={() => setViewerDoc(privacyDoc)}
                    >
                      {privacyDoc.title}
                    </button>
                  ) : (
                    <Link
                      to={`/legal/${PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-800 underline-offset-2 hover:underline"
                    >
                      개인정보 처리방침
                    </Link>
                  )}
                  을 확인하였으며 동의합니다.
                </span>
              </label>
            </section>

            <div ref={verificationSectionRef} className="space-y-2">
              <label className="block">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-fluid-xs font-medium text-slate-600">이메일 인증번호 (6자리)</span>
                  <button
                    type="button"
                    disabled={sendingCode || loading}
                    onClick={() => void handleSendCode()}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-fluid-2xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {sendingCode ? '발송 중…' : codeSent ? '재발송' : '인증번호 받기'}
                  </button>
                </div>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} text-center font-mono tracking-[0.3em]`}
                  placeholder="000000"
                  required
                />
              </label>
              {error ? (
                <p
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {info ? <p className="text-fluid-2xs text-sky-800">{info}</p> : null}
              {!error && !info && !codeSent ? (
                <p className="text-fluid-2xs text-slate-500">
                  업체 코드·비밀번호·이메일·휴대폰을 입력한 뒤 「인증번호 받기」를 눌러 주세요. 재발송은 60초
                  후 가능합니다.
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
              <legend className="px-1 text-fluid-xs font-semibold text-slate-800">
                사업자 구분 <span className="text-red-600">(필수)</span>
              </legend>
              <div className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
                {(
                  [
                    ['registered_business', '사업자입니다'],
                    ['individual', '사업자가 아닙니다'],
                  ] as const
                ).map(([value, label]) => {
                  const checked = businessType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBusinessType(value)}
                      className={`min-h-9 flex-1 rounded-md px-2 py-1.5 text-fluid-2xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 ${
                        checked ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {businessType === 'registered_business' ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-fluid-xs font-medium text-slate-600">사업자등록번호</span>
                    <input
                      value={bizNumber}
                      onChange={(e) => setBizNumber(normalizeBizNumber(e.target.value))}
                      className={`${inputClass} font-mono`}
                      placeholder="0000000000"
                      inputMode="numeric"
                      required
                    />
                    <p className="mt-1 text-fluid-2xs text-slate-500">숫자 10자리 (하이픈 없이 입력)</p>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-fluid-xs font-medium text-slate-600">상호</span>
                      <input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-fluid-xs font-medium text-slate-600">대표자명</span>
                      <input
                        value={representativeName}
                        onChange={(e) => setRepresentativeName(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-fluid-xs font-medium text-slate-600">사업장 주소 (선택)</span>
                    <input
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-fluid-xs font-medium text-slate-600">사업자등록증</span>
                    <input
                      ref={businessFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="block w-full text-fluid-2xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-fluid-2xs file:font-semibold"
                      onChange={(e) => void handleBusinessFile(e.target.files?.[0] ?? null)}
                    />
                    {businessUploading ? (
                      <p className="mt-1 text-fluid-2xs text-slate-500">업로드 중…</p>
                    ) : null}
                    {businessRegistrationImageUrl ? (
                      <div className="mt-2">
                        <ImageThumbLightbox
                          src={businessRegistrationImageUrl}
                          alt="사업자등록증 미리보기"
                          thumbClassName="h-24 w-auto rounded-lg border border-slate-200 object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {businessType === 'individual' ? (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={individualConfirmed}
                      onChange={(e) => setIndividualConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-fluid-2xs leading-relaxed text-slate-700">
                      사업자등록 없이 청소비서를 이용합니다. 입력 정보는 약관에 따라 처리됩니다.
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-fluid-xs font-medium text-slate-600">이용 형태 (선택)</span>
                    <select
                      value={individualUsageNote}
                      onChange={(e) => setIndividualUsageNote(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택</option>
                      <option value="개인">개인</option>
                      <option value="프리랜서">프리랜서</option>
                      <option value="기타">기타</option>
                    </select>
                  </label>
                </div>
              ) : null}

              {businessType && businessValidationError ? (
                <p className="text-fluid-2xs text-amber-800">{businessValidationError}</p>
              ) : null}
            </fieldset>

            {error && challengeId ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                loading ||
                verificationCode.length < 6 ||
                !challengeId ||
                !businessType ||
                Boolean(businessValidationError)
              }
              className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? '가입 처리 중…' : '가입 완료 · 업체 개설'}
            </button>
          </form>

          <p className="mt-5 text-center text-fluid-2xs text-slate-500">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-medium text-slate-800 underline-offset-2 hover:underline">
              로그인
            </Link>
          </p>
          <p className="mt-2 text-center text-fluid-2xs text-slate-400">
            © {new Date().getFullYear()} {PLATFORM_NAME}
          </p>
        </div>
      </div>
      <LegalDocumentViewerModal
        legalDocument={viewerDoc}
        onClose={() => setViewerDoc(null)}
        onAgree={() => {
          setMemberTermsAgreed(true);
          setViewerDoc(null);
        }}
        agreeLabel="동의합니다"
      />
    </div>
  );
}
