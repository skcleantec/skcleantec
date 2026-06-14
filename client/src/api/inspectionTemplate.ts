import { API } from './apiPrefix';
import type { InspectionItemDef } from '@shared/inquiryInspectionItems';
import type { TenantInspectionAreaItems } from '@shared/inquiryInspectionTenantTemplate';

export type InspectionTemplateCatalogEntry = {
  templateKey: string;
  label: string;
};

export type InspectionTemplateDto = {
  catalog: InspectionTemplateCatalogEntry[];
  defaults: TenantInspectionAreaItems;
  custom: TenantInspectionAreaItems | null;
  effective: TenantInspectionAreaItems;
};

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchInspectionTemplate(token: string): Promise<InspectionTemplateDto> {
  const res = await fetch(`${API}/inspection-template`, { headers: headers(token) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? '템플릿을 불러오지 못했습니다.');
  }
  return res.json() as Promise<InspectionTemplateDto>;
}

export async function saveInspectionTemplate(
  token: string,
  effective: Record<string, InspectionItemDef[]>,
): Promise<InspectionTemplateDto> {
  const res = await fetch(`${API}/inspection-template`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ effective }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? '저장에 실패했습니다.');
  }
  return res.json() as Promise<InspectionTemplateDto>;
}

export async function resetInspectionTemplate(token: string): Promise<InspectionTemplateDto> {
  const res = await fetch(`${API}/inspection-template/reset`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? '초기화에 실패했습니다.');
  }
  return res.json() as Promise<InspectionTemplateDto>;
}
