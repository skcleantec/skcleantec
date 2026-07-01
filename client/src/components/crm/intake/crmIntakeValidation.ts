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

export function validateCrmIntakeForm(
  values: CrmIntakeFormValues,
  pyeong: string,
): string | null {
  if (!values.customerName.trim()) return '고객명을 입력해 주세요.';
  if (!values.phone.trim()) return '연락처를 입력해 주세요.';
  if (values.kind === 'received' && !values.address.trim()) {
    return '예약완료는 주소가 필요합니다.';
  }
  const parsed = parseCrmIntakePyeong(pyeong);
  if (pyeong.trim() && parsed == null) return '평수 형식을 확인해 주세요.';
  return null;
}
