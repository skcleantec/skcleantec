-- Standard 이상 플랜: mod_alimtalk 기본 ON (플랜 모듈 + 기존 테넌트 백필)

INSERT INTO "tenant_features" ("tenant_id", "module_id", "enabled", "meta")
SELECT t."id", 'mod_alimtalk', true, '{}'::jsonb
FROM "tenants" t
WHERE t."plan" IN ('standard', 'standard_plus', 'premium')
  AND NOT EXISTS (
    SELECT 1
    FROM "tenant_features" tf
    WHERE tf."tenant_id" = t."id"
      AND tf."module_id" = 'mod_alimtalk'
  );

UPDATE "tenant_features" tf
SET "enabled" = true
FROM "tenants" t
WHERE tf."tenant_id" = t."id"
  AND tf."module_id" = 'mod_alimtalk'
  AND tf."enabled" = false
  AND t."plan" IN ('standard', 'standard_plus', 'premium');
