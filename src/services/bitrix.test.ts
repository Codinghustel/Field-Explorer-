import { beforeEach, describe, expect, it } from 'vitest'
import { loadExplorer } from './bitrix'
import type { EntityOption } from '@/types'

function context(overrides: Partial<EntityOption>): EntityOption {
  return {
    key: 'crm-deal', source: 'crm', entityTypeId: 2, label: 'Deal', group: 'CRM', ...overrides
  }
}

function mockMethods(responses: Record<string, unknown>): void {
  window.BX24 = {
    init: (callback) => callback(),
    installFinish: () => undefined,
    callMethod: <T>(method: string, _params: Record<string, unknown>, callback: (result: BitrixResult<T>) => void) => {
      const data = responses[method]
      callback({
        data: () => data as T,
        error: () => null,
        error_description: () => ''
      })
    }
  }
}

describe('Bitrix source adapters', () => {
  beforeEach(() => {
    window.BX24 = undefined
  })

  it('normalizes CRM activity fields', async () => {
    mockMethods({
      'crm.activity.fields': { SUBJECT: { title: 'Subject', type: 'string' } }
    })
    const result = await loadExplorer(context({ key: 'crm-activity', source: 'activity', entityTypeId: undefined, label: 'Activity' }))
    expect(result.title).toBe('Activity Fields')
    expect(result.fields[0]?.code).toBe('SUBJECT')
  })

  it('loads product metadata for its information block', async () => {
    mockMethods({
      'catalog.catalog.list': { catalogs: [{ id: 77, iblockId: 14, productIblockId: 0, skuPropertyId: 0 }] },
      'catalog.product.getFieldsByFilter': { product: { name: { name: 'Name', type: 'string' } } }
    })
    const result = await loadExplorer(context({
      key: 'catalog-product', source: 'catalog-product', entityTypeId: undefined, label: 'Simple product', group: 'Catalog'
    }))
    expect(result.title).toBe('Simple product Fields')
    expect(result.fields[0]?.label).toBe('Name')
  })

  it('adds inventory document lines to the schema', async () => {
    mockMethods({
      'catalog.document.mode.status': 'Y',
      'catalog.document.getFields': { document: { title: { type: 'string' } } },
      'catalog.document.element.getFields': { documentElement: { id: { type: 'integer' } } }
    })
    const result = await loadExplorer(context({
      key: 'inventory-document', source: 'inventory-document', entityTypeId: undefined,
      label: 'Inventory document', group: 'Inventory'
    }))
    const lines = result.fields.find((field) => field.code === 'documentElements')
    expect(lines?.multiple).toBe(true)
  })
})
