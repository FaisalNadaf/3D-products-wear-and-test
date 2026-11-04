import { CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, Vector3, type Material, type Object3D } from 'three';
import type { WatchSpec } from '../../config/watches';
import { lumeMat, metal, sapphire, setBezelFinish, setMetal } from './materials';
import { ParametricWatch, type PartName } from './ParametricWatch';

/**
 * Adapter for the reference chronograph GLB (extracted from the SAMAY demo).
 * Its meshes are addressed by node/material name and driven by the same
 * WatchSpec as the parametric collection. Hands keep real time.
 *
 * The source model carried third-party trademarks (dial logo and text, clasp
 * logo, embossed crown). Those nodes were removed from the shipped GLB (see
 * scripts/optimize-glb.ts). A plain crown and our own dial print are added here.
 */
const DIAL_NODES = ['grad', 'black_txt', 'bg', 'Cylinder01', 'Cylinder02', 'Cylinder03', 'mini_01', 'mini_02', 'mini_03', 'cercle', 'fluo', 'pin', 'brand-print'];
const HAND_NODES = ['hour', 'minute', 'second', 'Cylinder004'];
const CASE_NODES = ['housing', 'wheel_02', 'wheel_03'];

const OFFSETS: Partial<Record<PartName, number>> = { crystal: 0.34, hands: 0.2, dial: 0.1, strap: 0 };

export class ReferenceChronograph {
  readonly root = new Group();
  readonly cushion: Object3D | null;
  readonly anchors = {
    crown: new Vector3(0.25, -0.002, 0),
    bezel: new Vector3(0, 0.06, -0.19),
    dial: new Vector3(-0.07, 0.035, 0.05),
    crystal: new Vector3(0.05, 0.07, -0.06),
    strap: new Vector3(0, -0.26, 0.45),
    caseback: new Vector3(0, -0.06, 0.12),
  };
  private nodes = new Map<string, Object3D>();
  private groups = {} as Record<PartName, Group>;
  private base = new Map<Object3D, Vector3>();
  private caseMat = metal('steel');
  private handMat = metal('steel');
  private linkMat = metal('yellow');
  private bezelMat = new MeshPhysicalMaterial({ clearcoat: 1 });
  private numeralMat = new MeshPhysicalMaterial({ roughness: 0.4 });
  private dialMat = new MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  private printMat = new MeshPhysicalMaterial({ roughness: 0.5 });
  private cercleMat = new MeshPhysicalMaterial({ roughness: 0.5 });
  private subMat = new MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.2, clearcoat: 1 });
  private lume = lumeMat('#c9f59a');
  private altStrap: ParametricWatch | null = null;

  constructor(scene: Object3D, spec: WatchSpec) {
    const model = scene.clone(true);
    model.traverse((o) => {
      if (o.name) this.nodes.set(o.name, o);
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = m.name !== 'glass';
        m.receiveShadow = true;
      }
    });
    const floor = this.nodes.get('floor');
    if (floor) floor.visible = false;
    this.cushion = this.nodes.get('base') ?? null;
    this.cushion?.removeFromParent();
    this.root.add(model);
    for (const p of ['crystal', 'dial', 'hands', 'strap'] as PartName[]) this.groups[p] = new Group();

    // material roles
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const name = (m.material as Material).name;
      const owner = this.ownerOf(m);
      if (owner === 'glass') {
        const g = sapphire();
        g.thickness = 0.012; // GLB units are ~100 mm
        m.material = g;
        m.renderOrder = 10;
      }
      else if (name === 'Fluo') m.material = this.lume;
      else if (owner === 'strap') m.material = name === 'Gold' ? this.linkMat : this.caseMat;
      else if (owner === 'housing') m.material = name === 'Gold' ? this.bezelMat : this.caseMat;
      else if (HAND_NODES.includes(owner)) m.material = name === 'Black' ? this.cercleMat : this.handMat;
      else if (owner === 'grad') m.material = this.dialMat;
      else if (owner === 'black_txt') m.material = this.numeralMat;
      else if (owner === 'cercle') m.material = this.cercleMat;
      else if (owner === 'bg') m.material = this.subMat;
      else if (name === 'Silver' || name === 'Gold') m.material = this.handMat;
    });
    this.addOwnMarks();
    for (const n of this.nodes.values()) this.base.set(n, n.position.clone());
    this.apply(spec);
  }

  /** Replaces the removed marks with a plain knurled crown and our own dial print. */
  private addOwnMarks() {
    const crown = new CylinderGeometry(0.026, 0.026, 0.04, 108, 6);
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
      // knurl the barrel, leaving the end rings smooth
      if (Math.abs(p.getY(i)) < 0.0185) {
        const k = 1 + 0.05 * Math.sign(Math.cos(Math.atan2(p.getZ(i), p.getX(i)) * 18));
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
    }
    crown.computeVertexNormals();
    const cm = new Mesh(crown, this.caseMat);
    cm.name = 'crown-plain';
    cm.rotation.z = Math.PI / 2;
    cm.position.set(0.218, -0.002, 0);
    cm.castShadow = true;
    this.root.add(cm);

    const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 1024 });
    const x = c.getContext('2d')!;
    x.fillStyle = '#000';
    x.fillRect(0, 0, 1024, 1024);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.font = '700 40px "Manrope Variable", system-ui, sans-serif';
    x.letterSpacing = '6px';
    x.fillText('CUBICCODE', 512, 250);
    x.font = '500 20px "Manrope Variable", system-ui, sans-serif';
    x.letterSpacing = '3px';
    x.fillText('MERIDIAN', 512, 286);
    x.fillText('CHRONOGRAPH', 512, 314);
    const print = new Mesh(new PlaneGeometry(0.3, 0.3), this.printMat);
    this.printMat.alphaMap = new CanvasTexture(c);
    this.printMat.transparent = true;
    this.printMat.depthWrite = false;
    print.rotation.x = -Math.PI / 2;
    print.position.set(0, 0.0316, 0);
    print.name = 'brand-print';
    this.root.add(print);
    this.nodes.set('brand-print', print);
  }

  /** nearest named ancestor that is a known node */
  private ownerOf(o: Object3D): string {
    let cur: Object3D | null = o;
    while (cur) {
      if ([...DIAL_NODES, ...HAND_NODES, ...CASE_NODES, 'glass', 'strap', 'base'].includes(cur.name)) return cur.name;
      cur = cur.parent;
    }
    return o.name;
  }

  apply(s: WatchSpec) {
    setMetal(this.caseMat, s.caseMetal);
    setMetal(this.handMat, s.caseMetal === 'dlc' || s.caseMetal === 'titanium' ? 'steel' : s.caseMetal);
    setMetal(this.linkMat, s.twoTone ? (s.caseMetal === 'rose' ? 'rose' : 'yellow') : s.caseMetal);
    setBezelFinish(this.bezelMat, s.bezelColor);
    const darkBezel = new Color(s.bezelColor).getHSL({ h: 0, s: 0, l: 0 }).l < 0.4;
    this.numeralMat.color.set(darkBezel ? '#efe6cf' : '#121214');
    this.dialMat.color.set(s.dialColor);
    const light = new Color(s.dialColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
    this.printMat.color.set(light ? '#141519' : '#f1efe8');
    this.cercleMat.color.set(light ? '#141519' : '#f1efe8');
    this.subMat.color.set(new Color(s.dialColor).offsetHSL(0, 0, light ? -0.12 : 0.08));
    this.lume.color.set(s.lume).multiplyScalar(0.9);
    this.lume.emissive.set(s.lume);
    // alternative straps reuse the parametric strap builder
    const strap = this.nodes.get('strap');
    if (strap) strap.visible = s.strap === 'bracelet' || s.strap === 'jubilee';
    if (s.strap !== 'bracelet' && s.strap !== 'jubilee') {
      if (!this.altStrap) {
        this.altStrap = new ParametricWatch({ diameter: 36, thickness: 11.6, lugWidth: 20, layout: 'three-hand' }, 'Meridian', s, true);
        this.root.add(this.altStrap.root);
      } else this.altStrap.apply(s);
      this.altStrap.root.visible = true;
    } else if (this.altStrap) this.altStrap.root.visible = false;
  }

  setExplode(e: number) {
    const move = (names: string[], dy: number) =>
      names.forEach((n) => {
        const o = this.nodes.get(n);
        const b = o && this.base.get(o);
        if (o && b) o.position.set(b.x, b.y + dy * e, b.z);
      });
    move(['glass'], OFFSETS.crystal!);
    move(HAND_NODES, OFFSETS.hands!);
    move(DIAL_NODES.filter((n) => n !== 'black_txt'), OFFSETS.dial!);
    move(['strap'], OFFSETS.strap!);
    if (this.altStrap) this.altStrap.root.position.y = OFFSETS.strap! * e;
  }

  tick(now: Date) {
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    const rot = (n: string, a: number) => {
      const o = this.nodes.get(n);
      if (o) o.rotation.y = -a;
    };
    rot('hour', (h / 12) * Math.PI * 2);
    rot('minute', (m / 60) * Math.PI * 2);
    rot('second', ((Math.floor(s * 8) / 8) / 60) * Math.PI * 2);
    rot('mini_01', ((now.getMilliseconds() / 1000) * Math.PI * 2) % (Math.PI * 2));
    rot('mini_02', (now.getMonth() / 12) * Math.PI * 2);
    rot('mini_03', (Math.min(now.getDate(), 30) / 30) * Math.PI * 2);
  }

  dispose() {
    this.altStrap?.dispose();
  }
}
