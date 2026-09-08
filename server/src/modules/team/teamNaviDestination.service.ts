import { prisma } from '../../lib/prisma.js';
import { inquiryActiveOnlyWhere } from '../inquiries/inquiryTrash.helpers.js';
import { syncInquiryAddressGeo } from '../inquiries/inquiryAddressGeoSync.js';
import { isInquiryHiddenFromTeamLeaderByAdminSlotAdjust } from './teamLeaderDayOffInquiryVisibility.js';

export type TeamNaviDestinationDto = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};

export async function resolveTeamNaviDestination(opts: {
  tenantId: string;
  userId: string;
  inquiryId: string;
}): Promise<{ ok: true; data: TeamNaviDestinationDto } | { ok: false; status: 404 | 422; error: string }> {
  const row = await prisma.inquiry.findFirst({
    where: {
      id: opts.inquiryId,
      tenantId: opts.tenantId,
      ...inquiryActiveOnlyWhere(),
      assignments: { some: { teamLeaderId: opts.userId } },
    },
    select: {
      id: true,
      preferredDate: true,
      address: true,
      addressDetail: true,
      customerName: true,
    },
  });
  if (!row) {
    return { ok: false, status: 404, error: '담당 접수를 찾을 수 없습니다.' };
  }
  if (await isInquiryHiddenFromTeamLeaderByAdminSlotAdjust(prisma, opts.userId, row.preferredDate)) {
    return { ok: false, status: 404, error: '담당 접수를 찾을 수 없습니다.' };
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
    },
  };
}
