import { useMemo, useState } from 'react';
import { CustomerLinkMessagePreviewEditor } from '../../orderform/CustomerLinkMessagePreviewEditor';
import {
  buildCustomerLinkHelpDemoMsgConfig,
  buildCustomerLinkHelpDemoPreview,
} from './customerLinkHelpDemoData';

/** 실제 CustomerLinkMessagePreviewEditor (읽기 전용) */
export function CustomerLinkHelpEditorLivePreview({ enlarged = false }: { enlarged?: boolean }) {
  const [msgConfig] = useState(buildCustomerLinkHelpDemoMsgConfig);

  const assembledPreview = useMemo(
    () => buildCustomerLinkHelpDemoPreview(msgConfig),
    [msgConfig],
  );

  const noop = () => {};

  return (
    <div className={`pointer-events-none select-none ${enlarged ? 'scale-[1.02]' : ''}`}>
      <CustomerLinkHelpBrandBar enlarged={enlarged} />
      <CustomerLinkMessagePreviewEditor
        msgConfig={msgConfig}
        onChange={noop}
        assembledPreview={assembledPreview}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <span className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white">저장</span>
        <span className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-700">
          기본 양식으로 다시 채우기
        </span>
      </div>
    </div>
  );
}

function CustomerLinkHelpBrandBar({ enlarged }: { enlarged?: boolean }) {
  return (
    <div className={`mb-3 flex flex-wrap items-center gap-2 ${enlarged ? 'text-fluid-xs' : 'text-fluid-2xs'}`}>
      <span className="font-medium text-gray-700">영업 브랜드</span>
      <span className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-900">
        청소비서
      </span>
    </div>
  );
}
