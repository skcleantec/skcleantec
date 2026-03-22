const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface EstimateConfig {
  id: string;
  pricePerPyeong: number;
  depositAmount: number;
}

export interface EstimateOption {
  id: string;
  name: string;
  extraAmount: number;
  sortOrder: number;
  isActive: boolean;
}

export async function getEstimateConfig(token: string): Promise<EstimateConfig> {
  const res = await fetch(`${API}/estimate/config`, { headers: headers(token) });
  if (!res.ok) throw new Error('견적 설정을 불러올 수 없습니다.');
  return res.json();
}

export async function updateEstimateConfig(
  token: string,
  data: { pricePerPyeong?: number; depositAmount?: number }
): Promise<EstimateConfig> {
  const res = await fetch(`${API}/estimate/config`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('견적 설정 저장에 실패했습니다.');
  return res.json();
}

export async function getEstimateOptions(token: string): Promise<{ items: EstimateOption[] }> {
  const res = await fetch(`${API}/estimate/options/all`, { headers: headers(token) });
  if (!res.ok) throw new Error('추가 옵션을 불러올 수 없습니다.');
  return res.json();
}

export async function createEstimateOption(
  token: string,
  data: { name: string; extraAmount?: number }
): Promise<EstimateOption> {
  const res = await fetch(`${API}/estimate/options`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '옵션 추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateEstimateOption(
  token: string,
  id: string,
  data: Partial<EstimateOption>
): Promise<EstimateOption> {
  const res = await fetch(`${API}/estimate/options/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('옵션 수정에 실패했습니다.');
  return res.json();
}

export async function deleteEstimateOption(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/estimate/options/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) throw new Error('옵션 삭제에 실패했습니다.');
}
