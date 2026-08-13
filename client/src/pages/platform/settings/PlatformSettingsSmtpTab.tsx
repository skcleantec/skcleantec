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
  validatePlatformSmtpForm,
  type PlatformSmtpFormState,
} from '../../../components/platform/PlatformSmtpSettingsSection';
import { PlatformSmtpProfilesSection } from '../../../components/platform/PlatformSmtpProfilesSection';

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
    const validationError = validatePlatformSmtpForm(smtpForm);
    if (validationError) {
      setError(validationError);
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
      setMessage('메일 연결 설정이 저장되었습니다.');
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

      <PlatformSmtpProfilesSection />

      <section className={CARD_SECTION}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">알림 메일 보내기</h2>
            <p className="mt-1 text-xs text-gray-500">
              입금 확인 요청 등 플랫폼 시스템 알림 발송에 사용합니다. 보내는 사람(From)은{' '}
              <span className="font-mono text-gray-700">cbiseo@service-bridges.com</span> 을 권장합니다.
              <span className="mt-1 block text-amber-800">
                발주서 제출 확인 메일은 위 「고객·기능별 SMTP 프로필」에서 따로 설정합니다. 여기 연습 메일이
                되어도 발주서 메일과는 무관합니다.
              </span>
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
        <p className="mt-3 text-xs text-gray-500">변경 후 「저장」한 뒤 연습 메일을 보내 확인해 주세요.</p>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={saving} onClick={() => void save()} className={BTN_PRIMARY}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
