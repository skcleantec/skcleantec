import { useState } from 'react';
import { labelForTimeSlot } from '../../constants/orderFormSchedule';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { isHappyCallEligible } from '../../utils/happyCall';

export const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  RECEIVED: '접수',
  ASSIGNED: '분배',
  IN_PROGRESS: '진행',
  COMPLETED: '완료',
  CANCELLED: '취소',
  CS_PROCESSING: 'C/S',
};

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export interface InquiryItem {
  id: string;
  customerName: string;
  customerPhone: string;
  customerPhone2?: string | null;
  address: string;
  addressDetail: string | null;
  areaPyeong: number | null;
  areaBasis?: string | null;
  propertyType?: string | null;
  roomCount: number | null;
  bathroomCount: number | null;
  balconyCount: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  preferredTimeDetail?: string | null;
  status: string;
  memo: string | null;
  claimMemo: string | null;
  createdAt: string;
  /** ISO — 팀장 해피콜 완료 시각 */
  happyCallCompletedAt?: string | null;
  assignments: Array<{ teamLeader: { id: string; name: string } }>;
}

export function formatScheduleLine(item: InquiryItem) {
  const slot = item.preferredTime ? labelForTimeSlot(item.preferredTime) : '시간 미정';
  const d = item.preferredTimeDetail?.trim();
  return d ? `${slot} (${d})` : slot;
}

export function formatRoomInfo(r: number | null, b: number | null, v: number | null) {
  const parts = [];
  if (r != null) parts.push(`${r}방`);
  if (b != null) parts.push(`${b}화`);
  if (v != null) parts.push(`${v}베`);
  return parts.length ? parts.join(' ') : '-';
}

/** 오늘·내일·N일 후 등만 (없으면 null) */
export function relativeDateHint(dateStr: string): string | null {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  if (!y || !mo || !da) return null;
  const dNorm = new Date(y, mo - 1, da);
  dNorm.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((dNorm.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff > 0 && diff <= 7) return `${diff}일 후`;
  return null;
}

export function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const remainder = days.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) days.push(null);
  }
  return days;
}

export function TeamInquiryDetailModal({
  item,
  onClose,
  enableHappyCall,
  onHappyCallComplete,
}: {
  item: InquiryItem;
  onClose: () => void;
  /** 팀장 화면에서만 해피콜 완료 버튼 */
  enableHappyCall?: boolean;
  onHappyCallComplete?: () => Promise<void>;
}) {
  const [happySaving, setHappySaving] = useState(false);
  const canHappy = enableHappyCall && isHappyCallEligible(item.status, item.preferredDate);
  const showHappyBlock = enableHappyCall && item.preferredDate;

  const handleHappyCallComplete = async () => {
    if (!onHappyCallComplete) return;
    setHappySaving(true);
    try {
      await onHappyCallComplete();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '해피콜 완료 처리에 실패했습니다.');
    } finally {
      setHappySaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-lg p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">상세 내역</h2>
        <div className="flex flex-col gap-3 text-fluid-sm">
          <div>
            <span className="text-gray-500 block text-fluid-xs">고객명</span>
            <span className="font-medium text-gray-900">{item.customerName}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-fluid-xs">연락처</span>
            <a href={`tel:${item.customerPhone}`} className="text-blue-600 underline break-all">
              {item.customerPhone}
            </a>
            {item.customerPhone2?.trim() && (
              <div className="mt-1">
                <span className="text-gray-500 text-fluid-xs">보조 </span>
                <a href={`tel:${item.customerPhone2}`} className="text-blue-600 underline break-all text-fluid-sm">
                  {item.customerPhone2}
                </a>
              </div>
            )}
          </div>
          <div>
            <span className="text-gray-500 block text-fluid-xs">주소</span>
            <span className="text-gray-800 break-words">
              {item.address}
              {item.addressDetail ? ` ${item.addressDetail}` : ''}
            </span>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <span className="text-gray-500 block text-fluid-xs">평수</span>
              <span>
                {item.areaPyeong != null
                  ? `${item.areaBasis ? `${item.areaBasis} ` : ''}${item.areaPyeong}평`
                  : '-'}
              </span>
            </div>
            {item.propertyType && (
              <div>
                <span className="text-gray-500 block text-fluid-xs">건축물 유형</span>
                <span>{item.propertyType}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500 block text-fluid-xs">방·화·베</span>
              <span>{formatRoomInfo(item.roomCount, item.bathroomCount, item.balconyCount)}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-gray-500 block text-fluid-xs">예약일</span>
              <span className="text-fluid-xs tabular-nums">
                {item.preferredDate ? formatDateCompactWithWeekday(item.preferredDate) : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-fluid-xs">희망 시간</span>
              <span>{formatScheduleLine(item)}</span>
            </div>
          </div>
          <div>
            <span className="text-gray-500 block text-fluid-xs">상태</span>
            <span className="px-2 py-0.5 rounded text-fluid-xs bg-gray-200">
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          {item.claimMemo && (
            <div>
              <span className="text-gray-500 block text-fluid-xs">C/S 내용</span>
              <span className="text-gray-800 break-words">{item.claimMemo}</span>
            </div>
          )}
          {showHappyBlock && (
            <div className="border-t border-gray-100 pt-3 mt-1">
              <span className="text-gray-500 block text-fluid-xs mb-1">해피콜</span>
              {item.happyCallCompletedAt ? (
                <span className="text-fluid-sm text-green-700 font-medium">
                  완료 (
                  {new Date(item.happyCallCompletedAt).toLocaleString('ko-KR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  )
                </span>
              ) : canHappy ? (
                <span className="text-fluid-sm text-amber-800">미완료 — 고객에게 일정 안내 전화를 걸어 주세요.</span>
              ) : (
                <span className="text-fluid-sm text-gray-400">해당 없음</span>
              )}
            </div>
          )}
        </div>
        {enableHappyCall && canHappy && !item.happyCallCompletedAt && onHappyCallComplete && (
          <button
            type="button"
            disabled={happySaving}
            onClick={() => void handleHappyCallComplete()}
            className="mt-4 w-full py-3 rounded-xl text-fluid-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {happySaving ? '처리 중...' : '해피콜 완료'}
          </button>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full py-3 border border-gray-300 rounded-xl text-fluid-sm font-medium hover:bg-gray-50 active:bg-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
