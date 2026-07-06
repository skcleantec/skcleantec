import type { CrmIntakeKind, CrmIntakeFormValues } from './crmIntakeSubmit';
import type { MarketerPermissionId } from '@shared/marketerPermissions';

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
  values: Pick<CrmIntakeFormValues, 'customerName' | 'nickname' | 'phone'>,
): string {
  const name = values.customerName.trim();
  if (name) return name;
  const nick = values.nickname.trim();
  if (nick) return nick;
  const phone = values.phone.trim();
  if (phone) return phone;
  return '고객';
}

export function validateCrmIntakeForm(
  values: CrmIntakeFormValues,
  pyeong: string,
): string | null {
  if (!values.phone.trim()) return '연락처를 입력해 주세요.';
  if (values.kind === 'received' && !values.address.trim()) {
    return '예약완료는 주소가 필요합니다.';
  }
  const parsed = parseCrmIntakePyeong(pyeong);
  if (pyeong.trim() && parsed == null) return '평수 형식을 확인해 주세요.';
  return null;
}
