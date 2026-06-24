import { useState } from 'react';
import { createPortal } from 'react-dom';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  formatCrewHomeAddressLine,
  formatCrewHomeAddressMultiline,
} from '../../utils/crewHomeAddress';
import { teamBiPlain } from '../../i18n/team/teamI18n';

function MapPinMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export type TeamCrewHomeAddressTarget = {
  name: string;
  homeAddress: string | null;
  homeAddressDetail: string | null;
};

export function TeamCrewHomeAddressModal({
  target,
  onClose,
}: {
  target: TeamCrewHomeAddressTarget;
  onClose: () => void;
}) {
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const lines = formatCrewHomeAddressMultiline(target.homeAddress, target.homeAddressDetail);
  const copyLine = formatCrewHomeAddressLine(target.homeAddress, target.homeAddressDetail);

  const handleCopy = async () => {
    if (!copyLine) return;
    const ok = await copyTextToClipboard(copyLine);
    setCopyHint(ok ? teamBiPlain('team.crewAddress.copyDone') : teamBiPlain('team.crewAddress.copyFail'));
    window.setTimeout(() => setCopyHint(null), 1800);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-crew-address-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-gray-200 bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="team-crew-address-title" className="text-fluid-sm font-semibold text-gray-900">
          {teamBiPlain('team.crewAddress.modalTitle')}
          <span className="font-normal text-gray-600"> · {target.name}</span>
        </h2>
        <p className="mt-1 text-fluid-2xs text-gray-500">{teamBiPlain('team.crewAddress.modalHint')}</p>
        {lines ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-fluid-xs leading-relaxed text-gray-900">
            <p>{lines.road}</p>
            <p className="mt-1 font-medium">{lines.detail}</p>
          </div>
        ) : (
          <p className="mt-3 text-fluid-xs text-gray-500">{teamBiPlain('team.crewAddress.empty')}</p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 text-fluid-sm font-medium text-gray-800 touch-manipulation hover:bg-gray-50"
          >
            {teamBiPlain('team.common.close')}
          </button>
          <button
            type="button"
            disabled={!copyLine}
            onClick={() => void handleCopy()}
            className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-fluid-sm font-semibold text-white touch-manipulation hover:bg-slate-800 disabled:opacity-40"
            aria-live="polite"
          >
            {copyHint ?? teamBiPlain('team.crewAddress.copy')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeamCrewHomeAddressIconButton({
  name,
  homeAddress,
  homeAddressDetail,
  onOpen,
  className = '',
}: TeamCrewHomeAddressTarget & {
  onOpen: () => void;
  className?: string;
}) {
  const hasAddress = Boolean(formatCrewHomeAddressLine(homeAddress, homeAddressDetail));
  if (!hasAddress) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-fluid-2xs font-medium text-emerald-900 touch-manipulation hover:bg-emerald-100 ${className}`}
      title={teamBiPlain('team.crewAddress.viewTitle')}
      aria-label={`${name} ${teamBiPlain('team.crewAddress.viewTitle')}`}
    >
      <MapPinMiniIcon className="h-3 w-3 shrink-0" />
      <span className="sr-only sm:not-sr-only">{teamBiPlain('team.crewAddress.short')}</span>
    </button>
  );
}
