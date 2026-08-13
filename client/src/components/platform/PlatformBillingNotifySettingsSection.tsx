import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLATFORM_SYSTEM_MAIL_FROM } from '@shared/platformWorkspace';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import { platformSettingsTabPath } from '../../pages/platform/settings/platformSettingsTabs';

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  onTestEmail?: (testTo?: string) => void | Promise<void>;
  testingEmail?: boolean;
  /** 미결재 팝업 페이지 등에서 SMTP 링크 문구만 다를 때 */
  compactIntro?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PlatformBillingNotifySettingsSection({
  email,
  onEmailChange,
  onSave,
  saving,
  onTestEmail,
  testingEmail = false,
  compactIntro = false,
}: Props) {
  const [testTo, setTestTo] = useState('');
  const trimmed = email.trim();
  const emailValid = trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);

  return (
    <section className={CARD_SECTION}>
      <h2 className="text-sm font-semibold text-gray-900">입금 확인 요청 알림</h2>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">
        업체(ADMIN)가 미결재 팝업에서 「입금 확인 요청」을 누르면,{' '}
        <strong>업체에게는 메일이 가지 않고</strong> 아래에 저장한 운영팀 메일로만 알림이
        발송됩니다. 발송(SMTP)은{' '}
        <Link to={platformSettingsTabPath('smtp')} className="text-blue-600 hover:underline">
          설정 → SMTP
        </Link>
        의 「플랫폼 알림 (cbiseo)」 프로필을 사용합니다.
        {!compactIntro ? (
          <>
            {' '}
            발신 From: <span className="font-mono text-gray-700">{PLATFORM_SYSTEM_MAIL_FROM}</span>
            · 제목 예: [업체명] 입금확인요청
          </>
        ) : null}
      </p>

      <label className="mt-4 block text-sm">
        <span className="text-gray-600">
          알림 받을 이메일 <span className="text-red-600">*</span>
        </span>
        <input
          type="email"
          required
          className={`mt-1 ${INPUT_BASE}`}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="운영팀 수신 메일 (예: billing@service-bridges.com 또는 개인 Gmail)"
          autoComplete="email"
        />
        {!trimmed ? (
          <p className="mt-1 text-xs text-amber-800">
            저장된 수신 이메일이 없으면 업체의 「입금 확인 요청」 버튼이 비활성화됩니다.
          </p>
        ) : !emailValid ? (
          <p className="mt-1 text-xs text-red-700">이메일 형식을 확인해 주세요.</p>
        ) : (
          <p className="mt-1 text-xs text-emerald-800">
            저장 후 업체 입금 확인 요청 알림이 이 주소로 발송됩니다.
          </p>
        )}
      </label>

      {onTestEmail ? (
        <label className="mt-3 block text-sm">
          <span className="text-gray-600">연습 수신 (선택)</span>
          <input
            type="email"
            className={`mt-1 ${INPUT_BASE}`}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="비우면 위 알림 이메일로 발송"
            autoComplete="email"
          />
          <p className="mt-1 text-xs text-gray-500">
            실제 입금 확인 알림과 같은 형식으로 연습 메일을 보냅니다. 다른 주소로 SMTP만 확인하려면
            여기에 입력하세요.
          </p>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        {onTestEmail ? (
          <button
            type="button"
            disabled={saving || testingEmail || !emailValid}
            onClick={() => void onTestEmail(testTo.trim() || undefined)}
            className={BTN_SECONDARY}
          >
            {testingEmail ? '보내는 중…' : '테스트 메일 보내기'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || testingEmail || !emailValid}
          onClick={() => void onSave()}
          className={BTN_PRIMARY}
        >
          {saving ? '저장 중…' : '알림 이메일 저장'}
        </button>
      </div>
    </section>
  );
}
