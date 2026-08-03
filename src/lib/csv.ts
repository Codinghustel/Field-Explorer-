import type { EntityOption, FieldRow } from '@/types'

const HEADERS = [
  'Entity type',
  'Field label',
  'Field code',
  'Original field code',
  'Field type',
  'Field source',
  'Required',
  'Multiple',
  'Read only',
  'Immutable',
  'Field settings'
]

function preventFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function csvCell(value: unknown): string {
  const safe = preventFormula(value === null || value === undefined ? '' : String(value))
  return `"${safe.replace(/"/g, '""')}"`
}

export function createFieldsCsv(rows: FieldRow[], context: EntityOption): string {
  const dataRows = rows.map((row) => [
    context.label,
    row.label,
    row.code,
    row.upperName,
    row.type,
    row.custom ? 'Custom' : 'System',
    row.required ? 'Yes' : 'No',
    row.multiple ? 'Yes' : 'No',
    row.readOnly ? 'Yes' : 'No',
    row.immutable ? 'Yes' : 'No',
    Object.keys(row.settings).length ? JSON.stringify(row.settings) : ''
  ])

  return `\uFEFF${[HEADERS, ...dataRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}

export function csvFilename(context: EntityOption, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10)
  const entity = context.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `bitrix24-${entity}-fields-${stamp}.csv`
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
