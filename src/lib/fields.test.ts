import { describe, expect, it } from 'vitest'
import { hasValue, normalizeFields } from './fields'

describe('field normalization', () => {
  it('distinguishes empty and populated Bitrix values', () => {
    expect(hasValue('')).toBe(false)
    expect(hasValue([])).toBe(false)
    expect(hasValue(false)).toBe(true)
    expect(hasValue(0)).toBe(true)
  })

  it('keeps schema fields that have no item value', () => {
    const rows = normalizeFields({
      title: { title: 'Title', type: 'string', upperName: 'TITLE', isRequired: true },
      UF_CRM_TEST: { title: 'Test field', type: 'string' }
    }, { title: 'Example' })

    expect(rows).toHaveLength(2)
    expect(rows[0]?.custom).toBe(true)
    expect(rows.find((row) => row.code === 'UF_CRM_TEST')?.populated).toBe(false)
    expect(rows.find((row) => row.code === 'title')?.required).toBe(true)
  })
})
