import { describe, expect, it } from 'vitest'
import { createFieldsCsv, csvFilename } from './csv'
import type { EntityContext, FieldRow } from '@/types'

const context: EntityContext = {
  key: 'crm-deal', source: 'crm', entityTypeId: 2, id: 42, label: 'Deal', group: 'CRM'
}
const row: FieldRow = {
  code: 'UF_CRM_NOTE', upperName: 'UF_CRM_NOTE', label: 'Note', type: 'string',
  value: '=SUM(1,2)', displayValue: '=SUM(1,2)', rawValue: '=SUM(1,2)', custom: true,
  populated: true, required: false, multiple: false, readOnly: false, immutable: false,
  deprecated: false, settings: {}
}

describe('CSV export', () => {
  it('includes a UTF-8 BOM and neutralizes spreadsheet formulas', () => {
    const csv = createFieldsCsv([row], context)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain("'=SUM(1,2)")
  })

  it('builds a stable descriptive filename', () => {
    expect(csvFilename(context, new Date('2026-07-31T12:00:00Z')))
      .toBe('bitrix24-deal-42-fields-2026-07-31.csv')
  })
})
