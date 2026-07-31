import { beforeEach, describe, expect, it } from 'vitest'
import { loadExplorer } from './bitrix'
import type { EntityContext } from '@/types'

function context(overrides: Partial<EntityContext>): EntityContext {
  return {
    key: 'crm-deal', source: 'crm', entityTypeId: 2, id: 42, label: 'Deal', group: 'CRM', ...overrides
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

  it('normalizes CRM activity fields and values', async () => {
    mockMethods({
      'crm.activity.fields': { SUBJECT: { title: 'Subject', type: 'string' } },
      'crm.activity.get': { SUBJECT: 'Follow up' }
    })
    const result = await loadExplorer(context({ key: 'crm-activity', source: 'activity', entityTypeId: undefined, label: 'Activity' }))
    expect(result.title).toBe('Follow up')
    expect(result.fields[0]?.code).toBe('SUBJECT')
  })

  it('loads product metadata for its information block', async () => {
    mockMethods({
      'catalog.product.get': { product: { id: 77, iblockId: 14, name: 'Desk' } },
      'catalog.product.getFieldsByFilter': { product: { name: { name: 'Name', type: 'string' } } }
    })
    const result = await loadExplorer(context({
      key: 'catalog-product', source: 'catalog-product', entityTypeId: undefined, label: 'Simple product', group: 'Catalog'
    }))
    expect(result.title).toBe('Desk')
    expect(result.fields[0]?.label).toBe('Name')
  })

  it('adds inventory document lines to the schema', async () => {
    mockMethods({
      'catalog.document.mode.status': 'Y',
      'catalog.document.list': { documents: [{ id: 42, title: 'Stock receipt' }] },
      'catalog.document.getFields': { document: { title: { type: 'string' } } },
      'catalog.document.element.list': { documentElements: [{ id: 9, docId: 42, elementId: 77, amount: 3 }] }
    })
    const result = await loadExplorer(context({
      key: 'inventory-document', source: 'inventory-document', entityTypeId: undefined,
      label: 'Inventory document', group: 'Inventory'
    }))
    const lines = result.fields.find((field) => field.code === 'documentElements')
    expect(lines?.multiple).toBe(true)
    expect(lines?.populated).toBe(true)
  })
})
