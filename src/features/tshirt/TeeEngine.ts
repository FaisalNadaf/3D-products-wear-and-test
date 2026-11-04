import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Design, Fabric, Layer, Side, Zone } from './design';
import { creaseTexture, knitTextures, stitchTexture, type KnitId } from './garment/fabric';
import { buildGarment, fetchDrape, H, styleKey, W, type Build, type Part } from './garment/mesh';

/*
 * 3D tee engine. The garment is a real draped pattern: flat panels sewn and
 * simulated offline (scripts/garment), loaded per style and morphed between.
 * Prints live on transparent canvases mapped through the flat pattern, so they
 * follow the cloth at true size; the fabric is a separate tiling knit, so the
 * colour changes without touching any texture.
 */
export { W, H };

export const VIEWS = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] } as const;
export type View = keyof typeof VIEWS;

type SurfaceKind = 'body' | 'sleeve';

interface Surface {
  c: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  t: CanvasTexture | null;
  key: string;
  uniform: { value: Texture };
}

export interface EngineEvents {
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number, commit: boolean) => void;
  /** a garment started or finished loading */
  onLoading?: (loading: boolean) => void;
  onError?: (message: string) => void;
}

const FABRICS: Record<Fabric, { knit: KnitId; roughness: number; sheen: number; normal: number; fleck: number; cavity: number }> = {
  cotton: { knit: 'jersey', roughness: 0.92, sheen: 0.32, normal: 0.55, fleck: 0, cavity: 0.5 },
  heather: { knit: 'heather', roughness: 0.94, sheen: 0.28, normal: 0.55, fleck: 0.26, cavity: 0.5 },
  washed: { knit: 'washed', roughness: 0.97, sheen: 0.42, normal: 0.5, fleck: 0.1, cavity: 0.38 },
  pique: { knit: 'pique', roughness: 0.86, sheen: 0.3, normal: 0.8, fleck: 0, cavity: 0.62 },
  slub: { knit: 'slub', roughness: 0.93, sheen: 0.3, normal: 0.75, fleck: 0.1, cavity: 0.55 },
};

const transparentPixel = () => {
  const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  return t;
};

/** Fine devices get the doubled mesh; phones keep the simulated resolution. */
const meshDetail = (): 1 | 2 => (typeof window !== 'undefined' && (window.innerWidth < 640 || (navigator.hardwareConcurrency ?? 8) <= 4) ? 1 : 2);

export class TeeEngine {
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.05, 50);
  private controls: OrbitControls;
  private shirt = new Group();
  private front = new Mesh(new BufferGeometry());
  private back = new Mesh(new BufferGeometry());
  private pickFront = new Mesh(new BufferGeometry(), [new MeshBasicMaterial({ side: FrontSide }), new MeshBasicMaterial({ side: FrontSide })]);
  private pickBack = new Mesh(new BufferGeometry(), [new MeshBasicMaterial({ side: FrontSide }), new MeshBasicMaterial({ side: FrontSide })]);
  private parts = new Map<string, Mesh>();
  private contact: Mesh;
  private surfaces: Record<Side, Record<SurfaceKind, Surface>>;
  private empty = transparentPixel();

  private bodyMats: Record<Side, MeshPhysicalMaterial>;
  private sleeveMats: Record<Side, MeshPhysicalMaterial>;
  private trimMat: MeshPhysicalMaterial;
  private ribMat: MeshPhysicalMaterial;
  private stitchMat: MeshStandardMaterial;
  private creaseMat: MeshBasicMaterial;
  private buttonMat = new MeshPhysicalMaterial({ color: '#e9e2d2', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  private holeMat = new MeshBasicMaterial({ color: '#1a1712', polygonOffset: true, polygonOffsetFactor: -2 });
  private fabricUniforms = { uDetail: { value: null as Texture | null }, uFleck: { value: 0 }, uCavity: { value: 0.5 }, uLight: { value: 0 } };
  private anisotropy: number;

  private bodyColor = new Color('#ffffff');
  private sleeveColor = new Color('#ffffff');
  private ribColor = new Color('#ffffff');
  private goalBody = new Color('#ffffff');
  private goalSleeve = new Color('#ffffff');
  private goalRib = new Color('#ffffff');

  private design!: Design;
  private currentStyle = '';
  private request = 0;
  private selected: string | null = null;
  private images = new Map<string, HTMLImageElement>();
  private sizes = new Map<string, { w: number; h: number }>();
  private zones: Build['zones'] | null = null;
  private fitDist = 6;
  private size = { width: 2, height: 2.6, depth: 0.8, centreY: 0 };
  private goal: Vector3 | null = null;
  private goalT: Vector3 | null = null;
  private morph: { from: Map<Mesh, { p: Float32Array; n: Float32Array }>; start: number; pending: Part[]; pendingKeys: Set<string> } | null = null;
  private raf = 0;
  private dirty = true;
  private visible = true;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private drag: { id: string; side: Side; kind: SurfaceKind; dx: number; dy: number } | null = null;
  private ray = new Raycaster();
  private interactive = true;
  private disposed = false;
  private hoverAt = 0;
  private cleanup: (() => void)[] = [];
  hideSelection = false;

  constructor(
    private host: HTMLElement,
    private events: EngineEvents,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = VSMShadowMap;
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(r.domElement);
    this.anisotropy = r.capabilities.getMaxAnisotropy();

    this.camera.position.set(0.9, 0.15, 6);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.09,
      rotateSpeed: 0.8,
      zoomSpeed: 0.8,
      enablePan: false,
      zoomToCursor: true,
      autoRotateSpeed: 1.6,
      minPolarAngle: 0.55,
      maxPolarAngle: 2.45,
    });
    const onChange = () => (this.dirty = true);
    this.controls.addEventListener('change', onChange);
    this.cleanup.push(() => this.controls.removeEventListener('change', onChange));

    this.buildLights();

    // soft shadow beneath the hanging garment: a painted falloff, so it never flickers
    const sc = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
    const sx = sc.getContext('2d')!;
    const sg = sx.createRadialGradient(128, 128, 8, 128, 128, 128);
    sg.addColorStop(0, 'rgba(40,34,26,.22)');
    sg.addColorStop(0.55, 'rgba(40,34,26,.07)');
    sg.addColorStop(1, 'rgba(40,34,26,0)');
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 256, 256);
    const st = new CanvasTexture(sc);
    st.colorSpace = SRGBColorSpace;
    this.contact = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, toneMapped: false }));
    this.contact.rotation.x = -Math.PI / 2;
    this.scene.add(this.contact);

    const mkSurface = (): Surface => ({ c: null, ctx: null, t: null, key: '', uniform: { value: this.empty } });
    this.surfaces = {
      front: { body: mkSurface(), sleeve: mkSurface() },
      back: { body: mkSurface(), sleeve: mkSurface() },
    };
    this.bodyMats = { front: this.garmentMaterial(this.surfaces.front.body, this.bodyColor), back: this.garmentMaterial(this.surfaces.back.body, this.bodyColor) };
    this.sleeveMats = { front: this.garmentMaterial(this.surfaces.front.sleeve, this.sleeveColor), back: this.garmentMaterial(this.surfaces.back.sleeve, this.sleeveColor) };
    this.trimMat = new MeshPhysicalMaterial({ roughness: 0.94, sheen: 0.3, sheenRoughness: 0.75, side: DoubleSide });
    this.ribMat = new MeshPhysicalMaterial({ roughness: 0.92, sheen: 0.3, sheenRoughness: 0.75, side: DoubleSide });
    const rib = knitTextures('rib', this.anisotropy);
    this.ribMat.normalMap = rib.normal;
    this.ribMat.normalScale.setScalar(0.9);
    this.stitchMat = new MeshStandardMaterial({ map: stitchTexture(this.anisotropy), transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    this.creaseMat = new MeshBasicMaterial({ map: creaseTexture(), transparent: true, depthWrite: false, opacity: 0.36, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    this.front.material = [this.bodyMats.front, this.sleeveMats.front];
    this.back.material = [this.bodyMats.back, this.sleeveMats.back];
    for (const m of [this.front, this.back]) {
      m.castShadow = m.receiveShadow = true;
      m.visible = false;
      this.shirt.add(m);
    }
    this.scene.add(this.shirt);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.dirty = true;
    });
    this.io.observe(host);
    this.resize();
    this.bindPointer();

    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      if (!this.visible || document.hidden) return;
      this.step(now);
      this.controls.update();
      if (this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private buildLights() {
    // a large, soft studio: broad overhead panel, a window to the side, a low bounce
    const pm = new PMREMGenerator(this.renderer);
    const es = new Scene();
    const dome = new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: new Color(0.72, 0.71, 0.69), side: DoubleSide }));
    es.add(dome);
    for (const [x, y, z, w, h, i] of [
      [0, 11, 4, 16, 10, 3.2],
      [-11, 3, 5, 7, 12, 2.2],
      [11, 2, 2, 5, 12, 1.2],
      [0, 1, -12, 12, 10, 1.6],
    ]) {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(i, i * 0.985, i * 0.96), side: DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      es.add(m);
    }
    const env = pm.fromScene(es, 0.06);
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.5;
    pm.dispose();
    es.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      (m.material as Material | undefined)?.dispose();
    });
    this.scene.add(new HemisphereLight(0xffffff, 0xb9b2a6, 0.22));
    // a large window to the upper left: soft, but directional enough for folds to read
    const key = new DirectionalLight(0xfff6ea, 2.1);
    key.position.set(-3.6, 4.2, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 14 });
    key.shadow.radius = 7;
    key.shadow.blurSamples = 16;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);
    const rim = new DirectionalLight(0xffffff, 0.75);
    rim.position.set(3.5, 3, -5);
    this.scene.add(rim);
  }

  /** Cloth: knit normal + yarn colour variation, print composited in the shader. */
  private garmentMaterial(surface: Surface, color: Color) {
    const m = new MeshPhysicalMaterial({ color, roughness: 0.92, metalness: 0, sheen: 0.3, sheenRoughness: 0.75, sheenColor: new Color('#ffffff'), side: DoubleSide });
    m.shadowSide = DoubleSide;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.fabricUniforms, { uPrint: surface.uniform });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aAO;\nvarying vec2 vAO;\nvarying vec2 vPrintUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = aAO;\nvPrintUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vAO;\nvarying vec2 vPrintUv;\nuniform sampler2D uPrint;\nuniform sampler2D uDetail;\nuniform float uFleck;\nuniform float uCavity;\nuniform float uLight;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 knit = texture2D(uDetail, vNormalMapUv).rg;
          vec3 cloth = diffuseColor.rgb;
          // yarn variation: a mix of lighter and darker fibres, so it reads on any colour
          float fl = (knit.g - 0.5) * uFleck * 2.0;
          cloth = fl > 0.0 ? mix(cloth, vec3(1.0), fl * 0.75) : cloth * (1.0 + fl * 0.8);
          cloth *= mix(1.0, knit.r, uCavity);
          if (gl_FrontFacing) {
            vec2 pUv = vPrintUv;
            float inside = step(0.0, pUv.x) * step(pUv.x, 1.0) * step(0.0, pUv.y) * step(pUv.y, 1.0);
            vec4 pr = texture2D(uPrint, pUv) * inside;
            if (pr.a > 0.002) {
              vec3 ink = pr.rgb / pr.a;
              ink = mix(pow(ink * 0.9478672986 + 0.0521327014, vec3(2.4)), ink * 0.0773993808, vec3(lessThanEqual(ink, vec3(0.04045))));
              cloth = mix(cloth, ink * mix(1.0, knit.r, 0.5), pr.a);
            }
            cloth *= mix(1.0, vAO.x, 0.85);
          } else {
            // the inside of the garment: the reverse of the knit, in its own shade
            cloth *= 0.9 * mix(0.42, 1.0, vAO.y);
          }
          diffuseColor.rgb = cloth;`,
        );
    };
    return m;
  }

  /* ───────────────────────────── public API */

  setDesign(d: Design) {
    const prev = this.design;
    this.design = d;
    const key = styleKey(d);
    if (key !== this.currentStyle) {
      this.currentStyle = key;
      void this.loadStyle(d);
    }
    if (!prev || prev.fabric !== d.fabric) this.applyFabric(d.fabric);
    this.goalBody.set(d.color);
    this.goalSleeve.set(d.sleeveColor || d.color);
    this.goalRib.set(d.collarColor || d.color);
    if (!prev) {
      this.bodyColor.copy(this.goalBody);
      this.sleeveColor.copy(this.goalSleeve);
      this.ribColor.copy(this.goalRib);
    }
    this.syncThread();
    this.paint();
    this.dirty = true;
  }

  setSelection(id: string | null) {
    this.selected = id;
    this.paint();
  }

  view(v: View | Side) {
    const dir = new Vector3(...VIEWS[v as View]);
    const t = new Vector3(0, this.size.centreY, 0);
    this.goal = t.clone().addScaledVector(dir, this.fitDist);
    this.goal.y += 0.12;
    this.goalT = t;
    this.controls.autoRotate = false;
  }

  /** embedded preview: no pointer interaction, wheel scrolls the page */
  setInteractive(on: boolean) {
    this.interactive = on;
    this.controls.enabled = on;
    this.controls.enableZoom = on;
    this.renderer.domElement.style.pointerEvents = on ? 'auto' : 'none';
  }

  spin(on: boolean) {
    this.controls.autoRotate = on;
    this.dirty = true;
  }

  zoom(f: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    off.setLength(Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, off.length() * f)));
    this.goal = this.controls.target.clone().add(off);
  }

  /** zone centre (print-canvas coords) used to place new layers */
  zoneCentre(side: Side, zone: Zone): [number, number] {
    if (zone === 'body') return [W / 2, side === 'front' ? H * 0.37 : H * 0.36];
    const poly = this.zones?.[side][zone];
    if (!poly) return [zone === 'sleeveL' ? W * 0.75 : W * 0.25, H * 0.22];
    return [(poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[2][1]) * 0.42];
  }

  /** Hi-res mockup: renders the current view at `scale`× over a background. */
  mockup(scale: number, background: string | HTMLImageElement): string {
    const r = this.renderer;
    const prev = r.getPixelRatio();
    this.hideSelection = true;
    this.paint();
    r.setPixelRatio(scale);
    this.fitRenderer();
    r.render(this.scene, this.camera);
    const c = document.createElement('canvas');
    c.width = r.domElement.width;
    c.height = r.domElement.height;
    const ctx = c.getContext('2d')!;
    if (typeof background === 'string') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);
    } else {
      const s = Math.max(c.width / background.naturalWidth, c.height / background.naturalHeight);
      ctx.drawImage(background, (c.width - background.naturalWidth * s) / 2, (c.height - background.naturalHeight * s) / 2, background.naturalWidth * s, background.naturalHeight * s);
    }
    ctx.drawImage(r.domElement, 0, 0);
    r.setPixelRatio(prev);
    this.fitRenderer();
    this.hideSelection = false;
    this.paint();
    this.dirty = true;
    return c.toDataURL('image/png');
  }

  /** Print-ready artwork (transparent, `scale`× canvas resolution). Sleeves have their own file. */
  printFile(side: Side, scale = 2, kind: SurfaceKind = 'body'): string {
    const c = document.createElement('canvas');
    c.width = W * scale;
    c.height = H * scale;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    this.drawLayers(ctx, side, kind, false);
    return c.toDataURL('image/png');
  }

  hasSleevePrints() {
    return this.design?.layers.some((l) => l.zone !== 'body' && l.visible) ?? false;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.controls.dispose();
    this.cleanup.forEach((f) => f());
    this.shirt.traverse((o) => (o as Mesh).geometry?.dispose());
    this.pickFront.geometry.dispose();
    this.pickBack.geometry.dispose();
    this.contact.geometry.dispose();
    const contactMat = this.contact.material as MeshBasicMaterial;
    contactMat.map?.dispose();
    contactMat.dispose();
    for (const side of Object.values(this.surfaces)) for (const s of Object.values(side)) s.t?.dispose();
    this.empty.dispose();
    this.stitchMat.map?.dispose();
    this.creaseMat.map?.dispose();
    for (const m of [...Object.values(this.bodyMats), ...Object.values(this.sleeveMats), this.trimMat, this.ribMat, this.stitchMat, this.creaseMat, this.buttonMat, this.holeMat]) m.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ───────────────────────────── garment */

  private async loadStyle(d: Design) {
    const token = ++this.request;
    this.events.onLoading?.(true);
    try {
      const buf = await fetchDrape(d);
      if (token !== this.request || this.disposed) return;
      this.applyBuild(buildGarment(d, buf, meshDetail()));
      this.events.onLoading?.(false);
    } catch (e) {
      if (token !== this.request || this.disposed) return;
      console.error('[tee] garment failed to load', e);
      this.events.onLoading?.(false);
      this.events.onError?.('The garment could not be loaded. Please check your connection and try again.');
    }
  }

  /** Lets a failed garment be requested again. */
  retry() {
    if (!this.design) return;
    void this.loadStyle(this.design);
  }

  private materialFor(p: Part): Material {
    switch (p.material) {
      case 'rib':
        return this.ribMat;
      case 'stitch':
        return this.stitchMat;
      case 'crease':
        return this.creaseMat;
      case 'button':
        return this.buttonMat;
      case 'hole':
        return this.holeMat;
      default:
        return this.trimMat;
    }
  }

  private fillGeometry(g: BufferGeometry, p: Part) {
    g.setAttribute('position', new BufferAttribute(p.position.slice(), 3));
    g.setAttribute('normal', new BufferAttribute(p.normal.slice(), 3));
    g.setAttribute('uv', new BufferAttribute(p.uv, 2));
    if (p.uv1) g.setAttribute('uv1', new BufferAttribute(p.uv1, 2));
    if (p.ao) g.setAttribute('aAO', new BufferAttribute(p.ao, 2));
    g.setIndex(new BufferAttribute(p.index, 1));
    g.clearGroups();
    p.groups?.forEach(([start, count], i) => g.addGroup(start, count, i));
    g.computeBoundingSphere();
  }

  private applyBuild(b: Build) {
    const first = !this.front.visible;
    this.zones = b.zones;
    this.size = b.size;
    this.fillGeometry(this.pickFront.geometry, b.pickFront);
    this.fillGeometry(this.pickBack.geometry, b.pickBack);
    this.pickFront.updateMatrixWorld();
    this.pickBack.updateMatrixWorld();

    const from = new Map<Mesh, { p: Float32Array; n: Float32Array }>();
    const morphTo = (mesh: Mesh, p: Part) => {
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position') as BufferAttribute | undefined;
      if (!first && pos && pos.count === p.position.length / 3 && geo.index?.count === p.index.length) {
        from.set(mesh, { p: (pos.array as Float32Array).slice(), n: (geo.getAttribute('normal').array as Float32Array).slice() });
        mesh.userData.to = p;
        // print and knit mapping follow the new pattern straight away
        (geo.getAttribute('uv') as BufferAttribute).copyArray(p.uv).needsUpdate = true;
        if (p.uv1) (geo.getAttribute('uv1') as BufferAttribute).copyArray(p.uv1).needsUpdate = true;
        if (p.ao) (geo.getAttribute('aAO') as BufferAttribute).copyArray(p.ao).needsUpdate = true;
        return true;
      }
      this.fillGeometry(geo, p);
      return false;
    };
    morphTo(this.front, b.front);
    morphTo(this.back, b.back);
    this.front.visible = this.back.visible = true;

    // details that keep their shape morph too; new ones appear when the cloth has settled
    const keys = new Set(b.details.map((p) => p.key));
    for (const [key, mesh] of this.parts) {
      if (keys.has(key)) continue;
      mesh.geometry.dispose();
      this.shirt.remove(mesh);
      this.parts.delete(key);
    }
    const pending: Part[] = [];
    for (const p of b.details) {
      const mesh = this.parts.get(p.key);
      if (!mesh) {
        if (first) this.addPart(p);
        else pending.push(p);
        continue;
      }
      morphTo(mesh, p);
    }
    this.morph = first ? null : { from, start: performance.now(), pending, pendingKeys: new Set(pending.map((p) => p.key)) };

    // frame the garment and sit its soft shadow just under the hem
    const hem = b.size.centreY - b.size.height / 2;
    this.contact.position.set(0, hem - 0.3, 0);
    this.contact.scale.set(b.size.width * 1.05, b.size.depth * 3.4, 1);
    this.frame(first);
    this.dirty = true;
  }

  private addPart(p: Part) {
    const g = new BufferGeometry();
    this.fillGeometry(g, p);
    const mesh = new Mesh(g, this.materialFor(p));
    mesh.name = p.key;
    if (p.material === 'rib' || p.material === 'trim' || p.material === 'button') {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    if (p.material === 'stitch' || p.material === 'crease') mesh.renderOrder = p.material === 'crease' ? 1 : 2;
    this.parts.set(p.key, mesh);
    this.shirt.add(mesh);
  }

  private tickMorph(now: number) {
    const m = this.morph;
    if (!m) return;
    const raw = Math.min(1, (now - m.start) / 520);
    const t = raw * raw * (3 - 2 * raw);
    for (const [mesh, f] of m.from) {
      const to = mesh.userData.to as Part;
      const pa = mesh.geometry.getAttribute('position') as BufferAttribute;
      const na = mesh.geometry.getAttribute('normal') as BufferAttribute;
      const pos = pa.array as Float32Array;
      const nor = na.array as Float32Array;
      for (let i = 0; i < pos.length; i++) {
        pos[i] = f.p[i] + (to.position[i] - f.p[i]) * t;
        nor[i] = f.n[i] + (to.normal[i] - f.n[i]) * t;
      }
      pa.needsUpdate = true;
      na.needsUpdate = true;
    }
    this.dirty = true;
    if (raw >= 1) {
      m.pending.forEach((p) => this.addPart(p));
      for (const mesh of m.from.keys()) mesh.geometry.computeBoundingSphere();
      this.morph = null;
    }
  }

  /** Distance that fits the garment in the viewport, whatever its shape. */
  private frame(jump: boolean) {
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const asp = this.camera.aspect || 1;
    // room around the garment for the stage's own controls
    const fit = Math.max((this.size.height * 1.3) / 2 / tan, (this.size.width * 1.16) / 2 / (tan * asp));
    const prev = this.fitDist;
    this.fitDist = fit + this.size.depth / 2;
    this.controls.maxDistance = this.fitDist * 1.5;
    this.controls.minDistance = this.fitDist * 0.16;
    const t = new Vector3(0, this.size.centreY, 0);
    if (jump) {
      this.controls.target.copy(t);
      this.camera.position.set(this.fitDist * 0.2, t.y + 0.12, this.fitDist * 0.98);
      this.dirty = true;
      return;
    }
    // keep the customer's angle; only adjust the framing when they are not zoomed in
    const off = this.camera.position.clone().sub(this.controls.target);
    if (off.length() > prev * 0.82) {
      this.goal = t.clone().add(off.setLength(this.fitDist));
      this.goalT = t;
    }
  }

  private applyFabric(f: Fabric) {
    const spec = FABRICS[f];
    const tex = knitTextures(spec.knit, this.anisotropy);
    this.fabricUniforms.uDetail.value = tex.detail;
    this.fabricUniforms.uFleck.value = spec.fleck;
    this.fabricUniforms.uCavity.value = spec.cavity;
    for (const m of [...Object.values(this.bodyMats), ...Object.values(this.sleeveMats), this.trimMat]) {
      const first = !m.normalMap;
      m.normalMap = tex.normal;
      m.normalScale.setScalar(spec.normal);
      m.roughness = spec.roughness;
      m.sheen = spec.sheen;
      if (first) m.needsUpdate = true;
    }
    this.dirty = true;
  }

  private syncThread() {
    // thread is just off the cloth colour, so stitching reads on dark garments too
    const lum = this.goalBody.r * 0.3 + this.goalBody.g * 0.59 + this.goalBody.b * 0.11;
    this.stitchMat.color.copy(this.goalBody).lerp(new Color(lum < 0.1 ? '#ffffff' : '#000000'), lum < 0.1 ? 0.1 : 0.05);
    this.creaseMat.opacity = lum < 0.05 ? 0.7 : 0.36;
  }

  /* ───────────────────────────── painting */

  private image(src: string) {
    let im = this.images.get(src);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        for (const side of Object.values(this.surfaces)) for (const s of Object.values(side)) s.key = '';
        this.paint();
      };
      im.src = src;
      this.images.set(src, im);
    }
    return im;
  }

  private drawLayer(c: CanvasRenderingContext2D, o: Layer) {
    if (o.type === 'image' && o.src) {
      const im = this.image(o.src);
      if (im.complete && im.naturalWidth) c.drawImage(im, -o.w! / 2, -o.h! / 2, o.w!, o.h!);
      this.sizes.set(o.id, { w: o.w!, h: o.h! });
      return;
    }
    if (o.type === 'text') {
      const lines = (o.text || ' ').split('\n');
      const size = o.size ?? 150;
      c.font = `${size}px "${o.font}"`;
      c.textBaseline = 'middle';
      const widths = lines.map((l) => c.measureText(l).width);
      const w = Math.max(40, ...widths);
      const h = Math.max(40, lines.length * size * 1.12);
      this.sizes.set(o.id, { w, h });
      c.fillStyle = o.fill ?? '#111';
      c.lineJoin = 'round';
      c.lineWidth = (o.strokeWidth ?? 0) * 2;
      c.strokeStyle = o.stroke ?? '#fff';
      const align = o.align ?? 'center';
      c.textAlign = align;
      const x0 = align === 'left' ? -w / 2 : align === 'right' ? w / 2 : 0;
      lines.forEach((l, i) => {
        const y = (i - (lines.length - 1) / 2) * size * 1.12;
        if ((o.strokeWidth ?? 0) > 0) c.strokeText(l, x0, y);
        c.fillText(l, x0, y);
      });
      return;
    }
    const r = (o.w ?? 320) / 2;
    this.sizes.set(o.id, { w: r * 2, h: r * 2 });
    c.fillStyle = o.fill ?? '#111';
    c.beginPath();
    switch (o.shape) {
      case 'circle':
        c.arc(0, 0, r, 0, Math.PI * 2);
        break;
      case 'square':
        c.roundRect(-r, -r, r * 2, r * 2, r * 0.08);
        break;
      case 'triangle':
        c.moveTo(0, -r);
        c.lineTo(r, r * 0.8);
        c.lineTo(-r, r * 0.8);
        c.closePath();
        break;
      case 'heart':
        c.moveTo(0, r * 0.85);
        c.bezierCurveTo(-r * 1.25, -r * 0.1, -r * 0.6, -r * 1.05, 0, -r * 0.4);
        c.bezierCurveTo(r * 0.6, -r * 1.05, r * 1.25, -r * 0.1, 0, r * 0.85);
        break;
      case 'badge':
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const rr = i % 2 ? r * 0.88 : r;
          c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        break;
      default:
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.42 : r;
          c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
    }
    c.fill();
  }

  private layersOn(side: Side, kind: SurfaceKind) {
    return this.design.layers.filter((o) => o.side === side && (o.zone === 'body') === (kind === 'body'));
  }

  private drawLayers(c: CanvasRenderingContext2D, side: Side, kind: SurfaceKind, withSelection: boolean) {
    for (const o of this.layersOn(side, kind)) {
      if (!o.visible) continue;
      c.save();
      // sleeve prints are clipped to their sleeve panel
      const poly = o.zone !== 'body' ? this.zones?.[side][o.zone] : null;
      if (poly) {
        c.beginPath();
        poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.clip();
      }
      c.translate(o.x, o.y);
      c.rotate((o.r * Math.PI) / 180);
      c.scale(o.s * (o.flip ? -1 : 1), o.s);
      c.globalAlpha = o.a;
      this.drawLayer(c, o);
      c.globalAlpha = 1;
      if (withSelection && o.id === this.selected) {
        const sz = this.sizes.get(o.id) ?? { w: 100, h: 100 };
        c.setLineDash([16, 12]);
        c.lineWidth = 4 / o.s;
        c.strokeStyle = '#c9a96e';
        c.strokeRect(-sz.w / 2 - 10, -sz.h / 2 - 10, sz.w + 20, sz.h + 20);
      }
      c.restore();
    }
  }

  /** Repaints only the print canvases whose contents changed. */
  paint() {
    if (!this.design) return;
    for (const side of ['front', 'back'] as Side[])
      for (const kind of ['body', 'sleeve'] as SurfaceKind[]) {
        const s = this.surfaces[side][kind];
        const layers = this.layersOn(side, kind);
        const showSelection = !this.hideSelection && layers.some((l) => l.id === this.selected);
        const key = JSON.stringify([layers.map((l) => ({ ...l, src: l.src?.length })), showSelection ? this.selected : null, !!this.zones]);
        if (key === s.key) continue;
        s.key = key;
        if (!layers.length && !s.c) continue;
        if (!s.c) {
          s.c = Object.assign(document.createElement('canvas'), { width: W, height: H });
          s.ctx = s.c.getContext('2d')!;
          s.t = new CanvasTexture(s.c);
          s.t.anisotropy = this.anisotropy;
          s.t.colorSpace = NoColorSpace;
          s.t.premultiplyAlpha = true;
          s.uniform.value = s.t;
        }
        s.ctx!.clearRect(0, 0, W, H);
        this.drawLayers(s.ctx!, side, kind, !this.hideSelection);
        s.t!.needsUpdate = true;
        this.dirty = true;
      }
  }

  /* ───────────────────────────── per-frame */

  private step(now: number) {
    if (this.goalT) {
      this.controls.target.lerp(this.goalT, 0.14);
      if (this.controls.target.distanceTo(this.goalT) < 0.003) {
        this.controls.target.copy(this.goalT);
        this.goalT = null;
      }
      this.dirty = true;
    }
    if (this.goal) {
      this.camera.position.lerp(this.goal, 0.14);
      if (this.camera.position.distanceTo(this.goal) < 0.006) this.goal = null;
      this.dirty = true;
    }
    this.tickMorph(now);
    // colours ease rather than snap: feedback that the choice landed
    for (const [c, g] of [
      [this.bodyColor, this.goalBody],
      [this.sleeveColor, this.goalSleeve],
      [this.ribColor, this.goalRib],
    ] as [Color, Color][]) {
      if (Math.abs(c.r - g.r) + Math.abs(c.g - g.g) + Math.abs(c.b - g.b) > 0.002) {
        c.lerp(g, 0.16);
        this.dirty = true;
      } else if (!c.equals(g)) {
        c.copy(g);
        this.dirty = true;
      }
    }
    // materials hold their own colour, so the eased values are copied in each frame
    this.bodyMats.front.color.copy(this.bodyColor);
    this.bodyMats.back.color.copy(this.bodyColor);
    this.sleeveMats.front.color.copy(this.sleeveColor);
    this.sleeveMats.back.color.copy(this.sleeveColor);
    this.trimMat.color.copy(this.bodyColor);
    this.ribMat.color.copy(this.ribColor);
  }

  /* ───────────────────────────── picking & dragging on the garment */

  private hit(e: PointerEvent, only?: { side: Side; kind: SurfaceKind }) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const mv = new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.ray.setFromCamera(mv, this.camera);
    const targets = only ? [only.side === 'front' ? this.pickFront : this.pickBack] : [this.pickFront, this.pickBack];
    for (const h of this.ray.intersectObjects(targets, false)) {
      if (!h.uv || !h.face) continue;
      const kind: SurfaceKind = h.face.materialIndex === 1 ? 'sleeve' : 'body';
      if (only && only.kind !== kind) continue;
      return { side: (h.object === this.pickFront ? 'front' : 'back') as Side, kind, x: h.uv.x * W, y: (1 - h.uv.y) * H };
    }
    return null;
  }

  private pick(side: Side, kind: SurfaceKind, x: number, y: number) {
    const a = this.layersOn(side, kind);
    for (let i = a.length - 1; i >= 0; i--) {
      const o = a[i];
      if (!o.visible || o.locked) continue;
      const sz = this.sizes.get(o.id) ?? { w: 100, h: 100 };
      const dx = x - o.x;
      const dy = y - o.y;
      const r = (-o.r * Math.PI) / 180;
      const lx = (dx * Math.cos(r) - dy * Math.sin(r)) / o.s;
      const ly = (dx * Math.sin(r) + dy * Math.cos(r)) / o.s;
      if (Math.abs(lx) <= sz.w / 2 + 8 && Math.abs(ly) <= sz.h / 2 + 8) return o;
    }
    return null;
  }

  private bindPointer() {
    const cv = this.renderer.domElement;
    const down = (e: PointerEvent) => {
      if (!this.interactive || !this.design) return;
      const h = this.hit(e);
      if (!h) return;
      const o = this.pick(h.side, h.kind, h.x, h.y);
      if (!o) {
        if (this.selected) this.events.onSelect(null);
        return;
      }
      this.events.onSelect(o.id);
      this.drag = { id: o.id, side: h.side, kind: h.kind, dx: o.x - h.x, dy: o.y - h.y };
      this.controls.enabled = false;
      cv.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!this.interactive || !this.design) return;
      if (this.drag) {
        const h = this.hit(e, this.drag);
        if (h) this.events.onMove(this.drag.id, h.x + this.drag.dx, h.y + this.drag.dy, false);
        return;
      }
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const now = performance.now();
      if (now - this.hoverAt < 60) return;
      this.hoverAt = now;
      const h = this.hit(e);
      cv.style.cursor = h && this.pick(h.side, h.kind, h.x, h.y) ? 'grab' : '';
    };
    const end = (e: PointerEvent) => {
      if (this.drag) {
        const h = this.hit(e, this.drag);
        const o = this.design.layers.find((l) => l.id === this.drag!.id);
        if (o) this.events.onMove(o.id, h ? h.x + this.drag.dx : o.x, h ? h.y + this.drag.dy : o.y, true);
      }
      this.drag = null;
      if (this.interactive) this.controls.enabled = true;
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    this.cleanup.push(() => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', end);
      cv.removeEventListener('pointercancel', end);
    });
  }

  private fitRenderer() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w && h) this.renderer.setSize(w, h, false);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.front.visible) this.frame(false);
    this.dirty = true;
  }
}
