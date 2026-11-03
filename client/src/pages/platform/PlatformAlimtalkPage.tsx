import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformAlimtalkOverview,
  openPlatformAlimtalkPopup,
  patchPlatformAlimtalkProvider,
  syncPlatformAlimtalkTemplates,
  type PlatformAlimtalkOverview,
  type PlatformAlimtalkProvider,
} from '../../api/platformAlimtalk';
import { PlatformAlimtalkScreen } from '../../components/ui/PlatformAlimtalkScreen';

export function PlatformAlimtalkPage() {
  const [overview, setOverview] = useState<PlatformAlimtalkOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOverview(await fetchPlatformAlimtalkOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : '알림톡 상태를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await syncPlatformAlimtalkTemplates();
      if (result.configGap) {
        setError(result.configGap);
      } else {
        const warnings = result.templates.flatMap((row) => row.warnings.map((token) => `${row.templateName} ${token}`));
        const missing = result.missing.length > 0 ? `없는 템플릿: ${result.missing.join(', ')}` : '';
        const warn = warnings.length > 0 ? `채울 수 없는 변수: ${warnings.join(', ')}` : '';
        setMessage([missing, warn, '템플릿을 동기화했습니다.'].filter(Boolean).join(' '));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '템플릿 동기화에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const onPopup = async (kind: 'channel' | 'template' | 'history') => {
    setBusy(true);
    setError('');
    try {
      await openPlatformAlimtalkPopup(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : '바로빌 화면을 열지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const onProvider = async (code: string, provider: PlatformAlimtalkProvider) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await patchPlatformAlimtalkProvider(code, provider);
      setMessage(provider === 'barobill' ? '보내는 곳을 바로빌로 바꿨습니다.' : '보내는 곳을 솔라피로 바꿨습니다.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '보내는 곳을 바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PlatformAlimtalkScreen
      overview={overview}
      loading={loading}
      busy={busy}
      message={message}
      error={error}
      onSync={() => void onSync()}
      onPopup={(kind) => void onPopup(kind)}
      onProvider={(code, provider) => void onProvider(code, provider)}
    />
  );
}
