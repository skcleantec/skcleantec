import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLATFORM_NAME, PLATFORM_NAME_EN } from '@shared/platformBrand';
import { TENANT_PLAN_PRESENTATIONS } from '@shared/tenantPlanCatalog';
import { tenantLoginIdErrorMessage } from '@shared/tenantLoginId';
import { TenantBrandLogo } from '../components/brand/TenantBrandLogo';
import { checkTenantSignupSlug, submitTenantSignup } from '../api/tenantSignup';
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
  const [adminName, setAdminName] = useState('관리자');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [memberTermsAgreed, setMemberTermsAgreed] = useState(false);
  const [slugHint, setSlugHint] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const freePlanHint = useMemo(
    () => TENANT_PLAN_PRESENTATIONS.free.tagline,
    [],
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await submitTenantSignup({
        slug,
        name,
        adminLoginId,
        adminPassword,
        adminName,
        contactEmail,
        contactPhone: contactPhone.trim() || undefined,
        memberTermsAgreed,
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
            <h1 className="mt-4 text-fluid-lg font-semibold text-slate-900">업체 개설 (무료 플랜)</h1>
            <p className="mt-2 text-fluid-2xs leading-relaxed text-slate-500">
              청소 업체 계정을 만들고 바로 Free 플랜으로 시작합니다. 유료 플랜은 가입 후 신청·승인 후 이용합니다.
            </p>
            <p className="mt-1 text-fluid-2xs text-slate-600">{freePlanHint}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl shadow-slate-900/5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">업체 코드</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className={`${inputClass} font-mono`}
                  placeholder="예: acme-clean"
                  required
                />
                {slugHint ? (
                  <p
                    className={`mt-1 text-fluid-2xs ${slugHint.includes('사용 가능') ? 'text-emerald-700' : 'text-amber-700'}`}
                  >
                    {slugChecking ? '확인 중…' : slugHint}
                  </p>
                ) : (
                  <p className="mt-1 text-fluid-2xs text-slate-500">로그인 시 입력하는 코드 (영문 소문자·숫자·하이픈)</p>
                )}
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">업체명</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">관리자 이름</span>
                <input value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass} required />
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
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">담당자 이메일</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">담당자 연락처 (선택)</span>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <input
                type="checkbox"
                checked={memberTermsAgreed}
                onChange={(e) => setMemberTermsAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                required
              />
              <span className="text-fluid-2xs leading-relaxed text-slate-700">
                <strong className="font-semibold">회원사 이용약관</strong> 및 개인정보 처리에 동의합니다. (Free 플랜으로
                가입하며, Standard 이상 유료 플랜은 별도 신청·플랫폼 승인 후 이용합니다.)
              </span>
            </label>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-fluid-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? '가입 처리 중…' : '무료 플랜으로 업체 개설'}
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
    </div>
  );
}
