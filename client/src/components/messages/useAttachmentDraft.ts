import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MESSAGE_ATTACH_MAX_IMAGES,
  MESSAGE_ATTACH_MAX_IMAGE_BYTES,
  MESSAGE_ATTACH_MAX_PDFS,
  MESSAGE_ATTACH_MAX_PDF_BYTES,
  uploadMessageAttachment,
  type MessageAttachment,
} from '../../api/messages';

export type DraftItem = {
  key: string;
  kind: 'image' | 'pdf';
  name: string;
  sizeBytes: number;
  /** 화면에 보일 작은 그림 주소 (사진만) */
  thumb: string | null;
  status: 'ready' | 'uploading' | 'done' | 'error';
  file?: File;
  attachment?: MessageAttachment;
  error?: string;
};

let seq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

function kindOf(file: File): 'image' | 'pdf' | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/.test(name)) return 'image';
  return null;
}

/** 보내기 전, 붙여 둔 사진·파일 묶음. 보낼 때 한꺼번에 올린다. */
export function useAttachmentDraft() {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const itemsRef = useRef<DraftItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.file && it.thumb) URL.revokeObjectURL(it.thumb);
    },
    [],
  );

  const addFiles = useCallback((list: FileList | File[] | null | undefined) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const cur = itemsRef.current;
    let images = cur.filter((i) => i.kind === 'image').length;
    let pdfs = cur.filter((i) => i.kind === 'pdf').length;
    const added: DraftItem[] = [];
    const skipped: string[] = [];
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind) {
        skipped.push(`${file.name}: 사진과 PDF만 붙일 수 있어요`);
        continue;
      }
      if (kind === 'image') {
        if (file.size > MESSAGE_ATTACH_MAX_IMAGE_BYTES) {
          skipped.push(`${file.name}: 사진 한 장은 25MB까지예요`);
          continue;
        }
        if (images >= MESSAGE_ATTACH_MAX_IMAGES) {
          skipped.push(`사진은 한 번에 ${MESSAGE_ATTACH_MAX_IMAGES}장까지예요`);
          break;
        }
        images += 1;
      } else {
        if (file.size > MESSAGE_ATTACH_MAX_PDF_BYTES) {
          skipped.push(`${file.name}: PDF는 20MB까지예요`);
          continue;
        }
        if (pdfs >= MESSAGE_ATTACH_MAX_PDFS) {
          skipped.push(`PDF는 한 번에 ${MESSAGE_ATTACH_MAX_PDFS}개까지예요`);
          continue;
        }
        pdfs += 1;
      }
      added.push({
        key: nextKey(),
        kind,
        name: file.name,
        sizeBytes: file.size,
        thumb: kind === 'image' ? URL.createObjectURL(file) : null,
        status: 'ready',
        file,
      });
    }
    if (added.length > 0) setItems((prev) => [...prev, ...added]);
    setNotice(skipped.length > 0 ? [...new Set(skipped)].join('\n') : null);
  }, []);

  /** 지난 공지에서 이미 올라가 있는 사진·파일을 다시 붙인다. */
  const addExisting = useCallback((list: MessageAttachment[]) => {
    setItems((prev) => {
      const have = new Set(prev.map((p) => p.attachment?.id).filter(Boolean));
      const more = list
        .filter((a) => !have.has(a.id))
        .map<DraftItem>((a) => ({
          key: nextKey(),
          kind: a.kind === 'image' ? 'image' : 'pdf',
          name: a.fileName,
          sizeBytes: a.sizeBytes,
          thumb: a.kind === 'image' ? a.thumbUrl || a.previewUrl || a.originalUrl : null,
          status: 'done',
          attachment: a,
        }));
      return [...prev, ...more];
    });
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => {
      const hit = prev.find((p) => p.key === key);
      if (hit?.file && hit.thumb) URL.revokeObjectURL(hit.thumb);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const move = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = prev.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    for (const it of itemsRef.current) if (it.file && it.thumb) URL.revokeObjectURL(it.thumb);
    setItems([]);
    setNotice(null);
  }, []);

  /** 아직 안 올라간 것을 차례로 올린다. 한 개라도 실패하면 null. 성공하면 순서대로 id 목록. */
  const uploadAll = useCallback(async (token: string): Promise<string[] | null> => {
    let failed = false;
    for (const it of itemsRef.current) {
      if (it.status === 'done' && it.attachment) continue;
      if (!it.file) continue;
      setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, status: 'uploading', error: undefined } : p)));
      try {
        const attachment = await uploadMessageAttachment(token, it.file);
        setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, status: 'done', attachment } : p)));
        itemsRef.current = itemsRef.current.map((p) => (p.key === it.key ? { ...p, status: 'done', attachment } : p));
      } catch (err) {
        failed = true;
        const error = err instanceof Error ? err.message : '올리지 못했습니다.';
        setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, status: 'error', error } : p)));
        itemsRef.current = itemsRef.current.map((p) => (p.key === it.key ? { ...p, status: 'error', error } : p));
      }
    }
    if (failed) return null;
    return itemsRef.current.map((p) => p.attachment?.id).filter((id): id is string => Boolean(id));
  }, []);

  const imageCount = items.filter((i) => i.kind === 'image').length;
  const fileCount = items.length - imageCount;

  return { items, imageCount, fileCount, notice, setNotice, addFiles, addExisting, remove, move, clear, uploadAll };
}

export type AttachmentDraft = ReturnType<typeof useAttachmentDraft>;

/** 붙여넣기·끌어다 놓기에서 파일만 꺼낸다. */
export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  if (dt.files && dt.files.length > 0) return Array.from(dt.files);
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}
