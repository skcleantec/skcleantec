import type { Dispatch, SetStateAction } from 'react';
import { AdminScheduleDetailSection } from './AdminScheduleDetailSection';
import { AREA_BASIS_EDIT, PROPERTY_TYPE_EDIT } from './inquiryEditConstants';
import {
  inqEditInput,
  inqEditInputCompact,
  inqEditLabel,
  inqEditLabelCompact,
  inqEditPropertyAreaRow,
  inqEditRoomGrid,
} from './inquiryEditFormClasses';
import type { InquiryEditFormFields } from './inquiryEditTypes';

type Props = {
  editForm: InquiryEditFormFields;
  setEditForm: Dispatch<SetStateAction<InquiryEditFormFields>>;
  skOpsUi: boolean;
  oneRoomLabel: string;
};

export function InquiryEditPropertySection({ editForm, setEditForm, skOpsUi, oneRoomLabel }: Props) {
  return (
    <AdminScheduleDetailSection title="유형 · 면적 · 방·주방" sectionAnchor="property">
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-fluid-2xs text-gray-800">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={editForm.isOneRoom}
            onChange={(e) => setEditForm((p) => ({ ...p, isOneRoom: e.target.checked }))}
          />
          {skOpsUi
            ? oneRoomLabel
            : '원룸 (체크 시 고객 발주서 특이사항에 「에어컨,냉장고,세탁기 포함」 반영)'}
        </label>
        <div className={inqEditPropertyAreaRow}>
          <div>
            <label className={inqEditLabel}>건축물 유형</label>
            <select
              value={editForm.propertyType}
              onChange={(e) => setEditForm((p) => ({ ...p, propertyType: e.target.value }))}
              className={inqEditInput}
            >
              <option value="">선택</option>
              {PROPERTY_TYPE_EDIT.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={inqEditLabel}>면적 기준</label>
            <select
              value={editForm.areaBasis}
              onChange={(e) => {
                const v = e.target.value;
                setEditForm((p) => ({
                  ...p,
                  areaBasis: v,
                  exclusiveAreaSqm: v === '공급' || v === '전용' ? '' : p.exclusiveAreaSqm,
                  areaPyeong:
                    v === '공급' || v === '전용'
                      ? v === p.areaBasis
                        ? p.areaPyeong
                        : ''
                      : p.areaPyeong,
                }));
              }}
              className={inqEditInput}
            >
              <option value="">선택</option>
              {AREA_BASIS_EDIT.map((v) => (
                <option key={v} value={v}>
                  {v === '공급' ? '공급면적 (분양평수)' : '전용면적 (실제 내 집 공간)'}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={inqEditLabel}>
              {editForm.areaBasis === '공급'
                ? '분양평수 (평)'
                : editForm.areaBasis === '전용'
                  ? '전용면적 (평)'
                  : '평수 (평)'}
            </label>
            <input
              value={editForm.areaPyeong}
              onChange={(e) => setEditForm((p) => ({ ...p, areaPyeong: e.target.value }))}
              className={inqEditInput}
              placeholder={
                editForm.areaBasis === '공급' ? '32' : editForm.areaBasis === '전용' ? '25.5' : undefined
              }
              inputMode="decimal"
            />
          </div>
        </div>
        <div className={inqEditRoomGrid}>
          <div>
            <label className={inqEditLabelCompact}>방</label>
            <input
              type="number"
              min={0}
              value={editForm.roomCount}
              onChange={(e) => setEditForm((p) => ({ ...p, roomCount: e.target.value }))}
              className={inqEditInputCompact}
            />
          </div>
          <div>
            <label className={inqEditLabelCompact}>화</label>
            <input
              type="number"
              min={0}
              value={editForm.bathroomCount}
              onChange={(e) => setEditForm((p) => ({ ...p, bathroomCount: e.target.value }))}
              className={inqEditInputCompact}
            />
          </div>
          <div>
            <label className={inqEditLabelCompact}>베</label>
            <input
              type="number"
              min={0}
              value={editForm.balconyCount}
              onChange={(e) => setEditForm((p) => ({ ...p, balconyCount: e.target.value }))}
              className={inqEditInputCompact}
            />
          </div>
          <div>
            <label className={inqEditLabelCompact}>주방</label>
            <input
              type="number"
              min={0}
              value={editForm.kitchenCount}
              onChange={(e) => setEditForm((p) => ({ ...p, kitchenCount: e.target.value }))}
              className={inqEditInputCompact}
              placeholder="비움"
            />
          </div>
        </div>
      </div>
    </AdminScheduleDetailSection>
  );
}
