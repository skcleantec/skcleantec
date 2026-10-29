import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EContractFillStepper } from '../../../components/e-contract/EContractFillStepper';
import { SignaturePad } from '../../../components/e-contract/SignaturePad';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import type { PublicSignFieldDto } from '../../../api/eContractPublic';
import { PgContractPreview, type PgContractFieldDraft } from './PgContractPreview';

type Props = {
  open: boolean;
  title: string;
  bodyHtml: string;
  fields: PgContractFieldDraft[];
  onClose: () => void;
};

export function PgContractFillPreviewModal({ open, title, bodyHtml, fields, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeToken, setActiveToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues({});
    setActiveToken(fields[0]?.token ?? null);
  }, [open, fields]);

  if (!open) return null;

  const signFields: PublicSignFieldDto[] = fields.map((field) => ({
    token: field.token,
    label: field.label,
    inputType: field.inputType,
    required: field.required,
  }));

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full max-w-lg flex-col bg-slate-50 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">작성 화면 미리보기</p>
            <p className="text-xs text-slate-500">업체가 보는 화면입니다. 여기 적는 내용은 저장되지 않습니다.</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
        >
          <PgContractPreview
            title={title}
            bodyHtml={bodyHtml}
            fields={fields}
            activeToken={activeToken}
            values={values}
            onSelect={setActiveToken}
          />
          {signFields.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <EContractFillStepper
                fields={signFields}
                values={values}
                onChange={(token, value) => {
                  setActiveToken(token);
                  setValues((prev) => ({ ...prev, [token]: value }));
                }}
                uploadToken=""
                uploadBlob={async (blob) => ({ secureUrl: URL.createObjectURL(blob) })}
                signatureAnchorId="pg-contract-preview-sign"
              />
            </section>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
              입력 칸이 없습니다. 칸을 추가한 뒤 다시 미리보기를 여세요.
            </p>
          )}
          <section id="pg-contract-preview-sign" className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-900">서명</p>
            <SignaturePad
              onSave={async (blob) => {
                const url = URL.createObjectURL(blob);
                setValues((prev) => ({ ...prev, '[[EC_SIGNATURE]]': url }));
                setActiveToken('[[EC_SIGNATURE]]');
              }}
              onClear={() => setValues((prev) => ({ ...prev, '[[EC_SIGNATURE]]': '' }))}
            />
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
