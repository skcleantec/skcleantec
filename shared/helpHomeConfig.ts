/** /help 사용법 홈 — 문구·slug (플랫폼 CMS 글과 맞춤, 시드 아님) */

export const HELP_HOME_HERO = {
  title: '무엇을 도와드릴까요?',
  subtitle: '입주청소·이사청소 업체가 청소비서를 쓰다 막히는 곳을 모았어요.',
  searchPlaceholder: '예: 현금영수증, 팀장 배정, 알림톡 충전',
  popularChips: ['현금영수증', '배정', '발주서 링크', '카드결제', '월정산표'] as const,
} as const;

export const HELP_HOME_AUDIENCE = [
  {
    id: 'newcomer',
    title: '처음 왔어요',
    cta: '30분 만에 시작하기',
    tone: 'navy' as const,
    kind: 'article' as const,
    articleSlug: 'start-first-day',
    sectionSlug: 'start',
    mobileOrder: 2,
  },
  {
    id: 'admin',
    title: '사장님·관리자·마케터',
    cta: '접수부터 정산까지',
    tone: 'navy' as const,
    kind: 'scrollCategories' as const,
    mobileOrder: 3,
  },
  {
    id: 'team',
    title: '팀장님',
    cta: '팀장 앱 쓰는 법',
    tone: 'green' as const,
    kind: 'section' as const,
    sectionSlug: 'team-app',
    mobileOrder: 1,
  },
] as const;

export const HELP_HOME_POPULAR_ARTICLES = [
  { slug: 'intake-new', section: 'intake' },
  { slug: 'schedule-assign', section: 'schedule' },
  { slug: 'order-form-send', section: 'order-form' },
  { slug: 'receipt-cash', section: 'payment' },
  { slug: 'pay-card-pg', section: 'payment' },
  { slug: 'plans-and-costs', section: 'settle' },
] as const;

export const HELP_HOME_FAQ_ARTICLE = {
  slug: 'faq-top',
  section: 'faq',
  prompts: [
    '로그인이 안 돼요',
    '메뉴가 잠겨 보여요',
    '팀장이 배정을 못 봐요',
    '알림톡이 안 가요',
  ],
} as const;

export const HELP_HOME_TROUBLE_ARTICLES = [
  { slug: 'fix-alimtalk', section: 'faq', label: '알림톡이 안 가요' },
  { slug: 'fix-card', section: 'faq', label: '카드결제가 안 돼요' },
  { slug: 'fix-team-cant-see', section: 'faq', label: '팀장이 배정을 못 봐요' },
  { slug: 'fix-menu-locked', section: 'faq', label: '메뉴가 잠겨 보여요' },
] as const;

export const HELP_HOME_CONTACT = {
  title: '찾는 답이 없으신가요?',
  hours: '평일 오전 10시~오후 7시에 답해 드려요.',
  kakaoUrl: 'http://pf.kakao.com/_vnxjSX',
  kakaoLabel: '카카오톡으로 묻기',
  phone: '010-6862-8692',
  phoneTel: 'tel:01068628692',
  email: 'cto@service-bridges.com',
} as const;

export const HELP_INQUIRY_SUGGEST_ARTICLES = [
  { slug: 'fix-login', section: 'faq', label: '로그인이 안 돼요' },
  { slug: 'fix-menu-locked', section: 'faq', label: '메뉴가 잠겨 보여요' },
  { slug: 'fix-team-cant-see', section: 'faq', label: '팀장이 배정을 못 봐요' },
] as const;

export function helpCmsArticlePath(section: string, article: string): string {
  const sp = new URLSearchParams({
    category: 'usage',
    section,
    article,
  });
  return `/help?${sp.toString()}`;
}
