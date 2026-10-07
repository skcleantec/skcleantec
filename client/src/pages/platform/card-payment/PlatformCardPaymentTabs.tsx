import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/platform/card-payment', label: 'PG 연동', end: true },
  { to: '/platform/card-payment/charge', label: '카드결재', end: false },
];

export function PlatformCardPaymentTabs() {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [
              'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
              isActive ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
            ].join(' ')
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
