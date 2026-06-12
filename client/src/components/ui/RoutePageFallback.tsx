/** lazy route 청크 로드 중 표시 */
export function RoutePageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-500 text-fluid-sm">
      불러오는 중…
    </div>
  );
}
