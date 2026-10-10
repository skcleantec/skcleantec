-- 이미 시공 종류를 저장한 업체에 기본 종류를 덧붙인다. 같은 이름은 다시 넣지 않는다.

UPDATE "tenant_extra_work_settings" AS s
SET "work_presets" = COALESCE(s."work_presets"::jsonb, '[]'::jsonb) || (
  SELECT COALESCE(jsonb_agg(to_jsonb(v.label)), '[]'::jsonb)
  FROM (
    VALUES ('컬비시공'), ('바닥돌돌이'), ('스티커제거'), ('분진청소'), ('새집증후군')
  ) AS v(label)
  WHERE NOT (COALESCE(s."work_presets"::jsonb, '[]'::jsonb) @> to_jsonb(v.label))
);
