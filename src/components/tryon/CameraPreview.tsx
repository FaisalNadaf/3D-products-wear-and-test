import { forwardRef } from 'react';

/** The live <video> element. Always mounted so the stream can attach instantly. */
export const CameraPreview = forwardRef<HTMLVideoElement, { visible: boolean }>(function CameraPreview({ visible }, ref) {
  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-fill transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      playsInline
      muted
      autoPlay
      disablePictureInPicture
      aria-label="Live camera preview"
    />
  );
});
