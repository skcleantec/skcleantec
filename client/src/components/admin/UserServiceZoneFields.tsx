import { Link } from 'react-router-dom';
import type { ServiceZoneItem } from '../../api/serviceZones';
import { HelpTooltip } from '../ui/HelpTooltip';

const SERVICE_ZONE_HELP = `【담당 서비스 권역이란?】
팀장이 배정받을 수 있는 ‘권역’을 정합니다. 지역 캘린더 탭에서는 여기서 고른 권역에 속한 팀장만 배정 후보로 나옵니다.

【설정 순서】
① 관리 → 서비스 권역에서 권역을 만듭니다 (예: 수도권 — 경기도·서울 등).
② 이 화면(팀장 등록·수정)에서 해당 팀장에게 권역을 체크합니다.
③ 스케줄 → 맞춤 캘린더에 권역을 연결하면, 그 탭에서 배정·잔여 TO가 권역 기준으로 표시됩니다.

【선택 규칙】
· 여러 권역 동시 선택 가능 (예: 수도권 + 충청권)
· 아무 것도 선택하지 않으면 권역 제한 없이 배정 가능
· 전체 캘린더 탭에서는 권역과 맞는 접수는 팀장 배정이 제한될 수 있습니다`;

export type UserServiceZoneFormValue = {
  serviceZoneIds: string[];
};

type Props = {
  zones: ServiceZoneItem[];
  value: UserServiceZoneFormValue;
  onChange: (next: UserServiceZoneFormValue) => void;
  disabled?: boolean;
};

/** 팀장 등록/수정 — 서비스 권역 다중 소속 (선택) */
export function UserServiceZoneFields({ zones, value, onChange, disabled }: Props) {
  const activeZones = zones.filter((z) => z.isActive);

  const toggle = (id: string) => {
    if (disabled) return;
    const has = value.serviceZoneIds.includes(id);
    const nextIds = has
      ? value.serviceZoneIds.filter((x) => x !== id)
      : [...value.serviceZoneIds, id];
    onChange({ serviceZoneIds: nextIds });
  };

  if (activeZones.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 space-y-2 text-sm text-amber-900">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-gray-800">담당 서비스 권역</p>
          <HelpTooltip text={SERVICE_ZONE_HELP} className="shrink-0" />
        </div>
        <p className="text-xs text-amber-800/90 leading-snug">
          아직 등록된 권역이 없습니다.{' '}
          <Link to="/admin/service-zones" className="font-semibold underline underline-offset-2">
            서비스 권역
          </Link>
          에서 권역(이름 + 경기도·충남 등 지역)을 먼저 만든 뒤, 이 팀장에게 연결하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-100 bg-violet-50/30 p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-gray-800">담당 서비스 권역</p>
        <HelpTooltip text={SERVICE_ZONE_HELP} className="shrink-0" />
      </div>
      <p className="text-xs text-gray-600 leading-snug">
        아래에서 이 팀장이 담당할 권역을 고르세요. 권역·지역 범위는{' '}
        <Link to="/admin/service-zones" className="font-medium text-violet-800 underline underline-offset-2">
          서비스 권역
        </Link>
        메뉴에서 먼저 만듭니다.
      </p>
      <ul className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
        {activeZones.map((z) => {
          const checked = value.serviceZoneIds.includes(z.id);
          return (
            <li key={z.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
              <label className="inline-flex items-start gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(z.id)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{z.name}</span>
                  {z.regions.length > 0 ? (
                    <span className="block text-xs text-gray-500 break-words" title={z.regions.join(', ')}>
                      {z.regions.join(', ')}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function userServiceZoneFormFromUser(
  user: { serviceZones?: Array<{ id: string }> } | null | undefined,
): UserServiceZoneFormValue {
  const ids = (user?.serviceZones ?? []).map((z) => z.id).filter(Boolean);
  return { serviceZoneIds: ids };
}

export function ServiceZoneBadges({
  items,
}: {
  items?: Array<{ id: string; name: string }>;
}) {
  if (!items?.length) {
    return <span className="text-fluid-2xs text-gray-400">권역 —</span>;
  }
  return (
    <span className="flex flex-wrap gap-1 justify-center">
      {items.map((z) => (
        <span
          key={z.id}
          className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-fluid-2xs font-medium text-violet-900"
          title={z.name}
        >
          {z.name}
        </span>
      ))}
    </span>
  );
}
