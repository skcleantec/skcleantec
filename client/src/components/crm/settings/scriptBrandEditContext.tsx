import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TelecrmScriptBrandSegment } from '../../ui/TelecrmScriptBrandSegment';

export type ScriptBrandEditState = {
  visible: boolean;
  value: string | null;
  busy: boolean;
  companies: { id: string; displayName: string }[];
  onChange: (operatingCompanyId: string | null) => void;
};

const ScriptBrandEditContext = createContext<{
  edit: ScriptBrandEditState | null;
  setEdit: (next: ScriptBrandEditState | null) => void;
} | null>(null);

export function ScriptBrandEditProvider({ children }: { children: ReactNode }) {
  const [edit, setEdit] = useState<ScriptBrandEditState | null>(null);
  const value = useMemo(() => ({ edit, setEdit }), [edit]);
  return <ScriptBrandEditContext.Provider value={value}>{children}</ScriptBrandEditContext.Provider>;
}

export function ScriptBrandEditSlot() {
  const ctx = useContext(ScriptBrandEditContext);
  const edit = ctx?.edit;
  if (!edit?.visible || edit.companies.length <= 1) return null;
  return (
    <TelecrmScriptBrandSegment
      value={edit.value}
      companies={edit.companies}
      disabled={edit.busy}
      onChange={edit.onChange}
    />
  );
}

/** 설정 헤더의 「누구에게 보이나요」 옆에 브랜드 선택을 올린다. */
export function usePublishScriptBrandEdit(edit: ScriptBrandEditState | null) {
  const ctx = useContext(ScriptBrandEditContext);
  const setEditRef = useRef(ctx?.setEdit);
  setEditRef.current = ctx?.setEdit;
  const onChangeRef = useRef(edit?.onChange);
  onChangeRef.current = edit?.onChange;
  const snapshotRef = useRef(edit);
  snapshotRef.current = edit;
  const signature = edit
    ? `${edit.visible}|${edit.value ?? ''}|${edit.busy}|${edit.companies.map((c) => `${c.id}:${c.displayName}`).join(',')}`
    : '';
  useEffect(() => {
    const setEdit = setEditRef.current;
    if (!setEdit) return;
    const current = snapshotRef.current;
    if (!current?.visible) {
      setEdit(null);
      return () => setEdit(null);
    }
    setEdit({
      visible: true,
      value: current.value,
      busy: current.busy,
      companies: current.companies,
      onChange: (id) => onChangeRef.current?.(id),
    });
    return () => setEdit(null);
  }, [signature]);
}
