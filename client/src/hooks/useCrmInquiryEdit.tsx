import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { getToken } from '../stores/auth';
import { getInquiry } from '../api/inquiries';
import type { ScheduleItem } from '../api/schedule';
import { ScheduleInquiryDetailModal } from '../components/admin/ScheduleInquiryDetailModal';
import { useCrmInquiryEditSupport } from './useCrmInquiryEditSupport';

export function useCrmInquiryEdit(enabled: boolean, onSaved?: () => void) {
  const support = useCrmInquiryEditSupport(enabled);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openInquiryEdit = useCallback((inquiryId: string) => {
    const token = getToken();
    if (!token) return;
    setOpeningId(inquiryId);
    void (async () => {
      try {
        const raw = await getInquiry(token, inquiryId);
        setEditItem(raw as unknown as ScheduleItem);
      } catch {
        setEditItem(null);
      } finally {
        setOpeningId(null);
      }
    })();
  }, []);

  const close = useCallback(() => setEditItem(null), []);

  const handleSaved = useCallback(() => {
    close();
    onSaved?.();
  }, [close, onSaved]);

  const refreshInquiry = useCallback(async () => {
    const token = getToken();
    if (!token || !editItem) return;
    try {
      const raw = await getInquiry(token, editItem.id);
      setEditItem(raw as unknown as ScheduleItem);
    } catch {
      /* keep current */
    }
  }, [editItem]);

  const token = getToken();
  const layer =
    enabled && token ? (
      <>
        {openingId ? (
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/25"
              aria-busy="true"
              aria-label="접수 상세 불러오는 중"
            >
              <span className="rounded-xl bg-white px-4 py-2.5 text-fluid-sm font-medium text-slate-800 shadow-lg">
                접수 상세 불러오는 중…
              </span>
            </div>,
            document.body,
          )
        ) : null}

        {editItem && !openingId && !support.loading ? (
          <ScheduleInquiryDetailModal
            mode="edit"
            token={token}
            item={editItem}
            teamLeaders={support.teamLeaders}
            professionalCatalog={support.profCatalog}
            currentUserRole={support.me?.role ?? null}
            currentUserOperationalAdmin={support.operationalAdmin}
            currentUserCanEditMarketer={support.canEditMarketerField}
            currentUserCanDeleteInquiry={support.canDeleteInquiry}
            marketerOptions={support.marketers}
            meUser={support.me}
            onClose={close}
            onSaved={handleSaved}
            onInquiryRefresh={refreshInquiry}
            serviceZones={support.serviceZones}
            customCalendars={support.customCalendars}
            onCustomCalendarsChange={support.setCustomCalendars}
            teamLeaderAssignmentSurface="inquiry-list"
          />
        ) : null}
      </>
    ) : null;

  return { openInquiryEdit, layer };
}
