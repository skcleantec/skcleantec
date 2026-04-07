import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CleaningPhotoItem,
  type CleaningPhotoPhase,
  deleteAdminCleaningPhoto,
  deleteTeamCleaningPhoto,
  listAdminCleaningPhotos,
  listTeamCleaningPhotos,
  uploadAdminCleaningPhoto,
  uploadTeamCleaningPhoto,
} from '../../api/inquiryCleaningPhotos';
import { ConfirmPasswordModal } from '../admin/ConfirmPasswordModal';
import { parseJwtPayload } from '../../utils/jwtPayload';

const PHASE_LABEL: Record<CleaningPhotoPhase, string> = {
  BEFORE: '청소 전',
  AFTER: '청소 후',
};

type Props = {
  inquiryId: string;
  variant: 'team' | 'admin';
  token: string;
  /** 팀장 상세 상단 카드 안에 넣을 때: 바깥 제목과 겹치지 않게 구분선·소제목 정리 */
  embedded?: boolean;
};

export function InquiryCleaningPhotosPanel({ inquiryId, variant, token, embedded = false }: Props) {
  const teamUserId =
    variant === 'team' ? parseJwtPayload<{ userId?: string }>(token)?.userId ?? null : null;

  const [items, setItems] = useState<CleaningPhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<CleaningPhotoPhase>('BEFORE');
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CleaningPhotoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res =
        variant === 'team'
          ? await listTeamCleaningPhotos(token, inquiryId)
          : await listAdminCleaningPhotos(token, inquiryId);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 목록을 불러올 수 없습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res =
        variant === 'team'
          ? await uploadTeamCleaningPhoto(token, inquiryId, file, uploadPhase)
          : await uploadAdminCleaningPhoto(token, inquiryId, file, uploadPhase);
      setItems((prev) => [res.item, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTeam = async (photo: CleaningPhotoItem) => {
    if (!window.confirm('이 사진을 삭제할까요?')) return;
    setError(null);
    try {
      await deleteTeamCleaningPhoto(token, inquiryId, photo.id);
      setItems((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const handleDeleteAdmin = async (password: string) => {
    if (!deleteTarget) return;
    await deleteAdminCleaningPhoto(token, inquiryId, deleteTarget.id, password);
    setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const byPhase = (phase: CleaningPhotoPhase) => items.filter((p) => p.phase === phase);

  const wrapClass = embedded
    ? 'min-w-0'
    : 'border-t border-gray-100 pt-3 mt-1 min-w-0';

  return (
    <div className={wrapClass}>
      {!embedded && (
        <span className="text-gray-500 block text-fluid-xs mb-2">청소 전·후 사진</span>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end mb-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-fluid-xs text-gray-600 shrink-0">구분</span>
          <select
            value={uploadPhase}
            onChange={(e) => setUploadPhase(e.target.value as CleaningPhotoPhase)}
            className="border border-gray-300 rounded px-2 py-2 text-fluid-sm min-w-0 flex-1 sm:flex-initial"
            disabled={uploading}
          >
            <option value="BEFORE">{PHASE_LABEL.BEFORE}</option>
            <option value="AFTER">{PHASE_LABEL.AFTER}</option>
          </select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            void handleFile(f);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={
            variant === 'team'
              ? 'w-full sm:w-auto min-h-[48px] touch-manipulation rounded-lg bg-blue-600 px-4 text-fluid-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 active:bg-blue-800'
              : 'w-full sm:w-auto min-h-[44px] touch-manipulation rounded-lg border border-gray-300 bg-white px-4 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50'
          }
        >
          {uploading ? '업로드 중…' : '사진 올리기 (카메라·갤러리)'}
        </button>
      </div>

      {error && <p className="text-fluid-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-fluid-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="space-y-4">
          {(['BEFORE', 'AFTER'] as const).map((phase) => {
            const list = byPhase(phase);
            return (
              <div key={phase} className="min-w-0">
                <p className="text-fluid-xs font-medium text-gray-700 mb-2">{PHASE_LABEL[phase]}</p>
                {list.length === 0 ? (
                  <p className="text-fluid-sm text-gray-400">등록된 사진이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {list.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 min-w-0"
                      >
                        <img
                          src={photo.secureUrl}
                          alt=""
                          className="w-full h-32 object-cover"
                          loading="lazy"
                        />
                        <div className="p-1.5 text-fluid-xs text-gray-600 truncate" title={photo.uploadedBy.name}>
                          {photo.uploadedBy.name}
                        </div>
                        {variant === 'team' &&
                        (teamUserId == null || teamUserId === photo.uploadedBy.id) ? (
                          <button
                            type="button"
                            className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/55 text-white text-fluid-xs hover:bg-black/70"
                            onClick={() => void handleDeleteTeam(photo)}
                          >
                            삭제
                          </button>
                        ) : variant === 'admin' ? (
                          <button
                            type="button"
                            className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/55 text-white text-fluid-xs hover:bg-black/70"
                            onClick={() => setDeleteTarget(photo)}
                          >
                            삭제
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {variant === 'admin' && (
        <ConfirmPasswordModal
          open={deleteTarget != null}
          title="청소 사진 삭제"
          confirmLabel="삭제"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteAdmin}
        />
      )}
    </div>
  );
}
