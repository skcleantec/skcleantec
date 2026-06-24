import { useState } from 'react';
import {
  TeamCrewHomeAddressIconButton,
  TeamCrewHomeAddressModal,
  type TeamCrewHomeAddressTarget,
} from './TeamCrewHomeAddressModal';

function PhoneMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

export type TeamCrewMemberContact = {
  teamMemberId?: string | null;
  name: string;
  phone?: string | null;
  homeAddress?: string | null;
  homeAddressDetail?: string | null;
};

export function resolveInquiryCrewMemberContacts(item: {
  crewMemberCount?: number | null;
  crewMemberNote?: string | null;
  crewMembers?: TeamCrewMemberContact[] | null;
}): TeamCrewMemberContact[] {
  const fallback = (item.crewMemberNote ?? '')
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
  if (item.crewMembers && item.crewMembers.length > 0) {
    return item.crewMembers;
  }
  return fallback.map((name) => ({ name, phone: null, homeAddress: null, homeAddressDetail: null }));
}

export function TeamCrewMemberContactChips({
  item,
  className = '',
  chipClassName,
  showPhoneNumber = true,
  variant = 'default',
}: {
  item: {
    crewMemberCount?: number | null;
    crewMemberNote?: string | null;
    crewMembers?: TeamCrewMemberContact[] | null;
  };
  className?: string;
  chipClassName?: string;
  showPhoneNumber?: boolean;
  /** compact — 스케줄 등, 해피콜 배지와 같은 작은 pill */
  variant?: 'default' | 'compact';
}) {
  const list = resolveInquiryCrewMemberContacts(item);
  const [addressTarget, setAddressTarget] = useState<TeamCrewHomeAddressTarget | null>(null);
  const compact = variant === 'compact';

  const resolvedChipClassName =
    chipClassName ??
    (compact
      ? 'inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-fluid-2xs shrink-0'
      : 'inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5');

  const phoneClassName = compact
    ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-fluid-2xs font-medium border border-blue-200 bg-blue-50 text-blue-700 shrink-0 touch-manipulation'
    : 'inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-fluid-2xs font-medium text-blue-700 touch-manipulation';

  if (list.length === 0) return null;

  return (
    <>
      <ul className={`flex flex-wrap items-center gap-1 ${compact ? '' : 'gap-1.5'} ${className}`}>
        {list.map((m, idx) => (
          <li key={`${m.teamMemberId ?? m.name}-${idx}`} className={resolvedChipClassName}>
            <span className={`font-medium text-gray-900 ${compact ? 'text-fluid-2xs' : ''}`}>{m.name}</span>
            {m.phone ? (
              <a
                href={`tel:${m.phone}`}
                onClick={(e) => e.stopPropagation()}
                className={phoneClassName}
                aria-label={`${m.name} ${m.phone}`}
              >
                <PhoneMiniIcon className="h-3 w-3 shrink-0" />
                {showPhoneNumber && !compact ? m.phone : null}
              </a>
            ) : null}
            <TeamCrewHomeAddressIconButton
              name={m.name}
              homeAddress={m.homeAddress ?? null}
              homeAddressDetail={m.homeAddressDetail ?? null}
              compact={compact}
              onOpen={() =>
                setAddressTarget({
                  name: m.name,
                  homeAddress: m.homeAddress ?? null,
                  homeAddressDetail: m.homeAddressDetail ?? null,
                })
              }
            />
          </li>
        ))}
      </ul>
      {addressTarget ? (
        <TeamCrewHomeAddressModal target={addressTarget} onClose={() => setAddressTarget(null)} />
      ) : null}
    </>
  );
}
