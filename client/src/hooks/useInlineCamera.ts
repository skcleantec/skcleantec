import { useCallback, useEffect, useRef, useState } from 'react';

export type InlineCameraStatus = 'idle' | 'starting' | 'live' | 'error';

export function useInlineCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<InlineCameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const bindStreamToVideo = useCallback(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      void video.play().catch(() => {});
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  /** video remount·라이트박스 닫힘 후 미리보기 복구 */
  const refreshPreview = useCallback(() => {
    bindStreamToVideo();
  }, [bindStreamToVideo]);

  const setVideoElement = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current) {
        bindStreamToVideo();
      }
    },
    [bindStreamToVideo],
  );

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
        bindStreamToVideo();
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
  }, [enabled, stopStream, bindStreamToVideo]);

  useEffect(() => {
    if (!enabled || status !== 'live') return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshPreview();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, status, refreshPreview]);

  const captureFrame = useCallback(async (): Promise<File> => {
    bindStreamToVideo();
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
  }, [bindStreamToVideo]);

  return { videoRef: setVideoElement, status, error, captureFrame, refreshPreview, stopStream };
}
