import type { ScheduleItem } from '../api/schedule';

export function scheduleItemExternalCompanyIds(item: ScheduleItem): string[] {
  const out = new Set<string>();
  for (const a of item.assignments ?? []) {
    const id = a.teamLeader.externalCompany?.id?.trim();
    if (id) out.add(id);
  }
  return Array.from(out);
}
