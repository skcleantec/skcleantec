import {
  CREW_AVAILABILITY_MODE_LABELS,
  CREW_AVAILABILITY_MODES,
  CREW_UI_LANGUAGE_LABELS,
  CREW_UI_LANGUAGES,
  CREW_WORK_COUNT_MODE_LABELS,
  CREW_WORK_COUNT_MODES,
  crewWorkCountUnitLabel,
  type CrewGroupAvailabilityMode,
  type CrewUiLanguage,
  type CrewWorkCountMode,
} from '@shared/crewGroupSettings';

export type CrewGroupPolicyValue = {
  availabilityMode: CrewGroupAvailabilityMode;
  crewUiLanguage: CrewUiLanguage;
  allowCrewDayOffEdit: boolean;
  workCountMode: CrewWorkCountMode;
};

type Props = {
  value: CrewGroupPolicyValue;
  onChange: (next: CrewGroupPolicyValue) => void;
  idPrefix: string;
};

/** 크루 그룹 생성·편집 — 가용 방식(배정/휴무일)·UI 언어·휴무 입력 허용 */
export function CrewGroupPolicyFields({ value, onChange, idPrefix }: Props) {
  const setMode = (availabilityMode: CrewGroupAvailabilityMode) => {
    onChange({
      ...value,
      availabilityMode,
      allowCrewDayOffEdit: availabilityMode === 'DAY_OFF' ? value.allowCrewDayOffEdit : false,
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-gray-100 bg-gray-50/80 px-3 py-3">
      <fieldset>
        <legend className="text-xs font-medium text-gray-700 mb-2">가용 방식</legend>
        <div className="flex flex-col sm:flex-row gap-2">
          {CREW_AVAILABILITY_MODES.map((mode) => {
            const inputId = `${idPrefix}-mode-${mode}`;
            return (
              <label
                key={mode}
                htmlFor={inputId}
                className={`flex flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  value.availabilityMode === mode
                    ? 'border-indigo-300 bg-white ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-availabilityMode`}
                  checked={value.availabilityMode === mode}
                  onChange={() => setMode(mode)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-gray-900 block">{CREW_AVAILABILITY_MODE_LABELS[mode]}</span>
                  <span className="text-gray-600 mt-0.5 block">
                    {mode === 'ROSTER'
                      ? '그룹장이 날짜별 근무 명단을 지정합니다. 명단에 있으면 휴무 등록과 관계없이 배정 가능합니다.'
                      : '그룹 활성 멤버가 기본 가용입니다. 휴무로 등록한 날만 제외됩니다.'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-gray-700 mb-2">급여·실적 집계</legend>
        <div className="flex flex-col sm:flex-row gap-2">
          {CREW_WORK_COUNT_MODES.map((mode) => {
            const inputId = `${idPrefix}-workCount-${mode}`;
            return (
              <label
                key={mode}
                htmlFor={inputId}
                className={`flex flex-1 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  value.workCountMode === mode
                    ? 'border-indigo-300 bg-white ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`${idPrefix}-workCountMode`}
                  checked={value.workCountMode === mode}
                  onChange={() => onChange({ ...value, workCountMode: mode })}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-gray-900 block">{CREW_WORK_COUNT_MODE_LABELS[mode]}</span>
                  <span className="text-gray-600 mt-0.5 block">
                    {mode === 'DISTINCT_DAY'
                      ? '같은 예약일(KST)에 현장을 여러 번 나가도 1로 셉니다. 팀원 목록·월급표·크루 홈과 동일합니다.'
                      : '현장 투입 메모에 이름이 적힌 접수마다 1씩 셉니다. 하루 2건이면 2로 집계됩니다.'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[0.65rem] text-gray-500 mt-1.5">
          이 그룹 소속 팀원의 급여주기 배지·월급표 자동 산정·크루 홈 「일한 내역」에 공통 적용됩니다.
        </p>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-crewUiLanguage`} className="text-xs font-medium text-gray-700 block mb-1">
          크루 앱 UI 언어
        </label>
        <select
          id={`${idPrefix}-crewUiLanguage`}
          value={value.crewUiLanguage}
          onChange={(e) =>
            onChange({ ...value, crewUiLanguage: e.target.value as CrewUiLanguage })
          }
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm bg-white"
        >
          {CREW_UI_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {CREW_UI_LANGUAGE_LABELS[lang]}
            </option>
          ))}
        </select>
      </div>

      {value.availabilityMode === 'DAY_OFF' ? (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.allowCrewDayOffEdit}
            onChange={(e) => onChange({ ...value, allowCrewDayOffEdit: e.target.checked })}
            className="mt-1"
          />
          <span className="text-xs text-gray-700">
            크루 그룹장이 <strong>휴무일</strong> 메뉴에서 멤버 휴무를 직접 등록·삭제할 수 있게 허용 (OFF면 관리자만
            팀원 휴무 관리)
          </span>
        </label>
      ) : null}
    </div>
  );
}

export function crewGroupPolicySummary(g: {
  availabilityMode?: CrewGroupAvailabilityMode;
  crewUiLanguage?: CrewUiLanguage;
  allowCrewDayOffEdit?: boolean;
  useDailyRosterOnly?: boolean;
  workCountMode?: CrewWorkCountMode;
}): string {
  const mode: CrewGroupAvailabilityMode =
    g.availabilityMode ?? (g.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF');
  const lang = CREW_UI_LANGUAGE_LABELS[g.crewUiLanguage ?? 'KO'];
  const modeLabel = CREW_AVAILABILITY_MODE_LABELS[mode];
  const countLabel = crewWorkCountUnitLabel(g.workCountMode ?? 'DISTINCT_DAY');
  const countPart = g.workCountMode === 'PER_INQUIRY' ? '건당' : '근무일';
  if (mode === 'DAY_OFF' && g.allowCrewDayOffEdit) {
    return `${modeLabel} · ${lang} · ${countPart} · 휴무입력 ON`;
  }
  return `${modeLabel} · ${lang} · ${countPart}(${countLabel})`;
}
