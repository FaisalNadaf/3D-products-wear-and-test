# Cubiccode: 3D Product Experience Showcase

A multi-page demonstration site for interactive 3D product experiences. Every experience runs live in the browser:

| Route | Experience | Highlights |
| --- | --- | --- |
| `/` | Home | Live 3D hero, interactive showcases, capabilities, industries |
| `/jewellery` | Jewellery Studio | Live face and shoulder tracking, 39 products, background replacement, 3D showroom |
| `/watches` | 3D Watches | 9 models, live configurator, hotspots, camera presets, exploded view, scroll story |
| `/tshirt` | T-Shirt Studio | 3D garment, layers on front/back/sleeves, undo/redo, saved designs, print-file export |
| `/curtains` | Curtain Visualizer | Room upload, window detection, perspective-correct 3D fabric, before/after |
| `/about`, `/contact` | Capabilities, project inquiry | |

Camera frames and photos are processed on the device. MediaPipe's WASM runtime and models are self-hosted, and nothing is uploaded.

## Quick start

```bash
npm install
npm run dev       # copies MediaPipe assets, then starts Vite on http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

Browsers only allow the camera on `https://` pages or `localhost`. `vercel.json` adds the single-page-app rewrite; other hosts need an equivalent fallback to `index.html`.

### Contact form

There is no backend in this project. Copy `.env.example` to `.env.local` and set at least one option:

- `VITE_CONTACT_ENDPOINT`: receives the inquiry as a JSON POST and shows real success and error states.
- `VITE_CONTACT_EMAIL`: opens the visitor's mail app with the inquiry filled in.

With neither set, the form says online submission isn't connected and offers to copy the inquiry. It never claims a message was sent.

## Adding products

Products are data, so new items don't touch the rendering engines.

| Experience | Config file | Notes |
| --- | --- | --- |
| Jewellery | `src/config/catalog.ts`, `src/config/models.ts` | Add a GLB to `public/models/` with materials named after `lib/three/materials.ts`, in centimetres, in its anchor's frame |
| Watches | `src/config/watches.ts` | Parametric geometry plus default options, or a GLB source; `options` lists what can be customised |
| T-shirts | `src/features/tshirt/design.ts` | Colours, fonts, styles |
| Curtains | `src/config/curtains.ts` | Style, heading, weave, pattern, sample rooms with measured windows |
| Try-on backgrounds | `src/config/backgrounds.ts` | Solid, studio gradient or image |

## How each experience works

**Jewellery.** MediaPipe's facial transformation matrix maps canonical face coordinates (centimetres) into a 63° pinhole camera, so models sit at real scale. Anchors are refined per frame from nearby landmarks, and One Euro filters remove jitter. Necklaces sit on the wearer's measured neck: `neckFit.ts` samples the person's skin tone from the cheeks, then scans below the chin for the neck's width, centre and the collar or shoulder line. Pose landmarks, then a head-based estimate, are the fallbacks. A depth-only shoulder crest lets chains pass out of sight beside the neck. Depth-only occluders hide what is behind the head and neck. The selfie segmenter drives background replacement on a compositor canvas beneath the WebGL layer, so tracking and the overlay are unaffected.

**Watches.** `ParametricWatch` builds case, lugs, crown, bezel, crystal, dial, hands, movement and strap in millimetres and rebuilds only what an option changes. Straps drape along the display cushion's cross-section, measured from the GLB's vertices. `ReferenceChronograph` drives the reference GLB with the same option set.

**T-shirts.** Each style (3 fits × 2 sleeve lengths × 5 necklines) is a real sewing pattern (`garment/pattern.ts`): front, back and two sleeves drafted in centimetres, with sleeve caps solved to match their armholes. `scripts/garment/bake.ts` sews the panels and drapes them over a dress form with a position-based cloth simulation, bakes ambient occlusion, and writes `public/garment/<style>.bin` (110 KB each). At runtime `garment/mesh.ts` builds the cloth, rib collar, hems turned up to show their thickness, seam lines, twin-needle stitching, plackets and buttons; `garment/fabric.ts` generates tiling knit normal maps per fabric. Changing style morphs between drapes. Prints are drawn on transparent canvases mapped through the flat pattern at 28 px per cm, so artwork keeps its true size and the print files are print-ready.

Rebaking all 30 styles takes about 12 minutes on six cores:

```bash
for f in regular oversized slim; do for s in half full; do for n in round vneck scoop polo henley; do echo "$f-$s-$n"; done; done; done | xargs -P 6 -I{} npx tsx scripts/garment/bake.ts {}
```

**Curtains.** The page is three steps: choose a room (a sample or the customer's own photo), choose a curtain, then compare before and after with a slider and adjust width, length, height and opening. Windows in uploaded photos are found by brightness and shape analysis, by MediaPipe's interactive segmenter on a tap ("Find it"), or by dragging corners and edges. The quad gives a homography, decomposed into a camera pose (`npx tsx scripts/tests/curtain-pose.test.ts` verifies reprojection). Fabric is real 3D cloth rendered over the photo. Daylight measured from the window in the photo glows through the cloth in proportion to the weave, and sheers let the view show through. No generative AI is involved; a remote model could replace `detectWindowAt` behind the same return type.

## Asset pipeline

```bash
npm run models                 # rebuild jewellery GLBs from src/lib/three/builders
node scripts/thumbnails.mjs    # jewellery card images (dev server running; needs Playwright + Pillow)
node scripts/watch-thumbs.mjs  # watch thumbnails from the live configurator
node scripts/showcase.mjs      # homepage and navigation images
node scripts/curtain-thumbs.mjs # curtain card images, rendered by the real curtain engine
npx tsx scripts/optimize-glb.ts in.glb out.glb [nodeToRemove,...]
```

## Asset licensing

- **Photography** (`public/backgrounds`, `industries`, `rooms`): Unsplash and Pexels licences, recorded with authors in `image-credits.json`.
- **Jewellery and parametric watch models:** original, generated by this project.
- **Reference chronograph** (`public/watches/chronograph.glb`) and **studio HDRI** (`public/hdr/studio.hdr`): extracted from the supplied SAMAY demo; their licence is unverified. The source model reproduced a Rolex Daytona, including the Rolex coronet and dial text. Those parts were removed from the shipped file, but the overall design remains recognisable. Confirm the rights, or remove the `meridian-chrono` entry from `src/config/watches.ts`, before public use.

## Project structure

```
src/
  config/      site, catalogue, models, watches, curtains, backgrounds
  pages/       Home, JewelleryStudio, Watches, TShirtStudio, CurtainVisualizer, About, Contact
  components/  site shell, try-on, catalogue, 3D viewer
  features/    watch, tshirt, curtains engines
  lib/         tracking (MediaPipe, anchors, filters) and three (materials, loaders, builders)
scripts/       asset pipeline and tests
```
