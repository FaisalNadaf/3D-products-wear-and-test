/**
 * Try-on presentation backgrounds. "original" shows the real camera scene;
 * everything else replaces the room behind the person using on-device
 * person segmentation.
 */
export type BackgroundKind = 'original' | 'solid' | 'studio' | 'image' | 'custom';

export interface BackgroundOption {
  id: string;
  label: string;
  kind: BackgroundKind;
  group: 'Original' | 'Colours' | 'Luxury studio' | 'Interiors' | 'Yours';
  /** solid colour, or studio base colour */
  color?: string;
  /** studio gradient stops: centre → edge, plus floor tone */
  studio?: { centre: string; edge: string; floor: string };
  /** image url (interiors) */
  src?: string;
  /** css preview for the swatch */
  preview: string;
}

const B = import.meta.env.BASE_URL;

export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'original', label: 'Original', kind: 'original', group: 'Original', preview: 'linear-gradient(135deg,#d9d4cb,#b9b2a6)' },
  { id: 'white', label: 'Pure White', kind: 'solid', group: 'Colours', color: '#ffffff', preview: '#ffffff' },
  { id: 'ivory', label: 'Ivory', kind: 'solid', group: 'Colours', color: '#f7f1e6', preview: '#f7f1e6' },
  { id: 'champagne', label: 'Champagne', kind: 'solid', group: 'Colours', color: '#e8d6b3', preview: '#e8d6b3' },
  { id: 'beige', label: 'Beige', kind: 'solid', group: 'Colours', color: '#dccbb2', preview: '#dccbb2' },
  { id: 'grey', label: 'Light Grey', kind: 'solid', group: 'Colours', color: '#e1e1df', preview: '#e1e1df' },
  { id: 'pink', label: 'Soft Pink', kind: 'solid', group: 'Colours', color: '#f2d9d7', preview: '#f2d9d7' },
  { id: 'black', label: 'Black', kind: 'solid', group: 'Colours', color: '#121212', preview: '#121212' },
  {
    id: 'studio-ivory',
    label: 'Ivory Studio',
    kind: 'studio',
    group: 'Luxury studio',
    studio: { centre: '#fffdf8', edge: '#e3d6c1', floor: '#d8c8ae' },
    preview: 'radial-gradient(circle at 50% 38%,#fffdf8,#e3d6c1)',
  },
  {
    id: 'studio-champagne',
    label: 'Champagne Silk',
    kind: 'studio',
    group: 'Luxury studio',
    studio: { centre: '#f7ead1', edge: '#c7a876', floor: '#b8975f' },
    preview: 'radial-gradient(circle at 50% 38%,#f7ead1,#c7a876)',
  },
  {
    id: 'studio-blush',
    label: 'Blush Satin',
    kind: 'studio',
    group: 'Luxury studio',
    studio: { centre: '#fbeeee', edge: '#dcb8b4', floor: '#cfa7a2' },
    preview: 'radial-gradient(circle at 50% 38%,#fbeeee,#dcb8b4)',
  },
  {
    id: 'studio-noir',
    label: 'Noir Velvet',
    kind: 'studio',
    group: 'Luxury studio',
    studio: { centre: '#3a3330', edge: '#0d0b0a', floor: '#1a1614' },
    preview: 'radial-gradient(circle at 50% 38%,#3a3330,#0d0b0a)',
  },
  ...['boutique', 'salon', 'lounge', 'gallery'].map(
    (id): BackgroundOption => ({
      id: `interior-${id}`,
      label: { boutique: 'Jewellery Boutique', salon: 'Bridal Salon', lounge: 'Hotel Lounge', gallery: 'Marble Gallery' }[id]!,
      kind: 'image',
      group: 'Interiors',
      src: `${B}backgrounds/${id}.webp`,
      preview: `center/cover url(${B}backgrounds/${id}-thumb.webp)`,
    }),
  ),
];

export const findBackground = (id: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
