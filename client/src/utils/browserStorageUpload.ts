import { isHttpsHostedImageUrl, storedPublicIdHasFolder } from '@shared/storedObjectUrl';

export async function postBlobToStorage(opts: {
  url: string;
  blob: Blob;
  filename: string;
  headers?: Record<string, string>;
  folderPrefix?: string;
}): Promise<{ publicId: string; secureUrl: string }> {
  const fd = new FormData();
  fd.append('file', opts.blob, opts.filename);
  const res = await fetch(opts.url, {
    method: 'POST',
    headers: opts.headers,
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as {
    publicId?: string;
    secureUrl?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || '파일 업로드에 실패했습니다.');
  const publicId = typeof data.publicId === 'string' ? data.publicId : '';
  const secureUrl = typeof data.secureUrl === 'string' ? data.secureUrl : '';
  if (!publicId || !secureUrl || !isHttpsHostedImageUrl(secureUrl)) {
    throw new Error('업로드 결과가 규격에 맞지 않습니다.');
  }
  if (opts.folderPrefix && !storedPublicIdHasFolder(publicId, opts.folderPrefix)) {
    throw new Error('업로드 결과가 규격에 맞지 않습니다.');
  }
  return { publicId, secureUrl };
}
