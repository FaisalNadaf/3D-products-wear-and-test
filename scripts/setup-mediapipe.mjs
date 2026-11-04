// Copies the MediaPipe WASM runtime into /public and downloads the landmark
// models once, so the app never depends on third-party CDNs at runtime and no
// camera frames ever leave the device.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public', 'mediapipe');

const MODELS = [
  {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    file: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
  // person/background separation for the jewellery background switcher
  {
    file: 'selfie_segmenter.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  },
  // tap-to-select segmentation used to find windows in room photos
  {
    file: 'magic_touch.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite',
  },
];

const exists = async (p) => stat(p).then((s) => s.size > 0, () => false);

await mkdir(join(pub, 'wasm'), { recursive: true });
await cp(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'), join(pub, 'wasm'), {
  recursive: true,
});

for (const m of MODELS) {
  const target = join(pub, m.file);
  if (await exists(target)) continue;
  process.stdout.write(`Downloading ${m.file}… `);
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`Failed to download ${m.url}: ${res.status}`);
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  console.log('done');
}
console.log('MediaPipe assets ready in public/mediapipe');
