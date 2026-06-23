import { Link } from 'react-router-dom';
import { MARKETER_ADMIN_LEVEL_LABEL } from '@shared/marketerAdminLevel';

export function AdminStaffAccessSettingsPage() {
  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">직원 권한 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          마케터별 관리자 권한은 사용자 등록 화면에서 개별 설정합니다.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          마케터 수정 시 아래 세 단계 중 하나를 선택합니다. 설정 변경은 ADMIN 계정만 가능합니다.
        </p>

        <ul className="space-y-3 text-sm text-gray-700">
          <li className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="font-medium text-gray-900">{MARKETER_ADMIN_LEVEL_LABEL.NONE}</span>
            <span className="mt-1 block text-gray-600">일반 마케터 — 기본 접수·발주 업무</span>
          </li>
          <li className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2">
            <span className="font-medium text-sky-950">{MARKETER_ADMIN_LEVEL_LABEL.LIMITED}</span>
            <span className="mt-1 block text-sky-900/80">
              배정·삭제·접수 고급 수정 등 운영 권한 — 관리자 전용 메뉴(사용자 등록·정산·광고비 설정 등)는
              보이지 않습니다.
            </span>
          </li>
          <li className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <span className="font-medium text-blue-950">{MARKETER_ADMIN_LEVEL_LABEL.FULL}</span>
            <span className="mt-1 block text-blue-900/80">
              관리자와 동일한 업무 메뉴·API — ADMIN 전용 설정 변경·업체 소유자 기능은 제외
            </span>
          </li>
        </ul>

        <Link
          to="/admin/team-leaders?tab=marketer"
          className="inline-flex items-center rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          사용자 등록 · 마케터 탭으로 이동
        </Link>

        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-800 mb-1">항상 관리자(ADMIN)만 가능한 기능</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>마케터 권한 단계 변경</li>
            <li>업체 소유자 전용 기능(접수 변경 이력 삭제, 광고 채널 일부 설정 등)</li>
            <li>팀·크루 화면 미리보기(개발용)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
