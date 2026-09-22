import type { AdminOnlyHelpPage } from './adminOnlyHelpContent';
import { resolveAdminOnlyHelpPage } from './adminOnlyHelpContent';
import { resolveAdminOnlyHelpModule } from './adminOnlyHelpModules';

export function resolveAdminOnlyHelp(pathname: string, helpId?: string): AdminOnlyHelpPage {
  if (helpId) {
    const mod = resolveAdminOnlyHelpModule(helpId);
    if (mod) return mod;
  }
  return resolveAdminOnlyHelpPage(pathname);
}
