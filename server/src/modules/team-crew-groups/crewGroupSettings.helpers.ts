import type { CrewGroupAvailabilityMode, CrewUiLanguage } from '../../lib/crewGroupSettings.js';
import {
  parseCrewGroupAvailabilityMode,
  parseCrewUiLanguage,
} from '../../lib/crewGroupSettings.js';

export type CrewGroupPublicFields = {
  availabilityMode: CrewGroupAvailabilityMode;
  crewUiLanguage: CrewUiLanguage;
  allowCrewDayOffEdit: boolean;
  /** @deprecated 클라이언트 호환 — availabilityMode === 'ROSTER' */
  useDailyRosterOnly: boolean;
};

export function mapCrewGroupPublicFields(group: {
  availabilityMode: CrewGroupAvailabilityMode;
  crewUiLanguage: CrewUiLanguage;
  allowCrewDayOffEdit: boolean;
}): CrewGroupPublicFields {
  return {
    availabilityMode: group.availabilityMode,
    crewUiLanguage: group.crewUiLanguage,
    allowCrewDayOffEdit: group.allowCrewDayOffEdit,
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
