-- SK클린텍 L3: 원/투룸 라벨·특이사항 자동문구 제거·스케줄 태극기 미배정 UI
INSERT INTO "tenant_features" ("tenant_id", "module_id", "enabled")
VALUES ('a0000000-0000-4000-8000-000000000001', 'custom_skcleanteck_ops_ui', true)
ON CONFLICT ("tenant_id", "module_id") DO UPDATE SET "enabled" = EXCLUDED."enabled";
