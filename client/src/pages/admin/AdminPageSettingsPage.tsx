import { useState, useEffect } from 'react';
import { dispatchCelebrateBarTest } from '../../utils/adminCelebrateBarTest';
import {
  CELEBRATE_BAR_PLACEHOLDER_HELP,
  DEFAULT_CELEBRATE_TPL_INQUIRY,
  DEFAULT_CELEBRATE_TPL_ORDER,
  clearCelebrateBarTemplates,
  getCelebrateBarTemplates,
  setCelebrateBarTemplates,
} from '../../utils/adminCelebrateBarConfig';

/**
 * 관리자설정 → 페이지 설정
 * 접수 축하 상단 바 문구는 브라우저(localStorage)에 저장된다.
 */
export function AdminPageSettingsPage() {
  const [tplOrder, setTplOrder] = useState(DEFAULT_CELEBRATE_TPL_ORDER);
  const [tplInquiry, setTplInquiry] = useState(DEFAULT_CELEBRATE_TPL_INQUIRY);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const { orderForm, inquiry } = getCelebrateBarTemplates();
    setTplOrder(orderForm);
    setTplInquiry(inquiry);
  }, []);

  const handleSave = () => {
    setCelebrateBarTemplates(tplOrder, tplInquiry);
    setSavedMsg('저장했습니다. 실제 접수·발주서 알림에도 이 문구가 적용됩니다.');
    window.setTimeout(() => setSavedMsg(null), 4000);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('문구를 초기 기본값으로 되돌릴까요?')) return;
    clearCelebrateBarTemplates();
    setTplOrder(DEFAULT_CELEBRATE_TPL_ORDER);
    setTplInquiry(DEFAULT_CELEBRATE_TPL_INQUIRY);
    setSavedMsg('기본값으로 되돌렸습니다.');
    window.setTimeout(() => setSavedMsg(null), 4000);
  };

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">페이지 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          이 브라우저에만 저장됩니다. 다른 PC·시크릿 창에서는 따로 설정해야 합니다.
        </p>
      </div>

      {savedMsg && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2" role="status">
          {savedMsg}
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">접수 축하 상단 바</h2>
        <p className="text-xs text-gray-500 leading-relaxed">{CELEBRATE_BAR_PLACEHOLDER_HELP}</p>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">
            발주서·발주 관련 출처일 때
            <span className="block text-xs font-normal text-gray-500 mt-0.5">
              출처에 「발주」가 포함되면 이 문구를 씁니다.
            </span>
          </label>
          <textarea
            value={tplOrder}
            onChange={(e) => setTplOrder(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-mono"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-800">
            그 외 접수일 때
            <span className="block text-xs font-normal text-gray-500 mt-0.5">
              일반 접수 알림에 사용합니다.
            </span>
          </label>
          <textarea
            value={tplInquiry}
            onChange={(e) => setTplInquiry(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 font-mono"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900"
          >
            저장
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            기본값으로 되돌리기
          </button>
          <button
            type="button"
            onClick={() => dispatchCelebrateBarTest()}
            className="px-4 py-2 rounded-md border border-amber-500 bg-amber-50 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            미리보기
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-2">미리보기 안내</h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          「미리보기」는 데모 접수 데이터로 상단 바만 잠시 띄웁니다. 저장한 문구가 반영되는지 확인한 뒤 닫을 수
          있습니다.
        </p>
      </section>
    </div>
  );
}
