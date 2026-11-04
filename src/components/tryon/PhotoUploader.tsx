import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface PhotoData {
  canvas: HTMLCanvasElement;
  url: string;
  width: number;
  height: number;
  name: string;
}

export interface PhotoUploaderHandle {
  open: () => void;
}

const MAX_SIDE = 1800;
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Reads a local image (never uploaded), honours EXIF orientation, and
 * downsamples very large photos so detection and rendering stay fast.
 */
export async function decodePhoto(file: File): Promise<PhotoData> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP or HEIC).');
  if (file.size > MAX_BYTES) throw new Error('That image is larger than 25 MB. Please choose a smaller photo.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format could not be read by your browser. Try a JPG or PNG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.94));
  const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg', 0.94);
  return { canvas, url, width, height, name: file.name };
}

interface Props {
  onPhoto: (file: File) => void;
}

/** Hidden file input opened by any "Upload photo" button. */
export const PhotoUploader = forwardRef<PhotoUploaderHandle, Props>(function PhotoUploader({ onPhoto }, ref) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ open: () => input.current?.click() }), []);
  return (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onPhoto(f);
        e.target.value = '';
      }}
    />
  );
});
