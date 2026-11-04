import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { productNeedsBody, productsIn, type CategoryId, type Product } from '../../config/catalog';
import { MODELS } from '../../config/models';
import { useCamera } from '../../hooks/useCamera';
import { useAmbientLight } from '../../hooks/useAmbientLight';
import { useFullscreen } from '../../hooks/useFullscreen';
import { fitMedia, useElementSize } from '../../hooks/useElementSize';
import type { Fit } from '../../lib/three/JewelStage';
import { preloadModels } from '../../lib/three/modelLoader';
import { CameraPreview } from './CameraPreview';
import { decodePhoto, PhotoUploader, type PhotoData, type PhotoUploaderHandle } from './PhotoUploader';
import { FaceTracker, useFaceTracker } from './FaceTracker';
import type { RendererHandle } from './JewelleryRenderer';
import { TryOnControls } from './TryOnControls';
import { TrackingOverlay } from './TrackingOverlay';
import { IdleState } from './IdleState';
import { CapturePreview, type CaptureResult } from './CapturePreview';
import { ConsentDialog, hasCameraConsent, rememberCameraConsent } from './ConsentDialog';
import { CategoryTabs } from '../catalog/JewellerySelector';
import { BackgroundCompositor, type CompositorHandle } from './BackgroundCompositor';
import { BackgroundPanel } from './BackgroundPanel';
import { findBackground, type BackgroundOption } from '../../config/backgrounds';
import { JewelleryCard } from '../catalog/JewelleryCard';

// the WebGL layer (three + R3F + drei) streams in on first use
const JewelleryRenderer = lazy(() => import('./JewelleryRenderer').then((m) => ({ default: m.JewelleryRenderer })));

type Source = 'none' | 'camera' | 'photo';

interface Props {
  product: Product;
  category: CategoryId;
  onProduct: (p: Product) => void;
  onCategory: (c: CategoryId) => void;
  onSourceChange?: (s: Source) => void;
}

const DEFAULT_FIT: Fit = { scale: 1, lift: 0 };

/**
 * Orchestrates the try-on: camera/photo source, tracking, 3D overlay,
 * controls, capture and fullscreen. Product state lives in the parent so the
 * selector panel and the stage stay in sync.
 */
export function VirtualTryOn({ product, category, onProduct, onCategory, onSourceChange }: Props) {
  const { engine, snapshot } = useFaceTracker();
  const camera = useCamera();
  const uploader = useRef<PhotoUploaderHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);
  const renderer = useRef<RendererHandle | null>(null);
  const fs = useFullscreen(stageRef);
  const box = useElementSize(boxRef);

  const [source, setSource] = useState<Source>('none');
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [fit, setFit] = useState<Fit>(DEFAULT_FIT);
  const [fitOpen, setFitOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(0);
  const [loadingModel, setLoadingModel] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [earHint, setEarHint] = useState(false);
  const [videoDims, setVideoDims] = useState({ width: 1280, height: 720 });
  // presentation background (person segmentation)
  const compositor = useRef<CompositorHandle>(null);
  const [bgId, setBgId] = useState('original');
  const [bgOpen, setBgOpen] = useState(false);
  const [bgStatus, setBgStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [customBg, setCustomBg] = useState<{ url: string; img: HTMLImageElement } | null>(null);
  const background = useMemo<BackgroundOption>(
    () => (bgId === 'custom' && customBg ? { id: 'custom', label: 'Uploaded', kind: 'custom', group: 'Yours', preview: '' } : findBackground(bgId)),
    [bgId, customBg],
  );
  const onBgUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCustomBg((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url, img };
      });
      setBgId('custom');
    };
    img.src = url;
  }, []);

  const needsBody = productNeedsBody(product);
  const live = source === 'camera' && camera.state.status === 'live';
  const ambient = useAmbientLight(source === 'camera' ? camera.videoRef : photoImgRef, source !== 'none');

  useEffect(() => onSourceChange?.(source), [source, onSourceChange]);

  // warm the tracker + the first products while the user reads the page
  useEffect(() => {
    const id = window.setTimeout(() => {
      void engine.warmUp().catch(() => undefined);
      preloadModels(productsIn(category).slice(0, 3).flatMap((p) => p.pieces));
    }, 600);
    return () => window.clearTimeout(id);
  }, [engine, category]);

  // one-time hint for earrings
  useEffect(() => {
    if (!product.pieces.some((m) => MODELS[m].anchor === 'ear') || source !== 'camera') return;
    setEarHint(true);
    const id = window.setTimeout(() => setEarHint(false), 4500);
    return () => window.clearTimeout(id);
  }, [product, source]);

  // track the real stream resolution (phones may rotate it)
  useEffect(() => {
    const v = camera.videoRef.current;
    if (!v) return;
    const update = () => v.videoWidth && setVideoDims({ width: v.videoWidth, height: v.videoHeight });
    v.addEventListener('loadedmetadata', update);
    v.addEventListener('resize', update);
    return () => {
      v.removeEventListener('loadedmetadata', update);
      v.removeEventListener('resize', update);
    };
  }, [camera.videoRef]);

  /* ------------------------------------------------------------ sources */

  const startCamera = useCallback(async () => {
    setPhotoError(null);
    setPhoto((p) => {
      if (p) URL.revokeObjectURL(p.url);
      return null;
    });
    engine.clear();
    setSource('camera');
    const ok = await camera.start();
    if (!ok) setSource('none');
  }, [camera, engine]);

  const requestCamera = useCallback(() => {
    if (hasCameraConsent()) void startCamera();
    else setConsentOpen(true);
  }, [startCamera]);

  const stopCamera = useCallback(() => {
    engine.clear();
    camera.stop();
    setSource('none');
  }, [camera, engine]);

  const handlePhoto = useCallback(
    async (file: File) => {
      setPhotoError(null);
      try {
        const data = await decodePhoto(file);
        if (source === 'camera') camera.stop();
        engine.clear();
        setPhoto((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return data;
        });
        setSource('photo');
        setFit(DEFAULT_FIT);
        await engine.processImage(data.canvas, data.width, data.height);
      } catch (e) {
        setPhotoError((e as Error).message || 'That photo could not be processed.');
        if (source !== 'camera') setSource('none');
      }
    },
    [camera, engine, source],
  );

  // release the object URL when the component goes away
  const photoRef = useRef(photo);
  photoRef.current = photo;
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    },
    [],
  );

  /* ------------------------------------------------------------ actions */

  const switchJewellery = useCallback(() => {
    const list = productsIn(product.category);
    const i = list.findIndex((p) => p.id === product.id);
    onProduct(list[(i + 1) % list.length]);
  }, [product, onProduct]);

  const reset = useCallback(() => {
    setFit(DEFAULT_FIT);
    setFitOpen(false);
    engine.reset();
    if (source === 'photo' && photo) void engine.processImage(photo.canvas, photo.width, photo.height);
  }, [engine, source, photo]);

  const media = source === 'photo' && photo ? { width: photo.width, height: photo.height } : videoDims;
  const fitMode = source === 'photo' ? 'contain' : 'cover';
  const layer = fitMedia(box, media, fitMode);
  const mirrored = source === 'camera';

  const takeCapture = useCallback(async () => {
    const r = renderer.current;
    const el = source === 'camera' ? camera.videoRef.current : photo?.canvas;
    if (!r || !el) return;
    setCapturing(true);
    setFlash((f) => f + 1);
    try {
      const W = media.width;
      const H = media.height;
      const k = Math.min(2, Math.max(1, 1920 / Math.max(W, H)));
      const fw = Math.round(W * k);
      const fh = Math.round(H * k);
      // freeze the current video frame first so photo and jewellery match exactly
      const frame = document.createElement('canvas');
      frame.width = fw;
      frame.height = fh;
      const fctx = frame.getContext('2d')!;
      fctx.imageSmoothingQuality = 'high';
      // with a replaced background, capture the composited frame instead of the raw feed
      fctx.drawImage(compositor.current?.canvas ?? el, 0, 0, fw, fh);
      const overlay = r.capture(fw, fh);

      // crop to what is visible on screen (cover mode crops the sides)
      const cw = Math.min(1, box.width / layer.width);
      const ch = Math.min(1, box.height / layer.height);
      const ow = Math.round(fw * cw);
      const oh = Math.round(fh * ch);
      const ox = Math.round((fw - ow) / 2);
      const oy = Math.round((fh - oh) / 2);
      const out = document.createElement('canvas');
      out.width = ow;
      out.height = oh;
      const ctx = out.getContext('2d')!;
      ctx.save();
      if (mirrored) {
        ctx.translate(ow, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(frame, ox, oy, ow, oh, 0, 0, ow, oh);
      ctx.drawImage(overlay, ox, oy, ow, oh, 0, 0, ow, oh);
      ctx.restore();
      drawWatermark(ctx, ow, oh, product.name);

      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Capture failed');
      setCapture((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return {
          blob,
          url: URL.createObjectURL(blob),
          width: ow,
          height: oh,
          productName: product.name,
          fileName: `suvarna-try-on-${product.id}-${Date.now()}.png`,
        };
      });
    } catch (e) {
      console.error('[capture]', e);
    } finally {
      setCapturing(false);
    }
  }, [source, camera.videoRef, photo, media.width, media.height, box.width, box.height, layer.width, layer.height, mirrored, product]);

  const closeCapture = useCallback(() => {
    setCapture((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  /* ---------------------------------------------------------- drag & drop */

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        setDragging(true);
      }
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handlePhoto(f);
    },
  };

  const showStage = source !== 'none' && (source === 'photo' || camera.state.status === 'live');
  const loadingLabel = loadingModel ? `Loading ${product.name}…` : null;
  const onModelLoading = useCallback((l: boolean) => setLoadingModel(l), []);
  const onReady = useCallback((h: RendererHandle) => (renderer.current = h), []);
  const fitMemo = useMemo(() => fit, [fit]);

  const controls = (placement: 'overlay' | 'dock') => (
    <TryOnControls
      placement={placement}
      source={source === 'photo' ? 'photo' : 'camera'}
      canCapture={snapshot.faceVisible || source === 'photo'}
      capturing={capturing}
      isFullscreen={fs.isFullscreen}
      fit={fit}
      fitOpen={fitOpen}
      onFitOpen={(o: boolean) => {
        setFitOpen(o);
        if (o) setBgOpen(false);
      }}
      onFit={setFit}
      onStartCamera={requestCamera}
      onStopCamera={stopCamera}
      onUpload={() => uploader.current?.open()}
      onCapture={takeCapture}
      onSwitch={switchJewellery}
      onReset={reset}
      onFullscreen={fs.toggle}
      bgActive={bgId !== 'original'}
      bgOpen={bgOpen}
      onBackground={() => {
        setBgOpen((o) => !o);
        setFitOpen(false);
      }}
    />
  );

  return (
    <div
      ref={stageRef}
      className={`relative overflow-hidden bg-pearl ${
        fs.isFullscreen ? (fs.pseudo ? 'fixed inset-0 z-[55]' : 'h-full w-full') : 'rounded-xl border border-line shadow-lift'
      }`}
      {...dropHandlers}
    >
      <div
        ref={boxRef}
        className={`relative w-full ${
          fs.isFullscreen ? 'h-[100dvh]' : 'aspect-[3/4] max-h-[72vh] sm:aspect-[4/3] lg:aspect-auto lg:h-[min(70vh,640px)]'
        }`}
      >
        {/* blurred backdrop for letterboxed photos */}
        {source === 'photo' && photo && (
          <img src={photo.url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
        )}

        {/* media layer: video/photo + WebGL share one box so 3D lines up exactly */}
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: layer.width,
            height: layer.height,
            transform: `translate(-50%, -50%) ${mirrored ? 'scaleX(-1)' : ''}`,
          }}
        >
          <CameraPreview ref={camera.videoRef} visible={source === 'camera' && live} />
          {source === 'photo' && photo && (
            <img ref={photoImgRef} src={photo.url} alt="Your uploaded photo" className="absolute inset-0 h-full w-full" draggable={false} />
          )}
          {showStage && (
            <BackgroundCompositor
              ref={compositor}
              background={background}
              customImage={customBg?.img ?? null}
              source={source === 'photo' ? 'photo' : 'camera'}
              video={camera.videoRef.current}
              photo={photo?.canvas ?? null}
              width={media.width}
              height={media.height}
              onStatus={setBgStatus}
            />
          )}
          {showStage && (
            <Suspense fallback={null}>
            <JewelleryRenderer
              engine={engine}
              product={product}
              mode={source === 'photo' ? 'photo' : 'live'}
              fit={fitMemo}
              ambient={ambient}
              onReady={onReady}
              onModelLoading={onModelLoading}
            />
            </Suspense>
          )}
        </div>

        {!showStage && (
          <IdleState
            requesting={camera.state.status === 'requesting'}
            error={camera.state.status === 'error' ? camera.state.error : undefined}
            photoError={photoError}
            dragging={dragging}
            onCamera={requestCamera}
            onUpload={() => uploader.current?.open()}
          />
        )}

        {showStage && (
          <>
            <TrackingOverlay
              overlayControls={fs.isFullscreen}
              snapshot={snapshot}
              source={source === 'photo' ? 'photo' : 'camera'}
              needsBody={needsBody}
              earHint={earHint}
              modelLoading={loadingLabel}
            />
            {fs.isFullscreen && controls('overlay')}
            <BackgroundPanel
              open={bgOpen}
              value={bgId}
              customUrl={customBg?.url ?? null}
              status={bgStatus}
              onChange={setBgId}
              onUpload={onBgUpload}
              onClose={() => setBgOpen(false)}
            />
            {fs.isFullscreen && (
              <div className="glass absolute inset-x-3 bottom-[92px] z-20 mx-auto max-w-3xl space-y-2 rounded-3xl p-2.5 sm:bottom-24">
                <CategoryTabs value={category} onChange={onCategory} />
                <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                  {productsIn(category).map((p) => (
                    <JewelleryCard key={p.id} product={p} selected={p.id === product.id} onTryOn={onProduct} variant="compact" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* shutter flash */}
        <AnimatePresence>
          {flash > 0 && capturing && (
            <motion.div
              key={flash}
              className="pointer-events-none absolute inset-0 z-40 bg-white"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            />
          )}
        </AnimatePresence>
      </div>

      {showStage && !fs.isFullscreen && controls('dock')}

      <FaceTracker engine={engine} video={camera.videoRef} active={live} needsBody={needsBody} />
      <PhotoUploader ref={uploader} onPhoto={handlePhoto} />
      <ConsentDialog
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onAllow={() => {
          rememberCameraConsent();
          setConsentOpen(false);
          void startCamera();
        }}
      />
      <CapturePreview
        capture={capture}
        onClose={closeCapture}
        onRetake={() => {
          closeCapture();
          if (source === 'camera' && !live) requestCamera();
        }}
      />
    </div>
  );
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, productName: string) {
  const pad = Math.round(w * 0.03);
  const size = Math.max(14, Math.round(w * 0.018));
  const grad = ctx.createLinearGradient(0, h - size * 5, 0, h);
  grad.addColorStop(0, 'rgba(20,15,10,0)');
  grad.addColorStop(1, 'rgba(20,15,10,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - size * 5, w, size * 5);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f3e6c8';
  ctx.font = `600 ${Math.round(size * 1.25)}px "Cormorant Garamond Variable", Georgia, serif`;
  ctx.fillText('SUVARNA', pad, h - pad - size * 1.2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 ${size * 0.8}px "Manrope Variable", system-ui, sans-serif`;
  ctx.fillText(`Wearing ${productName} · Virtual Try-On`, pad, h - pad);
}
