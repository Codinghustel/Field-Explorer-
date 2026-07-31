import type { FieldMetadata, FieldRow } from '@/types'

export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function valueForField(code: string, metadata: FieldMetadata, item: Record<string, unknown>): unknown {
  if (Object.hasOwn(item, code)) return item[code]
  if (metadata.upperName && Object.hasOwn(item, metadata.upperName)) return item[metadata.upperName]
  const caseInsensitiveKey = Object.keys(item).find((key) => key.toLowerCase() === code.toLowerCase())
  return caseInsensitiveKey ? item[caseInsensitiveKey] : undefined
}

export function normalizeFields(
  metadata: Record<string, FieldMetadata>,
  item: Record<string, unknown>
): FieldRow[] {
  return Object.entries(metadata)
    .map(([code, meta]) => {
      const value = valueForField(code, meta, item)
      const rawValue = stringifyValue(value)
      const upperName = meta.upperName || code
      return {
        code,
        upperName,
        label: meta.title || (typeof meta.name === 'string' ? meta.name : '') || upperName || code,
        type: meta.type || typeof value,
        value,
        displayValue: rawValue.replace(/\s+/g, ' ').trim(),
        rawValue,
        custom: upperName.startsWith('UF_') || code.startsWith('UF_') || code.startsWith('ufCrm'),
        populated: hasValue(value),
        required: Boolean(meta.isRequired),
        multiple: Boolean(meta.isMultiple),
        readOnly: Boolean(meta.isReadOnly),
        immutable: Boolean(meta.isImmutable),
        deprecated: Boolean(meta.isDeprecated),
        settings: meta.settings || {}
      }
    })
    .sort((a, b) => Number(b.custom) - Number(a.custom) || a.label.localeCompare(b.label))
}

export function getItemTitle(item: Record<string, unknown>, fallback: string): string {
  const title = item.title || item.name || item.companyTitle
  if (typeof title === 'string' && title.trim()) return title.trim()

  const fullName = [item.name, item.secondName, item.lastName]
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .join(' ')
  return fullName || fallback
}
