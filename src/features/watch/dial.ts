import { CanvasTexture, Color, SRGBColorSpace } from 'three';
import type { DialLayout, WatchSpec } from '../../config/watches';

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface DialPrint {
  texture: CanvasTexture;
  /** dial is transparent where the movement shows through */
  transparent: boolean;
}

/** Luminance-aware print colour so text reads on any dial colour. */
const printColor = (dial: string) => (new Color(dial).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? '#1d1f26' : '#f3f1ea');

/**
 * Paints the dial at 2048 px: base finish, minute track, brand/model text,
 * printed numerals, sub-dial rings, date windows and skeleton cut-outs.
 * The canvas maps 1:1 onto the dial disc (top of canvas = 12 o'clock).
 */
export function paintDial(spec: WatchSpec, layout: DialLayout, model: string): DialPrint {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const R = S / 2;
  const ink = printColor(spec.dialColor);
  const skeleton = spec.dialFinish === 'skeleton';
  ctx.translate(R, R);

  // base
  const base = new Color(spec.dialColor);
  if (!skeleton) {
    if (spec.dialFinish === 'enamel') {
      const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 0, 0, 0, R);
      g.addColorStop(0, base.clone().offsetHSL(0, 0, 0.04).getStyle());
      g.addColorStop(1, base.clone().offsetHSL(0, 0, -0.03).getStyle());
      ctx.fillStyle = g;
    } else ctx.fillStyle = spec.dialColor;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    if (spec.dialFinish === 'sunray') {
      // fine radial brushing (the anisotropic highlight does the rest)
      for (let i = 0; i < 1440; i++) {
        const a = (i / 1440) * Math.PI * 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.012 + 0.03 * Math.abs(Math.sin(a * 3))})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        ctx.stroke();
      }
      const v = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
      v.addColorStop(0, 'rgba(255,255,255,0.06)');
      v.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = v;
      ctx.fill();
    }
    if (spec.dialFinish === 'matte') {
      for (let i = 0; i < 40000; i++) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.025)`;
        ctx.fillRect(Math.random() * S - R, Math.random() * S - R, 2, 2);
      }
    }
  } else {
    // skeleton: opaque chapter ring + bridges, open centre
    ctx.fillStyle = spec.dialColor;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.lineWidth = R * 0.05;
    ctx.strokeStyle = new Color(spec.dialColor).offsetHSL(0, 0, 0.12).getStyle();
    for (const a of [0.35, 2.2, 4.1]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18);
      ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.5, Math.sin(a + 0.5) * R * 0.5, Math.cos(a + 0.2) * R * 0.82, Math.sin(a + 0.2) * R * 0.82);
      ctx.stroke();
    }
  }

  // minute track
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const five = i % 5 === 0;
    ctx.lineWidth = five ? 9 : 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.955, Math.sin(a) * R * 0.955);
    ctx.lineTo(Math.cos(a) * R * (five ? 0.885 : 0.915), Math.sin(a) * R * (five ? 0.885 : 0.915));
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.96, 0, Math.PI * 2);
  ctx.stroke();

  // printed numerals
  if (spec.markers === 'roman' || spec.markers === 'arabic') {
    const roman = spec.markers === 'roman';
    ctx.font = roman ? `500 ${R * 0.15}px "Cormorant Garamond Variable", Georgia, serif` : `700 ${R * 0.2}px "Manrope Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      if (layout === 'small-seconds' && i === 6) continue;
      if (spec.date && layout !== 'chrono' && i === 3) continue;
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const r = R * (roman ? 0.74 : 0.7);
      ctx.save();
      ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
      if (roman) ctx.rotate(a + Math.PI / 2);
      ctx.fillText(roman ? ROMAN[i] : String(i === 0 ? 12 : i), 0, 0);
      ctx.restore();
    }
  }

  // brand + model
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${R * 0.07}px "Manrope Variable", system-ui, sans-serif`;
  ctx.letterSpacing = `${R * 0.012}px`;
  ctx.fillText('CUBICCODE', 0, -R * 0.42);
  ctx.font = `500 ${R * 0.042}px "Manrope Variable", system-ui, sans-serif`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(model.toUpperCase(), 0, R * (layout === 'small-seconds' || layout === 'chrono' ? 0.24 : 0.36));
  ctx.fillText(skeleton ? 'SKELETON' : 'AUTOMATIC', 0, R * (layout === 'small-seconds' || layout === 'chrono' ? 0.3 : 0.42));
  ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';

  // sub-dials
  const sub = (x: number, y: number, r: number) => {
    ctx.fillStyle = new Color(spec.dialColor).offsetHSL(0, 0, -0.05).getStyle();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      ctx.lineWidth = i % 5 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
      ctx.lineTo(x + Math.cos(a) * r * (i % 5 ? 0.82 : 0.74), y + Math.sin(a) * r * (i % 5 ? 0.82 : 0.74));
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.96, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (layout === 'small-seconds') sub(0, R * 0.5, R * 0.24);
  if (layout === 'chrono') {
    sub(0, R * 0.5, R * 0.22);
    sub(R * 0.5, 0, R * 0.22);
    sub(-R * 0.5, 0, R * 0.22);
  }

  // date / day windows
  const now = new Date();
  const window = (x: number, y: number, w: number, h: number, text: string) => {
    ctx.fillStyle = '#f7f5ef';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#b9b5aa';
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#16181d';
    ctx.font = `700 ${h * 0.68}px "Manrope Variable", system-ui, sans-serif`;
    ctx.fillText(text, x, y + h * 0.04);
  };
  if (spec.date && layout !== 'chrono') window(R * 0.66, 0, R * 0.17, R * 0.13, String(now.getDate()));
  if (layout === 'day-date') window(0, -R * 0.66, R * 0.3, R * 0.12, DAYS[now.getDay()]);

  const texture = new CanvasTexture(c);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
  return { texture, transparent: skeleton };
}

/** Diver / tachymeter bezel insert printed around a ring (planar UVs). */
export function paintBezelInsert(kind: 'diver' | 'tachymeter', hex: string): CanvasTexture {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const R = S / 2;
  ctx.translate(R, R);
  ctx.fillStyle = hex;
  ctx.fillRect(-R, -R, S, S);
  const ink = printColor(hex) === '#1d1f26' ? '#1d1f26' : '#f1e6c8';
  ctx.fillStyle = ctx.strokeStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rText = R * 0.93;
  if (kind === 'diver') {
    ctx.font = `700 ${R * 0.075}px "Manrope Variable", system-ui, sans-serif`;
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.rotate(a + Math.PI / 2);
      if (m === 0) {
        ctx.beginPath();
        ctx.moveTo(0, -rText - R * 0.035);
        ctx.lineTo(R * 0.04, -rText + R * 0.04);
        ctx.lineTo(-R * 0.04, -rText + R * 0.04);
        ctx.fill();
      } else if (m % 10 === 0) ctx.fillText(String(m), 0, -rText);
      else if (m % 5 === 0 || m < 15) {
        ctx.fillRect(-R * 0.006, -rText - R * 0.03, R * 0.012, R * (m % 5 === 0 ? 0.06 : 0.04));
      }
      ctx.restore();
    }
  } else {
    ctx.font = `600 ${R * 0.05}px "Manrope Variable", system-ui, sans-serif`;
    for (const v of [500, 400, 300, 240, 200, 180, 160, 150, 140, 130, 120, 110, 100, 90, 85, 80, 75, 70, 65, 60]) {
      const a = (3600 / v / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(String(v), 0, -rText + R * 0.01);
      ctx.fillRect(-R * 0.004, -rText - R * 0.045, R * 0.008, R * 0.025);
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(-0.35);
    ctx.font = `600 ${R * 0.032}px "Manrope Variable", system-ui, sans-serif`;
    ctx.fillText('TACHYMETRE', 0, -rText);
    ctx.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
