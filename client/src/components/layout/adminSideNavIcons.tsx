export type AdminSideNavIconId =
  | 'inbox'
  | 'clock'
  | 'gift'
  | 'document'
  | 'link'
  | 'template'
  | 'settings'
  | 'calculator'
  | 'megaphone'
  | 'building'
  | 'mail'
  | 'users'
  | 'handshake'
  | 'contract'
  | 'wallet'
  | 'chart'
  | 'calendar'
  | 'shield'
  | 'clipboard'
  | 'menu';

const PATH_ICON_RULES: { prefix: string; icon: AdminSideNavIconId }[] = [
  { prefix: '/admin/inquiries/review-payback', icon: 'gift' },
  { prefix: '/admin/inquiries/followup', icon: 'clock' },
  { prefix: '/admin/inquiries/order-forms', icon: 'document' },
  { prefix: '/admin/inquiries/order-issue', icon: 'link' },
  { prefix: '/admin/inquiries/order-templates', icon: 'template' },
  { prefix: '/admin/inquiries/order-customer', icon: 'settings' },
  { prefix: '/admin/inquiries/quotations', icon: 'calculator' },
  { prefix: '/admin/inquiries', icon: 'inbox' },
  { prefix: '/admin/advertising/settings', icon: 'settings' },
  { prefix: '/admin/advertising', icon: 'megaphone' },
  { prefix: '/admin/team-leaders/company-profile/subscription', icon: 'chart' },
  { prefix: '/admin/team-leaders/company-profile/business', icon: 'building' },
  { prefix: '/admin/team-leaders/company-profile/outbound-email', icon: 'mail' },
  { prefix: '/admin/team-leaders/e-contracts', icon: 'contract' },
  { prefix: '/admin/team-leaders/external-settlement', icon: 'wallet' },
  { prefix: '/admin/team-leaders/tenant-partner-settlement', icon: 'wallet' },
  { prefix: '/admin/team-leaders/payroll', icon: 'wallet' },
  { prefix: '/admin/team-leaders/leader-stats', icon: 'chart' },
  { prefix: '/admin/team-leaders/team-members', icon: 'users' },
  { prefix: '/admin/team-leaders/holiday-calendar', icon: 'calendar' },
  { prefix: '/admin/team-leaders/staff-access', icon: 'shield' },
  { prefix: '/admin/team-leaders/inspection-template', icon: 'clipboard' },
  { prefix: '/admin/team-leaders/operating-policy', icon: 'settings' },
  { prefix: '/admin/team-leaders/page-settings', icon: 'settings' },
  { prefix: '/admin/team-leaders/operating-companies', icon: 'building' },
  { prefix: '/admin/team-leaders/external-companies', icon: 'handshake' },
  { prefix: '/admin/team-leaders/tenant-partners', icon: 'handshake' },
  { prefix: '/admin/team-leaders', icon: 'users' },
];

export function resolveAdminSideNavIcon(path: string): AdminSideNavIconId {
  const rule = PATH_ICON_RULES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  return rule?.icon ?? 'menu';
}

export function AdminSideNavIcon({
  id,
  className = 'h-[18px] w-[18px] shrink-0',
}: {
  id: AdminSideNavIconId;
  className?: string;
}) {
  const stroke = 1.75;
  switch (id) {
    case 'inbox':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
        </svg>
      );
    case 'clock':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 7v5l3 2" />
        </svg>
      );
    case 'gift':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path strokeLinecap="round" d="M12 8v13M3 12h18M12 8c-2-2.5-4-3-4-5a2 2 0 114 0M12 8c2-2.5 4-3 4-5a2 2 0 10-4 0" />
        </svg>
      );
    case 'document':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path strokeLinecap="round" d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    case 'link':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5" />
          <path strokeLinecap="round" d="M14 11a5 5 0 00-7.07 0L5.52 12.41a5 5 0 007.07 7.07L14 19" />
        </svg>
      );
    case 'template':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case 'calculator':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path strokeLinecap="round" d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l18-5v12L3 14v-3z" />
          <path strokeLinecap="round" d="M11 14v5a2 2 0 004 0v-2" />
        </svg>
      );
    case 'building':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5a1 1 0 011-1h5v17M14 21V9h5a1 1 0 011 1v11M9 9h1M9 13h1M9 17h1M15 13h1M15 17h1" />
        </svg>
      );
    case 'mail':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path strokeLinecap="round" d="M3 7l9 6 9-6" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" d="M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1" />
          <circle cx="9" cy="7" r="3" />
          <path strokeLinecap="round" d="M22 19v-1a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'handshake':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l2-2 3 3 5-5 2 2-7 7-5-5z" />
          <path strokeLinecap="round" d="M4 20l3-3M20 20l-3-3" />
        </svg>
      );
    case 'contract':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" d="M8 4h8l4 4v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path strokeLinecap="round" d="M16 4v4h4M10 13h6M10 17h4" />
        </svg>
      );
    case 'wallet':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path strokeLinecap="round" d="M3 10h18M16 14h2" />
        </svg>
      );
    case 'chart':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" d="M4 19V5M4 19h16" />
          <path strokeLinecap="round" d="M8 17V9M12 17V7M16 17v-5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <rect x="5" y="4" width="14" height="18" rx="2" />
          <path strokeLinecap="round" d="M9 4h6a2 2 0 012 2v1H7V6a2 2 0 012-2zM9 12h6M9 16h4" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} aria-hidden>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}
