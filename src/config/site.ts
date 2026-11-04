/** Global site configuration: navigation, experiences and contact settings. */
export const SITE = {
  name: 'Cubiccode',
  tagline: '3D product visualization & customization studio',
  url: 'https://cubiccode.org',
  /** inquiries are POSTed here as JSON when configured (e.g. a serverless function or form service) */
  contactEndpoint: import.meta.env.VITE_CONTACT_ENDPOINT as string | undefined,
  /** used for the mail-client fallback when no endpoint is configured */
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? '',
};

export interface Experience {
  id: 'jewellery' | 'watches' | 'tshirt' | 'curtains';
  path: string;
  title: string;
  short: string;
  description: string;
  image: string;
  features: string[];
}

export const EXPERIENCES: Experience[] = [
  {
    id: 'jewellery',
    path: '/jewellery',
    title: 'Jewellery Studio',
    short: 'Virtual try-on with live face tracking',
    description:
      'Earrings, necklaces, nose rings and maang tikka placed on the shopper’s face in real time, with person segmentation for studio backgrounds.',
    image: '/showcase/jewellery.webp',
    features: ['Live face & shoulder tracking', '34 PBR jewellery models', 'Background replacement', 'High-res capture'],
  },
  {
    id: 'watches',
    path: '/watches',
    title: '3D Watches',
    short: 'Luxury watch configurator',
    description:
      'An immersive timepiece configurator: case metals, dials, bezels, hands and straps update instantly, with hotspots, camera presets and an exploded view.',
    image: '/showcase/watches.webp',
    features: ['Real-time material swaps', 'Exploded component view', 'Live-ticking hands', 'Camera presets'],
  },
  {
    id: 'tshirt',
    path: '/tshirt',
    title: 'T-Shirt Studio',
    short: 'Design apparel directly on a 3D garment',
    description:
      'Customers design front, back and sleeves with text, logos and graphics, see every change on a 3D tee, and export print-ready files.',
    image: '/showcase/tshirt.webp',
    features: ['Fit, sleeve & neck styles', 'Text, logo & layer editor', 'Undo / redo & saved designs', 'Print-ready export'],
  },
  {
    id: 'curtains',
    path: '/curtains',
    title: 'Curtain Visualizer',
    short: 'See curtains in your own room',
    description:
      'Upload a room photo, detect the window with on-device segmentation, and visualize pleated, sheer, blackout and blind styles in true perspective.',
    image: '/showcase/curtains.webp',
    features: ['On-device window detection', 'Perspective-correct rendering', 'Open / close & length controls', 'Before / after compare'],
  },
];

export const NAV = [
  { label: 'Home', path: '/' },
  { label: 'Experiences', path: '/jewellery', children: EXPERIENCES },
  { label: 'Capabilities', path: '/about' },
  { label: 'Contact', path: '/contact' },
];
