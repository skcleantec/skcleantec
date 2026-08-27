import { createPortal } from 'react-dom';
import { ModalCloseButton } from './ModalCloseButton';
import { OUTBOUND_EMAIL_PROVIDERS } from '../../utils/outboundEmailProviders';

/** Google 계정 앱 비밀번호 발급 (2단계 인증 필요) */
const GOOGLE_APP_PASSWORDS_URL = 'https://myaccount.google.com/apppasswords';

type Props = {
  onClose: () => void;
  companyName?: string;
  /** 플랫폼 SMTP 등 다른 화면에서 제목·소개만 바꿀 때 */
  title?: string;
  intro?: string;
};

export { PROVIDER_PRESETS } from '../../utils/outboundEmailProviders';

export function TenantSmtpSetupGuideModal({ onClose, companyName, title, intro }: Props) {
  const fromExample = companyName?.trim()
    ? `"${companyName.trim()}" · ${'your@gmail.com'}`
    : '"회사명" · your@gmail.com';
  const dialogTitle = title ?? '고객 메일 보내기 — 설정 안내';
  const dialogIntro =
    intro ??
    '견적서·현장 완료본 등 고객에게 보내는 메일을, 우리 업체 메일 주소로 연결하는 방법입니다.';

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[500] flex flex-col justify-end bg-black/40 p-0 sm:flex-row sm:items-center sm:justify-center sm:p-4"
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
            <h3 className="text-sm font-semibold text-blue-950">쉬운 말로 설명</h3>
            <dl className="mt-2 space-y-2 text-xs leading-relaxed text-blue-950/90">
              <div>
                <dt className="font-medium">보낼 메일 주소</dt>
                <dd className="text-blue-900/80">메일함에 로그인할 때 쓰는 이메일 (@ 포함 전체)</dd>
              </div>
              <div>
                <dt className="font-medium">받는 사람에게 보이는 이름</dt>
                <dd className="text-blue-900/80">고객 메일함에 「발신: ○○」처럼 보이는 회사·브랜드 이름</dd>
              </div>
              <div>
                <dt className="font-medium">메일 연동 비밀번호</dt>
                <dd className="text-blue-900/80">
                  메일 앱·청소비서 연결용 비밀번호. 일반 로그인 비밀번호와 다를 수 있습니다.{' '}
                  <a
                    href={GOOGLE_APP_PASSWORDS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                  >
                    Gmail 앱 비밀번호 발급
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium">예시 (보내는 사람 표시)</dt>
                <dd className="text-blue-900/80">{fromExample}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">메일 종류별 안내</h3>
            <div className="mt-2 space-y-2">
              {OUTBOUND_EMAIL_PROVIDERS.filter((p) => p.id !== 'custom').map((p) => (
                <div key={p.id} className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="mt-1 text-gray-600 leading-relaxed">{p.passwordHint}</p>
                  {p.id === 'gmail' ? (
                    <a
                      href={GOOGLE_APP_PASSWORDS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[12px] font-semibold text-indigo-900 hover:bg-indigo-100"
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
              <li>화면에서 「Gmail」을 선택합니다.</li>
              <li>Google 계정 → 보안 → 「앱 비밀번호」에서 16자리를 발급합니다.</li>
              <li>보낼 메일 주소 · 받는 사람에게 보이는 이름 · 연동 비밀번호를 입력합니다.</li>
              <li>「저장하고 연습 메일 보내기」로 본인 메일함(스팸함 포함)을 확인합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">자주 나는 오류</h3>
            <ul className="mt-2 space-y-2 text-xs text-gray-700 leading-relaxed">
              <li>
                <span className="font-medium text-gray-900">로그인 거부</span> — Gmail은 앱 비밀번호인지,
                @gmail.com 전체 주소를 넣었는지 확인하세요.
              </li>
              <li>
                <span className="font-medium text-gray-900">연결 실패</span> — Gmail·네이버는 보안 연결(잠금)
                끄기, 다음·카카오는 켜기.
              </li>
              <li>
                <span className="font-medium text-gray-900">보내는 사람 불일치</span> — 보낼 메일 주소와
                로그인 계정이 같은 메일함인지 확인하세요.
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
    </div>,
    document.body,
  );
}
