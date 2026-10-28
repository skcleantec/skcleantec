import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API } from '../../api/apiPrefix';

type ReceiptDoc = {
  title: string;
  badge: string | null;
  rows: { label: string; value: string }[];
  items: { name: string; supply: string; tax: string; total: string }[];
  totals: { label: string; value: string }[];
  approval: string;
  updatedAt: string;
  hasImage: boolean;
  hasPdf: boolean;
};

export function PublicReceiptPage() {
  const { token = '' } = useParams();
  const [doc, setDoc] = useState<ReceiptDoc | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stop = false;
    setDoc(null);
    setMissing(false);
    void fetch(`${API}/public/receipts/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('missing');
        return res.json() as Promise<ReceiptDoc>;
      })
      .then((body) => {
        if (!stop) setDoc(body);
      })
      .catch(() => {
        if (!stop) setMissing(true);
      });
    return () => {
      stop = true;
    };
  }, [token]);

  if (missing) {
    return <main className="mx-auto max-w-lg p-6 text-center text-fluid-sm text-slate-600">영수증을 찾을 수 없습니다.</main>;
  }
  if (!doc) {
    return <main className="mx-auto max-w-lg p-6 text-center text-fluid-sm text-slate-500">불러오는 중…</main>;
  }
  const png = `${API}/public/receipts/${encodeURIComponent(token)}/png?v=${encodeURIComponent(doc.updatedAt)}`;
  const pdf = `${API}/public/receipts/${encodeURIComponent(token)}/pdf?v=${encodeURIComponent(doc.updatedAt)}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-3 bg-slate-50 p-3">
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <h1 className="text-fluid-base font-semibold text-slate-900">{doc.title}</h1>
        {doc.badge ? (
          <p className={`mt-1 text-fluid-sm ${doc.badge === '취소' ? 'text-red-700' : 'text-amber-800'}`}>{doc.badge}</p>
        ) : null}
      </header>
      {doc.hasImage ? (
        <img src={png} alt={`${doc.title} 확인용 사본`} className="w-full rounded-2xl border border-slate-200 bg-white" />
      ) : null}
      <section className="space-y-1 rounded-2xl border border-slate-200 bg-white p-3">
        {doc.rows.map((row) => (
          <p key={row.label} className="flex justify-between gap-3 text-fluid-xs text-slate-800">
            <span className="shrink-0 text-slate-500">{row.label}</span>
            <span className="min-w-0 text-right">{row.value}</span>
          </p>
        ))}
        {doc.items.map((item) => (
          <p key={item.name} className="border-t border-slate-100 pt-1 text-fluid-xs text-slate-800">
            {item.name} · {item.total}
          </p>
        ))}
        {doc.totals.map((row) => (
          <p key={row.label} className="flex justify-between text-fluid-xs font-medium text-slate-900">
            <span>{row.label}</span>
            <span className="tabular-nums">{row.value}</span>
          </p>
        ))}
        <p className="flex justify-between gap-3 border-t border-slate-100 pt-2 text-fluid-xs text-slate-900">
          <span>국세청 승인번호</span>
          <span className="text-right">{doc.approval}</span>
        </p>
      </section>
      {doc.hasPdf ? (
        <a
          href={pdf}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-fluid-sm text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          PDF 보기
        </a>
      ) : null}
      <p className="text-fluid-2xs leading-snug text-slate-500">본 이미지는 확인용 사본입니다. 국세청 승인번호로 홈택스에서 확인할 수 있습니다.</p>
    </main>
  );
}
