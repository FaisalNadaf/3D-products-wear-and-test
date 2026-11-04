import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BackgroundOption } from '../../config/backgrounds';
import { maskToAlpha, selfieSegmenter } from '../../lib/tracking/segmenter';

export interface CompositorHandle {
  /** the composited frame (background + person), or null when inactive */
  canvas: HTMLCanvasElement | null;
}

interface Props {
  background: BackgroundOption;
  customImage: HTMLImageElement | null;
  source: 'camera' | 'photo';
  video: HTMLVideoElement | null;
  photo: HTMLCanvasElement | null;
  width: number;
  height: number;
  onStatus?: (s: 'idle' | 'loading' | 'ready' | 'error') => void;
}

const SEG_W = 256;

/** Draws a studio sweep: soft radial light, vignette and a floor gradient. */
function paintStudio(ctx: CanvasRenderingContext2D, w: number, h: number, s: NonNullable<BackgroundOption['studio']>) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.36, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.8);
  g.addColorStop(0, s.centre);
  g.addColorStop(1, s.edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const f = ctx.createLinearGradient(0, h * 0.62, 0, h);
  f.addColorStop(0, 'rgba(0,0,0,0)');
  f.addColorStop(1, s.floor);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = f;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.globalAlpha = 1;
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/**
 * Replaces the room behind the person. Runs the selfie segmenter on a small
 * copy of each frame (cheap), feathers the mask and composites:
 *   background → person cut-out. The jewellery WebGL layer stays on top, so
 * face tracking and the 3D overlay are completely unaffected.
 */
export const BackgroundCompositor = forwardRef<CompositorHandle, Props>(function BackgroundCompositor(
  { background, customImage, source, video, photo, width, height, onStatus },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const active = background.kind !== 'original';

  useImperativeHandle(ref, () => ({ get canvas() { return active ? canvas.current : null; } }), [active]);

  // load interior images
  useEffect(() => {
    if (background.kind !== 'image' || !background.src) return setBgImage(null);
    const img = new Image();
    img.decoding = 'async';
    img.src = background.src;
    let alive = true;
    img.onload = () => alive && setBgImage(img);
    return () => {
      alive = false;
    };
  }, [background]);

  useEffect(() => {
    const out = canvas.current;
    const src: HTMLVideoElement | HTMLCanvasElement | null = source === 'camera' ? video : photo;
    if (!active || !out || !src || !width || !height) return;
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d')!;
    const segH = Math.max(1, Math.round((SEG_W * height) / width));
    const segIn = Object.assign(document.createElement('canvas'), { width: SEG_W, height: segH });
    const segCtx = segIn.getContext('2d', { willReadFrequently: true })!;
    const maskC = Object.assign(document.createElement('canvas'), { width: SEG_W, height: segH });
    const maskCtx = maskC.getContext('2d')!;
    const alpha = maskCtx.createImageData(SEG_W, segH);
    const person = Object.assign(document.createElement('canvas'), { width, height });
    const pctx = person.getContext('2d')!;
    const bgLayer = Object.assign(document.createElement('canvas'), { width, height });
    const bctx = bgLayer.getContext('2d')!;
    const prev = new Float32Array(SEG_W * segH);
    let primed = false;

    // pre-render the background once per selection
    if (background.kind === 'solid') {
      bctx.fillStyle = background.color!;
      bctx.fillRect(0, 0, width, height);
    } else if (background.kind === 'studio') paintStudio(bctx, width, height, background.studio!);
    else if (background.kind === 'image' && bgImage) drawCover(bctx, bgImage, width, height);
    else if (background.kind === 'custom' && customImage) drawCover(bctx, customImage, width, height);
    else {
      bctx.fillStyle = '#efe9df';
      bctx.fillRect(0, 0, width, height);
    }

    let alive = true;
    let handle = 0;
    let lastTs = 0;
    onStatus?.('loading');

    const frame = async () => {
      if (!alive) return;
      const ready = src instanceof HTMLVideoElement ? src.readyState >= 2 && src.videoWidth > 0 : true;
      if (ready && !document.hidden) {
        try {
          segCtx.drawImage(src, 0, 0, SEG_W, segH);
          const seg = await selfieSegmenter(source === 'camera' ? 'VIDEO' : 'IMAGE');
          if (!alive) return;
          const ts = Math.max(lastTs + 1, Math.round(performance.now()));
          lastTs = ts;
          const res = source === 'camera' ? seg.segmentForVideo(segIn, ts) : seg.segment(segIn);
          const mask = res.confidenceMasks?.[0];
          if (mask) {
            const data = mask.getAsFloat32Array();
            maskToAlpha(data, SEG_W, segH, alpha, primed && source === 'camera' ? prev : undefined);
            if (!primed) prev.set(data);
            primed = true;
            maskCtx.putImageData(alpha, 0, 0);
            res.close();
            // person cut-out: feathered, upscaled mask ∩ full-resolution frame
            pctx.globalCompositeOperation = 'copy';
            pctx.filter = 'blur(1.5px)';
            pctx.imageSmoothingQuality = 'high';
            pctx.drawImage(maskC, 0, 0, width, height);
            pctx.filter = 'none';
            pctx.globalCompositeOperation = 'source-in';
            pctx.drawImage(src, 0, 0, width, height);
            pctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(bgLayer, 0, 0);
            ctx.drawImage(person, 0, 0);
            onStatus?.('ready');
          }
        } catch (e) {
          console.error('[background] segmentation failed', e);
          onStatus?.('error');
          return;
        }
      }
      if (source === 'camera' && src instanceof HTMLVideoElement) {
        handle = 'requestVideoFrameCallback' in src ? src.requestVideoFrameCallback(() => void frame()) : requestAnimationFrame(() => void frame());
      }
    };
    void frame();
    return () => {
      alive = false;
      if (src instanceof HTMLVideoElement && 'cancelVideoFrameCallback' in src) src.cancelVideoFrameCallback(handle);
      cancelAnimationFrame(handle);
    };
  }, [active, background, bgImage, customImage, source, video, photo, width, height, onStatus]);

  if (!active) return null;
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />;
});
