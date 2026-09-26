export interface DiveOrigin {
  x: number;
  y: number;
  /** Distance from (x, y) to the nearest non-ink pixel: how wide the stroke is there. */
  radius: number;
}

/**
 * The ink pixel furthest from any paper (two-pass chamfer distance transform), weighted
 * towards the horizontal centre so the dive feels central. `mask[i]` truthy = ink.
 */
export function deepestPoint(mask: ArrayLike<number>, w: number, h: number): DiveOrigin | null {
  if (w <= 0 || h <= 0) return null;
  const INF = 1e9, D = Math.SQRT2, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
    }
  let best = 0, bx = -1, by = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = d[y * w + x] * (1 - 0.5 * Math.abs(x / w - 0.5));
      if (v > best) [best, bx, by] = [v, x, y];
    }
  return bx < 0 ? null : { x: bx, y: by, radius: d[by * w + bx] };
}

export const DIVE_TIMING = { pre: 280, dive: 1700 } as const;

const easeInOutCubic = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/**
 * Scale and opacity of the paper layer `t` ms into the dive. A small pull-back, then an
 * exponential zoom (reads as constant camera speed). `cover` is the scale at which the
 * stroke fills the screen: the paper stays opaque until then, then fades.
 */
export function diveFrame(t: number, cover: number): { scale: number; opacity: number; done: boolean } {
  const { pre, dive } = DIVE_TIMING;
  const base = 0.965, c = Math.max(cover, 1.5), end = c * 2.2;
  if (t < pre) return { scale: 1 - (1 - base) * Math.sin((Math.PI / 2) * (t / pre)), opacity: 1, done: false };
  const u = Math.min(1, (t - pre) / dive);
  const scale = base * Math.pow(end / base, easeInOutCubic(u));
  const opacity = scale < c ? 1 : Math.max(0, 1 - Math.log(scale / c) / Math.log(end / c));
  return { scale, opacity, done: u >= 1 };
}

/**
 * Rasterise the knockout word (one `<i>` per glyph, so letter-spacing is exact) at
 * `scale` and find its thickest stroke, in viewport pixels. Call after
 * `document.fonts.ready` and before the word is transformed.
 */
export function measureDiveOrigin(word: HTMLElement, scale = 0.25): DiveOrigin | null {
  const box = word.getBoundingClientRect();
  const W = Math.ceil(box.width * scale), H = Math.ceil(box.height * scale);
  if (W < 2 || H < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const cx = canvas.getContext("2d", { willReadFrequently: true });
  if (!cx) return null;
  const cs = getComputedStyle(word);
  cx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`;
  cx.textBaseline = "alphabetic";
  for (const glyph of word.querySelectorAll("i")) {
    const ch = glyph.textContent ?? "";
    if (!ch.trim()) continue;
    const r = glyph.getBoundingClientRect(), m = cx.measureText(ch);
    // CSS centres the font's content area in the line box, so the baseline sits here:
    const baseline = (r.top - box.top) * scale + (r.height * scale + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    cx.fillText(ch, (r.left - box.left) * scale, baseline);
  }
  const px = cx.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 128 ? 1 : 0;
  const p = deepestPoint(mask, W, H);
  return p && { x: box.left + p.x / scale, y: box.top + p.y / scale, radius: p.radius / scale };
}
