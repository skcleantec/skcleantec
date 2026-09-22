import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveAdminOnlyHelpPage } from './adminOnlyHelpContent';
import { AdminOnlyHelpModal } from './AdminOnlyHelpModal';
import { AdminOnlyHelpTrigger } from './AdminOnlyHelpTrigger';

export function AdminOnlyHelpButton({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const page = resolveAdminOnlyHelpPage(pathname);

  return (
    <>
      <AdminOnlyHelpTrigger
        className={className}
        label={`${page.title} 도움말`}
        onClick={() => setOpen(true)}
      />
      <AdminOnlyHelpModal open={open} onClose={() => setOpen(false)} page={page} />
    </>
  );
}
