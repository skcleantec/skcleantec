import { randomUUID } from 'node:crypto';

export class IdMap {
  private readonly map = new Map<string, string>();

  get(sourceId: string): string | undefined {
    return this.map.get(sourceId);
  }

  mustGet(sourceId: string, label: string): string {
    const id = this.map.get(sourceId);
    if (!id) throw new Error(`ID 매핑 없음 (${label}): ${sourceId}`);
    return id;
  }

  assign(sourceId: string, targetId?: string): string {
    const existing = this.map.get(sourceId);
    if (existing) return existing;
    const id = targetId ?? randomUUID();
    this.map.set(sourceId, id);
    return id;
  }

  size(): number {
    return this.map.size;
  }
}
