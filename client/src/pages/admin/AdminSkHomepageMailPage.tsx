import { useEffect, useState } from 'react';
import {
  fetchSkHomepageMail,
  pullSkHomepageMail,
  saveSkHomepageMail,
  type SkHomepageMailState,
} from '../../api/skHomepageMail';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { useLoginScrollSurface } from '../../hooks/useMobileInputVisibility';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { getToken } from '../../stores/auth';

function formatWhen(iso: string | null): string {
  if (!iso) return '아직 없음';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '아직 없음';
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function AdminSkHomepageMailPage() {
  const { tenantSlug } = useTenantCapabilities();
  const sk = tenantSlug === 'sk' || tenantSlug === 'skcleanteck';
  const { scrollRef, onFieldFocus } = useLoginScrollSurface();
  const [state, setState] = useState<SkHomepageMailState | null>(null);
  const [mailbox, setMailbox] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);

  const load = () => {
    const token = getToken();
    if (!token) return;
    void fetchSkHomepageMail(token)
      .then((next) => {
        setState(next);
        setMailbox(next.mailbox);
        setEnabled(next.enabled);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  };

  useEffect(() => {
    if (sk) load();
  }, [sk]);

  if (tenantSlug && !sk) {
    return <p className="p-6 text-fluid-sm text-slate-600">이 업체에서는 쓰지 않습니다.</p>;
  }

  const save = () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setNotice(null);
    void saveSkHomepageMail(token, { mailbox, password, enabled })
      .then(() => {
        setPassword('');
        setNotice('저장했습니다. 네이버 연결도 확인했습니다.');
        load();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '저장하지 못했습니다.'))
      .finally(() => setSaving(false));
  };

  const pull = () => {
    const token = getToken();
    if (!token) return;
    setPulling(true);
    setNotice(null);
    void pullSkHomepageMail(token)
      .then((result) => {
        setNotice(
          `간편견적 ${result.imported.toLocaleString('ko-KR')}통을 가져왔고, 문의내역 ${result.created.toLocaleString('ko-KR')}건을 만들었습니다.`,
        );
        load();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '메일을 가져오지 못했습니다.'))
      .finally(() => setPulling(false));
  };

  return (
    <div
      ref={scrollRef}
      onFocusCapture={onFieldFocus}
      className="login-surface min-w-0 w-full max-w-3xl space-y-3 overflow-y-auto pb-8"
    >
      <PageTitleWithFavorite label="홈페이지 문의메일">
        <h1 className="text-xl font-semibold text-gray-800">홈페이지 문의메일</h1>
      </PageTitleWithFavorite>
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        제목이 「간편견적이 접수되었습니다」인 메일만 가져옵니다. 이름·연락처·청소날짜·이사날짜·지역·공급면적·방·화장실·주방·베란다·특이사항을 문의내역에 넣습니다. 네이버에서 IMAP/SMTP 사용을 켜고, 2단계 인증이면 애플리케이션 비밀번호를 만드세요.
      </p>
      {error ? <p className="text-fluid-xs text-red-700">{error}</p> : null}
      {notice ? <p className="text-fluid-xs text-emerald-800">{notice}</p> : null}
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">네이버 메일</span>
          <input
            value={mailbox}
            onChange={(e) => setMailbox(e.target.value)}
            autoComplete="username"
            placeholder="이름@naver.com"
            className="login-field-input mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-fluid-sm"
          />
        </label>
        <label className="block">
          <span className="text-fluid-2xs text-slate-500">
            애플리케이션 비밀번호{state?.passwordSet ? ' · 저장됨. 바꿀 때만 다시 적습니다.' : ''}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="login-field-input mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-fluid-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-fluid-sm text-slate-800">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          15분마다 자동으로 가져오기
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? '확인 중…' : '저장'}
          </button>
          <button
            type="button"
            onClick={pull}
            disabled={pulling || !state?.passwordSet}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {pulling ? '가져오는 중…' : '지금 가져오기'}
          </button>
        </div>
        <p className="text-fluid-2xs text-slate-500">
          마지막 확인 {formatWhen(state?.lastSyncAt ?? null)}
          {state?.lastError ? ` · ${state.lastError}` : ''}
          {state
            ? ` · 문의내역 ${state.matchedCount.toLocaleString('ko-KR')}건 · 확인 필요 ${state.pendingCount.toLocaleString('ko-KR')}통`
            : ''}
        </p>
      </form>
      <ul className="space-y-2">
        {(state?.recent ?? []).map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
            <p className="truncate text-fluid-sm font-medium text-slate-900" title={row.subject}>
              {row.subject || '(제목 없음)'}
            </p>
            <p className="mt-0.5 truncate text-fluid-2xs text-slate-500" title={row.fromAddress}>
              {formatWhen(row.receivedAt)}
              {row.status === 'MATCHED'
                ? ` · ${row.placed ?? '문의내역'}`
                : ' · 표가 달라 문의내역에 넣지 못함'}
            </p>
            {row.excerpt ? (
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-fluid-xs text-slate-700">{row.excerpt}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
