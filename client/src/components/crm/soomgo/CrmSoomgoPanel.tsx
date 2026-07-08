import { useCallback, useEffect, useState } from 'react';
import type { SoomgoExtractedChat } from '@shared/soomgoBridge';
import { getToken } from '../../../stores/auth';
import { fetchTelecrmSoomgoCredentials } from '../../../api/telecrmSoomgo';
import type { SoomgoBridgeStatus } from '@shared/soomgoBridge';
import {
  extractSoomgoCurrentChat,
  fetchSoomgoBridgeStatus,
  loginSoomgoBridge,
  openSoomgoChats,
  sendSoomgoBridgeMessage,
  startSoomgoBridge,
} from '../../../api/soomgoBridge';
import { telecrmCall, telecrmDispatchNotice } from '../../../utils/telecrmNativeBridge';
import { CrmColumn } from '../layout/CrmShell';
import { CrmActionButton } from '../crmUi';

export function CrmSoomgoPanel({
  onImport,
  onDispatchNotice,
}: {
  onImport: (data: SoomgoExtractedChat) => void;
  onDispatchNotice?: (message: string) => void;
}) {
  const [status, setStatus] = useState<SoomgoBridgeStatus | null>(null);
  const [preview, setPreview] = useState<SoomgoExtractedChat | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const s = await fetchSoomgoBridgeStatus();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void refreshStatus();
    const id = window.setInterval(() => void refreshStatus(), 4000);
    return () => window.clearInterval(id);
  }, [refreshStatus]);

  const notify = (msg: string) => onDispatchNotice?.(msg);

  const handleOpenSoomgo = async () => {
    setBusy(true);
    setError(null);
    try {
      await startSoomgoBridge();
      const token = getToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const creds = await fetchTelecrmSoomgoCredentials(token);
      const loginRes = await loginSoomgoBridge(creds.email, creds.password);
      if (!loginRes.loggedIn) throw new Error(loginRes.lastError ?? '숨고 로그인에 실패했습니다.');
      await openSoomgoChats();
      await refreshStatus();
      notify('숨고 Chrome 창이 열렸습니다. 채팅방을 연 뒤 아래 버튼을 사용하세요.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '숨고 연동에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleExtract = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await extractSoomgoCurrentChat();
      setPreview(data);
      onImport(data);
      notify('고객 정보를 접수란에 채웠습니다.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '정보를 가져오지 못했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleCall = async () => {
    setBusy(true);
    setError(null);
    try {
      let data = preview;
      if (!data?.phone) {
        data = await extractSoomgoCurrentChat();
        setPreview(data);
        onImport(data);
      }
      const digits = (data?.phone ?? '').replace(/\D/g, '');
      if (digits.length < 8) {
        throw new Error('채팅에서 전화번호를 찾지 못했습니다. 먼저 「정보 갖고오기」를 시도해 주세요.');
      }
      const result = await telecrmCall(data!.phone!, { customerMatch: 'new' });
      const notice = telecrmDispatchNotice(result, 'call');
      if (notice) notify(notice);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '통화 연결에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    const body = message.trim();
    if (!body) {
      notify('보낼 메시지를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendSoomgoBridgeMessage(body);
      setMessage('');
      notify('숨고 채팅방에 메시지를 보냈습니다.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '메시지 전송에 실패했습니다.';
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.bridgeRunning && status?.browserRunning;
  const loggedIn = status?.loggedIn;
  const inRoom = status?.inChatRoom;

  return (
    <CrmColumn accent="soomgo" title="숨고 연동" subtitle="채팅방 · 정보 가져오기 · 통화" disableBodyScroll>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <div className="shrink-0 space-y-2 rounded-xl border border-sky-100 bg-white/90 p-2.5 text-fluid-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                connected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {connected ? '브릿지 연결' : '브릿지 미실행'}
            </span>
            {loggedIn ? (
              <span className="text-[10px] text-sky-800">숨고 로그인됨</span>
            ) : (
              <span className="text-[10px] text-gray-500">숨고 미로그인</span>
            )}
            {inRoom && status?.nickname ? (
              <span className="truncate text-[10px] font-medium text-slate-700">· {status.nickname}</span>
            ) : null}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            `tools/soomgo-bridge/run-bridge.bat` 실행 후 「숨고 열기」로 Chrome에서 채팅방을 연 다음 버튼을
            사용하세요.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleOpenSoomgo()}
            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? '연결 중…' : '숨고 열기 / 로그인'}
          </button>
        </div>

        {(preview || status?.inChatRoom) && (
          <div className="shrink-0 space-y-1 rounded-xl border border-sky-100/80 bg-sky-50/50 p-2.5 text-[11px] text-slate-700">
            <p className="font-semibold text-sky-900">미리보기</p>
            {preview?.nickname ? <p>고객: {preview.nickname}</p> : null}
            {preview?.phone ? <p className="tabular-nums">연락처: {preview.phone}</p> : null}
            {preview?.pyeong ? <p>평수: {preview.pyeong}평</p> : null}
            {preview?.address ? (
              <p className="truncate" title={preview.address}>
                주소: {preview.address}
              </p>
            ) : null}
            {preview?.lastMessage ? (
              <p className="line-clamp-3 text-slate-600" title={preview.lastMessage}>
                최근: {preview.lastMessage}
              </p>
            ) : null}
            {!preview && status?.inChatRoom ? (
              <p className="text-slate-500">채팅방이 열려 있습니다. 「정보 갖고오기」를 눌러 주세요.</p>
            ) : null}
          </div>
        )}

        <div className="shrink-0 flex flex-wrap gap-1.5">
          <CrmActionButton accent="soomgo" variant="solid" disabled={busy} onClick={() => void handleExtract()}>
            정보 갖고오기
          </CrmActionButton>
          <CrmActionButton accent="soomgo" disabled={busy} onClick={() => void handleCall()}>
            통화
          </CrmActionButton>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-sky-900">숨고 메시지</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="채팅방에 보낼 내용"
            className="min-h-0 flex-1 resize-none rounded-lg border border-sky-200 bg-white px-2.5 py-2 text-fluid-xs"
          />
          <CrmActionButton
            accent="soomgo"
            variant="solid"
            disabled={busy || !message.trim()}
            onClick={() => void handleSendMessage()}
          >
            메시지 보내기
          </CrmActionButton>
        </div>

        {error ? <p className="shrink-0 text-[10px] text-rose-600">{error}</p> : null}
      </div>
    </CrmColumn>
  );
}
