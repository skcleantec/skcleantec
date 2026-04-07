import { useState, useEffect } from 'react';
import { getCsReports, updateCsReport, type CsReport } from '../../api/cs';
import { getToken } from '../../stores/auth';
import { formatDateTimeCompactWithWeekday, formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { ImageThumbLightbox } from '../../components/ui/ImageThumbLightbox';

const STATUS_OPTIONS = [
  { value: 'RECEIVED', label: '접수' },
  { value: 'PROCESSING', label: '처리중' },
  { value: 'DONE', label: '완료' },
];

const INQUIRY_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S 처리중',
};

function formatTeamLeaderLabel(inquiry: NonNullable<CsReport['inquiry']>): string {
  const names = inquiry.assignments.map((a) => a.teamLeader.name).filter(Boolean);
  return names.length ? names.join(' · ') : '미배정';
}

function formatAreaLine(inquiry: NonNullable<CsReport['inquiry']>): string {
  if (inquiry.areaPyeong == null) return '-';
  const b = inquiry.areaBasis?.trim();
  return b ? `${b} ${inquiry.areaPyeong}평` : `${inquiry.areaPyeong}평`;
}

function OpenInNewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export function AdminCsPage() {
  const token = getToken();
  const [items, setItems] = useState<CsReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CsReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectedInquiryModal, setConnectedInquiryModal] = useState<NonNullable<CsReport['inquiry']> | null>(
    null
  );

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    getCsReports(token)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [token]);

  const openDetail = (item: CsReport) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
  };

  const closeDetail = () => {
    setSelected(null);
  };

  const handleSave = async () => {
    if (!token || !selected) return;
    setSaving(true);
    try {
      const updated = await updateCsReport(token, selected.id, { status: editStatus, memo: editMemo });
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!token || !selected) return;
    setSaving(true);
    try {
      const updated = await updateCsReport(token, selected.id, { status: 'DONE', memo: editMemo });
      setEditStatus('DONE');
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 완료 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const csLink = `${window.location.origin}/cs`;

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 min-w-0">
        <h1 className="text-xl font-semibold text-gray-900 shrink-0">C/S 관리</h1>
        <div className="flex flex-col gap-2 sm:items-end min-w-0 w-full sm:w-auto">
          <a
            href="/cs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto px-4 py-2 text-fluid-sm font-medium text-white bg-blue-600 rounded-lg border border-blue-700 hover:bg-blue-700 active:bg-blue-800 touch-manipulation shadow-sm"
          >
            <OpenInNewIcon className="h-4 w-4 shrink-0" />
            고객용 C/S 페이지 미리보기
          </a>
          <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
            <span className="text-gray-500 shrink-0">고객 링크</span>
            <code className="text-xs sm:text-sm bg-gray-100 px-2 py-1 rounded truncate max-w-[min(100%,14rem)] sm:max-w-xs">
              {csLink}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(csLink)}
              className="text-sm px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 shrink-0 touch-manipulation min-h-[36px]"
            >
              복사
            </button>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4 bg-gray-50 px-3 py-2 rounded">
        고객에게 아래와 같이 안내하실 수 있습니다. 링크를 복사해 메시지에 붙여 넣어 주세요.
        <br />
        <strong>예시:</strong> "불편 사항이 있으시면 아래 링크에서 접수해 주세요. 사진 첨부가 가능합니다. [링크]"
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">접수된 C/S가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-center p-3 font-medium text-gray-700">날짜</th>
                <th className="text-center p-3 font-medium text-gray-700">성함</th>
                <th className="text-center p-3 font-medium text-gray-700">연락처</th>
                <th className="text-center p-3 font-medium text-gray-700">상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetail(item)}
                >
                  <td className="p-3 text-[11px] text-gray-700 tabular-nums whitespace-nowrap">
                    {formatDateTimeCompactWithWeekday(item.createdAt)}
                  </td>
                  <td className="p-3">{item.customerName}</td>
                  <td className="p-3">{item.customerPhone}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        item.status === 'DONE'
                          ? 'bg-green-100 text-green-800'
                          : item.status === 'PROCESSING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_OPTIONS.find((s) => s.value === item.status)?.label ?? item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeDetail}>
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={closeDetail} />
            <div className="p-4 border-b pr-12">
              <h2 className="font-semibold">C/S 상세</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div>
                  <span className="text-gray-500 text-sm">처리 상태</span>
                  <p className="font-medium">
                    {STATUS_OPTIONS.find((s) => s.value === selected.status)?.label ?? selected.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving || selected.status === 'DONE'}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 border border-green-700 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {selected.status === 'DONE' ? '처리 완료됨' : '처리완료'}
                </button>
              </div>

              <div>
                <span className="text-gray-500 text-sm">성함</span>
                <p className="font-medium">{selected.customerName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">연락처</span>
                <p className="font-medium">{selected.customerPhone}</p>
              </div>

              {selected.inquiry ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div>
                    <span className="text-gray-500 text-sm">담당 팀장</span>
                    <p className="font-medium text-gray-900">{formatTeamLeaderLabel(selected.inquiry)}</p>
                  </div>
                  {selected.inquiry.inquiryNumber ? (
                    <p className="text-sm text-gray-700">
                      접수번호{' '}
                      <span className="font-mono tabular-nums">{selected.inquiry.inquiryNumber}</span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setConnectedInquiryModal(selected.inquiry!)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 touch-manipulation"
                  >
                    연결 접수 상세 보기
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  접수 목록과 자동 연결된 건이 없습니다. (성함·연락처가 접수 DB와 일치할 때 연결됩니다.)
                </p>
              )}

              <div>
                <span className="text-gray-500 text-sm">내용</span>
                <p className="whitespace-pre-wrap text-sm">{selected.content}</p>
              </div>
              {selected.imageUrls?.length ? (
                <div>
                  <span className="text-gray-500 text-sm block mb-2">첨부 사진</span>
                  <div className="flex flex-wrap gap-2">
                    {selected.imageUrls.map((url, i) => {
                      const slides = selected.imageUrls.map((u, j) => ({
                        src: u,
                        alt: `첨부 ${j + 1}`,
                      }));
                      return (
                        <ImageThumbLightbox
                          key={i}
                          src={url}
                          alt={`첨부 ${i + 1}`}
                          thumbClassName="w-6 h-6 object-cover rounded border border-gray-200"
                          buttonClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 touch-manipulation"
                          gallerySlides={selected.imageUrls.length > 1 ? slides : undefined}
                          galleryIndex={i}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태 (수동 변경)</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
                  placeholder="내부 메모"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50 min-h-[44px] touch-manipulation"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {connectedInquiryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setConnectedInquiryModal(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalCloseButton onClick={() => setConnectedInquiryModal(null)} />
            <div className="p-4 border-b pr-12">
              <h2 className="font-semibold">연결된 접수 상세</h2>
              {connectedInquiryModal.inquiryNumber ? (
                <p className="text-sm text-gray-600 mt-1">
                  접수번호{' '}
                  <span className="font-mono tabular-nums">{connectedInquiryModal.inquiryNumber}</span>
                </p>
              ) : null}
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">담당 팀장</span>
                <p className="font-medium">{formatTeamLeaderLabel(connectedInquiryModal)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">접수 상태</span>
                <p>{INQUIRY_STATUS_LABELS[connectedInquiryModal.status] ?? connectedInquiryModal.status}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">고객</span>
                <p>
                  {connectedInquiryModal.customerName} / {connectedInquiryModal.customerPhone}
                  {connectedInquiryModal.customerPhone2 ? ` / ${connectedInquiryModal.customerPhone2}` : ''}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">주소</span>
                <p className="whitespace-pre-wrap">
                  {connectedInquiryModal.address}
                  {connectedInquiryModal.addressDetail ? ` ${connectedInquiryModal.addressDetail}` : ''}
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">평수</span>
                <p>{formatAreaLine(connectedInquiryModal)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs block mb-0.5">희망일·시간</span>
                <p>
                  {connectedInquiryModal.preferredDate
                    ? formatDateCompactWithWeekday(connectedInquiryModal.preferredDate)
                    : '-'}
                  {connectedInquiryModal.preferredTime
                    ? ` · ${connectedInquiryModal.preferredTime}`
                    : ''}
                  {connectedInquiryModal.preferredTimeDetail
                    ? ` (${connectedInquiryModal.preferredTimeDetail})`
                    : ''}
                </p>
              </div>
              {connectedInquiryModal.memo?.trim() ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">접수 메모</span>
                  <p className="whitespace-pre-wrap text-gray-800">{connectedInquiryModal.memo}</p>
                </div>
              ) : null}
              {connectedInquiryModal.claimMemo?.trim() ? (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">클레임 메모</span>
                  <p className="whitespace-pre-wrap text-gray-800">{connectedInquiryModal.claimMemo}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
