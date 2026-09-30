import { AddressSearch } from '../forms/AddressSearch';
import {
  TEAM_LEADER_JOBS_PER_DAY_OPTIONS,
  TEAM_LEADER_SIZE_POLICIES,
  TEAM_LEADER_SIZE_POLICY_LABEL,
  type TeamLeaderSizePolicyId,
} from '@shared/teamLeaderDispatch';

export type TeamLeaderDispatchFormValue = {
  homeAddress: string;
  homeAddressDetail: string;
  jobsPerDay: '1' | '2';
  sizePolicy: TeamLeaderSizePolicyId;
};

export function TeamLeaderDispatchFields({
  value,
  onChange,
}: {
  value: TeamLeaderDispatchFormValue;
  onChange: (next: TeamLeaderDispatchFormValue) => void;
}) {
  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-fluid-xs font-medium text-gray-800">집 주소 · 배정 성향</p>
      <p className="text-fluid-2xs leading-snug text-gray-600">
        집 주소가 없으면 팀장은 로그인 후 주소를 적기 전에는 앱을 사용할 수 없습니다. 하루 건수 기본은 2건, 집 크기는 제한
        없음입니다.
      </p>
      <div>
        <span className="mb-1 block text-sm text-gray-600">집 주소 (선택)</span>
        <AddressSearch
          value={value.homeAddress}
          onChange={(address) => onChange({ ...value, homeAddress: address })}
          placeholder="주소 검색"
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600">상세 주소 (선택)</span>
        <input
          value={value.homeAddressDetail}
          onChange={(e) => onChange({ ...value, homeAddressDetail: e.target.value })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="동·호수"
          maxLength={256}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">하루 배정 건수</span>
          <select
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            value={value.jobsPerDay}
            onChange={(e) =>
              onChange({ ...value, jobsPerDay: e.target.value === '1' ? '1' : '2' })
            }
          >
            {TEAM_LEADER_JOBS_PER_DAY_OPTIONS.map((n) => (
              <option key={n} value={String(n)}>
                {n}건
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">들어갈 수 있는 집 크기</span>
          <select
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            value={value.sizePolicy}
            onChange={(e) =>
              onChange({ ...value, sizePolicy: e.target.value as TeamLeaderSizePolicyId })
            }
          >
            {TEAM_LEADER_SIZE_POLICIES.map((id) => (
              <option key={id} value={id}>
                {TEAM_LEADER_SIZE_POLICY_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
