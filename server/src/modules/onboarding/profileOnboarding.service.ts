import type { ExternalCompany, User, UserRole } from '@prisma/client';

const ONBOARDING_ROLES = new Set<UserRole>(['TEAM_LEADER', 'MARKETER', 'EXTERNAL_PARTNER']);

export function isProfileOnboardingRole(role: string): role is 'TEAM_LEADER' | 'MARKETER' | 'EXTERNAL_PARTNER' {
  return ONBOARDING_ROLES.has(role as UserRole);
}

export function isProfileOnboardingRequired(
  role: string,
  profileCompletedAt: Date | null | undefined,
): boolean {
  if (profileCompletedAt) return false;
  return isProfileOnboardingRole(role);
}

export type ExternalCompanyOnboardingSnapshot = Pick<
  ExternalCompany,
  'id' | 'name' | 'bizNumber' | 'phone' | 'memo' | 'businessRegistrationImageUrl'
>;

export type UserOnboardingSnapshot = Pick<
  User,
  'role' | 'name' | 'phone' | 'vehicleNumber' | 'nameEn' | 'profileCompletedAt' | 'externalCompanyId'
>;

export function validateProfileOnboardingPayload(
  user: UserOnboardingSnapshot,
  company: ExternalCompanyOnboardingSnapshot | null,
  input: {
    name: string;
    phone: string;
    vehicleNumber?: string;
    nameEn?: string;
    companyName?: string;
    companyPhone?: string;
    bizNumber?: string;
    memo?: string | null;
    businessRegistrationImageUrl?: string | null;
  },
): string | null {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) return '이름을 입력해 주세요.';
  if (!phone) return '연락처를 입력해 주세요.';

  if (user.role === 'TEAM_LEADER') {
    const vehicleNumber = (input.vehicleNumber ?? '').trim();
    const nameEn = (input.nameEn ?? '').trim();
    if (!vehicleNumber) return '차량번호를 입력해 주세요.';
    if (!nameEn) return '영문 이름을 입력해 주세요.';
    if (vehicleNumber.length > 64) return '차량번호는 64자 이내로 입력해 주세요.';
    if (nameEn.length > 128) return '영문 이름은 128자 이내로 입력해 주세요.';
    return null;
  }

  if (user.role === 'MARKETER') {
    return null;
  }

  if (user.role === 'EXTERNAL_PARTNER') {
    if (!company) return '소속 타업체 정보를 찾을 수 없습니다.';
    const companyName = (input.companyName ?? '').trim();
    const companyPhone = (input.companyPhone ?? '').trim();
    const bizNumber = (input.bizNumber ?? '').trim();
    if (!companyName) return '업체명을 입력해 주세요.';
    if (!bizNumber) return '사업자등록번호를 입력해 주세요.';
    if (!companyPhone) return '대표 연락처를 입력해 주세요.';
    const imageUrl =
      (input.businessRegistrationImageUrl ?? company.businessRegistrationImageUrl ?? '').trim();
    if (!imageUrl) return '사업자등록증 이미지를 등록해 주세요.';
    return null;
  }

  return null;
}

export function buildProfileOnboardingMeFields(
  user: UserOnboardingSnapshot & { email?: string },
  company: ExternalCompanyOnboardingSnapshot | null,
) {
  return {
    profileCompletedAt: user.profileCompletedAt?.toISOString() ?? null,
    profileOnboardingRequired: isProfileOnboardingRequired(user.role, user.profileCompletedAt),
    externalCompany:
      user.role === 'EXTERNAL_PARTNER' && company
        ? {
            id: company.id,
            name: company.name,
            bizNumber: company.bizNumber,
            phone: company.phone,
            memo: company.memo,
            businessRegistrationImageUrl: company.businessRegistrationImageUrl,
          }
        : null,
  };
}
