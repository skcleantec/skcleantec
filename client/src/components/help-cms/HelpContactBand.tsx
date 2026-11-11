import { HELP_ART, HELP_HOME_CONTACT } from '@shared/helpHomeConfig';

function ChatIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

function PhoneIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

/** 도움말 첫 화면 「찾는 답이 없으신가요?」 — PC: 왼쪽 사진 + 오른쪽 내용 / 휴대폰: 사진 위, 버튼 세로 */
export function HelpContactBand({ onGoInquiry }: { onGoInquiry: () => void }) {
  return (
    <section
      aria-labelledby="help-contact-title"
      className="overflow-hidden rounded-2xl bg-white shadow-card lg:flex"
    >
      <div className="relative h-[170px] lg:h-auto lg:min-h-[300px] lg:w-[420px] lg:shrink-0">
        <img
          src={HELP_ART.contactPhoto}
          alt=""
          aria-hidden="true"
          width={1200}
          height={896}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover object-[50%_60%] lg:object-[45%_60%]"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3 px-[18px] pb-[18px] pt-5 lg:flex-1 lg:justify-center lg:gap-[18px] lg:px-10 lg:py-9">
        <div className="flex flex-col gap-1.5 lg:gap-2">
          <span className="text-fluid-xs font-bold text-sky-600">청소비서 고객센터</span>
          <h3 id="help-contact-title" className="text-fluid-xl font-extrabold leading-snug text-slate-900">
            {HELP_HOME_CONTACT.title}
          </h3>
          <p className="text-fluid-sm leading-relaxed text-slate-600">
            담당자가 직접 확인하고, 남겨 주신 이메일로 답해 드려요.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <a
            href="/help?category=inquiry&compose=1"
            onClick={(e) => {
              e.preventDefault();
              onGoInquiry();
            }}
            className="flex min-h-[44px] items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-white hover:bg-slate-800 lg:gap-3.5 lg:rounded-2xl lg:p-[18px]"
          >
            <span className="flex shrink-0 items-center justify-center lg:h-11 lg:w-11 lg:rounded-xl lg:bg-white/[0.12]">
              <ChatIcon className="h-5 w-5 lg:h-[22px] lg:w-[22px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-fluid-base font-extrabold">1:1 문의 남기기</span>
              <span className="hidden text-fluid-xs text-slate-300 lg:block">이메일로 답변을 받아요</span>
            </span>
            <span aria-hidden="true" className="text-fluid-base text-slate-400">
              ›
            </span>
          </a>
          <a
            href={HELP_HOME_CONTACT.phoneTel}
            className="flex min-h-[44px] items-center gap-3 rounded-xl bg-field px-4 py-3.5 text-slate-900 hover:bg-track lg:gap-3.5 lg:rounded-2xl lg:p-[18px]"
          >
            <span className="flex shrink-0 items-center justify-center text-sky-700 lg:h-11 lg:w-11 lg:rounded-xl lg:bg-sky-100">
              <PhoneIcon className="h-5 w-5 lg:h-[22px] lg:w-[22px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-fluid-base font-extrabold tabular-nums">
                <span className="lg:hidden">전화 </span>
                {HELP_HOME_CONTACT.phone}
              </span>
              <span className="hidden text-fluid-xs text-slate-500 lg:block">급할 땐 전화로</span>
            </span>
            <span aria-hidden="true" className="text-fluid-base text-slate-400">
              ›
            </span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-fluid-xs text-slate-500 lg:border-t lg:border-[#eef1f6] lg:pt-3.5 lg:text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="hidden lg:inline-flex">
              <ClockIcon />
            </span>
            평일 오전 10시~오후 7시
          </span>
          <a
            href={`mailto:${HELP_HOME_CONTACT.email}`}
            className="hidden items-center gap-1.5 text-slate-600 hover:text-slate-900 lg:flex"
          >
            <MailIcon />
            {HELP_HOME_CONTACT.email}
          </a>
        </div>
      </div>
    </section>
  );
}
