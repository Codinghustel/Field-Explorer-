import { CORE_ENTITIES, EXTENDED_ENTITIES, type EntityOption, type ExplorerData, type FieldMetadata } from '@/types'
import { normalizeFields } from '@/lib/fields'

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

export function getPlacementContext(): EntityOption | null {
  let info: BitrixPlacementInfo | undefined
  try {
    info = sdk().placement?.info()
  } catch {
    return null
  }

  const placement = info?.placement || new URLSearchParams(window.location.search).get('PLACEMENT') || ''

  if (placement === 'CRM_ACTIVITY_LIST_MENU' || ACTIVITY_TIMELINE_PLACEMENT.test(placement)) {
    const activity = EXTENDED_ENTITIES.find((entity) => entity.source === 'activity')!
    return { ...activity, placement }
  }

  const core = CORE_ENTITIES.find((entity) => entity.placement === placement)
  if (core) return { ...core }

  const dynamicMatch = placement.match(DYNAMIC_PLACEMENT)
  if (dynamicMatch) {
    const entityTypeId = positiveInteger(dynamicMatch[1])
    if (entityTypeId) return {
      key: `crm-dynamic-${entityTypeId}`,
      source: 'crm',
      entityTypeId,
      label: 'Smart process',
      group: 'CRM',
      placement,
      dynamic: true
    }
  }

  return null
}

interface ItemFieldsResponse { fields: Record<string, FieldMetadata> }
interface TypeListResponse {
  types: Array<{ entityTypeId: number; title: string }>
}

export async function getCustomFieldsConfigMap(): Promise<Record<string, any>> {
  try {
    const res = await callMethod<{ fields: Array<any> }>('userfieldconfig.list', { moduleId: 'crm' })
    const map: Record<string, any> = {}
    if (res && res.fields) {
      for (const f of res.fields) {
        if (f.fieldName) {
          map[f.fieldName] = f
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

export async function loadExplorer(context: EntityOption): Promise<ExplorerData> {
  if (context.source === 'activity') return loadActivity(context)
  if (context.source === 'catalog-product') return loadCatalogSchema(context, 'catalog.product.getFieldsByFilter', 'product')
  if (context.source === 'catalog-sku') return loadCatalogSchema(context, 'catalog.product.sku.getFieldsByFilter', 'sku')
  if (context.source === 'catalog-offer') return loadCatalogSchema(context, 'catalog.product.offer.getFieldsByFilter', 'offer')
  if (context.source === 'catalog-store') return loadStore(context)
  if (context.source === 'inventory-document') return loadInventoryDocument(context)
  if (!context.entityTypeId) throw new BitrixError('The CRM entity type is missing.')

  const params = { entityTypeId: context.entityTypeId, useOriginalUfNames: 'Y' }
  const [fieldData, customConfigs] = await Promise.all([
    callMethod<ItemFieldsResponse>('crm.item.fields', params),
    getCustomFieldsConfigMap()
  ])

  return {
    context,
    title: `${context.label} Fields`,
    fields: normalizeFields(fieldData.fields, customConfigs)
  }
}

export interface UpdateCustomFieldData {
  id?: number | string
  code?: string
  label?: string
  mandatory?: 'Y' | 'N'
  sort?: number
  showFilter?: 'Y' | 'N'
  showInList?: 'Y' | 'N'
  enumOptions?: Array<{ id?: string; value: string; sort?: number; def?: string; del?: boolean }>
}

export async function updateCustomField(data: UpdateCustomFieldData): Promise<void> {
  let targetId = data.id ? Number(data.id) : undefined

  if (!targetId && data.code) {
    try {
      const fieldCode = data.code
      const listRes = await callMethod<{ fields: Array<{ id: string; fieldName: string }> }>('userfieldconfig.list', {
        moduleId: 'crm'
      })
      const found = listRes.fields?.find((f) => f.fieldName === fieldCode || f.fieldName === fieldCode.toUpperCase())
      if (found) {
        targetId = Number(found.id)
      }
    } catch {
      // ignore list error
    }
  }

  if (!targetId) {
    throw new BitrixError('Could not find the custom field configuration ID to update.')
  }

  const fieldObj: Record<string, unknown> = {}
  if (data.label !== undefined) {
    fieldObj.editFormLabel = { en: data.label }
  }
  if (data.mandatory !== undefined) {
    fieldObj.mandatory = data.mandatory
  }
  if (data.sort !== undefined) {
    fieldObj.sort = data.sort
  }
  if (data.showFilter !== undefined) {
    fieldObj.showFilter = data.showFilter
  }
  if (data.showInList !== undefined) {
    fieldObj.showInList = data.showInList
  }
  if (data.enumOptions && data.enumOptions.length > 0) {
    fieldObj.userTypeId = 'enumeration'
    fieldObj.enum = data.enumOptions.map((opt) => ({
      id: opt.id,
      value: opt.value,
      sort: opt.sort ?? 100,
      def: opt.def || 'N',
      del: opt.del ? 'Y' : 'N'
    }))
  }

  await callMethod('userfieldconfig.update', {
    moduleId: 'crm',
    id: targetId,
    field: fieldObj
  })
}

function metadataMap(fields: Record<string, FieldMetadata>): Record<string, FieldMetadata> {
  return Object.fromEntries(Object.entries(fields).map(([code, meta]) => [code, {
    ...meta,
    title: meta.title || (typeof meta.name === 'string' ? meta.name : code),
    upperName: meta.upperName || code
  }]))
}

async function loadActivity(context: EntityOption): Promise<ExplorerData> {
  const fields = await callMethod<Record<string, FieldMetadata>>('crm.activity.fields')
  return { context, title: 'Activity Fields', fields: normalizeFields(metadataMap(fields)) }
}

async function loadCatalogSchema(
  context: EntityOption,
  fieldsMethod: string,
  responseKey: 'product' | 'sku' | 'offer'
): Promise<ExplorerData> {
  const { catalogs } = await callMethod<{ catalogs: Array<{ id: number, iblockId: number, productIblockId: number }> }>('catalog.catalog.list')
  if (!catalogs || catalogs.length === 0) throw new BitrixError('No product catalog found.')

  let iblockId: number
  if (responseKey === 'offer' || responseKey === 'sku') {
    const skuCatalog = catalogs.find(c => c.productIblockId > 0)
    if (!skuCatalog) throw new BitrixError('No variations/offers catalog found.')
    iblockId = skuCatalog.iblockId
  } else {
    const productCatalog = catalogs.find(c => c.productIblockId === 0)
    iblockId = productCatalog ? productCatalog.iblockId : catalogs[0].iblockId
  }

  const fieldResponse = await callMethod<Record<string, Record<string, FieldMetadata>>>(fieldsMethod, {
    filter: { iblockId }
  })
  const fields = fieldResponse[responseKey] || {}
  return {
    context,
    title: `${context.label} Fields`,
    fields: normalizeFields(metadataMap(fields))
  }
}

async function loadStore(context: EntityOption): Promise<ExplorerData> {
  const fieldsResponse = await callMethod<{ store: Record<string, FieldMetadata> }>('catalog.store.getFields')
  return {
    context,
    title: 'Warehouse Fields',
    fields: normalizeFields(metadataMap(fieldsResponse.store))
  }
}

async function loadInventoryDocument(context: EntityOption): Promise<ExplorerData> {
  const inventoryMode = await callMethod<string>('catalog.document.mode.status')
  if (inventoryMode !== 'Y') {
    throw new BitrixError('Inventory Management is not enabled in this Bitrix24 portal.')
  }
  const [fieldsResponse] = await Promise.all([
    callMethod<{ document: Record<string, FieldMetadata> }>('catalog.document.getFields'),
    callMethod<{ documentElement: Record<string, FieldMetadata> }>('catalog.document.element.getFields')
  ])

  const fields = {
    ...metadataMap(fieldsResponse.document),
    documentElements: {
      title: 'Document lines', type: 'array', isReadOnly: true, isMultiple: true, upperName: 'documentElements'
    }
  }
  return {
    context,
    title: 'Inventory Document Fields',
    fields: normalizeFields(fields)
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
