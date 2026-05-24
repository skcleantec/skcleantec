-- Phase 5: 레거시 admin 계정 → isTenantOwner 백필 (프로비저닝·시드 외 누락 보정)
UPDATE users
SET is_tenant_owner = true
WHERE role = 'ADMIN'
  AND LOWER(email) = 'admin'
  AND is_tenant_owner = false;
