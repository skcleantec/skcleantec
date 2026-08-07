import { INQUIRY_LIST_PIN_TIER_LABELS } from '../../../utils/inquiryListPinTierStyle';
import { InquiryStatusChipPreview } from '../../inquiries/inquiriesUiParts';

/** 목록 pin tier + 상태 칩 미니 미리보기 */
export function InquiryHelpListPreview() {
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-slate-100 bg-slate-50/80 px-2 py-1 text-[10px] text-slate-600">
        <span className="font-medium text-slate-700">목록 상단 고정</span>
        {([0, 1, 2, 3] as const).map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-sm ${
                tier === 0 ? 'bg-rose-100' : tier === 1 ? 'bg-emerald-100' : tier === 2 ? 'bg-sky-100' : 'bg-amber-100'
              }`}
            />
            {INQUIRY_LIST_PIN_TIER_LABELS[tier]}
          </span>
        ))}
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <th className="px-2 py-1 text-center font-medium">접수일</th>
              <th className="px-2 py-1 text-center font-medium">고객</th>
              <th className="px-2 py-1 text-center font-medium">상태</th>
              <th className="px-2 py-1 text-center font-medium">특이</th>
              <th className="px-2 py-1 text-center font-medium">사진</th>
              <th className="px-2 py-1 text-center font-medium">작업</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rose-100/70 bg-rose-50/80">
              <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">06-07</td>
              <td className="px-2 py-1.5 text-center font-medium text-slate-900">김○○</td>
              <td className="px-2 py-1.5 text-center">
                <InquiryStatusChipPreview status="ORDER_FORM_PENDING" />
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className="rounded bg-slate-100 px-1 font-bold text-slate-400">X</span>
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-800">O</span>
              </td>
              <td className="px-2 py-1.5 text-center text-sky-700 font-medium">고객 발송</td>
            </tr>
            <tr className="border-b border-slate-100 hover:bg-slate-50/80">
              <td className="px-2 py-1.5 text-center tabular-nums">06-06</td>
              <td className="px-2 py-1.5 text-center font-medium">이○○</td>
              <td className="px-2 py-1.5 text-center">
                <InquiryStatusChipPreview status="RECEIVED" />
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-800">O</span>
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className="rounded bg-emerald-100 px-1 font-bold text-emerald-800">O</span>
              </td>
              <td className="px-2 py-1.5 text-center text-slate-600">수정</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="lg:hidden p-2 space-y-1.5">
        <div className="rounded-lg border border-rose-100 bg-rose-50/90 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-900">김○○ · 미제출</span>
            <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">전화</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 px-0.5">카드 본문 탭 → 상세 · 하단 상태·팀장 변경</p>
      </div>
    </div>
  );
}
