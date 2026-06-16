import type { ServiceZoneItem } from '../../api/serviceZones';

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
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
        활성 서비스 권역이 없습니다.{' '}
        <a href="/admin/service-zones" className="font-medium underline underline-offset-2">
          권역 관리
        </a>
        에서 먼저 등록해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">담당 서비스 권역</p>
      <p className="text-xs text-gray-500">
        지역 캘린더 탭에서 배정 가능한 팀장을 구분합니다. 여러 권역 선택 가능 · 비워두면 권역 배정 제한 없음.
      </p>
      <ul className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
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
                    <span className="block text-xs text-gray-500 truncate" title={z.regions.join(', ')}>
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
