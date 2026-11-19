export function QuoteSoonTab({ title }: { title: string }) {
  return (
    <div className="px-3 py-8 text-center">
      <p className="text-fluid-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-fluid-2xs text-slate-500">다음 업데이트에서 열립니다.</p>
    </div>
  );
}
