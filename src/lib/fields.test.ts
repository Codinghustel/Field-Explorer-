import { describe, expect, it } from 'vitest'
import { normalizeFields } from './fields'

describe('field normalization', () => {
  it('keeps schema fields', () => {
    const rows = normalizeFields({
      title: { title: 'Title', type: 'string', upperName: 'TITLE', isRequired: true },
      UF_CRM_TEST: { title: 'Test field', type: 'string' }
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]?.custom).toBe(true)
    expect(rows.find((row) => row.code === 'title')?.required).toBe(true)
  })
})
