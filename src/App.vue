<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import CrmSearchIcon from '@bitrix24/b24icons-vue/crm/CrmSearchIcon'
import DealIcon from '@bitrix24/b24icons-vue/crm/DealIcon'
import CopyIcon from '@bitrix24/b24icons-vue/outline/CopyIcon'
import DownloadIcon from '@bitrix24/b24icons-vue/outline/DownloadIcon'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'
import RefreshIcon from '@bitrix24/b24icons-vue/outline/RefreshIcon'
import SettingsIcon from '@bitrix24/b24icons-vue/outline/SettingsIcon'
import { useToast } from '@bitrix24/b24ui-nuxt/composables'
import type { FieldRow, EntityContext, EntityOption, ExplorerData } from '@/types'
import { CORE_ENTITIES } from '@/types'
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

type LoadState = 'initializing' | 'ready' | 'loading' | 'error'
type SourceFilter = 'all' | 'custom' | 'system'
type ValueFilter = 'all' | 'populated' | 'empty'
type SortMode = 'custom-first' | 'label' | 'code' | 'type'

const toast = useToast()
const state = ref<LoadState>('initializing')
const errorMessage = ref('')
const explorer = ref<ExplorerData | null>(null)
const entities = ref<EntityOption[]>([...CORE_ENTITIES])
const selectedEntityKey = ref('crm-deal')
const lookupId = ref<number | undefined>()
const search = ref('')
const sourceFilter = ref<SourceFilter>('all')
const valueFilter = ref<ValueFilter>('all')
const typeFilter = ref('all')
const sortMode = ref<SortMode>('custom-first')
const detailsOpen = ref(false)
const selectedField = ref<FieldRow | null>(null)
const installing = ref(false)
const installed = ref<boolean | null>(null)

const sourceItems = [
  { label: 'All fields', value: 'all' },
  { label: 'Custom fields', value: 'custom' },
  { label: 'System fields', value: 'system' }
]
const valueItems = [
  { label: 'Any value', value: 'all' },
  { label: 'Populated', value: 'populated' },
  { label: 'Empty', value: 'empty' }
]
const sortItems = [
  { label: 'Custom fields first', value: 'custom-first' },
  { label: 'Label A-Z', value: 'label' },
  { label: 'Field code A-Z', value: 'code' },
  { label: 'Field type A-Z', value: 'type' }
]

const entityItems = computed(() => entities.value.map((entity) => ({
  label: `${entity.group} / ${entity.dynamic ? `${entity.label} (Smart process)` : entity.label}`,
  value: entity.key
})))

const selectedEntity = computed(() => entities.value.find((entity) => entity.key === selectedEntityKey.value))
const lookupHelp = computed(() => {
  switch (selectedEntity.value?.source) {
    case 'activity': return 'Use the activity ID, not the owning deal or contact ID.'
    case 'catalog-product': return 'Use the catalog product ID, not a CRM product-row ID.'
    case 'catalog-sku': return 'Use the parent product ID for a product that has variations.'
    case 'catalog-offer': return 'Use the sellable variation or offer ID.'
    case 'catalog-store': return 'Use the warehouse or store ID.'
    case 'inventory-document': return 'Use the inventory document ID. Inventory Management must be enabled.'
    default: return 'Use the numeric ID from the CRM record URL.'
  }
})

const typeItems = computed(() => {
  const types = [...new Set((explorer.value?.fields || []).map((field) => field.type))].sort()
  return [{ label: 'All types', value: 'all' }, ...types.map((type) => ({ label: type, value: type }))]
})

const filteredFields = computed(() => {
  const query = search.value.trim().toLowerCase()
  const rows = (explorer.value?.fields || []).filter((field) => {
    if (query && ![field.label, field.code, field.upperName, field.type, field.displayValue]
      .some((value) => value.toLowerCase().includes(query))) return false
    if (sourceFilter.value === 'custom' && !field.custom) return false
    if (sourceFilter.value === 'system' && field.custom) return false
    if (valueFilter.value === 'populated' && !field.populated) return false
    if (valueFilter.value === 'empty' && field.populated) return false
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
    custom: fields.filter((field) => field.custom).length,
    populated: fields.filter((field) => field.populated).length,
    required: fields.filter((field) => field.required).length
  }
})

const columns = [
  { accessorKey: 'code', header: 'Field code', meta: { class: { th: 'min-w-[220px]', td: 'field-code-cell' } } },
  { accessorKey: 'label', header: 'Field label', meta: { class: { th: 'min-w-[180px]' } } },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'flags', header: 'Properties', enableSorting: false },
  { accessorKey: 'displayValue', header: 'Current value', meta: { class: { th: 'min-w-[240px]', td: 'max-w-[420px]' } } },
  { accessorKey: 'actions', header: '', enableSorting: false, meta: { class: { th: 'w-12', td: 'w-12' } } }
]

function asMessage(error: unknown): string {
  if (error instanceof BitrixError && error.code === 'ACCESS_DENIED') {
    return "Bitrix24 denied access to this CRM record. Check the user's CRM permissions and the app's CRM scope."
  }
  return error instanceof Error ? error.message : 'Bitrix24 could not load this record.'
}

async function openContext(context: EntityContext): Promise<void> {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    explorer.value = await loadExplorer(context)
    state.value = 'ready'
    await resizeFrame()
  } catch (error) {
    errorMessage.value = asMessage(error)
    state.value = 'error'
  }
}

async function lookup(): Promise<void> {
  if (!lookupId.value || lookupId.value < 1) {
    toast.add({ title: 'Enter a valid record ID', description: 'Record IDs are positive numbers.', color: 'air-primary-alert' })
    return
  }
  const entity = entities.value.find((option) => option.key === selectedEntityKey.value)
  if (!entity) return
  await openContext({ ...entity, id: lookupId.value })
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
  const csv = createFieldsCsv(filteredFields.value, explorer.value.context)
  downloadCsv(csv, csvFilename(explorer.value.context))
  toast.add({
    title: 'CSV exported',
    description: `${filteredFields.value.length} field${filteredFields.value.length === 1 ? '' : 's'} included from the current view.`,
    color: 'air-primary-success'
  })
}

async function registerTabs(): Promise<void> {
  installing.value = true
  try {
    const handler = `${window.location.origin}${window.location.pathname}`
    const count = await installApplication(handler)
    toast.add({ title: 'CRM tabs registered', description: `${count} available detail tabs now open Field Explorer.`, color: 'air-primary-success' })
    if (installed.value === false) finishInstallation()
    installed.value = true
  } catch (error) {
    toast.add({ title: 'Tab registration failed', description: asMessage(error), color: 'air-primary-alert' })
  } finally {
    installing.value = false
  }
}

async function resizeFrame(): Promise<void> {
  await nextTick()
  window.BX24?.resizeWindow?.('100%', Math.max(document.documentElement.scrollHeight, 720))
}

onMounted(async () => {
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
      await openContext(matchingEntity ? { ...matchingEntity, id: context.id } : context)
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
    <main class="app-shell">
      <section class="explorer-frame">
        <header class="app-header">
          <div class="brand-lockup">
            <div class="brand-mark" aria-hidden="true">
              <span>UF</span>
            </div>
            <div>
              <div class="eyebrow">CRM schema workbench</div>
              <h1>Field Explorer</h1>
            </div>
          </div>
          <div class="header-actions">
            <B24Tooltip text="Reload schema and values">
              <B24Button
                v-if="explorer"
                :icon="RefreshIcon"
                color="air-tertiary-no-accent"
                aria-label="Refresh fields"
                :loading="state === 'loading'"
                @click="refresh"
              />
            </B24Tooltip>
            <B24Button
              :icon="SettingsIcon"
              color="air-secondary-no-accent"
              :loading="installing"
              label="Register CRM tabs"
              @click="registerTabs"
            />
          </div>
        </header>

        <div v-if="state === 'initializing'" class="state-panel" aria-live="polite">
          <div class="state-heading">
            <B24Skeleton class="h-9 w-56" />
            <B24Skeleton class="h-5 w-80 max-w-full" />
          </div>
          <div class="skeleton-grid">
            <B24Skeleton v-for="index in 12" :key="index" class="h-12" />
          </div>
        </div>

        <div v-else-if="state === 'error' && !explorer" class="state-panel compact-state">
          <B24Alert
            title="Field Explorer could not start"
            :description="errorMessage"
            color="air-primary-alert"
            :icon="InfoCircleIcon"
          />
        </div>

        <template v-else>
          <section v-if="!explorer" class="launch-panel">
            <div class="launch-copy">
              <B24Badge label="Read-only CRM inspector" color="air-secondary-accent-1" size="sm" />
              <h2>Find the field behind the label.</h2>
              <p>
                Inspect CRM, activity, product catalog, warehouse, and inventory-document fields without
                leaving Bitrix24. Open a supported placement or look up a record directly.
              </p>
            </div>
            <form class="lookup-form" @submit.prevent="lookup">
              <div class="lookup-caption">Open a CRM record</div>
              <B24FormField label="Entity type">
                <B24Select
                  v-model="selectedEntityKey"
                  :items="entityItems"
                  value-key="value"
                  class="w-full"
                  :icon="DealIcon"
                />
              </B24FormField>
              <B24FormField label="Record ID" :help="lookupHelp">
                <B24Input v-model.number="lookupId" type="number" min="1" placeholder="For example, 123" class="w-full" />
              </B24FormField>
              <B24Button type="submit" label="Explore fields" color="air-primary" size="lg" block loading-auto />
            </form>
          </section>

          <template v-else>
            <section class="record-strip">
              <div class="record-identity">
                <div class="record-kicker">{{ explorer.context.label }} / ID {{ explorer.context.id }}</div>
                <h2>{{ explorer.title }}</h2>
              </div>
              <dl class="schema-stats" aria-label="Field summary">
                <div><dt>Fields</dt><dd>{{ stats.total }}</dd></div>
                <div><dt>Custom</dt><dd>{{ stats.custom }}</dd></div>
                <div><dt>Populated</dt><dd>{{ stats.populated }}</dd></div>
                <div><dt>Required</dt><dd>{{ stats.required }}</dd></div>
              </dl>
            </section>

            <section class="workspace">
              <div class="toolbar">
                <B24Input
                  v-model="search"
                  :icon="CrmSearchIcon"
                  placeholder="Search label, code, type, or value"
                  class="search-control"
                  rounded
                />
                <div class="filter-controls">
                  <B24Select v-model="sourceFilter" :items="sourceItems" value-key="value" class="filter-select" />
                  <B24Select v-model="valueFilter" :items="valueItems" value-key="value" class="filter-select" />
                  <B24Select v-model="typeFilter" :items="typeItems" value-key="value" class="filter-select" />
                  <B24Select v-model="sortMode" :items="sortItems" value-key="value" class="sort-select" />
                </div>
                <B24Button
                  :icon="DownloadIcon"
                  label="Export CSV"
                  color="air-primary"
                  :disabled="!filteredFields.length"
                  @click="exportVisible"
                />
              </div>

              <div class="result-line">
                <span>{{ filteredFields.length }} of {{ stats.total }} fields</span>
                <span v-if="search || sourceFilter !== 'all' || valueFilter !== 'all' || typeFilter !== 'all'" class="filter-status">
                  Current filters apply to CSV export
                </span>
              </div>

              <B24Alert
                v-if="state === 'error'"
                title="The record could not be refreshed"
                :description="errorMessage"
                color="air-primary-alert"
                class="mb-3"
              />

              <B24TableWrapper rounded bordered row-hover pin-rows size="sm" class="field-table-wrap">
                <B24Table
                  :data="filteredFields"
                  :columns="columns"
                  :loading="state === 'loading'"
                  sticky="header"
                  empty="No fields match the current filters."
                  :on-select="(_event: Event, row: { original: FieldRow }) => showDetails(row.original)"
                  :b24ui="{ root: 'max-h-[620px]', td: 'align-top' }"
                >
                  <template #code-cell="{ row }">
                    <div class="field-code">
                      <span class="code-pulse" :class="row.original.custom ? 'is-custom' : 'is-system'" />
                      <div>
                        <code>{{ row.original.code }}</code>
                        <span v-if="row.original.upperName !== row.original.code" class="original-code">
                          {{ row.original.upperName }}
                        </span>
                      </div>
                    </div>
                  </template>
                  <template #label-cell="{ row }">
                    <div class="field-label">{{ row.original.label }}</div>
                    <div class="field-source">{{ row.original.custom ? 'Custom field' : 'System field' }}</div>
                  </template>
                  <template #type-cell="{ row }">
                    <B24Badge :label="row.original.type" color="air-secondary" size="xs" />
                  </template>
                  <template #flags-cell="{ row }">
                    <div class="flag-list">
                      <B24Badge v-if="row.original.required" label="Required" color="air-secondary-alert" size="xs" />
                      <B24Badge v-if="row.original.multiple" label="Multiple" color="air-secondary-accent-2" size="xs" />
                      <B24Badge v-if="row.original.readOnly" label="Read only" color="air-secondary" size="xs" />
                      <span v-if="!row.original.required && !row.original.multiple && !row.original.readOnly" class="muted-value">-</span>
                    </div>
                  </template>
                  <template #displayValue-cell="{ row }">
                    <div v-if="row.original.populated" class="value-preview" :title="row.original.rawValue">
                      {{ row.original.displayValue }}
                    </div>
                    <span v-else class="empty-value">Empty</span>
                  </template>
                  <template #actions-cell="{ row }">
                    <B24Tooltip text="Copy field code">
                      <B24Button
                        :icon="CopyIcon"
                        size="sm"
                        color="air-tertiary-no-accent"
                        aria-label="Copy field code"
                        @click.stop="copyText(row.original.code, 'Field code')"
                      />
                    </B24Tooltip>
                  </template>
                  <template #empty>
                    <div class="table-empty">
                      <CrmSearchIcon class="size-8" />
                      <strong>No matching fields</strong>
                      <span>Change the search or filters to widen the current view.</span>
                    </div>
                  </template>
                </B24Table>
              </B24TableWrapper>
            </section>
          </template>
        </template>
      </section>
    </main>

    <B24Modal
      v-model:open="detailsOpen"
      :title="selectedField?.label || 'Field details'"
      :description="selectedField?.code"
      scrollable
      :b24ui="{ content: 'sm:max-w-[680px]' }"
    >
      <template #body>
        <div v-if="selectedField" class="detail-stack">
          <section class="detail-code-block">
            <div>
              <span>REST field code</span>
              <code>{{ selectedField.code }}</code>
            </div>
            <B24Button :icon="CopyIcon" size="sm" color="air-secondary-no-accent" label="Copy" @click="copyText(selectedField.code, 'Field code')" />
          </section>
          <B24DescriptionList :items="[
            { label: 'Original code', description: selectedField.upperName },
            { label: 'Type', description: selectedField.type },
            { label: 'Source', description: selectedField.custom ? 'Custom field' : 'System field' },
            { label: 'Value state', description: selectedField.populated ? 'Populated' : 'Empty' },
            { label: 'Required', description: selectedField.required ? 'Yes' : 'No' },
            { label: 'Multiple', description: selectedField.multiple ? 'Yes' : 'No' },
            { label: 'Read only', description: selectedField.readOnly ? 'Yes' : 'No' },
            { label: 'Immutable', description: selectedField.immutable ? 'Yes' : 'No' }
          ]" />
          <section>
            <div class="detail-section-title">Raw value</div>
            <pre class="raw-panel">{{ selectedField.rawValue || 'No value' }}</pre>
          </section>
          <section v-if="Object.keys(selectedField.settings).length">
            <div class="detail-section-title">Field settings</div>
            <pre class="raw-panel">{{ JSON.stringify(selectedField.settings, null, 2) }}</pre>
          </section>
        </div>
      </template>
    </B24Modal>
  </B24App>
</template>
