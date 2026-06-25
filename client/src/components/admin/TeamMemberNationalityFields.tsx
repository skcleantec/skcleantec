import {
  TEAM_MEMBER_NATIONALITIES,
  TEAM_MEMBER_NATIONALITY_LABELS,
  teamMemberAltNameField,
  type TeamMemberNationality,
} from '@shared/teamMemberNationality';

export type TeamMemberFormValue = {
  nationality: TeamMemberNationality;
  name: string;
  nameTh: string;
  phone: string;
};

type Props = {
  idPrefix: string;
  value: Pick<TeamMemberFormValue, 'nationality' | 'name' | 'nameTh' | 'phone'>;
  onChange: (next: Pick<TeamMemberFormValue, 'nationality' | 'name' | 'nameTh' | 'phone'>) => void;
  nameAutoFocus?: boolean;
};

/** 팀원 등록·수정 — 국적 선택 + 국적별 보조 표시명 */
export function TeamMemberNationalityFields({ idPrefix, value, onChange, nameAutoFocus }: Props) {
  const alt = teamMemberAltNameField(value.nationality);

  const setNationality = (nationality: TeamMemberNationality) => {
    onChange({
      ...value,
      nationality,
      nameTh: nationality === 'KO' ? '' : value.nameTh,
    });
  };

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-xs font-medium text-gray-700 mb-2">국적</legend>
        <div className="flex flex-wrap gap-2">
          {TEAM_MEMBER_NATIONALITIES.map((nat) => {
            const inputId = `${idPrefix}-nat-${nat}`;
            return (
              <label
                key={nat}
                htmlFor={inputId}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                  value.nationality === nat
                    ? 'border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-nationality`}
                  checked={value.nationality === nat}
                  onChange={() => setNationality(nat)}
                />
                <span className="font-medium text-gray-900">{TEAM_MEMBER_NATIONALITY_LABELS[nat]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-name`} className="text-xs text-gray-500 block mb-1">
          이름
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          autoFocus={nameAutoFocus}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>

      {alt.visible ? (
        <div>
          <label htmlFor={`${idPrefix}-nameTh`} className="text-xs text-gray-500 block mb-1">
            {alt.label}
          </label>
          <input
            id={`${idPrefix}-nameTh`}
            type="text"
            value={value.nameTh}
            onChange={(e) => onChange({ ...value, nameTh: e.target.value })}
            placeholder={alt.placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
          <p className="text-fluid-2xs text-gray-500 mt-1">{alt.hint}</p>
        </div>
      ) : (
        <p className="text-fluid-2xs text-gray-500">{alt.hint}</p>
      )}

      <div>
        <label htmlFor={`${idPrefix}-phone`} className="text-xs text-gray-500 block mb-1">
          연락처 (선택)
        </label>
        <input
          id={`${idPrefix}-phone`}
          type="text"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded"
        />
      </div>
    </div>
  );
}

export function teamMemberNationalityBadge(nationality: TeamMemberNationality | undefined): string | null {
  if (!nationality || nationality === 'KO') return null;
  return TEAM_MEMBER_NATIONALITY_LABELS[nationality];
}
