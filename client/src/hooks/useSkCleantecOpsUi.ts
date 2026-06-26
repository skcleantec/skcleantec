import {
  oneRoomLabelForOpsUi,
  skCleantecOpsUiEnabled,
  SK_TAEGEUK_FLAG_ASSET,
} from '@shared/custom/skcleantecOpsUi';
import { useTenantCapabilities } from './useTenantCapabilities';

/** SK클린텍 L3 — 원/투룸·특이사항·스케줄 태극기 미배정 (staff 화면) */
export function useSkCleantecOpsUi() {
  const { features, tenantSlug } = useTenantCapabilities();
  const enabled = skCleantecOpsUiEnabled({ tenantSlug, features });
  return {
    enabled,
    oneRoomLabel: oneRoomLabelForOpsUi(enabled),
    taegeukFlagAsset: SK_TAEGEUK_FLAG_ASSET,
  };
}
