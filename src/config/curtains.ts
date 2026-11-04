/** Curtain & blind catalogue. Every style is rendered as a real 3D cloth mesh. */
export type Header = 'pinch' | 'eyelet' | 'wave' | 'box' | 'roman' | 'roller';
export type Weave = 'linen' | 'cotton' | 'velvet' | 'sheer' | 'blackout' | 'silk';
export type Pattern = 'plain' | 'stripe' | 'damask' | 'trellis' | 'floral' | 'herringbone';

export interface CurtainStyle {
  id: string;
  name: string;
  type: string;
  header: Header;
  weave: Weave;
  pattern: Pattern;
  color: string;
  /** fabric fullness (flat width ÷ track width) */
  fullness: number;
  price: number;
  description: string;
}

export const CURTAINS: CurtainStyle[] = [
  { id: 'voile-sheer', name: 'Aria Voile Sheer', type: 'Sheer Curtains', header: 'wave', weave: 'sheer', pattern: 'plain', color: '#f4f1ea', fullness: 2.4, price: 3400, description: 'A light voile that diffuses daylight and keeps the view.' },
  { id: 'nocturne-blackout', name: 'Nocturne Blackout', type: 'Blackout Curtains', header: 'pinch', weave: 'blackout', pattern: 'plain', color: '#2f3442', fullness: 2, price: 5200, description: 'A triple-weave blackout fabric that blocks light completely.' },
  { id: 'belgian-linen', name: 'Belgian Linen', type: 'Linen Curtains', header: 'pinch', weave: 'linen', pattern: 'plain', color: '#d9cdb8', fullness: 2.2, price: 6800, description: 'Stone-washed linen with a natural slub texture.' },
  { id: 'cotton-stripe', name: 'Cabana Cotton Stripe', type: 'Cotton Curtains', header: 'pinch', weave: 'cotton', pattern: 'stripe', color: '#e9e3d6', fullness: 2, price: 3900, description: 'Brushed cotton with a woven deck stripe.' },
  { id: 'regal-velvet', name: 'Regal Velvet', type: 'Velvet Curtains', header: 'box', weave: 'velvet', pattern: 'plain', color: '#1f4d3a', fullness: 2.2, price: 9400, description: 'A deep-pile velvet with a soft sheen in its folds.' },
  { id: 'loft-eyelet', name: 'Loft Eyelet', type: 'Eyelet Curtains', header: 'eyelet', weave: 'cotton', pattern: 'herringbone', color: '#8a8f98', fullness: 1.8, price: 4200, description: 'Herringbone weave with brushed-steel eyelets on a metal pole.' },
  { id: 'atelier-pleated', name: 'Atelier Box Pleat', type: 'Pleated Curtains', header: 'box', weave: 'silk', pattern: 'plain', color: '#c9b08a', fullness: 2.5, price: 8600, description: 'Tailored box pleats in a silk-blend faille.' },
  { id: 'roman-linen', name: 'Coastal Roman Blind', type: 'Roman Blinds', header: 'roman', weave: 'linen', pattern: 'plain', color: '#e8dfcf', fullness: 1, price: 7400, description: 'Fitted inside the window recess; raises into flat, even folds.' },
  { id: 'roller-screen', name: 'Daylight Roller Blind', type: 'Roller Blinds', header: 'roller', weave: 'cotton', pattern: 'plain', color: '#f2efe8', fullness: 1, price: 2900, description: 'A clean light-filtering roller blind with a weighted bottom bar.' },
  { id: 'heritage-damask', name: 'Heritage Damask', type: 'Traditional Curtains', header: 'pinch', weave: 'silk', pattern: 'damask', color: '#7a2433', fullness: 2.4, price: 11200, description: 'A jacquard damask with tonal ornament, made in the classic pinch-pleat style.' },
  { id: 'modern-wave', name: 'Modern Wave Trellis', type: 'Modern Curtains', header: 'wave', weave: 'cotton', pattern: 'trellis', color: '#e6ddd0', fullness: 2.2, price: 5600, description: 'A geometric trellis on a ripple-fold track that hangs in even waves.' },
  { id: 'garden-floral', name: 'Garden Floral', type: 'Cotton Curtains', header: 'eyelet', weave: 'cotton', pattern: 'floral', color: '#f1e9dc', fullness: 1.9, price: 4800, description: 'A printed botanical on soft cotton sateen.' },
];

/** Plain-language colour names shown to customers. */
export const COLOR_NAMES: Record<string, string> = {
  '#f4f1ea': 'Ivory',
  '#f2efe8': 'Chalk',
  '#f1e9dc': 'Shell',
  '#e9e3d6': 'Cream',
  '#e8dfcf': 'Sand',
  '#e6ddd0': 'Oat',
  '#d9cdb8': 'Flax',
  '#c9b08a': 'Camel',
  '#8a8f98': 'Steel',
  '#2f3442': 'Midnight',
  '#1f4d3a': 'Forest',
  '#2a4f6e': 'Ocean',
  '#7a2433': 'Burgundy',
  '#b8865a': 'Caramel',
  '#e7c9c2': 'Blush',
  '#3a3a3c': 'Charcoal',
};

export const CURTAIN_COLORS = ['#f4f1ea', '#e8dfcf', '#d9cdb8', '#c9b08a', '#8a8f98', '#2f3442', '#1f4d3a', '#2a4f6e', '#7a2433', '#b8865a', '#e7c9c2', '#3a3a3c'];
export const WEAVES: { id: Weave; label: string }[] = [
  { id: 'linen', label: 'Linen' },
  { id: 'cotton', label: 'Cotton' },
  { id: 'velvet', label: 'Velvet' },
  { id: 'silk', label: 'Silk faille' },
  { id: 'sheer', label: 'Sheer voile' },
  { id: 'blackout', label: 'Blackout' },
];
export const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'herringbone', label: 'Herringbone' },
  { id: 'trellis', label: 'Trellis' },
  { id: 'damask', label: 'Damask' },
  { id: 'floral', label: 'Floral' },
];
export const HEADERS: { id: Header; label: string }[] = [
  { id: 'pinch', label: 'Pinch pleat' },
  { id: 'box', label: 'Box pleat' },
  { id: 'wave', label: 'Wave' },
  { id: 'eyelet', label: 'Eyelet' },
  { id: 'roman', label: 'Roman blind' },
  { id: 'roller', label: 'Roller blind' },
];

const B = import.meta.env.BASE_URL;
/** Sample rooms ship with measured window corners (TL, TR, BR, BL, normalised). */
export const SAMPLE_ROOMS: { id: string; label: string; src: string; thumb: string; quad: [number, number][]; floorY: number; mount?: number; extend?: number }[] = [
  { id: 'bright', label: 'Bright room', src: `${B}rooms/bright-room-centred-window.webp`, thumb: `${B}rooms/bright-room-centred-window-640w.webp`, quad: [[0.3464, 0.1929], [0.6371, 0.1929], [0.6371, 0.6967], [0.3464, 0.6967]], floorY: 0.7588, mount: 0.07, extend: 0.3 },
  { id: 'grey', label: 'Grey room', src: `${B}rooms/grey-room-bare-window.webp`, thumb: `${B}rooms/grey-room-bare-window-640w.webp`, quad: [[0.07, 0.369], [0.333, 0.386], [0.333, 0.567], [0.07, 0.577]], floorY: 0.715 },
  { id: 'warm', label: 'Warm room', src: `${B}rooms/warm-living-room-twin-windows.webp`, thumb: `${B}rooms/warm-living-room-twin-windows-640w.webp`, quad: [[0.318, 0.272], [0.447, 0.272], [0.447, 0.545], [0.318, 0.545]], floorY: 0.72 },
  { id: 'modern', label: 'Modern room', src: `${B}rooms/modern-living-room-black-windows.webp`, thumb: `${B}rooms/modern-living-room-black-windows-640w.webp`, quad: [[0.237, 0.314], [0.35, 0.322], [0.35, 0.52], [0.237, 0.52]], floorY: 0.615 },
];

export interface CurtainSettings {
  style: CurtainStyle;
  weave: Weave;
  pattern: Pattern;
  color: string;
  header: Header;
  /** 0 = closed, 1 = fully open */
  open: number;
  /** extra track width each side, as fraction of window width */
  extend: number;
  /** drop below the window bottom, metres (0 = sill) */
  drop: number;
  /** distance from window bottom to the floor, metres */
  floor: number;
  fullness: number;
  /** mount height above the window top, metres */
  mount: number;
}

export const settingsFor = (s: CurtainStyle, prev?: Partial<CurtainSettings>): CurtainSettings => ({
  style: s,
  weave: s.weave,
  pattern: s.pattern,
  color: s.color,
  header: s.header,
  open: s.header === 'roman' || s.header === 'roller' ? 0.45 : 0.68,
  extend: prev?.extend ?? 0.26,
  drop: prev?.drop ?? 0.9,
  floor: prev?.floor ?? 0.9,
  fullness: s.fullness,
  mount: prev?.mount ?? 0.14,
});
