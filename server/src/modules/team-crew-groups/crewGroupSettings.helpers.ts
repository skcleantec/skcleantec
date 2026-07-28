import type { CrewGroupAvailabilityMode, CrewUiLanguage, CrewWorkCountMode } from '../../lib/crewGroupSettings.js';
import {
  parseCrewGroupAvailabilityMode,
  parseCrewUiLanguage,
  parseCrewWorkCountMode,
  DEFAULT_CREW_WORK_COUNT_MODE,
} from '../../lib/crewGroupSettings.js';

export type CrewGroupPublicFields = {
  availabilityMode: CrewGroupAvailabilityMode;
  crewUiLanguage: CrewUiLanguage;
  allowCrewDayOffEdit: boolean;
  workCountMode: CrewWorkCountMode;
  /** @deprecated 클라이언트 호환 — availabilityMode === 'ROSTER' */
  useDailyRosterOnly: boolean;
};

export function mapCrewGroupPublicFields(group: {
  availabilityMode: CrewGroupAvailabilityMode;
  crewUiLanguage: CrewUiLanguage;
  allowCrewDayOffEdit: boolean;
  workCountMode: CrewWorkCountMode;
}): CrewGroupPublicFields {
  return {
    availabilityMode: group.availabilityMode,
    crewUiLanguage: group.crewUiLanguage,
    allowCrewDayOffEdit: group.allowCrewDayOffEdit,
    workCountMode: group.workCountMode,
    useDailyRosterOnly: group.availabilityMode === 'ROSTER',
  };
}

export function resolveAvailabilityModeFromBody(body: {
  availabilityMode?: unknown;
  useDailyRosterOnly?: unknown;
}): CrewGroupAvailabilityMode {
  const parsed = parseCrewGroupAvailabilityMode(body.availabilityMode);
  if (parsed) return parsed;
  if (body.useDailyRosterOnly !== undefined) {
    return Boolean(body.useDailyRosterOnly) ? 'ROSTER' : 'DAY_OFF';
  }
  return 'ROSTER';
}

export function resolveCrewUiLanguageFromBody(body: { crewUiLanguage?: unknown }): CrewUiLanguage {
  return parseCrewUiLanguage(body.crewUiLanguage) ?? 'KO';
}

export function resolveWorkCountModeFromBody(body: { workCountMode?: unknown }): CrewWorkCountMode {
  return parseCrewWorkCountMode(body.workCountMode) ?? DEFAULT_CREW_WORK_COUNT_MODE;
}
