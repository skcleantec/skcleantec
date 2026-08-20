import type { UserRole } from '@prisma/client';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import { sendJsonToWebStaff } from '../realtime/realtimeHub.js';
import { resolveCrmWorkOperatingCompanyId } from './crmWorkBrandResolve.service.js';
import { searchTelecrmCustomer } from './telecrmCustomerLookup.service.js';

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

const recentByKey = new Map<string, number>();
const DEDUPE_MS = 2500;

export type TelecrmMobileIncomingRingPayload = {
  type: 'telecrm:incoming-ring';
  phone: string;
  match: string;
  customerName: string | null;
  inquiryId: string | null;
  inquiryStatus: string | null;
  address: string | null;
};

/** SIM 수신 벨 — 동일 마케터 PC CRM(브라우저)에 고객 lookup 브리프 전달 */
export async function notifyTelecrmMobileIncomingRing(
  tenantId: string,
  user: AuthPayload,
  phoneRaw: string,
): Promise<{ wsDelivered: boolean; skipped?: boolean }> {
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 4) return { wsDelivered: false };

  const dedupeKey = `${tenantId}:${user.userId}:${phone}`;
  const now = Date.now();
  const last = recentByKey.get(dedupeKey) ?? 0;
  if (now - last < DEDUPE_MS) return { wsDelivered: false, skipped: true };
  recentByKey.set(dedupeKey, now);
  if (recentByKey.size > 500) {
    for (const [k, t] of recentByKey) {
      if (now - t > 60_000) recentByKey.delete(k);
    }
  }

  const isStaffAdmin = await userHasStaffAdminAccess(user);
  let operatingCompanyId: string;
  try {
    operatingCompanyId = await resolveCrmWorkOperatingCompanyId({
      tenantId,
      userId: user.userId,
      userRole: (user.role ?? 'MARKETER') as UserRole,
      isStaffAdmin,
    });
  } catch {
    return { wsDelivered: false };
  }

  const lookup = await searchTelecrmCustomer(tenantId, operatingCompanyId, { phone, name: '' });
  const inq = lookup.inquiries[0];
  const customerName = inq?.customerName ?? lookup.customer.name ?? null;
  const payload: TelecrmMobileIncomingRingPayload = {
    type: 'telecrm:incoming-ring',
    phone,
    match: lookup.match,
    customerName,
    inquiryId: inq?.id ?? null,
    inquiryStatus: inq?.status ?? null,
    address: inq?.address ?? lookup.customer.lastAddress ?? null,
  };

  const wsDelivered = sendJsonToWebStaff(user.userId, payload, tenantId);
  return { wsDelivered };
}
