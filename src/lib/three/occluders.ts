import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShadowMaterial,
  SphereGeometry,
} from 'three';
import canonical from '../tracking/canonicalFace.json';
import { CHAIN_CREST_Y, chestZ, NECK_HEIGHT, NECK_RADIUS } from '../tracking/bodyFrame';

/**
 * Invisible stand-ins for the wearer's body. Occluders write depth only, so the
 * camera feed shows through while jewellery behind the head, neck or earlobe
 * is correctly hidden. Shadow receivers draw only the soft contact shadows
 * jewellery casts on the skin.
 */
export const occluderMaterial = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
export const shadowMaterial = new ShadowMaterial({ opacity: 0.3, depthWrite: false });
shadowMaterial.polygonOffset = true;
shadowMaterial.polygonOffsetFactor = -1;

function occluder(geo: BufferGeometry, name: string) {
  const m = new Mesh(geo, occluderMaterial);
  m.name = name;
  m.renderOrder = -10;
  return m;
}

/** Canonical face mesh, optionally inset along its normals (cm). */
export function faceGeometry(inset = 0) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(canonical.vertices, 3));
  g.setIndex(canonical.indices);
  g.computeVertexNormals();
  if (inset) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    // winding decides whether normals face outward; measure it against the head centre (behind the face)
    let dot = 0;
    for (let i = 0; i < p.count; i++) dot += n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i) + n.getZ(i) * (p.getZ(i) + 4);
    const s = dot >= 0 ? 1 : -1;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) - n.getX(i) * inset * s, p.getY(i) - n.getY(i) * inset * s, p.getZ(i) - n.getZ(i) * inset * s);
    }
    g.computeVertexNormals();
  }
  return g;
}

export function createHeadOccluders() {
  const faceGeo = faceGeometry(0.32);
  faceGeo.scale(0.95, 1, 1);
  const face = occluder(faceGeo, 'occluder-face');
  const skullGeo = new SphereGeometry(1, 32, 24);
  skullGeo.scale(7.05, 10, 9.4);
  skullGeo.translate(0, 2, -4.3);
  const skull = occluder(skullGeo, 'occluder-skull');
  const faceShadow = new Mesh(faceGeometry(0.02), shadowMaterial);
  faceShadow.receiveShadow = true;
  faceShadow.renderOrder = 5;
  return [face, skull, faceShadow];
}

/** Small ellipsoid where the lobe is, so posts/hooks pass "through" it. */
export function createLobeOccluder() {
  const g = new SphereGeometry(1, 16, 12);
  g.scale(0.8, 1.0, 0.4);
  g.translate(0, -0.12, -0.5);
  return occluder(g, 'occluder-lobe');
}

export function createBodyOccluders() {
  const neckGeo = new CylinderGeometry(1, 1, NECK_HEIGHT + 4, 40, 1, true);
  neckGeo.scale(NECK_RADIUS.x, 1, NECK_RADIUS.z);
  neckGeo.translate(0, NECK_HEIGHT / 2 - 2, 0);
  const neck = occluder(neckGeo, 'occluder-neck');

  // the crest of the shoulders beside the neck: a chain crossing it drops out of
  // sight behind the wearer here, rather than looping round in mid-air
  const crest: number[] = [];
  const crestIdx: number[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const x = -26 + (52 * i) / steps;
    const top = Math.min(CHAIN_CREST_Y + 1.1, CHAIN_CREST_Y + 1.1 - 0.5 * (Math.abs(x) - 5.2));
    crest.push(x, top, -0.15, x, -34, -0.15);
    if (i < steps) {
      const a = i * 2;
      crestIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const crestGeo = new BufferGeometry();
  crestGeo.setAttribute('position', new Float32BufferAttribute(crest, 3));
  crestGeo.setIndex(crestIdx);
  const torso = occluder(crestGeo, 'occluder-shoulders');

  // chest skin that receives jewellery shadows
  const chest = new PlaneGeometry(22, 22, 44, 44);
  chest.translate(0, -9.5, 0);
  const p = chest.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, chestZ(p.getX(i), p.getY(i)) - 0.02);
  chest.computeVertexNormals();
  const chestShadow = new Mesh(chest, shadowMaterial);
  chestShadow.receiveShadow = true;
  chestShadow.renderOrder = 5;

  const neckShadow = new Mesh(neckGeo.clone(), shadowMaterial);
  neckShadow.scale.set(1.01, 1, 1.01);
  neckShadow.receiveShadow = true;
  neckShadow.renderOrder = 5;
  return [neck, torso, chestShadow, neckShadow];
}
