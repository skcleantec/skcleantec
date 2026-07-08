import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** 레거시 보조창 URL → 메인 CRM 상단 숨고 바로 이동 */
export function CrmSoomgoCompanionPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = '숨고 보조 — 텔레CRM';
  }, []);

  const next = new URLSearchParams(searchParams);
  next.set('soomgoBar', '1');
  if (!next.has('popup')) next.set('popup', '1');

  return <Navigate to={`/admin/crm?${next.toString()}`} replace />;
}
