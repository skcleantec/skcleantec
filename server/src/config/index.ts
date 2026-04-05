import '../env.js';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  /** 히스토리 삭제 등 최고 관리자 전용 — 기본 admin 계정 이메일 */
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || 'admin',
} as const;
