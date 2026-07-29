import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLATFORM_NAME, PLATFORM_NAME_EN } from '@shared/platformBrand';
import { TenantBrandLogo } from '../components/brand/TenantBrandLogo';
import { confirmPasswordReset, sendPasswordResetCode } from '../api/passwordReset';
import { useLoginScrollSurface } from '../hooks/useMobileInputVisibility';

const inputClass =
  'login-field-input w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-sky-500/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10';

type Step = 'request' | 'confirm';

export function TenantForgotPasswordPage() {
  const navigate = useNavigate();
  const { scrollRef } = useLoginScrollSurface();
  const [step, setStep] = useState<Step>('request');
  const [tenantSlug, setTenantSlug] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const sent = await sendPasswordResetCode({ tenantSlug, recoveryEmail });
      setChallengeId(sent.challengeId);
      setInfo(sent.message);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증번호 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await confirmPasswordReset({
        tenantSlug,
        recoveryEmail,
        challengeId,
        verificationCode,
        newPassword,
      });
      navigate(
        `/login?tenant=${encodeURIComponent(result.tenantSlug)}&passwordReset=1`,
        { replace: true, state: { loginId: result.loginId } },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
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
        <div className="login-scroll-content mx-auto w-full max-w-[420px]">
          <div className="mb-5 text-center">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.34em] text-slate-400">
              {PLATFORM_NAME_EN}
            </p>
            <div className="mt-3 flex justify-center">
              <TenantBrandLogo surface="on-light" className="h-10" />
            </div>
            <h1 className="mt-4 text-fluid-lg font-semibold text-slate-900">비밀번호 찾기</h1>
            <p className="mt-2 text-fluid-2xs leading-relaxed text-slate-500">
              업체 개설 시 인증한 담당자 이메일로 인증번호를 보냅니다.
            </p>
          </div>

          {step === 'request' ? (
            <form onSubmit={handleSendCode} className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl">
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">업체 코드</span>
                <input
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  className={`${inputClass} font-mono`}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">가입 시 인증한 이메일</span>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </label>
              {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? '발송 중…' : '인증번호 받기'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl">
              {info ? (
                <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-fluid-2xs text-sky-900">
                  {info}
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">이메일 인증번호</span>
                <input
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass} text-center font-mono tracking-[0.3em]`}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">새 비밀번호</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  minLength={4}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-fluid-xs font-medium text-slate-600">새 비밀번호 확인</span>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className={inputClass}
                  minLength={4}
                  required
                />
              </label>
              {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="w-full rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? '변경 중…' : '비밀번호 변경'}
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 py-2 text-fluid-2xs font-semibold text-slate-700"
                onClick={() => setStep('request')}
              >
                이메일 다시 입력
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-fluid-2xs text-slate-500">
            <Link to="/login" className="font-medium text-slate-800 underline-offset-2 hover:underline">
              로그인으로 돌아가기
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
