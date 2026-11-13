import { useMemo, useState } from 'react';
import { TENANT_NAV_FEATURE_CATALOG } from '@shared/tenantNavFeatureCatalog';
import type { PlatformTenantFeatureRow } from '../../api/platformTenants';
import { featureSelectMode, previewEffective } from './platformFeatureChoice';

type GroupId = 'base' | 'work' | 'customer' | 'field' | 'money' | 'custom';

const GROUPS: { id: GroupId; title: string; sub: string }[] = [
  { id: 'base', title: '기본 기능', sub: '모든 업체에 들어가는 기본 기능이에요.' },
  { id: 'work', title: '접수·업무', sub: '사무실에서 쓰는 업무 기능' },
  { id: 'customer', title: '고객 연락·결제', sub: '고객에게 보내고 받는 기능' },
  { id: 'field', title: '현장·팀', sub: '팀장·팀원 앱과 현장 관리' },
  { id: 'money', title: '정산·계약', sub: '정산, 파트너, 전자계약' },
  { id: 'custom', title: '업체 전용', sub: '이 업체만 쓰는 맞춤 기능' },
];

const MODULE_GROUP: Record<string, GroupId> = {
  core_inquiries: 'base',
  core_schedule: 'base',
  core_assignments: 'base',
  core_messages: 'work',
  mod_cs: 'work',
  mod_quick_paste: 'work',
  mod_ai_dispatch: 'work',
  mod_db_marketplace: 'work',
  mod_advertising: 'work',
  mod_alimtalk: 'customer',
  mod_card_payment: 'customer',
  mod_cashbill: 'customer',
  mod_landing_inquiry: 'customer',
  mod_telecrm: 'customer',
  mod_crew: 'field',
  mod_team_stats: 'field',
  mod_inspection: 'field',
  mod_payroll: 'money',
  mod_external_co: 'money',
  mod_tenant_exchange: 'money',
  mod_e_contract: 'money',
};

/** 메뉴 목록에 따로 연결된 메뉴가 없는 기능의 설명 */
const MODULE_HINT: Record<string, string> = {
  core_assignments: '접수 팀장 배정',
  mod_quick_paste: '접수 빠른등록',
  mod_ai_dispatch: '접수 AI 미리 배정',
  mod_crew: '팀원(크루) 현장 앱',
  mod_telecrm: '텔레CRM 화면 · 모든 플랜 별도 옵션',
};

const MODULE_LABEL: Record<string, string> = {
  mod_cashbill: '현금영수증·세금계산서',
  mod_card_payment: '카드결제',
};

function buildMenuMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const category of TENANT_NAV_FEATURE_CATALOG) {
    for (const row of category.rows) {
      if (!row.moduleId) continue;
      const group = row.group?.trim();
      const label = group && group !== row.label && group !== '메뉴' ? `${group} › ${row.label}` : row.label;
      const list = map.get(row.moduleId) ?? [];
      if (!list.includes(label)) list.push(label);
      map.set(row.moduleId, list);
    }
  }
  return map;
}

function displayLabel(row: PlatformTenantFeatureRow): { name: string; customTag: string | null } {
  const m = /^\[([^\]]+)\]\s*(.+)$/.exec(row.label.trim());
  if (m) return { name: m[2]!, customTag: `${m[1]} 전용` };
  return { name: MODULE_LABEL[row.moduleId] ?? row.label, customTag: null };
}

function menuLine(moduleId: string, menus: Map<string, string[]>): string {
  const list = menus.get(moduleId) ?? [];
  if (list.length === 0) return MODULE_HINT[moduleId] ?? '';
  const shown = list.slice(0, 4).join(' · ');
  return list.length > 4 ? `${shown} 외 ${list.length - 4}개` : shown;
}

type Filter = 'all' | 'on' | 'off' | 'custom';

type Props = {
  features: PlatformTenantFeatureRow[];
  /** 저장된 상태 — 바뀐 것 표시용 */
  savedFeatures: PlatformTenantFeatureRow[];
  planLabel: string;
  saving: boolean;
  onToggle: (moduleId: string) => void;
  onUseDefault: (moduleId: string) => void;
  onResetFromPlan: () => void;
  onUndo: () => void;
  onSave: () => void;
};

function isOn(row: PlatformTenantFeatureRow) {
  return previewEffective(row, featureSelectMode(row));
}

export function PlatformTenantFeatureSwitchBoard({
  features,
  savedFeatures,
  planLabel,
  saving,
  onToggle,
  onUseDefault,
  onResetFromPlan,
  onUndo,
  onSave,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const menus = useMemo(() => buildMenuMap(), []);
  const savedOn = useMemo(
    () => new Map(savedFeatures.map((r) => [r.moduleId, isOn(r)])),
    [savedFeatures],
  );

  const rows = features.map((row) => {
    const on = isOn(row);
    const custom = !row.locked && on !== row.inPlan;
    const dirty = savedOn.has(row.moduleId) && savedOn.get(row.moduleId) !== on;
    const { name, customTag } = displayLabel(row);
    const group: GroupId = customTag ? 'custom' : (MODULE_GROUP[row.moduleId] ?? 'custom');
    return { row, on, custom, dirty, name, customTag, group };
  });

  const visible = (r: (typeof rows)[number]) =>
    filter === 'all' ||
    (filter === 'on' && r.on) ||
    (filter === 'off' && !r.on) ||
    (filter === 'custom' && r.custom);

  const onCount = rows.filter((r) => r.on).length;
  const customCount = rows.filter((r) => r.custom).length;
  const dirtyCount = rows.filter((r) => r.dirty).length;

  const menuGroups = useMemo(
    () =>
      TENANT_NAV_FEATURE_CATALOG.map((category) => ({
        title: category.adminOnly ? `${category.label} (관리자)` : category.label,
        lines: category.rows
          .filter((r) => r.moduleId)
          .map((r) => {
            const fr = features.find((f) => f.moduleId === r.moduleId);
            const fname = fr ? displayLabel(fr).name : r.moduleId!;
            return `${r.label} → ${fname}`;
          }),
      })).filter((g) => g.lines.length > 0),
    [features],
  );

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-gray-900">
            켜진 기능 <span className="tabular-nums">{onCount}</span>개{' '}
            <span className="font-normal text-gray-400">
              / 전체 <span className="tabular-nums">{rows.length}</span>개
            </span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {planLabel} 플랜 기본값 기준 · 플랜과 다르게 바꾼 기능{' '}
            <b className="tabular-nums text-amber-700">{customCount}</b>개
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="보기" className="inline-flex rounded-lg bg-gray-100 p-1 text-sm font-medium">
            {(
              [
                ['all', '전체'],
                ['on', '켜짐'],
                ['off', '꺼짐'],
                ['custom', '따로 바꾼 것'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={filter === v}
                onClick={() => setFilter(v)}
                className={`rounded-md px-3 py-1.5 ${
                  filter === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onResetFromPlan}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            플랜 기본값으로
          </button>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const all = rows.filter((r) => r.group === g.id);
          const list = all.filter(visible);
          if (list.length === 0) return null;
          return (
            <section key={g.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{g.title}</h3>
                  <p className="text-xs text-gray-500">{g.sub}</p>
                </div>
                <p className="shrink-0 text-xs tabular-nums text-gray-400">
                  {all.filter((r) => r.on).length}/{all.length} 켜짐
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {list.map((r) => {
                  const line = menuLine(r.row.moduleId, menus);
                  return (
                    <li key={r.row.moduleId} className={`flex items-center gap-3 px-4 py-3 ${r.dirty ? 'bg-amber-50/50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className={`text-sm font-medium ${r.on ? 'text-gray-900' : 'text-gray-400'}`}>{r.name}</p>
                          {r.row.locked ? (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">필수</span>
                          ) : null}
                          {r.custom ? (
                            <>
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                                {r.on ? '플랜 외 · 따로 켬' : '플랜 포함 · 따로 끔'}
                              </span>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => onUseDefault(r.row.moduleId)}
                                className="text-[11.5px] font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
                              >
                                기본값으로
                              </button>
                            </>
                          ) : null}
                          {r.dirty ? (
                            <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[11px] font-medium text-white">저장 전</span>
                          ) : null}
                        </div>
                        {line || r.customTag ? (
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            {r.customTag ? `${r.customTag}${line ? ' · ' : ''}` : ''}
                            {line}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={r.on}
                        aria-label={r.name}
                        disabled={saving || r.row.locked}
                        onClick={() => onToggle(r.row.moduleId)}
                        className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
                          r.on ? 'bg-gray-900' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            r.on ? 'translate-x-[18px]' : ''
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {rows.filter(visible).length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500 lg:col-span-2">
            해당하는 기능이 없어요.
          </p>
        ) : null}
      </div>

      <details className="rounded-xl border border-gray-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-sm font-semibold text-gray-900">메뉴별로 보기</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              업체 화면의 어느 메뉴가 어떤 기능으로 켜지는지 확인할 때 열어 보세요.
            </span>
          </span>
          <span className="text-gray-400" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="grid gap-x-8 gap-y-4 border-t border-gray-100 px-5 py-4 text-[13px] sm:grid-cols-2">
          {menuGroups.map((g) => (
            <div key={g.title} className="min-w-0">
              <p className="mb-1.5 font-semibold text-gray-800">{g.title}</p>
              <ul className="grid gap-1 text-gray-600">
                {g.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-gray-400 sm:col-span-2">대시보드·사용자 등록·팀원 등 나머지 메뉴는 항상 보여요.</p>
        </div>
      </details>

      {dirtyCount > 0 ? (
        <div
          className="sticky z-20 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur"
          style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <p className="text-sm text-gray-800">
            <b className="tabular-nums">{dirtyCount}</b>개 바뀜{' '}
            <span className="hidden text-gray-500 sm:inline">· 저장해야 업체 화면에 적용돼요</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onUndo}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              되돌리기
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
