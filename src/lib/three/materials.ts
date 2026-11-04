import { Color, MeshPhysicalMaterial, type Material, type Object3D, type Mesh } from 'three';

/**
 * Central PBR material library. Every jewellery GLB references materials by
 * these names; at load time `applyMaterialLibrary` swaps them for the tuned,
 * shared instances below. Artists can therefore author models in Blender and
 * only need to name their materials correctly.
 */
export type MaterialName =
  | 'gold22k'
  | 'gold18k'
  | 'roseGold'
  | 'whiteGold'
  | 'antiqueGold'
  | 'diamond'
  | 'kundan'
  | 'ruby'
  | 'emerald'
  | 'sapphire'
  | 'pearl'
  | 'enamelRed'
  | 'enamelGreen';

type Spec = NonNullable<ConstructorParameters<typeof MeshPhysicalMaterial>[0]>;

const metal = (hex: string, roughness: number, extra: Spec = {}): Spec => ({
  color: new Color(hex),
  metalness: 1,
  roughness,
  envMapIntensity: 1.35,
  clearcoat: 0.25,
  clearcoatRoughness: 0.08,
  ...extra,
});

/**
 * Coloured gemstones. A purely transmissive material would refract the empty
 * (transparent) WebGL buffer over a camera feed and turn black, so stones use
 * a partially metallic body colour (tinted facet flashes) under a dielectric
 * clearcoat (white specular highlights) with a faint emissive "inner glow".
 */
const gem = (hex: string, glow: number, extra: Spec = {}): Spec => {
  const c = new Color(hex);
  return {
    color: c,
    metalness: 0.55,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0,
    ior: 1.77,
    specularIntensity: 1,
    envMapIntensity: 2.2,
    emissive: c.clone().multiplyScalar(0.55),
    emissiveIntensity: glow,
    ...extra,
  };
};

export const MATERIAL_SPECS: Record<MaterialName, Spec> = {
  gold22k: metal('#f7c562', 0.17),
  gold18k: metal('#f2cb86', 0.15),
  roseGold: metal('#eab09a', 0.16),
  whiteGold: metal('#ecebe7', 0.11, { envMapIntensity: 1.5 }),
  antiqueGold: metal('#d29f4f', 0.34, { clearcoat: 0, envMapIntensity: 1.15 }),
  diamond: {
    color: new Color('#ffffff'),
    metalness: 0.9,
    roughness: 0.0,
    envMapIntensity: 3.2,
    // faint inner brilliance so pavilion facets read white-grey, never black
    emissive: new Color('#dfe6f2'),
    emissiveIntensity: 0.09,
    iridescence: 0.55,
    iridescenceIOR: 2.0,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 620,
    clearcoat: 1,
    clearcoatRoughness: 0,
    ior: 2.42,
    specularIntensity: 1,
  },
  kundan: {
    color: new Color('#fff6dc'),
    metalness: 0.82,
    roughness: 0.06,
    envMapIntensity: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0,
    emissive: new Color('#b8994d'),
    emissiveIntensity: 0.26,
    iridescence: 0.25,
  },
  ruby: gem('#c8102e', 0.38),
  emerald: gem('#0c8a55', 0.34),
  sapphire: gem('#1d3fc4', 0.4),
  pearl: {
    color: new Color('#f4eee6'),
    metalness: 0,
    roughness: 0.16,
    sheen: 1,
    sheenColor: new Color('#ffe2e7'),
    sheenRoughness: 0.3,
    iridescence: 0.55,
    iridescenceIOR: 1.5,
    iridescenceThicknessMinimum: 280,
    iridescenceThicknessMaximum: 560,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.45,
  },
  enamelRed: {
    color: new Color('#a8122b'),
    metalness: 0.1,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  },
  enamelGreen: {
    color: new Color('#126b45'),
    metalness: 0.1,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  },
};

export const isMaterialName = (n: string): n is MaterialName => n in MATERIAL_SPECS;

/** Creates a fresh, uncached material — used by the GLB exporter. */
export function createMaterial(name: MaterialName): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial(MATERIAL_SPECS[name]);
  m.name = name;
  return m;
}

const shared = new Map<MaterialName, MeshPhysicalMaterial>();

/** Shared runtime instance: one shader program per material for all models. */
export function getSharedMaterial(name: MaterialName): MeshPhysicalMaterial {
  let m = shared.get(name);
  if (!m) {
    m = createMaterial(name);
    shared.set(name, m);
  }
  return m;
}

/** Live environment intensity multiplier (driven by scene light estimation). */
export function setLibraryEnvIntensity(multiplier: number) {
  for (const [name, m] of shared) {
    const base = (MATERIAL_SPECS[name]?.envMapIntensity as number | undefined) ?? 1;
    m.envMapIntensity = base * multiplier;
  }
}

/**
 * Replaces materials on a loaded model with library instances (matched by
 * name, ignoring exporter suffixes like ".001"). Unknown materials are kept.
 */
export function applyMaterialLibrary(root: Object3D) {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const swap = (mat: Material) => {
      const key = mat.name.replace(/\.\d+$/, '');
      if (isMaterialName(key)) {
        if (mat !== getSharedMaterial(key)) mat.dispose();
        return getSharedMaterial(key);
      }
      return mat;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}
