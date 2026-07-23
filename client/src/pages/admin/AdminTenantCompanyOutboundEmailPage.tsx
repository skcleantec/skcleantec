import { useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { TenantSmtpFieldLabel } from '../../components/admin/TenantSmtpFieldLabel';
import {
  PROVIDER_PRESETS,
  TenantSmtpSetupGuideModal,
} from '../../components/admin/TenantSmtpSetupGuideModal';
import { CompanyProfileSuccessModal } from './CompanyProfileSuccessModal';
import { useOutboundEmailSettingsForm } from './useOutboundEmailSettingsForm';

export function AdminTenantCompanyOutboundEmailPage() {
  const form = useOutboundEmailSettingsForm();
  const [guideOpen, setGuideOpen] = useState(false);

  if (form.loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  const isBrandScope = Boolean(form.smtpScope);

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <PageTitleWithFavorite label="발송 이메일 설정">
          <h1 className="text-xl font-semibold text-gray-800">발송 이메일 설정</h1>
        </PageTitleWithFavorite>
        <p className="mt-1 text-sm text-gray-500">
          현장 검수 완료본·견적서 등 고객 발송 메일을 업체 메일 계정(SMTP)으로 보냅니다.
        </p>
      </div>

      {form.hasOperatingCompanies ? (
        <section className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">설정 대상</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => form.selectScope('')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                !form.smtpScope
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              공통 기본
            </button>
            {form.operatingCompanies.map((oc) => (
              <button
                key={oc.id}
                type="button"
                onClick={() => form.selectScope(oc.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  form.smtpScope === oc.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {oc.displayName}
              </button>
            ))}
          </div>
          {isBrandScope ? (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              <span className="font-medium text-gray-700">{form.scopeLabel}</span> 전용 SMTP입니다.
              비워 두거나 저장하지 않으면 <span className="font-medium">공통 기본</span> 설정으로 발송됩니다.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              브랜드별 전용 SMTP가 없을 때 사용하는 기본 설정입니다.
            </p>
          )}
        </section>
      ) : null}

      {form.err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {form.err}
        </p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              SMTP 설정{form.hasOperatingCompanies ? ` · ${form.scopeLabel}` : ''}
            </h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              Gmail·네이버 등에서 앱 비밀번호(또는 메일 전용 비밀번호)를 준비해 주세요.
              {form.profile?.globalSmtpFallbackAvailable && !isBrandScope ? (
                <span className="block mt-1 text-amber-800">
                  서버 기본 SMTP가 있어 아래를 비워 두면 플랫폼 계정으로 발송될 수 있습니다. 고객에게는 업체
                  이름·메일로 보내려면 여기서 설정하세요.
                </span>
              ) : null}
              {isBrandScope && !form.smtpReady && form.effectiveConfigured ? (
                <span className="block mt-1 text-sky-800">
                  이 브랜드 전용 SMTP는 없지만, 공통 기본(또는 서버 기본)으로 발송 가능합니다.
                </span>
              ) : null}
            </p>
            {form.smtpReady ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">설정 완료 — 발송 가능</p>
            ) : form.effectiveConfigured ? (
              <p className="mt-2 text-xs font-medium text-sky-700">공통 기본 SMTP로 발송됩니다</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-amber-700">미설정 — 메일이 발송되지 않습니다</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
          >
            설정 방법 보기
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="w-full text-[11px] font-medium text-gray-500">빠른 입력 (서버·포트만 채움)</span>
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                form.setSmtpHost(preset.host);
                form.setSmtpPort(preset.port);
                form.setSmtpSecure(preset.secure);
              }}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 hover:bg-gray-50"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="메일 서버 주소"
              technicalTerm="SMTP 호스트"
              hint="예: smtp.gmail.com, smtp.naver.com"
              helpText={`메일 업체가 안내하는 SMTP 서버 주소입니다.\nGmail: smtp.gmail.com\n네이버: smtp.naver.com`}
            />
            <input
              type="text"
              value={form.smtpHost}
              onChange={(e) => form.setSmtpHost(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder="smtp.gmail.com"
            />
          </label>
          <label className="block">
            <TenantSmtpFieldLabel
              title="연결 포트"
              technicalTerm="Port"
              hint="Gmail·네이버는 보통 587"
              helpText="587: 일반 연결(SSL 체크 해제)\n465: SSL 암호화 연결(SSL 체크)"
            />
            <input
              type="number"
              value={form.smtpPort}
              onChange={(e) => form.setSmtpPort(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              min={1}
              max={65535}
            />
          </label>
          <label className="flex items-start gap-2 pt-1 sm:pt-6">
            <input
              type="checkbox"
              checked={form.smtpSecure}
              onChange={(e) => form.setSmtpSecure(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span className="min-w-0">
              <span className="text-sm font-medium text-gray-800">SSL 암호화 연결</span>
              <span className="block text-[11px] text-gray-400">(465 포트·다음/카카오 등)</span>
              <span className="block text-xs text-gray-500 mt-0.5">Gmail·네이버 587 사용 시 체크 해제</span>
            </span>
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="메일 계정"
              technicalTerm="로그인 이메일"
              hint="메일함 로그인에 쓰는 전체 주소 (@ 포함)"
              helpText={`Gmail은 you@gmail.com 처럼 @까지 전부 입력하세요.\n로그인 계정과 「보내는 사람」 이메일이 같으면 오류가 적습니다.`}
            />
            <input
              type="text"
              value={form.smtpUser}
              onChange={(e) => form.setSmtpUser(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="your@gmail.com"
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="보내는 사람 표시"
              technicalTerm="From"
              hint="고객 메일함에 보이는 이름·주소"
              helpText={`예: "${form.companyName || '회사명'}" <your@gmail.com>\n이메일 부분은 위 「메일 계정」과 같은 주소를 권장합니다.`}
            />
            <input
              type="text"
              value={form.smtpFrom}
              onChange={(e) => form.setSmtpFrom(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={`"${form.companyName || '회사명'}" <noreply@company.com>`}
            />
          </label>
          <label className="block sm:col-span-2">
            <TenantSmtpFieldLabel
              title="앱 비밀번호"
              technicalTerm="SMTP 비밀번호"
              hint="일반 로그인 비밀번호가 아닌, 메일 연동용 비밀번호"
              helpText={`Gmail: Google 계정 → 보안 → 앱 비밀번호 (16자리)\n네이버: 메일 환경설정에서 SMTP 사용 후 네이버 비밀번호\n저장 후에는 ●●●● 로만 표시됩니다. 변경할 때만 다시 입력하세요.`}
            />
            <input
              type="password"
              value={form.smtpPassword}
              onChange={(e) => form.setSmtpPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={form.passwordConfigured ? '●●●●●●●● (변경 시에만 입력)' : '앱 비밀번호 입력 (필수)'}
              autoComplete="new-password"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={form.busy}
            onClick={() => void form.handleSaveSmtp()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {form.busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">테스트 메일 발송</h3>
        <p className="text-xs text-gray-600">
          저장한 뒤, {form.scopeLabel} 설정으로 본인 메일함에 테스트 메일을 보내 연결을 확인할 수 있습니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-xs text-gray-700">수신 이메일</span>
            <input
              type="email"
              value={form.testEmailTo}
              onChange={(e) => form.setTestEmailTo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder={form.contactEmail || 'test@example.com'}
            />
          </label>
          <button
            type="button"
            disabled={form.busy || !form.smtpReady}
            onClick={() => void form.handleTestEmail()}
            className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
          >
            테스트 발송
          </button>
        </div>
      </section>

      {guideOpen ? (
        <TenantSmtpSetupGuideModal companyName={form.companyName} onClose={() => setGuideOpen(false)} />
      ) : null}

      <CompanyProfileSuccessModal message={form.successModal} onClose={() => form.setSuccessModal(null)} />
    </div>
  );
}
