/** 앱 안 「?」 도움말 → /help CMS 글 (새 탭) */

export type HelpArticleLink = {
  section: string;
  article: string;
};

/** 긴 prefix 먼저 매칭 */
const PATH_RULES: { prefix: string; link: HelpArticleLink }[] = [
  { prefix: '/admin/dashboard', link: { section: 'settle', article: 'dashboard-read' } },
  { prefix: '/admin/inquiries/followup', link: { section: 'intake', article: 'intake-followup' } },
  { prefix: '/admin/inquiries/leads/settings', link: { section: 'intake', article: 'intake-web-form' } },
  { prefix: '/admin/inquiries/leads', link: { section: 'intake', article: 'intake-web-form' } },
  { prefix: '/admin/inquiries/order-issue', link: { section: 'order-form', article: 'order-form-send' } },
  { prefix: '/admin/inquiries/order-forms', link: { section: 'order-form', article: 'order-form-check' } },
  {
    prefix: '/admin/inquiries/order-customer-preview',
    link: { section: 'order-form', article: 'order-form-setup' },
  },
  { prefix: '/admin/inquiries/order-templates', link: { section: 'order-form', article: 'order-form-setup' } },
  {
    prefix: '/admin/inquiries/order-customer-link',
    link: { section: 'order-form', article: 'order-form-setup' },
  },
  { prefix: '/admin/inquiries/quotations', link: { section: 'order-form', article: 'quote-make' } },
  {
    prefix: '/admin/inquiries/receipts/cashbill',
    link: { section: 'payment', article: 'receipt-cash' },
  },
  {
    prefix: '/admin/inquiries/receipts/taxinvoice',
    link: { section: 'payment', article: 'receipt-tax' },
  },
  { prefix: '/admin/inquiries/cs', link: { section: 'customer', article: 'cs-handle' } },
  {
    prefix: '/admin/inquiries/review-payback',
    link: { section: 'customer', article: 'review-payback' },
  },
  { prefix: '/admin/inquiries', link: { section: 'intake', article: 'intake-list' } },
  { prefix: '/admin/schedule', link: { section: 'schedule', article: 'schedule-view' } },
  { prefix: '/admin/db-marketplace', link: { section: 'settle', article: 'db-market' } },
  { prefix: '/admin/advertising', link: { section: 'settle', article: 'ad-cost' } },
  { prefix: '/admin/messages', link: { section: 'customer', article: 'message-use' } },
  {
    prefix: '/admin/team-leaders/company-profile/business',
    link: { section: 'account', article: 'account-business' },
  },
  {
    prefix: '/admin/team-leaders/company-profile/outbound-email',
    link: { section: 'account', article: 'account-business' },
  },
  {
    prefix: '/admin/team-leaders/company-profile/subscription',
    link: { section: 'account', article: 'account-plan' },
  },
  { prefix: '/admin/team-leaders/wallet', link: { section: 'payment', article: 'wallet-charge' } },
  { prefix: '/admin/team-leaders/cashbill', link: { section: 'payment', article: 'receipt-connect' } },
  { prefix: '/admin/team-leaders/pg-onboarding', link: { section: 'payment', article: 'pay-card-pg' } },
  {
    prefix: '/admin/team-leaders/card-payment',
    link: { section: 'payment', article: 'pay-card-history' },
  },
  { prefix: '/admin/team-leaders/alimtalk', link: { section: 'customer', article: 'alimtalk-setup' } },
  {
    prefix: '/admin/team-leaders/operating-companies',
    link: { section: 'account', article: 'account-brands' },
  },
  {
    prefix: '/admin/team-leaders/operating-policy',
    link: { section: 'account', article: 'account-policy' },
  },
  {
    prefix: '/admin/team-leaders/inspection-template',
    link: { section: 'account', article: 'account-policy' },
  },
  {
    prefix: '/admin/team-leaders/page-settings',
    link: { section: 'account', article: 'account-policy' },
  },
  {
    prefix: '/admin/team-leaders/external-companies',
    link: { section: 'settle', article: 'external-settle' },
  },
  {
    prefix: '/admin/team-leaders/external-settlement',
    link: { section: 'settle', article: 'external-settle' },
  },
  {
    prefix: '/admin/team-leaders/tenant-partners',
    link: { section: 'settle', article: 'partner-settle' },
  },
  {
    prefix: '/admin/team-leaders/tenant-partner-settlement',
    link: { section: 'settle', article: 'partner-settle' },
  },
  { prefix: '/admin/team-leaders/e-contracts', link: { section: 'settle', article: 'e-contract' } },
  { prefix: '/admin/team-leaders/payroll', link: { section: 'settle', article: 'payroll' } },
  {
    prefix: '/admin/team-leaders/holiday-calendar',
    link: { section: 'schedule', article: 'schedule-holiday' },
  },
  { prefix: '/admin/team-leaders', link: { section: 'account', article: 'account-users' } },
  { prefix: '/team/dashboard', link: { section: 'team-app', article: 'team-today' } },
  { prefix: '/team/assignments', link: { section: 'team-app', article: 'team-today' } },
  { prefix: '/team/inspection', link: { section: 'team-app', article: 'team-site' } },
  { prefix: '/team/pre-clean-photo', link: { section: 'team-app', article: 'team-site' } },
  { prefix: '/team/post-clean-photo', link: { section: 'team-app', article: 'team-site' } },
  { prefix: '/team/card-payment', link: { section: 'team-app', article: 'team-pay' } },
  { prefix: '/team/household-ledger', link: { section: 'team-app', article: 'team-ledger' } },
  { prefix: '/team/profile', link: { section: 'team-app', article: 'team-profile' } },
];

export function resolveHelpArticleLink(pathname: string): HelpArticleLink | null {
  const path = pathname.split('?')[0] || pathname;
  for (const rule of PATH_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.link;
    }
  }
  return null;
}

export function helpArticleHref(link: HelpArticleLink): string {
  const sp = new URLSearchParams({
    category: 'usage',
    section: link.section,
    article: link.article,
  });
  return `/help?${sp.toString()}`;
}
