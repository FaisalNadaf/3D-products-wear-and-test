import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorKind = 'denied' | 'not-found' | 'busy' | 'insecure' | 'unsupported' | 'ended' | 'unknown';

export interface CameraState {
  status: 'idle' | 'requesting' | 'live' | 'error';
  error?: CameraErrorKind;
}

export const CAMERA_ERROR_COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  denied: {
    title: 'Camera access is blocked',
    body: 'Allow camera access from the lock or camera icon in your browser address bar, then try again. You can also upload a photo instead.',
  },
  'not-found': {
    title: 'No camera found',
    body: 'We could not find a camera on this device. Connect one, or upload a photo to try jewellery on.',
  },
  busy: {
    title: 'Camera is in use',
    body: 'Another app or tab is using your camera. Close it and try again.',
  },
  insecure: {
    title: 'Secure connection required',
    body: 'Browsers only allow camera access on secure (https) pages. Open this page over https or on localhost.',
  },
  unsupported: {
    title: 'Camera not supported',
    body: 'This browser does not support live camera access. Try the latest Chrome, Safari, Edge or Firefox, or upload a photo.',
  },
  ended: {
    title: 'Camera disconnected',
    body: 'The camera stream stopped unexpectedly. Start it again to continue.',
  },
  unknown: {
    title: 'Could not start the camera',
    body: 'Something went wrong while starting the camera. Please try again.',
  },
};

function classify(err: unknown): CameraErrorKind {
  const name = (err as DOMException)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy';
    default:
      return 'unknown';
  }
}

/**
 * Owns the webcam stream lifecycle: permission request, constraint fallback,
 * device-loss detection and guaranteed track shutdown on stop/unmount/pagehide.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({ status: 'idle' });

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    release();
    setState({ status: 'idle' });
  }, [release]);

  const start = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setState({ status: 'error', error: 'insecure' });
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: 'error', error: 'unsupported' });
      return false;
    }
    release();
    setState({ status: 'requesting' });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
      });
    } catch (err) {
      if ((err as DOMException)?.name === 'OverconstrainedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err2) {
          setState({ status: 'error', error: classify(err2) });
          return false;
        }
      } else {
        setState({ status: 'error', error: classify(err) });
        return false;
      }
    }
    streamRef.current = stream;
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (streamRef.current === stream) {
        release();
        setState({ status: 'error', error: 'ended' });
      }
    });
    const v = videoRef.current;
    if (!v) {
      release();
      setState({ status: 'idle' });
      return false;
    }
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    try {
      await v.play();
    } catch {
      // autoplay policies: muted inline video should always play, but retry once metadata is ready
      await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
      await v.play().catch(() => undefined);
    }
    if (!v.videoWidth) await new Promise((r) => v.addEventListener('loadeddata', r, { once: true }));
    setState({ status: 'live' });
    return true;
  }, [release]);

  // never leave the camera running when the page goes away
  useEffect(() => {
    const onHide = () => release();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      release();
    };
  }, [release]);

  return { videoRef, state, start, stop };
}
