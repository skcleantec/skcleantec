import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTeamInquiry } from '../api/team';
import type { InquiryItem } from '../pages/team/teamInquiryShared';

/** `?openInquiry=` — 촬영·검수 페이지에서 돌아올 때 상세 모달 자동 오픈 */
export function useTeamOpenInquiryDeepLink(
  token: string | null,
  onOpen: (item: InquiryItem) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const openInquiryId = searchParams.get('openInquiry');

  useEffect(() => {
    if (!openInquiryId || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await getTeamInquiry(token, openInquiryId);
        if (cancelled) return;
        onOpen(raw as InquiryItem);
      } catch {
        /* 담당 아님·삭제 등 */
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('openInquiry');
              return next;
            },
            { replace: true },
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // openInquiryId 변경 시에만 1회 딥링크 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openInquiryId, token]);
}
