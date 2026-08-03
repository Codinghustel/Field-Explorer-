import type { FieldMetadata, FieldRow } from '@/types'

export function normalizeFields(
  metadata: Record<string, FieldMetadata>,
  customConfigs: Record<string, any> = {}
): FieldRow[] {
  return Object.entries(metadata)
    .map(([code, meta]) => {
      const upperName = meta.upperName || code
      const isCustom = upperName.startsWith('UF_') || code.startsWith('UF_') || code.startsWith('ufCrm')
      const config = customConfigs[code] || customConfigs[upperName] || {}

      return {
        code,
        upperName,
        label: meta.title || (typeof meta.name === 'string' ? meta.name : '') || upperName || code,
        type: meta.type || 'unknown',
        custom: isCustom,
        required: config.mandatory ? config.mandatory === 'Y' : Boolean(meta.isRequired),
        multiple: Boolean(meta.isMultiple),
        readOnly: Boolean(meta.isReadOnly),
        immutable: Boolean(meta.isImmutable),
        deprecated: Boolean(meta.isDeprecated),
        settings: meta.settings || {},
        userfieldId: config.id ? Number(config.id) : undefined,
        sort: config.sort !== undefined ? Number(config.sort) : undefined,
        showFilter: config.showFilter,
        showInList: config.showInList,
        editFormLabel: config.editFormLabel,
        enumOptions: Array.isArray(config.enum) ? config.enum.map((opt: any) => ({
          id: String(opt.id),
          value: String(opt.value),
          sort: Number(opt.sort || 100),
          def: opt.def
        })) : undefined
      }
    })
    .sort((a, b) => Number(b.custom) - Number(a.custom) || a.label.localeCompare(b.label))
}
