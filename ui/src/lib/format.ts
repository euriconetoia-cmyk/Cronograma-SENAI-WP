/** Data e hora gravadas pelo servidor (UTC, "AAAA-MM-DD HH:MM:SS") no horário do navegador. */
export function quando(s?: string) {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T').replace(/Z$/, '') + 'Z')
  if (isNaN(+d)) return s
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
export const dataBr = (s?: string) => (s ? s.split('-').reverse().join('/') : '')
