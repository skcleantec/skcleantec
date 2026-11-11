import { useEffect, useState } from 'react';
import {
  pullPlatformReplyInbox,
  testPlatformReplyInbox,
  type PlatformBoard,
  type PlatformBoardSettingsPatch,
} from '../../api/platformCustomerBoard';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

const INPUT =
  'h-9 w-full rounded-lg border-0 bg-field px-3 text-fluid-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300';

function defaultHost(email: string): string {
  const d = email.trim().toLowerCase().split('@')[1] ?? '';
  if (d === 'naver.com') return 'imap.naver.com';
  if (d === 'gmail.com' || d === 'googlemail.com') return 'imap.gmail.com';
  if (d === 'daum.net' || d === 'hanmail.net') return 'imap.daum.net';
  return '';
}

function formatWhen(iso: string | null): string {
  if (!iso) return '아직 확인 안 함';
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export type InquiryMailSettingsValue = {
  notifyEmails: string[];
  inboxEmail: string;
  inboxHost: string;
  inboxPort: string;
  inboxPassword: string;
};

export function initialInquiryMailSettings(board: PlatformBoard): InquiryMailSettingsValue {
  const s = board.settings;
  const box = s.replyInbox ?? null;
  return {
    notifyEmails: s.notifyEmails && s.notifyEmails.length > 0 ? s.notifyEmails : s.notifyEmail ? [s.notifyEmail] : [],
    inboxEmail: box?.email ?? '',
    inboxHost: box?.host ?? '',
    inboxPort: String(box?.port ?? 993),
    inboxPassword: '',
  };
}

/** 저장할 settings patch — 메일함 주소를 비우면 연결 해제 */
export function inquiryMailSettingsPatch(v: InquiryMailSettingsValue): PlatformBoardSettingsPatch {
  const email = v.inboxEmail.trim();
  return {
    notifyEmails: v.notifyEmails.map((e) => e.trim()).filter(Boolean),
    replyInbox: email
      ? {
          email,
          host: v.inboxHost.trim() || defaultHost(email) || undefined,
          port: Number(v.inboxPort) || 993,
          password: v.inboxPassword || undefined,
        }
      : null,
  };
}

/** 고객센터 문의 게시판 설정 — 문의 알림 받을 메일 · 답장 받는 메일함 */
export function PlatformInquiryMailSettings({
  board,
  value,
  onChange,
}: {
  board: PlatformBoard;
  value: InquiryMailSettingsValue;
  onChange: (next: InquiryMailSettingsValue) => void;
}) {
  const [draft, setDraft] = useState('');
  const [testing, setTesting] = useState(false);
  const [pulling, setPulling] = useState(false);
  const box = board.settings.replyInbox ?? null;
  const sameBox = Boolean(box && box.email.toLowerCase() === value.inboxEmail.trim().toLowerCase());

  useEffect(() => {
    setDraft('');
  }, [board.id]);

  const set = (patch: Partial<InquiryMailSettingsValue>) => onChange({ ...value, ...patch });

  const addEmail = () => {
    const e = draft.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error('메일 주소를 확인해 주세요.');
      return;
    }
    if (value.notifyEmails.some((x) => x.toLowerCase() === e.toLowerCase())) {
      setDraft('');
      return;
    }
    if (value.notifyEmails.length >= 10) {
      toast.error('알림 받을 메일은 10개까지 넣을 수 있어요.');
      return;
    }
    set({ notifyEmails: [...value.notifyEmails, e] });
    setDraft('');
  };

  const test = async () => {
    setTesting(true);
    try {
      await testPlatformReplyInbox(board.slug, {
        email: value.inboxEmail.trim(),
        host: value.inboxHost.trim() || undefined,
        port: Number(value.inboxPort) || 993,
        password: value.inboxPassword || undefined,
      });
      toast.success('메일함에 연결됐어요. 「설정 저장」을 눌러 저장해 주세요.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '연결하지 못했어요.');
    } finally {
      setTesting(false);
    }
  };

  const pull = async () => {
    setPulling(true);
    try {
      const r = await pullPlatformReplyInbox(board.slug);
      toast.success(
        r.answers + r.followups > 0
          ? `답변 ${r.answers}건, 추가 질문 ${r.followups}건을 붙였어요.`
          : '새로 온 답장이 없어요.',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '메일을 가져오지 못했어요.');
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-fluid-sm font-bold text-slate-900">문의 알림 받을 메일</h3>
        <p className="text-fluid-xs text-slate-500">
          새 문의·추가 질문이 오면 여기 적힌 메일로 한 통씩 보내요. 이 메일에서 바로 답장하면 고객에게 답변이 가요.
        </p>
        {value.notifyEmails.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {value.notifyEmails.map((e) => (
              <li key={e} className="flex items-center gap-1 rounded-full bg-field py-1 pl-3 pr-1 text-fluid-xs text-slate-700">
                {e}
                <button
                  type="button"
                  aria-label={`${e} 빼기`}
                  onClick={() => set({ notifyEmails: value.notifyEmails.filter((x) => x !== e) })}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fluid-xs text-orange-700">알림 받을 메일이 없어요. 문의가 와도 메일이 가지 않아요.</p>
        )}
        <div className="flex max-w-[480px] gap-2">
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEmail();
              }
            }}
            placeholder="담당자 메일 주소"
            className={INPUT}
          />
          <Button variant="secondary" onClick={addEmail}>
            추가
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-fluid-sm font-bold text-slate-900">답장 받는 메일함</h3>
          {box ? (
            <span className={`text-fluid-xs ${box.lastError ? 'text-rose-600' : 'text-slate-500'}`}>
              {box.lastError ? `● ${box.lastError}` : `● 마지막 확인 ${formatWhen(box.lastSyncAt)}`}
            </span>
          ) : null}
        </div>
        <p className="text-fluid-xs text-slate-500">
          알림·답변 메일의 「답장 주소」가 이 메일이에요. 5분마다 이 메일함을 열어 제목에 #문의번호가 있는 답장만 문의에 붙여요.
        </p>
        <div className="grid max-w-[720px] grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_88px]">
          <label className="flex flex-col gap-1">
            <span className="text-fluid-2xs text-slate-500">메일 주소</span>
            <input
              type="email"
              value={value.inboxEmail}
              onChange={(e) => {
                const email = e.target.value;
                const host = defaultHost(email);
                set({ inboxEmail: email, ...(host && !value.inboxHost ? { inboxHost: host } : {}) });
              }}
              placeholder="help@example.com"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fluid-2xs text-slate-500">IMAP 서버</span>
            <input
              value={value.inboxHost}
              onChange={(e) => set({ inboxHost: e.target.value })}
              placeholder={defaultHost(value.inboxEmail) || 'imap.example.com'}
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fluid-2xs text-slate-500">포트</span>
            <input
              inputMode="numeric"
              value={value.inboxPort}
              onChange={(e) => set({ inboxPort: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              className={INPUT}
            />
          </label>
        </div>
        <label className="flex max-w-[480px] flex-col gap-1">
          <span className="text-fluid-2xs text-slate-500">
            앱 비밀번호 {sameBox && box?.passwordConfigured ? '· 설정됨 (바꿀 때만 입력)' : ''}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={value.inboxPassword}
            onChange={(e) => set({ inboxPassword: e.target.value })}
            placeholder={sameBox && box?.passwordConfigured ? '설정됨' : '메일함 앱 비밀번호'}
            className={INPUT}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={testing || !value.inboxEmail.trim()}
            onClick={() => void test()}
          >
            {testing ? '확인 중…' : '연결 확인'}
          </Button>
          <Button variant="secondary" disabled={pulling || !box?.passwordConfigured} onClick={() => void pull()}>
            {pulling ? '가져오는 중…' : '지금 가져오기'}
          </Button>
        </div>
      </section>
    </div>
  );
}
