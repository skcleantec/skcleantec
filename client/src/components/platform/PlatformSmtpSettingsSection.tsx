import { useState } from 'react';
import { PROVIDER_PRESETS } from '../admin/TenantSmtpSetupGuideModal';
import { TenantSmtpFieldLabel } from '../admin/TenantSmtpFieldLabel';
import { BTN_SECONDARY, INPUT_BASE } from '../../utils/platformUi';
import type { PlatformSmtpSettingsPublic } from '../../api/platformBilling';

export type PlatformSmtpFormState = {
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  smtpPassword: string;
  smtpPasswordConfigured: boolean;
};

export function smtpFormFromSettings(smtp: PlatformSmtpSettingsPublic): PlatformSmtpFormState {
  return {
    smtpHost: smtp.host,
    smtpPort: String(smtp.port || 587),
    smtpSecure: smtp.secure,
    smtpUser: smtp.user,
    smtpFrom: smtp.from,
    smtpPassword: '',
    smtpPasswordConfigured: smtp.passwordConfigured,
  };
}

export function smtpPatchFromForm(form: PlatformSmtpFormState) {
  return {
    host: form.smtpHost.trim(),
    port: Number(form.smtpPort) || 587,
    secure: form.smtpSecure,
    user: form.smtpUser.trim(),
    from: form.smtpFrom.trim(),
    ...(form.smtpPassword.trim() ? { password: form.smtpPassword } : {}),
  };
}

type Props = {
  smtp: PlatformSmtpFormState;
  onChange: (patch: Partial<PlatformSmtpFormState>) => void;
  effectiveConfigured?: boolean;
  envFallbackAvailable?: boolean;
  onTest?: (to: string) => Promise<void>;
  testing?: boolean;
};

export function PlatformSmtpSettingsSection({
  smtp,
  onChange,
  effectiveConfigured,
  envFallbackAvailable,
  onTest,
  testing = false,
}: Props) {
  const [testTo, setTestTo] = useState('');

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 leading-relaxed">
          입금 확인 요청·도움말 문의 등 플랫폼 알림 메일 발송에 사용합니다. Gmail·네이버는 앱 비밀번호가
          필요합니다.
        </p>
        {effectiveConfigured ? (
          <p className="mt-2 text-xs font-medium text-emerald-700">발송 가능</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-amber-700">미설정 — 알림 메일이 발송되지 않습니다</p>
        )}
        {envFallbackAvailable && !smtp.smtpPasswordConfigured && !smtp.smtpHost.trim() ? (
          <p className="mt-1 text-xs text-sky-800">
            서버 환경변수(SMTP_*)에 기본 설정이 있습니다. 아래를 저장하면 DB 설정이 우선합니다.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="w-full text-[11px] font-medium text-gray-500">빠른 입력</span>
        {PROVIDER_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() =>
              onChange({
                smtpHost: preset.host,
                smtpPort: preset.port,
                smtpSecure: preset.secure,
              })
            }
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 hover:bg-gray-50"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <TenantSmtpFieldLabel
            title="메일 서버 주소"
            technicalTerm="SMTP 호스트"
            hint="예: smtp.gmail.com"
            helpText="메일 업체가 안내하는 SMTP 서버 주소입니다."
          />
          <input
            className={`mt-1 ${INPUT_BASE} font-mono`}
            value={smtp.smtpHost}
            onChange={(e) => onChange({ smtpHost: e.target.value })}
            placeholder="smtp.gmail.com"
          />
        </label>
        <label className="block text-sm">
          <TenantSmtpFieldLabel title="연결 포트" technicalTerm="Port" hint="보통 587" helpText="587 또는 465" />
          <input
            type="number"
            min={1}
            max={65535}
            className={`mt-1 ${INPUT_BASE}`}
            value={smtp.smtpPort}
            onChange={(e) => onChange({ smtpPort: e.target.value })}
          />
        </label>
        <label className="flex items-start gap-2 pt-1 sm:pt-6 text-sm">
          <input
            type="checkbox"
            checked={smtp.smtpSecure}
            onChange={(e) => onChange({ smtpSecure: e.target.checked })}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium text-gray-800">SSL 암호화 연결</span>
            <span className="block text-xs text-gray-500">465 포트·다음/카카오 등</span>
          </span>
        </label>
        <label className="block text-sm sm:col-span-2">
          <TenantSmtpFieldLabel
            title="메일 계정"
            technicalTerm="로그인 이메일"
            hint="@ 포함 전체 주소"
            helpText="SMTP 로그인에 쓰는 이메일 주소"
          />
          <input
            className={`mt-1 ${INPUT_BASE}`}
            value={smtp.smtpUser}
            onChange={(e) => onChange({ smtpUser: e.target.value })}
            placeholder="your@gmail.com"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <TenantSmtpFieldLabel
            title="보내는 사람 표시"
            technicalTerm="From"
            hint="수신자에게 보이는 이름·주소"
            helpText={`예: "청소비서" <noreply@company.com>`}
          />
          <input
            className={`mt-1 ${INPUT_BASE}`}
            value={smtp.smtpFrom}
            onChange={(e) => onChange({ smtpFrom: e.target.value })}
            placeholder='"청소비서" <noreply@company.com>'
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <TenantSmtpFieldLabel
            title="앱 비밀번호"
            technicalTerm="SMTP 비밀번호"
            hint="메일 연동용 비밀번호"
            helpText="저장 후에는 ●●●● 로만 표시됩니다. 변경할 때만 다시 입력하세요."
          />
          <input
            type="password"
            className={`mt-1 ${INPUT_BASE}`}
            value={smtp.smtpPassword}
            onChange={(e) => onChange({ smtpPassword: e.target.value })}
            placeholder={smtp.smtpPasswordConfigured ? '●●●●●●●● (변경 시에만 입력)' : '앱 비밀번호 입력 (필수)'}
            autoComplete="new-password"
          />
        </label>
      </div>

      {onTest ? (
        <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-gray-100">
          <label className="block text-sm flex-1 min-w-[200px]">
            <span className="text-gray-600">테스트 수신 이메일</span>
            <input
              type="email"
              className={`mt-1 ${INPUT_BASE}`}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="본인 이메일"
            />
          </label>
          <button
            type="button"
            disabled={testing || !testTo.trim()}
            onClick={() => void onTest(testTo.trim())}
            className={BTN_SECONDARY}
          >
            {testing ? '발송 중…' : '테스트 발송'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
