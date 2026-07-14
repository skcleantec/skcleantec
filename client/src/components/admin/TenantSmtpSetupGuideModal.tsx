import { ModalCloseButton } from './ModalCloseButton';

/** Google 계정 앱 비밀번호 발급 (2단계 인증 필요) */
const GOOGLE_APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords';

type Props = {
  onClose: () => void;
  companyName?: string;
  /** 플랫폼 SMTP 등 다른 화면에서 제목·소개만 바꿀 때 */
  title?: string;
  intro?: string;
};

const PROVIDER_PRESETS = [
  {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    note: 'Google 계정 → 보안 → 2단계 인증 후 「앱 비밀번호」 발급',
  },
  {
    name: '네이버 메일',
    host: 'smtp.naver.com',
    port: '587',
    secure: false,
    note: '네이버 메일 → 환경설정 → POP3/IMAP → SMTP 사용 ON, 네이버 비밀번호 사용',
  },
  {
    name: '다음·카카오 메일',
    host: 'smtp.daum.net',
    port: '465',
    secure: true,
    note: '다음 메일 → 환경설정 → IMAP/SMTP 사용, SSL 연결',
  },
] as const;

export { PROVIDER_PRESETS };

export function TenantSmtpSetupGuideModal({ onClose, companyName, title, intro }: Props) {
  const fromExample = companyName?.trim()
    ? `"${companyName.trim()}" <your@gmail.com>`
    : '"회사명" <your@gmail.com>';
  const dialogTitle = title ?? '고객 완료본 메일 — 발송 설정 안내';
  const dialogIntro =
    intro ??
    '현장 검수 「청소완료」 후 고객에게 보내는 PDF·완료본 메일을, 업체 메일 계정으로 발송하기 위한 설정입니다.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smtp-guide-title"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-xl sm:rounded-lg bg-white shadow-lg">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
          <ModalCloseButton onClick={onClose} />
          <h2 id="smtp-guide-title" className="text-lg font-semibold text-gray-900 pr-8">
            {dialogTitle}
          </h2>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">{dialogIntro}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-5 text-sm text-gray-800">
          <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <h3 className="text-sm font-semibold text-blue-950">용어 설명</h3>
            <dl className="mt-2 space-y-2 text-xs leading-relaxed text-blue-950/90">
              <div>
                <dt className="font-medium">메일 서버 주소 (SMTP 호스트)</dt>
                <dd className="text-blue-900/80">메일을 실제로 보내 주는 업체 서버 주소입니다. Gmail이면 smtp.gmail.com</dd>
              </div>
              <div>
                <dt className="font-medium">연결 포트</dt>
                <dd className="text-blue-900/80">서버와 연결하는 문 번호입니다. 대부분 587(일반) 또는 465(SSL)</dd>
              </div>
              <div>
                <dt className="font-medium">메일 계정 (로그인 이메일)</dt>
                <dd className="text-blue-900/80">메일함에 로그인할 때 쓰는 전체 이메일 주소입니다</dd>
              </div>
              <div>
                <dt className="font-medium">보내는 사람 표시 (From)</dt>
                <dd className="text-blue-900/80">
                  고객 메일함에 보이는 발신자 이름·주소입니다. 예: {fromExample}
                </dd>
              </div>
              <div>
                <dt className="font-medium">앱 비밀번호</dt>
                <dd className="text-blue-900/80">
                  Gmail 등에서 「메일 프로그램 연결」용으로 따로 발급하는 16자리 비밀번호입니다. 일반
                  로그인 비밀번호와 다릅니다.{' '}
                  <a
                    href={GOOGLE_APP_PASSWORDS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                  >
                    Google 앱 비밀번호 발급 바로가기
                  </a>
                  <span className="text-blue-900/70"> (2단계 인증 필요)</span>
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">메일 서비스별 기본값</h3>
            <div className="mt-2 space-y-2">
              {PROVIDER_PRESETS.map((p) => (
                <div key={p.name} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="mt-1 font-mono text-gray-700">
                    서버 {p.host} · 포트 {p.port} · SSL {p.secure ? '사용' : '미사용'}
                  </p>
                  <p className="mt-1 text-gray-600 leading-relaxed">{p.note}</p>
                  {p.name === 'Gmail' ? (
                    <a
                      href={GOOGLE_APP_PASSWORDS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-100"
                    >
                      Google 앱 비밀번호 발급 →
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">Gmail 설정 순서</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-gray-700 leading-relaxed">
              <li>Google 계정에서 2단계 인증을 켭니다.</li>
              <li>
                Google 계정 → 보안 → 「앱 비밀번호」에서 메일용 비밀번호를 발급합니다. (16자리, 공백
                없이 입력){' '}
                <a
                  href={GOOGLE_APP_PASSWORDS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                >
                  앱 비밀번호 발급 페이지 열기
                </a>
              </li>
              <li>
                아래 항목을 입력합니다.
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>메일 서버: smtp.gmail.com</li>
                  <li>포트: 587 · SSL 암호화 연결: 체크 해제</li>
                  <li>메일 계정: you@gmail.com (전체 주소)</li>
                  <li>보내는 사람: &quot;회사명&quot; &lt;you@gmail.com&gt;</li>
                  <li>앱 비밀번호: 발급받은 16자리</li>
                </ul>
              </li>
              <li>저장 후 「테스트 발송」으로 본인 메일함을 확인합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">자주 나는 오류</h3>
            <ul className="mt-2 space-y-2 text-xs text-gray-700 leading-relaxed">
              <li>
                <span className="font-medium text-gray-900">로그인 거부 / 535 오류</span> — Gmail은 일반
                비밀번호가 아닌 앱 비밀번호인지, 메일 계정에 @gmail.com 전체 주소를 넣었는지 확인하세요.
              </li>
              <li>
                <span className="font-medium text-gray-900">연결 실패</span> — 포트(587/465)와 SSL
                체크 여부가 서비스 안내와 맞는지 확인하세요.
              </li>
              <li>
                <span className="font-medium text-gray-900">보내는 사람 불일치</span> — From 주소의
                이메일과 로그인 계정이 같은 메일함인지 확인하세요.
              </li>
            </ul>
          </section>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
