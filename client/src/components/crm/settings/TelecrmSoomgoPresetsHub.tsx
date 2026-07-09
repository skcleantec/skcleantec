import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import type { TelecrmCatalogOwnerScope } from '../../../api/telecrm';
import { TelecrmSoomgoMessagePresetsSection } from './TelecrmSoomgoMessagePresetsSection';
import { TelecrmSoomgoAutoMessagesSection } from './TelecrmSoomgoAutoMessagesSection';

export type SoomgoPresetsView = 'macro' | 'auto';

/** 숨고 프리셋 — 매크로 / 자동메시지 하위 탭 */
export function TelecrmSoomgoPresetsHub({
  catalogScope,
  canEditAuto,
  syncViewToUrl = true,
}: {
  catalogScope: TelecrmCatalogOwnerScope;
  canEditAuto: boolean;
  syncViewToUrl?: boolean;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localView, setLocalView] = useState<SoomgoPresetsView>('macro');
  const showAutoTab = canEditAuto && catalogScope === 'shared';
  const urlView: SoomgoPresetsView =
    searchParams.get('view') === 'auto' && showAutoTab ? 'auto' : 'macro';
  const view = syncViewToUrl ? urlView : localView;

  const setView = (next: SoomgoPresetsView) => {
    if (!syncViewToUrl) {
      setLocalView(next);
      return;
    }
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'auto') p.set('view', 'auto');
        else p.delete('view');
        return p;
      },
      { replace: true },
    );
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        <button
          type="button"
          onClick={() => setView('macro')}
          className={`rounded-md px-4 py-1.5 text-fluid-sm font-medium ${
            view === 'macro' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-white'
          }`}
        >
          매크로
        </button>
        {showAutoTab ? (
          <button
            type="button"
            onClick={() => setView('auto')}
            className={`rounded-md px-4 py-1.5 text-fluid-sm font-medium ${
              view === 'auto' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-white'
            }`}
          >
            자동메시지
          </button>
        ) : null}
      </div>

      {view === 'auto' ? (
        <TelecrmSoomgoAutoMessagesSection />
      ) : (
        <TelecrmSoomgoMessagePresetsSection catalogScope={catalogScope} />
      )}
    </div>
  );
}
