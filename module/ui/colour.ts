// Colour helpers: hex tokens with opacity.

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Mixes a colour toward a ground colour, for marks drawn without transparency. */
export function mix(hex: string, ground: string, amount: number): string {
  const parse = (c: string) => {
    const h = c.replace('#', '');
    const full = h.length === 3 ? [...h].map((x) => x + x).join('') : h.slice(0, 6);
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = parse(hex);
  const b = parse(ground);
  const m = a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}
