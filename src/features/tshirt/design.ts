/** T-shirt design document: garment options + an ordered list of print layers. */
export type Fit = 'regular' | 'oversized' | 'slim';
export type Sleeve = 'half' | 'full';
export type Neck = 'round' | 'vneck' | 'scoop' | 'polo' | 'henley';
export type Fabric = 'cotton' | 'heather' | 'washed' | 'pique' | 'slub';
export type Side = 'front' | 'back';
export type Zone = 'body' | 'sleeveL' | 'sleeveR';
export type Align = 'left' | 'center' | 'right';

export interface Layer {
  id: string;
  type: 'text' | 'image' | 'shape';
  name: string;
  side: Side;
  zone: Zone;
  x: number;
  y: number;
  /** scale */
  s: number;
  /** rotation, degrees */
  r: number;
  /** opacity */
  a: number;
  flip: boolean;
  visible: boolean;
  locked: boolean;
  // text
  text?: string;
  font?: string;
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  align?: Align;
  // image
  src?: string;
  w?: number;
  h?: number;
  // shape
  shape?: 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'badge';
}

export interface Design {
  color: string;
  fit: Fit;
  sleeve: Sleeve;
  neck: Neck;
  fabric: Fabric;
  collarColor: string | null;
  sleeveColor: string | null;
  layers: Layer[];
}

export const FONTS = ['Archivo Black', 'Bebas Neue', 'Permanent Marker', 'Playfair Display', 'Caveat', 'Space Mono', 'Cormorant Garamond Variable', 'Manrope Variable'];

export const TEE_COLORS: { id: string; label: string }[] = [
  { id: '#ffffff', label: 'White' },
  { id: '#f2efe6', label: 'Natural' },
  { id: '#141416', label: 'Black' },
  { id: '#b5302a', label: 'Red' },
  { id: '#2a4f9a', label: 'Blue' },
  { id: '#1f4d3a', label: 'Green' },
  { id: '#e8c547', label: 'Yellow' },
  { id: '#2b3a55', label: 'Navy' },
  { id: '#8a8f98', label: 'Grey marl' },
  { id: '#e9a8b4', label: 'Pink' },
  { id: '#6b7f5e', label: 'Olive' },
  { id: '#5a3d2e', label: 'Brown' },
];

export const STYLE_OPTIONS = {
  fit: [
    { id: 'regular', label: 'Regular fit' },
    { id: 'oversized', label: 'Oversized' },
    { id: 'slim', label: 'Slim fit' },
  ],
  sleeve: [
    { id: 'half', label: 'Half sleeve' },
    { id: 'full', label: 'Full sleeve' },
  ],
  neck: [
    { id: 'round', label: 'Round neck' },
    { id: 'vneck', label: 'V-neck' },
    { id: 'polo', label: 'Polo' },
    { id: 'scoop', label: 'Scoop' },
    { id: 'henley', label: 'Henley' },
  ],
  fabric: [
    { id: 'cotton', label: 'Combed jersey' },
    { id: 'heather', label: 'Heather marl' },
    { id: 'washed', label: 'Garment washed' },
    { id: 'slub', label: 'Slub cotton' },
    { id: 'pique', label: 'Cotton piqué' },
  ],
} as const;

export const newId = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_DESIGN: Design = {
  color: '#f2efe6',
  fit: 'regular',
  sleeve: 'half',
  neck: 'round',
  fabric: 'cotton',
  collarColor: null,
  sleeveColor: null,
  layers: [
    {
      id: 'starter',
      type: 'text',
      name: 'MADE TO WEAR',
      side: 'front',
      zone: 'body',
      x: 768,
      y: 780,
      s: 1,
      r: 0,
      a: 1,
      flip: false,
      visible: true,
      locked: false,
      text: 'MADE\nTO WEAR',
      font: 'Archivo Black',
      size: 230,
      fill: '#e8431c',
      stroke: '#111111',
      strokeWidth: 0,
      align: 'center',
    },
  ],
};
