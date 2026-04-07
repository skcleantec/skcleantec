import { useState, useEffect } from 'react';
import { getCsReports, updateCsReport, type CsReport } from '../../api/cs';
import { getTeamCsReports, patchTeamCsReport } from '../../api/team';
import { getToken } from '../../stores/auth';
import { getTeamToken } from '../../stores/teamAuth';
import {
  formatDateTimeCompactWithWeekday,
  formatDateCompactWithWeekday,
  formatDateTimeTinyKo,
} from '../../utils/dateFormat';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { ImageThumbLightbox } from '../ui/ImageThumbLightbox';
import { SyncHorizontalScroll } from '../ui/SyncHorizontalScroll';

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

function roleLabelKo(role: string): string {
  if (role === 'ADMIN') return '관리자';
  if (role === 'MARKETER') return '마케터';
  if (role === 'TEAM_LEADER') return '팀장';
  return role;
}

function formatTeamLeaderLabel(inquiry: NonNullable<CsReport['inquiry']>): string {
  const names = inquiry.assignments.map((a) => a.teamLeader.name).filter(Boolean);
  return names.length ? names.join(' · ') : '미배정';
}

function assigneeListLabel(item: CsReport): string {
  if (!item.inquiry) return '—';
  return formatTeamLeaderLabel(item.inquiry);
}

function processorNameLabel(item: CsReport): string {
  const n = item.completedBy?.name?.trim();
  return n || '—';
}

function formatAreaLine(inquiry: NonNullable<CsReport['inquiry']>): string {
  if (inquiry.areaPyeong == null) return '-';
  const b = inquiry.areaBasis?.trim();
  return b ? `${b} ${inquiry.areaPyeong}평` : `${inquiry.areaPyeong}평`;
}

function ServiceRatingStars({ value }: { value: number | null | undefined }) {
  if (value == null || value < 1 || value > 5) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex gap-px text-amber-500 tabular-nums" aria-label={`${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'text-amber-500' : 'text-slate-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

function OpenInNewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export type CsWorkdeskMode = 'admin' | 'team';

type CsWorkdeskProps = {
  mode: CsWorkdeskMode;
};

export function CsWorkdesk({ mode }: CsWorkdeskProps) {
  const token = mode === 'admin' ? getToken() : getTeamToken();
  const [items, setItems] = useState<CsReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CsReport | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [completionMethodInput, setCompletionMethodInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectedInquiryModal, setConnectedInquiryModal] = useState<NonNullable<CsReport['inquiry']> | null>(
    null
  );

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    const req = mode === 'admin' ? getCsReports(token) : getTeamCsReports(token);
    req
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [token, mode]);

  const patchCs = (
    id: string,
    data: { status?: string; memo?: string | null; completionMethod?: string | null }
  ) => {
    if (!token) return Promise.reject(new Error('로그인이 필요합니다.'));
    return mode === 'admin' ? updateCsReport(token, id, data) : patchTeamCsReport(token, id, data);
  };

  const openDetail = (item: CsReport) => {
    setSelected(item);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
    setCompletionMethodInput('');
  };

  const closeDetail = () => {
    setSelected(null);
  };

  const handleSave = async () => {
    if (!token || !selected) return;
    if (editStatus === 'DONE' && selected.status !== 'DONE' && !completionMethodInput.trim()) {
      setError('처리 완료로 저장하려면 처리 방법을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchCs(selected.id, {
        status: editStatus,
        memo: editMemo,
        ...(editStatus === 'DONE' && selected.status !== 'DONE'
          ? { completionMethod: completionMethodInput.trim() }
          : {}),
      });
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setError(null);
      if (updated.status === 'DONE') setCompletionMethodInput('');
      (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!token || !selected) return;
    if (!completionMethodInput.trim()) {
      setError('처리 완료 시 처리 방법을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const updated = await patchCs(selected.id, {
        status: 'DONE',
        memo: editMemo,
        completionMethod: completionMethodInput.trim(),
      });
      setEditStatus('DONE');
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setCompletionMethodInput('');
      setError(null);
      (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리 완료 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const csLink = `${window.location.origin}/cs`;
  const pageTitle = mode === 'admin' ? 'C/S 관리' : 'C/S';
  const statusSelectOptions =
    mode === 'team'
      ? STATUS_OPTIONS.filter((o) => o.value !== 'RECEIVED' || selected?.status === 'RECEIVED')
      : STATUS_OPTIONS;

  const isTeam = mode === 'team';
  /** 팀장 모드: 목록을 더 조밀하게(모바일 한 화면에 많이) */
  const tableText = isTeam
    ? 'text-fluid-2xs md:text-fluid-xs lg:text-fluid-sm leading-tight'
    : 'text-fluid-xs md:text-sm';
  const thPad = isTeam ? 'p-0.5 md:p-2 max-md:py-0.5' : 'p-1.5 md:p-3';
  const tdPad = isTeam
    ? 'p-0.5 md:p-2 max-md:py-0.5 align-middle text-center'
    : 'p-1.5 md:p-3 align-middle text-center';

  return (
    <div className="min-w-0 w-full max-w-full">
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0 ${
          isTeam ? 'mb-2 sm:mb-4' : 'mb-4'
        }`}
      >
        <h1
          className={`shrink-0 font-semibold text-gray-900 ${
            isTeam ? 'text-fluid-base sm:text-xl' : 'text-xl'
          }`}
        >
          {pageTitle}
        </h1>
        {mode === 'admin' ? (
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
        ) : null}
      </div>

      {mode === 'admin' ? (
        <div className="text-fluid-sm text-gray-600 mb-4 bg-gray-50 px-3 py-2 rounded">
          고객에게 아래와 같이 안내하실 수 있습니다. 링크를 복사해 메시지에 붙여 넣어 주세요.
          <br />
          <strong>예시:</strong> "칭찬·불편 사항은 아래 링크에서 접수해 주세요. 사진 첨부·만족도 별점이 가능합니다. [링크]"
        </div>
      ) : (
        <p className="text-fluid-2xs sm:text-fluid-xs text-gray-600 mb-2 sm:mb-3 leading-snug">
          배정 접수와 연결된 C/S만 표시됩니다. 완료 시 처리 방법을 입력해 주세요.
        </p>
      )}

      {error && (
        <p className={`text-fluid-sm text-red-600 ${isTeam ? 'mb-2' : 'mb-4'}`}>{error}</p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden min-w-0 max-w-full">
        {loading ? (
          <div className={`text-center text-gray-500 ${isTeam ? 'p-4 text-fluid-xs' : 'p-8 text-sm'}`}>
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className={`text-center text-gray-500 ${isTeam ? 'p-4 text-fluid-xs' : 'p-8 text-sm'}`}>
            표시할 C/S가 없습니다.
          </div>
        ) : (
          <SyncHorizontalScroll
            className="w-full min-w-0 max-w-full"
            contentClassName="-mx-4 px-4 sm:mx-0 sm:px-0 w-full min-w-0 max-w-full"
          >
            <table className={`w-full border-collapse min-w-[680px] md:min-w-[780px] ${tableText}`}>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    날짜
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>성함</th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    연락처
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>담당</th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    만족
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad} whitespace-nowrap`}>
                    상태
                  </th>
                  <th className={`text-center font-medium text-gray-700 ${thPad}`}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const assignee = assigneeListLabel(item);
                  const processor = processorNameLabel(item);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer group"
                      onClick={() => openDetail(item)}
                    >
                      <td
                        className={`${tdPad} text-gray-700 tabular-nums whitespace-nowrap ${
                          isTeam ? 'max-w-[5.5rem] lg:max-w-none' : 'max-w-[7rem] md:max-w-none'
                        }`}
                      >
                        <span className={isTeam ? 'lg:hidden' : 'md:hidden'}>
                          {formatDateTimeTinyKo(item.createdAt)}
                        </span>
                        <span className={isTeam ? 'hidden lg:inline' : 'hidden md:inline'}>
                          {formatDateTimeCompactWithWeekday(item.createdAt)}
                        </span>
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={item.customerName}
                      >
                        {item.customerName}
                      </td>
                      <td
                        className={`${tdPad} tabular-nums whitespace-nowrap max-w-[6.5rem] sm:max-w-none`}
                      >
                        {item.customerPhone}
                      </td>
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={assignee}
                      >
                        {assignee}
                      </td>
                      <td className={tdPad}>
                        <span
                          className={`tabular-nums text-gray-800 ${isTeam ? 'lg:hidden' : 'md:hidden'}`}
                        >
                          {item.serviceRating != null && item.serviceRating >= 1 && item.serviceRating <= 5
                            ? `${item.serviceRating}점`
                            : '—'}
                        </span>
                        <span
                          className={`inline-flex w-full justify-center ${isTeam ? 'hidden lg:inline-flex' : 'hidden md:inline-flex'}`}
                        >
                          <ServiceRatingStars value={item.serviceRating} />
                        </span>
                      </td>
                      <td className={tdPad}>
                        <span
                          className={`inline-block px-1 py-0.5 md:px-2 rounded leading-tight ${
                            isTeam ? 'max-lg:text-[0.62rem] max-md:text-[0.6rem]' : 'max-md:text-[0.65rem]'
                          } ${
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
                      <td
                        className={`${tdPad} max-w-[4rem] sm:max-w-[6rem] md:max-w-[10rem] truncate`}
                        title={processor}
                      >
                        {processor}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SyncHorizontalScroll>
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
              {mode === 'team' ? (
                <p className="text-fluid-xs text-gray-600 mt-1">
                  아래에 <strong className="font-medium text-gray-800">처리 방법</strong>을 적은 뒤 「처리완료」를 누르세요.
                </p>
              ) : null}
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

              {selected.status !== 'DONE' ? (
                <div
                  className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 sm:p-4"
                  id="cs-completion-method-input"
                >
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    C/S 처리 방법 <span className="text-red-600">*</span>
                    <span className="font-normal text-gray-600 text-fluid-xs"> (처리완료 버튼 전에 입력)</span>
                  </label>
                  <textarea
                    value={completionMethodInput}
                    onChange={(e) => setCompletionMethodInput(e.target.value)}
                    rows={4}
                    className="w-full border border-amber-300 rounded px-3 py-2 text-sm resize-none bg-white"
                    placeholder="예: 고객에게 전화로 사과 및 재방문 일정 조율, 현장 확인 후 추가 청소 진행 등"
                  />
                </div>
              ) : null}

              {selected.completedAt && selected.completedBy ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm space-y-1">
                  <div className="font-medium text-green-900">처리 완료 기록</div>
                  <p>
                    <span className="text-gray-600">처리일시</span>{' '}
                    {formatDateTimeCompactWithWeekday(selected.completedAt)}
                  </p>
                  <p>
                    <span className="text-gray-600">처리자</span> {selected.completedBy.name} (
                    {roleLabelKo(selected.completedBy.role)})
                  </p>
                  <div>
                    <span className="text-gray-600">처리 방법</span>
                    <p className="whitespace-pre-wrap text-gray-900 mt-0.5">{selected.completionMethod ?? '—'}</p>
                  </div>
                </div>
              ) : selected.status === 'DONE' ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                  처리 완료 상태입니다. (처리 기록이 없는 경우 관리자에게 문의하세요.)
                </div>
              ) : null}

              <div>
                <span className="text-gray-500 text-sm">성함</span>
                <p className="font-medium">{selected.customerName}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">연락처</span>
                <p className="font-medium">{selected.customerPhone}</p>
              </div>
              <div>
                <span className="text-gray-500 text-sm">서비스 품질 (고객 별점)</span>
                {selected.serviceRating != null &&
                selected.serviceRating >= 1 &&
                selected.serviceRating <= 5 ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-lg leading-none">
                      <ServiceRatingStars value={selected.serviceRating} />
                    </span>
                    <span className="text-sm text-gray-600 tabular-nums">{selected.serviceRating}점</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-0.5">기록 없음 (이전 접수 건)</p>
                )}
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
              ) : mode === 'admin' ? (
                <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  접수 목록과 자동 연결된 건이 없습니다. (성함·연락처가 접수 DB와 일치할 때 연결됩니다.)
                </p>
              ) : null}

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
                  {statusSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {mode === 'team' && selected.status === 'RECEIVED' && (
                  <p className="text-xs text-gray-500 mt-1">현재 접수 상태입니다. 처리중 또는 완료로만 변경할 수 있습니다.</p>
                )}
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
