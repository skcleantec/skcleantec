import { Link } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getPlatformToken } from '../../stores/platformAuth';

function roleFromToken(token: string): string {
  try {
    const part = token.split('.')[1];
    if (!part) return '';
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : '';
  } catch {
    return '';
  }
}

function mainPath(): string {
  const staff = getToken();
  if (staff) {
    const role = roleFromToken(staff);
    if (role === 'TEAM_LEADER') return '/team/dashboard';
    if (role === 'CREW') return '/crew/dashboard';
    return '/admin/dashboard';
  }
  if (getPlatformToken()) return '/platform';
  return '/login';
}

export function PaysisCheckoutResultPage({ title }: { title: string }) {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <p className="text-fluid-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-fluid-xs text-slate-600">이 창은 닫아도 됩니다. 결제 결과는 업체로 전달됩니다.</p>
        <Link
          to={mainPath()}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          메인으로
        </Link>
      </div>
    </div>
  );
}
