import { useEffect, useMemo, useSyncExternalStore, type RefObject } from 'react';
import { TrackingEngine } from '../../lib/tracking/TrackingEngine';

/** Creates the tracking engine once and exposes its React-friendly status. */
export function useFaceTracker() {
  const engine = useMemo(() => new TrackingEngine(), []);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  useEffect(() => () => engine.stop(), [engine]);
  return { engine, snapshot };
}

interface Props {
  engine: TrackingEngine;
  video: RefObject<HTMLVideoElement | null>;
  /** true once the camera stream is playing */
  active: boolean;
  needsBody: boolean;
}

/**
 * Headless component: runs MediaPipe face (and, when a necklace is worn,
 * pose) landmarking on every new camera frame while active. Results go into
 * the engine's mutable pose state, read directly by the 3D renderer, so
 * tracking never triggers React re-renders.
 */
export function FaceTracker({ engine, video, active, needsBody }: Props) {
  useEffect(() => {
    engine.needsBody = needsBody;
  }, [engine, needsBody]);

  useEffect(() => {
    const v = video.current;
    if (!active || !v) return;
    void engine.startVideo(v).catch((e) => console.error('[tracking] failed to start', e));
    return () => engine.stop();
  }, [active, engine, video]);

  // pause inference while the tab is hidden (the loop also checks document.hidden)
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && active) engine.reset();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active, engine]);

  return null;
}
