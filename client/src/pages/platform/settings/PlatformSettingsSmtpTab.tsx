import { useCallback, useEffect, useState } from 'react';
import {
  getPlatformBillingSettings,
  patchPlatformBillingSettings,
  sendPlatformBillingSmtpTest,
} from '../../../api/platformBilling';
import { getPlatformToken } from '../../../stores/platformAuth';
import {
  BTN_PRIMARY,
  CARD_SECTION,
  PlatformAlert,
} from '../../../utils/platformUi';
import {
  PlatformSmtpSettingsSection,
  smtpFormFromSettings,
  smtpPatchFromForm,
  type PlatformSmtpFormState,
} from '../../../components/platform/PlatformSmtpSettingsSection';

export function PlatformSettingsSmtpTab() {
  const [smtpForm, setSmtpForm] = useState<PlatformSmtpFormState | null>(null);
  const [smtpEffectiveConfigured, setSmtpEffectiveConfigured] = useState(false);
  const [smtpEnvFallback, setSmtpEnvFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) {
      setLoading(false);
      setError('플랫폼 로그인이 필요합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const s = await getPlatformBillingSettings(token);
      setSmtpForm(smtpFormFromSettings(s.smtp));
      setSmtpEffectiveConfigured(s.smtp.effectiveConfigured);
      setSmtpEnvFallback(s.smtp.envFallbackAvailable);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const token = getPlatformToken();
    if (!token || !smtpForm) return;
    const host = smtpForm.smtpHost.trim();
    const from = smtpForm.smtpFrom.trim();
    if (!host || !from) {
      setError('SMTP 호스트·보내는 사람 표시를 입력해 주세요.');
      return;
    }
    if (!smtpForm.smtpPassword.trim() && !smtpForm.smtpPasswordConfigured) {
      setError('앱 비밀번호를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformBillingSettings(token, {
        smtp: smtpPatchFromForm(smtpForm),
      });
      await load();
      setMessage('SMTP 설정이 저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const testSmtp = async (to: string) => {
    const token = getPlatformToken();
    if (!token) return;
    setSmtpTesting(true);
    setError('');
    try {
      const result = await sendPlatformBillingSmtpTest(token, to);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '테스트 발송 실패');
    } finally {
      setSmtpTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!smtpForm) {
    return <PlatformAlert variant="error" message={error || 'SMTP 설정을 불러올 수 없습니다.'} />;
  }

  return (
    <div className="space-y-4">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <section className={CARD_SECTION}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">메일 발송 (SMTP)</h2>
            <p className="mt-1 text-xs text-gray-500">
              입금 확인 요청·도움말 문의 등 플랫폼에서 보내는 알림 메일에 사용합니다.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PlatformSmtpSettingsSection
            smtp={smtpForm}
            onChange={(patch) => setSmtpForm((prev) => (prev ? { ...prev, ...patch } : prev))}
            effectiveConfigured={smtpEffectiveConfigured}
            envFallbackAvailable={smtpEnvFallback}
            onTest={testSmtp}
            testing={smtpTesting}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">변경 후 「저장」한 뒤 테스트 발송해 주세요.</p>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void save()} className={BTN_PRIMARY}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
