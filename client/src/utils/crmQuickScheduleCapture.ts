import type { MisoExtractPayload } from '@shared/misoBridge';
import type { SoomgoExtractedChat } from '@shared/soomgoBridge';
import { saveCrmQuickScheduleLead } from '../api/crmQuickSchedule';
import { postCrmQuickSchedule } from './crmQuickScheduleChannel';
import { getToken } from '../stores/auth';
import { resolveMisoAddress } from './crmMisoImport';
import { parseMisoPyeong } from './crmMisoImport';
import { resolveSoomgoAddress } from './crmSoomgoImport';

export function preferredAnswerRawFromSoomgo(data: SoomgoExtractedChat): string {
  const hit = (data.requestPairs ?? []).find((pair) => (pair.question ?? '').includes('서비스를 받고 싶은 날'));
  const answer = hit?.answer?.trim();
  if (answer) return answer;
  return (data.preferredDate ?? '').trim();
}

export function preferredAnswerRawFromMiso(data: MisoExtractPayload): string {
  return (data.scheduledAt || data.orderDetail?.serviceDate || '').trim();
}

function areaOf(raw: string | null | undefined): number | null {
  const m = (raw ?? '').match(/[\d.]+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** 정보 가져오기 성공 직후. 실패해도 접수란 입력은 막지 않는다. */
export function captureQuickScheduleLead(input: {
  operatingCompanyId?: string | null;
  leadSource: '숨고' | '미소';
  customerName?: string | null;
  nickname?: string | null;
  customerPhone?: string | null;
  preferredAnswerRaw?: string | null;
  serviceType?: string | null;
  address?: string | null;
  areaPyeong?: number | null;
}): void {
  const token = getToken();
  const operatingCompanyId = input.operatingCompanyId?.trim() ?? '';
  if (!token || !operatingCompanyId) return;
  void saveCrmQuickScheduleLead(token, {
    operatingCompanyId,
    leadSource: input.leadSource,
    customerName: input.customerName ?? '',
    nickname: input.nickname ?? '',
    customerPhone: input.customerPhone ?? '',
    preferredAnswerRaw: input.preferredAnswerRaw ?? '',
    serviceType: input.serviceType ?? '',
    address: input.address ?? '',
    areaPyeong: input.areaPyeong,
  })
    .then((res) => {
      if (res.saved) {
        window.dispatchEvent(new Event('crm-quick-schedule-refresh'));
        postCrmQuickSchedule({ type: 'refresh' });
      }
    })
    .catch(() => undefined);
}

export function captureSoomgoQuickSchedule(operatingCompanyId: string | null | undefined, data: SoomgoExtractedChat): void {
  captureQuickScheduleLead({
    operatingCompanyId,
    leadSource: '숨고',
    customerName: data.customerName,
    nickname: data.nickname,
    customerPhone: data.mobilePhone || data.phone || data.safePhone,
    preferredAnswerRaw: preferredAnswerRawFromSoomgo(data),
    serviceType: data.serviceType,
    address: resolveSoomgoAddress(data),
    areaPyeong: areaOf(data.pyeong),
  });
}

export function captureMisoQuickSchedule(operatingCompanyId: string | null | undefined, data: MisoExtractPayload): void {
  captureQuickScheduleLead({
    operatingCompanyId,
    leadSource: '미소',
    customerName: data.customerName,
    nickname: '',
    customerPhone: data.phone,
    preferredAnswerRaw: preferredAnswerRawFromMiso(data),
    serviceType: data.orderDetail?.serviceTypeDetail,
    address: resolveMisoAddress(data),
    areaPyeong: areaOf(parseMisoPyeong(data.orderDetail?.areaPyung)),
  });
}
