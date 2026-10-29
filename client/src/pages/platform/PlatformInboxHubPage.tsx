import { Link } from 'react-router-dom';
import { CARD_SECTION } from '../../utils/platformUi';

const LINKS = [
  { label: '가입승인 게시판', to: '/platform/signup-inquiries', hint: '새 업체 가입을 확인합니다.' },
  { label: '유료 전환 신청', to: '/platform/plan-upgrade-requests', hint: '유료 플랜 전환 신청을 확인합니다.' },
  { label: '문의 링크 신청', to: '/platform/landing-contact-link-requests', hint: '랜딩 문의 링크 신청을 확인합니다.' },
  { label: '이용료 청구', to: '/platform/billing', hint: '입금 확인이 필요한 이용료를 봅니다.' },
  { label: '계산서(바로빌)', to: '/platform/barobill-members', hint: '회원사 연결과 인증서 대기 건을 봅니다.' },
  { label: '카드결제 PG', to: '/platform/card-payment', hint: 'PG 가입 신청을 봅니다.' },
] as const;

/** 기존 확인 화면으로만 연결한다. 대기 건수 집계는 아직 붙이지 않는다. */
export function PlatformInboxHubPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">오늘 할 일</h1>
        <p className="mt-1 text-sm text-gray-500">
          확인이 필요한 화면으로 바로 이동합니다. 건수 배지는 다음 단계에서 붙습니다.
        </p>
      </div>
      <ul className="space-y-2">
        {LINKS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`${CARD_SECTION} block hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2`}
            >
              <div className="text-sm font-semibold text-gray-900">{item.label}</div>
              <p className="mt-0.5 text-xs text-gray-500">{item.hint}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
