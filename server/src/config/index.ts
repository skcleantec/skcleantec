import '../env.js';

const stagingImportEnabledFlag = process.env.STAGING_DB_IMPORT_ENABLED === 'true';
const stagingImportSource = (process.env.STAGING_DB_IMPORT_SOURCE_DATABASE_URL ?? '').trim();
const railwayEnv = (process.env.RAILWAY_ENVIRONMENT ?? '').trim();
/** 로컬에서만 기능 검증 시 `true` — 운영(production)에서는 사용하지 않음 */
const stagingImportAllowLocal =
  process.env.NODE_ENV !== 'production' && process.env.STAGING_DB_IMPORT_ALLOW_LOCAL === 'true';
const stagingImportEnvOk = railwayEnv === 'staging' || stagingImportAllowLocal;

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  /** 히스토리 삭제 등 최고 관리자 전용 — 기본 admin 계정 이메일 */
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin',
  /**
   * 스테이징 전용: 운영 DB 덤프 → 현재 `DATABASE_URL`(스테이징) 복원.
   * 운영 배포에서는 `RAILWAY_ENVIRONMENT=production` 이라 활성화되지 않음.
   */
  stagingDbImport: {
    enabled: stagingImportEnabledFlag && Boolean(stagingImportSource) && stagingImportEnvOk,
    sourceDatabaseUrl: stagingImportSource,
    operatorEmailSubstring: (process.env.STAGING_DB_IMPORT_OPERATOR_EMAIL_SUBSTRING ?? 'pyo').trim() || 'pyo',
  },
} as const;
