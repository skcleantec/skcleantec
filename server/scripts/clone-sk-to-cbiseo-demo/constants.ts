/** cbiseo 교육용 SK 데이터 복제 — 태그·식별 */
export const CLONE_DEMO_TAG = '[cbiseo교육복제]';

export const SOURCE_TENANT_SLUGS = ['sk', 'skcleanteck'] as const;
export const TARGET_TENANT_SLUG = 'cbiseo';

/** 타나클린 영업 브랜드 제외 (slug/name 패턴) */
export const EXCLUDED_OC_SLUGS = ['tanaclean', 'tana', 'tanaclein'] as const;

export const PRESERVE_TARGET_USER_EMAILS = [
  'admin',
  'cbiseo',
  'cbiseo-team',
  'marketer@skcleanteck.com',
  'team1@skcleanteck.com',
  'team2@skcleanteck.com',
  'team3@skcleanteck.com',
  'guide-external@demo',
] as const;

export const DEFAULT_ROLLING_DAYS = 30;

/** Cloudinary demo placeholder — 교육용 더미 사진 */
export const DUMMY_PHOTO_URL =
  'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill/sample.jpg';
export const DUMMY_PHOTO_PUBLIC_ID = 'demo/sample';

export type ClonePhase = 'purge' | 'master' | 'core' | 'secondary' | 'premium' | 'all';

export const ALL_CLONE_PHASES: ClonePhase[] = ['purge', 'master', 'core', 'secondary', 'premium'];
