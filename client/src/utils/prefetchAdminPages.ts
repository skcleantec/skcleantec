/** GNB hover/focus 시 lazy 페이지 청크 선로드 */
export type PrefetchAdminNavId = 'inquiries' | 'schedule' | 'advertising' | 'messages';

const prefetched = new Set<PrefetchAdminNavId>();

export function prefetchAdminNavPage(id: PrefetchAdminNavId): void {
  if (prefetched.has(id)) return;
  prefetched.add(id);
  switch (id) {
    case 'inquiries':
      void import('../pages/admin/AdminInquiriesPage');
      break;
    case 'schedule':
      void import('../pages/admin/AdminSchedulePage');
      break;
    case 'advertising':
      void import('../pages/admin/AdminAdvertisingPage');
      break;
    case 'messages':
      void import('../pages/admin/AdminMessagesPage');
      break;
    default:
      break;
  }
}

export function adminNavPrefetchHandlers(id: PrefetchAdminNavId): {
  onMouseEnter: () => void;
  onFocus: () => void;
} {
  return {
    onMouseEnter: () => prefetchAdminNavPage(id),
    onFocus: () => prefetchAdminNavPage(id),
  };
}
