import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HelpRole, HelpScreenEntry } from '../types/helpContent';
import {
  fetchHelpContent,
  findHelpWorkflowEntry,
  helpWorkflowChapterItem,
  type HelpGuideChapterItem,
} from '../utils/helpContent';
import { checkHelpEditPermission } from '../api/help';

export function useHelpWorkflowEntry(role: HelpRole) {
  const [entry, setEntry] = useState<HelpScreenEntry | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([fetchHelpContent(), checkHelpEditPermission()])
      .then(([data, permission]) => {
        setEntry(findHelpWorkflowEntry(data, role) ?? null);
        setCanEdit(permission.canEdit);
      })
      .catch(() => {
        setEntry(null);
        setCanEdit(false);
      })
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const chapter = useMemo<HelpGuideChapterItem | null>(
    () => (entry ? helpWorkflowChapterItem(entry) : null),
    [entry],
  );

  return { entry, canEdit, loading, chapter, reload };
}
