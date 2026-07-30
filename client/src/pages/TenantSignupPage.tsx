import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLATFORM_NAME, PLATFORM_NAME_EN } from '@shared/platformBrand';
import {
  PLATFORM_LEGAL_MEMBER_PRIVACY_SLUG,
  PLATFORM_LEGAL_MEMBER_TERMS_SLUG,
} from '@shared/platformLegalSlugs';
import { tenantLoginIdErrorMessage } from '@shared/tenantLoginId';
import type { TenantPlanId } from '@shared/tenantFeatureModules';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import {
  TENANT_SELF_SIGNUP_PLAN_IDS,
  TENANT_SIGNUP_PAID_TRIAL_DAYS,
} from '@shared/tenantSignup';
import { TenantBrandLogo } from '../components/brand/TenantBrandLogo';
import { LegalDocumentViewerModal } from '../components/auth/LegalDocumentViewerModal';
import {
  checkTenantSignupSlug,
  completeTenantSignup,
  sendTenantSignupVerificationCode,
} from '../api/tenantSignup';
import { fetchSignupLegalDocuments, type PublicLegalDocument } from '../api/platformLegal';
import { useLoginScrollSurface } from '../hooks/useMobileInputVisibility';

const inputClass =
  'login-field-input w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10';

export function TenantSignupPage() {
  const navigate = useNavigate();
  const { scrollRef } = useLoginScrollSurface();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [memberTermsAgreed, setMemberTermsAgreed] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TenantPlanId>('free');
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

  /** 인증번호 발송 — 약관 동의 없이 전송 가능 */
  const verificationSendPayload = useMemo(
    () => ({
      slug,
      name,
      adminLoginId,
      adminPassword,
      adminName,
      contactEmail,
      contactPhone,
      memberTermsAgreed: false,
      selectedPlan,
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
    ],
  );

  const handlePlanChange = (plan: TenantPlanId) => {
    setSelectedPlan(plan);
    if (codeSent || challengeId) {
      setCodeSent(false);
      setChallengeId('');
      setVerificationCode('');
      setInfo('플랜을 변경했습니다. 인증번호를 다시 받아 주세요.');
    }
  };

  const handleSendCode = async () => {
    setError('');
    setInfo('');
    setSendingCode(true);
    try {
      const sent = await sendTenantSignupVerificationCode(verificationSendPayload);
      setChallengeId(sent.challengeId);
      setCodeSent(true);
      setInfo(`${contactEmail.trim()} 로 인증번호를 보냈습니다. 10분 이내에 아래 칸에 입력해 주세요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) {
      setError('먼저 「이메일 인증번호 받기」를 눌러 인증번호를 받아 주세요.');
      return;
    }
    if (verificationCode.length < 6) {
      setError('이메일 인증번호 6자리를 입력해 주세요.');
      return;
    }
    if (!memberTermsAgreed) {
      setError('회원사 이용약관에 동의해 주세요.');
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
      });
      navigate(`/login?tenant=${encodeURIComponent(result.tenant.slug)}&signup=1`, { replace: true });
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
              플랜을 선택한 뒤 이메일 인증으로 가입합니다. 유료 플랜은 가입 시{' '}
              <strong>{TENANT_SIGNUP_PAID_TRIAL_DAYS}일(약 2개월)</strong> 무료 체험이 제공됩니다.
            </p>
          </div>

          <form
            onSubmit={handleComplete}
            className="space-y-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl shadow-slate-900/5"
          >
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
                유료 플랜 선택 시 가입일부터 {TENANT_SIGNUP_PAID_TRIAL_DAYS}일간 요금 없이 이용할 수 있습니다.
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
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              {TENANT_SIGNUP_PAID_TRIAL_DAYS}일 무료
                            </span>
                          ) : null}
                          {presentation.recommended ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
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
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">관리자 이름</span>
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
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-fluid-xs font-medium text-slate-600">이메일 인증번호 (6자리)</span>
                <button
                  type="button"
                  disabled={sendingCode || loading}
                  onClick={() => void handleSendCode()}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-fluid-2xs font-semibold text-slate-700 disabled:opacity-60"
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
              {info ? <p className="mt-1 text-fluid-2xs text-sky-800">{info}</p> : null}
            </label>

            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
              <p className="text-fluid-xs font-semibold text-slate-800">이용약관 확인</p>
              <p className="text-fluid-2xs leading-relaxed text-slate-600">
                반드시 이용약관을 확인 후 확인 버튼을 눌러 주세요.
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
            </section>

            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
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

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                loading || verificationCode.length < 6 || !challengeId || !memberTermsAgreed
              }
              className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? '가입 처리 중…' : '인증 완료 · 업체 개설'}
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
      <LegalDocumentViewerModal legalDocument={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}
