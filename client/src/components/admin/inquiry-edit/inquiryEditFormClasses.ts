/** 접수 수정 모달 — compact 폼 밀도 (ScheduleInquiryDetailModal 공통) */

export const inqEditSectionShell =
  'min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm';

export const inqEditSectionHeader =
  'border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-fluid-2xs font-semibold text-gray-600 sm:px-4 sm:py-2';

export const inqEditSectionBody = 'p-3 sm:p-4';

/** 2열 필드 그리드 */
export const inqEditFormGrid = 'grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-fluid-sm';

export const inqEditLabel = 'block text-fluid-2xs text-gray-600 mb-0.5';

export const inqEditInput =
  'w-full min-w-0 rounded border border-gray-300 bg-white px-2 py-1.5 text-fluid-sm text-gray-900';

export const inqEditSelect = inqEditInput;

export const inqEditTextarea = `${inqEditInput} resize-y min-h-[4.5rem]`;

export const inqEditTextareaSm = `${inqEditInput} resize-y min-h-[3.25rem]`;

/** 6번 등 서브 블록 */
export const inqEditSubCard =
  'rounded-lg border border-gray-200 bg-slate-50/70 p-2.5 sm:p-3 space-y-2';

export const inqEditSubCardTitle = 'text-fluid-2xs font-semibold text-gray-700';

/** 6-A 운영 필드 — PC 4열 */
export const inqEditOpsGrid =
  'grid grid-cols-2 gap-x-2 gap-y-2 lg:grid-cols-4';

/** 6-C 메모 2열 */
export const inqEditMemoGrid = 'grid grid-cols-1 gap-2 sm:grid-cols-2';

/** 2번 — 건축물 유형 + 면적 기준 + 평수 한 줄 */
export const inqEditPropertyAreaRow =
  'grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,5.5rem)]';

/** 2번 — 방·화·베·주방 한 줄 */
export const inqEditRoomGrid = 'grid grid-cols-4 gap-x-2 gap-y-1';

/** 4번 — 총액·예약금·잔금 한 줄 */
export const inqEditAmountRow = 'grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-3';

/** 4번 — 타업체 담당·수수료 한 줄 */
export const inqEditPartnerExternalRow = 'grid grid-cols-1 gap-x-2 gap-y-2 sm:grid-cols-2';

/** 숫자·짧은 입력 (방/화/베 등) */
export const inqEditInputCompact =
  'w-full min-w-0 rounded border border-gray-300 bg-white px-1.5 py-1 text-fluid-sm text-center tabular-nums';

export const inqEditLabelCompact = 'block text-fluid-2xs text-gray-500 mb-0.5 text-center';
