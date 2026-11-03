import type { PlatformAlimtalkOverview, PlatformAlimtalkProvider } from '../../api/platformAlimtalk';

const BTN =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const BTN_DARK =
  'rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

type Props = {
  overview: PlatformAlimtalkOverview | null;
  loading: boolean;
  busy: boolean;
  message: string;
  error: string;
  onSync: () => void;
  onPopup: (kind: 'channel' | 'template' | 'history') => void;
  onProvider: (code: string, provider: PlatformAlimtalkProvider) => void;
};

function won(value: number | null): string {
  if (value == null) return '—';
  return `${Math.trunc(value).toLocaleString('ko-KR')}원`;
}

export function PlatformAlimtalkScreen({
  overview,
  loading,
  busy,
  message,
  error,
  onSync,
  onPopup,
  onProvider,
}: Props) {
  return (
    <div className="min-w-0 space-y-3">
      <h1 className="text-fluid-lg font-semibold text-slate-900">알림톡</h1>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {message ? <p className="text-fluid-xs text-slate-700">{message}</p> : null}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">바로빌</h2>
        {loading && !overview ? <p className="text-fluid-xs text-slate-500">불러오는 중…</p> : null}
        {overview?.configGap ? <p className="text-fluid-xs text-amber-800">{overview.configGap}</p> : null}
        {overview?.callError ? <p className="text-fluid-xs text-red-700">{overview.callError}</p> : null}
        <dl className="grid gap-2 text-fluid-xs text-slate-700 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">채널 상태</dt>
            <dd>
              {overview?.channel
                ? `${overview.channel.channelName || overview.channel.channelId} · ${overview.channel.statusLabel}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">파트너 잔액</dt>
            <dd className="tabular-nums">{won(overview?.balanceKrw ?? null)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} disabled={busy} onClick={() => onPopup('channel')}>
            채널 관리
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => onPopup('template')}>
            템플릿 신청
          </button>
          <button type="button" className={BTN} disabled={busy} onClick={() => onPopup('history')}>
            발송 내역
          </button>
          <button type="button" className={BTN_DARK} disabled={busy} onClick={onSync}>
            {busy ? '동기화 중…' : '템플릿 동기화'}
          </button>
        </div>
      </section>
      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">서식</h2>
        <ul className="divide-y divide-slate-100">
          {(overview?.templates ?? []).map((row) => {
            const provider: PlatformAlimtalkProvider = row.provider === 'barobill' ? 'barobill' : 'solapi';
            return (
              <li key={row.code} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-fluid-sm font-medium text-slate-900" title={row.name}>
                    {row.name}
                  </p>
                  <p className="text-fluid-xs text-slate-500">
                    바로빌 심사 {row.barobillStatusLabel}
                    {row.barobillTemplateName ? ` · ${row.barobillTemplateName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-fluid-xs text-slate-500">보내는 곳</span>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                    <button
                      type="button"
                      className={`rounded-lg px-2 py-1 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${provider === 'solapi' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-700'}`}
                      disabled={busy || provider === 'solapi'}
                      onClick={() => onProvider(row.code, 'solapi')}
                    >
                      솔라피
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-2 py-1 text-fluid-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${provider === 'barobill' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'text-slate-700'}`}
                      disabled={busy || provider === 'barobill' || !row.barobillReady}
                      title={row.barobillReady ? '바로빌로 보냅니다' : '바로빌 심사가 정상일 때만 바꿀 수 있습니다.'}
                      onClick={() => onProvider(row.code, 'barobill')}
                    >
                      바로빌
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
