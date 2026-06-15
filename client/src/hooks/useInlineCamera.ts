import { useCallback, useEffect, useRef, useState } from 'react';

export type InlineCameraStatus = 'idle' | 'starting' | 'live' | 'error';

export function useInlineCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<InlineCameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopStream();
      setStatus('idle');
      setError(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('이 기기·브라우저에서는 앱 내 카메라를 사용할 수 없습니다.');
      return;
    }

    let cancelled = false;
    setStatus('starting');
    setError(null);

    void navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => {});
        }
        setStatus('live');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : '카메라를 열 수 없습니다. 권한을 확인해 주세요.');
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [enabled, stopStream]);

  const captureFrame = useCallback(async (): Promise<File> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('카메라 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('촬영에 실패했습니다.');
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
    if (!blob) throw new Error('촬영에 실패했습니다.');
    return new File([blob], `preclean-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }, []);

  return { videoRef, status, error, captureFrame, stopStream };
}
