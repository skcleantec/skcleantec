import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type CrmPanel = 'settings' | 'issue' | 'followup';
export type CrmSettingsTab =
  | 'scripts'
  | 'pricing'
  | 'general'
  | 'leadSource'
  | 'sms'
  | 'soomgo'
  | 'soomgo-presets';
export type CrmCatalogScope = 'shared' | 'personal';

const SETTINGS_TABS: CrmSettingsTab[] = [
  'scripts',
  'pricing',
  'general',
  'leadSource',
  'sms',
  'soomgo',
  'soomgo-presets',
];

function parseSettingsTab(raw: string | null): CrmSettingsTab {
  if (raw && SETTINGS_TABS.includes(raw as CrmSettingsTab)) return raw as CrmSettingsTab;
  return 'scripts';
}

function parseCatalogScope(raw: string | null): CrmCatalogScope {
  return raw === 'shared' ? 'shared' : 'personal';
}

/** 텔레CRM `?panel=` · `?tab=` URL 동기화 (popup=1 유지) */
export function useCrmPanelUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const panelRaw = searchParams.get('panel');
  const panel =
    panelRaw === 'settings' || panelRaw === 'issue' || panelRaw === 'followup' ? panelRaw : null;
  const settingsTab = parseSettingsTab(searchParams.get('tab'));
  const catalogScope = parseCatalogScope(searchParams.get('catalog'));
  const pendingInquiryId = searchParams.get('pendingInquiryId')?.trim() || '';
  const followupId = searchParams.get('followupId')?.trim() || '';

  const patchParams = useCallback(
    (patch: (next: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          patch(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openSettings = useCallback(
    (tab: CrmSettingsTab = 'scripts', catalog: CrmCatalogScope = 'personal') => {
      patchParams((next) => {
        next.set('panel', 'settings');
        next.set('tab', tab);
        next.set(
          'catalog',
          tab === 'soomgo' || tab === 'general' || tab === 'leadSource' ? 'shared' : catalog,
        );
        next.delete('pendingInquiryId');
        next.delete('followupId');
      });
    },
    [patchParams],
  );

  const openIssue = useCallback(
    (inquiryId?: string | null) => {
      patchParams((next) => {
        next.set('panel', 'issue');
        next.delete('tab');
        next.delete('followupId');
        if (inquiryId?.trim()) next.set('pendingInquiryId', inquiryId.trim());
        else next.delete('pendingInquiryId');
      });
    },
    [patchParams],
  );

  const openFollowup = useCallback(
    (id?: string | null) => {
      patchParams((next) => {
        next.set('panel', 'followup');
        next.delete('tab');
        next.delete('pendingInquiryId');
        if (id?.trim()) next.set('followupId', id.trim());
        else next.delete('followupId');
      });
    },
    [patchParams],
  );

  const setFollowupId = useCallback(
    (id: string | null) => {
      patchParams((next) => {
        if (id?.trim()) next.set('followupId', id.trim());
        else next.delete('followupId');
      });
    },
    [patchParams],
  );

  const closePanel = useCallback(() => {
    patchParams((next) => {
      next.delete('panel');
      next.delete('tab');
      next.delete('catalog');
      next.delete('pendingInquiryId');
      next.delete('followupId');
    });
  }, [patchParams]);

  const setSettingsTab = useCallback(
    (tab: CrmSettingsTab) => {
      patchParams((next) => {
        next.set('panel', 'settings');
        next.set('tab', tab);
        if (tab === 'soomgo' || tab === 'general' || tab === 'leadSource') {
          next.set('catalog', 'shared');
        }
      });
    },
    [patchParams],
  );

  const setCatalogScope = useCallback(
    (catalog: CrmCatalogScope) => {
      patchParams((next) => {
        next.set('panel', 'settings');
        next.set('catalog', catalog);
      });
    },
    [patchParams],
  );

  const soomgoBarOpen = searchParams.get('soomgoBar') === '1';
  const misoBarOpen = searchParams.get('misoBar') === '1';

  const setSoomgoBarOpen = useCallback(
    (open: boolean) => {
      patchParams((next) => {
        if (open) next.set('soomgoBar', '1');
        else next.delete('soomgoBar');
      });
    },
    [patchParams],
  );

  const setMisoBarOpen = useCallback(
    (open: boolean) => {
      patchParams((next) => {
        if (open) next.set('misoBar', '1');
        else next.delete('misoBar');
      });
    },
    [patchParams],
  );

  return {
    panel,
    settingsTab,
    catalogScope,
    pendingInquiryId,
    followupId,
    isSettingsOpen: panel === 'settings',
    isIssueOpen: panel === 'issue',
    isFollowupOpen: panel === 'followup',
    openSettings,
    openIssue,
    openFollowup,
    setFollowupId,
    closePanel,
    setSettingsTab,
    setCatalogScope,
    soomgoBarOpen,
    setSoomgoBarOpen,
    misoBarOpen,
    setMisoBarOpen,
  };
}
