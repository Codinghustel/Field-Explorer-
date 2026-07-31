import { CORE_ENTITIES, EXTENDED_ENTITIES, type EntityContext, type EntityOption, type ExplorerData, type FieldMetadata } from '@/types'
import { getItemTitle, normalizeFields } from '@/lib/fields'

const DYNAMIC_PLACEMENT = /^CRM_DYNAMIC_(\d+)_DETAIL_TAB$/
const ACTIVITY_TIMELINE_PLACEMENT = /_ACTIVITY_TIMELINE_MENU$/

export class BitrixError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'BitrixError'
  }
}

function sdk(): BitrixSdk {
  if (!window.BX24) throw new BitrixError('The Bitrix24 SDK did not load. Open the app inside Bitrix24 and try again.')
  return window.BX24
}

export function initializeBitrix(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new BitrixError('Bitrix24 did not initialize in time.')), timeoutMs)
    try {
      sdk().init(() => {
        window.clearTimeout(timer)
        resolve()
      })
    } catch (error) {
      window.clearTimeout(timer)
      reject(error)
    }
  })
}

export function callMethod<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    sdk().callMethod<T>(method, params, (result) => {
      const code = result.error()
      if (code) {
        reject(new BitrixError(result.error_description() || `Bitrix24 rejected ${method}.`, code))
        return
      }
      resolve(result.data())
    })
  })
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function getPlacementContext(): EntityContext | null {
  let info: BitrixPlacementInfo | undefined
  try {
    info = sdk().placement?.info()
  } catch {
    return null
  }

  const placement = info?.placement || new URLSearchParams(window.location.search).get('PLACEMENT') || ''
  const options = info?.options || {}
  const id = positiveInteger(
    options.ID
    || options.ASSOCIATED_ENTITY_ID
    || new URLSearchParams(window.location.search).get('id')
  )
  if (!id) return null

  if (placement === 'CRM_ACTIVITY_LIST_MENU' || ACTIVITY_TIMELINE_PLACEMENT.test(placement)) {
    const activity = EXTENDED_ENTITIES.find((entity) => entity.source === 'activity')!
    return { ...activity, id, placement }
  }

  const core = CORE_ENTITIES.find((entity) => entity.placement === placement)
  if (core) return { ...core, id }

  const dynamicMatch = placement.match(DYNAMIC_PLACEMENT)
  if (dynamicMatch) {
    const entityTypeId = positiveInteger(dynamicMatch[1])
    if (entityTypeId) return {
      key: `crm-dynamic-${entityTypeId}`,
      source: 'crm',
      entityTypeId,
      id,
      label: 'Smart process',
      group: 'CRM',
      placement,
      dynamic: true
    }
  }

  return null
}

interface ItemFieldsResponse { fields: Record<string, FieldMetadata> }
interface ItemResponse { item: Record<string, unknown> }
interface TypeListResponse {
  types: Array<{ entityTypeId: number; title: string }>
}

export async function loadExplorer(context: EntityContext): Promise<ExplorerData> {
  if (context.source === 'activity') return loadActivity(context)
  if (context.source === 'catalog-product') return loadCatalogRecord(context, 'catalog.product.get', 'catalog.product.getFieldsByFilter', 'product')
  if (context.source === 'catalog-sku') return loadCatalogRecord(context, 'catalog.product.sku.get', 'catalog.product.sku.getFieldsByFilter', 'sku')
  if (context.source === 'catalog-offer') return loadCatalogRecord(context, 'catalog.product.offer.get', 'catalog.product.offer.getFieldsByFilter', 'offer')
  if (context.source === 'catalog-store') return loadStore(context)
  if (context.source === 'inventory-document') return loadInventoryDocument(context)
  if (!context.entityTypeId) throw new BitrixError('The CRM entity type is missing.')

  const params = { entityTypeId: context.entityTypeId, useOriginalUfNames: 'Y' }
  const [fieldData, itemData] = await Promise.all([
    callMethod<ItemFieldsResponse>('crm.item.fields', params),
    callMethod<ItemResponse>('crm.item.get', { ...params, id: context.id })
  ])

  const fallback = `${context.label} #${context.id}`
  return {
    context,
    title: getItemTitle(itemData.item, fallback),
    fields: normalizeFields(fieldData.fields, itemData.item)
  }
}

function metadataMap(fields: Record<string, FieldMetadata>): Record<string, FieldMetadata> {
  return Object.fromEntries(Object.entries(fields).map(([code, meta]) => [code, {
    ...meta,
    title: meta.title || (typeof meta.name === 'string' ? meta.name : code),
    upperName: meta.upperName || code
  }]))
}

async function loadActivity(context: EntityContext): Promise<ExplorerData> {
  const [fields, item] = await Promise.all([
    callMethod<Record<string, FieldMetadata>>('crm.activity.fields'),
    callMethod<Record<string, unknown>>('crm.activity.get', { id: context.id })
  ])
  const subject = typeof item.SUBJECT === 'string' && item.SUBJECT.trim()
    ? item.SUBJECT.trim()
    : `Activity #${context.id}`
  return { context, title: subject, fields: normalizeFields(metadataMap(fields), item) }
}

async function loadCatalogRecord(
  context: EntityContext,
  getMethod: string,
  fieldsMethod: string,
  responseKey: 'product' | 'sku' | 'offer'
): Promise<ExplorerData> {
  const recordResponse = await callMethod<Record<string, Record<string, unknown>>>(getMethod, { id: context.id })
  const item = recordResponse[responseKey]
  if (!item) throw new BitrixError(`${context.label} #${context.id} was not found.`)
  const iblockId = positiveInteger(item.iblockId)
  if (!iblockId) throw new BitrixError('Bitrix24 did not return the product catalog ID.')
  const fieldResponse = await callMethod<Record<string, Record<string, FieldMetadata>>>(fieldsMethod, {
    filter: { iblockId }
  })
  const fields = fieldResponse[responseKey] || {}
  return {
    context,
    title: getItemTitle(item, `${context.label} #${context.id}`),
    fields: normalizeFields(metadataMap(fields), item)
  }
}

async function loadStore(context: EntityContext): Promise<ExplorerData> {
  const [recordResponse, fieldsResponse] = await Promise.all([
    callMethod<{ store: Record<string, unknown> }>('catalog.store.get', { id: context.id }),
    callMethod<{ store: Record<string, FieldMetadata> }>('catalog.store.getFields')
  ])
  const item = recordResponse.store
  return {
    context,
    title: getItemTitle(item, `Warehouse #${context.id}`),
    fields: normalizeFields(metadataMap(fieldsResponse.store), item)
  }
}

async function loadInventoryDocument(context: EntityContext): Promise<ExplorerData> {
  const inventoryMode = await callMethod<string>('catalog.document.mode.status')
  if (inventoryMode !== 'Y') {
    throw new BitrixError('Inventory Management is not enabled in this Bitrix24 portal.')
  }
  const [recordResponse, fieldsResponse, linesResponse] = await Promise.all([
    callMethod<{ documents: Record<string, unknown>[] }>('catalog.document.list', {
      select: [], filter: { id: context.id }, start: 0
    }),
    callMethod<{ document: Record<string, FieldMetadata> }>('catalog.document.getFields'),
    callMethod<{ documentElements: Record<string, unknown>[] }>('catalog.document.element.list', {
      select: ['id', 'docId', 'elementId', 'amount', 'purchasingPrice', 'storeFrom', 'storeTo'],
      filter: { docId: context.id }, order: { id: 'asc' }, start: 0
    })
  ])
  const item = recordResponse.documents?.[0]
  if (!item) throw new BitrixError(`Inventory document #${context.id} was not found.`)
  const itemWithLines = { ...item, documentElements: linesResponse.documentElements || [] }
  const fields = {
    ...metadataMap(fieldsResponse.document),
    documentElements: {
      title: 'Document lines', type: 'array', isReadOnly: true, isMultiple: true, upperName: 'documentElements'
    }
  }
  return {
    context,
    title: getItemTitle(item, `Inventory document #${context.id}`),
    fields: normalizeFields(fields, itemWithLines)
  }
}

export async function listEntityOptions(): Promise<EntityOption[]> {
  const entities = [...CORE_ENTITIES, ...EXTENDED_ENTITIES]
  try {
    let start = 0
    let keepLoading = true
    while (keepLoading) {
      const response = await callMethod<TypeListResponse>('crm.type.list', { start })
      const types = response.types || []
      entities.push(...types.map((type) => ({
        key: `crm-dynamic-${type.entityTypeId}`,
        source: 'crm' as const,
        entityTypeId: type.entityTypeId,
        label: type.title,
        group: 'CRM' as const,
        placement: `CRM_DYNAMIC_${type.entityTypeId}_DETAIL_TAB`,
        dynamic: true
      })))
      keepLoading = types.length === 50
      start += 50
    }
  } catch {
    // Core CRM lookup remains useful when the current user cannot enumerate smart processes.
  }
  return entities
}

function placementCodes(data: unknown): Set<string> {
  if (!Array.isArray(data)) return new Set()
  return new Set(data.flatMap((entry) => {
    if (typeof entry === 'string') return [entry]
    if (entry && typeof entry === 'object' && 'PLACEMENT' in entry) return [String(entry.PLACEMENT)]
    return []
  }))
}

export async function installApplication(handler: string): Promise<number> {
  const [availableData, entities] = await Promise.all([
    callMethod<unknown>('placement.list', { SCOPE: 'crm' }),
    listEntityOptions()
  ])
  const available = placementCodes(availableData)
  const placements = entities.filter((entity) => entity.placement && available.has(entity.placement))
  const activityPlacements = [...available].filter((placement) =>
    placement === 'CRM_ACTIVITY_LIST_MENU' || ACTIVITY_TIMELINE_PLACEMENT.test(placement)
  )
  const requiredCore = CORE_ENTITIES.filter((entity) => entity.placement && available.has(entity.placement))

  if (!requiredCore.length) {
    throw new BitrixError('No CRM detail-tab placements are available. Check the app CRM and placement scopes.')
  }

  const placementNames = [
    ...placements.map((entity) => entity.placement!),
    ...activityPlacements
  ]

  await Promise.all(placementNames.map((placement) => callMethod<boolean>('placement.bind', {
    PLACEMENT: placement,
    HANDLER: handler,
    TITLE: 'Field Explorer',
    LANG_ALL: { en: { TITLE: 'Field Explorer' } }
  })))

  return placementNames.length
}

export async function isApplicationInstalled(): Promise<boolean> {
  const info = await callMethod<{ INSTALLED?: boolean }>('app.info')
  return Boolean(info.INSTALLED)
}

export function finishInstallation(): void {
  sdk().installFinish()
}
