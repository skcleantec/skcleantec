import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

type Row = {
  tenantId: string;
  tenantName: string;
  clerkNo: number | null;
  clerkCode: string | null;
  leaderName: string;
  resigned: boolean;
};

export function PgPartnerClerksPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/public/card-payment/pg-partner/clerks', {
      headers: { Authorization: `Bearer ${readPgPartnerToken()}` },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearPgPartnerToken();
          navigate('/pg-partner', { replace: true });
          return null;
        }
        if (!res.ok) throw new Error('고유번호를 불러오지 못했습니다.');
        return res.json() as Promise<{ items: Row[] }>;
      })
      .then((data) => {
        if (data) setItems(data.items);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '고유번호를 불러오지 못했습니다.'));
  }, [navigate]);

  const groups = new Map<string, { tenantName: string; rows: Row[] }>();
  for (const row of items ?? []) {
    const group = groups.get(row.tenantId) ?? { tenantName: row.tenantName, rows: [] };
    group.rows.push(row);
    groups.set(row.tenantId, group);
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-fluid-base font-semibold text-slate-900">고유번호</h1>
        <p className="mt-1 text-fluid-xs text-slate-600">가입 때 넣어 준 코드 15개를 업체 관리자가 팀장에게 매칭한 결과입니다. 여기서는 바꾸지 않습니다.</p>
      </div>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      {!items && !error ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}
      {items && items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-fluid-sm text-slate-500">매칭된 고유번호가 없습니다.</p>
      ) : null}
      {[...groups.values()].map((group) => (
        <section key={group.tenantName} className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{group.tenantName}</h2>
          <ul className="mt-2 space-y-1">
            {group.rows.map((row) => (
              <li key={`${group.tenantName}-${row.clerkNo}`} className="flex items-center justify-between gap-2 text-fluid-xs">
                <span className="tabular-nums text-slate-500">{row.clerkCode || `${row.clerkNo}번`}</span>
                <span className="min-w-0 truncate text-slate-900">
                  {row.leaderName}
                  {row.resigned ? ' · 퇴사' : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
