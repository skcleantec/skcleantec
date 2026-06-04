import { API } from './apiPrefix';

export interface VolumeStats {
  mountPath: string;
  railwayVolumeMountPath: string | null;
  bytes?: {
    total: number;
    used: number;
    free: number;
    usedPct: number;
    totalHuman: string;
    usedHuman: string;
    freeHuman: string;
  };
  inodes?: {
    total: number;
    used: number;
    free: number;
    usedPct: number;
  };
  csFileCount?: number | null;
  statfsError?: string;
  csReadError?: string;
}

export async function getVolumeStats(token: string): Promise<VolumeStats> {
  const res = await fetch(`${API}/admin/volume-stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '볼륨 상태를 불러올 수 없습니다.');
  }
  return res.json();
}
