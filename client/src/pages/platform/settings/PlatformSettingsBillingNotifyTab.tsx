import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformBillingSettings, patchPlatformBillingSettings, sendPlatformPaymentNotifyTest } from '../../../api/platformBilling';
import { PlatformBillingNotifySettingsSection } from '../../../components/platform/PlatformBillingNotifySettingsSection';
import { getPlatformToken } from '../../../stores/platformAuth';
import { CARD_SECTION, PlatformAlert } from '../../../utils/platformUi';
import { PLATFORM_SYSTEM_MAIL_FROM } from '@shared/platformWorkspace';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PlatformSettingsBillingNotifyTab() {
  const [notifyEmail, setNotifyEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
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
      setNotifyEmail(s.dunningPaymentNotifyEmail?.trim() ?? '');
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
    if (!token) return;
    const trimmed = notifyEmail.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setError('알림 받을 이메일을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformBillingSettings(token, {
        dunningPaymentNotifyEmail: trimmed,
      });
      await load();
      setMessage('입금 확인 알림 수신 이메일이 저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const testNotifyEmail = async (testTo?: string) => {
    const token = getPlatformToken();
    if (!token) return;
    const trimmed = notifyEmail.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setError('알림 받을 이메일을 먼저 입력·저장해 주세요.');
      return;
    }
    if (testTo && !EMAIL_PATTERN.test(testTo)) {
      setError('연습 수신 이메일 형식을 확인해 주세요.');
      return;
    }
    setTestingEmail(true);
    setError('');
    setMessage('');
    try {
      const result = await sendPlatformPaymentNotifyTest(token, trimmed, testTo);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '테스트 발송 실패');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  const savedEmail = notifyEmail.trim();

  return (
    <div className="space-y-4">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <PlatformBillingNotifySettingsSection
        email={notifyEmail}
        onEmailChange={setNotifyEmail}
        onSave={save}
        saving={saving}
        onTestEmail={testNotifyEmail}
        testingEmail={testingEmail}
      />

      <section className={`${CARD_SECTION} text-sm text-gray-600 space-y-2`}>
        <h2 className="text-sm font-semibold text-gray-900">연동 확인</h2>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li>
            업체 ADMIN: 미결재 팝업 · 「입금확인 요청 (운영팀 알림)」 — <strong>업체 이메일 발송 없음</strong>
          </li>
          <li>
            발신: <strong>{PLATFORM_SYSTEM_MAIL_FROM}</strong> (설정 → SMTP · 「플랫폼 알림 (cbiseo)」)
          </li>
          <li>
            수신: 위에 <strong>저장한 알림 이메일</strong>
            {savedEmail ? (
              <>
                {' '}
                (<span className="font-mono text-gray-800">{savedEmail}</span>)
              </>
            ) : (
              ' (미설정 — 저장 전까지 업체 요청 버튼 비활성)'
            )}
          </li>
          <li>메일 제목: [업체명] 입금확인요청</li>
          <li>
            팝업 문구·입금 계좌는{' '}
            <Link to="/platform/popups/unpaid" className="text-blue-600 hover:underline">
              안내팝업 → 미결재 팝업
            </Link>
          </li>
        </ul>
        <div className="pt-2 flex justify-end">
          <Link
            to="/platform/popups/unpaid"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            미결재 팝업 설정 열기
          </Link>
        </div>
      </section>
    </div>
  );
}
