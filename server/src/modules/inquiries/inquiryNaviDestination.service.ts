import { prisma } from '../../lib/prisma.js';
import { buildOfficialTmapAppRoutesUrl } from '../../lib/tmapAppRoutes.js';
import { inquiryActiveOnlyWhere } from './inquiryTrash.helpers.js';
import { syncInquiryAddressGeo } from './inquiryAddressGeoSync.js';

export type InquiryNaviDestinationDto = {
  lat: number;
  lng: number;
  name: string;
  address: string;
  tmapAppRoutesUrl: string | null;
};

/** 우리 업체 접수 현장 좌표 — 배정 여부 무관 (관리자·마케터 길안내) */
export async function resolveInquiryNaviDestination(opts: {
  tenantId: string;
  inquiryId: string;
}): Promise<{ ok: true; data: InquiryNaviDestinationDto } | { ok: false; status: 404 | 422; error: string }> {
  const row = await prisma.inquiry.findFirst({
    where: {
      id: opts.inquiryId,
      tenantId: opts.tenantId,
      ...inquiryActiveOnlyWhere(),
    },
    select: { id: true },
  });
  if (!row) {
    return { ok: false, status: 404, error: '접수를 찾을 수 없습니다.' };
  }

  await syncInquiryAddressGeo(prisma, row.id);

  const fresh = await prisma.inquiry.findFirst({
    where: { id: row.id, tenantId: opts.tenantId },
    select: {
      address: true,
      addressDetail: true,
      customerName: true,
      addressGeoLat: true,
      addressGeoLng: true,
    },
  });
  const lat = fresh?.addressGeoLat ?? null;
  const lng = fresh?.addressGeoLng ?? null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, status: 422, error: '이 주소의 위치를 찾지 못했습니다. 주소를 확인한 뒤 다시 시도해 주세요.' };
  }

  const addressLine = [fresh?.address?.trim(), fresh?.addressDetail?.trim()].filter(Boolean).join(' ');
  const name = [fresh?.customerName?.trim(), fresh?.address?.trim()].filter(Boolean).join(' · ') || addressLine;

  return {
    ok: true,
    data: {
      lat,
      lng,
      name,
      address: addressLine,
      tmapAppRoutesUrl: buildOfficialTmapAppRoutesUrl({ name, lon: lng, lat }),
    },
  };
}
