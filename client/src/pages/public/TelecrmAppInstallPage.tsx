import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  fetchTelecrmAppPublicManifest,
  type TelecrmAppPublicManifest,
} from '../../api/telecrmAppManifest';

function TelecrmInstallIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

export function TelecrmAppInstallPage() {
  useDocumentTitle('청소비서 전화 설치');

  const [manifest, setManifest] = useState<TelecrmAppPublicManifest | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const data = await fetchTelecrmAppPublicManifest();
        if (!cancelled) setManifest(data);
      } catch (e) {
        if (!cancelled) {
          setManifest(null);
          setLoadErr(e instanceof Error ? e.message : '불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadReady = Boolean(manifest?.downloadUrl?.trim());

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800/20 bg-slate-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <TelecrmInstallIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-fluid-xs font-medium text-slate-300">청소비서</p>
            <h1 className="truncate text-fluid-base font-semibold">전화 앱 설치</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-fluid-sm leading-relaxed text-slate-600">
            사무실 휴대폰에 <strong className="font-semibold text-slate-800">청소비서 전화</strong> 앱을 설치합니다.
            PC 텔레CRM과 같은 계정으로 로그인해 사용하세요.
          </p>

          {loading ? (
            <p className="mt-6 text-center text-fluid-sm text-slate-500" role="status">
              최신 버전 확인 중…
            </p>
          ) : null}

          {!loading && loadErr ? (
            <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-fluid-sm text-red-800" role="alert">
              {loadErr}
            </p>
          ) : null}

          {!loading && manifest ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                <p className="text-fluid-xs text-slate-500">최신 버전</p>
                <p className="mt-1 text-fluid-base font-semibold text-slate-900">
                  v{manifest.latestVersionName}{' '}
                  <span className="font-normal text-slate-500">({manifest.latestVersionCode})</span>
                </p>
                {manifest.releaseNotes?.trim() ? (
                  <p className="mt-2 text-fluid-xs leading-snug text-slate-600">{manifest.releaseNotes}</p>
                ) : null}
              </div>

              {downloadReady ? (
                <a
                  href={manifest.downloadUrl}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3.5 text-fluid-base font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                >
                  청소비서 전화 설치
                </a>
              ) : (
                <p
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-fluid-sm text-amber-900"
                  role="alert"
                >
                  지금은 설치 파일이 준비되지 않았습니다. 관리자에게 문의하세요.
                </p>
              )}

              <ol className="list-decimal space-y-2 pl-5 text-fluid-xs leading-relaxed text-slate-600">
                <li>위 버튼을 누르면 APK가 다운로드됩니다.</li>
                <li>다운로드가 끝나면 파일을 열고 「설치」를 누르세요.</li>
                <li>처음 한 번은 「출처를 알 수 없는 앱」설치를 허용해야 할 수 있습니다.</li>
                <li>
                  이미 앱이 있으면 덮어씌워 설치됩니다. 이후 새 버전은{' '}
                  <strong className="font-medium text-slate-700">앱 실행 시 자동으로 안내</strong>됩니다.
                </li>
              </ol>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-fluid-2xs leading-relaxed text-slate-500">
          이 페이지 주소는 바뀌지 않습니다. 새 버전이 나와도 같은 링크에서 항상 최신 APK를 받을 수 있습니다.
        </p>
      </main>
    </div>
  );
}
