import type { BufferGeometry, Group, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { modelUrl, type ModelId } from '../../config/models';
import { applyMaterialLibrary } from './materials';

/**
 * Lazy GLB loading with an LRU template cache. Templates are never added to a
 * scene directly — callers get clones that share geometry and the shared
 * material library, so switching products costs no extra GPU memory.
 * If a GLB is missing or fails to parse, the procedural builder is imported
 * on demand (code-split) and used instead.
 */
const MAX_TEMPLATES = 14;
const cache = new Map<ModelId, Promise<Group>>();
let loader: GLTFLoader | null = null;

function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

async function fetchTemplate(id: ModelId): Promise<Group> {
  try {
    const gltf = await getLoader().loadAsync(modelUrl(id));
    const scene = gltf.scene as Group;
    scene.name = id;
    applyMaterialLibrary(scene);
    return scene;
  } catch (err) {
    console.warn(`[models] ${id}.glb unavailable, building procedurally`, err);
    const { buildModel } = await import('./builders');
    const group = buildModel(id);
    applyMaterialLibrary(group);
    return group;
  }
}

export function loadTemplate(id: ModelId): Promise<Group> {
  let p = cache.get(id);
  if (p) {
    cache.delete(id); // refresh LRU position
    cache.set(id, p);
    return p;
  }
  p = fetchTemplate(id);
  p.catch(() => cache.delete(id));
  cache.set(id, p);
  while (cache.size > MAX_TEMPLATES) {
    const [oldest, op] = cache.entries().next().value as [ModelId, Promise<Group>];
    cache.delete(oldest);
    void op.then(disposeObject);
  }
  return p;
}

export async function loadInstance(id: ModelId): Promise<Group> {
  const t = await loadTemplate(id);
  return t.clone(true);
}

export const preloadModels = (ids: ModelId[]) => ids.forEach((id) => void loadTemplate(id));

/** Disposes geometries (materials are shared and long-lived). */
export function disposeObject(root: Object3D) {
  const seen = new Set<BufferGeometry>();
  root.traverse((o) => {
    const g = (o as Mesh).geometry as BufferGeometry | undefined;
    if (g && !seen.has(g)) {
      seen.add(g);
      g.dispose();
    }
  });
}
