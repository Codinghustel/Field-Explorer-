import type { FieldMetadata, FieldRow } from '@/types'

export function normalizeFields(
  metadata: Record<string, FieldMetadata>
): FieldRow[] {
  return Object.entries(metadata)
    .map(([code, meta]) => {
      const upperName = meta.upperName || code
      return {
        code,
        upperName,
        label: meta.title || (typeof meta.name === 'string' ? meta.name : '') || upperName || code,
        type: meta.type || 'unknown',
        custom: upperName.startsWith('UF_') || code.startsWith('UF_') || code.startsWith('ufCrm'),
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
