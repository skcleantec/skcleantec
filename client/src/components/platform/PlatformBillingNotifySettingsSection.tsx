import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
  PLATFORM_BILLING_NOTIFY_GROUP_LABEL,
  PLATFORM_SYSTEM_MAIL_FROM,
  PLATFORM_WORKSPACE_DOMAIN,
} from '@shared/platformWorkspace';
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
  const usingDefault =
    !email.trim() || email.trim().toLowerCase() === PLATFORM_BILLING_NOTIFY_GROUP_EMAIL.toLowerCase();

  return (
    <section className={CARD_SECTION}>
      <h2 className="text-sm font-semibold text-gray-900">입금 확인 요청 알림</h2>
      <p className="mt-1 text-xs text-gray-500">
        업체(ADMIN)는 <strong>팝업만</strong> 보고 「입금 확인 요청」을 누릅니다. 이때{' '}
        <strong>업체에게 메일은 가지 않고</strong>, 아래 운영팀 그룹 메일로만 시스템 알림이 발송됩니다.
        발송(SMTP) 설정은{' '}
        <Link to={platformSettingsTabPath('smtp')} className="text-blue-600 hover:underline">
          설정 → SMTP
        </Link>
        입니다.
      </p>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 space-y-1">
        <p>
          <span className="font-medium text-slate-900">Google Workspace 그룹</span>
          {!compactIntro ? (
            <span className="text-slate-500"> · 도메인 {PLATFORM_WORKSPACE_DOMAIN}</span>
          ) : null}
        </p>
        <p>
          <span className="text-slate-500">표시 이름</span>{' '}
          <span className="font-medium">{PLATFORM_BILLING_NOTIFY_GROUP_LABEL}</span>
        </p>
        <p>
          <span className="text-slate-500">수신 (그룹)</span>{' '}
          <span className="font-mono text-slate-900">{PLATFORM_BILLING_NOTIFY_GROUP_EMAIL}</span>
        </p>
        <p>
          <span className="text-slate-500">발신 (시스템)</span>{' '}
          <span className="font-mono text-slate-900">{PLATFORM_SYSTEM_MAIL_FROM}</span>
          <span className="text-slate-500"> · 제목 예: [업체명] 입금확인요청</span>
        </p>
      </div>

      <label className="mt-3 block text-sm">
        <span className="text-gray-600">알림 받을 이메일</span>
        <input
          type="email"
          className={`mt-1 ${INPUT_BASE}`}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={PLATFORM_BILLING_NOTIFY_GROUP_EMAIL}
          autoComplete="email"
        />
        {usingDefault ? (
          <p className="mt-1 text-xs text-emerald-800">
            기본 그룹 메일({PLATFORM_BILLING_NOTIFY_GROUP_EMAIL})로 연동됩니다.
          </p>
        ) : null}
      </label>

      {onTestEmail ? (
        <label className="mt-3 block text-sm">
          <span className="text-gray-600">연습 수신 (선택)</span>
          <input
            type="email"
            className={`mt-1 ${INPUT_BASE}`}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="비우면 위 알림 주소로 발송 (예: billing@service-bridges.com)"
            autoComplete="email"
          />
          <p className="mt-1 text-xs text-amber-900 leading-snug">
            billing@ 그룹으로 안 오면, 먼저 본인 Gmail 등 개인 주소로 SMTP만 확인한 뒤 그룹 설정(외부 발신·승인
            대기)을 점검하세요. 같은 주소로 보내는 것과는 무관합니다.
          </p>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        {onTestEmail ? (
          <button
            type="button"
            disabled={saving || testingEmail}
            onClick={() => void onTestEmail(testTo.trim() || undefined)}
            className={BTN_SECONDARY}
          >
            {testingEmail ? '보내는 중…' : '테스트 메일 보내기'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving || testingEmail}
          onClick={() => onEmailChange(PLATFORM_BILLING_NOTIFY_GROUP_EMAIL)}
          className={BTN_SECONDARY}
        >
          그룹 메일로 채우기
        </button>
        <button
          type="button"
          disabled={saving || testingEmail}
          onClick={() => void onSave()}
          className={BTN_PRIMARY}
        >
          {saving ? '저장 중…' : '알림 이메일 저장'}
        </button>
      </div>
      {onTestEmail ? (
        <p className="mt-2 text-right text-xs text-gray-500">
          위 입력란 주소로 실제 입금 확인 알림과 같은 형식의 연습 메일을 보냅니다. SMTP는 설정 → SMTP를
          사용합니다.
        </p>
      ) : null}
    </section>
  );
}
