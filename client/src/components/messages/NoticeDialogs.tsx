import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getNoticeReaders, remindNotice, type NoticeReaders } from '../../api/messages';

/** PC는 가운데 네모 창, 폰은 아래에서 올라오는 창 */
function Sheet({ title, onClose, children, labelledBy }: { title: string; onClose: () => void; children: ReactNode; labelledBy: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-900/50 md:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-h-[86vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl md:w-[400px] md:rounded-2xl md:p-5"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <h3 id={labelledBy} className="text-[16px] font-extrabold text-slate-900">
          {title}
        </h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const ghost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 md:h-9';
const primary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-violet-700 px-4 text-[13px] font-bold text-white hover:bg-violet-800 disabled:opacity-50 md:h-9';

export function NoticeSendConfirm({
  targetsText,
  attachText,
  onCancel,
  onConfirm,
}: {
  targetsText: string;
  attachText: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet title="공지를 보낼까요?" onClose={onCancel} labelledBy="notice-send-confirm-title">
      <dl className="mt-3 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 text-[13.5px] text-slate-700">
        <dt className="text-slate-500">받는 사람</dt>
        <dd className="font-bold text-slate-900">{targetsText}</dd>
        {attachText ? (
          <>
            <dt className="text-slate-500">붙인 것</dt>
            <dd className="font-bold text-slate-900">{attachText}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-2 text-[12.5px] text-slate-500">
        받는 사람마다 따로 갑니다. 보낸 뒤에는 누가 읽었는지 볼 수 있습니다.
      </p>
      <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2 md:flex md:justify-end">
        <button type="button" className={ghost} onClick={onCancel}>
          돌아가기
        </button>
        <button type="button" className={primary} onClick={onConfirm} autoFocus>
          보내기
        </button>
      </div>
    </Sheet>
  );
}

function roleLabel(role: string): string {
  if (role === 'TEAM_LEADER') return '팀장';
  if (role === 'EXTERNAL_PARTNER') return '외부업체';
  if (role === 'MARKETER') return '마케터';
  return '';
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function NoticeReadersDialog({
  token,
  batchId,
  title,
  onClose,
}: {
  token: string;
  batchId: string;
  title?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<NoticeReaders | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'unread' | 'read' | 'crew'>('unread');
  const [reminding, setReminding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [askRemind, setAskRemind] = useState(false);

  useEffect(() => {
    let alive = true;
    getNoticeReaders(token, batchId)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '읽음 현황을 불러오지 못했습니다.');
      });
    return () => {
      alive = false;
    };
  }, [token, batchId]);

  const total = data ? data.read.length + data.unread.length : 0;
  const pct = total > 0 && data ? Math.round((data.read.length / total) * 100) : 0;

  const remind = async () => {
    setAskRemind(false);
    setReminding(true);
    setResult(null);
    try {
      const r = await remindNotice(token, batchId);
      setResult(`${r.remindedCount}명에게 알림을 다시 보냈습니다.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : '알림을 다시 보내지 못했습니다.');
    } finally {
      setReminding(false);
    }
  };

  const chip = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${
        tab === key ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Sheet title="누가 읽었나요" onClose={onClose} labelledBy="notice-readers-title">
      {title ? <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{title}</p> : null}
      {error ? (
        <p className="mt-3 text-[13px] font-semibold text-red-600" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="mt-4 text-[13px] text-slate-500">불러오는 중…</p>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-slate-700">
            {total}명 중 <b className="text-violet-700">{data.read.length}명</b> 읽음
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-violet-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chip('unread', `안 읽음 ${data.unread.length}`)}
            {chip('read', `읽음 ${data.read.length}`)}
            {data.crew.length > 0 ? chip('crew', `팀원 그룹 ${data.crew.length}`) : null}
          </div>
          <ul className="mt-2 max-h-[38vh] divide-y divide-slate-100 overflow-y-auto">
            {tab === 'unread' &&
              (data.unread.length === 0 ? (
                <li className="py-4 text-center text-[13px] text-slate-500">모두 읽었습니다.</li>
              ) : (
                data.unread.map((u) => (
                  <li key={u.userId} className="flex items-center gap-2 py-2 text-[13.5px]">
                    <span className="font-semibold text-slate-900">{u.name}</span>
                    <span className="text-[12px] text-slate-500">{roleLabel(u.role)}</span>
                    <span className="ml-auto text-[12px] font-semibold text-amber-700">아직 안 봄</span>
                  </li>
                ))
              ))}
            {tab === 'read' &&
              (data.read.length === 0 ? (
                <li className="py-4 text-center text-[13px] text-slate-500">아직 읽은 사람이 없습니다.</li>
              ) : (
                data.read.map((u) => (
                  <li key={u.userId} className="flex items-center gap-2 py-2 text-[13.5px]">
                    <span className="font-semibold text-slate-900">{u.name}</span>
                    <span className="text-[12px] text-slate-500">{roleLabel(u.role)}</span>
                    <span className="ml-auto text-[12px] tabular-nums text-slate-500">{shortTime(u.readAt)}</span>
                  </li>
                ))
              ))}
            {tab === 'crew' &&
              data.crew.map((g) => (
                <li key={g.crewGroupId} className="flex items-center gap-2 py-2 text-[13.5px]">
                  <span className="font-semibold text-slate-900">{g.name}</span>
                  <span
                    className={`ml-auto text-[12px] ${g.readAt ? 'tabular-nums text-slate-500' : 'font-semibold text-amber-700'}`}
                  >
                    {g.readAt ? shortTime(g.readAt) : '아직 안 봄'}
                  </span>
                </li>
              ))}
          </ul>
          {tab === 'crew' ? (
            <p className="mt-1 text-[12px] text-slate-500">팀원은 그룹이 같은 계정을 써서 그룹별로 보입니다.</p>
          ) : null}
          {result ? (
            <p className="mt-2 text-[12.5px] font-semibold text-slate-700" role="status">
              {result}
            </p>
          ) : null}
          {askRemind ? (
            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-[13px] font-semibold text-slate-800">
                안 읽은 {data.unread.length}명의 폰으로 알림이 한 번 더 갑니다. 보낼까요?
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className={ghost} onClick={() => setAskRemind(false)}>
                  아니요
                </button>
                <button type="button" className={primary} onClick={remind}>
                  알림 보내기
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 md:flex md:justify-end">
              <button type="button" className={`${ghost} max-md:order-2`} onClick={onClose}>
                닫기
              </button>
              {data.unread.length > 0 ? (
                <button type="button" className={primary} disabled={reminding} onClick={() => setAskRemind(true)}>
                  {reminding ? '보내는 중…' : `안 읽은 ${data.unread.length}명에게 다시 알림`}
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
