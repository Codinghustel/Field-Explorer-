import { describe, expect, it } from 'vitest'
import { createFieldsCsv, csvFilename } from './csv'
import type { EntityOption, FieldRow } from '@/types'

const context: EntityOption = {
  key: 'crm-deal', source: 'crm', entityTypeId: 2, label: 'Deal', group: 'CRM'
}
const row: FieldRow = {
  code: 'UF_CRM_NOTE', upperName: 'UF_CRM_NOTE', label: 'Note', type: 'string',
  custom: true, required: false, multiple: false, readOnly: false, immutable: false,
  deprecated: false, settings: {
    formula: '=SUM(1,2)'
  }
}

describe('CSV export', () => {
  it('includes a UTF-8 BOM', () => {
    const csv = createFieldsCsv([row], context)
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('builds a stable descriptive filename', () => {
    expect(csvFilename(context, new Date('2026-07-31T12:00:00Z')))
      .toBe('bitrix24-deal-fields-2026-07-31.csv')
  })
})
