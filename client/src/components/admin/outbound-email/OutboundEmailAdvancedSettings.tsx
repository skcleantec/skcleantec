import { TenantSmtpFieldLabel } from '../TenantSmtpFieldLabel';
import { OUTBOUND_EMAIL_COPY } from '../../../utils/outboundEmailCopy';

type Props = {
  open: boolean;
  onToggle: () => void;
  smtpHost: string;
  onSmtpHostChange: (v: string) => void;
  smtpPort: string;
  onSmtpPortChange: (v: string) => void;
  smtpSecure: boolean;
  onSmtpSecureChange: (v: boolean) => void;
  fieldErrors: Record<string, string>;
};

export function OutboundEmailAdvancedSettings({
  open,
  onToggle,
  smtpHost,
  onSmtpHostChange,
  smtpPort,
  onSmtpPortChange,
  smtpSecure,
  onSmtpSecureChange,
  fieldErrors,
}: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100/80 rounded-lg"
        aria-expanded={open}
      >
        {OUTBOUND_EMAIL_COPY.advancedToggle}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-gray-200 px-3 pb-3 pt-3">
          <label className="block">
            <TenantSmtpFieldLabel
              title={OUTBOUND_EMAIL_COPY.advancedHost}
              hint="예: smtp.gmail.com"
              helpText="메일 회사가 안내하는 서버 주소입니다. 보통 메일 선택 시 자동으로 채워집니다."
            />
            <input
              type="text"
              value={smtpHost}
              onChange={(e) => onSmtpHostChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="smtp.gmail.com"
            />
            {fieldErrors.smtpHost ? (
              <p className="mt-1 text-xs text-rose-700">{fieldErrors.smtpHost}</p>
            ) : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <TenantSmtpFieldLabel
                title={OUTBOUND_EMAIL_COPY.advancedPort}
                hint="Gmail·네이버 587 · 다음 465"
                helpText="587: 보안 연결 끄기 · 465: 보안 연결 켜기"
              />
              <input
                type="number"
                min={1}
                max={65535}
                value={smtpPort}
                onChange={(e) => onSmtpPortChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {fieldErrors.smtpPort ? (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.smtpPort}</p>
              ) : null}
            </label>
            <label className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => onSmtpSecureChange(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="min-w-0 text-xs text-gray-700">
                <span className="font-medium text-gray-900">{OUTBOUND_EMAIL_COPY.advancedSecure}</span>
                <span className="mt-0.5 block text-gray-500">{OUTBOUND_EMAIL_COPY.advancedSecureHint}</span>
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
