import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCrmSoomgoBridge } from '../../../hooks/useCrmSoomgoBridge';
import { CrmIconPhone, CrmIconSoomgo } from '../../../components/crm/crmUi';
import { SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE } from '../../../api/soomgoBridge';

/** 숨고 듀얼 창 — Chrome 자동 로그인 + 보조 화면 (메인 CRM 왼쪽 도구와 함께 사용) */
export function CrmSoomgoCompanionPage() {
  const autoLoginStarted = useRef(false);
  const { status, preview, busy, error, bridgeUp, refreshStatus, openSoomgo } = useCrmSoomgoBridge({
    onImport: () => {},
    pollEnabled: true,
  });

  useEffect(() => {
    document.title = '숨고 보조 — 텔레CRM';
  }, []);

  useEffect(() => {
    if (autoLoginStarted.current) return;
    autoLoginStarted.current = true;
    void (async () => {
      const s = await refreshStatus();
      if (!s.bridgeRunning) return;
      await openSoomgo();
    })();
  }, [openSoomgo, refreshStatus]);

  const loggedIn = status?.loggedIn;
  const inRoom = status?.inChatRoom;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-sky-50/40 to-slate-100">
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 px-4 py-3 text-white shadow-lg">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500">
          <CrmIconSoomgo className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-fluid-sm font-bold">숨고 보조 창</h1>
          <p className="text-[10px] text-sky-100/80">Chrome 숨고 · 메인 CRM 왼쪽 도구</p>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="ml-auto shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-fluid-xs hover:bg-white/20"
        >
          닫기
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!bridgeUp ? (
          <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-fluid-sm text-amber-950">
            <p className="font-semibold">브릿지 실행 필요</p>
            <p>{SOOMGO_BRIDGE_NOT_RUNNING_MESSAGE}</p>
            <p className="rounded-lg bg-white/80 px-2 py-1.5 font-mono text-[11px]">tools\soomgo-bridge\run-bridge.bat</p>
            <button
              type="button"
              onClick={() => void refreshStatus().then((s) => s.bridgeRunning && openSoomgo())}
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-fluid-xs font-semibold text-amber-900"
            >
              연결 후 자동 로그인
            </button>
          </section>
        ) : (
          <section className="space-y-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">브릿지 연결</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${loggedIn ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>
                {loggedIn ? '숨고 로그인됨' : busy ? '로그인 중…' : '숨고 미로그인'}
              </span>
              {inRoom && status?.nickname ? (
                <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  {status.nickname}
                </span>
              ) : null}
            </div>
            <p className="text-fluid-sm leading-relaxed text-slate-600">
              이 창과 <strong>메인 텔레CRM</strong>을 나란히 두고, 숨고 Chrome에서 채팅을 보며 메인 CRM{' '}
              <strong>왼쪽 도구</strong>로 정보 갖고오기·통화·메시지를 실행하세요.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void openSoomgo()}
              className="w-full rounded-xl bg-sky-600 px-3 py-2.5 text-fluid-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy ? '연결 중…' : '숨고 다시 열기 / 로그인'}
            </button>
          </section>
        )}

        {(preview || inRoom) && (
          <section className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-fluid-sm text-slate-700">
            <p className="mb-2 font-semibold text-sky-900">현재 채팅</p>
            {preview?.nickname ? <p>고객: {preview.nickname}</p> : null}
            {preview?.phone ? <p className="tabular-nums">연락처: {preview.phone}</p> : null}
            {preview?.pyeong ? <p>평수: {preview.pyeong}평</p> : null}
            {!preview && inRoom ? <p className="text-slate-500">채팅방이 열려 있습니다.</p> : null}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-fluid-sm text-slate-600">
          <p className="mb-2 font-semibold text-slate-900">계정 설정</p>
          <p className="mb-3">숨고 아이디·비밀번호는 메인 CRM <strong>설정 → 숨고 연동</strong>에서 저장합니다.</p>
          <Link
            to="/admin/crm?panel=settings&tab=soomgo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sky-700 hover:underline"
          >
            <CrmIconPhone className="h-4 w-4" />
            텔레CRM 설정 열기
          </Link>
        </section>

        {error ? <p className="text-fluid-xs text-rose-600">{error}</p> : null}
      </main>
    </div>
  );
}
