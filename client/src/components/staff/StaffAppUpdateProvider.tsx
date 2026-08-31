import { createContext, useContext, type ReactNode } from 'react';
import {
  useStaffAppUpdateCheck,
  type StaffAppUpdateCheckState,
} from '../../hooks/useStaffAppUpdateCheck';

const StaffAppUpdateContext = createContext<StaffAppUpdateCheckState | null>(null);

export function StaffAppUpdateProvider({ children }: { children: ReactNode }) {
  const state = useStaffAppUpdateCheck();
  return (
    <StaffAppUpdateContext.Provider value={state}>{children}</StaffAppUpdateContext.Provider>
  );
}

export function useStaffAppUpdateContext(): StaffAppUpdateCheckState | null {
  return useContext(StaffAppUpdateContext);
}
