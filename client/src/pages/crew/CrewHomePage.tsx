import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { CrewBiLine, crewT } from '../../i18n/crew/crewI18n';

export function CrewHomePage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다. 상단 메뉴를 눌러 다시 시도하거나 페이지를 새로고침해 주세요.
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-sm text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  const gn = me.group.name;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h1 className="text-base font-semibold text-gray-900">
          <CrewBiLine id="crew.home.title" koClassName="font-semibold" />
        </h1>
        <p className="text-fluid-sm text-gray-600 mt-2">
          <CrewBiLine id="crew.home.intro" vars={{ groupName: gn }} />
        </p>
        <p className="text-fluid-xs text-gray-500 mt-2">
          {me.crewViewerRole === 'LEADER' ? (
            <CrewBiLine id="crew.home.roleLeader" />
          ) : (
            <CrewBiLine id="crew.home.roleMember" />
          )}
        </p>
        <p className="text-fluid-sm mt-3">
          <Link to="/crew/schedule" className="text-indigo-700 underline hover:text-indigo-900">
            <span className="block">{crewT('crew.home.scheduleLink').ko}</span>
            <span className="block text-fluid-2xs text-indigo-600/90">{crewT('crew.home.scheduleLink').th}</span>
          </Link>
          <span className="text-gray-600 block mt-1">
            <CrewBiLine id="crew.home.scheduleHint" />
          </span>
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">
          <CrewBiLine id="crew.home.membersHeading" koClassName="font-semibold text-gray-800" />
        </h2>
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-md">
          {me.group.members.map((m) => (
            <li key={m.teamMemberId} className="px-3 py-2 text-fluid-sm text-center">
              <span className={m.isActive ? 'text-gray-900' : 'text-gray-400 line-through'}>
                {m.name}
                {m.isGroupLeader ? (
                  <span className="ml-2 text-indigo-700 text-fluid-xs inline-block">
                    <span className="block">{crewT('crew.home.badgeGroupLeader').ko}</span>
                    <span className="block text-indigo-600/90">{crewT('crew.home.badgeGroupLeader').th}</span>
                  </span>
                ) : null}
              </span>
              {m.phone ? <span className="block text-fluid-xs text-gray-500 mt-0.5">{m.phone}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
