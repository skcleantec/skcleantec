/** 단일 프로세스용 짧은 TTL 캐시 — 목록·집계 API의 반복 조회(DB 왕복) 완화 */
export class ShortTtlCache<T> {
  private readonly store = new Map<string, { exp: number; v: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 150,
  ) {}

  get(key: string): T | undefined {
    const row = this.store.get(key);
    if (!row) return undefined;
    if (row.exp <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return row.v;
  }

  set(key: string, value: T): void {
    this.store.set(key, { exp: Date.now() + this.ttlMs, v: value });
    if (this.store.size <= this.maxEntries) return;
    const oldest = this.store.keys().next().value;
    if (oldest) this.store.delete(oldest);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
