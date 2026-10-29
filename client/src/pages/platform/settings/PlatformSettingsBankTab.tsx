import { useEffect, useState } from 'react';
import { KoreanBankNameField } from '../../../components/ui/KoreanBankNameField';
import { getPlatformBillingSettings, patchPlatformBillingSettings } from '../../../api/platformBilling';
import { getPlatformToken } from '../../../stores/platformAuth';
import { BTN_PRIMARY, INPUT_BASE, PlatformAlert } from '../../../utils/platformUi';

export function PlatformSettingsBankTab() {
  const [settings, setSettings] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    paymentGuideText: '',
    overdueGraceDays: 3,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) return;
    getPlatformBillingSettings(token)
      .then((s) => {
        setSettings({
          bankName: s.bankName ?? '',
          accountNumber: s.accountNumber ?? '',
          accountHolder: s.accountHolder ?? '',
          paymentGuideText: s.paymentGuideText ?? '',
          overdueGraceDays: s.overdueGraceDays,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.'));
  }, []);

  const saveSettings = async () => {
    const token = getPlatformToken();
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformBillingSettings(token, {
        bankName: settings.bankName || null,
        accountNumber: settings.accountNumber || null,
        accountHolder: settings.accountHolder || null,
        paymentGuideText: settings.paymentGuideText || null,
        overdueGraceDays: settings.overdueGraceDays,
      });
      setMessage('입금 안내 설정이 저장되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="text-gray-600">은행</span>
          <div className="mt-1">
            <KoreanBankNameField
              value={settings.bankName}
              onChange={(bankName) => setSettings((s) => ({ ...s, bankName }))}
              selectClassName={INPUT_BASE}
              inputClassName={INPUT_BASE}
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">계좌번호</span>
          <input
            className={`mt-1 ${INPUT_BASE}`}
            value={settings.accountNumber}
            onChange={(e) => setSettings((s) => ({ ...s, accountNumber: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">예금주</span>
          <input
            className={`mt-1 ${INPUT_BASE}`}
            value={settings.accountHolder}
            onChange={(e) => setSettings((s) => ({ ...s, accountHolder: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">연체 유예 (일)</span>
          <input
            type="number"
            min={0}
            max={30}
            className={`mt-1 ${INPUT_BASE}`}
            value={settings.overdueGraceDays}
            onChange={(e) =>
              setSettings((s) => ({ ...s, overdueGraceDays: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-gray-600">납부 안내 문구</span>
          <textarea
            rows={3}
            className={`mt-1 ${INPUT_BASE}`}
            value={settings.paymentGuideText}
            onChange={(e) => setSettings((s) => ({ ...s, paymentGuideText: e.target.value }))}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSettings()}
          className={BTN_PRIMARY}
        >
          설정 저장
        </button>
      </div>
    </div>
  );
}
