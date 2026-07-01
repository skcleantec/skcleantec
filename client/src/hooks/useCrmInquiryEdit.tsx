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
  const [openError, setOpenError] = useState<string | null>(null);

  const openInquiryEdit = useCallback((inquiryId: string) => {
    const token = getToken();
    if (!token) return;
    setOpenError(null);
    setOpeningId(inquiryId);
    void (async () => {
      try {
        const raw = await getInquiry(token, inquiryId);
        setEditItem(raw as unknown as ScheduleItem);
      } catch (e) {
        setEditItem(null);
        setOpenError(e instanceof Error ? e.message : '접수를 불러올 수 없습니다.');
      } finally {
        setOpeningId(null);
      }
    })();
  }, []);

  const close = useCallback(() => {
    setEditItem(null);
    setOpenError(null);
  }, []);

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
  const detailLoading = Boolean(openingId || (editItem && support.loading));

  const layer =
    enabled && token ? (
      <>
        {detailLoading ? (
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

        {openError && !detailLoading ? (
          createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/25 p-4">
              <div className="max-w-sm rounded-xl bg-white p-4 shadow-lg text-center space-y-3">
                <p className="text-fluid-sm text-red-700">{openError}</p>
                <button
                  type="button"
                  onClick={() => setOpenError(null)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white"
                >
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        ) : null}

        {editItem && !detailLoading && !openError ? (
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
