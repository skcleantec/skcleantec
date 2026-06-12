/**
 * DB 목록 재조회 시 로딩·스크롤 처리.
 * - 기존 행이 있으면 표/카드를 갈아끼우지 않고(stale-while-revalidate) 스크롤을 유지한다.
 * - 필터·페이지 변경 시에는 호출 측에서 scrollToTop을 먼저 호출한다.
 */
export function shouldShowListBlockingLoading(loading: boolean, itemCount: number): boolean {
  return loading && itemCount === 0;
}

export function beginListRefresh(options: {
  showLoading: boolean;
  itemCount: number;
  setLoading: (value: boolean) => void;
  preserveScroll: () => void;
}): void {
  const { showLoading, itemCount, setLoading, preserveScroll } = options;
  if (showLoading && itemCount === 0) {
    setLoading(true);
  } else if (itemCount > 0) {
    preserveScroll();
  }
}
