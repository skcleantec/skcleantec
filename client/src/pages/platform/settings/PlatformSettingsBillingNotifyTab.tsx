import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlatformBillingSettings, patchPlatformBillingSettings } from '../../../api/platformBilling';
import { PlatformBillingNotifySettingsSection } from '../../../components/platform/PlatformBillingNotifySettingsSection';
import { getPlatformToken } from '../../../stores/platformAuth';
import { CARD_SECTION, PlatformAlert } from '../../../utils/platformUi';
import { PLATFORM_BILLING_NOTIFY_GROUP_EMAIL } from '@shared/platformWorkspace';

export function PlatformSettingsBillingNotifyTab() {
  const [notifyEmail, setNotifyEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setNotifyEmail(s.dunningPaymentNotifyEmail?.trim() || PLATFORM_BILLING_NOTIFY_GROUP_EMAIL);
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
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('입금 확인 알림 이메일 형식을 확인해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformBillingSettings(token, {
        dunningPaymentNotifyEmail: trimmed || PLATFORM_BILLING_NOTIFY_GROUP_EMAIL,
      });
      await load();
      setMessage('입금 확인 알림 이메일이 저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  return (
    <div className="space-y-4">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <PlatformBillingNotifySettingsSection
        email={notifyEmail}
        onEmailChange={setNotifyEmail}
        onSave={save}
        saving={saving}
      />

      <section className={`${CARD_SECTION} text-sm text-gray-600 space-y-2`}>
        <h2 className="text-sm font-semibold text-gray-900">연동 확인</h2>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li>
            업체 ADMIN: 미결재 팝업만 표시 · 「입금확인 요청 (운영팀 알림)」 — <strong>업체 이메일 발송 없음</strong>
          </li>
          <li>
            운영팀: <strong>{PLATFORM_BILLING_NOTIFY_GROUP_EMAIL}</strong> 그룹으로 시스템 알림 수신
          </li>
          <li>SMTP(발송)는 설정 → SMTP, 수신 그룹은 이 탭에서 관리</li>
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
