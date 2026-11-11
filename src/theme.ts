export const colors = {
  bg: '#F5F3EE',
  surface: '#FFFFFF',
  ink: '#191C24',
  inkSoft: '#3A3F4C',
  muted: '#7A7F8C',
  line: '#E6E2D8',
  record: '#E5484D',
  recordSoft: '#FDECEC',
  ok: '#2F855A',
  okSoft: '#E6F4EC',
  warn: '#B7791F',
  warnSoft: '#FBF1DE',
  danger: '#C53030',
  dangerSoft: '#FCE8E8',
};

// Cores das descrições de áudio (usadas em ordem quando você cria uma nova)
export const categoryPalette = [
  '#0F766E', // verde-petróleo
  '#C2410C', // laranja queimado
  '#6D28D9', // violeta
  '#1D4ED8', // azul
  '#BE185D', // framboesa
  '#4D7C0F', // oliva
];

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const font = {
  title: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6, color: colors.ink },
  h2: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.8, color: colors.muted },
  body: { fontSize: 16, color: colors.ink },
  small: { fontSize: 13, color: colors.muted },
  mono: { fontVariant: ['tabular-nums' as const] },
};

/** Cor com transparência a partir de um hex (#RRGGBB). */
export function tint(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
