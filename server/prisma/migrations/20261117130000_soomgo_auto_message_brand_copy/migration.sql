-- 숨고 자동메시지: 비어 있는 브랜드 행에 업체 공통(operating_company_id NULL) 내용·활성·페이백을 복사.
-- 공통 행은 삭제하지 않는다. 이후 앱은 공통 행을 읽지 않는다.
-- 전화 자동메시지(auto_call)는 owner_user_id 별로 같은 방식으로 복사한다.

WITH common AS (
  SELECT DISTINCT ON (tenant_id, trigger_kind, COALESCE(owner_user_id, ''))
    tenant_id,
    owner_user_id,
    slot_number,
    label,
    steps_json,
    sort_order,
    is_active,
    trigger_kind,
    payback_won
  FROM telecrm_soomgo_message_presets
  WHERE operating_company_id IS NULL
    AND trigger_kind IN (
      'auto_requested',
      'auto_absent',
      'auto_hold',
      'auto_deposit',
      'auto_reserved',
      'auto_received',
      'auto_quote',
      'auto_call'
    )
  ORDER BY tenant_id, trigger_kind, COALESCE(owner_user_id, ''), updated_at DESC
)
UPDATE telecrm_soomgo_message_presets AS b
SET
  label = c.label,
  steps_json = c.steps_json,
  is_active = c.is_active,
  payback_won = c.payback_won,
  updated_at = CURRENT_TIMESTAMP
FROM common AS c
INNER JOIN operating_companies AS oc ON oc.tenant_id = c.tenant_id
WHERE b.tenant_id = c.tenant_id
  AND b.trigger_kind = c.trigger_kind
  AND b.operating_company_id = oc.id
  AND b.owner_user_id IS NOT DISTINCT FROM c.owner_user_id
  AND b.is_active = false
  AND (b.steps_json IS NULL OR btrim(b.steps_json) IN ('', '[]', 'null'));

WITH common AS (
  SELECT DISTINCT ON (tenant_id, trigger_kind, COALESCE(owner_user_id, ''))
    tenant_id,
    owner_user_id,
    slot_number,
    label,
    steps_json,
    sort_order,
    is_active,
    trigger_kind,
    payback_won
  FROM telecrm_soomgo_message_presets
  WHERE operating_company_id IS NULL
    AND trigger_kind IN (
      'auto_requested',
      'auto_absent',
      'auto_hold',
      'auto_deposit',
      'auto_reserved',
      'auto_received',
      'auto_quote',
      'auto_call'
    )
  ORDER BY tenant_id, trigger_kind, COALESCE(owner_user_id, ''), updated_at DESC
)
INSERT INTO telecrm_soomgo_message_presets (
  id,
  tenant_id,
  owner_user_id,
  slot_number,
  label,
  steps_json,
  sort_order,
  is_active,
  trigger_kind,
  operating_company_id,
  payback_won,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  c.tenant_id,
  c.owner_user_id,
  c.slot_number,
  c.label,
  c.steps_json,
  c.sort_order,
  c.is_active,
  c.trigger_kind,
  oc.id,
  c.payback_won,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM common AS c
INNER JOIN operating_companies AS oc ON oc.tenant_id = c.tenant_id
WHERE NOT EXISTS (
  SELECT 1
  FROM telecrm_soomgo_message_presets AS b
  WHERE b.tenant_id = c.tenant_id
    AND b.trigger_kind = c.trigger_kind
    AND b.operating_company_id = oc.id
    AND b.owner_user_id IS NOT DISTINCT FROM c.owner_user_id
);
