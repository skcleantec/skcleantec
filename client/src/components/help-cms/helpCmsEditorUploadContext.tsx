import { createContext, useContext } from 'react';

export const HelpCmsEditorUploadContext = createContext<((file: File) => Promise<string>) | null>(null);

export function useHelpCmsEditorUpload(): ((file: File) => Promise<string>) | null {
  return useContext(HelpCmsEditorUploadContext);
}
