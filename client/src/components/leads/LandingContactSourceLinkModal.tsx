import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import type { LandingContactSourceLink } from '../../api/landingContact';
import { LandingContactFieldEditor } from './LandingContactFieldEditor';

const inputCls =
  'w-full min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10';

const btnPrimary =
  'min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const btnSecondary =
  'min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export type LandingContactLinkModalMode =
  | { kind: 'create' }
  | { kind: 'edit'; link: LandingContactSourceLink }
  | { kind: 'fields'; link: LandingContactSourceLink };

type BrandOption = { id: string; displayName: string };

export function LandingContactSourceLinkModal(props: {
  mode: LandingContactLinkModalMode | null;
  brands: BrandOption[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (data: { label: string; code: string; operatingCompanyId: string | null; customFields: LandingContactCustomFieldDef[] }) => void;
  onEdit: (id: string, data: { label: string; operatingCompanyId: string | null }) => void;
  onSaveFields: (id: string, fields: LandingContactCustomFieldDef[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const open = props.mode != null;
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [brandId, setBrandId] = useState('');
  const [fields, setFields] = useState<LandingContactCustomFieldDef[]>([]);

  useEffect(() => {
    if (!props.mode) return;
    if (props.mode.kind === 'create') {
      setLabel('');
      setCode('');
      setBrandId('');
      setFields([]);
      return;
    }
    setLabel(props.mode.link.label);
    setCode(props.mode.link.code);
    setBrandId(props.mode.link.operatingCompanyId ?? '');
    setFields(props.mode.kind === 'fields' ? props.mode.link.customFields : []);
  }, [props.mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, props.onClose]);

  if (!props.mode) return null;

  const multiBrand = props.brands.length > 1;
  const title =
    props.mode.kind === 'create' ? '링크 생성' : props.mode.kind === 'edit' ? '링크 수정' : '문의 폼 수정';
  const showMeta = props.mode.kind !== 'fields';
  const showFields = props.mode.kind !== 'edit';

  const save = () => {
    if (props.mode?.kind === 'create') {
      props.onCreate({
        label,
        code,
        operatingCompanyId: multiBrand ? brandId || null : null,
        customFields: fields,
      });
      return;
    }
    if (props.mode?.kind === 'edit') {
      props.onEdit(props.mode.link.id, {
        label,
        operatingCompanyId: multiBrand ? brandId || null : props.mode.link.operatingCompanyId,
      });
      return;
    }
    if (props.mode?.kind === 'fields') {
      props.onSaveFields(props.mode.link.id, fields);
    }
  };

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" className={btnSecondary} onClick={props.onClose}>
            닫기
          </button>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
          onFocusCapture={onFieldFocus}
        >
          {showMeta ? (
            <>
              <label className="block text-fluid-2xs font-medium text-slate-600">
                유입명
                <input
                  className={`${inputCls} mt-1`}
                  value={label}
                  placeholder="유튜브"
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              {props.mode.kind === 'create' ? (
                <label className="block text-fluid-2xs font-medium text-slate-600">
                  주소 (비우면 자동)
                  <input
                    className={`${inputCls} mt-1`}
                    value={code}
                    placeholder="youtube"
                    onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16))}
                  />
                </label>
              ) : null}
              {multiBrand ? (
                <label className="block text-fluid-2xs font-medium text-slate-600">
                  브랜드
                  <select className={`${inputCls} mt-1`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                    <option value="">고객이 브랜드를 고름</option>
                    {props.brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
          {showFields ? <LandingContactFieldEditor fields={fields} onChange={setFields} /> : null}
          {props.error ? <p className="text-fluid-xs text-red-700">{props.error}</p> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-3 py-2">
          <button type="button" className={btnSecondary} onClick={props.onClose}>
            취소
          </button>
          <button type="button" className={btnPrimary} disabled={props.busy || (showMeta && !label.trim())} onClick={save}>
            {props.busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
