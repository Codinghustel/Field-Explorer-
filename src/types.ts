export type EntitySource =
  | 'crm'
  | 'activity'
  | 'catalog-product'
  | 'catalog-sku'
  | 'catalog-offer'
  | 'catalog-store'
  | 'inventory-document'

export interface EntityOption {
  key: string
  source: EntitySource
  entityTypeId?: number
  label: string
  group: 'CRM' | 'Catalog' | 'Inventory'
  placement?: string
  dynamic?: boolean
}

export interface FieldMetadata {
  title?: string
  type?: string
  upperName?: string
  isRequired?: boolean
  isReadOnly?: boolean
  isImmutable?: boolean
  isMultiple?: boolean
  isDynamic?: boolean
  isDeprecated?: boolean
  settings?: Record<string, unknown>
  [key: string]: unknown
}

export interface FieldRow {
  code: string
  upperName: string
  label: string
  type: string
  custom: boolean
  required: boolean
  multiple: boolean
  readOnly: boolean
  immutable: boolean
  deprecated: boolean
  settings: Record<string, unknown>
  userfieldId?: number
  sort?: number
  showFilter?: string
  showInList?: string
  editFormLabel?: Record<string, string>
  enumOptions?: Array<{ id?: string; value: string; sort?: number; def?: string; del?: boolean }>
}

export interface ExplorerData {
  context: EntityOption
  title: string
  fields: FieldRow[]
}

export const CORE_ENTITIES: EntityOption[] = [
  { key: 'crm-deal', source: 'crm', entityTypeId: 2, label: 'Deal', group: 'CRM', placement: 'CRM_DEAL_DETAIL_TAB' },
  { key: 'crm-contact', source: 'crm', entityTypeId: 3, label: 'Contact', group: 'CRM', placement: 'CRM_CONTACT_DETAIL_TAB' },
  { key: 'crm-company', source: 'crm', entityTypeId: 4, label: 'Company', group: 'CRM', placement: 'CRM_COMPANY_DETAIL_TAB' },
  { key: 'crm-lead', source: 'crm', entityTypeId: 1, label: 'Lead', group: 'CRM', placement: 'CRM_LEAD_DETAIL_TAB' }
]

export const EXTENDED_ENTITIES: EntityOption[] = [
  { key: 'crm-activity', source: 'activity', label: 'Activity', group: 'CRM' },
  { key: 'catalog-product', source: 'catalog-product', label: 'Simple product', group: 'Catalog' },
  { key: 'catalog-sku', source: 'catalog-sku', label: 'Product with variations', group: 'Catalog' },
  { key: 'catalog-offer', source: 'catalog-offer', label: 'Product variation / offer', group: 'Catalog' },
  { key: 'catalog-store', source: 'catalog-store', label: 'Warehouse / store', group: 'Inventory' },
  { key: 'inventory-document', source: 'inventory-document', label: 'Inventory document', group: 'Inventory' }
]
