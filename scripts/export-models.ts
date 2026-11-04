/**
 * Builds every procedural jewellery model and writes it to /public/models as
 * an optimised binary glTF (GLB) with KHR PBR material extensions.
 *
 *   npm run models            # all models
 *   npm run models -- hoop-gold jhumka-temple
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, Vector3, type Mesh } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { MODEL_BUILDERS } from '../src/lib/three/builders/index.ts';
import type { ModelId } from '../src/config/models.ts';

// GLTFExporter reads Blobs through FileReader, which Node does not provide.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'models');
await mkdir(outDir, { recursive: true });

const requested = process.argv.slice(2) as ModelId[];
const ids = (requested.length ? requested : Object.keys(MODEL_BUILDERS)) as ModelId[];
const exporter = new GLTFExporter();
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

for (const id of ids) {
  const t0 = performance.now();
  const group = MODEL_BUILDERS[id]();
  let verts = 0;
  group.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) verts += m.geometry.attributes.position.count;
  });
  const size = new Box3().setFromObject(group).getSize(new Vector3());
  const raw = (await exporter.parseAsync(group, { binary: true })) as ArrayBuffer;
  // weld + quantise + meshopt-compress (decoded by GLTFLoader's MeshoptDecoder)
  const doc = await io.readBinary(new Uint8Array(raw));
  await doc.transform(
    dedup(),
    weld(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10 }),
  );
  const glb = await io.writeBinary(doc);
  await writeFile(join(outDir, `${id}.glb`), glb);
  console.log(
    `${id.padEnd(26)} ${(raw.byteLength / 1024).toFixed(0).padStart(5)} → ${(glb.byteLength / 1024).toFixed(0).padStart(4)} KB  ${String(verts).padStart(6)} verts  ` +
      `${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)} cm  ${(performance.now() - t0).toFixed(0)} ms`,
  );
}
