export function PaysisCheckoutResultPage({ title }: { title: string }) {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-fluid-xs text-slate-600">이 창은 닫아도 됩니다. 결제 결과는 업체로 전달됩니다.</p>
      </div>
    </div>
  );
}
