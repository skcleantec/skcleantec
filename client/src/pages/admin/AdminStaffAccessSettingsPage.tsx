import { Link } from 'react-router-dom';

export function AdminStaffAccessSettingsPage() {
  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">직원 권한 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          마케터별 관리자 업무 권한은 사용자 등록 화면에서 개별 설정합니다.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          「관리자 업무 권한 부여」를 켜면 해당 마케터는 배정·삭제 등 관리자 업무 API와 관리자 전용 메뉴(사용자
          등록·정산·광고비 등)를 사용할 수 있습니다. 관리자 전용 설정 화면 변경 등은 ADMIN 계정만 가능합니다.
        </p>

        <Link
          to="/admin/team-leaders?tab=marketer"
          className="inline-flex items-center rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          사용자 등록 · 마케터 탭으로 이동
        </Link>

        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-800 mb-1">항상 관리자(ADMIN)만 가능한 기능</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>마케터 관리자 권한 설정 변경</li>
            <li>업체 소유자 전용 기능(접수 변경 이력 삭제, 광고 채널 일부 설정 등)</li>
            <li>팀·크루 화면 미리보기(개발용)</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
