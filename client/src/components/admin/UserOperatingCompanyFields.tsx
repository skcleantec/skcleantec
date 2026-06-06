import type { OperatingCompanyItem } from '../../api/operatingCompanies';

export type UserOperatingCompanyFormValue = {
  operatingCompanyIds: string[];
  primaryOperatingCompanyId: string;
};

type Props = {
  companies: OperatingCompanyItem[];
  value: UserOperatingCompanyFormValue;
  onChange: (next: UserOperatingCompanyFormValue) => void;
  disabled?: boolean;
};

/** 팀장·마케터 등록/수정 — 영업 브랜드 다중 소속 + 기본(primary) */
export function UserOperatingCompanyFields({ companies, value, onChange, disabled }: Props) {
  const activeCompanies = companies.filter((c) => c.isActive);

  const toggle = (id: string) => {
    if (disabled) return;
    const has = value.operatingCompanyIds.includes(id);
    let nextIds: string[];
    if (has) {
      nextIds = value.operatingCompanyIds.filter((x) => x !== id);
      if (nextIds.length === 0) return;
    } else {
      nextIds = [...value.operatingCompanyIds, id];
    }
    let nextPrimary = value.primaryOperatingCompanyId;
    if (!nextIds.includes(nextPrimary)) {
      nextPrimary = nextIds[0];
    }
    onChange({ operatingCompanyIds: nextIds, primaryOperatingCompanyId: nextPrimary });
  };

  const setPrimary = (id: string) => {
    if (disabled || !value.operatingCompanyIds.includes(id)) return;
    onChange({ ...value, primaryOperatingCompanyId: id });
  };

  if (activeCompanies.length === 0) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2">
        활성 영업 브랜드가 없습니다. 먼저 영업 브랜드를 등록해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">소속 영업 브랜드</p>
      <p className="text-xs text-gray-500">여러 개 선택 가능 · 기본 브랜드는 접수 자동 귀속에 사용됩니다.</p>
      <ul className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        {activeCompanies.map((c) => {
          const checked = value.operatingCompanyIds.includes(c.id);
          const isPrimary = value.primaryOperatingCompanyId === c.id;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <label className="inline-flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || (checked && value.operatingCompanyIds.length === 1)}
                  onChange={() => toggle(c.id)}
                  className="rounded border-gray-300"
                />
                <span className="font-medium text-gray-900 truncate" title={c.displayName}>
                  {c.displayName}
                </span>
                <span className="text-gray-400 text-xs font-mono">{c.slug}</span>
              </label>
              {checked ? (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
                  <input
                    type="radio"
                    name="oc-primary"
                    checked={isPrimary}
                    disabled={disabled}
                    onChange={() => setPrimary(c.id)}
                  />
                  기본
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function defaultUserOperatingCompanyForm(
  companies: OperatingCompanyItem[],
): UserOperatingCompanyFormValue {
  const active = companies.filter((c) => c.isActive);
  const def = active.find((c) => c.isDefault) ?? active[0];
  if (!def) return { operatingCompanyIds: [], primaryOperatingCompanyId: '' };
  return { operatingCompanyIds: [def.id], primaryOperatingCompanyId: def.id };
}

export function userOperatingCompanyFormFromUser(
  companies: OperatingCompanyItem[],
  memberships?: Array<{ operatingCompanyId: string; isPrimary: boolean }>,
): UserOperatingCompanyFormValue {
  if (memberships && memberships.length > 0) {
    const ids = memberships.map((m) => m.operatingCompanyId);
    const primary = memberships.find((m) => m.isPrimary)?.operatingCompanyId ?? ids[0];
    return { operatingCompanyIds: ids, primaryOperatingCompanyId: primary };
  }
  return defaultUserOperatingCompanyForm(companies);
}
