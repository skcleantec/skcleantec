import { CBISEO_KAKAO_CHANNEL_CHAT_URL } from '@shared/platformSupport';

const LINK_CLASS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

type Props = {
  variant: 'menu' | 'banner';
  onNavigate?: () => void;
};

export function KakaoChannelChatLink({ variant, onNavigate }: Props) {
  if (variant === 'menu') {
    return (
      <a
        href={CBISEO_KAKAO_CHANNEL_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={`block w-full border-t border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50 ${LINK_CLASS}`}
      >
        <span className="block text-sm font-medium text-slate-800">카카오톡 채널 상담</span>
        <span className="mt-0.5 block text-fluid-2xs text-slate-500">운영팀 · 빠른 상담</span>
      </a>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-fluid-xs leading-snug text-slate-700">
          급한 문의는 카카오톡 채널로 바로 상담하세요.
        </p>
        <a
          href={CBISEO_KAKAO_CHANNEL_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 ${LINK_CLASS}`}
        >
          카카오톡 채널로 채팅하기
        </a>
      </div>
    </div>
  );
}
