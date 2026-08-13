import { Link } from 'react-router-dom';
import {
  PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
  PLATFORM_BILLING_NOTIFY_GROUP_LABEL,
  PLATFORM_WORKSPACE_DOMAIN,
} from '@shared/platformWorkspace';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';
import { platformSettingsTabPath } from '../../pages/platform/settings/platformSettingsTabs';

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  saving: boolean;
  /** 미결재 팝업 페이지 등에서 SMTP 링크 문구만 다를 때 */
  compactIntro?: boolean;
};

export function PlatformBillingNotifySettingsSection({
  email,
  onEmailChange,
  onSave,
  saving,
  compactIntro = false,
}: Props) {
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
          <span className="text-slate-500">그룹 메일</span>{' '}
          <span className="font-mono text-slate-900">{PLATFORM_BILLING_NOTIFY_GROUP_EMAIL}</span>
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

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => onEmailChange(PLATFORM_BILLING_NOTIFY_GROUP_EMAIL)}
          className={BTN_SECONDARY}
        >
          그룹 메일로 채우기
        </button>
        <button type="button" disabled={saving} onClick={() => void onSave()} className={BTN_PRIMARY}>
          {saving ? '저장 중…' : '알림 이메일 저장'}
        </button>
      </div>
    </section>
  );
}
