<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import CrmSearchIcon from '@bitrix24/b24icons-vue/crm/CrmSearchIcon'
import DealIcon from '@bitrix24/b24icons-vue/crm/DealIcon'
import ActivityIcon from '@bitrix24/b24icons-vue/outline/ActivityIcon'
import ArrowRightLIcon from '@bitrix24/b24icons-vue/outline/ArrowRightLIcon'
import CopyIcon from '@bitrix24/b24icons-vue/outline/CopyIcon'
import DatabaseIcon from '@bitrix24/b24icons-vue/outline/DatabaseIcon'
import DownloadIcon from '@bitrix24/b24icons-vue/outline/DownloadIcon'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'
import ProductIcon from '@bitrix24/b24icons-vue/outline/ProductIcon'
import RefreshIcon from '@bitrix24/b24icons-vue/outline/RefreshIcon'
import SettingsIcon from '@bitrix24/b24icons-vue/outline/SettingsIcon'
import { useColorMode, useToast } from '@bitrix24/b24ui-nuxt/composables'
import type { Component } from 'vue'
import type { FieldRow, EntityOption, ExplorerData } from '@/types'
import { CORE_ENTITIES, EXTENDED_ENTITIES } from '@/types'
import { createFieldsCsv, csvFilename, downloadCsv } from '@/lib/csv'
import {
  BitrixError,
  finishInstallation,
  getPlacementContext,
  initializeBitrix,
  installApplication,
  isApplicationInstalled,
  listEntityOptions,
  loadExplorer
} from '@/services/bitrix'

type LoadState = 'initializing' | 'standalone' | 'ready' | 'loading' | 'error'
type SourceFilter = 'all' | 'custom' | 'system'
type SortMode = 'custom-first' | 'label' | 'code' | 'type'

const toast = useToast()
const colorMode = useColorMode()
colorMode.preference = 'light'

const state = ref<LoadState>('initializing')
const errorMessage = ref('')
const explorer = ref<ExplorerData | null>(null)
const entities = ref<EntityOption[]>([...CORE_ENTITIES, ...EXTENDED_ENTITIES])
const selectedEntityKey = ref('crm-deal')
const search = ref('')
const sourceFilter = ref<SourceFilter>('all')
const typeFilter = ref('all')
const sortMode = ref<SortMode>('custom-first')
const detailsOpen = ref(false)
const selectedField = ref<FieldRow | null>(null)
const installing = ref(false)
const installed = ref<boolean | null>(null)

const sourceItems: Array<{ label: string; value: SourceFilter }> = [
  { label: 'All fields', value: 'all' },
  { label: 'Custom', value: 'custom' },
  { label: 'System', value: 'system' }
]
const sortItems = [
  { label: 'Custom first', value: 'custom-first' },
  { label: 'Label A-Z', value: 'label' },
  { label: 'API code A-Z', value: 'code' },
  { label: 'Type A-Z', value: 'type' }
]

const groupedEntities = computed(() => [
  {
    group: 'CRM' as const,
    title: 'CRM records',
    description: 'Customer and sales records',
    icon: DealIcon,
    items: entities.value.filter((entity) => entity.group === 'CRM')
  },
  {
    group: 'Catalog' as const,
    title: 'Product catalog',
    description: 'Products, parents, and variations',
    icon: ProductIcon,
    items: entities.value.filter((entity) => entity.group === 'Catalog')
  },
  {
    group: 'Inventory' as const,
    title: 'Inventory',
    description: 'Warehouses and stock documents',
    icon: DatabaseIcon,
    items: entities.value.filter((entity) => entity.group === 'Inventory')
  }
])

const selectedEntity = computed(() => entities.value.find((entity) => entity.key === selectedEntityKey.value))

const typeItems = computed(() => {
  const types = [...new Set((explorer.value?.fields || []).map((field) => field.type))].sort()
  return [{ label: 'All types', value: 'all' }, ...types.map((type) => ({ label: type, value: type }))]
})

const filteredFields = computed(() => {
  const query = search.value.trim().toLowerCase()
  const rows = (explorer.value?.fields || []).filter((field) => {
    if (query && ![field.label, field.code, field.upperName, field.type]
      .some((value) => value.toLowerCase().includes(query))) return false
    if (sourceFilter.value === 'custom' && !field.custom) return false
    if (sourceFilter.value === 'system' && field.custom) return false
    if (typeFilter.value !== 'all' && field.type !== typeFilter.value) return false
    return true
  })

  return [...rows].sort((a, b) => {
    if (sortMode.value === 'label') return a.label.localeCompare(b.label)
    if (sortMode.value === 'code') return a.code.localeCompare(b.code)
    if (sortMode.value === 'type') return a.type.localeCompare(b.type) || a.label.localeCompare(b.label)
    return Number(b.custom) - Number(a.custom) || a.label.localeCompare(b.label)
  })
})

const stats = computed(() => {
  const fields = explorer.value?.fields || []
  return {
    total: fields.length,
    custom: fields.filter((field) => field.custom).length
  }
})

const columns = [
  { accessorKey: 'label', header: 'Field', meta: { class: { th: 'min-w-[240px]' } } },
  { accessorKey: 'code', header: 'API code', meta: { class: { th: 'min-w-[210px]' } } },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'flags', header: 'Attributes', enableSorting: false },
  { accessorKey: 'actions', header: '', enableSorting: false, meta: { class: { th: 'w-12', td: 'w-12' } } }
]

function entityIcon(entity: EntityOption): Component {
  if (entity.source === 'activity') return ActivityIcon
  if (entity.group === 'Catalog') return ProductIcon
  if (entity.group === 'Inventory') return DatabaseIcon
  return DealIcon
}

function asMessage(error: unknown): string {
  if (error instanceof BitrixError && error.code === 'ACCESS_DENIED') {
    return "Bitrix24 denied access. Check this user's record permissions and the app scopes."
  }
  return error instanceof Error ? error.message : 'Bitrix24 could not load this schema.'
}

async function openContext(context: EntityOption): Promise<void> {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    explorer.value = await loadExplorer(context)
    resetFilters()
    state.value = 'ready'
    await resizeFrame()
  } catch (error) {
    errorMessage.value = asMessage(error)
    state.value = 'error'
  }
}

async function lookup(): Promise<void> {
  const entity = selectedEntity.value
  if (!entity) return
  await openContext({ ...entity })
}

function returnToPicker(): void {
  explorer.value = null
  state.value = 'ready'
  resetFilters()
}

function resetFilters(): void {
  search.value = ''
  sourceFilter.value = 'all'
  typeFilter.value = 'all'
  sortMode.value = 'custom-first'
}

function setSourceFilter(value: SourceFilter): void {
  sourceFilter.value = value
}

async function refresh(): Promise<void> {
  if (explorer.value) await openContext(explorer.value.context)
}

function showDetails(field: FieldRow): void {
  selectedField.value = field
  detailsOpen.value = true
}

async function copyText(value: string, label: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  toast.add({ title: `${label} copied`, color: 'air-primary-success' })
}

function exportVisible(): void {
  if (!explorer.value || !filteredFields.value.length) return
  downloadCsv(createFieldsCsv(filteredFields.value, explorer.value.context), csvFilename(explorer.value.context))
  toast.add({
    title: 'CSV exported',
    description: `${filteredFields.value.length} visible field${filteredFields.value.length === 1 ? '' : 's'} included.`,
    color: 'air-primary-success'
  })
}

async function registerTabs(): Promise<void> {
  installing.value = true
  try {
    const count = await installApplication(`${window.location.origin}${window.location.pathname}`)
    toast.add({ title: 'CRM tabs are ready', description: `${count} available placements registered.`, color: 'air-primary-success' })
    if (installed.value === false) finishInstallation()
    installed.value = true
  } catch (error) {
    toast.add({ title: 'Could not register tabs', description: asMessage(error), color: 'air-primary-alert' })
  } finally {
    installing.value = false
  }
}

async function resizeFrame(): Promise<void> {
  await nextTick()
  window.BX24?.resizeWindow?.(document.body.clientWidth, Math.max(document.documentElement.scrollHeight, 720))
}

function demoField(partial: Partial<FieldRow> & Pick<FieldRow, 'code' | 'label' | 'type'>): FieldRow {
  return {
    upperName: partial.code,
    custom: false,
    required: false,
    multiple: false,
    readOnly: false,
    immutable: false,
    deprecated: false,
    settings: {},
    ...partial
  }
}

function loadPreview(): void {
  explorer.value = {
    context: { ...CORE_ENTITIES[0]! },
    title: 'Deal Fields',
    fields: [
      demoField({ code: 'UF_CRM_CLIENT_REFERENCE', label: 'Client reference', type: 'string', custom: true }),
      demoField({ code: 'UF_CRM_PROJECT_SCOPE', label: 'Project scope', type: 'enumeration', custom: true, multiple: true }),
      demoField({ code: 'UF_CRM_APPROVAL_DATE', label: 'Approval date', type: 'date', custom: true }),
      demoField({ code: 'UF_CRM_PURCHASE_ORDER', label: 'Purchase order', type: 'file', custom: true }),
      demoField({ code: 'TITLE', label: 'Deal name', type: 'string', required: true }),
      demoField({ code: 'STAGE_ID', label: 'Stage', type: 'crm_status', required: true }),
      demoField({ code: 'OPPORTUNITY', label: 'Amount', type: 'double' }),
      demoField({ code: 'CURRENCY_ID', label: 'Currency', type: 'string' }),
      demoField({ code: 'ASSIGNED_BY_ID', label: 'Responsible person', type: 'user' }),
      demoField({ code: 'COMMENTS', label: 'Comments', type: 'string' })
    ]
  }
  state.value = 'ready'
}

onMounted(async () => {
  document.documentElement.classList.remove('dark', 'edge-dark', 'auto', 'base-mode')
  document.documentElement.classList.add('light')

  const preview = new URLSearchParams(window.location.search).get('preview')
  if (preview) {
    if (preview === 'picker') state.value = 'ready'
    else loadPreview()
    return
  }

  if (!window.BX24) {
    state.value = 'standalone'
    return
  }

  try {
    await initializeBitrix()
    const context = getPlacementContext()
    const [availableEntities, installationState] = await Promise.all([
      listEntityOptions(),
      isApplicationInstalled().catch(() => null)
    ])
    entities.value = availableEntities
    installed.value = installationState
    if (context) {
      const matchingEntity = availableEntities.find((entity) =>
        entity.key === context.key
        || (entity.source === 'crm' && entity.entityTypeId === context.entityTypeId)
      )
      await openContext(matchingEntity ? { ...matchingEntity } : context)
    } else {
      state.value = 'ready'
      await resizeFrame()
    }
  } catch (error) {
    errorMessage.value = asMessage(error)
    state.value = 'error'
  }
})
</script>

<template>
  <B24App>
    <div class="app-root">
      <header class="topbar">
        <div class="brand">
          <div class="brand-icon"><CrmSearchIcon /></div>
          <div>
            <h1>Field Explorer</h1>
            <p>Bitrix24 schema and API codes</p>
          </div>
        </div>

        <div class="topbar-actions">
          <div v-if="explorer" class="desktop-actions">
            <B24Button :icon="RefreshIcon" label="Refresh" color="air-secondary-no-accent" :loading="state === 'loading'" @click="refresh" />
            <B24Button :icon="DownloadIcon" label="Export CSV" color="air-primary" :disabled="!filteredFields.length" @click="exportVisible" />
          </div>
          <div v-if="explorer" class="mobile-actions">
            <button type="button" aria-label="Refresh fields" @click="refresh"><RefreshIcon /></button>
            <button type="button" class="primary" aria-label="Export visible fields as CSV" :disabled="!filteredFields.length" @click="exportVisible"><DownloadIcon /></button>
          </div>
          <B24Button
            v-else-if="state === 'ready'"
            class="setup-button"
            :icon="SettingsIcon"
            label="Set up CRM tabs"
            color="air-secondary-no-accent"
            :loading="installing"
            @click="registerTabs"
          />
        </div>
      </header>

      <main class="main-content">
        <section v-if="state === 'initializing'" class="loading-page" aria-live="polite">
          <B24Skeleton class="h-8 w-64" />
          <B24Skeleton class="h-5 w-96 max-w-full" />
          <div class="loading-panels">
            <B24Skeleton v-for="index in 3" :key="index" class="h-52" />
          </div>
        </section>

        <section v-else-if="state === 'standalone'" class="standalone-page">
          <div class="standalone-main">
            <B24Badge label="Deployment ready" color="air-secondary-accent-1" />
            <h2>Open Field Explorer from Bitrix24</h2>
            <p>
              This address hosts the app, but CRM schema is only available inside your authorized
              Bitrix24 portal. Open the local app there to explore the schema.
            </p>
            <B24Button
              to="https://pcicrm.bitrix24.com/marketplace/"
              target="_blank"
              label="Open Bitrix24 applications"
              :trailing-icon="ArrowRightLIcon"
              color="air-primary"
              size="lg"
            />
          </div>
          <aside class="standalone-steps">
            <div class="step-row"><span>1</span><div><strong>Open the local app</strong><p>Launch Field Explorer from Applications.</p></div></div>
            <div class="step-row"><span>2</span><div><strong>Set up CRM tabs</strong><p>Run setup once as an administrator.</p></div></div>
            <div class="step-row"><span>3</span><div><strong>Explore schema</strong><p>Select an entity to view its fields.</p></div></div>
          </aside>
        </section>

        <section v-else-if="state === 'error' && !explorer" class="error-page">
          <B24Alert title="Field Explorer could not connect" :description="errorMessage" color="air-primary-alert" :icon="InfoCircleIcon" />
        </section>

        <section v-else-if="!explorer" class="picker-page">
          <div class="page-heading">
            <div>
              <h2>Choose an entity to inspect</h2>
              <p>Select the Bitrix24 area to view its schema.</p>
            </div>
            <B24Badge v-if="installed" label="CRM tabs connected" color="air-secondary-accent-1" size="sm" />
          </div>

          <div class="source-grid">
            <section v-for="sourceGroup in groupedEntities" :key="sourceGroup.group" class="source-panel">
              <header>
                <div class="source-icon"><Component :is="sourceGroup.icon" /></div>
                <div><h3>{{ sourceGroup.title }}</h3><p>{{ sourceGroup.description }}</p></div>
              </header>
              <div class="source-options">
                <button
                  v-for="entity in sourceGroup.items"
                  :key="entity.key"
                  type="button"
                  class="source-option"
                  :class="{ selected: selectedEntityKey === entity.key }"
                  @click="selectedEntityKey = entity.key"
                >
                  <Component :is="entityIcon(entity)" />
                  <span>{{ entity.label }}</span>
                  <span v-if="entity.dynamic" class="option-tag">Smart process</span>
                </button>
              </div>
            </section>
          </div>

          <form class="lookup-bar" @submit.prevent="lookup">
            <div class="lookup-selection">
              <span>Selected entity type</span>
              <strong>{{ selectedEntity?.label }}</strong>
            </div>
            <B24Button type="submit" label="Explore fields" :trailing-icon="ArrowRightLIcon" color="air-primary" size="lg" loading-auto />
          </form>
        </section>

        <section v-else class="explorer-page">
          <button type="button" class="back-link" @click="returnToPicker">Back to entity picker</button>

          <div class="record-header">
            <div class="record-title">
              <div class="record-type">{{ explorer.context.label }} <span>Schema</span></div>
              <h2>{{ explorer.title }}</h2>
            </div>
            <div class="record-summary">
              <span><strong>{{ stats.total }}</strong> fields</span>
              <span><strong>{{ stats.custom }}</strong> custom</span>
            </div>
          </div>

          <div class="filter-workspace">
            <div class="search-row">
              <B24Input v-model="search" :icon="CrmSearchIcon" placeholder="Search field name, API code, or type" size="lg" class="field-search" rounded />
              <div class="source-tabs" role="group" aria-label="Field source">
                <B24Button
                  v-for="item in sourceItems"
                  :key="item.value"
                  :label="item.label"
                  :active="sourceFilter === item.value"
                  active-color="air-primary"
                  color="air-tertiary-no-accent"
                  size="sm"
                  @click="setSourceFilter(item.value)"
                />
              </div>
            </div>
            <div class="secondary-filters">
              <span class="result-count">Showing {{ filteredFields.length }} of {{ stats.total }}</span>
              <B24Select v-model="typeFilter" :items="typeItems" value-key="value" class="small-select" size="sm" />
              <B24Select v-model="sortMode" :items="sortItems" value-key="value" class="sort-select" size="sm" />
            </div>
          </div>

          <B24Alert v-if="state === 'error'" title="The schema could not be refreshed" :description="errorMessage" color="air-primary-alert" class="mb-4" />

          <B24TableWrapper rounded bordered row-hover pin-rows size="md" class="field-table-wrap">
            <B24Table
              :data="filteredFields"
              :columns="columns"
              :loading="state === 'loading'"
              sticky="header"
              empty="No fields match the current filters."
              :on-select="(_event: Event, row: { original: FieldRow }) => showDetails(row.original)"
              :b24ui="{ root: 'max-h-[650px]', td: 'align-middle' }"
            >
              <template #label-cell="{ row }">
                <div class="field-name-cell" :class="{ custom: row.original.custom }">
                  <strong>{{ row.original.label }}</strong>
                  <span>{{ row.original.custom ? 'Custom field' : 'System field' }}</span>
                </div>
              </template>
              <template #code-cell="{ row }">
                <button class="code-button" type="button" title="Copy API code" @click.stop="copyText(row.original.code, 'API code')">
                  <code>{{ row.original.code }}</code><CopyIcon />
                </button>
              </template>
              <template #type-cell="{ row }">
                <B24Badge :label="row.original.type" color="air-secondary" size="xs" />
              </template>
              <template #flags-cell="{ row }">
                <div class="flag-list">
                  <B24Badge v-if="row.original.required" label="Required" color="air-secondary-alert" size="xs" />
                  <B24Badge v-if="row.original.multiple" label="Multiple" color="air-secondary-accent-2" size="xs" />
                  <B24Badge v-if="row.original.readOnly" label="Read only" color="air-secondary" size="xs" />
                  <span v-if="!row.original.required && !row.original.multiple && !row.original.readOnly" class="plain-attribute">Standard</span>
                </div>
              </template>
              <template #actions-cell="{ row }">
                <B24Button label="View" size="xs" color="air-tertiary-accent" @click.stop="showDetails(row.original)" />
              </template>
              <template #empty>
                <div class="table-empty"><CrmSearchIcon /><strong>No matching fields</strong><span>Clear or change the filters above.</span></div>
              </template>
            </B24Table>
          </B24TableWrapper>

          <div class="field-card-list">
            <article v-for="field in filteredFields" :key="field.code" class="field-card" :class="{ custom: field.custom }">
              <header>
                <div><strong>{{ field.label }}</strong><span>{{ field.custom ? 'Custom field' : 'System field' }}</span></div>
                <B24Badge :label="field.type" color="air-secondary" size="xs" />
              </header>
              <button class="mobile-code" type="button" @click="copyText(field.code, 'API code')"><code>{{ field.code }}</code><CopyIcon /></button>
              <footer>
                <div class="flag-list">
                  <B24Badge v-if="field.required" label="Required" color="air-secondary-alert" size="xs" />
                  <B24Badge v-if="field.multiple" label="Multiple" color="air-secondary-accent-2" size="xs" />
                  <span v-if="!field.required && !field.multiple" class="plain-attribute">Standard field</span>
                </div>
                <B24Button label="Details" size="xs" color="air-tertiary-accent" @click="showDetails(field)" />
              </footer>
            </article>
            <div v-if="!filteredFields.length" class="mobile-empty">No fields match the current filters.</div>
          </div>
        </section>
      </main>
    </div>

    <B24Modal v-model:open="detailsOpen" :title="selectedField?.label || 'Field details'" :description="selectedField?.custom ? 'Custom field' : 'System field'" scrollable :b24ui="{ content: 'sm:max-w-[680px]' }">
      <template #body>
        <div v-if="selectedField" class="detail-stack">
          <section class="detail-code-block">
            <div><span>API code</span><code>{{ selectedField.code }}</code></div>
            <B24Button :icon="CopyIcon" size="sm" color="air-secondary-no-accent" label="Copy code" @click="copyText(selectedField.code, 'API code')" />
          </section>
          <B24DescriptionList :items="[
            { label: 'Original code', description: selectedField.upperName },
            { label: 'Data type', description: selectedField.type },
            { label: 'Required', description: selectedField.required ? 'Yes' : 'No' },
            { label: 'Multiple values', description: selectedField.multiple ? 'Yes' : 'No' },
            { label: 'Read only', description: selectedField.readOnly ? 'Yes' : 'No' }
          ]" />
          <section v-if="Object.keys(selectedField.settings).length"><div class="detail-section-title">Field settings</div><pre class="raw-panel">{{ JSON.stringify(selectedField.settings, null, 2) }}</pre></section>
        </div>
      </template>
    </B24Modal>
  </B24App>
</template>