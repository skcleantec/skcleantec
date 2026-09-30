const progressByKey = new Map<string, { step: number; message: string }>();

function key(tenantId: string, workDate: string): string {
  return `${tenantId}:${workDate}`;
}

export function setAiDispatchProgress(tenantId: string, workDate: string, step: number, message: string): void {
  progressByKey.set(key(tenantId, workDate), { step, message });
}

export function readAiDispatchProgress(tenantId: string, workDate: string): { step: number; message: string } | null {
  return progressByKey.get(key(tenantId, workDate)) ?? null;
}
