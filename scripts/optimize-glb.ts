/**
 * Optimises a third-party / reference GLB for the web: dedupe, prune unused
 * data and meshopt-compress geometry (decoded by GLTFLoader's MeshoptDecoder).
 *
 *   npx tsx scripts/optimize-glb.ts <input.glb> <output.glb> [nodeToRemove,nodeToRemove]
 *
 * Node removal happens before writing, so the geometry is absent from the shipped file.
 */
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';

const [input, output, remove = ''] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: tsx scripts/optimize-glb.ts <input.glb> <output.glb>');
  process.exit(1);
}

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(input);
  const names = remove.split(',').filter(Boolean);
  for (const node of doc.getRoot().listNodes()) {
    if (names.includes(node.getName())) {
      console.log('removed node', node.getName());
      node.dispose();
    }
  }
  // keep node names intact: the configurators address meshes by name
  await doc.transform(dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12 }));
  await io.write(output, doc);
  const [a, b] = await Promise.all([stat(input), stat(output)]);
  console.log(`${input} ${(a.size / 1024).toFixed(0)} KB → ${(b.size / 1024).toFixed(0)} KB`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
