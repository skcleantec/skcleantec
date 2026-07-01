import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type CrmPanel = 'settings' | 'issue';
export type CrmSettingsTab = 'scripts' | 'pricing' | 'general';
export type CrmCatalogScope = 'shared' | 'personal';

const SETTINGS_TABS: CrmSettingsTab[] = ['scripts', 'pricing', 'general'];

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
  const panel = panelRaw === 'settings' || panelRaw === 'issue' ? panelRaw : null;
  const settingsTab = parseSettingsTab(searchParams.get('tab'));
  const catalogScope = parseCatalogScope(searchParams.get('catalog'));
  const pendingInquiryId = searchParams.get('pendingInquiryId')?.trim() || '';

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
        next.set('catalog', catalog);
        next.delete('pendingInquiryId');
      });
    },
    [patchParams],
  );

  const openIssue = useCallback(
    (inquiryId?: string | null) => {
      patchParams((next) => {
        next.set('panel', 'issue');
        next.delete('tab');
        if (inquiryId?.trim()) next.set('pendingInquiryId', inquiryId.trim());
        else next.delete('pendingInquiryId');
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
    });
  }, [patchParams]);

  const setSettingsTab = useCallback(
    (tab: CrmSettingsTab) => {
      patchParams((next) => {
        next.set('panel', 'settings');
        next.set('tab', tab);
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

  return {
    panel,
    settingsTab,
    catalogScope,
    pendingInquiryId,
    isSettingsOpen: panel === 'settings',
    isIssueOpen: panel === 'issue',
    openSettings,
    openIssue,
    closePanel,
    setSettingsTab,
    setCatalogScope,
  };
}
