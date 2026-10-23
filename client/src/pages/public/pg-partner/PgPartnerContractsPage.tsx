import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PgContractBook } from '../../../components/card-payment/pg-contract/PgContractBook';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

type Template = { title: string; bodyHtml: string };
type Item = {
  id: string;
  tenantName: string;
  businessName: string | null;
  status: string;
  contractSignedAt: string | null;
};
type Signed = {
  title: string;
  bodyHtml: string;
  businessName: string | null;
  signed: boolean;
  signedAt: string | null;
  values?: Record<string, string>;
};

export function PgPartnerContractsPage() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [opened, setOpened] = useState<Signed | null>(null);
  const [sim, setSim] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${readPgPartnerToken()}` };
    const failAuth = (status: number) => {
      if (status === 401) {
        clearPgPartnerToken();
        navigate('/pg-partner', { replace: true });
      }
    };
    void fetch('/api/public/card-payment/pg-partner/contract', { headers })
      .then(async (res) => {
        failAuth(res.status);
        if (!res.ok) throw new Error('계약서를 불러오지 못했습니다.');
        return res.json() as Promise<Template>;
      })
      .then(setTemplate)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
    void fetch('/api/public/card-payment/pg-partner/applications', { headers })
      .then(async (res) => {
        failAuth(res.status);
        if (!res.ok) throw new Error('신청 목록을 불러오지 못했습니다.');
        return res.json() as Promise<{ items: Item[] }>;
      })
      .then((data) => setItems(data.items.filter((item) => item.status === 'APPROVED')))
      .catch(() => undefined);
  }, [navigate]);

  const open = (id: string) => {
    void fetch(`/api/public/card-payment/pg-partner/applications/${encodeURIComponent(id)}/contract`, {
      headers: { Authorization: `Bearer ${readPgPartnerToken()}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('계약 내용을 불러오지 못했습니다.');
        return res.json() as Promise<Signed>;
      })
      .then(setOpened)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-fluid-base font-semibold text-slate-900">전자계약</h1>
      <p className="text-fluid-xs text-slate-600">승인이 난 업체가 작성하는 계약서입니다. 서명이 끝나면 그 내용이 여기에 남습니다.</p>
      {error ? <p className="text-fluid-sm text-red-700">{error}</p> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-fluid-sm font-semibold text-slate-900">{template?.title || '계약서'}</h2>
        <div className="mt-3">
          <PgContractBook
            mode="preview"
            values={sim}
            onChange={(key, value) => setSim((prev) => ({ ...prev, [key]: value }))}
          />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 text-fluid-sm font-semibold text-slate-900">승인된 업체</h2>
        {items.length === 0 ? <p className="px-4 py-6 text-center text-fluid-sm text-slate-500">승인된 업체가 없습니다.</p> : null}
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <span className="min-w-0 truncate text-fluid-sm text-slate-900">{item.businessName || item.tenantName}</span>
                <span className="shrink-0 text-fluid-2xs text-slate-500">{item.contractSignedAt ? '계약 완료' : '계약 전'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {opened ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-fluid-sm font-semibold text-slate-900">
            {opened.businessName || '업체'} · {opened.signed ? '작성본' : '작성 전'}
          </h2>
          <div className="mt-3">
            <PgContractBook
              mode="read"
              values={opened.values ?? {}}
              contractNo={opened.values?.pgContractNo}
              onChange={() => undefined}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
