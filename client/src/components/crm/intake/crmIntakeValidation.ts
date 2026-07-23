import type { CrmIntakeKind, CrmIntakeFormValues } from './crmIntakeSubmit';
import type { MarketerPermissionId } from '@shared/marketerPermissions';
import { resolveCrmOutboundPhone } from '../../../utils/crmContactPhone';

export function crmIntakeRequiredPermission(kind: CrmIntakeKind): MarketerPermissionId {
  if (kind === 'requested' || kind === 'absent' || kind === 'hold') return 'followup.edit';
  return 'inquiry.create';
}

export function crmIntakePermissionLabel(kind: CrmIntakeKind): string {
  const perm = crmIntakeRequiredPermission(kind);
  if (perm === 'followup.edit') return '부재·보류 처리(followup.edit)';
  return '접수·발주 등록(inquiry.create)';
}

export function parseCrmIntakePyeong(pyeong: string): number | null {
  const n = parseFloat(pyeong.replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** CRM 접수 표시명 — 고객명 미확인 시 닉네임·연락처 순으로 사용 */
export function resolveCrmIntakeCustomerName(
  values: Pick<CrmIntakeFormValues, 'customerName' | 'nickname' | 'contactPhone' | 'safePhone'>,
): string {
  const name = values.customerName.trim();
  if (name) return name;
  const nick = values.nickname.trim();
  if (nick) return nick;
  const phone = resolveCrmOutboundPhone(values.contactPhone, values.safePhone);
  if (phone) return phone;
  return '고객';
}

export function validateCrmIntakeForm(
  values: CrmIntakeFormValues,
  pyeong: string,
): string | null {
  const hasPhone =
    values.contactPhone.trim().length > 0 || values.safePhone.trim().length > 0;
  if (!values.contactUnknown && !hasPhone) {
    return '연락처 또는 안심번호를 입력해 주세요.';
  }
  if (values.contactUnknown && !values.nickname.trim() && !values.customerName.trim()) {
    return '전화번호 없음일 때는 닉네임 또는 고객명을 입력해 주세요.';
  }
  if (values.kind === 'received' && !values.address.trim()) {
    return '예약완료는 주소가 필요합니다.';
  }
  if (!values.leadSource.trim()) {
    return '유입 경로를 선택해 주세요.';
  }
  const parsed = parseCrmIntakePyeong(pyeong);
  if (pyeong.trim() && parsed == null) return '평수 형식을 확인해 주세요.';
  return null;
}
