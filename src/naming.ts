const pad = (n: number) => String(n).padStart(2, '0');

/** 04/11/2026 */
export function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 07:32 */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 03:07 ou 1:03:07 */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Nome base do arquivo: "DESCRIÇÃO DO ÁUDIO" + " " + dd/mm/aaaa
 * Ex.: "BUSCANDO JOSÉ 04/11/2026"
 * A data é a do INÍCIO da gravação.
 */
export function buildBaseName(categoryLabel: string, startedAt: Date): string {
  return `${categoryLabel.trim().toUpperCase()} ${formatDate(startedAt)}`;
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "quarta, 4 de novembro" */
export function formatLongDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}
