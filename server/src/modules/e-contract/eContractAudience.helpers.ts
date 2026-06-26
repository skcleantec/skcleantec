import { EContractAudience } from '@prisma/client';

export function parseEContractAudienceInput(raw: unknown): EContractAudience | null {
  if (raw === EContractAudience.TEAM_LEADER || raw === 'TEAM_LEADER') return EContractAudience.TEAM_LEADER;
  if (raw === EContractAudience.MARKETER || raw === 'MARKETER') return EContractAudience.MARKETER;
  if (raw === EContractAudience.TEAM_MEMBER || raw === 'TEAM_MEMBER') return EContractAudience.TEAM_MEMBER;
  return null;
}

export function normalizeEContractAudience(audience?: EContractAudience | null): EContractAudience {
  if (audience === EContractAudience.MARKETER) return EContractAudience.MARKETER;
  if (audience === EContractAudience.TEAM_MEMBER) return EContractAudience.TEAM_MEMBER;
  return EContractAudience.TEAM_LEADER;
}
