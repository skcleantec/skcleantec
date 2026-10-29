import { useCallback, useEffect, useState } from 'react';
import { fetchPlatformInbox, type PlatformInboxPayload } from '../../api/platformInbox';
import { PlatformInboxQueue } from '../../components/platform/PlatformInboxQueue';

export function PlatformInboxHubPage() {
  const [inbox, setInbox] = useState<PlatformInboxPayload | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setInbox(await fetchPlatformInbox());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 할 일을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void load();
    const onAlert = () => void load();
    window.addEventListener('cbiseo:platform-alert', onAlert);
    return () => window.removeEventListener('cbiseo:platform-alert', onAlert);
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
      <h1 className="text-xl font-semibold text-gray-900">오늘 할 일</h1>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!inbox && !error ? <p className="text-fluid-sm text-gray-500">불러오는 중…</p> : null}
      {inbox ? <PlatformInboxQueue inbox={inbox} onChange={setInbox} /> : null}
    </div>
  );
}
