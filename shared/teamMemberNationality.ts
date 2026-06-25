import type { CrewUiLanguage } from './crewGroupSettings';

/** 팀원 국적 — 크루 UI 언어 코드와 동일(KO/TH/MN) */
export type TeamMemberNationality = CrewUiLanguage;

export const TEAM_MEMBER_NATIONALITIES: TeamMemberNationality[] = ['KO', 'TH', 'MN'];

export const TEAM_MEMBER_NATIONALITY_LABELS: Record<TeamMemberNationality, string> = {
  KO: '한국',
  TH: '태국',
  MN: '몽골',
};

export function parseTeamMemberNationality(raw: unknown): TeamMemberNationality | null {
  if (raw === 'KO' || raw === 'TH' || raw === 'MN') return raw;
  return null;
}

export function teamMemberAltNameField(nationality: TeamMemberNationality): {
  visible: boolean;
  label: string;
  placeholder: string;
  hint: string;
} {
  if (nationality === 'TH') {
    return {
      visible: true,
      label: '태국어 표시명 (선택)',
      placeholder: '태국어 이름',
      hint: '크루 화면에서 한글 이름 아래 보조 표기로 표시됩니다.',
    };
  }
  if (nationality === 'MN') {
    return {
      visible: true,
      label: '몽골어 표시명 (선택)',
      placeholder: '몽골어 이름',
      hint: '크루 화면에서 한글 이름 아래 보조 표기로 표시됩니다.',
    };
  }
  return {
    visible: false,
    label: '',
    placeholder: '',
    hint: '한국인은 보조 표시명 없이 한글 이름만 사용합니다.',
  };
}
