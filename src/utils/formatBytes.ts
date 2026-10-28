const UNITS = ['B', 'KB', 'MB', 'GB'] as const
const UNIT_SIZE = 1000

export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (unit < UNITS.length - 1 && (value >= UNIT_SIZE || (unit > 0 && Math.round(value * 100) / 100 >= UNIT_SIZE))) {
    value /= UNIT_SIZE
    unit++
  }
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${UNITS[unit]}`
}
