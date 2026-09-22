import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveAdminOnlyHelp } from './resolveAdminOnlyHelp';
import { AdminOnlyHelpModal } from './AdminOnlyHelpModal';
import { AdminOnlyHelpTrigger } from './AdminOnlyHelpTrigger';

export function AdminOnlyHelpButton({
  className = '',
  compact = false,
  helpId,
}: {
  className?: string;
  compact?: boolean;
  /** 버튼으로 열린 창이면 그 창 전용 도움말 */
  helpId?: string;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const page = resolveAdminOnlyHelp(pathname, helpId);

  return (
    <>
      <AdminOnlyHelpTrigger
        className={className}
        compact={compact}
        label={`${page.title} 도움말`}
        onClick={() => setOpen(true)}
      />
      <AdminOnlyHelpModal open={open} onClose={() => setOpen(false)} page={page} />
    </>
  );
}
