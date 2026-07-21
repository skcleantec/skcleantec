import type { Dispatch, SetStateAction } from 'react';
import {
  collectSubtreeOptionIds,
  formatProfOptionPriceDisplay,
  isSelectableProfOption,
  listProfChildren,
  listProfRootNodes,
  type ProfessionalSpecialtyOption,
} from '../../../constants/professionalSpecialtyOptions';
import { inqEditLabel } from './inquiryEditFormClasses';
import type { InquiryEditFormFields } from './inquiryEditTypes';

type Props = {
  professionalCatalog: ProfessionalSpecialtyOption[];
  profCatOpen: Record<string, boolean>;
  setProfCatOpen: Dispatch<SetStateAction<Record<string, boolean>>>;
  editForm: InquiryEditFormFields;
  setEditForm: Dispatch<SetStateAction<InquiryEditFormFields>>;
};

export function InquiryEditProfessionalOptionsPanel({
  professionalCatalog,
  profCatOpen,
  setProfCatOpen,
  editForm,
  setEditForm,
}: Props) {
  return (
    <div>
      <label className={inqEditLabel}>전문 시공 옵션</label>
      <div className="max-h-44 space-y-1.5 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2">
        {listProfRootNodes(professionalCatalog).map((root) => {
          const kids = listProfChildren(professionalCatalog, root.id).filter((c) => c.isActive);
          const showAsSection = root.isGroup || kids.length > 0;
          if (showAsSection) {
            if (kids.length === 0) return null;
            const subtree = collectSubtreeOptionIds(professionalCatalog, root.id);
            const catOpen = profCatOpen[root.id] ?? false;
            return (
              <div key={root.id} className="space-y-1">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={catOpen}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setProfCatOpen((p) => ({ ...p, [root.id]: on }));
                      if (!on) {
                        setEditForm((p) => ({
                          ...p,
                          professionalOptionIds: p.professionalOptionIds.filter(
                            (id) => !subtree.includes(id),
                          ),
                        }));
                      }
                    }}
                    aria-expanded={catOpen}
                    aria-controls={`sched-prof-sub-${root.id}`}
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-gray-600">
                      {root.emoji ? `${root.emoji} ` : null}
                      {root.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-gray-500">
                      선택 시 세부 항목이 표시됩니다.
                    </span>
                  </span>
                </label>
                {catOpen ? (
                  <div
                    id={`sched-prof-sub-${root.id}`}
                    className="ml-1 space-y-1 border-l border-gray-200 pl-1"
                    role="group"
                  >
                    {kids.map((o) => {
                      const gkids = listProfChildren(professionalCatalog, o.id).filter(
                        (c) => c.isActive,
                      );
                      if (gkids.length > 0) {
                        const midOpen = profCatOpen[o.id] ?? false;
                        const subTree = collectSubtreeOptionIds(professionalCatalog, o.id);
                        return (
                          <div key={o.id} className="space-y-1 pl-0.5">
                            <label className="flex cursor-pointer items-start gap-2 text-xs text-gray-800">
                              <input
                                type="checkbox"
                                className="mt-0.5 shrink-0"
                                checked={midOpen}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setProfCatOpen((p) => ({ ...p, [o.id]: on }));
                                  if (!on) {
                                    setEditForm((p) => ({
                                      ...p,
                                      professionalOptionIds: p.professionalOptionIds.filter(
                                        (id) => !subTree.includes(id),
                                      ),
                                    }));
                                  }
                                }}
                                aria-expanded={midOpen}
                                aria-controls={`sched-prof-sub-${o.id}`}
                              />
                              <span className="min-w-0">
                                {o.emoji ? <span className="mr-0.5">{o.emoji}</span> : null}
                                <span className="font-medium text-gray-700">{o.label}</span>
                                <span className="mt-0.5 block text-[10px] text-gray-500">
                                  선택 시 세부 금액 항목
                                </span>
                              </span>
                            </label>
                            {midOpen ? (
                              <div
                                id={`sched-prof-sub-${o.id}`}
                                className="ml-1 space-y-1 border-l border-gray-100 pl-2"
                                role="group"
                              >
                                {gkids.map((g) => {
                                  const gPrice = formatProfOptionPriceDisplay(g);
                                  return (
                                    <label
                                      key={g.id}
                                      className="flex cursor-pointer items-start gap-2 pl-0.5 text-xs text-gray-800"
                                    >
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 shrink-0"
                                        checked={editForm.professionalOptionIds.includes(g.id)}
                                        onChange={() =>
                                          setEditForm((p) => ({
                                            ...p,
                                            professionalOptionIds: p.professionalOptionIds.includes(g.id)
                                              ? p.professionalOptionIds.filter((x) => x !== g.id)
                                              : [...p.professionalOptionIds, g.id],
                                          }))
                                        }
                                      />
                                      <span
                                        className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full border border-gray-300"
                                        style={{ backgroundColor: g.color }}
                                        aria-hidden
                                      />
                                      <span>
                                        {g.emoji ? <span className="mr-0.5">{g.emoji}</span> : null}
                                        {g.label}
                                        {gPrice ? <span className="text-gray-500"> {gPrice}</span> : null}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      if (!isSelectableProfOption(professionalCatalog, o)) return null;
                      const price = formatProfOptionPriceDisplay(o);
                      return (
                        <label
                          key={o.id}
                          className="flex cursor-pointer items-start gap-2 pl-1 text-xs text-gray-800"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 shrink-0"
                            checked={editForm.professionalOptionIds.includes(o.id)}
                            onChange={() =>
                              setEditForm((p) => ({
                                ...p,
                                professionalOptionIds: p.professionalOptionIds.includes(o.id)
                                  ? p.professionalOptionIds.filter((x) => x !== o.id)
                                  : [...p.professionalOptionIds, o.id],
                              }))
                            }
                          />
                          <span
                            className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full border border-gray-300"
                            style={{ backgroundColor: o.color }}
                            aria-hidden
                          />
                          <span>
                            {o.emoji ? <span className="mr-0.5">{o.emoji}</span> : null}
                            {o.label}
                            {price ? <span className="text-gray-500"> {price}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }
          if (!root.isActive || !isSelectableProfOption(professionalCatalog, root)) {
            return null;
          }
          const price = formatProfOptionPriceDisplay(root);
          return (
            <label key={root.id} className="flex cursor-pointer items-start gap-2 text-xs text-gray-800">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={editForm.professionalOptionIds.includes(root.id)}
                onChange={() =>
                  setEditForm((p) => ({
                    ...p,
                    professionalOptionIds: p.professionalOptionIds.includes(root.id)
                      ? p.professionalOptionIds.filter((x) => x !== root.id)
                      : [...p.professionalOptionIds, root.id],
                  }))
                }
              />
              <span
                className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full border border-gray-300"
                style={{ backgroundColor: root.color }}
                aria-hidden
              />
              <span>
                {root.emoji ? <span className="mr-0.5">{root.emoji}</span> : null}
                {root.label}
                {price ? <span className="text-gray-500"> {price}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {editForm.professionalOptionIds.some((id) => {
        const o = professionalCatalog.find((c) => c.id === id);
        return Boolean(o && !o.isActive);
      }) && (
        <div className="mt-2 rounded border border-dashed border-gray-200 p-2 text-xs text-gray-600">
          <p className="mb-1 font-medium text-gray-700">비활성 처리된 항목 (유지됨)</p>
          <ul className="space-y-1">
            {editForm.professionalOptionIds.map((id) => {
              const o = professionalCatalog.find((c) => c.id === id);
              if (!o || o.isActive) return null;
              const price = formatProfOptionPriceDisplay(o);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span>
                    {o.emoji ? `${o.emoji} ` : ''}
                    {o.label}
                    {price ? ` ${price}` : ''}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-red-600"
                    onClick={() =>
                      setEditForm((p) => ({
                        ...p,
                        professionalOptionIds: p.professionalOptionIds.filter((x) => x !== id),
                      }))
                    }
                  >
                    제거
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
