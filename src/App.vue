<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import CrmSearchIcon from '@bitrix24/b24icons-vue/crm/CrmSearchIcon'
import CopyIcon from '@bitrix24/b24icons-vue/outline/CopyIcon'
import CirclePlusIcon from '@bitrix24/b24icons-vue/outline/CirclePlusIcon'
import DownloadIcon from '@bitrix24/b24icons-vue/outline/DownloadIcon'
import EditSIcon from '@bitrix24/b24icons-vue/outline/EditSIcon'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'
import RefreshIcon from '@bitrix24/b24icons-vue/outline/RefreshIcon'
import SettingsIcon from '@bitrix24/b24icons-vue/outline/SettingsIcon'
import TrashcanIcon from '@bitrix24/b24icons-vue/outline/TrashcanIcon'
import { useColorMode, useToast } from '@bitrix24/b24ui-nuxt/composables'
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
  loadExplorer,
  updateCustomField
} from '@/services/bitrix'

type LoadState = 'initializing' | 'standalone' | 'ready' | 'loading' | 'error'
type SourceFilter = 'all' | 'custom' | 'system'
type SortMode = 'custom-first' | 'label' | 'code' | 'type'

interface EnumOptionItem {
  id?: string
  value: string
  sort: number
  def?: string
  del?: boolean
}

const toast = useToast()
const colorMode = useColorMode()
colorMode.preference = 'light'

const state = ref<LoadState>('initializing')
const isLoading = computed(() => state.value === 'loading')
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

const editOpen = ref(false)
const editingField = ref<FieldRow | null>(null)
const isSavingField = ref(false)
const editForm = ref({
  label: '',
  mandatory: 'N' as 'Y' | 'N',
  sort: 100,
  showFilter: 'Y' as 'Y' | 'N',
  showInList: 'Y' as 'Y' | 'N',
  enumOptions: [] as EnumOptionItem[]
})

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

const mandatoryItems = [
  { label: 'Optional (No)', value: 'N' },
  { label: 'Required (Yes)', value: 'Y' }
]

const entityItems = computed(() => entities.value.map((entity) => ({
  label: `[${entity.group}] ${entity.dynamic ? `${entity.label} (Smart Process)` : entity.label}`,
  value: entity.key
})))

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
    custom: fields.filter((field) => field.custom).length,
    system: fields.filter((field) => !field.custom).length
  }
})

const columns = [
  { accessorKey: 'label', header: 'Field name', meta: { class: { th: 'min-w-[220px]' } } },
  { accessorKey: 'code', header: 'API code', meta: { class: { th: 'min-w-[210px]' } } },
  { accessorKey: 'type', header: 'Data type' },
  { accessorKey: 'flags', header: 'Attributes', enableSorting: false },
  { accessorKey: 'actions', header: '', enableSorting: false, meta: { class: { th: 'w-24 text-right', td: 'w-24 text-right' } } }
]

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
    state.value = 'ready'
    await resizeFrame()
  } catch (error) {
    errorMessage.value = asMessage(error)
    state.value = 'error'
  }
}

async function onEntityChange(key: string): Promise<void> {
  selectedEntityKey.value = key
  resetFilters()
  const entity = selectedEntity.value
  if (entity) {
    await openContext(entity)
  }
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

function openEditModal(field: FieldRow): void {
  editingField.value = field
  editForm.value = {
    label: field.label,
    mandatory: field.required ? 'Y' : 'N',
    sort: field.sort ?? 100,
    showFilter: (field.showFilter as 'Y' | 'N') || 'Y',
    showInList: (field.showInList as 'Y' | 'N') || 'Y',
    enumOptions: field.enumOptions ? field.enumOptions.map((opt) => ({ ...opt, sort: opt.sort ?? 100 })) : []
  }
  editOpen.value = true
}

function addEnumOption(): void {
  const nextSort = (editForm.value.enumOptions.length + 1) * 10
  editForm.value.enumOptions.push({
    value: '',
    sort: nextSort,
    def: 'N'
  })
}

function removeEnumOption(index: number): void {
  const item = editForm.value.enumOptions[index]
  if (item && item.id) {
    item.del = true
  } else {
    editForm.value.enumOptions.splice(index, 1)
  }
}

async function handleSaveField(): Promise<void> {
  if (!editingField.value) return
  if (!editForm.value.label.trim()) {
    toast.add({ title: 'Field label is required', color: 'air-primary-alert' })
    return
  }

  isSavingField.value = true
  try {
    await updateCustomField({
      id: editingField.value.userfieldId,
      code: editingField.value.code,
      label: editForm.value.label.trim(),
      mandatory: editForm.value.mandatory,
      sort: editForm.value.sort,
      showFilter: editForm.value.showFilter,
      showInList: editForm.value.showInList,
      enumOptions: editForm.value.enumOptions
    })

    toast.add({ title: 'Custom field updated successfully', color: 'air-primary-success' })
    editOpen.value = false
    await refresh()
  } catch (error) {
    toast.add({ title: 'Update failed', description: asMessage(error), color: 'air-primary-alert' })
  } finally {
    isSavingField.value = false
  }
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
    description: `${filteredFields.value.length} fields exported to CSV.`,
    color: 'air-primary-success'
  })
}

async function registerTabs(): Promise<void> {
  installing.value = true
  try {
    const count = await installApplication(`${window.location.origin}${window.location.pathname}`)
    toast.add({ title: 'CRM tabs registered', description: `${count} available placements bound.`, color: 'air-primary-success' })
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
  window.BX24?.resizeWindow?.(document.body.clientWidth, Math.max(document.documentElement.scrollHeight, 680))
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
      demoField({ code: 'UF_CRM_CLIENT_REFERENCE', label: 'Client reference', type: 'string', custom: true, userfieldId: 7091 }),
      demoField({ code: 'UF_CRM_PROJECT_SCOPE', label: 'Project scope', type: 'enumeration', custom: true, multiple: true, userfieldId: 7092, enumOptions: [{ id: '1', value: 'Design', sort: 10 }, { id: '2', value: 'Development', sort: 20 }] }),
      demoField({ code: 'UF_CRM_APPROVAL_DATE', label: 'Approval date', type: 'date', custom: true, userfieldId: 7093 }),
      demoField({ code: 'UF_CRM_PURCHASE_ORDER', label: 'Purchase order', type: 'file', custom: true, userfieldId: 7094 }),
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
    loadPreview()
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

    const initial = context
      ? availableEntities.find((e) => e.key === context.key || (e.source === 'crm' && e.entityTypeId === context.entityTypeId)) || context
      : availableEntities[0]!

    selectedEntityKey.value = initial.key
    await openContext(initial)
  } catch (error) {
    errorMessage.value = asMessage(error)
    state.value = 'error'
  }
})
</script>

<template>
  <B24App>
    <div class="app-root">
      <!-- TOP COMPACT TOOLBAR -->
      <header class="compact-header">
        <div class="header-left">
          <div class="app-brand">
            <CrmSearchIcon class="brand-logo" />
            <span class="brand-title">Field Explorer</span>
          </div>

          <div class="entity-selector-wrap">
            <B24Select
              v-model="selectedEntityKey"
              :items="entityItems"
              value-key="value"
              size="sm"
              class="entity-dropdown"
              @update:model-value="onEntityChange"
            />
          </div>
        </div>

        <div class="header-right">
          <B24Input
            v-model="search"
            :icon="CrmSearchIcon"
            placeholder="Filter fields..."
            size="sm"
            class="header-search"
          />

          <div class="source-filter-pills">
            <button
              v-for="item in sourceItems"
              :key="item.value"
              type="button"
              class="pill-btn"
              :class="{ active: sourceFilter === item.value }"
              @click="setSourceFilter(item.value)"
            >
              {{ item.label }}
            </button>
          </div>

          <B24Select
            v-model="typeFilter"
            :items="typeItems"
            value-key="value"
            size="sm"
            class="header-select-sm"
          />

          <B24Select
            v-model="sortMode"
            :items="sortItems"
            value-key="value"
            size="sm"
            class="header-select-sm"
          />

          <div class="header-action-group">
            <B24Button
              :icon="RefreshIcon"
              size="sm"
              color="air-secondary-no-accent"
              :loading="isLoading"
              title="Refresh Schema"
              @click="refresh"
            />
            <B24Button
              :icon="DownloadIcon"
              label="Export CSV"
              size="sm"
              color="air-primary"
              :disabled="!filteredFields.length"
              @click="exportVisible"
            />
            <B24Button
              :icon="SettingsIcon"
              size="sm"
              color="air-secondary-no-accent"
              :loading="installing"
              title="Set up CRM placements"
              @click="registerTabs"
            />
          </div>
        </div>
      </header>

      <!-- MAIN WORKBENCH CONTENT -->
      <main class="workbench-main">
        <section v-if="state === 'initializing' || state === 'loading'" class="state-loading" aria-live="polite">
          <div class="skeleton-row" v-for="n in 8" :key="n">
            <B24Skeleton class="h-6 w-full" />
          </div>
        </section>

        <section v-else-if="state === 'standalone'" class="standalone-view">
          <B24Badge label="Standalone Mode" color="air-secondary-accent-1" />
          <h2>Open Field Explorer inside Bitrix24</h2>
          <p>
            Field Explorer accesses CRM schemas via the active Bitrix24 portal iframe session.
            Open the local application inside your Bitrix24 portal.
          </p>
          <B24Button
            to="https://pcicrm.bitrix24.com/marketplace/"
            target="_blank"
            label="Launch in Bitrix24"
            color="air-primary"
            size="md"
          />
        </section>

        <section v-else-if="state === 'error'" class="state-error">
          <B24Alert
            title="Failed to load schema"
            :description="errorMessage"
            color="air-primary-alert"
            :icon="InfoCircleIcon"
          />
        </section>

        <section v-else class="schema-view">
          <div class="schema-summary-bar">
            <div class="summary-meta">
              <strong>{{ selectedEntity?.label }} Schema</strong>
              <span class="meta-badge">{{ stats.total }} fields</span>
              <span class="meta-badge custom">{{ stats.custom }} custom</span>
              <span class="meta-badge system">{{ stats.system }} system</span>
            </div>
            <div class="summary-count">
              Showing {{ filteredFields.length }} of {{ stats.total }}
            </div>
          </div>

          <!-- DESCENT TABLE VIEW -->
          <B24TableWrapper rounded bordered row-hover pin-rows size="xs" class="compact-table-container">
            <B24Table
              :data="filteredFields"
              :columns="columns"
              :loading="isLoading"
              sticky="header"
              empty="No fields match the current search or filters."
              :on-select="(_event: Event, row: { original: FieldRow }) => showDetails(row.original)"
              :b24ui="{ root: 'max-h-[calc(100vh-130px)]', td: 'py-1.5 px-2 align-middle' }"
            >
              <template #label-cell="{ row }">
                <div class="field-label-cell" :class="{ custom: row.original.custom }">
                  <span class="field-title">{{ row.original.label }}</span>
                  <span class="field-kind">{{ row.original.custom ? 'Custom' : 'System' }}</span>
                </div>
              </template>

              <template #code-cell="{ row }">
                <button
                  type="button"
                  class="code-copy-btn"
                  title="Click to copy API code"
                  @click.stop="copyText(row.original.code, 'API code')"
                >
                  <code>{{ row.original.code }}</code>
                  <CopyIcon class="copy-ic" />
                </button>
              </template>

              <template #type-cell="{ row }">
                <B24Badge :label="row.original.type" color="air-secondary" size="xs" />
              </template>

              <template #flags-cell="{ row }">
                <div class="flag-tags">
                  <B24Badge v-if="row.original.required" label="Required" color="air-secondary-alert" size="xs" />
                  <B24Badge v-if="row.original.multiple" label="Multiple" color="air-secondary-accent-2" size="xs" />
                  <B24Badge v-if="row.original.readOnly" label="Read only" color="air-secondary" size="xs" />
                  <span v-if="!row.original.required && !row.original.multiple && !row.original.readOnly" class="flag-none">-</span>
                </div>
              </template>

              <template #actions-cell="{ row }">
                <div class="row-actions">
                  <B24Button
                    v-if="row.original.custom"
                    label="Edit"
                    size="xs"
                    color="air-primary"
                    :icon="EditSIcon"
                    title="Edit custom field configuration"
                    @click.stop="openEditModal(row.original)"
                  />
                  <B24Button
                    label="View"
                    size="xs"
                    color="air-tertiary-no-accent"
                    title="View metadata details"
                    @click.stop="showDetails(row.original)"
                  />
                </div>
              </template>

              <template #empty>
                <div class="empty-state">
                  <CrmSearchIcon class="size-6 text-slate-400" />
                  <span>No fields found matching the filter criteria.</span>
                </div>
              </template>
            </B24Table>
          </B24TableWrapper>

          <!-- RESPONSIVE CARDS FOR MOBILE -->
          <div class="mobile-card-grid">
            <article v-for="field in filteredFields" :key="field.code" class="mobile-field-card" :class="{ custom: field.custom }">
              <div class="card-head">
                <div>
                  <strong class="card-title">{{ field.label }}</strong>
                  <span class="card-subtitle">{{ field.custom ? 'Custom' : 'System' }}</span>
                </div>
                <B24Badge :label="field.type" color="air-secondary" size="xs" />
              </div>

              <button type="button" class="mobile-code-btn" @click="copyText(field.code, 'API code')">
                <code>{{ field.code }}</code>
                <CopyIcon class="size-3.5" />
              </button>

              <div class="card-foot">
                <div class="flag-tags">
                  <B24Badge v-if="field.required" label="Required" color="air-secondary-alert" size="xs" />
                  <B24Badge v-if="field.multiple" label="Multiple" color="air-secondary-accent-2" size="xs" />
                </div>
                <div class="row-actions">
                  <B24Button
                    v-if="field.custom"
                    label="Edit"
                    size="xs"
                    color="air-primary"
                    @click="openEditModal(field)"
                  />
                  <B24Button
                    label="Details"
                    size="xs"
                    color="air-tertiary-no-accent"
                    @click="showDetails(field)"
                  />
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      <!-- EDIT CUSTOM FIELD MODAL -->
      <B24Modal
        v-model:open="editOpen"
        :title="`Edit Custom Field: ${editingField?.label}`"
        :description="editingField?.code"
        scrollable
        :b24ui="{ content: 'sm:max-w-[600px]' }"
      >
        <template #body>
          <form v-if="editingField" class="edit-field-form" @submit.prevent="handleSaveField">
            <B24FormField label="Field Label / Title" required help="The human-readable label displayed in CRM forms.">
              <B24Input v-model="editForm.label" placeholder="Field Label" class="w-full" size="md" />
            </B24FormField>

            <div class="form-row-2">
              <B24FormField label="Mandatory / Required">
                <B24Select v-model="editForm.mandatory" :items="mandatoryItems" value-key="value" size="md" class="w-full" />
              </B24FormField>

              <B24FormField label="Sort Index">
                <B24Input v-model.number="editForm.sort" type="number" min="0" placeholder="100" class="w-full" size="md" />
              </B24FormField>
            </div>

            <!-- ENUMERATION OPTIONS EDITOR -->
            <div v-if="editingField.type === 'enumeration' || editForm.enumOptions.length > 0" class="enum-editor-section">
              <div class="enum-header">
                <span class="enum-title">Dropdown List Options</span>
                <B24Button
                  type="button"
                  label="Add Option"
                  size="xs"
                  color="air-secondary-accent-1"
                  :icon="CirclePlusIcon"
                  @click="addEnumOption"
                />
              </div>

              <div class="enum-list">
                <div
                  v-for="(option, idx) in editForm.enumOptions.filter(o => !o.del)"
                  :key="option.id || idx"
                  class="enum-row"
                >
                  <B24Input
                    v-model="option.value"
                    placeholder="Option Value"
                    size="sm"
                    class="flex-1"
                  />
                  <B24Input
                    v-model.number="option.sort"
                    type="number"
                    placeholder="Sort"
                    size="sm"
                    class="w-20"
                  />
                  <B24Button
                    type="button"
                    size="xs"
                    color="air-secondary-alert"
                    :icon="TrashcanIcon"
                    title="Remove Option"
                    @click="removeEnumOption(idx)"
                  />
                </div>

                <div v-if="editForm.enumOptions.filter(o => !o.del).length === 0" class="enum-empty">
                  No options defined. Click "Add Option" to create list choices.
                </div>
              </div>
            </div>

            <div class="edit-modal-footer">
              <B24Button label="Cancel" color="air-tertiary-no-accent" size="md" @click="() => { editOpen = false }" />
              <B24Button
                type="submit"
                label="Save Changes"
                color="air-primary"
                size="md"
                :loading="isSavingField"
              />
            </div>
          </form>
        </template>
      </B24Modal>

      <!-- VIEW METADATA MODAL -->
      <B24Modal
        v-model:open="detailsOpen"
        :title="selectedField?.label || 'Field Details'"
        :description="selectedField?.code"
        scrollable
        :b24ui="{ content: 'sm:max-w-[600px]' }"
      >
        <template #body>
          <div v-if="selectedField" class="detail-stack">
            <div class="detail-code-banner">
              <div>
                <span class="banner-title">REST API Field Code</span>
                <code>{{ selectedField.code }}</code>
              </div>
              <B24Button
                :icon="CopyIcon"
                size="xs"
                color="air-secondary-no-accent"
                label="Copy Code"
                @click="copyText(selectedField.code, 'API code')"
              />
            </div>

            <B24DescriptionList
              size="sm"
              :items="[
                { label: 'Original REST Code', description: selectedField.upperName },
                { label: 'Data Type', description: selectedField.type },
                { label: 'Custom Field', description: selectedField.custom ? 'Yes (UF_*)' : 'No (System)' },
                { label: 'Userfield Config ID', description: selectedField.userfieldId ? String(selectedField.userfieldId) : 'N/A' },
                { label: 'Required', description: selectedField.required ? 'Yes' : 'No' },
                { label: 'Multiple Values', description: selectedField.multiple ? 'Yes' : 'No' },
                { label: 'Read Only', description: selectedField.readOnly ? 'Yes' : 'No' },
                { label: 'Immutable', description: selectedField.immutable ? 'Yes' : 'No' }
              ]"
            />

            <div v-if="Object.keys(selectedField.settings).length" class="detail-json-section">
              <span class="section-label">Field Settings Configuration</span>
              <pre class="json-box">{{ JSON.stringify(selectedField.settings, null, 2) }}</pre>
            </div>
          </div>
        </template>
      </B24Modal>
    </div>
  </B24App>
</template>
